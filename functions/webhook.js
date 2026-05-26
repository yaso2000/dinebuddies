const functions = require('firebase-functions');
const admin = require('firebase-admin');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { grantPaidCreditsInTransaction, isBusinessUserDoc, priceIdToCreditPackage } = require('./creditsCore');
const { getCatalogEntryByPriceId } = require('./paymentPlans');

if (!admin.apps.length) {
    admin.initializeApp();
}

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

async function getCheckoutSessionPriceId(session) {
    const inlinePriceId = session?.line_items?.data?.[0]?.price?.id;
    if (inlinePriceId) return inlinePriceId;

    const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 1 });
    return lineItems?.data?.[0]?.price?.id || null;
}

async function handleDineCreditsPurchase(session) {
    if (session.payment_status !== 'paid') {
        console.log(`Ignoring unpaid dine credits checkout ${session.id}: ${session.payment_status}`);
        return;
    }

    const userId = session.metadata?.userId;
    const paidPriceId = await getCheckoutSessionPriceId(session);
    const paidPackage = priceIdToCreditPackage()[paidPriceId];

    if (!paidPackage) {
        console.error('Unrecognized dine credits checkout price', { sessionId: session.id, paidPriceId });
        return;
    }

    const credits = paidPackage.credits;
    const packageId = paidPackage.packageId;

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

    if (session.mode === 'payment' && session.metadata?.purchaseType === 'dine_credits') {
        await handleDineCreditsPurchase(session);
        return;
    }

    const paidPriceId = await getCheckoutSessionPriceId(session);
    const plan = getCatalogEntryByPriceId(paidPriceId);
    if (!plan) {
        console.error('Unrecognized checkout price; refusing to grant entitlements', {
            sessionId: session.id,
            paidPriceId,
            metadata: session.metadata,
        });
        return;
    }

    if (plan.mode === 'payment' && session.payment_status !== 'paid') {
        console.log(`Ignoring unpaid checkout ${session.id}: ${session.payment_status}`);
        return;
    }

    try {
        if (plan.kind === 'private_pack' || plan.kind === 'offer_pack') {
            const fulfillRef = db.collection('stripe_checkout_fulfillments').doc(session.id);
            const userRef = db.collection('users').doc(userId);
            await db.runTransaction(async (tx) => {
                const done = await tx.get(fulfillRef);
                if (done.exists) return;

                const update = {
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                };
                if (plan.kind === 'private_pack') {
                    update.purchasedPrivateCredits = admin.firestore.FieldValue.increment(plan.amount);
                } else {
                    update.offerCredits = admin.firestore.FieldValue.increment(plan.amount);
                }

                tx.update(userRef, update);
                tx.set(fulfillRef, {
                    userId,
                    planId: plan.planId,
                    kind: plan.kind,
                    amount: plan.amount,
                    paidPriceId,
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                });
            });
            console.log(`✅ User ${userId} received ${plan.amount} ${plan.kind}`);
        } else {
            // Subscription plan
            await db.collection('users').doc(userId).update({
                subscriptionStatus: 'active',
                subscriptionId: subscriptionId,
                subscriptionTier: plan.tier,
                currentPlan: plan.planId,
                weeklyPrivateQuota: plan.weeklyQuota,
                usedPrivateCreditsThisWeek: 0,
                usedPrivateCreditsThisMonth: 0,
                subscriptionStartDate: admin.firestore.FieldValue.serverTimestamp(),
                stripeCustomerId: session.customer || admin.firestore.FieldValue.delete()
            });

            console.log(`✅ User ${userId} → plan: ${plan.planId}, tier: ${plan.tier}, quota: ${plan.weeklyQuota}`);
        }

        if (plan.mode === 'subscription') {
            await db.collection('user_subscriptions').doc(session.id).set({
                userId,
                planId: plan.planId,
                subscriptionId,
                status: 'active',
                startDate: admin.firestore.FieldValue.serverTimestamp(),
                sessionId: session.id,
                paidPriceId,
            }, { merge: true });
        }

    } catch (error) {
        console.error('Error updating user subscription:', error);
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
    const priceId = subscription.items?.data?.[0]?.price?.id || null;
    const plan = getCatalogEntryByPriceId(priceId);
    if (!plan || plan.mode !== 'subscription') {
        console.error('Unrecognized subscription price; refusing to update entitlements', {
            subscriptionId: subscription.id,
            priceId,
        });
        return;
    }

    await db.collection('users').doc(userId).update({
        subscriptionStatus: subscription.status,
        subscriptionTier: plan.tier,
        currentPlan: plan.planId,
        weeklyPrivateQuota: plan.weeklyQuota,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log(`✅ User ${userId} updated → tier: ${plan.tier}, quota: ${plan.weeklyQuota}, status: ${subscription.status}`);
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
