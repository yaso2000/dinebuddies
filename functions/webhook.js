const functions = require('firebase-functions');
const admin = require('firebase-admin');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { grantPaidCreditsInTransaction, isBusinessUserDoc, priceIdToCreditPackage } = require('./creditsCore');
const { getCheckoutPlan, getCheckoutPlanByPriceId } = require('./paymentPlans');

const db = admin.firestore();
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

async function getCheckoutLineItemPriceId(sessionId) {
    const lineItems = await stripe.checkout.sessions.listLineItems(sessionId, { limit: 1 });
    const item = lineItems?.data?.[0];
    const price = item?.price;
    return typeof price === 'string' ? price : price?.id || null;
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
    const credits = Math.floor(Number(session.metadata?.credits));
    const packageId = String(session.metadata?.packageId || '');
    const expected = priceIdToCreditPackage()[actualPriceId];

    if (!userId || !Number.isFinite(credits) || credits <= 0 || !expected || expected.packageId !== packageId || expected.credits !== credits) {
        console.error('Invalid dine credits checkout metadata', session.metadata);
        throw new Error('Dine credits checkout price verification failed');
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
    const requestedPlanId = session.metadata?.planId;

    if (!userId) {
        console.error('No userId in session metadata');
        return;
    }

    const actualPriceId = await getCheckoutLineItemPriceId(session.id);

    if (session.mode === 'payment' && session.metadata?.purchaseType === 'dine_credits') {
        if (session.payment_status !== 'paid') {
            throw new Error(`Dine credits checkout ${session.id} is not paid`);
        }
        await handleDineCreditsPurchase(session, actualPriceId);
        return;
    }

    const plan = getCheckoutPlan(requestedPlanId);
    if (!plan || plan.priceId !== actualPriceId) {
        throw new Error(`Checkout price mismatch for session ${session.id}`);
    }
    if (session.mode !== plan.mode) {
        throw new Error(`Checkout mode mismatch for session ${session.id}`);
    }
    if (plan.mode === 'payment' && session.payment_status !== 'paid') {
        throw new Error(`Checkout ${session.id} is not paid`);
    }

    if (plan.kind === 'private_pack' || plan.kind === 'offer_pack') {
        const fulfillRef = db.collection('stripe_checkout_fulfillments').doc(session.id);
        const userRef = db.collection('users').doc(userId);
        await db.runTransaction(async (tx) => {
            const done = await tx.get(fulfillRef);
            if (done.exists) return;
            tx.update(userRef, {
                [plan.grantField]: admin.firestore.FieldValue.increment(plan.credits),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            tx.set(fulfillRef, {
                userId,
                planId: plan.id,
                kind: plan.kind,
                credits: plan.credits,
                priceId: actualPriceId,
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });
        });
        console.log(`✅ User ${userId} received ${plan.credits} ${plan.grantField}`);
        return;
    }

    if (!session.subscription) {
        throw new Error(`Checkout ${session.id} has no subscription`);
    }
    const subscription = await stripe.subscriptions.retrieve(session.subscription);
    const subscriptionPriceId = subscription.items?.data?.[0]?.price?.id || null;
    const activeStatuses = new Set(['active', 'trialing']);
    if (subscriptionPriceId !== plan.priceId || !activeStatuses.has(subscription.status)) {
        throw new Error(`Subscription verification failed for checkout ${session.id}`);
    }

    await db.collection('users').doc(userId).update({
        subscriptionStatus: subscription.status,
        subscriptionId: subscription.id,
        subscriptionTier: plan.tier,
        currentPlan: plan.currentPlan,
        weeklyPrivateQuota: plan.weeklyPrivateQuota,
        usedPrivateCreditsThisWeek: 0,
        subscriptionStartDate: admin.firestore.FieldValue.serverTimestamp(),
        stripeCustomerId: session.customer || admin.firestore.FieldValue.delete()
    });

    console.log(`✅ User ${userId} → plan: ${plan.id}, tier: ${plan.tier}, quota: ${plan.weeklyPrivateQuota}`);

    await db.collection('user_subscriptions').doc(session.id).set({
        userId,
        planId: plan.id,
        subscriptionId: subscription.id,
        status: subscription.status,
        startDate: admin.firestore.FieldValue.serverTimestamp(),
        sessionId: session.id,
        priceId: actualPriceId
    }, { merge: true });
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
    const actualPriceId = subscription.items?.data?.[0]?.price?.id || null;
    const plan = getCheckoutPlanByPriceId(actualPriceId);
    if (!plan || plan.kind !== 'subscription') {
        throw new Error(`Unknown subscription price: ${actualPriceId}`);
    }
    const isActive = subscription.status === 'active' || subscription.status === 'trialing';
    const tier = isActive ? plan.tier : 'free';
    const weeklyQuota = isActive ? plan.weeklyPrivateQuota : 0;

    await db.collection('users').doc(userId).update({
        subscriptionStatus: subscription.status,
        subscriptionTier: tier,
        currentPlan: plan.currentPlan,
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
