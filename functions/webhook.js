const functions = require('firebase-functions');
const admin = require('firebase-admin');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { grantPaidCreditsInTransaction, isBusinessUserDoc } = require('./creditsCore');
const { getCatalogItemByPriceId } = require('./paymentPlans');

const db = admin.firestore();
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

function isActiveSubscriptionStatus(status) {
    return status === 'active' || status === 'trialing';
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

async function getCheckoutCatalogItem(session) {
    const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 1 });
    const priceId = lineItems?.data?.[0]?.price?.id;
    const catalogItem = getCatalogItemByPriceId(priceId);
    if (!catalogItem) {
        throw new Error(`Unknown checkout price for session ${session.id}: ${priceId || 'missing'}`);
    }
    if (catalogItem.mode !== session.mode) {
        throw new Error(`Checkout mode mismatch for ${session.id}: ${session.mode} paid for ${catalogItem.mode} item`);
    }
    return { catalogItem, priceId };
}

function getSubscriptionCatalogItem(subscription) {
    const priceId = subscription.items?.data?.[0]?.price?.id;
    const catalogItem = getCatalogItemByPriceId(priceId);
    if (!catalogItem || catalogItem.kind !== 'subscription') {
        return { catalogItem: null, priceId };
    }
    return { catalogItem, priceId };
}

async function handleCheckoutComplete(session) {
    console.log('💳 Checkout completed:', session.id);

    const userId = session.metadata?.userId;

    if (!userId) {
        console.error('No userId in session metadata');
        return;
    }

    if (session.mode === 'payment' && session.metadata?.purchaseType === 'dine_credits') {
        await handleDineCreditsPurchase(session);
        return;
    }

    const { catalogItem, priceId } = await getCheckoutCatalogItem(session);
    const fulfillRef = db.collection('stripe_checkout_fulfillments').doc(session.id);
    const userRef = db.collection('users').doc(userId);

    await db.runTransaction(async (tx) => {
        const done = await tx.get(fulfillRef);
        if (done.exists) return;

        const userSnap = await tx.get(userRef);
        if (!userSnap.exists) {
            throw new Error(`User not found for checkout session ${session.id}: ${userId}`);
        }

        const now = admin.firestore.FieldValue.serverTimestamp();
        if (catalogItem.kind === 'subscription') {
            const userPatch = {
                subscriptionStatus: 'active',
                subscriptionId: session.subscription || null,
                subscriptionTier: catalogItem.tier,
                currentPlan: catalogItem.id,
                weeklyPrivateQuota: catalogItem.weeklyPrivateQuota,
                usedPrivateCreditsThisWeek: 0,
                subscriptionStartDate: now,
                updatedAt: now
            };
            if (session.customer) userPatch.stripeCustomerId = session.customer;
            tx.update(userRef, userPatch);
            tx.set(db.collection('user_subscriptions').doc(session.id), {
                userId,
                planId: catalogItem.id,
                tier: catalogItem.tier,
                priceId,
                subscriptionId: session.subscription || null,
                status: 'active',
                startDate: now,
                sessionId: session.id
            });
            console.log(`✅ User ${userId} → catalog plan: ${catalogItem.id}, tier: ${catalogItem.tier}`);
        } else if (catalogItem.kind === 'private_pack') {
            tx.update(userRef, {
                purchasedPrivateCredits: admin.firestore.FieldValue.increment(catalogItem.purchasedPrivateCredits),
                updatedAt: now
            });
            console.log(`✅ User ${userId} received ${catalogItem.purchasedPrivateCredits} private invitation credits`);
        } else if (catalogItem.kind === 'offer_pack') {
            tx.update(userRef, {
                offerCredits: admin.firestore.FieldValue.increment(catalogItem.offerCredits),
                updatedAt: now
            });
            console.log(`✅ User ${userId} received ${catalogItem.offerCredits} offer credits`);
        } else {
            throw new Error(`Unsupported catalog kind: ${catalogItem.kind}`);
        }

        tx.set(fulfillRef, {
            userId,
            catalogId: catalogItem.id,
            kind: catalogItem.kind,
            priceId,
            createdAt: now
        });
    });
}

async function handleSubscriptionUpdate(subscription) {
    console.log('🔄 Subscription updated:', subscription.id);

    const customer = subscription.customer;
    const { catalogItem, priceId } = getSubscriptionCatalogItem(subscription);
    if (!catalogItem) {
        console.error('Unknown subscription price:', priceId || 'missing', subscription.id);
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
    const active = isActiveSubscriptionStatus(subscription.status);

    await db.collection('users').doc(userId).update({
        subscriptionStatus: subscription.status,
        subscriptionTier: active ? catalogItem.tier : 'free',
        currentPlan: active ? catalogItem.id : 'free',
        weeklyPrivateQuota: active ? catalogItem.weeklyPrivateQuota : 0,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log(`✅ User ${userId} updated → tier: ${active ? catalogItem.tier : 'free'}, status: ${subscription.status}`);
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
    const customer = invoice.customer;
    if (!customer) return;

    const usersSnapshot = await db.collection('users')
        .where('stripeCustomerId', '==', customer)
        .limit(1)
        .get();

    if (usersSnapshot.empty) return;

    await db.collection('users').doc(usersSnapshot.docs[0].id).update({
        subscriptionStatus: 'past_due',
        subscriptionTier: 'free',
        currentPlan: 'free',
        weeklyPrivateQuota: 0,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
}
