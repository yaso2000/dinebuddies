import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import {
    collection,
    query,
    where,
    orderBy,
    onSnapshot,
    addDoc,
    updateDoc,
    setDoc,
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
import { useInvitations } from './InvitationContext';
import { useToast } from './ToastContext';
import { getSafeAvatar } from '../utils/avatarUtils';
import { notifyNewMessage } from '../utils/notificationHelpers';
import { asUidArray, messagingRestrictedBetweenUsers } from '../utils/userSocialLists';
import { checkCanMessage, resolveCanMessageMap } from '../utils/chatHelpers';

function isBusinessAccountProfile(data) {
    if (!data) return false;
    const role = String(data.role || '').toLowerCase();
    return role === 'business' || role === 'partner' || data.isBusiness === true;
}

/** Business ↔ community member channel (joinedCommunities and/or communityMembers). */
function isBusinessMemberMessagingChannel(viewerUid, viewerData, otherUid, otherData) {
    if (!viewerUid || !otherUid) return false;
    const viewerIsBusiness = isBusinessAccountProfile(viewerData);
    const otherIsBusiness = isBusinessAccountProfile(otherData);
    const otherJoined = Array.isArray(otherData?.joinedCommunities) ? otherData.joinedCommunities : [];
    const viewerJoined = Array.isArray(viewerData?.joinedCommunities) ? viewerData.joinedCommunities : [];
    const viewerMembers = Array.isArray(viewerData?.communityMembers) ? viewerData.communityMembers : [];
    const otherMembers = Array.isArray(otherData?.communityMembers) ? otherData.communityMembers : [];
    return (
        (viewerIsBusiness && (otherJoined.includes(viewerUid) || viewerMembers.includes(otherUid))) ||
        (otherIsBusiness && (viewerJoined.includes(otherUid) || otherMembers.includes(viewerUid)))
    );
}

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
    const { currentUser: invitationUser } = useInvitations();
    const { showToast } = useToast();
    const createOrGetConversationCallableRef = useRef(null);
    const conversationEnsureCacheRef = useRef(new Map());
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
                                const isSupport =
                                    userData.isSystemAccount === true || data.isSupportThread === true;
                                otherUser = {
                                    uid: otherUserId,
                                    displayName: isSupport
                                        ? data.supportDisplayName || 'DineBuddies Support'
                                        : userData.display_name || userData.displayName || userData.email || 'User',
                                    photoURL: getSafeAvatar(userData),
                                    isOnline: userData.isOnline || false,
                                    lastSeen: userData.lastSeen || null,
                                    isSystemAccount: isSupport,
                                    following: userData.following || [],
                                };
                                userProfileCache.current.set(otherUserId, otherUser);
                            }
                        }
                    }

                    // Calculate unread count
                    const unreadBy = data.unreadBy || [];
                    const isUnread = unreadBy.includes(currentUser.uid);

                    convos.push({
                        id: docSnap.id,
                        ...data,
                        otherUser,
                        isUnread
                    });
                }

                const viewerFollowing =
                    invitationUser?.following || userProfile?.following || [];
                const permissionTargets = convos
                    .filter((c) => c.otherUser?.uid && !c.otherUser?.isSystemAccount && !c.isSupportThread)
                    .map((c) => ({ id: c.otherUser.uid, following: c.otherUser.following || [] }));
                const permissionMap = await resolveCanMessageMap(
                    currentUser.uid,
                    permissionTargets,
                    viewerFollowing
                );
                const gatedConvos = convos.filter((c) => {
                    const otherId = c.otherUser?.uid;
                    if (!otherId) return false;
                    if (c.otherUser?.isSystemAccount || c.isSupportThread) return true;
                    return permissionMap[otherId] === true;
                });

                setConversations(gatedConvos);
                conversationsRef.current = gatedConvos;
                setUnreadCount(
                    gatedConvos.reduce((sum, c) => sum + (c.isUnread ? 1 : 0), 0)
                );
                setLoading(false);
            },
            (error) => {
                console.error('Error loading conversations:', error);
                showToast('Failed to load conversations. Try again.', 'error');
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, [
        currentUser?.uid,
        userProfile?.blockedUserIds,
        userProfile?.mutedUserIds,
        userProfile?.following,
        invitationUser?.following,
    ]);

    // Create or get conversation — deduped per pair so parallel callers share one request.
    const getOrCreateConversation = useCallback(async (otherUserId) => {
        if (!currentUser?.uid || !otherUserId) return null;

        const pairKey = [currentUser.uid, otherUserId].sort().join('_');
        const cache = conversationEnsureCacheRef.current;
        const cached = cache.get(pairKey);
        if (cached?.conversationId) return cached.conversationId;
        if (cached?.promise) return cached.promise;

        const promise = (async () => {
            const ensureClientConversation = async () => {
                const conversationId = [currentUser.uid, otherUserId].sort().join('_');
                const convRef = doc(db, 'conversations', conversationId);
                const snap = await getDoc(convRef);
                if (!snap.exists()) {
                    await setDoc(convRef, {
                        participants: [currentUser.uid, otherUserId].sort(),
                        createdAt: serverTimestamp(),
                        lastMessageTime: serverTimestamp(),
                        lastMessage: null,
                        unreadBy: [],
                        isBusinessMemberThread: true,
                        businessId: isBusinessAccountProfile(userProfile) ? currentUser.uid : otherUserId,
                    });
                }
                return conversationId;
            };

            try {
                const result = await createOrGetConversationCallableRef.current({ otherUserId });
                return result?.data?.conversationId || null;
            } catch (error) {
                cache.delete(pairKey);
                const code = error?.code || error?.message || '';
                const msg = error?.message || '';
                console.error('Error creating conversation:', code, msg, error);

                // Older CF may still require Connect — open business↔member threads client-side.
                if (error?.code === 'functions/failed-precondition') {
                    try {
                        const otherSnap = await getDoc(doc(db, 'users', otherUserId));
                        const otherData = otherSnap.exists() ? otherSnap.data() : {};
                        const viewerData = {
                            ...(userProfile || {}),
                            joinedCommunities:
                                invitationUser?.joinedCommunities || userProfile?.joinedCommunities || [],
                            communityMembers: userProfile?.communityMembers || [],
                        };
                        if (
                            isBusinessMemberMessagingChannel(
                                currentUser.uid,
                                viewerData,
                                otherUserId,
                                otherData
                            )
                        ) {
                            return await ensureClientConversation();
                        }
                    } catch (fallbackErr) {
                        console.error('Client conversation fallback failed:', fallbackErr);
                    }
                    return null;
                }
                if (error?.code === 'functions/unauthenticated') {
                    showToast('Please sign in to start a conversation.', 'error');
                } else if (error?.code === 'functions/resource-exhausted') {
                    showToast('Please wait a moment and try again.', 'error');
                } else {
                    showToast('Failed to start conversation. Try again.', 'error');
                }
                return null;
            }
        })();

        cache.set(pairKey, { promise });
        const conversationId = await promise;
        if (conversationId) {
            cache.set(pairKey, { conversationId });
        } else {
            cache.delete(pairKey);
        }
        return conversationId;
    }, [currentUser?.uid, userProfile, invitationUser?.joinedCommunities, showToast]);

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
                const otherData = otherSnap.data() || {};
                const { restricted } = messagingRestrictedBetweenUsers(
                    userProfile,
                    currentUser.uid,
                    otherData,
                    otherUserIdPre
                );
                if (restricted) {
                    showToast('Messaging is not available with this user.', 'error');
                    return null;
                }
                const viewerFollowing =
                    invitationUser?.following || userProfile?.following || [];
                const isSupportPeer =
                    userProfile?.isSystemAccount === true || otherData.isSystemAccount === true;
                const viewerData = {
                    ...(userProfile || {}),
                    joinedCommunities: Array.isArray(invitationUser?.joinedCommunities)
                        ? invitationUser.joinedCommunities
                        : Array.isArray(userProfile?.joinedCommunities)
                          ? userProfile.joinedCommunities
                          : [],
                    communityMembers: Array.isArray(userProfile?.communityMembers)
                        ? userProfile.communityMembers
                        : [],
                };
                const isBusinessMemberChannel = isBusinessMemberMessagingChannel(
                    currentUser.uid,
                    viewerData,
                    otherUserIdPre,
                    otherData
                );
                if (!isSupportPeer && !isBusinessMemberChannel) {
                    const allowed = await checkCanMessage(
                        currentUser.uid,
                        otherUserIdPre,
                        viewerFollowing,
                        otherData.following || []
                    );
                    if (!allowed) {
                        showToast(
                            'Messaging is locked. A mutual connection is required.',
                            'error'
                        );
                        return null;
                    }
                }
            }

            const messageRef = await addDoc(
                collection(db, 'conversations', conversationId, 'messages'),
                {
                    senderId: currentUser.uid,
                    ...messageData,
                    createdAt: serverTimestamp(),
                    status: 'sent', // sent, delivered, read
                    deliveredTo: [],
                    readBy: [],
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
