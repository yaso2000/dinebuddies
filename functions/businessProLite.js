const functions = require('firebase-functions');
const { spendCreditsInTransaction } = require('./creditsCore');

/**
 * Credit-based "Pro Lite" pass — a business spends Dine Credits to unlock a small
 * set of practical features (delivery links, special offers, Stage) for a fixed
 * window. Pay-on-demand, non-recurring; coexists with the full $29 subscription.
 * Client mirror: src/config/businessPlanFeatures.js (BUSINESS_PRO_LITE / getBusinessProAccess).
 */
const PRO_LITE_CREDIT_COST = 2000;
const PRO_LITE_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/** Milliseconds of a stored Timestamp-ish value, or 0. */
function toMs(v) {
    if (!v) return 0;
    if (typeof v.toDate === 'function') return v.toDate().getTime();
    if (typeof v.seconds === 'number') return v.seconds * 1000;
    if (typeof v === 'number') return v;
    const p = Date.parse(String(v));
    return Number.isFinite(p) ? p : 0;
}

/** Server-side entitlement check for the Pro-Lite features (tier OR active pass). */
function businessHasProLite(userData) {
    return toMs(userData && userData.businessProLiteUntil) > Date.now();
}

function registerBusinessProLite(exports, { db, admin, enforceCallableRateLimit }) {
    if (typeof enforceCallableRateLimit !== 'function') {
        throw new Error('registerBusinessProLite: enforceCallableRateLimit is required');
    }

    exports.activateBusinessProLiteWithCredits = functions.https.onCall(async (data, context) => {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'Please sign in.');
        }
        const uid = context.auth.uid;

        await enforceCallableRateLimit(uid, 'business_pro_lite_activate', {
            cooldownMs: 5000,
            perHour: 10,
            perDay: 30,
        });

        const userRef = db.collection('users').doc(uid);
        let newUntilMs = 0;
        try {
            await db.runTransaction(async (tx) => {
                const snap = await tx.get(userRef);
                const u = snap.exists ? snap.data() || {} : {};
                const role = String(u.role || u.accountType || '').toLowerCase();
                const isBusiness =
                    role === 'business' || role === 'partner' || String(u.accountType || '').toLowerCase() === 'business';
                if (!isBusiness) {
                    throw new functions.https.HttpsError('permission-denied', 'Only a business account can activate this pass.');
                }
                // Extend from the later of "now" or the current expiry (stacking).
                const base = Math.max(Date.now(), toMs(u.businessProLiteUntil));
                newUntilMs = base + PRO_LITE_DURATION_MS;

                spendCreditsInTransaction(tx, userRef, u, {
                    uid,
                    accountRole: 'business',
                    amount: PRO_LITE_CREDIT_COST,
                    type: 'business_pro_lite',
                    reason: 'business_pro_lite',
                    allowSavedCredits: true,
                });

                tx.set(
                    userRef,
                    {
                        businessProLiteUntil: admin.firestore.Timestamp.fromMillis(newUntilMs),
                        businessProLiteActivatedAt: admin.firestore.FieldValue.serverTimestamp(),
                    },
                    { merge: true }
                );
            });
        } catch (err) {
            if (err instanceof functions.https.HttpsError) throw err;
            if (err && err.code === 'INSUFFICIENT_CREDITS') {
                throw new functions.https.HttpsError('failed-precondition', 'INSUFFICIENT_CREDITS');
            }
            console.error('[activateBusinessProLiteWithCredits]', err);
            throw new functions.https.HttpsError('internal', 'Could not activate the pass.');
        }

        // Mirror onto the public profile so visitor-facing feature gates see it.
        try {
            await db.collection('public_profiles').doc(uid).set(
                { businessProLiteUntil: admin.firestore.Timestamp.fromMillis(newUntilMs) },
                { merge: true }
            );
        } catch (e) {
            console.warn('[activateBusinessProLiteWithCredits] public sync:', e && e.message);
        }

        return { ok: true, businessProLiteUntil: newUntilMs, creditCost: PRO_LITE_CREDIT_COST };
    });
}

module.exports = { registerBusinessProLite, businessHasProLite, PRO_LITE_CREDIT_COST };
