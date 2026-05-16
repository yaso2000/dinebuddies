'use strict';

const { grantPaidCreditsInTransaction, isBusinessUserDoc } = require('./creditsCore');

/**
 * Idempotently grant Dine credits after a paid Checkout session (payment + dine_credits metadata).
 * Used by Stripe webhook and by client-triggered fulfillment fallback.
 *
 * @param {FirebaseFirestore.Firestore} db
 * @param {typeof import('firebase-admin')} admin
 * @param {Record<string, unknown>} session — Stripe Checkout Session object
 */
async function fulfillDineCreditsFromCheckoutSession(db, admin, session) {
    const userId = session.metadata?.userId;
    const credits = Math.floor(Number(session.metadata?.credits));
    const packageId = String(session.metadata?.packageId || '');

    if (!userId || !Number.isFinite(credits) || credits <= 0) {
        console.error('Invalid dine credits checkout metadata', session.metadata);
        return { ok: false, reason: 'invalid_metadata', credits: 0, userId: null };
    }

    const fulfillRef = db.collection('stripe_dine_credit_fulfillments').doc(session.id);
    const userRef = db.collection('users').doc(userId);

    let fulfilled = false;
    await db.runTransaction(async (tx) => {
        const done = await tx.get(fulfillRef);
        if (done.exists) {
            fulfilled = true;
            return;
        }

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
        fulfilled = true;
    });

    if (fulfilled) {
        console.log(`✅ Granted ${credits} dine credits to ${userId} (session ${session.id})`);
    }
    return { ok: fulfilled, credits, userId };
}

module.exports = { fulfillDineCreditsFromCheckoutSession };
