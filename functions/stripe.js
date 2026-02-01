const functions = require('firebase-functions');
const admin = require('firebase-admin');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

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

    const { priceId, planId, planName } = data;
    const userId = context.auth.uid;

    if (!priceId) {
        throw new functions.https.HttpsError(
            'invalid-argument',
            'Price ID is required'
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
                planName: planName
            }
        });

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
