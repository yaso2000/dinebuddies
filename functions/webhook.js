const functions = require('firebase-functions');
const admin = require('firebase-admin');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { grantPaidCreditsInTransaction, isBusinessUserDoc } = require('./creditsCore');
const { getPaymentPlan } = require('./paymentPlans');

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

async function handleCheckoutComplete(session) {
    console.log('💳 Checkout completed:', session.id);

    const userId = session.metadata?.userId;
    const plan = getPaymentPlan(session.metadata?.planId);
    const subscriptionId = session.subscription;

    if (!userId) {
        console.error('No userId in session metadata');
        return;
    }

    if (session.mode === 'payment' && session.metadata?.purchaseType === 'dine_credits') {
        await handleDineCreditsPurchase(session);
        return;
    }

    if (!plan) {
        console.error('Unknown checkout plan:', session.metadata?.planId);
        return;
    }

    try {
        if (session.mode !== plan.mode) {
            console.error(`Checkout mode mismatch for ${session.id}: paid ${session.mode}, expected ${plan.mode}`);
            return;
        }

        const actualPriceId = await getCheckoutSessionPriceId(session);
        if (!actualPriceId || actualPriceId !== plan.priceId) {
            console.error(`Checkout price mismatch for ${session.id}: paid ${actualPriceId || 'unknown'}, expected ${plan.priceId}`);
            return;
        }

        await fulfillCatalogCheckout(session, userId, plan, subscriptionId);
        console.log(`✅ Fulfilled checkout ${session.id} for user ${userId}, plan ${plan.id}`);
    } catch (error) {
        console.error('Error updating user subscription:', error);
        throw error;
    }
}

async function getCheckoutSessionPriceId(session) {
    const embedded = session.line_items?.data?.[0]?.price?.id;
    if (embedded) return embedded;

    const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 1 });
    return lineItems.data?.[0]?.price?.id || null;
}

async function fulfillCatalogCheckout(session, userId, plan, subscriptionId) {
    const fulfillRef = db.collection('stripe_checkout_fulfillments').doc(session.id);
    const userRef = db.collection('users').doc(userId);
    const subRef = db.collection('user_subscriptions').doc(session.id);

    await db.runTransaction(async (tx) => {
        const done = await tx.get(fulfillRef);
        if (done.exists) return;

        const userSnap = await tx.get(userRef);
        if (!userSnap.exists) {
            throw new Error(`User not found for checkout ${session.id}: ${userId}`);
        }

        const now = admin.firestore.FieldValue.serverTimestamp();

        if (plan.type === 'offer_credits') {
            tx.update(userRef, {
                offerCredits: admin.firestore.FieldValue.increment(plan.offerCredits),
                updatedAt: now,
            });
        } else if (plan.type === 'private_credits') {
            tx.update(userRef, {
                purchasedPrivateCredits: admin.firestore.FieldValue.increment(plan.purchasedPrivateCredits),
                updatedAt: now,
            });
        } else if (plan.type === 'subscription') {
            tx.update(userRef, {
                subscriptionStatus: 'active',
                subscriptionId,
                subscriptionTier: plan.tier,
                currentPlan: plan.id,
                weeklyPrivateQuota: plan.weeklyPrivateQuota,
                usedPrivateCreditsThisWeek: 0,
                subscriptionStartDate: now,
                stripeCustomerId: session.customer || admin.firestore.FieldValue.delete(),
                updatedAt: now,
            });

            tx.set(subRef, {
                userId,
                planId: plan.id,
                subscriptionId,
                status: 'active',
                startDate: now,
                sessionId: session.id,
            }, { merge: true });
        } else {
            throw new Error(`Unsupported checkout fulfillment type: ${plan.type}`);
        }

        tx.set(fulfillRef, {
            userId,
            planId: plan.id,
            type: plan.type,
            priceId: plan.priceId,
            mode: plan.mode,
            createdAt: now,
        });
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
    const plan = getPaymentPlan(subscription.metadata?.planId || usersSnapshot.docs[0].data().currentPlan);
    const weeklyQuota = plan?.weeklyPrivateQuota ?? 0;
    const tier = plan?.tier || 'free';

    await db.collection('users').doc(userId).update({
        subscriptionStatus: subscription.status,
        subscriptionTier: tier,
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
