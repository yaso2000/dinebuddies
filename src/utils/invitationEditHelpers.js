import { doc, updateDoc, serverTimestamp, getDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase/config';
import { sendNotification } from './notificationHelpers';

/**
 * Update invitation guest count
 * Cannot be less than the number of already accepted guests
 * Sends notifications if invitation becomes full
 */
export const updateGuestCount = async (invitationId, newGuestCount, currentJoinedCount, currentUser) => {
    try {
        if (newGuestCount < currentJoinedCount) {
            return {
                success: false,
                error: `Cannot set guest count lower than ${currentJoinedCount} (current accepted guests)`
            };
        }

        // Get invitation details for notifications
        const invitationRef = doc(db, 'invitations', invitationId);
        const invitationDoc = await getDoc(invitationRef);

        if (!invitationDoc.exists()) {
            return {
                success: false,
                error: 'Invitation not found'
            };
        }

        const invitation = invitationDoc.data();
        const { title, joined = [], placeId } = invitation;
        const wasFull = invitation.guestsNeeded === currentJoinedCount;
        const willBeFull = newGuestCount === currentJoinedCount;

        // Update the guest count
        await updateDoc(invitationRef, {
            guestsNeeded: newGuestCount,
            updatedAt: serverTimestamp()
        });

        // If invitation just became full, send notifications
        if (!wasFull && willBeFull) {
            // Notify all joined members
            const notificationPromises = joined.map(userId =>
                sendNotification(userId, {
                    type: 'invitation_full',
                    title: 'Invitation Complete',
                    message: `Great news! The invitation "${title}" is now complete with all ${newGuestCount} guests confirmed.`,
                    actionUrl: `/invitation/${invitationId}`,
                    invitationId,
                    fromUserId: currentUser.id,
                    fromUserName: currentUser.display_name || currentUser.name,
                    fromUserAvatar: currentUser.photo_url || currentUser.avatar
                })
            );

            await Promise.all(notificationPromises);

            // If venue has a placeId, check if it's a registered business and notify
            if (placeId) {
                try {
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
                            type: 'booking_confirmed',
                            title: 'Booking Confirmed',
                            message: `A booking for "${title}" at your venue is now confirmed with ${newGuestCount} guests.`,
                            actionUrl: `/invitation/${invitationId}`,
                            invitationId,
                            fromUserId: currentUser.id,
                            fromUserName: currentUser.display_name || currentUser.name,
                            fromUserAvatar: currentUser.photo_url || currentUser.avatar,
                            guestCount: newGuestCount
                        });
                    }
                } catch (error) {
                    console.error('Error notifying business:', error);
                    // Continue even if business notification fails
                }
            }

            return {
                success: true,
                message: 'Guest count updated and invitation is now full!',
                isFull: true,
                notifiedUsers: joined.length
            };
        }

        return {
            success: true,
            message: 'Guest count updated successfully',
            isFull: false
        };
    } catch (error) {
        console.error('Error updating guest count:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

/**
 * Update invitation image
 */
export const updateInvitationImage = async (invitationId, newImageUrl) => {
    try {
        const invitationRef = doc(db, 'invitations', invitationId);
        await updateDoc(invitationRef, {
            image: newImageUrl,
            updatedAt: serverTimestamp()
        });

        return {
            success: true,
            message: 'Image updated successfully'
        };
    } catch (error) {
        console.error('Error updating image:', error);
        return {
            success: false,
            error: error.message
        };
    }
};
