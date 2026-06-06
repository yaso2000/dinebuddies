const functions = require('firebase-functions');
const admin = require('firebase-admin');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { CREDIT_PACKAGES } = require('./creditsCore');
const { getPaymentPlan } = require('./paymentPlans');

if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();

/**
 * إنشاء جلسة دفع Stripe Checkout
 */
exports.createCheckoutSession = functions.https.onCall(async (data, context) => {
    // التحقق من التسجيل
    if (!context.auth) {
        throw new functions.https.HttpsError(
            'unauthenticated',
            'يجب تسجيل الدخول أولاً'
        );
    }

    const { planId } = data;
    const userId = context.auth.uid;

    const plan = getPaymentPlan(planId);
    if (!plan) {
        throw new functions.https.HttpsError(
            'invalid-argument',
            'Invalid payment plan'
        );
    }

    try {
        // إنشاء أو جلب Stripe Customer
        let customerId;
        const userDoc = await db.collection('users').doc(userId).get();

        if (userDoc.exists && userDoc.data().stripeCustomerId) {
            customerId = userDoc.data().stripeCustomerId;
        } else {
            // إنشاء عميل جديد في Stripe
            const customer = await stripe.customers.create({
                email: context.auth.token.email || `user_${userId}@dinebuddies.com`,
                metadata: {
                    firebaseUID: userId
                }
            });
            customerId = customer.id;

            // حفظ Customer ID في Firestore
            await db.collection('users').doc(userId).set({
                stripeCustomerId: customerId
            }, { merge: true });
        }

        const successUrl = String(data.successUrl || '').trim();
        const cancelUrl = String(data.cancelUrl || '').trim();
        if (!successUrl || !cancelUrl) {
            throw new functions.https.HttpsError('invalid-argument', 'successUrl and cancelUrl are required');
        }

        const sessionConfig = {
            customer: customerId,
            payment_method_types: ['card'],
            line_items: [
                {
                    price: plan.priceId,
                    quantity: 1,
                },
            ],
            mode: plan.mode,
            success_url: `${successUrl}${successUrl.includes('?') ? '&' : '?'}session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: cancelUrl,
            metadata: {
                userId: userId,
                planId: plan.planId,
                planName: plan.name,
                purchaseType: plan.fulfillment || 'subscription',
            }
        };

        if (plan.mode === 'subscription') {
            sessionConfig.subscription_data = {
                metadata: {
                    userId,
                    planId: plan.planId,
                },
            };
        }

        // إنشاء Checkout Session
        const session = await stripe.checkout.sessions.create(sessionConfig);

        console.log(`✅ Checkout session created for user ${userId}: ${session.id}`);

        return {
            sessionId: session.id,
            url: session.url
        };

    } catch (error) {
        console.error('Stripe Error:', error);
        throw new functions.https.HttpsError('internal', error.message);
    }
});

/**
 * إنشاء Portal للإدارة (إلغاء، تحديث بطاقة)
 */
exports.createPortalSession = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Not authenticated');
    }

    try {
        const userDoc = await db.collection('users').doc(context.auth.uid).get();

        if (!userDoc.exists) {
            throw new functions.https.HttpsError('not-found', 'User not found');
        }

        const customerId = userDoc.data().stripeCustomerId;

        if (!customerId) {
            throw new functions.https.HttpsError('not-found', 'No customer found');
        }

        const session = await stripe.billingPortal.sessions.create({
            customer: customerId,
            return_url: data.returnUrl,
        });

        return { url: session.url };
    } catch (error) {
        console.error('Portal Error:', error);
        throw new functions.https.HttpsError('internal', error.message);
    }
});

/**
 * One-time Stripe Checkout for Dine Credits packs (mode: payment).
 */
exports.createCreditsCheckoutSession = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Sign in required');
    }

    const packageId = String(data?.packageId || '').trim();
    const def = CREDIT_PACKAGES[packageId];
    if (!def) {
        throw new functions.https.HttpsError('invalid-argument', 'Invalid credit package');
    }

    const priceId = String(process.env[def.envKey] || '').trim();
    if (!priceId) {
        throw new functions.https.HttpsError(
            'failed-precondition',
            'Credit packs are not configured (missing Stripe price env).'
        );
    }

    const successUrl = String(data?.successUrl || '').trim();
    const cancelUrl = String(data?.cancelUrl || '').trim();
    if (!successUrl || !cancelUrl) {
        throw new functions.https.HttpsError('invalid-argument', 'successUrl and cancelUrl are required');
    }

    const userId = context.auth.uid;

    try {
        let customerId;
        const userDoc = await db.collection('users').doc(userId).get();

        if (userDoc.exists && userDoc.data().stripeCustomerId) {
            customerId = userDoc.data().stripeCustomerId;
        } else {
            const customer = await stripe.customers.create({
                email: context.auth.token.email || `user_${userId}@dinebuddies.com`,
                metadata: { firebaseUID: userId },
            });
            customerId = customer.id;
            await db.collection('users').doc(userId).set({ stripeCustomerId: customerId }, { merge: true });
        }

        const session = await stripe.checkout.sessions.create({
            customer: customerId,
            payment_method_types: ['card'],
            line_items: [{ price: priceId, quantity: 1 }],
            mode: 'payment',
            success_url: `${successUrl}${successUrl.includes('?') ? '&' : '?'}session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: cancelUrl,
            metadata: {
                userId,
                purchaseType: 'dine_credits',
                packageId,
                credits: String(def.credits),
            },
        });

        return { sessionId: session.id, url: session.url };
    } catch (error) {
        console.error('createCreditsCheckoutSession:', error);
        throw new functions.https.HttpsError('internal', error.message || 'Checkout failed');
    }
});
