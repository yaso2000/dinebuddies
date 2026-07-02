const functions = require('firebase-functions');
const admin = require('firebase-admin');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { grantPaidCreditsInTransaction, isBusinessUserDoc, priceIdToCreditPackage } = require('./creditsCore');
const { getCheckoutPlan, getSubscriptionPlanByPriceId } = require('./paymentPlans');

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
    const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 2 });
    const items = lineItems?.data || [];
    if (items.length !== 1) {
        throw new Error(`Unexpected checkout line item count for ${session.id}: ${items.length}`);
    }
    return items[0]?.price?.id || null;
}

async function assertCheckoutSessionMatchesPlan(session, plan) {
    const actualPriceId = await getCheckoutSessionPriceId(session);
    if (!actualPriceId || actualPriceId !== plan.priceId) {
        throw new Error(`Checkout ${session.id} paid unexpected price ${actualPriceId || 'missing'} for plan ${plan.id}`);
    }
}

async function handleDineCreditsPurchase(session) {
    const userId = session.metadata?.userId;
    if (session.payment_status !== 'paid') {
        throw new Error(`Dine Credits checkout ${session.id} is not paid (${session.payment_status})`);
    }

    const actualPriceId = await getCheckoutSessionPriceId(session);
    const creditPackage = priceIdToCreditPackage()[actualPriceId];
    if (!creditPackage) {
        throw new Error(`Dine Credits checkout ${session.id} paid unknown price ${actualPriceId || 'missing'}`);
    }

    const credits = creditPackage.credits;
    const packageId = creditPackage.packageId;

    if (!userId || !Number.isFinite(credits) || credits <= 0) {
        console.error('Invalid dine credits checkout metadata', session.metadata);
        throw new Error(`Invalid dine credits checkout metadata for ${session.id}`);
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
        throw new Error(`No userId in checkout metadata for ${session.id}`);
    }

    if (session.mode === 'payment' && session.metadata?.purchaseType === 'dine_credits') {
        await handleDineCreditsPurchase(session);
        return;
    }

    const plan = getCheckoutPlan(planId);
    if (!plan) {
        throw new Error(`Unknown checkout plan ${planId || 'missing'} for session ${session.id}`);
    }
    if (session.mode !== plan.mode) {
        throw new Error(`Checkout ${session.id} mode ${session.mode} does not match plan ${plan.id} mode ${plan.mode}`);
    }
    if (plan.mode === 'payment' && session.payment_status !== 'paid') {
        throw new Error(`Checkout ${session.id} is not paid (${session.payment_status})`);
    }
    await assertCheckoutSessionMatchesPlan(session, plan);

    try {
        const fulfillRef = db.collection('stripe_checkout_fulfillments').doc(session.id);
        const userRef = db.collection('users').doc(userId);

        await db.runTransaction(async (tx) => {
            const done = await tx.get(fulfillRef);
            if (done.exists) return;

            const baseFulfillment = {
                userId,
                planId: plan.id,
                fulfillment: plan.fulfillment,
                priceId: plan.priceId,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            };

            if (plan.fulfillment === 'offer_pack') {
                tx.update(userRef, {
                    offerCredits: admin.firestore.FieldValue.increment(plan.offerCredits || 1),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });
                tx.set(fulfillRef, baseFulfillment);
                return;
            }

            if (plan.fulfillment === 'private_pack') {
                tx.update(userRef, {
                    purchasedPrivateCredits: admin.firestore.FieldValue.increment(plan.privateCredits || 0),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });
                tx.set(fulfillRef, {
                    ...baseFulfillment,
                    privateCredits: plan.privateCredits || 0,
                });
                return;
            }

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

            tx.set(db.collection('user_subscriptions').doc(session.id), {
                userId,
                planId: plan.id,
                subscriptionId,
                status: 'active',
                startDate: admin.firestore.FieldValue.serverTimestamp(),
                sessionId: session.id
            });
            tx.set(fulfillRef, baseFulfillment);
        });

        console.log(`✅ User ${userId} fulfilled checkout ${session.id} (${plan.id})`);
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
    const itemPriceId = subscription.items?.data?.[0]?.price?.id;
    const plan = getSubscriptionPlanByPriceId(itemPriceId) ||
        getCheckoutPlan(subscription.metadata?.planId || usersSnapshot.docs[0].data().currentPlan);
    const isEntitled = plan && (subscription.status === 'active' || subscription.status === 'trialing');

    await db.collection('users').doc(userId).update({
        subscriptionStatus: subscription.status,
        subscriptionTier: isEntitled ? plan.tier : 'free',
        weeklyPrivateQuota: isEntitled ? plan.weeklyPrivateQuota : 0,
        currentPlan: isEntitled ? plan.id : 'free',
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log(`✅ User ${userId} updated → tier: ${isEntitled ? plan.tier : 'free'}, status: ${subscription.status}`);
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
