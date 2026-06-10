const functions = require('firebase-functions');
const admin = require('firebase-admin');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { grantPaidCreditsInTransaction, isBusinessUserDoc, priceIdToCreditPackage } = require('./creditsCore');
const { assertCheckoutPriceMatches, getCheckoutPlan, getCheckoutPlanByPriceId } = require('./paymentPlans');

const db = admin.firestore();
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

async function getCheckoutLinePriceIds(sessionId) {
    const lineItems = await stripe.checkout.sessions.listLineItems(sessionId, { limit: 10 });
    return (lineItems.data || [])
        .map((item) => item?.price?.id)
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

async function handleDineCreditsPurchase(session, packageDef) {
    const userId = session.metadata?.userId;
    const credits = Math.floor(Number(packageDef?.credits));
    const packageId = String(packageDef?.packageId || session.metadata?.packageId || '');

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
    const linePriceIds = await getCheckoutLinePriceIds(session.id);

    if (!userId) {
        console.error('No userId in session metadata');
        return;
    }

    if (session.mode === 'payment' && session.metadata?.purchaseType === 'dine_credits') {
        if (session.payment_status !== 'paid') {
            throw new Error(`Dine credit checkout ${session.id} completed without paid status`);
        }
        const priceMap = priceIdToCreditPackage();
        const matchedPriceId = linePriceIds.find((priceId) => priceMap[priceId]);
        const packageDef = matchedPriceId ? priceMap[matchedPriceId] : null;
        if (!packageDef || (session.metadata?.packageId && session.metadata.packageId !== packageDef.packageId)) {
            throw new Error(`Dine credit checkout ${session.id} has unrecognized or mismatched price`);
        }
        await handleDineCreditsPurchase(session, packageDef);
        return;
    }

    const plan = getCheckoutPlan(session.metadata?.planId);
    if (!assertCheckoutPriceMatches(plan, linePriceIds)) {
        throw new Error(`Checkout ${session.id} has unrecognized or mismatched price`);
    }

    const subscriptionId = session.subscription;

    try {
        if (plan.type === 'private_pack' || plan.type === 'offer_pack') {
            if (session.payment_status !== 'paid') {
                throw new Error(`One-time checkout ${session.id} completed without paid status`);
            }
            const fulfillRef = db.collection('stripe_pack_fulfillments').doc(session.id);
            const userRef = db.collection('users').doc(userId);
            await db.runTransaction(async (tx) => {
                const fulfilled = await tx.get(fulfillRef);
                if (fulfilled.exists) return;
                const field = plan.type === 'offer_pack' ? 'offerCredits' : 'purchasedPrivateCredits';
                tx.update(userRef, {
                    [field]: admin.firestore.FieldValue.increment(plan.credits),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });
                tx.set(fulfillRef, {
                    userId,
                    planId: plan.id,
                    type: plan.type,
                    credits: plan.credits,
                    sessionId: session.id,
                    createdAt: admin.firestore.FieldValue.serverTimestamp()
                });
            });
            console.log(`✅ User ${userId} received ${plan.credits} ${plan.type} credit(s)`);
        } else {
            await db.collection('users').doc(userId).update({
                subscriptionStatus: 'active',
                subscriptionId: subscriptionId,
                subscriptionTier: plan.tier,
                currentPlan: plan.id,
                weeklyPrivateQuota: plan.weeklyPrivateQuota,
                usedPrivateCreditsThisWeek: 0,
                subscriptionStartDate: admin.firestore.FieldValue.serverTimestamp(),
                stripeCustomerId: session.customer || admin.firestore.FieldValue.delete()
            });

            console.log(`✅ User ${userId} → plan: ${plan.id}, tier: ${plan.tier}, quota: ${plan.weeklyPrivateQuota}`);
        }

        if (plan.type === 'subscription') {
            await db.collection('user_subscriptions').add({
                userId,
                planId: plan.id,
                subscriptionId,
                status: 'active',
                startDate: admin.firestore.FieldValue.serverTimestamp(),
                sessionId: session.id
            });
        }

    } catch (error) {
        console.error('Error updating checkout fulfillment:', error);
        throw error;
    }
}

async function downgradeCustomerSubscription(customer, reason) {
    const usersSnapshot = await db.collection('users')
        .where('stripeCustomerId', '==', customer)
        .limit(1)
        .get();

    if (usersSnapshot.empty) return;

    const userId = usersSnapshot.docs[0].id;
    await db.collection('users').doc(userId).update({
        subscriptionStatus: reason || 'inactive',
        subscriptionTier: 'free',
        currentPlan: 'free',
        weeklyPrivateQuota: 0,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
}

async function handleSubscriptionUpdate(subscription) {
    console.log('🔄 Subscription updated:', subscription.id);

    const customer = subscription.customer;
    const priceId = subscription.items?.data?.[0]?.price?.id;
    const plan = getCheckoutPlanByPriceId(priceId);

    if (!plan || plan.type !== 'subscription') {
        console.error('Unknown subscription price:', priceId);
        return;
    }

    const usersSnapshot = await db.collection('users')
        .where('stripeCustomerId', '==', customer)
        .limit(1)
        .get();

    if (usersSnapshot.empty) {
        console.log('No user found for customer:', customer);
        return;
    }

    const userId = usersSnapshot.docs[0].id;
    const activeStatuses = new Set(['active', 'trialing']);
    const isActive = activeStatuses.has(subscription.status);

    await db.collection('users').doc(userId).update({
        subscriptionStatus: subscription.status,
        subscriptionTier: isActive ? plan.tier : 'free',
        currentPlan: isActive ? plan.id : 'free',
        weeklyPrivateQuota: isActive ? plan.weeklyPrivateQuota : 0,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log(`✅ User ${userId} updated → tier: ${isActive ? plan.tier : 'free'}, quota: ${isActive ? plan.weeklyPrivateQuota : 0}, status: ${subscription.status}`);
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
        currentPlan: 'free',
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
    if (invoice.customer) {
        await downgradeCustomerSubscription(invoice.customer, 'past_due');
    }
}

module.exports.__testing = {
    getCheckoutLinePriceIds,
};
