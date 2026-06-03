const functions = require('firebase-functions');
const admin = require('firebase-admin');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { grantPaidCreditsInTransaction, isBusinessUserDoc, priceIdToCreditPackage } = require('./creditsCore');
const { getCheckoutPlan, getCheckoutPlanByPrice } = require('./paymentPlans');

const db = admin.firestore();
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

const ACTIVE_SUBSCRIPTION_STATUSES = new Set(['active', 'trialing']);

function checkoutIsPaid(session) {
    if (session.mode === 'payment') return session.payment_status === 'paid';
    return session.payment_status === 'paid' || session.payment_status === 'no_payment_required';
}

async function getSingleLineItemPriceId(sessionId) {
    const lineItems = await stripe.checkout.sessions.listLineItems(sessionId, { limit: 5 });
    const prices = (lineItems.data || [])
        .map((item) => item.price?.id)
        .filter(Boolean);
    if (prices.length !== 1) {
        throw new Error(`Expected exactly one checkout line item for ${sessionId}, found ${prices.length}`);
    }
    return prices[0];
}

async function findUserByStripeCustomer(customer) {
    if (!customer) return null;
    const usersSnapshot = await db.collection('users')
        .where('stripeCustomerId', '==', customer)
        .limit(1)
        .get();
    return usersSnapshot.empty ? null : usersSnapshot.docs[0];
}

async function downgradeCustomerEntitlements(customer, status) {
    const userDoc = await findUserByStripeCustomer(customer);
    if (!userDoc) return;
    await userDoc.ref.update({
        subscriptionStatus: status || 'inactive',
        subscriptionTier: 'free',
        currentPlan: admin.firestore.FieldValue.delete(),
        weeklyPrivateQuota: 0,
        monthlyPrivateQuota: 0,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
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

    if (!checkoutIsPaid(session)) {
        throw new Error(`Dine credits checkout ${session.id} is not paid`);
    }

    if (!userId || !Number.isFinite(credits) || credits <= 0) {
        console.error('Invalid dine credits checkout metadata', session.metadata);
        return;
    }

    const paidPriceId = await getSingleLineItemPriceId(session.id);
    const creditPackage = priceIdToCreditPackage()[paidPriceId];
    if (!creditPackage || creditPackage.packageId !== packageId || creditPackage.credits !== credits) {
        throw new Error(`Dine credits checkout ${session.id} paid unexpected price ${paidPriceId}`);
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

    if (!checkoutIsPaid(session)) {
        throw new Error(`Checkout ${session.id} is not paid`);
    }

    const plan = getCheckoutPlan(planId);
    if (!plan) {
        throw new Error(`Checkout ${session.id} has unknown planId ${planId}`);
    }
    if (session.mode !== plan.mode) {
        throw new Error(`Checkout ${session.id} mode ${session.mode} does not match ${plan.mode}`);
    }

    const paidPriceId = await getSingleLineItemPriceId(session.id);
    if (paidPriceId !== plan.priceId) {
        throw new Error(`Checkout ${session.id} paid unexpected price ${paidPriceId} for plan ${plan.id}`);
    }

    const fulfillRef = db.collection('stripe_checkout_fulfillments').doc(session.id);
    const userRef = db.collection('users').doc(userId);
    const subscriptionRef = db.collection('user_subscriptions').doc(session.id);

    await db.runTransaction(async (tx) => {
        const done = await tx.get(fulfillRef);
        if (done.exists) return;

        const patch = {
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        if (plan.kind === 'subscription') {
            patch.subscriptionStatus = 'active';
            patch.subscriptionId = subscriptionId || admin.firestore.FieldValue.delete();
            patch.subscriptionTier = plan.tier;
            patch.currentPlan = plan.id;
            patch.weeklyPrivateQuota = plan.weeklyPrivateQuota || 0;
            patch.monthlyPrivateQuota = plan.monthlyPrivateQuota || 0;
            patch.usedPrivateCreditsThisWeek = 0;
            patch.subscriptionStartDate = admin.firestore.FieldValue.serverTimestamp();
            patch.stripeCustomerId = session.customer || admin.firestore.FieldValue.delete();
            if (plan.offerCredits) {
                patch.offerCredits = admin.firestore.FieldValue.increment(plan.offerCredits);
            }
        } else if (plan.kind === 'private_pack') {
            patch.purchasedPrivateCredits = admin.firestore.FieldValue.increment(plan.purchasedPrivateCredits || 0);
        } else if (plan.kind === 'offer_pack') {
            patch.offerCredits = admin.firestore.FieldValue.increment(plan.offerCredits || 0);
        } else {
            throw new Error(`Unsupported checkout plan kind ${plan.kind}`);
        }

        tx.update(userRef, patch);
        tx.set(fulfillRef, {
            userId,
            planId: plan.id,
            kind: plan.kind,
            priceId: paidPriceId,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        tx.set(subscriptionRef, {
            userId,
            planId: plan.id,
            subscriptionId: subscriptionId || null,
            status: plan.kind === 'subscription' ? 'active' : 'fulfilled',
            kind: plan.kind,
            startDate: admin.firestore.FieldValue.serverTimestamp(),
            sessionId: session.id
        }, { merge: true });
    });

    console.log(`✅ Fulfilled checkout ${session.id} for user ${userId}, plan ${plan.id}`);
}

async function handleSubscriptionUpdate(subscription) {
    console.log('🔄 Subscription updated:', subscription.id);

    const customer = subscription.customer;
    const userDoc = await findUserByStripeCustomer(customer);

    if (!userDoc) {
        console.log('No user found for customer:', customer);
        return;
    }

    const userId = userDoc.id;
    const priceId = subscription.items?.data?.[0]?.price?.id || '';
    const plan = getCheckoutPlanByPrice(priceId) || getCheckoutPlan(subscription.metadata?.planId || userDoc.data()?.currentPlan);

    if (!ACTIVE_SUBSCRIPTION_STATUSES.has(subscription.status)) {
        await downgradeCustomerEntitlements(customer, subscription.status);
        console.log(`✅ User ${userId} downgraded because subscription is ${subscription.status}`);
        return;
    }

    if (!plan || plan.kind !== 'subscription') {
        throw new Error(`Subscription ${subscription.id} has unknown price ${priceId}`);
    }

    await db.collection('users').doc(userId).update({
        subscriptionStatus: subscription.status,
        subscriptionTier: plan.tier,
        currentPlan: plan.id,
        weeklyPrivateQuota: plan.weeklyPrivateQuota || 0,
        monthlyPrivateQuota: plan.monthlyPrivateQuota || 0,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log(`✅ User ${userId} updated → tier: ${plan.tier}, status: ${subscription.status}`);
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
    await downgradeCustomerEntitlements(invoice.customer, 'past_due');
}
