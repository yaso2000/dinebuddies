const functions = require('firebase-functions');
const admin = require('firebase-admin');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { grantPaidCreditsInTransaction, isBusinessUserDoc } = require('./creditsCore');
const { getCheckoutItem, getCheckoutItemByPriceId } = require('./paymentPlans');

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

async function handleDineCreditsPurchase(session) {
    const userId = session.metadata?.userId;
    const credits = Math.floor(Number(session.metadata?.credits));
    const packageId = String(session.metadata?.packageId || '');

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

async function getCheckoutSessionPriceId(session) {
    const expandedLineItem = session.line_items?.data?.[0];
    const expandedPriceId = expandedLineItem?.price?.id || expandedLineItem?.price;
    if (expandedPriceId) return String(expandedPriceId);

    const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 1 });
    const lineItem = lineItems?.data?.[0];
    const priceId = lineItem?.price?.id || lineItem?.price;
    return priceId ? String(priceId) : null;
}

async function handleCheckoutComplete(session) {
    console.log('💳 Checkout completed:', session.id);

    const userId = session.metadata?.userId;
    const planId = session.metadata?.planId;
    const subscriptionId = session.subscription;

    if (!userId) {
        console.error('No userId in session metadata');
        return;
    }

    if (session.mode === 'payment' && session.metadata?.purchaseType === 'dine_credits') {
        await handleDineCreditsPurchase(session);
        return;
    }

    const checkoutItem = getCheckoutItem(planId);
    if (!checkoutItem) {
        console.error('Unknown checkout metadata planId; refusing fulfillment:', session.id, planId);
        return;
    }

    const paidPriceId = await getCheckoutSessionPriceId(session);
    if (paidPriceId !== checkoutItem.priceId) {
        console.error('Checkout price mismatch; refusing fulfillment:', {
            sessionId: session.id,
            planId,
            expectedPriceId: checkoutItem.priceId,
            paidPriceId,
        });
        return;
    }

    try {
        if (checkoutItem.purchaseType === 'offer_slot') {
            // Credit pack: add spendable premium offer credits.
            await db.collection('users').doc(userId).update({
                offerCredits: admin.firestore.FieldValue.increment(checkoutItem.offerCredits || 1),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            console.log(`✅ User ${userId} received ${checkoutItem.offerCredits || 1} offer credit`);
        } else {
            // Subscription plan
            await db.collection('users').doc(userId).update({
                subscriptionStatus: 'active',
                subscriptionId: subscriptionId,
                subscriptionTier: checkoutItem.tier,
                currentPlan: checkoutItem.id,
                weeklyPrivateQuota: checkoutItem.weeklyPrivateQuota,
                usedPrivateCreditsThisWeek: 0,
                subscriptionStartDate: admin.firestore.FieldValue.serverTimestamp(),
                stripeCustomerId: session.customer || admin.firestore.FieldValue.delete()
            });

            console.log(`✅ User ${userId} → plan: ${checkoutItem.id}, tier: ${checkoutItem.tier}, quota: ${checkoutItem.weeklyPrivateQuota}`);
        }

        // Save subscription record
        await db.collection('user_subscriptions').add({
            userId,
            planId: checkoutItem.id,
            subscriptionId,
            status: 'active',
            startDate: admin.firestore.FieldValue.serverTimestamp(),
            sessionId: session.id
        });

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
    const checkoutItem = getCheckoutItemByPriceId(priceId) || getCheckoutItem(subscription.metadata?.planId || usersSnapshot.docs[0].data().currentPlan);
    if (!checkoutItem || checkoutItem.mode !== 'subscription') {
        console.error('Unknown subscription price; refusing subscription update:', subscription.id, priceId);
        return;
    }

    await db.collection('users').doc(userId).update({
        subscriptionStatus: subscription.status,
        subscriptionTier: checkoutItem.tier,
        currentPlan: checkoutItem.id,
        weeklyPrivateQuota: checkoutItem.weeklyPrivateQuota,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log(`✅ User ${userId} updated → tier: ${checkoutItem.tier}, quota: ${checkoutItem.weeklyPrivateQuota}, status: ${subscription.status}`);
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
