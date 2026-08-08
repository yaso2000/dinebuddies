const functions = require('firebase-functions');

/**
 * Business partner_notifications → in-app mirror + immediate FCM.
 */
function registerPartnerNotificationInbox(exports, { db, admin, sendPushToUser }) {
    if (typeof sendPushToUser !== 'function') {
        throw new Error('registerPartnerNotificationInbox: sendPushToUser is required');
    }

    exports.onPartnerNotificationCreated = functions.firestore
        .document('partner_notifications/{notifId}')
        .onCreate(async (snap) => {
            const data = snap.data() || {};
            const restaurantId =
                typeof data.restaurantId === 'string' ? data.restaurantId.trim() : '';
            if (!restaurantId) return null;

            let actionUrl =
                typeof data.actionUrl === 'string' && data.actionUrl.trim()
                    ? data.actionUrl.trim()
                    : '/business-dashboard';
            if (data.invitationId && data.type === 'new_booking') {
                actionUrl = `/invitation/${data.invitationId}`;
            } else if (data.type === 'business_feedback') {
                actionUrl = '/business-dashboard#business-notifications';
            }

            const title =
                typeof data.title === 'string' && data.title.trim()
                    ? data.title.trim().slice(0, 120)
                    : 'DineBuddies';
            const message =
                typeof data.message === 'string' && data.message.trim()
                    ? data.message.trim().slice(0, 500)
                    : '';

            const inboxId = `partner_${snap.id}`;
            const senderAvatar =
                data.fromUserAvatar || data.senderAvatar || data.senderPhoto || '';

            const pushResult = await sendPushToUser(restaurantId, title, message, {
                actionUrl,
                type: data.type || 'new_booking',
                senderAvatar,
                notifId: inboxId,
            });

            functions.logger.info(
                `onPartnerNotificationCreated uid=${restaurantId} push=${pushResult.delivered} reason=${pushResult.reason || 'ok'}`
            );

            const inboxRef = db.collection('notifications').doc(inboxId);
            const inboxExisting = await inboxRef.get();
            if (!inboxExisting.exists) {
                await inboxRef.set({
                    userId: restaurantId,
                    type: data.type || 'new_booking',
                    title,
                    message,
                    actionUrl,
                    invitationId: data.invitationId || null,
                    fromUserId: data.senderId || null,
                    fromUserName: data.fromUserName || null,
                    fromUserAvatar: senderAvatar || null,
                    senderId: data.senderId || null,
                    senderName: data.fromUserName || null,
                    senderAvatar: senderAvatar || null,
                    metadata: {
                        partnerNotificationId: snap.id,
                        partnerId: restaurantId,
                    },
                    _pushDelivered: pushResult.delivered === true,
                    read: false,
                    createdAt:
                        data.timestamp ||
                        data.createdAt ||
                        admin.firestore.FieldValue.serverTimestamp(),
                });
            }

            return null;
        });
}

module.exports = { registerPartnerNotificationInbox };
