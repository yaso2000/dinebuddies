/**
 * Paid business → community members: chat DM + inbox notification (FCM via onNotificationCreated).
 */
const functions = require('firebase-functions');
const {
    resolveCommunityOwner,
    isCommunityOwnerBusiness,
    isCommunityOwnerRequester,
    collectCommunityMemberIds,
} = require('./communityOwner');
const { normalizeBusinessSubscriptionTier } = require('./creditsCore');

const MAX_TARGETS = 50;
const MESSAGE_MAX_LEN = 500;

function asTrimmedString(v) {
    return typeof v === 'string' ? v.trim() : '';
}

function conversationIdFor(uidA, uidB) {
    return [uidA, uidB].sort().join('_');
}

/**
 * @param {object} exportsObj
 * @param {{ db: FirebaseFirestore.Firestore, admin: typeof import('firebase-admin') }} deps
 */
function registerCommunityMemberBroadcast(exportsObj, { db, admin }) {
    exportsObj.broadcastCommunityMemberMessage = functions
        .runWith({ timeoutSeconds: 120, memory: '512MB' })
        .https.onCall(async (data, context) => {
            if (!context.auth) {
                throw new functions.https.HttpsError('unauthenticated', 'Authentication required.');
            }

            const senderUid = context.auth.uid;
            const partnerId = asTrimmedString(data?.partnerId) || senderUid;
            const text = asTrimmedString(data?.message).slice(0, MESSAGE_MAX_LEN);
            const rawTargets = Array.isArray(data?.memberIds) ? data.memberIds : [];
            const memberIds = [
                ...new Set(
                    rawTargets
                        .map((id) => asTrimmedString(id))
                        .filter((id) => id && id !== senderUid)
                ),
            ].slice(0, MAX_TARGETS);

            if (!text) {
                throw new functions.https.HttpsError('invalid-argument', 'message is required.');
            }
            if (memberIds.length === 0) {
                throw new functions.https.HttpsError('invalid-argument', 'memberIds are required.');
            }

            const owner = await resolveCommunityOwner(db, partnerId);
            if (!owner || !isCommunityOwnerBusiness(owner)) {
                throw new functions.https.HttpsError('failed-precondition', 'Business community not found.');
            }
            if (!isCommunityOwnerRequester(owner, senderUid)) {
                throw new functions.https.HttpsError(
                    'permission-denied',
                    'Only the community owner can broadcast to members.'
                );
            }

            const tier = normalizeBusinessSubscriptionTier(owner.data.subscriptionTier);
            if (tier !== 'paid') {
                throw new functions.https.HttpsError(
                    'failed-precondition',
                    'Member messaging requires a paid business plan.'
                );
            }

            const allowedIds = new Set(await collectCommunityMemberIds(db, partnerId, owner));
            const targets = memberIds.filter((id) => allowedIds.has(id));
            if (targets.length === 0) {
                throw new functions.https.HttpsError(
                    'failed-precondition',
                    'No valid community members in the selection.'
                );
            }

            const senderName =
                asTrimmedString(owner.data.display_name) ||
                asTrimmedString(owner.data.displayName) ||
                asTrimmedString(owner.data.businessInfo?.businessName) ||
                'Business';
            const senderAvatar =
                asTrimmedString(owner.data.avatarUrl) ||
                asTrimmedString(owner.data.photo_url) ||
                asTrimmedString(owner.data.businessInfo?.coverImage) ||
                '';
            const title = senderName.slice(0, 120);
            const preview = text.length > 200 ? `${text.slice(0, 197)}…` : text;

            let chatCount = 0;
            let notifyCount = 0;
            const failed = [];

            for (const targetUid of targets) {
                try {
                    const conversationId = conversationIdFor(partnerId, targetUid);
                    const convRef = db.collection('conversations').doc(conversationId);
                    const convSnap = await convRef.get();
                    if (!convSnap.exists) {
                        await convRef.set({
                            participants: [partnerId, targetUid].sort(),
                            createdAt: admin.firestore.FieldValue.serverTimestamp(),
                            lastMessageTime: admin.firestore.FieldValue.serverTimestamp(),
                            lastMessage: null,
                            unreadBy: [],
                            isBusinessMemberThread: true,
                            businessId: partnerId,
                        });
                    }

                    const msgRef = convRef.collection('messages').doc();
                    await msgRef.set({
                        senderId: partnerId,
                        text,
                        type: 'text',
                        createdAt: admin.firestore.FieldValue.serverTimestamp(),
                        status: 'sent',
                        deliveredTo: [],
                        readBy: [],
                        reactions: {},
                    });

                    await convRef.set(
                        {
                            lastMessage: preview,
                            lastMessageTime: admin.firestore.FieldValue.serverTimestamp(),
                            unreadBy: admin.firestore.FieldValue.arrayUnion(targetUid),
                            isBusinessMemberThread: true,
                            businessId: partnerId,
                        },
                        { merge: true }
                    );
                    chatCount += 1;

                    // type:message → ChatList unread + messages filter; FCM via onNotificationCreated
                    await db.collection('notifications').add({
                        userId: targetUid,
                        type: 'message',
                        title,
                        message: preview,
                        actionUrl: `/chat/${partnerId}`,
                        fromUserId: partnerId,
                        fromUserName: senderName,
                        fromUserAvatar: senderAvatar || null,
                        senderAvatar: senderAvatar || null,
                        createdAt: admin.firestore.FieldValue.serverTimestamp(),
                        read: false,
                        metadata: {
                            partnerId,
                            source: 'community_member_broadcast',
                        },
                    });
                    notifyCount += 1;
                } catch (err) {
                    functions.logger.error(
                        'broadcastCommunityMemberMessage target failed',
                        targetUid,
                        err?.message || err
                    );
                    failed.push(targetUid);
                }
            }

            return {
                success: chatCount > 0 || notifyCount > 0,
                chatCount,
                notifyCount,
                failedCount: failed.length,
                failed,
            };
        });
}

module.exports = { registerCommunityMemberBroadcast };
