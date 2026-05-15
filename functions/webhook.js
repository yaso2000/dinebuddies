const functions = require('firebase-functions');
const admin = require('firebase-admin');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { grantPaidCreditsInTransaction, isBusinessUserDoc } = require('./creditsCore');
const { findByPlanId, isExpectedPriceForProduct } = require('./paymentPlans');

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
    if (!planId) return 0;
    const id = planId.toLowerCase();
    if (id in PLAN_QUOTA_MAP) return PLAN_QUOTA_MAP[id];
    // Fallback by keyword
    if (id.includes('premium')) return -1;
    if (id.includes('pro')) return 2;
    return 0;
}

function getTierForPlan(planId) {
    if (!planId) return 'free';
    const id = planId.toLowerCase();
    if (id.includes('elite')) return 'elite';
    if (id.includes('professional')) return 'professional';
    if (id.includes('premium')) return 'premium';
    if (id.includes('pro')) return 'pro';
    return 'free';
}

async function getPaidPriceIdsForSession(session) {
    if (session.subscription) {
        const subscription = await stripe.subscriptions.retrieve(session.subscription, {
            expand: ['items.data.price'],
        });
        return (subscription.items?.data || [])
            .map((item) => item.price?.id || item.plan?.id)
            .filter(Boolean);
    }

    const lineItems = await stripe.checkout.sessions.listLineItems(session.id, {
        limit: 10,
        expand: ['data.price'],
    });
    return (lineItems.data || [])
        .map((item) => item.price?.id)
        .filter(Boolean);
}

async function getVerifiedCheckoutProduct(session) {
    const product = findByPlanId(session.metadata?.planId);
    if (!product) {
        console.error('Unknown checkout plan metadata:', session.metadata);
        return null;
    }

    const paidPriceIds = await getPaidPriceIdsForSession(session);
    if (!isExpectedPriceForProduct(product, paidPriceIds)) {
        console.error('Checkout price mismatch; refusing entitlement grant', {
            sessionId: session.id,
            planId: session.metadata?.planId,
            expectedPriceId: product.priceId,
            paidPriceIds,
        });
        return null;
    }

    return product;
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

    const checkoutProduct = await getVerifiedCheckoutProduct(session);
    if (!checkoutProduct) {
        return;
    }

    const planId = checkoutProduct.planId;
    const weeklyQuota = Number.isFinite(checkoutProduct.weeklyQuota)
        ? checkoutProduct.weeklyQuota
        : getQuotaForPlan(planId);
    const tier = checkoutProduct.tier || getTierForPlan(planId);
    const isOfferSlot = checkoutProduct.type === 'offer_slot';
    const isPrivateCreditPack = checkoutProduct.type === 'private_invitation_credits';

    try {
        const fulfillRef = db.collection('stripe_checkout_fulfillments').doc(session.id);
        const userRef = db.collection('users').doc(userId);
        const subscriptionRef = db.collection('user_subscriptions').doc(session.id);

        await db.runTransaction(async (tx) => {
            const done = await tx.get(fulfillRef);
            if (done.exists) return;

            const userSnap = await tx.get(userRef);
            if (!userSnap.exists) {
                console.error('User not found for checkout fulfillment:', userId);
                return;
            }

            if (isOfferSlot) {
                tx.update(userRef, {
                    offerCredits: admin.firestore.FieldValue.increment(1),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });
            } else if (isPrivateCreditPack) {
                tx.update(userRef, {
                    purchasedPrivateCredits: admin.firestore.FieldValue.increment(checkoutProduct.privateCredits || 0),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });
            } else {
                tx.update(userRef, {
                    subscriptionStatus: 'active',
                    subscriptionId: subscriptionId,
                    subscriptionTier: tier,
                    currentPlan: planId,
                    weeklyPrivateQuota: weeklyQuota,
                    usedPrivateCreditsThisWeek: 0,
                    subscriptionStartDate: admin.firestore.FieldValue.serverTimestamp(),
                    stripeCustomerId: session.customer || admin.firestore.FieldValue.delete()
                });

                tx.set(subscriptionRef, {
                    userId,
                    planId,
                    subscriptionId,
                    status: 'active',
                    startDate: admin.firestore.FieldValue.serverTimestamp(),
                    sessionId: session.id
                });
            }

            tx.set(fulfillRef, {
                userId,
                planId,
                checkoutType: checkoutProduct.type,
                sessionId: session.id,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        });

        if (isOfferSlot) {
            console.log(`✅ User ${userId} received 1 offer credit`);
        } else if (isPrivateCreditPack) {
            console.log(`✅ User ${userId} received ${checkoutProduct.privateCredits || 0} private invitation credits`);
        } else {
            console.log(`✅ User ${userId} → plan: ${planId}, tier: ${tier}, quota: ${weeklyQuota}`);
        }

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
    const planId = subscription.metadata?.planId || usersSnapshot.docs[0].data().currentPlan;
    const checkoutProduct = findByPlanId(planId);
    const resolvedPlanId = checkoutProduct?.planId || planId;
    const weeklyQuota = checkoutProduct && Number.isFinite(checkoutProduct.weeklyQuota)
        ? checkoutProduct.weeklyQuota
        : getQuotaForPlan(resolvedPlanId);
    const tier = checkoutProduct?.tier || getTierForPlan(resolvedPlanId);

    await db.collection('users').doc(userId).update({
        subscriptionStatus: subscription.status,
        subscriptionTier: tier,
        currentPlan: resolvedPlanId,
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
