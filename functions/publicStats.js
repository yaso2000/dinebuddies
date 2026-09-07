/**
 * Public marketing stats for the corporate page (/company).
 *
 * A single PUBLIC document `stats/public` holds live counts that the static
 * corporate page reads (unauthenticated, via a public read rule). Counts are
 * kept fresh two ways:
 *   - live triggers: a new member (users/{uid} onCreate) bumps usersCount, and
 *     each public invitation created bumps a CUMULATIVE publicInvitationsCount
 *     (public invites auto-delete, so we count creations all-time, never
 *     decrementing);
 *   - a scheduled recompute every 6 hours reconciles usersCount and recounts the
 *     partner venues by type (aggregation queries), leaving the cumulative
 *     invitation counter untouched.
 */
const functions = require('firebase-functions');

const STATS_DOC_PATH = 'stats/public';

// [businessPublic.businessType, stats field]
const BUSINESS_TYPE_FIELDS = [
    ['Restaurant', 'restaurantsCount'],
    ['Cafe', 'cafesCount'],
    ['Bar', 'barsCount'],
    ['Night Club', 'nightclubsCount'],
    ['Hotel', 'hotelsCount'],
    ['Food Truck', 'foodTrucksCount'],
    ['Fast Food', 'fastFoodCount'],
];

/** Recount members + published partner venues via aggregation queries. */
async function computePublicStats(db) {
    const usersCount = (
        await db.collection('users').where('role', '==', 'user').count().get()
    ).data().count;

    const publishedBiz = db
        .collection('public_profiles')
        .where('profileType', '==', 'business')
        .where('businessPublic.isPublished', '==', true);

    const businessesCount = (await publishedBiz.count().get()).data().count;

    const out = { usersCount, businessesCount };
    for (const [businessType, field] of BUSINESS_TYPE_FIELDS) {
        out[field] = (
            await publishedBiz.where('businessPublic.businessType', '==', businessType).count().get()
        ).data().count;
    }
    return out;
}

function registerPublicStats(exportsObj, { admin, assertAdminContext } = {}) {
    const db = admin.firestore();
    const FieldValue = admin.firestore.FieldValue;
    const statsRef = () => db.doc(STATS_DOC_PATH);

    async function writeComputed() {
        const stats = await computePublicStats(db);
        await statsRef().set(
            { ...stats, updatedAt: FieldValue.serverTimestamp() },
            { merge: true }
        );
        // Make sure the cumulative invitation counter exists without clobbering it.
        await statsRef().set(
            { publicInvitationsCount: FieldValue.increment(0) },
            { merge: true }
        );
        return stats;
    }

    // Reconcile every 6 hours.
    exportsObj.recomputePublicStats = functions.pubsub
        .schedule('every 6 hours')
        .onRun(async () => {
            await writeComputed();
            return null;
        });

    // Live member counter — a new consumer signing up ticks the number up.
    exportsObj.onUserJoinedPublicStats = functions.firestore
        .document('users/{uid}')
        .onCreate(async (snap) => {
            const d = snap.data() || {};
            const role = String(d.role || 'user').toLowerCase();
            if (role === 'business' || role === 'partner' || d.isBusiness === true || d.isGuest === true) {
                return null;
            }
            await statsRef().set({ usersCount: FieldValue.increment(1) }, { merge: true });
            return null;
        });

    // Cumulative public-invitation counter (public invites auto-delete, so this is
    // an all-time "created" total that only ever grows).
    exportsObj.onPublicInvitationCreatedStats = functions.firestore
        .document('invitations/{id}')
        .onCreate(async () => {
            await statsRef().set({ publicInvitationsCount: FieldValue.increment(1) }, { merge: true });
            return null;
        });

    // Admin: recompute on demand.
    exportsObj.refreshPublicStats = functions.https.onCall(async (data, context) => {
        if (typeof assertAdminContext === 'function') {
            await assertAdminContext(context);
        } else if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'Sign in required.');
        }
        const stats = await writeComputed();
        return { ok: true, stats };
    });
}

module.exports = { registerPublicStats, computePublicStats, STATS_DOC_PATH };
