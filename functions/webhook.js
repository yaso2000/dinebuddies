const functions = require('firebase-functions');
const admin = require('firebase-admin');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { grantPaidCreditsInTransaction, isBusinessUserDoc, priceIdToCreditPackage } = require('./creditsCore');
const { findPaymentPlanByPriceId } = require('./paymentPlans');

const db = admin.firestore();
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

async function getCheckoutSessionPriceId(session) {
    const expandedLineItems = session.line_items?.data || [];
    const expandedPriceId = expandedLineItems[0]?.price?.id;
    if (expandedPriceId) return expandedPriceId;

    const lineItems = await stripe.checkout.sessions.listLineItems(session.id, {
        limit: 1,
        expand: ['data.price'],
    });
    return lineItems.data[0]?.price?.id || null;
}

function getSubscriptionPriceId(subscription) {
    return subscription.items?.data?.[0]?.price?.id || null;
}

async function resolveCheckoutPaymentPlan(session) {
    const priceId = await getCheckoutSessionPriceId(session);
    const plan = findPaymentPlanByPriceId(priceId);
    if (!plan) {
        throw new Error(`Unrecognized Stripe checkout price: ${priceId || 'missing'}`);
    }
    return { plan, priceId };
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
    if (session.payment_status && session.payment_status !== 'paid') {
        console.warn('Ignoring unpaid dine credits checkout session', session.id, session.payment_status);
        return;
    }

    const priceId = await getCheckoutSessionPriceId(session);
    const packageByPrice = priceIdToCreditPackage()[priceId];
    const credits = Math.floor(Number(packageByPrice?.credits));
    const packageId = String(packageByPrice?.packageId || session.metadata?.packageId || '');

    if (!userId || !Number.isFinite(credits) || credits <= 0) {
        console.error('Invalid dine credits checkout fulfillment', { sessionId: session.id, priceId, metadata: session.metadata });
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

async function handleOneTimePackPurchase(session, plan) {
    const userId = session.metadata?.userId;
    if (!userId) {
        console.error('No userId in one-time checkout session metadata');
        return;
    }
    if (session.payment_status && session.payment_status !== 'paid') {
        console.warn('Ignoring unpaid one-time checkout session', session.id, session.payment_status);
        return;
    }

    const fulfillRef = db.collection('stripe_checkout_fulfillments').doc(session.id);
    const userRef = db.collection('users').doc(userId);

    await db.runTransaction(async (tx) => {
        const done = await tx.get(fulfillRef);
        if (done.exists) return;

        const userSnap = await tx.get(userRef);
        if (!userSnap.exists) {
            console.error('User not found for one-time checkout:', userId);
            return;
        }

        const updates = {
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };
        if (plan.purchaseType === 'private_invitation_pack') {
            updates.purchasedPrivateCredits = admin.firestore.FieldValue.increment(Number(plan.privateCredits) || 0);
        } else if (plan.purchaseType === 'offer_slot_pack') {
            updates.offerCredits = admin.firestore.FieldValue.increment(Number(plan.offerCredits) || 0);
            updates.offerSlotCredits = admin.firestore.FieldValue.increment(Number(plan.offerCredits) || 0);
        } else {
            throw new Error(`Unsupported one-time purchase type: ${plan.purchaseType}`);
        }

        tx.update(userRef, updates);
        tx.set(fulfillRef, {
            userId,
            planId: plan.id,
            purchaseType: plan.purchaseType,
            sessionId: session.id,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    });

    console.log(`✅ Fulfilled one-time checkout ${session.id} (${plan.id}) for ${userId}`);
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

    const { plan } = await resolveCheckoutPaymentPlan(session);

    try {
        if (plan.mode === 'payment') {
            await handleOneTimePackPurchase(session, plan);
            return;
        }

        // Subscription plan: entitlement comes from the paid Stripe Price, not client metadata.
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

        // Save subscription record
        await db.collection('user_subscriptions').add({
            userId,
            planId: plan.id,
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
    const priceId = getSubscriptionPriceId(subscription);
    const plan = findPaymentPlanByPriceId(priceId);
    if (!plan || plan.mode !== 'subscription') {
        console.error('Ignoring subscription update for unrecognized Stripe price', {
            subscriptionId: subscription.id,
            priceId,
            customer
        });
        return;
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
