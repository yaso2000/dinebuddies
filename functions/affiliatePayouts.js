/**
 * Affiliate payout requests: move available balance into pending_payouts until ops completes payout.
 */
const functions = require('firebase-functions');
const admin = require('firebase-admin');

const db = admin.firestore();

/**
 * Full-balance payout request (available → pending).
 * Requires Firebase Auth emailVerified.
 */
const requestAffiliatePayout = functions.https.onCall(async (data, context) => {
    if (!context.auth?.uid) {
        throw new functions.https.HttpsError('unauthenticated', 'Sign in required.');
    }
    const uid = context.auth.uid;

    let authUser;
    try {
        authUser = await admin.auth().getUser(uid);
    } catch (e) {
        functions.logger.warn('[requestAffiliatePayout] getUser', e?.message || e);
        throw new functions.https.HttpsError('not-found', 'User not found.');
    }
    if (authUser.emailVerified !== true) {
        throw new functions.https.HttpsError(
            'failed-precondition',
            'Verify your email before requesting a payout.'
        );
    }

    const payoutRef = db.collection('payout_requests').doc();

    await db.runTransaction(async (t) => {
        const userRef = db.collection('users').doc(uid);
        const uSnap = await t.get(userRef);
        if (!uSnap.exists) {
            throw new functions.https.HttpsError('failed-precondition', 'Profile not found.');
        }
        const u = uSnap.data() || {};
        if (String(u.role || '').toLowerCase() !== 'affiliate_agent') {
            throw new functions.https.HttpsError('permission-denied', 'Not an affiliate account.');
        }

        const balance = Math.floor(Number(u.current_balance) || 0);
        if (balance <= 0) {
            throw new functions.https.HttpsError('failed-precondition', 'No available balance to withdraw.');
        }

        const paypalSnapshot =
            typeof u.affiliate_paypal_email === 'string' && u.affiliate_paypal_email.trim()
                ? String(u.affiliate_paypal_email).trim().toLowerCase()
                : null;
        if (!paypalSnapshot) {
            throw new functions.https.HttpsError(
                'failed-precondition',
                'Add a PayPal email in Affiliate settings before requesting a payout.'
            );
        }

        t.set(payoutRef, {
            agentUid: uid,
            status: 'pending',
            amountCents: balance,
            currency: String(u.payout_currency || 'usd').toLowerCase() || 'usd',
            paypalEmailSnapshot: paypalSnapshot,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        t.update(userRef, {
            current_balance: admin.firestore.FieldValue.increment(-balance),
            pending_payouts: admin.firestore.FieldValue.increment(balance),
        });
    });

    functions.logger.info('[requestAffiliatePayout] created', { uid, payoutId: payoutRef.id });
    return { ok: true, payoutRequestId: payoutRef.id };
});

module.exports = {
    requestAffiliatePayout,
};
