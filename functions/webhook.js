const functions = require('firebase-functions');
const admin = require('firebase-admin');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { grantPaidCreditsInTransaction, isBusinessUserDoc, priceIdToCreditPackage } = require('./creditsCore');
const { getPaymentPlan, getPaymentPlanByPriceId, isSubscriptionPlan } = require('./paymentPlans');

const db = admin.firestore();
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

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

async function getCheckoutLineItemPriceId(session) {
    const lineItems = await stripe.checkout.sessions.listLineItems(session.id, {
        limit: 1,
        expand: ['data.price'],
    });
    return lineItems?.data?.[0]?.price?.id || null;
}

async function verifyCatalogCheckoutPlan(session) {
    const requestedPlan = getPaymentPlan(session.metadata?.planId);
    const paidPriceId = await getCheckoutLineItemPriceId(session);
    const paidPlan = getPaymentPlanByPriceId(paidPriceId);

    if (!requestedPlan || !paidPlan || requestedPlan.id !== paidPlan.id) {
        throw new Error(`Checkout price mismatch for session ${session.id}: plan=${session.metadata?.planId || 'missing'} price=${paidPriceId || 'missing'}`);
    }
    if (session.mode !== requestedPlan.mode) {
        throw new Error(`Checkout mode mismatch for session ${session.id}: expected=${requestedPlan.mode} actual=${session.mode}`);
    }
    return requestedPlan;
}

async function verifyDineCreditsCheckout(session) {
    const paidPriceId = await getCheckoutLineItemPriceId(session);
    const expected = priceIdToCreditPackage()[paidPriceId];
    const packageId = String(session.metadata?.packageId || '');
    const credits = Math.floor(Number(session.metadata?.credits));

    if (!expected || expected.packageId !== packageId || expected.credits !== credits) {
        throw new Error(`Dine Credits price mismatch for session ${session.id}: package=${packageId || 'missing'} price=${paidPriceId || 'missing'}`);
    }
}

async function handleDineCreditsPurchase(session) {
    const userId = session.metadata?.userId;
    const credits = Math.floor(Number(session.metadata?.credits));
    const packageId = String(session.metadata?.packageId || '');

    if (!userId || !Number.isFinite(credits) || credits <= 0) {
        console.error('Invalid dine credits checkout metadata', session.metadata);
        return;
    }
    if (session.payment_status && session.payment_status !== 'paid') {
        console.error('Dine credits checkout is not paid:', session.id, session.payment_status);
        return;
    }
    await verifyDineCreditsCheckout(session);

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

async function fulfillOneTimeCatalogPlan(session, plan) {
    if (session.payment_status && session.payment_status !== 'paid') {
        console.error('One-time checkout is not paid:', session.id, session.payment_status);
        return;
    }

    const userId = session.metadata?.userId;
    if (!userId) {
        console.error('No userId in one-time checkout metadata');
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

        if (plan.kind === 'private_pack') {
            tx.update(userRef, {
                purchasedPrivateCredits: admin.firestore.FieldValue.increment(plan.privateCredits),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        } else if (plan.kind === 'offer_pack') {
            tx.update(userRef, {
                offerCredits: admin.firestore.FieldValue.increment(plan.offerCredits),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        } else {
            throw new Error(`Unsupported one-time plan kind: ${plan.kind}`);
        }

        tx.set(fulfillRef, {
            userId,
            planId: plan.id,
            kind: plan.kind,
            sessionId: session.id,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    });

    console.log(`✅ Fulfilled ${plan.kind} ${plan.id} for ${userId}`);
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

    const plan = await verifyCatalogCheckoutPlan(session);

    if (session.mode === 'payment') {
        await fulfillOneTimeCatalogPlan(session, plan);
        return;
    }

    if (!isSubscriptionPlan(plan)) {
        throw new Error(`Catalog plan ${plan.id} is not a subscription`);
    }

    const updates = {
        subscriptionStatus: 'active',
        subscriptionId,
        subscriptionTier: plan.tier,
        currentPlan: plan.id,
        weeklyPrivateQuota: plan.weeklyPrivateQuota,
        usedPrivateCreditsThisWeek: 0,
        subscriptionStartDate: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    if (session.customer) updates.stripeCustomerId = session.customer;

    await db.collection('users').doc(userId).update(updates);
    console.log(`✅ User ${userId} → plan: ${plan.id}, tier: ${plan.tier}, quota: ${plan.weeklyPrivateQuota}`);

    await db.collection('user_subscriptions').add({
        userId,
        planId: plan.id,
        subscriptionId,
        status: 'active',
        startDate: admin.firestore.FieldValue.serverTimestamp(),
        sessionId: session.id
    });
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
    const itemPriceId = subscription.items?.data?.[0]?.price?.id || null;
    const plan = getPaymentPlanByPriceId(itemPriceId) || getPaymentPlan(subscription.metadata?.planId || usersSnapshot.docs[0].data().currentPlan);
    if (!plan || !isSubscriptionPlan(plan)) {
        console.error('Unknown subscription price/plan:', subscription.id, itemPriceId);
        return;
    }

    await db.collection('users').doc(userId).update({
        subscriptionStatus: subscription.status,
        subscriptionTier: subscription.status === 'active' || subscription.status === 'trialing' ? plan.tier : 'free',
        currentPlan: plan.id,
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
