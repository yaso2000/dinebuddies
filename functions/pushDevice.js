const functions = require('firebase-functions');

/**
 * Reliable FCM token save (admin SDK) + self-test push for debugging iPhone delivery.
 */
function registerPushDevice(exports, { db, admin, sendPushToUser }) {
    exports.registerFcmDeviceToken = functions.https.onCall(async (data, context) => {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'Authentication required.');
        }
        const uid = context.auth.uid;
        const token = typeof data?.token === 'string' ? data.token.trim() : '';
        if (!token || token.length < 80) {
            throw new functions.https.HttpsError('invalid-argument', 'Invalid FCM token.');
        }

        const userRef = db.collection('users').doc(uid);
        await userRef.set(
            { fcmTokens: admin.firestore.FieldValue.arrayUnion(token) },
            { merge: true }
        );

        const snap = await userRef.get();
        const tokens = snap.exists ? snap.data()?.fcmTokens || [] : [];
        functions.logger.info(`registerFcmDeviceToken uid=${uid} count=${tokens.length}`);

        return {
            ok: true,
            tokenCount: tokens.length,
        };
    });

    exports.sendTestPushToMe = functions.https.onCall(async (data, context) => {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'Authentication required.');
        }
        const uid = context.auth.uid;
        const userSnap = await db.collection('users').doc(uid).get();
        const tokens = userSnap.exists ? userSnap.data()?.fcmTokens || [] : [];
        const tokenCount = [...new Set(tokens.map((t) => String(t).trim()).filter(Boolean))].length;

        if (tokenCount === 0) {
            return {
                ok: false,
                reason: 'no_tokens',
                tokenCount: 0,
                message: 'No device token saved. Enable push from the Home Screen app first.',
            };
        }

        const notifId = `test_${Date.now()}`;
        const pushResult = await sendPushToUser(uid, 'DineBuddies test', 'If you see this, push works on your iPhone.', {
            actionUrl: '/settings/notifications',
            type: 'message',
            notifId,
        });

        return {
            ok: pushResult.delivered === true,
            tokenCount,
            notifId,
            pushDelivered: pushResult.delivered === true,
            fcmSuccessCount: pushResult.successCount || 0,
            fcmErrors: pushResult.fcmErrors || [],
            hint:
                pushResult.delivered === true
                    ? 'FCM accepted the message. If no banner: lock screen, Home Screen PWA only, then run SW self-test.'
                    : pushResult.reason === 'prefs_blocked'
                      ? 'Push disabled in app settings or Do Not Disturb.'
                      : pushResult.reason === 'no_tokens'
                        ? 'No fcmTokens on user doc.'
                        : 'FCM rejected token — re-enable push on device.',
        };
    });
}

module.exports = { registerPushDevice };
