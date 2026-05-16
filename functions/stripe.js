const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { getStripe } = require('./stripeClient');
const { CREDIT_PACKAGES } = require('./creditsCore');
const { fulfillDineCreditsFromCheckoutSession } = require('./dineCreditsFulfillment');

if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();

/**
 * Use stored Stripe customer if it exists in the current API mode (test vs live).
 * If missing or from the wrong mode (e.g. switched sk_test_ ↔ sk_live_), create a new customer and update Firestore.
 */
async function resolveStripeCustomerId(stripe, userId, email, storedId) {
    if (storedId) {
        try {
            await stripe.customers.retrieve(String(storedId).trim());
            return String(storedId).trim();
        } catch (e) {
            const code = e && e.code;
            const msg = String((e && e.message) || '');
            const wrongMode =
                code === 'resource_missing' ||
                msg.includes('similar object exists in live mode') ||
                msg.includes('similar object exists in test mode') ||
                msg.includes('No such customer');
            if (!wrongMode) throw e;
            console.warn(
                `[stripe] Replacing invalid stripeCustomerId for ${userId} (${code || msg.slice(0, 80)})`
            );
        }
    }
    const customer = await stripe.customers.create({
        email: email || `user_${userId}@dinebuddies.com`,
        metadata: { firebaseUID: userId },
    });
    await db.collection('users').doc(userId).set({ stripeCustomerId: customer.id }, { merge: true });
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

    const { priceId, planId, planName } = data;
    const userId = context.auth.uid;

    if (!priceId) {
        throw new functions.https.HttpsError(
            'invalid-argument',
            'Price ID is required'
        );
    }

    try {
        const stripe = getStripe();
        const userDoc = await db.collection('users').doc(userId).get();
        const stored = userDoc.exists ? userDoc.data().stripeCustomerId : null;
        const customerId = await resolveStripeCustomerId(
            stripe,
            userId,
            context.auth.token.email,
            stored
        );

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
                planId: planId,
                planName: planName,
                subscriptionKind: data.subscriptionKind === 'business' ? 'business' : 'consumer',
            }
        });

        console.log(`✅ Checkout session created for user ${userId}: ${session.id}`);

        return {
            sessionId: session.id,
            url: session.url
        };

    } catch (error) {
        console.error('Stripe Error:', error);
        if (error && error.code === 'STRIPE_NOT_CONFIGURED') {
            throw new functions.https.HttpsError('failed-precondition', error.message);
        }
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
        const stripe = getStripe();
        const userDoc = await db.collection('users').doc(context.auth.uid).get();

        if (!userDoc.exists) {
            throw new functions.https.HttpsError('not-found', 'User not found');
        }

        const stored = userDoc.data().stripeCustomerId;
        if (!stored) {
            throw new functions.https.HttpsError('not-found', 'No customer found');
        }
        const customerId = await resolveStripeCustomerId(
            stripe,
            context.auth.uid,
            context.auth.token.email,
            stored
        );

        const session = await stripe.billingPortal.sessions.create({
            customer: customerId,
            return_url: data.returnUrl,
        });

        return { url: session.url };
    } catch (error) {
        console.error('Portal Error:', error);
        if (error && error.code === 'STRIPE_NOT_CONFIGURED') {
            throw new functions.https.HttpsError('failed-precondition', error.message);
        }
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
        const stripe = getStripe();
        const userDoc = await db.collection('users').doc(userId).get();
        const stored = userDoc.exists ? userDoc.data().stripeCustomerId : null;
        const customerId = await resolveStripeCustomerId(
            stripe,
            userId,
            context.auth.token.email,
            stored
        );

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
        if (error && error.code === 'STRIPE_NOT_CONFIGURED') {
            throw new functions.https.HttpsError('failed-precondition', error.message);
        }
        throw new functions.https.HttpsError('internal', error.message || 'Checkout failed');
    }
});

/**
 * Fallback when Stripe webhooks are not configured: client calls after redirect with session_id.
 * Idempotent — same session only grants once (shared doc with webhook path).
 */
exports.fulfillDineCreditsCheckout = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Sign in required');
    }
    const sessionId = String(data?.sessionId || '').trim();
    if (!sessionId || !sessionId.startsWith('cs_')) {
        throw new functions.https.HttpsError('invalid-argument', 'Invalid session id');
    }

    try {
        const stripe = getStripe();
        const session = await stripe.checkout.sessions.retrieve(sessionId);

        if (session.metadata?.userId !== context.auth.uid) {
            throw new functions.https.HttpsError(
                'permission-denied',
                'This purchase belongs to another account'
            );
        }
        if (session.mode !== 'payment' || session.metadata?.purchaseType !== 'dine_credits') {
            throw new functions.https.HttpsError(
                'failed-precondition',
                'Not a Dine credits purchase'
            );
        }
        if (session.payment_status !== 'paid') {
            throw new functions.https.HttpsError(
                'failed-precondition',
                'Payment is not complete yet'
            );
        }

        const result = await fulfillDineCreditsFromCheckoutSession(db, admin, session);
        if (!result.ok) {
            throw new functions.https.HttpsError(
                'internal',
                'Could not add credits. If this persists, contact support with your payment receipt.'
            );
        }
        return { success: true, credits: result.credits };
    } catch (error) {
        if (error instanceof functions.https.HttpsError) throw error;
        console.error('fulfillDineCreditsCheckout:', error);
        if (error && error.code === 'STRIPE_NOT_CONFIGURED') {
            throw new functions.https.HttpsError('failed-precondition', error.message);
        }
        throw new functions.https.HttpsError('internal', error.message || 'Fulfillment failed');
    }
});
