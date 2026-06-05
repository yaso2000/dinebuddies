const functions = require('firebase-functions');
const admin = require('firebase-admin');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { grantPaidCreditsInTransaction, isBusinessUserDoc, priceIdToCreditPackage } = require('./creditsCore');
const { getCheckoutItemByPriceId } = require('./paymentPlans');

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
    const embedded = session.line_items?.data?.[0]?.price?.id;
    if (embedded) return embedded;

    const lineItems = await stripe.checkout.sessions.listLineItems(session.id, {
        limit: 1,
        expand: ['data.price'],
    });
    return lineItems.data?.[0]?.price?.id || null;
}

function getSubscriptionPriceId(subscription) {
    return subscription.items?.data?.[0]?.price?.id || null;
}

async function handleDineCreditsPurchase(session) {
    const userId = session.metadata?.userId;
    if (session.payment_status && session.payment_status !== 'paid') {
        console.warn('Dine credits checkout completed before payment settled:', session.id, session.payment_status);
        return;
    }

    const priceId = await getCheckoutSessionPriceId(session);
    const paidPackage = priceIdToCreditPackage()[priceId];
    const credits = paidPackage?.credits || 0;
    const packageId = paidPackage?.packageId || '';

    if (!userId || !Number.isFinite(credits) || credits <= 0) {
        throw new Error(`Invalid dine credits checkout price or metadata for session ${session.id}`);
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

async function fulfillOneTimeCatalogItem(session, item, userId) {
    if (session.payment_status && session.payment_status !== 'paid') {
        console.warn('One-time checkout completed before payment settled:', session.id, session.payment_status);
        return;
    }

    const amount = Math.max(0, Math.floor(Number(item.amount) || 0));
    if (amount <= 0) {
        throw new Error(`Invalid one-time catalog amount for ${item.id}`);
    }

    const fulfillRef = db.collection('stripe_checkout_fulfillments').doc(session.id);
    const userRef = db.collection('users').doc(userId);

    await db.runTransaction(async (tx) => {
        const done = await tx.get(fulfillRef);
        if (done.exists) return;

        const userSnap = await tx.get(userRef);
        if (!userSnap.exists) {
            throw new Error(`User not found for checkout session ${session.id}: ${userId}`);
        }

        if (item.purchaseType === 'private_pack') {
            tx.update(userRef, {
                purchasedPrivateCredits: admin.firestore.FieldValue.increment(amount),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        } else if (item.purchaseType === 'offer_pack') {
            tx.update(userRef, {
                offerCredits: admin.firestore.FieldValue.increment(amount),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        } else {
            throw new Error(`Unsupported one-time purchase type: ${item.purchaseType}`);
        }

        tx.set(fulfillRef, {
            userId,
            itemId: item.id,
            purchaseType: item.purchaseType,
            amount,
            sessionId: session.id,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    });

    console.log(`✅ Fulfilled ${item.purchaseType} ${item.id} x${amount} for ${userId}`);
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

    const priceId = await getCheckoutSessionPriceId(session);
    const item = getCheckoutItemByPriceId(priceId);
    if (!item) {
        throw new Error(`Unknown Stripe checkout price for session ${session.id}: ${priceId || 'missing'}`);
    }

    if (item.mode === 'payment') {
        await fulfillOneTimeCatalogItem(session, item, userId);
        return;
    }

    if (item.mode !== 'subscription') {
        throw new Error(`Unsupported checkout mode for ${item.id}: ${item.mode}`);
    }

    try {
        await db.collection('users').doc(userId).update({
            subscriptionStatus: 'active',
            subscriptionId: subscriptionId,
            subscriptionTier: item.tier,
            currentPlan: item.currentPlan,
            weeklyPrivateQuota: item.weeklyPrivateQuota,
            usedPrivateCreditsThisWeek: 0,
            subscriptionStartDate: admin.firestore.FieldValue.serverTimestamp(),
            stripeCustomerId: session.customer || admin.firestore.FieldValue.delete()
        });

        console.log(`✅ User ${userId} → plan: ${item.currentPlan}, tier: ${item.tier}, quota: ${item.weeklyPrivateQuota}`);

        // Save subscription record
        await db.collection('user_subscriptions').doc(session.id).set({
            userId,
            planId: item.currentPlan,
            subscriptionId,
            status: 'active',
            startDate: admin.firestore.FieldValue.serverTimestamp(),
            sessionId: session.id
        }, { merge: true });

    } catch (error) {
        console.error('Error updating user subscription:', error);
        throw error;
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
    const item = getCheckoutItemByPriceId(getSubscriptionPriceId(subscription));
    const isActive = subscription.status === 'active' || subscription.status === 'trialing';
    const tier = isActive && item ? item.tier : 'free';
    const weeklyQuota = isActive && item ? item.weeklyPrivateQuota : 0;

    await db.collection('users').doc(userId).update({
        subscriptionStatus: subscription.status,
        subscriptionTier: tier,
        currentPlan: isActive && item ? item.currentPlan : 'free',
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
