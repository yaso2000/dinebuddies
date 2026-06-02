const functions = require('firebase-functions');
const admin = require('firebase-admin');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { grantPaidCreditsInTransaction, isBusinessUserDoc, priceIdToCreditPackage } = require('./creditsCore');
const { getCheckoutItemByPriceId, getSubscriptionPlanByPriceId } = require('./paymentPlans');

const db = admin.firestore();
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

async function getCheckoutLinePriceId(session) {
    const embedded = session?.line_items?.data?.[0]?.price?.id;
    if (embedded) return embedded;

    const lineItems = await stripe.checkout.sessions.listLineItems(session.id, {
        limit: 1,
        expand: ['data.price'],
    });
    return lineItems?.data?.[0]?.price?.id || null;
}

function assertPaymentIsPaid(session) {
    if (session.mode === 'payment' && session.payment_status !== 'paid') {
        throw new Error(`Checkout session ${session.id} is not paid`);
    }
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
        throw new Error(`Invalid dine credits checkout metadata for session ${session.id}`);
    }

    const fulfillRef = db.collection('stripe_dine_credit_fulfillments').doc(session.id);
    const userRef = db.collection('users').doc(userId);

    await db.runTransaction(async (tx) => {
        const done = await tx.get(fulfillRef);
        if (done.exists) return;

        const snap = await tx.get(userRef);
        if (!snap.exists) {
            throw new Error(`User not found for dine credits: ${userId}`);
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
        throw new Error(`No userId in session metadata for ${session.id}`);
    }

    const paidPriceId = await getCheckoutLinePriceId(session);
    if (!paidPriceId) {
        throw new Error(`No Stripe line-item price found for ${session.id}`);
    }

    if (session.mode === 'payment' && session.metadata?.purchaseType === 'dine_credits') {
        assertPaymentIsPaid(session);
        const expected = priceIdToCreditPackage()[paidPriceId];
        if (!expected || expected.packageId !== session.metadata?.packageId) {
            throw new Error(`Dine credits price mismatch for ${session.id}`);
        }
        await handleDineCreditsPurchase(session);
        return;
    }

    const checkoutItem = getCheckoutItemByPriceId(paidPriceId);
    if (!checkoutItem || checkoutItem.id !== session.metadata?.planId || checkoutItem.mode !== session.mode) {
        throw new Error(`Checkout price/metadata mismatch for ${session.id}`);
    }

    if (checkoutItem.mode === 'payment') {
        assertPaymentIsPaid(session);
    }

    const fulfillRef = db.collection('stripe_checkout_fulfillments').doc(session.id);
    const userRef = db.collection('users').doc(userId);

    await db.runTransaction(async (tx) => {
        const done = await tx.get(fulfillRef);
        if (done.exists) return;

        const userSnap = await tx.get(userRef);
        if (!userSnap.exists) {
            throw new Error(`User not found for checkout ${session.id}: ${userId}`);
        }

        if (checkoutItem.mode === 'subscription') {
            tx.update(userRef, {
                subscriptionStatus: 'active',
                subscriptionId: subscriptionId,
                subscriptionTier: checkoutItem.tier,
                currentPlan: checkoutItem.id,
                weeklyPrivateQuota: checkoutItem.weeklyPrivateQuota,
                usedPrivateCreditsThisWeek: 0,
                subscriptionStartDate: admin.firestore.FieldValue.serverTimestamp(),
                stripeCustomerId: session.customer || admin.firestore.FieldValue.delete()
            });

            tx.set(db.collection('user_subscriptions').doc(session.id), {
                userId,
                planId: checkoutItem.id,
                subscriptionId,
                status: 'active',
                startDate: admin.firestore.FieldValue.serverTimestamp(),
                sessionId: session.id
            });
        } else {
            const grant = checkoutItem.grant || {};
            const updates = { updatedAt: admin.firestore.FieldValue.serverTimestamp() };
            if (grant.purchasedPrivateCredits) {
                updates.purchasedPrivateCredits = admin.firestore.FieldValue.increment(grant.purchasedPrivateCredits);
            }
            if (grant.offerCredits) {
                updates.offerCredits = admin.firestore.FieldValue.increment(grant.offerCredits);
            }
            tx.update(userRef, updates);
        }

        tx.set(fulfillRef, {
            userId,
            planId: checkoutItem.id,
            mode: checkoutItem.mode,
            priceId: paidPriceId,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    });

    if (checkoutItem.mode === 'subscription') {
        console.log(`✅ User ${userId} → plan: ${checkoutItem.id}, tier: ${checkoutItem.tier}, quota: ${checkoutItem.weeklyPrivateQuota}`);
    } else {
        const grant = checkoutItem.grant || {};
        if (grant.purchasedPrivateCredits) {
            console.log(`✅ User ${userId} received ${grant.purchasedPrivateCredits} private invitation credits`);
        }
        if (grant.offerCredits) {
            console.log(`✅ User ${userId} received ${grant.offerCredits} offer credit`);
        }
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
    const plan = getSubscriptionPlanByPriceId(priceId);
    if (!plan) {
        throw new Error(`Unknown subscription price for ${subscription.id}: ${priceId || 'missing'}`);
    }

    await db.collection('users').doc(userId).update({
        subscriptionStatus: subscription.status,
        subscriptionTier: plan.tier,
        currentPlan: plan.id,
        weeklyPrivateQuota: plan.weeklyPrivateQuota,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log(`✅ User ${userId} updated → tier: ${plan.tier}, quota: ${plan.weeklyPrivateQuota}, status: ${subscription.status}`);
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
