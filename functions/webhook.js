const functions = require('firebase-functions');
const admin = require('firebase-admin');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { grantPaidCreditsInTransaction, isBusinessUserDoc, priceIdToCreditPackage } = require('./creditsCore');
const { getPaymentPlanByPrice } = require('./paymentPlans');

const db = admin.firestore();
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

// Map planId → weeklyPrivateQuota  (-1 = unlimited)
const PLAN_QUOTA_MAP = {
    // User plans
    'pro': 2,
    'premium': -1,
    // Partner plans (no private invites — they are business accounts)
    'professional': 0,
    'elite': 0,
};

function getQuotaForPlan(planId) {
    if (!planId) return 0;
    const id = planId.toLowerCase();
    if (id in PLAN_QUOTA_MAP) return PLAN_QUOTA_MAP[id];
    // Fallback by keyword
    if (id.includes('premium')) return -1;
    if (id.includes('pro')) return 2;
    return 0;
}

function getTierForPlan(planId) {
    if (!planId) return 'free';
    const id = planId.toLowerCase();
    if (id.includes('elite')) return 'elite';
    if (id.includes('professional')) return 'professional';
    if (id.includes('premium')) return 'premium';
    if (id.includes('pro')) return 'pro';
    return 'free';
}

async function getCheckoutLineItemPriceIds(session) {
    if (session.line_items?.data?.length) {
        return session.line_items.data
            .map((item) => item.price?.id)
            .filter(Boolean);
    }
    const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 10 });
    return (lineItems.data || [])
        .map((item) => item.price?.id)
        .filter(Boolean);
}

/**
 * Stripe Webhook handler
 */
exports.stripeWebhook = functions.https.onRequest(async (req, res) => {
    const sig = req.headers['stripe-signature'];

    let event;

    try {
        event = stripe.webhooks.constructEvent(req.rawBody, sig, endpointSecret);
    } catch (err) {
        console.error('⚠️ Webhook signature verification failed:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    console.log('✅ Webhook received:', event.type);

    try {
        switch (event.type) {
            case 'checkout.session.completed':
                await handleCheckoutComplete(event.data.object);
                break;

            case 'customer.subscription.updated':
                await handleSubscriptionUpdate(event.data.object);
                break;

            case 'customer.subscription.deleted':
                await handleSubscriptionCanceled(event.data.object);
                break;

            case 'invoice.payment_succeeded':
                await handlePaymentSucceeded(event.data.object);
                break;

            case 'invoice.payment_failed':
                await handlePaymentFailed(event.data.object);
                break;

            default:
                console.log(`Unhandled event type: ${event.type}`);
        }

        res.json({ received: true });
    } catch (error) {
        console.error('Error processing webhook:', error);
        res.status(500).send('Webhook processing failed');
    }
});

// ===== Event Handlers =====

async function handleDineCreditsPurchase(session, actualPriceId) {
    const userId = session.metadata?.userId;
    const paidPackage = priceIdToCreditPackage()[actualPriceId];
    const credits = Math.floor(Number(paidPackage?.credits));
    const packageId = String(paidPackage?.packageId || '');

    if (!userId || !paidPackage || !Number.isFinite(credits) || credits <= 0) {
        throw new Error(`Unrecognized Dine Credits price for session ${session.id}: ${actualPriceId || 'missing'}`);
    }

    if (session.payment_status && session.payment_status !== 'paid') {
        throw new Error(`Dine Credits session ${session.id} is not paid (${session.payment_status})`);
    }

    const fulfillRef = db.collection('stripe_dine_credit_fulfillments').doc(session.id);
    const userRef = db.collection('users').doc(userId);

    await db.runTransaction(async (tx) => {
        const done = await tx.get(fulfillRef);
        if (done.exists) return;

        const snap = await tx.get(userRef);
        if (!snap.exists) {
            console.error('User not found for dine credits:', userId);
            return;
        }
        const d = snap.data();
        const accountRole = isBusinessUserDoc(d) ? 'business' : 'user';
        grantPaidCreditsInTransaction(tx, userRef, d, {
            uid: userId,
            accountRole,
            credits,
            type: 'purchase',
            reason: `stripe_${packageId || 'credits'}`,
            relatedId: session.id,
        });
        tx.set(fulfillRef, {
            userId,
            credits,
            packageId,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    });

    console.log(`✅ Granted ${credits} dine credits to ${userId}`);
}

async function handleCheckoutComplete(session) {
    console.log('💳 Checkout completed:', session.id);

    const userId = session.metadata?.userId;
    const subscriptionId = session.subscription;

    if (!userId) {
        console.error('No userId in session metadata');
        return;
    }

    const priceIds = await getCheckoutLineItemPriceIds(session);
    if (priceIds.length !== 1) {
        throw new Error(`Expected exactly one checkout line item for ${session.id}, got ${priceIds.length}`);
    }
    const actualPriceId = priceIds[0];

    if (session.mode === 'payment' && session.metadata?.purchaseType === 'dine_credits') {
        await handleDineCreditsPurchase(session, actualPriceId);
        return;
    }

    const plan = getPaymentPlanByPrice(actualPriceId);
    if (!plan) {
        throw new Error(`Unrecognized checkout price for session ${session.id}: ${actualPriceId}`);
    }
    if (session.metadata?.planId && session.metadata.planId !== plan.planId) {
        throw new Error(`Checkout metadata plan ${session.metadata.planId} does not match paid price ${actualPriceId}`);
    }

    try {
        if (plan.mode === 'payment') {
            if (session.payment_status && session.payment_status !== 'paid') {
                throw new Error(`Checkout session ${session.id} is not paid (${session.payment_status})`);
            }
            const fulfillRef = db.collection('stripe_pack_fulfillments').doc(session.id);
            const userRef = db.collection('users').doc(userId);
            await db.runTransaction(async (tx) => {
                const done = await tx.get(fulfillRef);
                if (done.exists) return;
                const field = plan.packType === 'offer' ? 'offerCredits' : 'purchasedPrivateCredits';
                tx.update(userRef, {
                    [field]: admin.firestore.FieldValue.increment(plan.credits),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });
                tx.set(fulfillRef, {
                    userId,
                    planId: plan.planId,
                    packType: plan.packType,
                    credits: plan.credits,
                    priceId: actualPriceId,
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                });
            });
            console.log(`✅ User ${userId} received ${plan.credits} ${plan.packType} credit(s)`);
        } else {
            // Subscription plan
            await db.collection('users').doc(userId).update({
                subscriptionStatus: 'active',
                subscriptionId: subscriptionId,
                subscriptionTier: plan.tier,
                currentPlan: plan.planId,
                weeklyPrivateQuota: plan.weeklyPrivateQuota,
                usedPrivateCreditsThisWeek: 0,
                subscriptionStartDate: admin.firestore.FieldValue.serverTimestamp(),
                stripeCustomerId: session.customer || admin.firestore.FieldValue.delete()
            });

            console.log(`✅ User ${userId} → plan: ${plan.planId}, tier: ${plan.tier}, quota: ${plan.weeklyPrivateQuota}`);
        }

        // Save subscription record
        await db.collection('user_subscriptions').add({
            userId,
            planId: plan.planId,
            subscriptionId,
            status: 'active',
            startDate: admin.firestore.FieldValue.serverTimestamp(),
            sessionId: session.id
        });

    } catch (error) {
        console.error('Error updating user subscription:', error);
        throw error;
    }
}

async function handleSubscriptionUpdate(subscription) {
    console.log('🔄 Subscription updated:', subscription.id);

    const customer = subscription.customer;

    const usersSnapshot = await db.collection('users')
        .where('stripeCustomerId', '==', customer)
        .limit(1)
        .get();

    if (usersSnapshot.empty) {
        console.log('No user found for customer:', customer);
        return;
    }

    const userId = usersSnapshot.docs[0].id;
    const priceId = subscription.items?.data?.[0]?.price?.id;
    const plan = getPaymentPlanByPrice(priceId);
    if (!plan || plan.mode !== 'subscription') {
        throw new Error(`Unrecognized subscription price for ${subscription.id}: ${priceId || 'missing'}`);
    }

    await db.collection('users').doc(userId).update({
        subscriptionStatus: subscription.status,
        subscriptionTier: subscription.status === 'active' || subscription.status === 'trialing' ? plan.tier : 'free',
        currentPlan: plan.planId,
        weeklyPrivateQuota: subscription.status === 'active' || subscription.status === 'trialing' ? plan.weeklyPrivateQuota : 0,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log(`✅ User ${userId} updated → tier: ${plan.tier}, quota: ${plan.weeklyPrivateQuota}, status: ${subscription.status}`);
}

async function handleSubscriptionCanceled(subscription) {
    console.log('❌ Subscription canceled:', subscription.id);

    const customer = subscription.customer;

    const usersSnapshot = await db.collection('users')
        .where('stripeCustomerId', '==', customer)
        .limit(1)
        .get();

    if (usersSnapshot.empty) return;

    const userId = usersSnapshot.docs[0].id;

    await db.collection('users').doc(userId).update({
        subscriptionStatus: 'canceled',
        subscriptionTier: 'free',
        weeklyPrivateQuota: 0,
        subscriptionEndDate: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log(`✅ User ${userId} subscription canceled → reverted to free`);
}

async function handlePaymentSucceeded(invoice) {
    console.log('✅ Payment succeeded:', invoice.id);
}

async function handlePaymentFailed(invoice) {
    console.log('⚠️ Payment failed:', invoice.id);
}
