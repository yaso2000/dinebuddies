import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import {
    collection,
    query,
    where,
    orderBy,
    onSnapshot,
    addDoc,
    updateDoc,
    deleteDoc,
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
    const createGroupConversationCallableRef = useRef(null);
    if (!createGroupConversationCallableRef.current) {
        createGroupConversationCallableRef.current = httpsCallable(getFunctions(), 'createGroupConversation');
    }
    const invitationConversationCallableRef = useRef(null);
    if (!invitationConversationCallableRef.current) {
        invitationConversationCallableRef.current = httpsCallable(getFunctions(), 'getOrCreateInvitationConversation');
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

                    // Dating conversations live in their own (dating) inbox — never the social one.
                    if (data.context === 'dating') {
                        continue;
                    }

                    const isGroupConvo = data.isGroup === true;
                    const otherUserId = isGroupConvo
                        ? null
                        : data.participants.find(id => id !== currentUser.uid);

                    if (otherUserId && (myBlocked.has(otherUserId) || myMuted.has(otherUserId))) {
                        continue;
                    }

                    // Normal (WhatsApp-style) group: no single "other user" — carry a
                    // lightweight group descriptor the inbox row renders instead.
                    let group = null;
                    if (isGroupConvo) {
                        group = {
                            id: docSnap.id,
                            name: data.groupName || 'Group',
                            memberIds: Array.isArray(data.participants) ? data.participants : [],
                            adminId: data.adminId || null,
                        };
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
                        group,
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
                    // Groups are membership-gated server-side; keep any group the
                    // viewer is a participant of.
                    if (c.isGroup) {
                        return Array.isArray(c.participants) && c.participants.includes(currentUser.uid);
                    }
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
            try {
                const result = await createOrGetConversationCallableRef.current({ otherUserId });
                return result?.data?.conversationId || null;
            } catch (error) {
                cache.delete(pairKey);
                const code = error?.code || error?.message || '';
                const msg = error?.message || '';
                console.error('Error creating conversation:', code, msg, error);

                if (error?.code === 'functions/unauthenticated') {
                    showToast('Please sign in to start a conversation.', 'error');
                } else if (error?.code === 'functions/resource-exhausted') {
                    showToast('Please wait a moment and try again.', 'error');
                } else if (error?.code === 'functions/failed-precondition') {
                    showToast('You cannot start this conversation.', 'error');
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

    // Create a normal group chat (WhatsApp-style, invite-only) via the trusted callable.
    const createGroupConversation = useCallback(async ({ memberIds, name }) => {
        if (!currentUser?.uid) return null;
        try {
            const result = await createGroupConversationCallableRef.current({ memberIds, name });
            return result?.data?.conversationId || null;
        } catch (error) {
            console.error('createGroupConversation', error?.code, error?.message, error);
            showToast(error?.message || 'Failed to create group. Try again.', 'error');
            return null;
        }
    }, [currentUser?.uid, showToast]);

    // Invitation-driven chat: the server decides 1:1 vs group from the invitee
    // count and returns where to route. { type:'direct', otherUserId } or
    // { type:'group', conversationId }.
    const getOrCreateInvitationConversation = useCallback(async (invitationId) => {
        if (!currentUser?.uid || !invitationId) return null;
        try {
            const result = await invitationConversationCallableRef.current({ invitationId });
            return result?.data || null;
        } catch (error) {
            console.error('getOrCreateInvitationConversation', error?.code, error?.message, error);
            showToast(error?.message || 'Failed to open chat. Try again.', 'error');
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
            const isGroupConvo = convoDataPre?.isGroup === true;
            // Group membership gate (normal WhatsApp-style group). The 1:1
            // mutual-follow gate below does not apply to groups.
            if (isGroupConvo) {
                const members = Array.isArray(convoDataPre?.participants) ? convoDataPre.participants : [];
                if (!members.includes(currentUser.uid)) {
                    showToast('You are not a member of this group.', 'error');
                    return null;
                }
            }
            const otherUserIdPre = isGroupConvo ? null : convoDataPre?.participants?.find((id) => id !== currentUser.uid);
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
                if (!isSupportPeer) {
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
                    senderName: userProfile?.display_name || userProfile?.displayName || 'Someone',
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
            const participants = Array.isArray(convoData.participants) ? convoData.participants : [];
            // Everyone except the sender gets marked unread (works for 1:1 and groups).
            const recipients = participants.filter((id) => id && id !== currentUser.uid);

            await updateDoc(convoRef, {
                lastMessage: messageData.type === 'text' ? messageData.text : `📎 ${messageData.type}`,
                lastMessageTime: serverTimestamp(),
                unreadBy: arrayUnion(...(recipients.length ? recipients : [currentUser.uid]))
            });

            // Send push notification to each recipient (fire-and-forget)
            // (Creates a notification doc, which then triggers the single onNotificationCreated Cloud Function
            // that correctly extracts the sender's avatar and respects user preferences)
            if (recipients.length) {
                const senderName = userProfile?.display_name || userProfile?.displayName || 'Someone';
                const groupName = isGroupConvo ? (convoData.groupName || 'Group') : null;
                const rawPreview = messageData.type === 'text'
                    ? (messageData.text || '').slice(0, 80)
                    : '📎 Media';
                // In a group, prefix the sender so the notification reads like a group chat.
                const preview = groupName ? `${senderName}: ${rawPreview}` : rawPreview;
                const sender = groupName
                    ? { name: groupName, id: currentUser.uid }
                    : { name: senderName, id: currentUser.uid };
                recipients.forEach((rid) => {
                    notifyNewMessage(rid, sender, preview).catch(() => { });
                });
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

    const deleteMessage = async (conversationId, messageId) => {
        if (!currentUser?.uid) return;
        try {
            await deleteDoc(doc(db, 'conversations', conversationId, 'messages', messageId));
        } catch (error) {
            console.error('Error deleting message:', error);
            showToast('Failed to delete message.', 'error');
        }
    };

    const value = {
        conversations,
        loading,
        unreadCount,
        getOrCreateConversation,
        createGroupConversation,
        getOrCreateInvitationConversation,
        sendMessage,
        markAsRead,
        setTypingStatus,
        addReaction,
        deleteMessage
    };

    return (
        <ChatContext.Provider value={value}>
            {children}
        </ChatContext.Provider>
    );
};
