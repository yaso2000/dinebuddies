const functions = require('firebase-functions');
const admin = require('firebase-admin');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { grantPaidCreditsInTransaction, isBusinessUserDoc, priceIdToCreditPackage } = require('./creditsCore');
const { getCheckoutPlan, getCheckoutPlanByPriceId } = require('./paymentPlans');

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

async function getSessionLineItemPriceId(session) {
    const embeddedPriceId = session.line_items?.data?.[0]?.price?.id;
    if (embeddedPriceId) return embeddedPriceId;
    if (!session.id) return null;
    const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 2 });
    const first = lineItems?.data?.[0];
    if (!first || lineItems.data.length !== 1) return null;
    return first.price?.id || null;
}

async function getVerifiedCatalogPlan(session) {
    const paidPriceId = await getSessionLineItemPriceId(session);
    const paidPlan = getCheckoutPlanByPriceId(paidPriceId);
    if (!paidPlan) {
        console.error('Unknown Stripe checkout price; refusing fulfillment', {
            sessionId: session.id,
            paidPriceId,
            metadata: session.metadata || {}
        });
        return null;
    }

    const metadataPlan = getCheckoutPlan(session.metadata?.planId);
    if (metadataPlan && metadataPlan.priceId !== paidPlan.priceId) {
        console.error('Checkout metadata/price mismatch; fulfilling actual paid price only', {
            sessionId: session.id,
            metadataPlanId: metadataPlan.id,
            metadataPriceId: metadataPlan.priceId,
            paidPlanId: paidPlan.id,
            paidPriceId
        });
    }
    return paidPlan;
}

async function getVerifiedDineCreditPackage(session) {
    const paidPriceId = await getSessionLineItemPriceId(session);
    const byPrice = priceIdToCreditPackage();
    const verified = byPrice[paidPriceId];
    if (!verified) {
        console.error('Unknown Dine Credits checkout price; refusing fulfillment', {
            sessionId: session.id,
            paidPriceId,
            metadata: session.metadata || {}
        });
        return null;
    }
    return verified;
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

async function handleDineCreditsPurchase(session, verifiedPackage) {
    const userId = session.metadata?.userId;
    const credits = Math.floor(Number(verifiedPackage?.credits));
    const packageId = String(verifiedPackage?.packageId || '');

    if (!userId || !Number.isFinite(credits) || credits <= 0) {
        console.error('Invalid dine credits checkout metadata', session.metadata);
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

    if (session.mode === 'payment' && session.payment_status && session.payment_status !== 'paid') {
        console.log('Payment checkout not paid yet; skipping fulfillment:', session.id, session.payment_status);
        return;
    }

    if (session.mode === 'payment' && session.metadata?.purchaseType === 'dine_credits') {
        const verifiedPackage = await getVerifiedDineCreditPackage(session);
        if (verifiedPackage) await handleDineCreditsPurchase(session, verifiedPackage);
        return;
    }

    const plan = await getVerifiedCatalogPlan(session);
    if (!plan) return;

    if (plan.mode === 'payment') {
        await handleCatalogPaymentPurchase(session, plan);
        return;
    }

    const planId = plan.id;
    const weeklyQuota = Number.isFinite(plan.weeklyPrivateQuota) ? plan.weeklyPrivateQuota : getQuotaForPlan(plan.subscriptionTier || planId);
    const tier = plan.subscriptionTier || getTierForPlan(planId);

    try {
        // Subscription plan
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
        await db.collection('user_subscriptions').doc(session.id).set({
            userId,
            planId,
            subscriptionId,
            status: 'active',
            startDate: admin.firestore.FieldValue.serverTimestamp(),
            sessionId: session.id,
            stripePriceId: plan.priceId
        }, { merge: true });

    } catch (error) {
        console.error('Error updating user subscription:', error);
    }
}

async function handleCatalogPaymentPurchase(session, plan) {
    const userId = session.metadata?.userId;
    const fulfillRef = db.collection('stripe_checkout_fulfillments').doc(session.id);
    const userRef = db.collection('users').doc(userId);

    await db.runTransaction(async (tx) => {
        const done = await tx.get(fulfillRef);
        if (done.exists) return;

        const userSnap = await tx.get(userRef);
        if (!userSnap.exists) {
            console.error('User not found for catalog checkout:', userId, session.id);
            return;
        }

        const updates = {
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };
        if (plan.purchaseType === 'private_invitation_pack') {
            updates.purchasedPrivateCredits = admin.firestore.FieldValue.increment(plan.privateCredits || 0);
        } else if (plan.purchaseType === 'offer_slot_pack') {
            updates.offerCredits = admin.firestore.FieldValue.increment(plan.offerCredits || 0);
        } else {
            console.error('Unsupported one-time checkout plan:', plan);
            return;
        }

        tx.update(userRef, updates);
        tx.set(fulfillRef, {
            userId,
            planId: plan.id,
            purchaseType: plan.purchaseType,
            privateCredits: plan.privateCredits || 0,
            offerCredits: plan.offerCredits || 0,
            stripePriceId: plan.priceId,
            sessionId: session.id,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
    });

    console.log(`✅ Fulfilled one-time checkout ${session.id} for user ${userId}: ${plan.id}`);
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
    const subscriptionPriceId = subscription.items?.data?.[0]?.price?.id || null;
    const plan = getCheckoutPlanByPriceId(subscriptionPriceId) ||
        getCheckoutPlan(subscription.metadata?.planId) ||
        getCheckoutPlan(usersSnapshot.docs[0].data().currentPlan);
    const planId = plan?.id || subscription.metadata?.planId || usersSnapshot.docs[0].data().currentPlan;
    const weeklyQuota = plan && Number.isFinite(plan.weeklyPrivateQuota)
        ? plan.weeklyPrivateQuota
        : getQuotaForPlan(planId);
    const tier = plan?.subscriptionTier || getTierForPlan(planId);

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
