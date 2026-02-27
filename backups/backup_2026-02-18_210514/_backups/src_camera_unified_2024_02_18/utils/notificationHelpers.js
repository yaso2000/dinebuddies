// Notification helpers for creating notifications on specific events
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';

/**
 * Create a notification for a user
 */
export const createNotification = async ({
    userId,
    type,
    title,
    message,
    actionUrl = null,
    fromUserId = null,
    fromUserName = null,
    fromUserAvatar = null,
    metadata = {}
}) => {
    if (!userId) {
        console.error('userId is required for creating notification');
        return;
    }

    try {
        const notificationsRef = collection(db, 'notifications');
        await addDoc(notificationsRef, {
            userId,
            type,
            title,
            message,
            actionUrl,
            fromUserId,
            fromUserName,
            fromUserAvatar,
            metadata,
            read: false,
            createdAt: serverTimestamp()
        });
    } catch (error) {
        console.error('Error creating notification:', error);
    }
};

/**
 * Alias for createNotification (for backward compatibility)
 */
export const sendNotification = createNotification;

/**
 * Notify user when someone follows them
 */
export const notifyNewFollower = async (followedUserId, followerUser) => {
    await createNotification({
        userId: followedUserId,
        type: 'follow',
        title: 'New Follower',
        message: `${followerUser.name || 'Someone'} started following you`,
        actionUrl: `/profile/${followerUser.id}`,
        fromUserId: followerUser.id,
        fromUserName: followerUser.name,
        fromUserAvatar: followerUser.avatar
    });
};

/**
 * Notify when invitation is accepted
 */
export const notifyInvitationAccepted = async (hostUserId, guestUser, invitationId) => {
    await createNotification({
        userId: hostUserId,
        type: 'invitation_accepted',
        title: 'Invitation Accepted',
        message: `${guestUser.name || 'Someone'} accepted your invitation`,
        actionUrl: `/invitation/${invitationId}`,
        fromUserId: guestUser.id,
        fromUserName: guestUser.name,
        fromUserAvatar: guestUser.avatar,
        metadata: { invitationId }
    });
};

/**
 * Notify when invitation is rejected
 */
export const notifyInvitationRejected = async (hostUserId, guestUser, invitationId) => {
    await createNotification({
        userId: hostUserId,
        type: 'invitation_rejected',
        title: 'Invitation Declined',
        message: `${guestUser.name || 'Someone'} declined your invitation`,
        actionUrl: `/invitation/${invitationId}`,
        fromUserId: guestUser.id,
        fromUserName: guestUser.name,
        fromUserAvatar: guestUser.avatar,
        metadata: { invitationId }
    });
};

/**
 * Notify when receiving a new message
 */
export const notifyNewMessage = async (recipientUserId, senderUser, messagePreview) => {
    await createNotification({
        userId: recipientUserId,
        type: 'message',
        title: 'New Message',
        message: `${senderUser.name || 'Someone'}: ${messagePreview}`,
        actionUrl: `/chat/${senderUser.id}`,
        fromUserId: senderUser.id,
        fromUserName: senderUser.name,
        fromUserAvatar: senderUser.avatar
    });
};

/**
 * Notify invitation reminder (1 day before)
 */
export const notifyInvitationReminder = async (userId, invitation) => {
    await createNotification({
        userId,
        type: 'reminder',
        title: 'Upcoming Invitation',
        message: `Your invitation at ${invitation.restaurantName} is tomorrow at ${invitation.time}`,
        actionUrl: `/invitation/${invitation.id}`,
        metadata: { invitationId: invitation.id }
    });
};

/**
 * Notify when someone likes your invitation
 */
export const notifyInvitationLiked = async (invitationOwnerId, likerUser, invitationId) => {
    await createNotification({
        userId: invitationOwnerId,
        type: 'like',
        title: 'Invitation Liked',
        message: `${likerUser.name || 'Someone'} liked your invitation`,
        actionUrl: `/invitation/${invitationId}`,
        fromUserId: likerUser.id,
        fromUserName: likerUser.name,
        fromUserAvatar: likerUser.avatar,
        metadata: { invitationId }
    });
};

/**
 * Notify when someone comments on your invitation
 */
export const notifyNewComment = async (invitationOwnerId, commenterUser, invitationId, comment) => {
    await createNotification({
        userId: invitationOwnerId,
        type: 'comment',
        title: 'New Comment',
        message: `${commenterUser.name || 'Someone'} commented: ${comment.substring(0, 50)}...`,
        actionUrl: `/invitation/${invitationId}`,
        fromUserId: commenterUser.id,
        fromUserName: commenterUser.name,
        fromUserAvatar: commenterUser.avatar,
        metadata: { invitationId, commentId: comment.id }
    });
};
