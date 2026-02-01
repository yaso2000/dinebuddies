import { collection, query, where, getDocs, doc, getDoc, updateDoc, arrayRemove, arrayUnion, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import { sendNotification } from './notificationHelpers';

/**
 * Check if user has already created an invitation today
 */
export const checkDailyInvitationLimit = async (userId) => {
    try {
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
 * Check if invitation has been edited before
 */
export const canEditInvitation = (invitation) => {
    const editCount = invitation.editHistory?.length || 0;
    const hasBeenEdited = editCount > 0;

    return {
        canEdit: !hasBeenEdited,
        editCount,
        message: hasBeenEdited
            ? 'لا يمكن تعديل الدعوة أكثر من مرة واحدة'
            : 'يمكنك تعديل الدعوة مرة واحدة فقط'
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
                title: 'تم تعديل موعد الدعوة',
                message: `تم تغيير موعد "${invitation.title}" من ${oldDate} ${oldTime} إلى ${newDate} ${newTime}. يرجى تأكيد حضورك مرة أخرى.`,
                actionUrl: `/invitation/${invitationId}`,
                invitationId,
                fromUserId: currentUser.uid,
                fromUserName: currentUser.name || currentUser.displayName,
                fromUserAvatar: currentUser.avatar || currentUser.photoURL
            });
        }

        return {
            success: true,
            message: 'تم تعديل الدعوة وإرسال إشعارات للمشاركين',
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
            error: 'لديك دعوة بالفعل اليوم. يمكنك إنشاء دعوة واحدة فقط في اليوم.',
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
    const hasBeenEdited = editHistory.length > 0;

    if (!hasBeenEdited) {
        return {
            canEdit: true,
            status: 'can_edit',
            message: 'يمكنك تعديل الوقت والتاريخ مرة واحدة',
            icon: '✏️'
        };
    }

    const lastEdit = editHistory[editHistory.length - 1];
    return {
        canEdit: false,
        status: 'already_edited',
        message: 'تم تعديل هذه الدعوة مسبقاً',
        lastEdit,
        icon: '🔒'
    };
};
