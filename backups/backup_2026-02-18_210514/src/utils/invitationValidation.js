import { collection, query, where, getDocs, doc, getDoc, updateDoc, arrayRemove, arrayUnion, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import { sendNotification } from './notificationHelpers';

/**
 * Check if user has already created an invitation today
 */
export const checkDailyInvitationLimit = async (userId) => {
    try {
        // Validate userId
        if (!userId) {
            console.warn('checkDailyInvitationLimit: userId is undefined');
            return { hasInvitationToday: false, count: 0 };
        }

        const today = new Date().toISOString().split('T')[0];
        const invitationsRef = collection(db, 'invitations');
        const q = query(
            invitationsRef,
            where('author.id', '==', userId),
            where('date', '>=', today)
        );

        const snapshot = await getDocs(q);
        return {
            hasInvitationToday: snapshot.size > 0,
            count: snapshot.size,
            existingInvitation: snapshot.size > 0 ? {
                id: snapshot.docs[0].id,
                ...snapshot.docs[0].data()
            } : null
        };
    } catch (error) {
        console.error('Error checking daily invitation limit:', error);
        return { hasInvitationToday: false, count: 0 };
    }
};

/**
 * Check if invitation can be edited
 * Note: Edit restriction removed - hosts can now edit invitations multiple times
 */
export const canEditInvitation = (invitation) => {
    const editCount = invitation.editHistory?.length || 0;

    return {
        canEdit: true, // Always allow editing
        editCount,
        message: editCount > 0
            ? `Invitation has been edited ${editCount} time(s)`
            : 'You can edit the invitation'
    };
};

/**
 * Update invitation time/date and notify participants
 */
export const updateInvitationDateTime = async (invitationId, newDate, newTime, currentUser) => {
    try {
        const invitationRef = doc(db, 'invitations', invitationId);
        const invitationDoc = await getDoc(invitationRef);

        if (!invitationDoc.exists()) {
            throw new Error('Invitation not found');
        }

        const invitation = invitationDoc.data();

        // Check if can edit
        const editCheck = canEditInvitation(invitation);
        if (!editCheck.canEdit) {
            throw new Error(editCheck.message);
        }

        const oldDate = invitation.date;
        const oldTime = invitation.time;
        const joinedUsers = invitation.joined || [];

        // Create edit history entry
        const editEntry = {
            editedAt: new Date().toISOString(),
            editedBy: currentUser.uid,
            changes: {
                oldDate,
                oldTime,
                newDate,
                newTime
            }
        };

        // Move joined users to requests (pending approval)
        const updates = {
            date: newDate,
            time: newTime,
            editHistory: arrayUnion(editEntry),
            joined: [], // Clear joined users
            requests: arrayUnion(...joinedUsers), // Move to requests
            updatedAt: serverTimestamp()
        };

        await updateDoc(invitationRef, updates);

        // Send notifications to all affected users
        for (const userId of joinedUsers) {
            await sendNotification(userId, {
                type: 'invitation_updated',
                title: 'Invitation time updated',
                message: `The time for "${invitation.title}" has been changed from ${oldDate} ${oldTime} to ${newDate} ${newTime}. Please confirm your attendance again.`,
                actionUrl: `/invitation/${invitationId}`,
                invitationId,
                fromUserId: currentUser.uid,
                fromUserName: currentUser.name || currentUser.displayName,
                fromUserAvatar: currentUser.avatar || currentUser.photoURL
            });
        }

        return {
            success: true,
            message: 'Invitation updated and notifications sent to participants',
            affectedUsers: joinedUsers.length
        };
    } catch (error) {
        console.error('Error updating invitation:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

/**
 * Validate invitation creation
 */
export const validateInvitationCreation = async (userId) => {
    const dailyCheck = await checkDailyInvitationLimit(userId);

    if (dailyCheck.hasInvitationToday) {
        return {
            valid: false,
            error: 'You already have an invitation today. You can only create one invitation per day.',
            existingInvitation: dailyCheck.existingInvitation
        };
    }

    return { valid: true };
};

/**
 * Get invitation edit status
 */
export const getInvitationEditStatus = (invitation) => {
    const editHistory = invitation.editHistory || [];
    const editCount = editHistory.length;

    if (editCount === 0) {
        return {
            canEdit: true,
            status: 'can_edit',
            message: 'You can edit time and date',
            icon: '✏️'
        };
    }

    const lastEdit = editHistory[editHistory.length - 1];
    return {
        canEdit: true, // Always allow editing
        status: 'can_edit',
        message: `Edited ${editCount} time(s). You can edit again`,
        lastEdit,
        editCount,
        icon: '✏️'
    };
};
