const functions = require('firebase-functions');
const admin = require('firebase-admin');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { grantPaidCreditsInTransaction, isBusinessUserDoc, priceIdToCreditPackage } = require('./creditsCore');
const { priceIdToCheckoutItem } = require('./paymentPlans');

const db = admin.firestore();
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

async function getCheckoutSessionPriceIds(session) {
    if (session.line_items?.data?.length) {
        return session.line_items.data.map((item) => item.price?.id).filter(Boolean);
    }
    const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 100 });
    return lineItems.data.map((item) => item.price?.id).filter(Boolean);
}

async function getCheckoutCatalogItem(session) {
    const byPrice = priceIdToCheckoutItem();
    const priceIds = await getCheckoutSessionPriceIds(session);
    for (const priceId of priceIds) {
        if (byPrice[priceId]) return byPrice[priceId];
    }
    console.error('Checkout session used unknown Stripe price', {
        sessionId: session.id,
        priceIds,
        metadata: session.metadata,
    });
    return null;
}

function isPaidCheckout(session) {
    return session.payment_status === 'paid';
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

    if (!userId) {
        console.error('Invalid dine credits checkout metadata', session.metadata);
        return;
    }
    if (!isPaidCheckout(session)) {
        console.error('Dine credits checkout is not paid; skipping fulfillment', {
            sessionId: session.id,
            paymentStatus: session.payment_status,
        });
        return;
    }

    const priceIds = await getCheckoutSessionPriceIds(session);
    const creditPackages = priceIdToCreditPackage();
    const purchased = priceIds.map((priceId) => creditPackages[priceId]).find(Boolean);
    if (!purchased) {
        console.error('Unknown dine credits checkout price; skipping fulfillment', {
            sessionId: session.id,
            priceIds,
        });
        return;
    }
    const { credits, packageId } = purchased;

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

    const checkoutItem = await getCheckoutCatalogItem(session);
    if (!checkoutItem) return;
    if (!isPaidCheckout(session)) {
        console.error('Checkout is not paid; skipping fulfillment', {
            sessionId: session.id,
            paymentStatus: session.payment_status,
            planId: checkoutItem.planId,
        });
        return;
    }

    try {
        if (checkoutItem.kind === 'one_time_pack') {
            const fulfillRef = db.collection('stripe_checkout_fulfillments').doc(session.id);
            const userRef = db.collection('users').doc(userId);
            await db.runTransaction(async (tx) => {
                const done = await tx.get(fulfillRef);
                if (done.exists) return;
                tx.update(userRef, {
                    [checkoutItem.grantField]: admin.firestore.FieldValue.increment(checkoutItem.grantAmount),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                });
                tx.set(fulfillRef, {
                    userId,
                    planId: checkoutItem.planId,
                    priceId: checkoutItem.priceId,
                    grantType: checkoutItem.grantType,
                    grantField: checkoutItem.grantField,
                    grantAmount: checkoutItem.grantAmount,
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                });
            });
            console.log(`✅ User ${userId} received ${checkoutItem.grantAmount} ${checkoutItem.grantType} credit(s)`);
        } else {
            // Subscription plan
            await db.collection('users').doc(userId).update({
                subscriptionStatus: 'active',
                subscriptionId: subscriptionId,
                subscriptionTier: checkoutItem.tier,
                currentPlan: checkoutItem.planId,
                weeklyPrivateQuota: checkoutItem.weeklyPrivateQuota,
                usedPrivateCreditsThisWeek: 0,
                subscriptionStartDate: admin.firestore.FieldValue.serverTimestamp(),
                stripeCustomerId: session.customer || admin.firestore.FieldValue.delete()
            });

            console.log(`✅ User ${userId} → plan: ${checkoutItem.planId}, tier: ${checkoutItem.tier}, quota: ${checkoutItem.weeklyPrivateQuota}`);

            // Save subscription record
            await db.collection('user_subscriptions').doc(session.id).set({
                userId,
                planId: checkoutItem.planId,
                subscriptionId: subscriptionId || null,
                status: 'active',
                startDate: admin.firestore.FieldValue.serverTimestamp(),
                sessionId: session.id
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
    const priceId = subscription.items?.data?.[0]?.price?.id;
    const checkoutItem = priceId ? priceIdToCheckoutItem()[priceId] : null;
    if (!checkoutItem || checkoutItem.kind !== 'subscription') {
        console.error('Subscription update used unknown Stripe price; skipping entitlement update', {
            subscriptionId: subscription.id,
            priceId,
        });
        return;
    }

    await db.collection('users').doc(userId).update({
        subscriptionStatus: subscription.status,
        subscriptionTier: checkoutItem.tier,
        currentPlan: checkoutItem.planId,
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
