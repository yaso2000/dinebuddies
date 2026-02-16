import { doc, deleteDoc, getDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase/config';
import { sendNotification } from './notificationHelpers';
import { recordCancellation, getPenaltyInfo } from './cancellationPolicy';

/**
 * Predefined cancellation reasons
 */
export const CANCELLATION_REASONS = [
    { id: 'personal_emergency', label: 'Personal Emergency' },
    { id: 'venue_closed', label: 'Venue Closed/Unavailable' },
    { id: 'weather_conditions', label: 'Bad Weather Conditions' },
    { id: 'not_enough_participants', label: 'Not Enough Participants' },
    { id: 'schedule_conflict', label: 'Schedule Conflict' },
    { id: 'health_reasons', label: 'Health Reasons' },
    { id: 'other', label: 'Other (Custom Reason)' }
];

/**
 * Cancel and delete invitation
 * Sends notification to all participants and venue (if registered)
 * Records cancellation and applies penalties according to policy
 */
export const cancelInvitation = async (invitationId, reason, customReason, currentUser) => {
    try {
        // Get invitation details
        const invitationRef = doc(db, 'invitations', invitationId);
        const invitationDoc = await getDoc(invitationRef);

        if (!invitationDoc.exists()) {
            return {
                success: false,
                error: 'Invitation not found'
            };
        }

        const invitation = invitationDoc.data();
        const { title, joined = [], requests = [], location, placeId } = invitation;

        // Determine the final reason message
        const reasonMessage = reason === 'other' ? customReason :
            CANCELLATION_REASONS.find(r => r.id === reason)?.label || reason;

        // Record cancellation and apply penalty (with exemption check)
        const penaltyResult = await recordCancellation(
            currentUser.id,
            invitationId,
            reasonMessage,
            invitation // Pass invitation data for exemption check
        );

        if (!penaltyResult.success) {
            console.error('Failed to record cancellation:', penaltyResult.error);
        }

        // Get all affected users (joined + pending requests)
        const allAffectedUsers = [...new Set([...joined, ...requests])];

        // Send notifications to all participants
        const notificationPromises = allAffectedUsers.map(userId =>
            sendNotification(userId, {
                type: 'invitation_cancelled',
                title: 'Invitation Cancelled',
                message: `The invitation "${title}" has been cancelled. Reason: ${reasonMessage}`,
                actionUrl: `/`,
                invitationId,
                fromUserId: currentUser.id,
                fromUserName: currentUser.display_name || currentUser.name,
                fromUserAvatar: currentUser.photo_url || currentUser.avatar,
                cancellationReason: reasonMessage
            })
        );

        await Promise.all(notificationPromises);

        // If venue has a placeId, check if it's a registered business and notify
        if (placeId) {
            try {
                // Search for business account with this placeId
                const usersRef = collection(db, 'users');
                const businessQuery = query(
                    usersRef,
                    where('isBusiness', '==', true),
                    where('businessInfo.placeId', '==', placeId)
                );

                const businessSnapshot = await getDocs(businessQuery);

                if (!businessSnapshot.empty) {
                    const businessDoc = businessSnapshot.docs[0];
                    const businessId = businessDoc.id;

                    // Send notification to business
                    await sendNotification(businessId, {
                        type: 'booking_cancelled',
                        title: 'Booking Cancelled',
                        message: `A booking for "${title}" at your venue has been cancelled. Reason: ${reasonMessage}`,
                        actionUrl: `/user/${currentUser.id}`,
                        invitationId,
                        fromUserId: currentUser.id,
                        fromUserName: currentUser.display_name || currentUser.name,
                        fromUserAvatar: currentUser.photo_url || currentUser.avatar,
                        cancellationReason: reasonMessage
                    });
                }
            } catch (error) {
                console.error('Error notifying business:', error);
                // Continue even if business notification fails
            }
        }

        // Delete the group chat messages if exists
        if (invitation.groupChatId) {
            try {
                const messagesRef = collection(db, 'invitations', invitationId, 'messages');
                const messagesSnapshot = await getDocs(messagesRef);

                const deleteMessagesPromises = messagesSnapshot.docs.map(doc =>
                    deleteDoc(doc.ref)
                );

                await Promise.all(deleteMessagesPromises);
            } catch (error) {
                console.error('Error deleting messages:', error);
            }
        }

        // Finally, delete the invitation
        await deleteDoc(invitationRef);

        return {
            success: true,
            message: 'Invitation cancelled and deleted successfully',
            notifiedUsers: allAffectedUsers.length,
            notifiedBusiness: placeId ? true : false,
            penalty: penaltyResult.penalty,
            cancellationCount: penaltyResult.cancellationCount,
            isRestricted: penaltyResult.isRestricted
        };
    } catch (error) {
        console.error('Error cancelling invitation:', error);
        return {
            success: false,
            error: error.message
        };
    }
};
