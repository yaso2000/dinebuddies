const functions = require('firebase-functions');
const admin = require('firebase-admin');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { grantPaidCreditsInTransaction, isBusinessUserDoc, priceIdToCreditPackage } = require('./creditsCore');
const { getCheckoutProductByPriceId, normalizeProductId } = require('./paymentPlans');

const db = admin.firestore();
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

function stripeId(value) {
    return typeof value === 'string' ? value : value?.id;
}

async function getCheckoutSessionPriceId(session) {
    const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 1 });
    const first = lineItems.data?.[0];
    return stripeId(first?.price);
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
    const paidPriceId = await getCheckoutSessionPriceId(session);
    const paidPackage = priceIdToCreditPackage()[paidPriceId];

    if (!userId || !paidPackage) {
        throw new Error(`Invalid dine credits checkout fulfillment for session ${session.id}`);
    }

    const { credits, packageId } = paidPackage;

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
    const subscriptionId = stripeId(session.subscription);

    if (!userId) {
        console.error('No userId in session metadata');
        return;
    }

    if (session.mode === 'payment' && session.metadata?.purchaseType === 'dine_credits') {
        await handleDineCreditsPurchase(session);
        return;
    }

    const paidPriceId = await getCheckoutSessionPriceId(session);
    const product = getCheckoutProductByPriceId(paidPriceId);
    if (!product) {
        throw new Error(`Unsupported Stripe checkout price ${paidPriceId || '(missing)'} for session ${session.id}`);
    }
    if (session.mode !== product.mode) {
        throw new Error(`Checkout mode mismatch for ${session.id}: paid ${session.mode}, expected ${product.mode}`);
    }
    const metadataPlanId = normalizeProductId(session.metadata?.planId);
    if (metadataPlanId && metadataPlanId !== product.id) {
        console.warn(`Checkout metadata/product mismatch for ${session.id}: metadata=${metadataPlanId}, paid=${product.id}`);
    }

    const fulfillRef = db.collection('stripe_checkout_fulfillments').doc(session.id);
    const userRef = db.collection('users').doc(userId);
    const result = await db.runTransaction(async (tx) => {
        const [done, userSnap] = await Promise.all([tx.get(fulfillRef), tx.get(userRef)]);
        if (done.exists) return { duplicate: true };
        if (!userSnap.exists) {
            throw new Error(`User ${userId} not found for checkout session ${session.id}`);
        }

        if (product.mode === 'payment') {
            if (product.purchaseType === 'private_invitation_credits') {
                tx.update(userRef, {
                    purchasedPrivateCredits: admin.firestore.FieldValue.increment(product.credits),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });
            } else if (product.purchaseType === 'offer_credits') {
                tx.update(userRef, {
                    offerCredits: admin.firestore.FieldValue.increment(product.credits),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });
            } else {
                throw new Error(`Unsupported one-time checkout product ${product.id}`);
            }
        } else {
            const updates = {
                subscriptionStatus: 'active',
                subscriptionId: subscriptionId || null,
                subscriptionTier: product.subscriptionTier,
                currentPlan: product.id,
                weeklyPrivateQuota: product.weeklyPrivateQuota,
                usedPrivateCreditsThisWeek: 0,
                subscriptionStartDate: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            };
            const customerId = stripeId(session.customer);
            if (customerId) updates.stripeCustomerId = customerId;
            tx.update(userRef, updates);
            tx.set(db.collection('user_subscriptions').doc(session.id), {
                userId,
                planId: product.id,
                subscriptionTier: product.subscriptionTier,
                subscriptionId: subscriptionId || null,
                status: 'active',
                startDate: admin.firestore.FieldValue.serverTimestamp(),
                sessionId: session.id
            });
        }

        tx.set(fulfillRef, {
            userId,
            productId: product.id,
            priceId: paidPriceId,
            mode: product.mode,
            subscriptionId: subscriptionId || null,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
        return { duplicate: false };
    });

    if (result.duplicate) {
        console.log(`↩️ Checkout session ${session.id} already fulfilled`);
    } else if (product.mode === 'payment') {
        console.log(`✅ User ${userId} received ${product.credits} ${product.purchaseType}`);
    } else {
        console.log(`✅ User ${userId} → product: ${product.id}, tier: ${product.subscriptionTier}, quota: ${product.weeklyPrivateQuota}`);
    }
}

async function handleSubscriptionUpdate(subscription) {
    console.log('🔄 Subscription updated:', subscription.id);

    const customer = stripeId(subscription.customer);
    const priceId = stripeId(subscription.items?.data?.[0]?.price);
    const product = getCheckoutProductByPriceId(priceId);
    if (!product || product.mode !== 'subscription') {
        console.warn(`Unsupported subscription price ${priceId || '(missing)'} for subscription ${subscription.id}`);
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
    await db.collection('users').doc(userId).update({
        subscriptionStatus: subscription.status,
        subscriptionTier: product.subscriptionTier,
        currentPlan: product.id,
        weeklyPrivateQuota: product.weeklyPrivateQuota,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log(`✅ User ${userId} updated → tier: ${product.subscriptionTier}, quota: ${product.weeklyPrivateQuota}, status: ${subscription.status}`);
}

async function handleSubscriptionCanceled(subscription) {
    console.log('❌ Subscription canceled:', subscription.id);

    const customer = stripeId(subscription.customer);

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
