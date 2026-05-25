const functions = require('firebase-functions');

const FCM_SITE_ORIGIN = 'https://www.dinebuddies.com';
const FCM_DEFAULT_ICON = `${FCM_SITE_ORIGIN}/icon-light-192.png`;

function fcmAbsoluteAppUrl(pathOrUrl) {
    const raw = String(pathOrUrl || '/').trim() || '/';
    if (/^https:\/\//i.test(raw)) {
        try {
            return new URL(raw).href;
        } catch {
            return `${FCM_SITE_ORIGIN}/`;
        }
    }
    const path = raw.startsWith('/') ? raw : `/${raw}`;
    return `${FCM_SITE_ORIGIN}${path}`;
}

function fcmSafeIconUrl(maybeUrl) {
    if (!maybeUrl || typeof maybeUrl !== 'string') return FCM_DEFAULT_ICON;
    const t = maybeUrl.trim();
    if (!/^https:\/\//i.test(t)) return FCM_DEFAULT_ICON;
    try {
        const u = new URL(t);
        return u.protocol === 'https:' ? t : FCM_DEFAULT_ICON;
    } catch {
        return FCM_DEFAULT_ICON;
    }
}

function createPushMessaging({ db, admin }) {
    async function userAllowsPush(userId) {
        try {
            const prefSnap = await db
                .collection('users')
                .doc(userId)
                .collection('preferences')
                .doc('notifications')
                .get();
            if (!prefSnap.exists) return true;
            const prefs = prefSnap.data() || {};
            if (prefs.pushEnabled === false) return false;
            const dnd = prefs.doNotDisturb;
            if (dnd && dnd.enabled && dnd.startTime && dnd.endTime) {
                const now = new Date();
                const pad = (n) => String(n).padStart(2, '0');
                const cur = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
                const start = String(dnd.startTime);
                const end = String(dnd.endTime);
                const inQuiet =
                    start <= end ? cur >= start && cur < end : cur >= start || cur < end;
                if (inQuiet) return false;
            }
            return true;
        } catch (e) {
            functions.logger.warn('userAllowsPush read failed:', userId, e.message);
            return true;
        }
    }

    /**
     * @returns {Promise<{ delivered: boolean, successCount: number, reason?: string }>}
     */
    async function sendPushToUser(userId, title, body, data = {}) {
        if (!userId) return { delivered: false, successCount: 0, reason: 'no_uid' };

        if (!(await userAllowsPush(userId))) {
            functions.logger.info(`sendPushToUser skipped (push off / DND) uid=${userId}`);
            return { delivered: false, successCount: 0, reason: 'prefs_blocked' };
        }

        const safeTitle =
            title != null && String(title).trim() !== '' ? String(title).trim() : 'DineBuddies';
        const safeBody = body != null ? String(body) : '';

        try {
            const userSnap = await db.collection('users').doc(userId).get();
            if (!userSnap.exists) {
                return { delivered: false, successCount: 0, reason: 'no_user_doc' };
            }
            const rawTokens = userSnap.data()?.fcmTokens || [];
            const tokens = [...new Set(rawTokens.map((t) => String(t).trim()).filter(Boolean))];
            if (!tokens.length) {
                functions.logger.warn(`sendPushToUser: no fcmTokens uid=${userId}`);
                return { delivered: false, successCount: 0, reason: 'no_tokens' };
            }

            const actionUrlAbs = fcmAbsoluteAppUrl(data.actionUrl || '/');
            const cardImage = fcmSafeIconUrl(data.cardImageUrl);
            const iconToUse = cardImage !== FCM_DEFAULT_ICON ? cardImage : fcmSafeIconUrl(data.senderAvatar);
            const notifTag =
                data.notifId != null && String(data.notifId).trim() !== ''
                    ? `db-notif-${String(data.notifId)}`
                    : 'db-push';

            // Data-only web push — SW onBackgroundMessage shows the OS banner (avoids duplicate with webpush.notification).
            const dataStrings = Object.fromEntries(
                Object.entries({
                    title: safeTitle,
                    body: safeBody,
                    icon: iconToUse,
                    badge: FCM_DEFAULT_ICON,
                    url: actionUrlAbs,
                    actionUrl: actionUrlAbs,
                    type: data.type || '',
                    senderAvatar: data.senderAvatar ? String(data.senderAvatar) : '',
                    notifId: data.notifId != null ? String(data.notifId) : '',
                    tag: notifTag,
                })
                    .filter(([, v]) => v != null && String(v).trim() !== '')
                    .map(([k, v]) => [k, String(v)])
            );

            const webpushCfg = {
                fcmOptions: { link: actionUrlAbs },
                headers: { Urgency: 'high' },
            };

            let totalSuccess = 0;
            const expiredTokens = [];
            const fcmErrors = [];
            const MULTICAST_MAX = 500;

            for (let offset = 0; offset < tokens.length; offset += MULTICAST_MAX) {
                const chunk = tokens.slice(offset, offset + MULTICAST_MAX);
                const response = await admin.messaging().sendEachForMulticast({
                    tokens: chunk,
                    webpush: webpushCfg,
                    data: dataStrings,
                });

                totalSuccess += response.successCount || 0;
                functions.logger.info(
                    `sendPushToUser uid=${userId} type=${data.type || ''} ok=${response.successCount}/${chunk.length}`
                );

                response.responses.forEach((r) => {
                    if (!r.success) {
                        fcmErrors.push(r.error?.code || r.error?.message || 'unknown');
                    }
                });

                if ((response.successCount || 0) === 0 && chunk.length > 0) {
                    functions.logger.warn(
                        `sendPushToUser 0/${chunk.length} uid=${userId}`,
                        [...new Set(fcmErrors)].join(' | ')
                    );
                }

                response.responses.forEach((r, i) => {
                    if (r.success) return;
                    const code = r.error?.code;
                    if (
                        code === 'messaging/invalid-registration-token' ||
                        code === 'messaging/registration-token-not-registered' ||
                        code === 'messaging/unregistered' ||
                        code === 'messaging/invalid-web-push-token' ||
                        code === 'messaging/web-push-token-expired' ||
                        code === 'messaging/web-push-auth-error' ||
                        code === 'messaging/third-party-auth-error'
                    ) {
                        expiredTokens.push(chunk[i]);
                    }
                });
            }

            const uniqExpired = [...new Set(expiredTokens)];
            for (let i = 0; i < uniqExpired.length; i += 30) {
                const part = uniqExpired.slice(i, i + 30);
                await db.collection('users').doc(userId).update({
                    fcmTokens: admin.firestore.FieldValue.arrayRemove(...part),
                });
            }

            return {
                delivered: totalSuccess > 0,
                successCount: totalSuccess,
                tokenCount: tokens.length,
                fcmErrors: [...new Set(fcmErrors)].slice(0, 8),
                reason: totalSuccess > 0 ? undefined : 'fcm_failed',
            };
        } catch (err) {
            functions.logger.warn('sendPushToUser failed:', userId, err.message);
            return { delivered: false, successCount: 0, reason: err.message };
        }
    }

    function registerNotificationPushTrigger(exports) {
        exports.onNotificationCreated = functions.firestore
            .document('notifications/{notifId}')
            .onCreate(async (snap) => {
                const data = snap.data() || {};
                const userId = data.userId;
                if (!userId) return null;

                // Partner mirror / createNotification already sent push — avoid duplicate FCM delivery.
                if (data._pushDelivered === true) {
                    functions.logger.info(
                        `onNotificationCreated skip (already pushed) id=${snap.id}`
                    );
                    return null;
                }

                const result = await sendPushToUser(userId, data.title || 'DineBuddies', data.message || '', {
                    actionUrl: data.actionUrl || '/',
                    type: data.type || '',
                    senderAvatar:
                        data.senderAvatar || data.fromUserAvatar || data.senderPhoto || '',
                    cardImageUrl: data.cardImageUrl || data.metadata?.cardImageUrl || null,
                    notifId: snap.id,
                });

                if (result.delivered) {
                    await snap.ref.set(
                        { _pushDelivered: true, _pushDeliveredAt: admin.firestore.FieldValue.serverTimestamp() },
                        { merge: true }
                    );
                }
                return null;
            });
    }

    return { sendPushToUser, userAllowsPush, registerNotificationPushTrigger };
}

module.exports = { createPushMessaging, FCM_SITE_ORIGIN, FCM_DEFAULT_ICON };
