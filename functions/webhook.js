const functions = require('firebase-functions');
const admin = require('firebase-admin');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { grantPaidCreditsInTransaction, isBusinessUserDoc, priceIdToCreditPackage } = require('./creditsCore');
const { getCheckoutCatalogItem, getSubscriptionPlan } = require('./paymentPlans');

const db = admin.firestore();
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

// Map planId → weeklyPrivateQuota  (-1 = unlimited)
const PLAN_QUOTA_MAP = {
    // User plans
    'pro': 2,
    'p2': 2,
    'vip': -1,
    'p3': -1,
    'premium': -1,
    // Partner plans (no private invites — they are business accounts)
    'professional': 0,
    'p4': 0,
    'elite': 0,
    'p5': 0,
};

function getQuotaForPlan(planId) {
    const plan = getSubscriptionPlan(planId);
    if (plan) return plan.weeklyPrivateQuota;
    if (!planId) return 0;
    const id = planId.toLowerCase();
    if (id in PLAN_QUOTA_MAP) return PLAN_QUOTA_MAP[id];
    // Fallback by keyword
    if (id.includes('premium')) return -1;
    if (id.includes('pro')) return 2;
    return 0;
}

function getTierForPlan(planId) {
    const plan = getSubscriptionPlan(planId);
    if (plan) return plan.tier;
    if (!planId) return 'free';
    const id = planId.toLowerCase();
    if (id === 'p2') return 'pro';
    if (id === 'p3') return 'vip';
    if (id === 'p4') return 'professional';
    if (id === 'p5') return 'elite';
    if (id.includes('elite')) return 'elite';
    if (id.includes('professional')) return 'professional';
    if (id.includes('vip')) return 'vip';
    if (id.includes('premium')) return 'premium';
    if (id.includes('pro')) return 'pro';
    return 'free';
}

async function getCheckoutPriceIds(session) {
    const lineItems = await stripe.checkout.sessions.listLineItems(session.id, {
        limit: 100,
        expand: ['data.price'],
    });
    return lineItems.data
        .map((line) => (typeof line.price === 'string' ? line.price : line.price?.id))
        .filter(Boolean);
}

function requirePaidPrice(session, priceIds, expectedPriceId) {
    if (!expectedPriceId || !priceIds.includes(expectedPriceId)) {
        throw new Error(`Checkout ${session.id} paid unexpected Stripe price`);
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

async function handleDineCreditsPurchase(session, priceIds) {
    const userId = session.metadata?.userId;
    const packageByPrice = priceIdToCreditPackage();
    const paidPackage = priceIds
        .map((priceId) => packageByPrice[priceId])
        .find(Boolean);
    const credits = Math.floor(Number(paidPackage?.credits));
    const packageId = String(paidPackage?.packageId || session.metadata?.packageId || '');

    if (!userId || !Number.isFinite(credits) || credits <= 0) {
        throw new Error(`Invalid dine credits checkout price for session ${session.id}`);
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

    const priceIds = await getCheckoutPriceIds(session);

    if (session.mode === 'payment' && session.metadata?.purchaseType === 'dine_credits') {
        if (session.payment_status !== 'paid') {
            throw new Error(`Dine credits checkout ${session.id} completed without paid status`);
        }
        await handleDineCreditsPurchase(session, priceIds);
        return;
    }

    const item = getCheckoutCatalogItem(planId);
    if (!item) {
        throw new Error(`Unknown checkout catalog item for planId=${planId}`);
    }
    requirePaidPrice(session, priceIds, item.priceId);

    try {
        if (item.checkoutType === 'one_time') {
            if (session.payment_status !== 'paid') {
                throw new Error(`One-time checkout ${session.id} completed without paid status`);
            }

            await fulfillOneTimeCatalogItem(session, userId, item);
        } else {
            const weeklyQuota = item.weeklyPrivateQuota;
            const tier = item.tier;

            // Subscription plan
            await db.collection('users').doc(userId).update({
                subscriptionStatus: 'active',
                subscriptionId: subscriptionId,
                subscriptionTier: tier,
                currentPlan: item.id,
                weeklyPrivateQuota: weeklyQuota,
                usedPrivateCreditsThisWeek: 0,
                subscriptionStartDate: admin.firestore.FieldValue.serverTimestamp(),
                stripeCustomerId: session.customer || admin.firestore.FieldValue.delete()
            });

            console.log(`✅ User ${userId} → plan: ${item.id}, tier: ${tier}, quota: ${weeklyQuota}`);

            // Save subscription record
            await db.collection('user_subscriptions').add({
                userId,
                planId: item.id,
                subscriptionId,
                status: 'active',
                startDate: admin.firestore.FieldValue.serverTimestamp(),
                sessionId: session.id
            });
        }

    } catch (error) {
        console.error('Error updating user subscription:', error);
        throw error;
    }
}

async function fulfillOneTimeCatalogItem(session, userId, item) {
    const fulfillRef = db.collection('stripe_checkout_fulfillments').doc(session.id);
    const userRef = db.collection('users').doc(userId);

    await db.runTransaction(async (tx) => {
        const done = await tx.get(fulfillRef);
        if (done.exists) return;

        const snap = await tx.get(userRef);
        if (!snap.exists) {
            throw new Error(`User ${userId} not found for checkout ${session.id}`);
        }

        const updates = {
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        if (item.fulfillmentType === 'private_invitation_pack') {
            updates.purchasedPrivateCredits = admin.firestore.FieldValue.increment(item.amount);
        } else if (item.fulfillmentType === 'offer_slot_pack') {
            updates.offerCredits = admin.firestore.FieldValue.increment(item.amount);
        } else {
            throw new Error(`Unsupported fulfillment type: ${item.fulfillmentType}`);
        }

        tx.update(userRef, updates);
        tx.set(fulfillRef, {
            userId,
            planId: item.id,
            fulfillmentType: item.fulfillmentType,
            amount: item.amount,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    });

    console.log(`✅ Fulfilled ${item.fulfillmentType} (${item.amount}) for ${userId}`);
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
    const planId = subscription.metadata?.planId || usersSnapshot.docs[0].data().currentPlan;
    const weeklyQuota = getQuotaForPlan(planId);
    const tier = getTierForPlan(planId);

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
