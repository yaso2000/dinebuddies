/**
 * Callable + Auth trigger for full account deletion cascade.
 */
const functions = require('firebase-functions');
const { purgeUserAccountData } = require('./accountDeletionCore');

/**
 * @param {object} exportsObj
 * @param {{
 *   admin: typeof import('firebase-admin'),
 *   enforceCallableRateLimit?: Function,
 * }} deps
 */
function registerAccountDeletion(exportsObj, { admin, enforceCallableRateLimit }) {
    exportsObj.deleteMyAccount = functions
        .runWith({ timeoutSeconds: 540, memory: '1GB' })
        .https.onCall(async (_data, context) => {
            if (!context.auth?.uid) {
                throw new functions.https.HttpsError('unauthenticated', 'Authentication required.');
            }
            const uid = context.auth.uid;

            if (typeof enforceCallableRateLimit === 'function') {
                await enforceCallableRateLimit(uid, 'delete_my_account', {
                    perMinute: 2,
                    perHour: 5,
                    perDay: 10,
                    cooldownMs: 5000,
                });
            }

            const stats = await purgeUserAccountData(admin, uid, { deleteAuthUser: true });
            return { success: true, uid, stats };
        });

    // Backup: if Auth user is deleted first (or by Admin Console), finish Firestore/storage cleanup.
    exportsObj.onAuthUserDeleted = functions.auth.user().onDelete(async (user) => {
        const uid = user.uid;
        try {
            await purgeUserAccountData(admin, uid, { deleteAuthUser: false });
        } catch (err) {
            functions.logger.error('onAuthUserDeleted purge failed', { uid, message: err.message });
        }
        return null;
    });
}

module.exports = { registerAccountDeletion };
