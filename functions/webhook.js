const functions = require('firebase-functions');
const admin = require('firebase-admin');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { grantPaidCreditsInTransaction, isBusinessUserDoc } = require('./creditsCore');
const { getCheckoutItem, getCheckoutItemByPriceId } = require('./paymentPlans');

const db = admin.firestore();
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

async function getSessionPriceId(session) {
    const expanded = session.line_items?.data?.[0]?.price?.id;
    if (expanded) return expanded;
    const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 1 });
    return lineItems.data?.[0]?.price?.id || null;
}

function getSubscriptionPriceId(subscription) {
    return subscription.items?.data?.[0]?.price?.id || null;
}

async function resolveVerifiedCheckoutItem(session) {
    const metadataItem = getCheckoutItem(session.metadata?.planId);
    const paidPriceId = await getSessionPriceId(session);
    const priceItem = getCheckoutItemByPriceId(paidPriceId);

    if (!metadataItem || !priceItem || metadataItem.id !== priceItem.id || paidPriceId !== metadataItem.priceId) {
        throw new Error(`Checkout price mismatch for session ${session.id}`);
    }

    return metadataItem;
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

    const item = await resolveVerifiedCheckoutItem(session);

    try {
        if (item.type === 'private_invitation_pack') {
            await fulfillPrivateInvitationPack(session, userId, item);
            return;
        }

        if (item.type === 'offer_slot_pack') {
            await fulfillOfferSlotPack(session, userId, item);
            return;
        }

        await db.collection('users').doc(userId).update({
            subscriptionStatus: 'active',
            subscriptionId: subscriptionId,
            subscriptionTier: item.tier,
            currentPlan: item.id,
            weeklyPrivateQuota: item.weeklyPrivateQuota,
            usedPrivateCreditsThisWeek: 0,
            subscriptionStartDate: admin.firestore.FieldValue.serverTimestamp(),
            stripeCustomerId: session.customer || admin.firestore.FieldValue.delete()
        });

        await db.collection('user_subscriptions').add({
            userId,
            planId: item.id,
            subscriptionId,
            status: 'active',
            startDate: admin.firestore.FieldValue.serverTimestamp(),
            sessionId: session.id
        });

        console.log(`✅ User ${userId} → plan: ${item.id}, tier: ${item.tier}, quota: ${item.weeklyPrivateQuota}`);
    } catch (error) {
        console.error('Error updating user subscription:', error);
        throw error;
    }
}

async function fulfillPrivateInvitationPack(session, userId, item) {
    const fulfillRef = db.collection('stripe_pack_fulfillments').doc(session.id);
    const userRef = db.collection('users').doc(userId);
    await db.runTransaction(async (tx) => {
        const done = await tx.get(fulfillRef);
        if (done.exists) return;

        tx.update(userRef, {
            purchasedPrivateCredits: admin.firestore.FieldValue.increment(item.credits),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        tx.set(fulfillRef, {
            userId,
            planId: item.id,
            type: item.type,
            credits: item.credits,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    });
    console.log(`✅ User ${userId} received ${item.credits} private invitation credits`);
}

async function fulfillOfferSlotPack(session, userId, item) {
    const fulfillRef = db.collection('stripe_pack_fulfillments').doc(session.id);
    const userRef = db.collection('users').doc(userId);
    await db.runTransaction(async (tx) => {
        const done = await tx.get(fulfillRef);
        if (done.exists) return;

        tx.update(userRef, {
            offerCredits: admin.firestore.FieldValue.increment(item.offerCredits),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        tx.set(fulfillRef, {
            userId,
            planId: item.id,
            type: item.type,
            offerCredits: item.offerCredits,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    });
    console.log(`✅ User ${userId} received ${item.offerCredits} offer credit`);
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
    const item = getCheckoutItemByPriceId(getSubscriptionPriceId(subscription)) ||
        getCheckoutItem(subscription.metadata?.planId || usersSnapshot.docs[0].data().currentPlan);

    if (!item || item.type !== 'subscription') {
        throw new Error(`Unknown subscription price for subscription ${subscription.id}`);
    }

    const isActive = ['active', 'trialing'].includes(subscription.status);

    await db.collection('users').doc(userId).update({
        subscriptionStatus: subscription.status,
        subscriptionTier: isActive ? item.tier : 'free',
        currentPlan: isActive ? item.id : 'free',
        weeklyPrivateQuota: isActive ? item.weeklyPrivateQuota : 0,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log(`✅ User ${userId} updated → tier: ${isActive ? item.tier : 'free'}, quota: ${isActive ? item.weeklyPrivateQuota : 0}, status: ${subscription.status}`);
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
