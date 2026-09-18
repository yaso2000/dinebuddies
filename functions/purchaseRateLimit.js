/**
 * Per-user velocity guard for money-in actions (credit-purchase session/order
 * creation). Slows down stolen-card testing and purchase abuse without blocking
 * legitimate buyers. Server-written only (purchase_rate_limits is Admin-SDK
 * only via the catch-all rule), so clients cannot tamper with it.
 */
const admin = require('firebase-admin');
const functions = require('firebase-functions');

if (!admin.apps.length) {
    admin.initializeApp();
}
const db = admin.firestore();

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/**
 * @param {string} uid
 * @param {string} bucket  logical action name, e.g. 'credits_checkout'
 * @param {{ perHour?: number, perDay?: number }} [limits]
 */
async function enforcePurchaseRateLimit(uid, bucket, { perHour = 10, perDay = 30 } = {}) {
    if (!uid) return;
    const ref = db.collection('purchase_rate_limits').doc(`${uid}_${bucket}`);
    const now = Date.now();

    await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        const d = snap.exists ? snap.data() || {} : {};

        const hourActive = now - (Number(d.hourStart) || 0) <= HOUR_MS;
        const dayActive = now - (Number(d.dayStart) || 0) <= DAY_MS;

        const hourStart = hourActive ? Number(d.hourStart) : now;
        const dayStart = dayActive ? Number(d.dayStart) : now;
        const hourCount = hourActive ? Number(d.hourCount) || 0 : 0;
        const dayCount = dayActive ? Number(d.dayCount) || 0 : 0;

        if (hourCount >= perHour || dayCount >= perDay) {
            throw new functions.https.HttpsError(
                'resource-exhausted',
                'Too many purchase attempts. Please wait a bit and try again.'
            );
        }

        tx.set(
            ref,
            {
                hourStart,
                hourCount: hourCount + 1,
                dayStart,
                dayCount: dayCount + 1,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
        );
    });
}

module.exports = { enforcePurchaseRateLimit };
