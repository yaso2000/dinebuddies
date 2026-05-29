const functions = require('firebase-functions');
const admin = require('firebase-admin');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { grantPaidCreditsInTransaction, isBusinessUserDoc, priceIdToCreditPackage } = require('./creditsCore');
const { findCheckoutPlanByPriceId } = require('./paymentPlans');

const db = admin.firestore();
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

// Map planId → weeklyPrivateQuota  (-1 = unlimited)
const PLAN_QUOTA_MAP = {
    // User plans
    'p2': 4,
    'p3': 10,
    'pro': 4,
    'vip': 10,
    'premium': 10,
    // Partner plans (no private invites — they are business accounts)
    'p4': 0,
    'p5': 0,
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
    if (id === 'p2') return 'pro';
    if (id === 'p3') return 'vip';
    if (id === 'p4') return 'professional';
    if (id === 'p5') return 'elite';
    if (id.includes('elite')) return 'elite';
    if (id.includes('professional')) return 'professional';
    if (id.includes('premium')) return 'premium';
    if (id.includes('pro')) return 'pro';
    return 'free';
}

async function getCheckoutLineItemPriceId(session) {
    const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 1 });
    return lineItems?.data?.[0]?.price?.id || null;
}

async function getVerifiedCheckoutPlan(session) {
    const priceId = await getCheckoutLineItemPriceId(session);
    const plan = findCheckoutPlanByPriceId(priceId);
    if (!plan) {
        console.error('Unrecognized checkout price; refusing fulfillment', { sessionId: session.id, priceId });
        return null;
    }
    if (session.mode !== plan.mode) {
        console.error('Checkout mode does not match catalog; refusing fulfillment', {
            sessionId: session.id,
            expectedMode: plan.mode,
            actualMode: session.mode,
        });
        return null;
    }
    return plan;
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

async function handleDineCreditsPurchase(session) {
    const userId = session.metadata?.userId;
    const priceId = await getCheckoutLineItemPriceId(session);
    const packageDef = priceIdToCreditPackage()[priceId];
    const credits = Math.floor(Number(packageDef?.credits));
    const packageId = String(packageDef?.packageId || '');

    if (!userId || !Number.isFinite(credits) || credits <= 0 || session.payment_status !== 'paid') {
        console.error('Invalid dine credits checkout fulfillment', {
            metadata: session.metadata,
            priceId,
            paymentStatus: session.payment_status,
        });
        return;
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

    if (session.mode === 'payment' && session.metadata?.purchaseType === 'dine_credits') {
        await handleDineCreditsPurchase(session);
        return;
    }

    const checkoutPlan = await getVerifiedCheckoutPlan(session);
    if (!checkoutPlan) return;

    if (checkoutPlan.mode === 'payment') {
        if (session.payment_status && session.payment_status !== 'paid') {
            console.error('Payment checkout completed without paid status; refusing fulfillment', {
                sessionId: session.id,
                paymentStatus: session.payment_status,
            });
            return;
        }
        await handleOneTimePlanPurchase(session, checkoutPlan, userId);
        return;
    }

    const weeklyQuota = Number(checkoutPlan.weeklyPrivateQuota) || 0;
    const tier = checkoutPlan.tier || getTierForPlan(checkoutPlan.currentPlan || checkoutPlan.id);
    const planId = checkoutPlan.currentPlan || checkoutPlan.id;

    try {
        await db.collection('users').doc(userId).update({
            subscriptionStatus: 'active',
            subscriptionId: subscriptionId,
            subscriptionTier: tier,
            currentPlan: planId,
            weeklyPrivateQuota: weeklyQuota,
            usedPrivateCreditsThisWeek: 0,
            subscriptionStartDate: admin.firestore.FieldValue.serverTimestamp(),
            stripeCustomerId: session.customer || admin.firestore.FieldValue.delete()
        });

        console.log(`✅ User ${userId} → plan: ${planId}, tier: ${tier}, quota: ${weeklyQuota}`);

        // Save subscription record
        await db.collection('user_subscriptions').add({
            userId,
            planId,
            subscriptionId,
            status: 'active',
            startDate: admin.firestore.FieldValue.serverTimestamp(),
            sessionId: session.id
        });

    } catch (error) {
        console.error('Error updating user subscription:', error);
    }
}

async function handleOneTimePlanPurchase(session, plan, userId) {
    const credits = Math.floor(Number(plan.credits));
    if (!plan.creditsField || !Number.isFinite(credits) || credits <= 0) {
        console.error('Invalid one-time plan configuration', { sessionId: session.id, planId: plan.id });
        return;
    }

    const fulfillRef = db.collection('stripe_checkout_fulfillments').doc(session.id);
    const userRef = db.collection('users').doc(userId);

    await db.runTransaction(async (tx) => {
        const done = await tx.get(fulfillRef);
        if (done.exists) return;

        const snap = await tx.get(userRef);
        if (!snap.exists) {
            console.error('User not found for checkout fulfillment:', userId);
            return;
        }

        tx.update(userRef, {
            [plan.creditsField]: admin.firestore.FieldValue.increment(credits),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        tx.set(fulfillRef, {
            userId,
            planId: plan.id,
            credits,
            creditsField: plan.creditsField,
            purchaseType: plan.purchaseType,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    });

    console.log(`✅ Fulfilled checkout ${session.id}: +${credits} ${plan.creditsField} for ${userId}`);
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
    const checkoutPlan = findCheckoutPlanByPriceId(priceId);
    const planId = checkoutPlan?.currentPlan || subscription.metadata?.currentPlan || subscription.metadata?.planId || usersSnapshot.docs[0].data().currentPlan;
    const weeklyQuota = checkoutPlan ? Number(checkoutPlan.weeklyPrivateQuota) || 0 : getQuotaForPlan(planId);
    const tier = checkoutPlan?.tier || getTierForPlan(planId);

    await db.collection('users').doc(userId).update({
        subscriptionStatus: subscription.status,
        subscriptionTier: tier,
        currentPlan: planId,
        weeklyPrivateQuota: weeklyQuota,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log(`✅ User ${userId} updated → tier: ${tier}, quota: ${weeklyQuota}, status: ${subscription.status}`);
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
