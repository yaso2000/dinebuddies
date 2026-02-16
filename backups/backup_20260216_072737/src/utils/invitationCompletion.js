import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import { verifyUserAtLocation, LOCATION_VERIFICATION_CONFIG } from './locationVerification';
import { sendNotification } from './notificationHelpers';

/**
 * Complete an invitation (mark as completed)
 * Requires location verification to prevent fraud
 * 
 * @param {string} invitationId - The invitation ID
 * @param {object} invitation - The invitation data
 * @param {object} currentUser - The current user (must be host)
 * @returns {Promise<{success: boolean, message: string, error?: string}>}
 */
export const completeInvitation = async (invitationId, invitation, currentUser) => {
    try {
        // 1. Verify user is the host
        if (invitation.author.id !== currentUser.id) {
            return {
                success: false,
                error: 'Only the host can complete the invitation'
            };
        }

        // 2. Check if invitation has location coordinates
        if (!invitation.lat || !invitation.lng) {
            return {
                success: false,
                error: 'Invitation location coordinates not found. Cannot verify location.'
            };
        }

        // 3. Verify user is at the venue location
        if (LOCATION_VERIFICATION_CONFIG.ENABLE_VERIFICATION) {
            const verification = await verifyUserAtLocation(
                invitation.lat,
                invitation.lng,
                LOCATION_VERIFICATION_CONFIG.MAX_DISTANCE_METERS
            );

            if (!verification.verified) {
                return {
                    success: false,
                    error: verification.message,
                    distance: verification.distance,
                    requiresLocation: true
                };
            }

            console.log('✅ Location verified:', verification);
        }

        // 4. Update invitation status to completed
        const invitationRef = doc(db, 'invitations', invitationId);
        await updateDoc(invitationRef, {
            status: 'completed',
            completedAt: serverTimestamp(),
            completedBy: currentUser.id,
            completionLocation: {
                verified: true,
                timestamp: new Date().toISOString()
            }
        });

        // 5. Send notifications to all participants
        const participants = invitation.joined || [];
        const notificationPromises = participants.map(userId =>
            sendNotification(userId, {
                type: 'invitation_completed',
                title: 'Invitation Completed! 🎉',
                message: `The invitation "${invitation.title}" has been completed. Hope you had a great time!`,
                actionUrl: `/invitation/${invitationId}`,
                invitationId,
                fromUserId: currentUser.id,
                fromUserName: currentUser.name || currentUser.displayName,
                fromUserAvatar: currentUser.avatar || currentUser.photoURL
            })
        );

        await Promise.all(notificationPromises);

        return {
            success: true,
            message: `✅ Invitation completed successfully! ${participants.length} participants notified.`,
            notifiedUsers: participants.length
        };

    } catch (error) {
        console.error('Error completing invitation:', error);

        // Handle specific geolocation errors
        if (error.message && error.message.includes('Location permission')) {
            return {
                success: false,
                error: 'Location permission denied. Please enable location access to complete the invitation.',
                requiresPermission: true
            };
        }

        return {
            success: false,
            error: error.message || 'Failed to complete invitation'
        };
    }
};

/**
 * Check if invitation can be completed
 * @param {object} invitation - The invitation data
 * @param {object} currentUser - The current user
 * @returns {{canComplete: boolean, reason?: string}}
 */
export const canCompleteInvitation = (invitation, currentUser) => {
    // Must be the host
    if (invitation.author.id !== currentUser.id) {
        return {
            canComplete: false,
            reason: 'Only the host can complete the invitation'
        };
    }

    // Must have joined members
    const joinedCount = invitation.joined?.length || 0;
    if (joinedCount === 0) {
        return {
            canComplete: false,
            reason: 'No one has joined yet'
        };
    }

    // Must have location coordinates for verification
    if (!invitation.lat || !invitation.lng) {
        return {
            canComplete: false,
            reason: 'Location coordinates missing'
        };
    }

    // Must not be already completed
    if (invitation.status === 'completed') {
        return {
            canComplete: false,
            reason: 'Already completed'
        };
    }

    // Check if event time has passed (optional - can complete anytime)
    // const eventDateTime = new Date(`${invitation.date} ${invitation.time}`);
    // const now = new Date();
    // if (now < eventDateTime) {
    //     return {
    //         canComplete: false,
    //         reason: 'Event has not started yet'
    //     };
    // }

    return {
        canComplete: true
    };
};
