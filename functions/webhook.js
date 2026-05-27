const functions = require('firebase-functions');
const admin = require('firebase-admin');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { grantPaidCreditsInTransaction, isBusinessUserDoc } = require('./creditsCore');
const { getCheckoutProduct, getCheckoutProductByPriceId, getSubscriptionProduct } = require('./paymentPlans');

const db = admin.firestore();
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

// Map planId → weeklyPrivateQuota  (-1 = unlimited)
const PLAN_QUOTA_MAP = {
    // User plans
    'pro': 2,
    'premium': -1,
    // Partner plans (no private invites — they are business accounts)
    'professional': 0,
    'elite': 0,
};

function getQuotaForPlan(planId) {
    const product = getSubscriptionProduct(planId);
    if (product) return product.weeklyPrivateQuota;
    if (!planId) return 0;
    const id = planId.toLowerCase();
    if (id in PLAN_QUOTA_MAP) return PLAN_QUOTA_MAP[id];
    // Fallback by keyword
    if (id.includes('premium')) return -1;
    if (id.includes('pro')) return 2;
    return 0;
}

function getTierForPlan(planId) {
    const product = getSubscriptionProduct(planId);
    if (product) return product.subscriptionTier;
    if (!planId) return 'free';
    const id = planId.toLowerCase();
    if (id.includes('elite')) return 'elite';
    if (id.includes('professional')) return 'professional';
    if (id.includes('premium')) return 'premium';
    if (id.includes('pro')) return 'pro';
    return 'free';
}

async function getCheckoutLineItemPriceId(sessionId) {
    const lineItems = await stripe.checkout.sessions.listLineItems(sessionId, { limit: 1 });
    const item = lineItems.data && lineItems.data[0];
    return item?.price?.id || null;
}

async function getVerifiedCheckoutProduct(session) {
    const actualPriceId = await getCheckoutLineItemPriceId(session.id);
    const actualProduct = getCheckoutProductByPriceId(actualPriceId);
    const intendedProduct = getCheckoutProduct(session.metadata?.productId || session.metadata?.planId);

    if (!actualProduct) {
        console.error('Unknown Stripe checkout price:', { sessionId: session.id, actualPriceId });
        return null;
    }
    if (intendedProduct && intendedProduct.id !== actualProduct.id) {
        console.error('Stripe checkout metadata/price mismatch:', {
            sessionId: session.id,
            intendedProductId: intendedProduct.id,
            actualProductId: actualProduct.id,
            actualPriceId,
        });
        return null;
    }
    if (session.mode !== actualProduct.mode) {
        console.error('Stripe checkout mode mismatch:', {
            sessionId: session.id,
            mode: session.mode,
            expectedMode: actualProduct.mode,
        });
        return null;
    }
    return actualProduct;
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

async function handleOneTimeProductPurchase(session, product, userId) {
    if (session.payment_status && session.payment_status !== 'paid') {
        console.log('Ignoring unpaid one-time checkout session:', session.id, session.payment_status);
        return;
    }

    const fulfillRef = db.collection('stripe_pack_fulfillments').doc(session.id);
    const userRef = db.collection('users').doc(userId);

    await db.runTransaction(async (tx) => {
        const done = await tx.get(fulfillRef);
        if (done.exists) return;

        const userSnap = await tx.get(userRef);
        if (!userSnap.exists) {
            console.error('User not found for Stripe product fulfillment:', userId, product.id);
            return;
        }

        const update = { updatedAt: admin.firestore.FieldValue.serverTimestamp() };
        if (product.purchaseType === 'private_invitation_pack') {
            update.purchasedPrivateCredits = admin.firestore.FieldValue.increment(product.purchasedPrivateCredits);
        } else if (product.purchaseType === 'offer_slot_pack') {
            update.offerCredits = admin.firestore.FieldValue.increment(product.offerCredits);
        } else {
            console.error('Unknown one-time product type:', product);
            return;
        }

        tx.update(userRef, update);
        tx.set(fulfillRef, {
            userId,
            productId: product.id,
            purchaseType: product.purchaseType,
            purchasedPrivateCredits: product.purchasedPrivateCredits || 0,
            offerCredits: product.offerCredits || 0,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    });

    console.log(`✅ Fulfilled Stripe product ${product.id} for ${userId}`);
}

async function handleCheckoutComplete(session) {
    console.log('💳 Checkout completed:', session.id);

    const userId = session.metadata?.userId;

    if (!userId) {
        console.error('No userId in session metadata');
        return;
    }

    if (session.mode === 'payment' && session.metadata?.purchaseType === 'dine_credits') {
        if (session.payment_status && session.payment_status !== 'paid') {
            console.log('Ignoring unpaid dine credits checkout session:', session.id, session.payment_status);
            return;
        }
        await handleDineCreditsPurchase(session);
        return;
    }

    const product = await getVerifiedCheckoutProduct(session);
    if (!product) return;

    if (product.mode === 'payment') {
        await handleOneTimeProductPurchase(session, product, userId);
        return;
    }

    const subscriptionId = session.subscription;
    const weeklyQuota = product.weeklyPrivateQuota;
    const tier = product.subscriptionTier;

    try {
        // Subscription plan
        await db.collection('users').doc(userId).update({
            subscriptionStatus: 'active',
            subscriptionId: subscriptionId,
            subscriptionTier: tier,
            currentPlan: product.planId,
            weeklyPrivateQuota: weeklyQuota,
            usedPrivateCreditsThisWeek: 0,
            subscriptionStartDate: admin.firestore.FieldValue.serverTimestamp(),
            stripeCustomerId: session.customer || admin.firestore.FieldValue.delete()
        });

        console.log(`✅ User ${userId} → plan: ${product.planId}, tier: ${tier}, quota: ${weeklyQuota}`);

        // Save subscription record
        await db.collection('user_subscriptions').add({
            userId,
            planId: product.planId,
            productId: product.id,
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
    const currentPlan = usersSnapshot.docs[0].data().currentPlan;
    const itemPriceId = subscription.items?.data?.[0]?.price?.id;
    const product =
        getCheckoutProductByPriceId(itemPriceId) ||
        getSubscriptionProduct(subscription.metadata?.productId || subscription.metadata?.planId || currentPlan);
    if (!product || product.mode !== 'subscription') {
        console.error('Unable to resolve subscription product:', {
            subscriptionId: subscription.id,
            itemPriceId,
            metadata: subscription.metadata,
            currentPlan,
        });
        return;
    }
    const weeklyQuota = product.weeklyPrivateQuota;
    const tier = product.subscriptionTier;

    await db.collection('users').doc(userId).update({
        subscriptionStatus: subscription.status,
        subscriptionTier: tier,
        currentPlan: product.planId,
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
