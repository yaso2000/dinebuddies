const functions = require('firebase-functions');
const admin = require('firebase-admin');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { grantPaidCreditsInTransaction, isBusinessUserDoc, priceIdToCreditPackage } = require('./creditsCore');
const { getCheckoutPlan, getCheckoutPlanByPriceId } = require('./paymentPlans');

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
    if (session.line_items?.data?.[0]?.price?.id) {
        return session.line_items.data[0].price.id;
    }
    const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 1 });
    return lineItems.data?.[0]?.price?.id || null;
}

async function assertCheckoutPrice(session, expectedPriceId) {
    const actualPriceId = await getCheckoutSessionPriceId(session);
    if (!actualPriceId || actualPriceId !== expectedPriceId) {
        throw new Error(`Stripe price mismatch for ${session.id}: expected ${expectedPriceId}, got ${actualPriceId || 'none'}`);
    }
    return actualPriceId;
}

async function handleDineCreditsPurchase(session) {
    const userId = session.metadata?.userId;
    const paidPriceId = await getCheckoutSessionPriceId(session);
    const packageFromPrice = priceIdToCreditPackage()[paidPriceId];
    if (!packageFromPrice) {
        throw new Error(`Unknown Dine Credits Stripe price for ${session.id}: ${paidPriceId || 'none'}`);
    }
    const credits = packageFromPrice.credits;
    const packageId = packageFromPrice.packageId;

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

    const plan = getCheckoutPlan(planId);
    if (!plan) {
        throw new Error(`Unknown checkout plan metadata for ${session.id}: ${planId || 'none'}`);
    }
    if (session.mode !== plan.mode) {
        throw new Error(`Stripe mode mismatch for ${session.id}: expected ${plan.mode}, got ${session.mode}`);
    }
    await assertCheckoutPrice(session, plan.priceId);
    if (plan.mode === 'payment' && session.payment_status && session.payment_status !== 'paid') {
        throw new Error(`Checkout session ${session.id} completed without paid status: ${session.payment_status}`);
    }

    const fulfillRef = db.collection('stripe_checkout_fulfillments').doc(session.id);

    try {
        if (plan.fulfillment === 'offer_slot' || plan.fulfillment === 'private_pack') {
            await db.runTransaction(async (tx) => {
                const done = await tx.get(fulfillRef);
                if (done.exists) return;

                const patch = {
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                };
                if (plan.fulfillment === 'offer_slot') {
                    patch.offerCredits = admin.firestore.FieldValue.increment(plan.credits);
                    patch.offerSlotCredits = admin.firestore.FieldValue.increment(plan.credits);
                } else {
                    patch.purchasedPrivateCredits = admin.firestore.FieldValue.increment(plan.credits);
                }

                tx.update(db.collection('users').doc(userId), patch);
                tx.set(fulfillRef, {
                    userId,
                    planId: plan.id,
                    fulfillment: plan.fulfillment,
                    credits: plan.credits,
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                });
            });
            console.log(`✅ User ${userId} fulfilled ${plan.fulfillment}: ${plan.credits}`);
        } else {
            // Subscription plan
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
        }

        // Save subscription record
        await db.collection('user_subscriptions').doc(session.id).set({
            userId,
            planId: plan.id,
            subscriptionId,
            status: plan.mode === 'subscription' ? 'active' : 'fulfilled',
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
    const priceId = subscription.items?.data?.[0]?.price?.id;
    const plan = getCheckoutPlanByPriceId(priceId);
    if (!plan || plan.fulfillment !== 'subscription') {
        throw new Error(`Unknown subscription price for ${subscription.id}: ${priceId || 'none'}`);
    }

    await db.collection('users').doc(userId).update({
        subscriptionStatus: subscription.status,
        subscriptionTier: subscription.status === 'active' ? plan.tier : 'free',
        weeklyPrivateQuota: subscription.status === 'active' ? plan.weeklyPrivateQuota : 0,
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
