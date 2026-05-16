const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { getStripe } = require('./stripeClient');
const { fulfillDineCreditsFromCheckoutSession } = require('./dineCreditsFulfillment');
const { processAffiliateBusinessCommission, reverseAffiliateCommissionOnChargeRefunded } = require('./affiliateTracking');

const db = admin.firestore();
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

// Legacy consumer checkout planIds (no longer sold) — map to no subscription quota on users.
const PLAN_QUOTA_MAP = {
    pro: 2,
    premium: -1,
    professional: 0,
    elite: 0,
    paid: 0
};

function getQuotaForPlan(planId) {
    if (!planId) return 0;
    const id = String(planId).toLowerCase();
    if (Object.prototype.hasOwnProperty.call(PLAN_QUOTA_MAP, id)) return PLAN_QUOTA_MAP[id];
    if (id.includes('premium')) return -1;
    if (id.includes('pro') && !id.includes('paid')) return 2;
    return 0;
}

/** Business checkout → `paid`; legacy elite/professional → `paid`. Consumer legacy → unchanged keys (app ignores). */
function getTierForPlan(planId) {
    if (!planId) return 'free';
    const id = String(planId).toLowerCase();
    if (id === 'paid' || id.includes('paid')) return 'paid';
    if (id.includes('elite') || id.includes('professional')) return 'paid';
    if (id.includes('premium')) return 'premium';
    if (id.includes('pro')) return 'pro';
    return 'free';
}

/**
 * Stripe Webhook handler
 */
exports.stripeWebhook = functions.https.onRequest(async (req, res) => {
    const sig = req.headers['stripe-signature'];

    let event;

    try {
        event = getStripe().webhooks.constructEvent(req.rawBody, sig, endpointSecret);
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

            case 'charge.refunded':
                await reverseAffiliateCommissionOnChargeRefunded(event.data.object);
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
        await fulfillDineCreditsFromCheckoutSession(db, admin, session);
        return;
    }

    if (session.mode !== 'subscription' || !subscriptionId) {
        console.log('Skipping subscription fulfillment — not a subscription checkout', session.mode, session.id);
        return;
    }

    const weeklyQuota = getQuotaForPlan(planId);
    const tier = getTierForPlan(planId);

    try {
        await db.collection('users').doc(userId).update({
            subscriptionStatus: 'active',
            subscriptionId: subscriptionId,
            subscriptionTier: tier,
            currentPlan: planId,
            weeklyPrivateQuota: weeklyQuota,
            usedPrivateCreditsThisWeek: 0,
            subscriptionStartDate: admin.firestore.FieldValue.serverTimestamp(),
            stripeCustomerId: session.customer || admin.firestore.FieldValue.delete()
        });

        console.log(`✅ User ${userId} → plan: ${planId}, tier: ${tier}, quota: ${weeklyQuota}`);

        await db.collection('user_subscriptions').add({
            userId,
            planId,
            subscriptionId,
            status: 'active',
            startDate: admin.firestore.FieldValue.serverTimestamp(),
            sessionId: session.id
        });

        try {
            await processAffiliateBusinessCommission({ db, admin, session, userId });
        } catch (affErr) {
            console.error('[affiliate] commission hook:', affErr?.message || affErr);
        }
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
