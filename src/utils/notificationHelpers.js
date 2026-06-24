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
        return;
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
    } catch (error) {
        console.error('Error creating notification:', error);
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

export const notifyProfileLiked = (profileOwnerId, likerUser) => {
    fireNotification({
        userId: profileOwnerId,
        type: 'like',
        title: 'Profile liked',
        message: `${likerUser.name || 'Someone'} liked your profile`,
        actionUrl: `/profile/${likerUser.id}`,
        metadata: { source: 'discovery_feed', likerId: likerUser.id },
    });
};

export const notifyMutualProfileMatch = (profileOwnerId, matchedUser) => {
    fireNotification({
        userId: profileOwnerId,
        type: 'like',
        title: "It's a match!",
        message: `You and ${matchedUser.name || 'Someone'} liked each other!`,
        actionUrl: `/profile/${matchedUser.id}`,
        metadata: { source: 'discovery_feed', likerId: matchedUser.id, mutual: true },
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

export const notifyNewMessage = (recipientUserId, senderUser, messagePreview) => {
    fireNotification({
        userId: recipientUserId,
        type: 'message',
        title: 'New Message',
        message: `${senderUser.name || 'Someone'}: ${messagePreview}`,
        actionUrl: `/chat/${senderUser.id}`
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
