const functions = require('firebase-functions');
const admin = require('firebase-admin');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { grantPaidCreditsInTransaction, isBusinessUserDoc, priceIdToCreditPackage } = require('./creditsCore');
const { resolveCheckoutPlan, resolvePlanByPriceId } = require('./paymentPlans');

const db = admin.firestore();
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

async function getCheckoutLinePriceId(sessionId) {
    const lineItems = await stripe.checkout.sessions.listLineItems(sessionId, { limit: 1 });
    return lineItems.data?.[0]?.price?.id || null;
}

function activeSubscriptionStatus(status) {
    return status === 'active' || status === 'trialing';
}

function subscriptionPlanFromSubscription(subscription) {
    const priceId = subscription.items?.data?.[0]?.price?.id || null;
    const plan = resolvePlanByPriceId(priceId);
    return plan && plan.kind === 'subscription' ? plan : null;
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

async function handleDineCreditsPurchase(session, linePriceId) {
    const userId = session.metadata?.userId;
    const packageId = String(session.metadata?.packageId || '');
    const paidPackage = priceIdToCreditPackage()[linePriceId];

    if (!userId || !paidPackage || paidPackage.packageId !== packageId) {
        throw new Error(`Invalid dine credits line item for session ${session.id}`);
    }

    const credits = paidPackage.credits;
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
        throw new Error(`No userId in checkout session ${session.id}`);
    }

    const linePriceId = await getCheckoutLinePriceId(session.id);

    if (session.mode === 'payment' && session.metadata?.purchaseType === 'dine_credits') {
        if (session.payment_status !== 'paid') {
            console.log(`Ignoring unpaid dine credits checkout ${session.id}`);
            return;
        }
        await handleDineCreditsPurchase(session, linePriceId);
        return;
    }

    const plan = resolvePlanByPriceId(linePriceId);
    const metadataPlan = resolveCheckoutPlan(session.metadata?.planId, null);
    if (!plan || (metadataPlan && metadataPlan.id !== plan.id) || plan.mode !== session.mode) {
        throw new Error(`Unexpected checkout line item for session ${session.id}`);
    }

    if (plan.mode === 'payment' && session.payment_status !== 'paid') {
        console.log(`Ignoring unpaid checkout ${session.id}`);
        return;
    }

    const fulfillRef = db.collection('stripe_checkout_fulfillments').doc(session.id);
    const userRef = db.collection('users').doc(userId);

    await db.runTransaction(async (tx) => {
        const done = await tx.get(fulfillRef);
        if (done.exists) return;

        if (plan.kind === 'offer_pack') {
            tx.update(userRef, {
                offerCredits: admin.firestore.FieldValue.increment(plan.offerCredits || 0),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            console.log(`✅ User ${userId} received ${plan.offerCredits || 0} offer credit(s)`);
        } else if (plan.kind === 'private_pack') {
            tx.update(userRef, {
                purchasedPrivateCredits: admin.firestore.FieldValue.increment(plan.privateCredits || 0),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            console.log(`✅ User ${userId} received ${plan.privateCredits || 0} private invitation credit(s)`);
        } else if (plan.kind === 'subscription') {
            tx.update(userRef, {
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
        } else {
            throw new Error(`Unsupported checkout plan kind ${plan.kind}`);
        }

        tx.set(fulfillRef, {
            userId,
            planId: plan.id,
            kind: plan.kind,
            subscriptionId,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        if (plan.kind === 'subscription') {
            tx.set(db.collection('user_subscriptions').doc(session.id), {
                userId,
                planId: plan.id,
                subscriptionId,
                status: 'active',
                startDate: admin.firestore.FieldValue.serverTimestamp(),
                sessionId: session.id
            });
        }
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
    const plan = subscriptionPlanFromSubscription(subscription);
    const isActive = activeSubscriptionStatus(subscription.status);

    await db.collection('users').doc(userId).update({
        subscriptionStatus: subscription.status,
        subscriptionTier: isActive && plan ? plan.tier : 'free',
        currentPlan: isActive && plan ? plan.id : 'free',
        weeklyPrivateQuota: isActive && plan ? plan.weeklyPrivateQuota : 0,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log(`✅ User ${userId} updated → tier: ${isActive && plan ? plan.tier : 'free'}, status: ${subscription.status}`);
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
