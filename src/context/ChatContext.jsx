import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { db } from '../firebase/config';
import {
    collection,
    query,
    where,
    orderBy,
    onSnapshot,
    addDoc,
    updateDoc,
    doc,
    serverTimestamp,
    getDocs,
    getDoc,
    setDoc
} from 'firebase/firestore';

const ChatContext = createContext();

export const useChat = () => {
    const context = useContext(ChatContext);
    if (!context) {
        throw new Error('useChat must be used within ChatProvider');
    }
    return context;
};

export const ChatProvider = ({ children }) => {
    const { currentUser } = useAuth();
    const [conversations, setConversations] = useState([]);
    const [messages, setMessages] = useState({});
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [onlineUsers, setOnlineUsers] = useState({});
    const [typingUsers, setTypingUsers] = useState({});

    // Load conversations for current user
    useEffect(() => {
        if (!currentUser?.uid || currentUser.uid === 'guest') {
            setConversations([]);
            setLoading(false);
            return;
        }

        const conversationsRef = collection(db, 'conversations');
        const q = query(
            conversationsRef,
            where('participants', 'array-contains', currentUser.uid)
        );

        const unsubscribe = onSnapshot(
            q,
            async (snapshot) => {
                const convos = [];

                for (const docSnap of snapshot.docs) {
                    const data = docSnap.data();

                    // Get other participant info
                    const otherParticipantId = data.participants.find(id => id !== currentUser.uid);

                    convos.push({
                        id: docSnap.id,
                        ...data,
                        otherParticipantId,
                        lastMessageAt: data.lastMessageAt?.toDate() || new Date()
                    });
                }

                // Sort by lastMessageAt (newest first)
                convos.sort((a, b) => b.lastMessageAt - a.lastMessageAt);

                setConversations(convos);

                // Calculate unread count
                const totalUnread = convos.reduce((sum, convo) => {
                    return sum + (convo.unreadCount?.[currentUser.uid] || 0);
                }, 0);
                setUnreadCount(totalUnread);

                setLoading(false);
            },
            (error) => {
                console.error('Error loading conversations:', error);
                setLoading(false); // ✅ Important: stop loading on error
                setConversations([]);
            }
        );

        return () => unsubscribe();
    }, [currentUser?.uid]);

    // Load messages for a specific conversation
    const loadMessages = (conversationId) => {
        if (!conversationId) return;

        console.log('📨 Loading messages for conversation:', conversationId);

        const messagesRef = collection(db, 'conversations', conversationId, 'messages');
        const q = query(messagesRef, orderBy('createdAt', 'asc'));

        const unsubscribe = onSnapshot(
            q,
            (snapshot) => {
                console.log('📬 Messages snapshot received:', {
                    conversationId,
                    messageCount: snapshot.docs.length,
                    messages: snapshot.docs.map(d => ({
                        id: d.id,
                        senderId: d.data().senderId,
                        text: d.data().text?.substring(0, 30)
                    }))
                });

                const msgs = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                    createdAt: doc.data().createdAt?.toDate() || new Date()
                }));

                setMessages(prev => ({
                    ...prev,
                    [conversationId]: msgs
                }));
            },
            (error) => {
                console.error('❌ Error loading messages:', error);
            }
        );

        return unsubscribe;
    };

    // Send a message
    const sendMessage = async (conversationId, text, recipientId, messageType = 'text') => {
        if (!currentUser?.uid) return;

        try {
            let convoId = conversationId;

            // Create conversation if it doesn't exist
            if (!convoId) {
                const convoRef = collection(db, 'conversations');

                // Check if conversation already exists
                const existingConvo = await getDocs(
                    query(
                        convoRef,
                        where('participants', 'array-contains', currentUser.uid)
                    )
                );

                const existing = existingConvo.docs.find(doc => {
                    const participants = doc.data().participants;
                    return participants.includes(recipientId);
                });

                if (existing) {
                    convoId = existing.id;
                } else {
                    const newConvo = await addDoc(convoRef, {
                        participants: [currentUser.uid, recipientId],
                        createdAt: serverTimestamp(),
                        lastMessageAt: serverTimestamp(),
                        lastMessage: messageType === 'image' ? '📷 Image' : text.trim(),
                        lastMessageSenderId: currentUser.uid,
                        unreadCount: {
                            [recipientId]: 1,
                            [currentUser.uid]: 0
                        }
                    });
                    convoId = newConvo.id;
                }
            }

            // Add message to conversation
            const messagesRef = collection(db, 'conversations', convoId, 'messages');
            await addDoc(messagesRef, {
                text: text.trim(),
                type: messageType,
                senderId: currentUser.uid,
                senderName: currentUser.displayName || currentUser.email,
                senderAvatar: currentUser.photoURL || 'https://via.placeholder.com/150',
                createdAt: serverTimestamp(),
                read: false
            });

            // Update conversation metadata
            const convoRef = doc(db, 'conversations', convoId);
            const convoSnap = await getDoc(convoRef);
            const convoData = convoSnap.data();

            await updateDoc(convoRef, {
                lastMessageAt: serverTimestamp(),
                lastMessage: messageType === 'image' ? '📷 Image' : text.trim().substring(0, 50),
                lastMessageSenderId: currentUser.uid,
                unreadCount: {
                    ...convoData.unreadCount,
                    [recipientId]: (convoData.unreadCount?.[recipientId] || 0) + 1
                }
            });

            // Create notification for new message
            const { notifyNewMessage } = await import('../utils/notificationHelpers');
            const messagePreview = messageType === 'image' ? '📷 Sent an image' : text.trim().substring(0, 50);

            notifyNewMessage(recipientId, {
                id: currentUser.uid,
                name: currentUser.displayName || currentUser.email,
                avatar: currentUser.photoURL || 'https://via.placeholder.com/150'
            }, messagePreview);

            return convoId;
        } catch (error) {
            console.error('Error sending message:', error);
            throw error;
        }
    };

    // Mark conversation as read
    const markAsRead = async (conversationId) => {
        if (!currentUser?.uid || !conversationId) return;

        try {
            const convoRef = doc(db, 'conversations', conversationId);
            const convoSnap = await getDoc(convoRef);

            if (convoSnap.exists()) {
                const data = convoSnap.data();
                await updateDoc(convoRef, {
                    unreadCount: {
                        ...data.unreadCount,
                        [currentUser.uid]: 0
                    }
                });

                // Mark all messages as read
                const messagesRef = collection(db, 'conversations', conversationId, 'messages');
                const q = query(messagesRef, where('senderId', '!=', currentUser.uid), where('read', '==', false));
                const snapshot = await getDocs(q);

                snapshot.docs.forEach(async (docSnap) => {
                    await updateDoc(doc(db, 'conversations', conversationId, 'messages', docSnap.id), {
                        read: true
                    });
                });
            }
        } catch (error) {
            console.error('Error marking as read:', error);
        }
    };

    // Get or create conversation with user
    const getConversation = async (userId) => {
        if (!currentUser?.uid || !userId) return null;

        // Find existing conversation
        const existing = conversations.find(convo =>
            convo.participants.includes(userId) && convo.type !== 'group'
        );

        if (existing) {
            return existing.id;
        }

        return null; // Will be created when first message is sent
    };

    // Create group chat for invitation
    const createGroupChat = async (invitation) => {
        if (!currentUser?.uid) return null;

        try {
            // Calculate expiry (24 hours after invitation date + time)
            const invitationDateTime = new Date(`${invitation.date}T${invitation.time}`);
            const expiresAt = new Date(invitationDateTime.getTime() + (24 * 60 * 60 * 1000));

            const groupData = {
                type: 'group',
                invitationId: invitation.id,
                participants: invitation.participants.map(p => p.id || p),
                createdAt: serverTimestamp(),
                lastMessageAt: serverTimestamp(),
                lastMessage: 'Group chat created',
                lastMessageSenderId: 'system',
                expiresAt: expiresAt,
                status: 'active',
                groupName: invitation.title,
                groupImage: invitation.image,
                unreadCount: {}
            };

            // Initialize unread count for all participants
            invitation.participants.forEach(p => {
                const participantId = p.id || p;
                groupData.unreadCount[participantId] = 0;
            });

            const conversationsRef = collection(db, 'conversations');
            const docRef = await addDoc(conversationsRef, groupData);

            // Add system message
            const messagesRef = collection(db, 'conversations', docRef.id, 'messages');
            await addDoc(messagesRef, {
                text: `Group chat created for "${invitation.title}". This chat will close 24 hours after the event.`,
                type: 'system',
                senderId: 'system',
                senderName: 'System',
                createdAt: serverTimestamp(),
                read: false
            });

            return docRef.id;
        } catch (error) {
            console.error('Error creating group chat:', error);
            throw error;
        }
    };

    // Check and close expired group chats
    const checkExpiredChats = async () => {
        if (!currentUser?.uid) return;

        try {
            const now = new Date();
            const expiredChatsQuery = query(
                collection(db, 'conversations'),
                where('type', '==', 'group'),
                where('status', '==', 'active'),
                where('participants', 'array-contains', currentUser.uid)
            );

            const snapshot = await getDocs(expiredChatsQuery);

            for (const chatDoc of snapshot.docs) {
                const data = chatDoc.data();
                if (data.expiresAt && data.expiresAt.toDate() < now) {
                    await updateDoc(doc(db, 'conversations', chatDoc.id), {
                        status: 'expired'
                    });

                    // Add system message
                    const messagesRef = collection(db, 'conversations', chatDoc.id, 'messages');
                    await addDoc(messagesRef, {
                        text: 'This group chat has been closed.',
                        type: 'system',
                        senderId: 'system',
                        senderName: 'System',
                        createdAt: serverTimestamp(),
                        read: false
                    });
                }
            }
        } catch (error) {
            console.error('Error checking expired chats:', error);
        }
    };

    // Check for expired chats on mount and periodically
    useEffect(() => {
        if (!currentUser?.uid) return;

        checkExpiredChats();
        const interval = setInterval(checkExpiredChats, 60 * 60 * 1000); // Every hour

        return () => clearInterval(interval);
    }, [currentUser?.uid]);

    const value = {
        conversations,
        messages,
        unreadCount,
        loading,
        loadMessages,
        sendMessage,
        markAsRead,
        getConversation,
        createGroupChat,
        checkExpiredChats
    };

    return (
        <ChatContext.Provider value={value}>
            {children}
        </ChatContext.Provider>
    );
};
