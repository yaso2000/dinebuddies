/**
 * Self-service account lifecycle: deactivate (freeze), scheduled soft-delete
 * (30-day grace, TikTok-style), restore, and the daily purge of expired requests.
 *
 * State lives on `users/{uid}`:
 *   accountState: 'active' | 'deactivated' | 'pending_deletion'
 *   deactivatedAt: Timestamp        (freeze)
 *   deletionRequestedAt: Timestamp  (soft-delete requested)
 *   scheduledPurgeAt: Timestamp     (deletionRequestedAt + GRACE_DAYS)
 *
 * `deactivated` and `pending_deletion` both hide the account everywhere
 * (via isConsumerHiddenUserDoc → syncPublicProfileOnUserWrite drops the
 * public_profiles projection). Data + credits are preserved until an actual
 * purge. Logging back in restores the account (cancels a pending deletion).
 * After the grace window with no login, the daily job permanently purges.
 */
const functions = require('firebase-functions');
const { purgeUserAccountData } = require('./accountDeletionCore');

const GRACE_DAYS = 30;

/**
 * @param {object} exportsObj
 * @param {{ admin: typeof import('firebase-admin') }} deps
 */
function registerAccountLifecycle(exportsObj, { admin }) {
    const db = admin.firestore();

    const requireUid = (context) => {
        if (!context.auth?.uid) {
            throw new functions.https.HttpsError('unauthenticated', 'Sign in required');
        }
        return context.auth.uid;
    };

    /** Freeze: hide the account entirely; everything (incl. credits) is preserved. */
    exportsObj.deactivateMyAccount = functions.https.onCall(async (_data, context) => {
        const uid = requireUid(context);
        await db.collection('users').doc(uid).set(
            {
                accountState: 'deactivated',
                deactivatedAt: admin.firestore.FieldValue.serverTimestamp(),
                deletionRequestedAt: admin.firestore.FieldValue.delete(),
                scheduledPurgeAt: admin.firestore.FieldValue.delete(),
            },
            { merge: true }
        );
        // Force sign-out on all sessions so the account stays hidden until the user returns.
        await admin.auth().revokeRefreshTokens(uid).catch(() => {});
        return { ok: true, accountState: 'deactivated' };
    });

    /** Request deletion: hide now, schedule permanent purge after the grace window. */
    exportsObj.requestAccountDeletion = functions.https.onCall(async (_data, context) => {
        const uid = requireUid(context);
        const purgeMs = Date.now() + GRACE_DAYS * 24 * 60 * 60 * 1000;
        const scheduledPurgeAt = admin.firestore.Timestamp.fromMillis(purgeMs);
        await db.collection('users').doc(uid).set(
            {
                accountState: 'pending_deletion',
                deletionRequestedAt: admin.firestore.FieldValue.serverTimestamp(),
                scheduledPurgeAt,
                deactivatedAt: admin.firestore.FieldValue.delete(),
            },
            { merge: true }
        );
        await admin.auth().revokeRefreshTokens(uid).catch(() => {});
        return { ok: true, accountState: 'pending_deletion', graceDays: GRACE_DAYS, scheduledPurgeAtMs: purgeMs };
    });

    /** Restore: reactivate a frozen account / cancel a pending deletion (on the user's return). */
    exportsObj.restoreMyAccount = functions.https.onCall(async (_data, context) => {
        const uid = requireUid(context);
        await db.collection('users').doc(uid).set(
            {
                accountState: 'active',
                reactivatedAt: admin.firestore.FieldValue.serverTimestamp(),
                deactivatedAt: admin.firestore.FieldValue.delete(),
                deletionRequestedAt: admin.firestore.FieldValue.delete(),
                scheduledPurgeAt: admin.firestore.FieldValue.delete(),
            },
            { merge: true }
        );
        return { ok: true, accountState: 'active' };
    });

    /**
     * Daily purge: permanently delete accounts whose grace window elapsed without
     * a return login (scheduledPurgeAt is cleared by restoreMyAccount, so anyone
     * who came back is not matched). Single-field range filter → auto-indexed.
     */
    exportsObj.purgeScheduledAccountDeletions = functions
        .runWith({ timeoutSeconds: 540, memory: '1GB' })
        .pubsub.schedule('every 24 hours')
        .onRun(async () => {
            const now = admin.firestore.Timestamp.now();
            const snap = await db
                .collection('users')
                .where('scheduledPurgeAt', '<=', now)
                .limit(200)
                .get();

            let purged = 0;
            for (const d of snap.docs) {
                const data = d.data() || {};
                if (data.accountState !== 'pending_deletion') continue; // safety guard
                try {
                    await purgeUserAccountData(admin, d.id, { deleteAuthUser: true });
                    purged += 1;
                } catch (err) {
                    functions.logger.error('scheduled account purge failed', {
                        uid: d.id,
                        message: err.message,
                    });
                }
            }
            functions.logger.info('purgeScheduledAccountDeletions', { candidates: snap.size, purged });
            return null;
        });
}

module.exports = { registerAccountLifecycle, GRACE_DAYS };
