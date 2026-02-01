import { db } from '../firebase/config';
import { collection, addDoc, serverTimestamp, query, where, getDocs, updateDoc, doc, arrayUnion } from 'firebase/firestore';

/**
 * Create or update group chat when someone joins an invitation
 * @param {Object} invitation - The invitation object
 * @param {string} newMemberId - ID of the newly joined member
 * @param {string} newMemberName - Name of the newly joined member
 * @returns {Promise<string>} - The conversation ID
 */
export const handleInvitationJoin = async (invitation, newMemberId, newMemberName) => {
    try {
        if (!invitation.id || !newMemberId) {
            throw new Error('Invalid invitation or member data');
        }

        // Check if group chat already exists
        const existingChatId = await getInvitationGroupChat(invitation.id);

        if (existingChatId) {
            // Add new member to existing chat
            await addMemberToGroupChat(existingChatId, newMemberId, newMemberName);
            return existingChatId;
        } else {
            // Create new group chat (first member joining)
            const chatId = await createInvitationGroupChat(invitation, newMemberId);
            return chatId;
        }
    } catch (error) {
        console.error('❌ Error handling invitation join:', error);
        throw error;
    }
};

/**
 * Create a group chat when first person joins invitation
 * @param {Object} invitation - The full invitation object
 * @param {string} firstMemberId - ID of the first member joining
 * @returns {Promise<string>} - The created conversation ID
 */
export const createInvitationGroupChat = async (invitation, firstMemberId) => {
    try {
        if (!invitation.id || !invitation.author?.id) {
            throw new Error('Invalid invitation data for group chat creation');
        }

        // Calculate expiry (24 hours after invitation date + time)
        const invitationDateTime = new Date(`${invitation.date}T${invitation.time}`);
        const expiresAt = new Date(invitationDateTime.getTime() + (24 * 60 * 60 * 1000));

        // Initial participants: Host + First member
        const initialParticipants = [invitation.author.id];
        if (firstMemberId && firstMemberId !== invitation.author.id) {
            initialParticipants.push(firstMemberId);
        }

        // Create group chat data
        const groupData = {
            type: 'group',
            invitationId: invitation.id,
            participants: initialParticipants,
            createdAt: serverTimestamp(),
            lastMessageAt: serverTimestamp(),
            lastMessage: 'Group chat created',
            lastMessageSenderId: 'system',
            expiresAt: expiresAt,
            status: 'active',
            groupName: invitation.title,
            groupImage: invitation.image || null,
            unreadCount: {}
        };

        // Initialize unread count for all participants
        initialParticipants.forEach(participantId => {
            groupData.unreadCount[participantId] = 0;
        });

        // Create conversation
        const conversationsRef = collection(db, 'conversations');
        const docRef = await addDoc(conversationsRef, groupData);

        // Add system message
        const messagesRef = collection(db, 'conversations', docRef.id, 'messages');
        await addDoc(messagesRef, {
            text: `Group chat created for "${invitation.title}". New members will be added automatically as they join. This chat will close 24 hours after the event (${invitationDateTime.toLocaleString()}).`,
            type: 'system',
            senderId: 'system',
            senderName: 'System',
            createdAt: serverTimestamp(),
            read: false
        });

        console.log('✅ Group chat created:', docRef.id);
        return docRef.id;
    } catch (error) {
        console.error('❌ Error creating group chat:', error);
        throw error;
    }
};

/**
 * Add a new member to an existing group chat
 * @param {string} chatId - The conversation ID
 * @param {string} memberId - ID of the new member
 * @param {string} memberName - Name of the new member
 * @returns {Promise<void>}
 */
export const addMemberToGroupChat = async (chatId, memberId, memberName) => {
    try {
        const chatRef = doc(db, 'conversations', chatId);

        // Update conversation: add participant
        await updateDoc(chatRef, {
            participants: arrayUnion(memberId),
            [`unreadCount.${memberId}`]: 0,
            lastMessageAt: serverTimestamp(),
            lastMessage: `${memberName} joined the group`,
            lastMessageSenderId: 'system'
        });

        // Add system message
        const messagesRef = collection(db, 'conversations', chatId, 'messages');
        await addDoc(messagesRef, {
            text: `${memberName} joined the group! 👋`,
            type: 'system',
            senderId: 'system',
            senderName: 'System',
            createdAt: serverTimestamp(),
            read: false
        });

        console.log(`✅ Member ${memberName} added to chat ${chatId}`);
    } catch (error) {
        console.error('❌ Error adding member to group chat:', error);
        throw error;
    }
};

/**
 * Check if a group chat already exists for an invitation
 * @param {string} invitationId - The invitation ID
 * @returns {Promise<string|null>} - The conversation ID if exists, null otherwise
 */
export const getInvitationGroupChat = async (invitationId) => {
    try {
        const { query, where, getDocs, collection: firestoreCollection } = await import('firebase/firestore');

        const conversationsRef = firestoreCollection(db, 'conversations');
        const q = query(
            conversationsRef,
            where('type', '==', 'group'),
            where('invitationId', '==', invitationId)
        );

        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
            return snapshot.docs[0].id;
        }

        return null;
    } catch (error) {
        console.error('Error checking for existing group chat:', error);
        return null;
    }
};
