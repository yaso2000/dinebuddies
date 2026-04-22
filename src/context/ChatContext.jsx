import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
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
    arrayUnion,
    arrayRemove,
    limit
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db } from '../firebase/config';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';
import { getSafeAvatar } from '../utils/avatarUtils';
import { notifyNewMessage } from '../utils/notificationHelpers';
import { asUidArray, messagingRestrictedBetweenUsers } from '../utils/userSocialLists';

const ChatContext = createContext();

export const useChat = () => {
    const context = useContext(ChatContext);
    if (!context) {
        throw new Error('useChat must be used within ChatProvider');
    }
    return context;
};

export const ChatProvider = ({ children }) => {
    const { currentUser, userProfile } = useAuth();
    const { showToast } = useToast();
    const createOrGetConversationCallableRef = useRef(null);
    if (!createOrGetConversationCallableRef.current) {
        createOrGetConversationCallableRef.current = httpsCallable(getFunctions(), 'createOrGetConversation');
    }
    const [conversations, setConversations] = useState([]);
    const conversationsRef = useRef([]);
    const [loading, setLoading] = useState(true);
    const [unreadCount, setUnreadCount] = useState(0);
    const userProfileCache = useRef(new Map()); // Cache otherUser profiles to avoid N getDocs per snapshot

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

                const myBlocked = new Set(asUidArray(userProfile?.blockedUserIds));
                const myMuted = new Set(asUidArray(userProfile?.mutedUserIds));

                for (const docSnap of snapshot.docs) {
                    const data = docSnap.data();
                    const otherUserId = data.participants.find(id => id !== currentUser.uid);

                    if (otherUserId && (myBlocked.has(otherUserId) || myMuted.has(otherUserId))) {
                        continue;
                    }

                    // Get other user's data (cache to avoid N getDocs per snapshot fire)
                    let otherUser = null;
                    if (otherUserId) {
                        const cached = userProfileCache.current.get(otherUserId);
                        if (cached) {
                            otherUser = cached;
                        } else {
                            const userDoc = await getDoc(doc(db, 'users', otherUserId));
                            if (userDoc.exists()) {
                                const userData = userDoc.data();
                                otherUser = {
                                    uid: otherUserId,
                                    displayName: userData.display_name || userData.email || 'User',
                                    photoURL: getSafeAvatar(userData),
                                    isOnline: userData.isOnline || false,
                                    lastSeen: userData.lastSeen || null
                                };
                                userProfileCache.current.set(otherUserId, otherUser);
                            }
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
                conversationsRef.current = convos;
                setUnreadCount(totalUnread);
                setLoading(false);
            },
            (error) => {
                console.error('Error loading conversations:', error);
                showToast('Failed to load conversations. Try again.', 'error');
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, [currentUser?.uid, userProfile?.blockedUserIds, userProfile?.mutedUserIds]);

    // Create or get conversation (stable reference to avoid effect re-runs and 429 rate limit)
    const getOrCreateConversation = useCallback(async (otherUserId) => {
        if (!currentUser?.uid) return null;

        // 1. FAST PATH: Check local cache first to avoid slow Cloud Function cold starts
        const existing = conversationsRef.current.find(c => 
            c.participants && c.participants.includes(otherUserId)
        );
        if (existing) {
            return existing.id;
        }

        // 2. SLOW PATH: Fallback to Cloud Function securely
        try {
            const result = await createOrGetConversationCallableRef.current({ otherUserId });
            return result?.data?.conversationId || null;
        } catch (error) {
            const code = error?.code || error?.message || '';
            const msg = error?.message || '';
            console.error('Error creating conversation:', code, msg, error);
            if (error?.code === 'functions/unauthenticated') {
                showToast('Please sign in to start a conversation.', 'error');
            } else if (error?.code === 'functions/resource-exhausted') {
                showToast('Please wait a moment and try again.', 'error');
            } else {
                showToast('Failed to start conversation. Try again.', 'error');
            }
            return null;
        }
    }, [currentUser?.uid, showToast]);

    // Send message
    const sendMessage = async (conversationId, messageData) => {
        if (!currentUser?.uid) return null;

        try {
            const convoRefPre = doc(db, 'conversations', conversationId);
            const convoSnapPre = await getDoc(convoRefPre);
            const convoDataPre = convoSnapPre.data();
            const otherUserIdPre = convoDataPre?.participants?.find((id) => id !== currentUser.uid);
            if (otherUserIdPre) {
                const otherSnap = await getDoc(doc(db, 'users', otherUserIdPre));
                const { restricted } = messagingRestrictedBetweenUsers(
                    userProfile,
                    currentUser.uid,
                    otherSnap.data(),
                    otherUserIdPre
                );
                if (restricted) {
                    showToast('Messaging is not available with this user.', 'error');
                    return null;
                }
            }

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

            // Send push notification to the recipient (fire-and-forget)
            // (Creates a notification doc, which then triggers the single onNotificationCreated Cloud Function
            // that correctly extracts the sender's avatar and respects user preferences)
            if (otherUserId) {
                const senderName = userProfile?.display_name || userProfile?.displayName || 'Someone';
                const preview = messageData.type === 'text'
                    ? (messageData.text || '').slice(0, 80)
                    : '📎 Media';
                
                notifyNewMessage(
                    otherUserId,
                    { name: senderName, id: currentUser.uid },
                    preview
                ).catch(() => { });
            }

            return messageRef.id;
        } catch (error) {
            console.error('Error sending message:', error);
            showToast('Failed to send message. Try again.', 'error');
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
