// Notification helpers for creating notifications on specific events
import { adminSecurityService } from '../services/adminSecurityService';

/**
 * Create a notification for a user (awaitable).
 */
export const createNotification = async ({
    userId,
    type,
    title,
    message,
    actionUrl = null,
    metadata = {}
}) => {
    if (!userId) {
        console.error('userId is required for creating notification');
        return { ok: false, error: 'missing_user' };
    }

    try {
        await adminSecurityService.createNotification({
            userId,
            type,
            title,
            message,
            actionUrl,
            metadata
        });
        return { ok: true };
    } catch (error) {
        console.error('Error creating notification:', error);
        return { ok: false, error };
    }
};

/** Fire-and-forget — never block UI on the createNotification callable. */
export function fireNotification(payload) {
    void createNotification(payload);
}

export const sendNotification = createNotification;

export const notifyNewFollower = (followedUserId, followerUser) => {
    fireNotification({
        userId: followedUserId,
        type: 'follow',
        title: 'New Follower',
        message: `${followerUser.name || 'Someone'} started following you`,
        actionUrl: `/profile/${followerUser.id}`
    });
};

/** Connection complete — a mutual Follow makes two members friends (the only kind). */
export const notifyConnectConnectionComplete = (recipientUserId, otherUser) => {
    const name = otherUser?.name || otherUser?.display_name || 'Someone';
    fireNotification({
        userId: recipientUserId,
        type: 'connect',
        title: 'New friendship!',
        message: `You and ${name} became friends`,
        actionUrl: `/profile/${otherUser?.id || ''}`,
        metadata: {
            source: 'connect',
            connectionKind: 'friendship',
            mutual: true,
            otherUserId: otherUser?.id || null,
            senderId: otherUser?.id || null,
        },
    });
};

export const notifyProfileGreeting = (profileOwnerId, senderUser) => {
    fireNotification({
        userId: profileOwnerId,
        type: 'greeting',
        title: 'New greeting',
        message: `${senderUser.name || 'Someone'} waved hi 👋`,
        actionUrl: `/profile/${senderUser.id}`,
        metadata: { source: 'discovery_feed', senderId: senderUser.id },
    });
};

export const notifyInvitationAccepted = (hostUserId, guestUser, invitationId) => {
    fireNotification({
        userId: hostUserId,
        type: 'invitation_accepted',
        title: 'Invitation Accepted',
        message: `${guestUser.name || 'Someone'} accepted your invitation`,
        actionUrl: `/invitation/${invitationId}`,
        metadata: { invitationId }
    });
};

export const notifyInvitationRejected = (hostUserId, guestUser, invitationId) => {
    fireNotification({
        userId: hostUserId,
        type: 'invitation_rejected',
        title: 'Invitation Declined',
        message: `${guestUser.name || 'Someone'} declined your invitation`,
        actionUrl: `/invitation/${invitationId}`,
        metadata: { invitationId }
    });
};

export const notifyNewMessage = (recipientUserId, senderUser, messagePreview, options = {}) => {
    // A group message must deep-link to the GROUP, not to a 1:1 with the sender.
    // For a 1:1, /chat/:senderId is correct (from the recipient's view that IS
    // the conversation with the sender).
    const isGroup = Boolean(options.isGroup && options.conversationId);
    const actionUrl = isGroup ? `/group/${options.conversationId}` : `/chat/${senderUser.id}`;
    return createNotification({
        userId: recipientUserId,
        type: 'message',
        title: isGroup ? (options.groupName || 'New Message') : 'New Message',
        message: `${senderUser.name || 'Someone'}: ${messagePreview}`,
        actionUrl,
        metadata: options.conversationId
            ? { conversationId: options.conversationId, isGroup }
            : {},
    });
};

export const notifyInvitationReminder = (userId, invitation) => {
    fireNotification({
        userId,
        type: 'reminder',
        title: 'Upcoming Invitation',
        message: `Your invitation at ${invitation.restaurantName} is tomorrow at ${invitation.time}`,
        actionUrl: `/invitation/${invitation.id}`,
        metadata: { invitationId: invitation.id }
    });
};

export const notifyInvitationLiked = (invitationOwnerId, likerUser, invitationId) => {
    fireNotification({
        userId: invitationOwnerId,
        type: 'like',
        title: 'Invitation Liked',
        message: `${likerUser.name || 'Someone'} liked your invitation`,
        actionUrl: `/invitation/${invitationId}`,
        metadata: { invitationId }
    });
};

export const notifyNewComment = (invitationOwnerId, commenterUser, invitationId, comment) => {
    fireNotification({
        userId: invitationOwnerId,
        type: 'comment',
        title: 'New Comment',
        message: `${commenterUser.name || 'Someone'} commented: ${comment.substring(0, 50)}...`,
        actionUrl: `/invitation/${invitationId}`,
        metadata: { invitationId, commentId: comment.id }
    });
};
