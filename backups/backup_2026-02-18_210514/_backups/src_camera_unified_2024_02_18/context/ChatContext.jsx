import React, { createContext, useContext, useState, useEffect } from 'react';
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
    getDoc,
    getDocs,
    arrayUnion,
    arrayRemove,
    limit
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from './AuthContext';

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
    const [loading, setLoading] = useState(true);
    const [unreadCount, setUnreadCount] = useState(0);

    // Subscribe to user's conversations
    useEffect(() => {
        if (!currentUser?.uid) {
            setConversations([]);
            setLoading(false);
            return;
        }

        setLoading(true);

        const conversationsQuery = query(
            collection(db, 'conversations'),
            where('participants', 'array-contains', currentUser.uid),
            orderBy('lastMessageTime', 'desc')
        );

        const unsubscribe = onSnapshot(
            conversationsQuery,
            async (snapshot) => {
                const convos = [];
                let totalUnread = 0;

                for (const docSnap of snapshot.docs) {
                    const data = docSnap.data();
                    const otherUserId = data.participants.find(id => id !== currentUser.uid);

                    // Get other user's data
                    let otherUser = null;
                    if (otherUserId) {
                        const userDoc = await getDoc(doc(db, 'users', otherUserId));
                        if (userDoc.exists()) {
                            const userData = userDoc.data();
                            otherUser = {
                                uid: otherUserId,
                                displayName: userData.display_name || userData.email || 'User',
                                photoURL: userData.photo_url || null,
                                isOnline: userData.isOnline || false,
                                lastSeen: userData.lastSeen || null
                            };
                        }
                    }

                    // Calculate unread count
                    const unreadBy = data.unreadBy || [];
                    const isUnread = unreadBy.includes(currentUser.uid);
                    if (isUnread) totalUnread++;

                    convos.push({
                        id: docSnap.id,
                        ...data,
                        otherUser,
                        isUnread
                    });
                }

                setConversations(convos);
                setUnreadCount(totalUnread);
                setLoading(false);
            },
            (error) => {
                console.error('Error loading conversations:', error);
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, [currentUser?.uid]);

    // Create or get conversation
    const getOrCreateConversation = async (otherUserId) => {
        if (!currentUser?.uid) return null;

        try {
            // Check if conversation already exists
            const q = query(
                collection(db, 'conversations'),
                where('participants', 'array-contains', currentUser.uid)
            );

            const snapshot = await getDocs(q);
            const existing = snapshot.docs.find(doc => {
                const data = doc.data();
                return data.participants.includes(otherUserId);
            });

            if (existing) {
                return existing.id;
            }

            // Create new conversation
            const newConvo = await addDoc(collection(db, 'conversations'), {
                participants: [currentUser.uid, otherUserId],
                createdAt: serverTimestamp(),
                lastMessageTime: serverTimestamp(),
                lastMessage: null,
                unreadBy: []
            });

            return newConvo.id;
        } catch (error) {
            console.error('Error creating conversation:', error);
            return null;
        }
    };

    // Send message
    const sendMessage = async (conversationId, messageData) => {
        if (!currentUser?.uid) return null;

        try {
            const messageRef = await addDoc(
                collection(db, 'conversations', conversationId, 'messages'),
                {
                    senderId: currentUser.uid,
                    ...messageData,
                    createdAt: serverTimestamp(),
                    status: 'sent', // sent, delivered, read
                    reactions: {}
                }
            );

            // Update conversation
            const convoRef = doc(db, 'conversations', conversationId);
            const convoSnap = await getDoc(convoRef);
            const convoData = convoSnap.data();
            const otherUserId = convoData.participants.find(id => id !== currentUser.uid);

            await updateDoc(convoRef, {
                lastMessage: messageData.type === 'text' ? messageData.text : `📎 ${messageData.type}`,
                lastMessageTime: serverTimestamp(),
                unreadBy: arrayUnion(otherUserId)
            });

            return messageRef.id;
        } catch (error) {
            console.error('Error sending message:', error);
            return null;
        }
    };

    // Mark messages as read
    const markAsRead = async (conversationId) => {
        if (!currentUser?.uid) return;

        try {
            const convoRef = doc(db, 'conversations', conversationId);
            await updateDoc(convoRef, {
                unreadBy: arrayRemove(currentUser.uid)
            });
        } catch (error) {
            console.error('Error marking as read:', error);
        }
    };

    // Update typing status
    const setTypingStatus = async (conversationId, isTyping) => {
        if (!currentUser?.uid) return;

        try {
            const convoRef = doc(db, 'conversations', conversationId);
            await updateDoc(convoRef, {
                [`typing.${currentUser.uid}`]: isTyping
            });
        } catch (error) {
            console.error('Error updating typing status:', error);
        }
    };

    // Add reaction to message
    const addReaction = async (conversationId, messageId, emoji) => {
        if (!currentUser?.uid) return;

        try {
            const messageRef = doc(db, 'conversations', conversationId, 'messages', messageId);
            const messageSnap = await getDoc(messageRef);
            const messageData = messageSnap.data();
            const reactions = messageData.reactions || {};
            const emojiReactions = reactions[emoji] || [];

            if (emojiReactions.includes(currentUser.uid)) {
                // Remove reaction
                await updateDoc(messageRef, {
                    [`reactions.${emoji}`]: arrayRemove(currentUser.uid)
                });
            } else {
                // Add reaction
                await updateDoc(messageRef, {
                    [`reactions.${emoji}`]: arrayUnion(currentUser.uid)
                });
            }
        } catch (error) {
            console.error('Error adding reaction:', error);
        }
    };

    const value = {
        conversations,
        loading,
        unreadCount,
        getOrCreateConversation,
        sendMessage,
        markAsRead,
        setTypingStatus,
        addReaction
    };

    return (
        <ChatContext.Provider value={value}>
            {children}
        </ChatContext.Provider>
    );
};
