const functions = require('firebase-functions');
const admin = require('firebase-admin');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { CREDIT_PACKAGES, getBusinessMonthlyPriceId } = require('./creditsCore');
const {
    isStripeTestMode,
    stripeCustomerModeLabel,
    isStripeCustomerModeMismatchError,
} = require('./stripeEnv');

if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();

/**
 * Reuse Stripe customer for current mode (test/live), or create a fresh one when
 * Firestore still has a customer id from the other mode.
 */
async function resolveStripeCustomerForUser({ userId, email, userRef, userData }) {
    const currentMode = stripeCustomerModeLabel();
    const expectLive = currentMode === 'live';
    const storedId = String(userData?.stripeCustomerId || '').trim();
    const storedMode = String(userData?.stripeCustomerMode || '').trim().toLowerCase();

    const validateStored = async () => {
        if (!storedId) return null;
        const customer = await stripe.customers.retrieve(storedId);
        if (customer.deleted || customer.livemode !== expectLive) return null;
        if (storedMode !== currentMode) {
            await userRef.set({ stripeCustomerMode: currentMode }, { merge: true });
        }
        return storedId;
    };

    if (storedId) {
        try {
            const ok = await validateStored();
            if (ok) return ok;
        } catch (err) {
            if (!isStripeCustomerModeMismatchError(err)) throw err;
        }
    }

    const customer = await stripe.customers.create({
        email: email || `user_${userId}@dinebuddies.com`,
        metadata: { firebaseUID: userId, stripeMode: currentMode },
    });

    await userRef.set({
        stripeCustomerId: customer.id,
        stripeCustomerMode: currentMode,
    }, { merge: true });

    console.log(`Stripe customer ${customer.id} (${currentMode}) for user ${userId}`);
    return customer.id;
}

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

    const { priceId: priceIdIn, planId, planName, subscriptionKind } = data;
    const userId = context.auth.uid;

    const priceId = String(priceIdIn || '').trim();
    if (!priceId) {
        throw new functions.https.HttpsError(
            'invalid-argument',
            'Price ID is required'
        );
    }

    try {
        const userRef = db.collection('users').doc(userId);
        const userDoc = await userRef.get();
        const userData = userDoc.exists ? userDoc.data() : {};
        const customerId = await resolveStripeCustomerForUser({
            userId,
            email: context.auth.token.email,
            userRef,
            userData,
        });

        // إنشاء Checkout Session
        const session = await stripe.checkout.sessions.create({
            customer: customerId,
            payment_method_types: ['card'],
            line_items: [
                {
                    price: priceId,
                    quantity: 1,
                },
            ],
            mode: 'subscription',
            success_url: `${data.successUrl}?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: data.cancelUrl,
            metadata: {
                userId: userId,
                planId: planId || '',
                planName: planName || '',
                subscriptionKind: String(subscriptionKind || '').trim().toLowerCase(),
                stripeMode: isStripeTestMode() ? 'test' : 'live',
            },
        });

        console.log(`✅ Checkout session created for user ${userId}: ${session.id} (${isStripeTestMode() ? 'test' : 'live'})`);

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
        const userRef = db.collection('users').doc(userId);
        const userDoc = await userRef.get();
        const userData = userDoc.exists ? userDoc.data() : {};
        const customerId = await resolveStripeCustomerForUser({
            userId,
            email: context.auth.token.email,
            userRef,
            userData,
        });

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

/**
 * Business monthly subscription — price from STRIPE_PRICE_BUSINESS_MONTHLY (test or live).
 */
exports.createBusinessSubscriptionCheckout = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Sign in required');
    }

    const priceId = getBusinessMonthlyPriceId();
    if (!priceId) {
        throw new functions.https.HttpsError(
            'failed-precondition',
            'Business plan is not configured (set STRIPE_PRICE_BUSINESS_MONTHLY in functions/.env).'
        );
    }

    const successUrl = String(data?.successUrl || '').trim();
    const cancelUrl = String(data?.cancelUrl || '').trim();
    if (!successUrl || !cancelUrl) {
        throw new functions.https.HttpsError('invalid-argument', 'successUrl and cancelUrl are required');
    }

    const userId = context.auth.uid;
    const planName = String(data?.planName || 'Paid Business').trim();

    try {
        const userRef = db.collection('users').doc(userId);
        const userDoc = await userRef.get();
        const userData = userDoc.exists ? userDoc.data() : {};
        const customerId = await resolveStripeCustomerForUser({
            userId,
            email: context.auth.token.email,
            userRef,
            userData,
        });

        const session = await stripe.checkout.sessions.create({
            customer: customerId,
            payment_method_types: ['card'],
            line_items: [{ price: priceId, quantity: 1 }],
            mode: 'subscription',
            success_url: `${successUrl}${successUrl.includes('?') ? '&' : '?'}session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: cancelUrl,
            metadata: {
                userId,
                planId: 'paid',
                planName,
                subscriptionKind: 'business',
                stripeMode: isStripeTestMode() ? 'test' : 'live',
            },
        });

        return { sessionId: session.id, url: session.url };
    } catch (error) {
        console.error('createBusinessSubscriptionCheckout:', error);
        throw new functions.https.HttpsError('internal', error.message || 'Checkout failed');
    }
});

/** Admin/debug: which Stripe prices are configured (no secrets). */
exports.getStripeCommerceStatus = functions.https.onCall(async () => {
    const { stripeCommerceStatus } = require('./stripeEnv');
    return stripeCommerceStatus();
});
