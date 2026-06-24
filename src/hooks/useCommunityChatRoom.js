import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    getDocs,
    onSnapshot,
    orderBy,
    query,
    serverTimestamp,
    setDoc,
    updateDoc,
    where,
    writeBatch,
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useTranslation } from 'react-i18next';
import app, { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { getSafeAvatar } from '../utils/avatarUtils';
import { uploadImage } from '../utils/mediaUtils';
import { notifyImageUploadError } from '../utils/imageModerationErrors';
import { createNotification } from '../utils/notificationHelpers';
import {
    buildBannerImageUpdate,
    buildBannerClearImageUpdate,
    buildBannerYoutubeUpdate,
    buildBannerUpdate,
    mergeBannerPatch,
    normalizeCommunityBanner,
    sanitizeBannerAxis,
} from '../utils/communityChatBanner';
import { buildReplyFields } from '../utils/communityChatReply';
import { resolveCommunityBannerDisplay } from '../utils/communityBannerDisplay';
import { DEFAULT_HOST_SPOTLIGHT_POS } from '../utils/communityHostSpotlightPosition';
import {
    resolveNewHostSpotlightPosition,
} from '../utils/communityHostSpotlightPins';

/**
 * Real-time community chat room state (messages + single-slot banner + membership).
 * @param {string | undefined} partnerId — business community owner uid
 */
export function useCommunityChatRoom(partnerId) {
    const { t } = useTranslation();
    const { currentUser, userProfile } = useAuth();
    const { showToast } = useToast();

    const [messages, setMessages] = useState([]);
    const [banner, setBanner] = useState(() => normalizeCommunityBanner(null));
    const [partner, setPartner] = useState(null);
    const [isMember, setIsMember] = useState(false);
    const [isMutedInChat, setIsMutedInChat] = useState(false);
    const [loading, setLoading] = useState(true);
    const [uploadingBanner, setUploadingBanner] = useState(false);
    const [uploadingChatImage, setUploadingChatImage] = useState(false);
    const [pendingReplyTo, setPendingReplyTo] = useState(null);
    const [participants, setParticipants] = useState([]);
    const [participantsLoading, setParticipantsLoading] = useState(false);

    const uid = currentUser?.uid;
    const isHost = Boolean(partnerId && uid && uid === partnerId);
    const functions = getFunctions(app, 'us-central1');

    const bannerDisplay = useMemo(
        () => resolveCommunityBannerDisplay(banner, partner),
        [banner, partner]
    );

    // Partner profile + membership (users/{partnerId})
    useEffect(() => {
        if (!partnerId || !currentUser || !userProfile) {
            setLoading(false);
            return undefined;
        }

        const applyPartnerModeration = (partnerData) => {
            if (!partnerData) return;
            setPartner(partnerData);

            const mutedIds = Array.isArray(partnerData.communityMutedUserIds)
                ? partnerData.communityMutedUserIds
                : [];
            const blockedIds = Array.isArray(partnerData.communityBlockedUserIds)
                ? partnerData.communityBlockedUserIds
                : [];

            if (uid !== partnerId && blockedIds.includes(uid)) {
                setIsMember(false);
                setIsMutedInChat(false);
                return;
            }

            setIsMutedInChat(uid !== partnerId && mutedIds.includes(uid));

            if (uid === partnerId) {
                setIsMember(true);
            } else {
                const joinedCommunities = userProfile.joinedCommunities || [];
                setIsMember(joinedCommunities.includes(partnerId));
            }
        };

        const unsub = onSnapshot(
            doc(db, 'users', partnerId),
            (snap) => {
                if (snap.exists()) applyPartnerModeration(snap.data());
                setLoading(false);
            },
            (err) => {
                console.error('[useCommunityChatRoom] partner snapshot', err);
                setLoading(false);
            }
        );

        return unsub;
    }, [partnerId, currentUser, userProfile, uid]);

    // Single-slot banner on communities/{partnerId}
    useEffect(() => {
        if (!partnerId || !isMember) {
            setBanner(normalizeCommunityBanner(null));
            return undefined;
        }

        const unsub = onSnapshot(
            doc(db, 'communities', partnerId),
            (snap) => {
                setBanner(normalizeCommunityBanner(snap.exists() ? snap.data() : null));
            },
            (err) => {
                console.error('[useCommunityChatRoom] banner snapshot', err);
                setBanner(normalizeCommunityBanner(null));
            }
        );

        return unsub;
    }, [partnerId, isMember]);

    // Messages subcollection
    useEffect(() => {
        if (!isMember || !partnerId) {
            setMessages([]);
            return undefined;
        }

        const q = query(
            collection(db, 'communities', partnerId, 'messages'),
            orderBy('createdAt', 'asc')
        );

        const unsub = onSnapshot(q, (snapshot) => {
            setMessages(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
        });

        return unsub;
    }, [partnerId, isMember]);

    const memberIdsKey = (partner?.communityMembers || []).join(',');

    // Community participants — live profile + isOnline from users/{uid}
    useEffect(() => {
        if (!partnerId || !isMember) {
            setParticipants([]);
            setParticipantsLoading(false);
            return undefined;
        }

        const memberIds = Array.isArray(partner?.communityMembers) ? partner.communityMembers : [];
        const uniqueIds = [...new Set([partnerId, ...memberIds.filter(Boolean)])];

        if (uniqueIds.length === 0) {
            setParticipants([]);
            setParticipantsLoading(false);
            return undefined;
        }

        setParticipantsLoading(true);
        const byId = new Map();

        const publish = () => {
            const rows = [...byId.values()].sort((a, b) => {
                if (a.isHost !== b.isHost) return a.isHost ? -1 : 1;
                if (a.isOnline !== b.isOnline) return a.isOnline ? -1 : 1;
                return a.displayName.localeCompare(b.displayName);
            });
            setParticipants(rows);
            setParticipantsLoading(false);
        };

        const unsubs = uniqueIds.map((memberId) =>
            onSnapshot(
                doc(db, 'users', memberId),
                (snap) => {
                    if (!snap.exists()) {
                        byId.delete(memberId);
                    } else {
                        const data = snap.data();
                        byId.set(memberId, {
                            id: memberId,
                            displayName:
                                data.display_name ||
                                data.name ||
                                data.displayName ||
                                'User',
                            avatar: getSafeAvatar(data),
                            photoURL: data.photo_url || data.photoURL,
                            isOnline: Boolean(data.isOnline),
                            isHost: memberId === partnerId,
                        });
                    }
                    publish();
                },
                () => {
                    byId.delete(memberId);
                    publish();
                }
            )
        );

        return () => unsubs.forEach((unsub) => unsub());
    }, [partnerId, isMember, memberIdsKey]);

    // Mark community as read
    useEffect(() => {
        if (!isMember || !partnerId || !uid) return undefined;

        void updateDoc(doc(db, 'users', uid), {
            [`communityLastRead.${partnerId}`]: serverTimestamp(),
        }).catch(() => {});

        return undefined;
    }, [isMember, partnerId, uid]);

    /** Unpin all host messages (banner edits no longer delete chat history). */
    const unpinAllHostMessages = useCallback(async () => {
        if (!partnerId) return;
        const messagesRef = collection(db, 'communities', partnerId, 'messages');
        const hostQuery = query(messagesRef, where('senderId', '==', partnerId));
        const snap = await getDocs(hostQuery);
        if (snap.empty) return;
        const batch = writeBatch(db);
        snap.docs.forEach((d) => {
            const data = d.data();
            const patch = {};
            if (data?.pinned) patch.pinned = false;
            if (data?.bannerSpotlight) patch.bannerSpotlight = false;
            if (Object.keys(patch).length) batch.update(d.ref, patch);
        });
        await batch.commit();
    }, [partnerId]);

    const replaceBanner = useCallback(
        async (fields) => {
            if (!isHost || !partnerId) return;
            const payload = {
                ...fields,
                banner_updated_at: serverTimestamp(),
                ownerId: partnerId,
            };
            if (Object.prototype.hasOwnProperty.call(fields, 'banner_youtube_id')) {
                const ytId = String(fields.banner_youtube_id || '').trim();
                if (/^[a-zA-Z0-9_-]{11}$/.test(ytId)) {
                    payload.banner_youtube_sync_at = serverTimestamp();
                } else if (!ytId) {
                    payload.banner_youtube_sync_at = null;
                }
            }
            await setDoc(doc(db, 'communities', partnerId), payload, { merge: true });
        },
        [isHost, partnerId]
    );

    const syncYoutubePlayback = useCallback(async () => {
        if (!isHost || !partnerId || !banner.youtubeId) return;
        try {
            await setDoc(
                doc(db, 'communities', partnerId),
                {
                    banner_youtube_sync_at: serverTimestamp(),
                    ownerId: partnerId,
                },
                { merge: true }
            );
        } catch (err) {
            console.error('[useCommunityChatRoom] youtube sync', err);
        }
    }, [isHost, partnerId, banner.youtubeId]);

    const setBannerImage = useCallback(
        async (file) => {
            if (!file || !isHost || !partnerId || !uid) return;
            setUploadingBanner(true);
            try {
                await unpinAllHostMessages();
                const url = await uploadImage(file, uid);
                await replaceBanner(buildBannerImageUpdate(url));
            } catch (err) {
                console.error('[useCommunityChatRoom] banner image', err);
                notifyImageUploadError(showToast, err, t);
            } finally {
                setUploadingBanner(false);
            }
        },
        [isHost, partnerId, uid, replaceBanner, unpinAllHostMessages, showToast, t]
    );

    const clearBannerImage = useCallback(async () => {
        if (!isHost || !partnerId) return false;
        if (!String(banner.url || '').trim()) return false;
        try {
            await replaceBanner(buildBannerClearImageUpdate());
            return true;
        } catch (err) {
            console.error('[useCommunityChatRoom] clear banner image', err);
            showToast(t('failed_send_message', 'Failed to send. Please try again.'), 'error');
            return false;
        }
    }, [banner.url, isHost, partnerId, replaceBanner, showToast, t]);

    const setBannerYoutube = useCallback(
        async (videoId, { isShort = false } = {}) => {
            if (!isHost || !partnerId) return false;
            const id = String(videoId || '').trim();
            try {
                if (id) {
                    await unpinAllHostMessages();
                }
                await replaceBanner(buildBannerYoutubeUpdate(id, { isShort }));
                return true;
            } catch (err) {
                console.error('[useCommunityChatRoom] banner youtube', err);
                showToast(t('failed_send_message', 'Failed to send. Please try again.'), 'error');
                return false;
            }
        },
        [isHost, partnerId, replaceBanner, unpinAllHostMessages, showToast, t]
    );

    const updateBanner = useCallback(
        async (patch, { clearSpotlight = false } = {}) => {
            if (!isHost || !partnerId) return false;
            if (!patch || Object.keys(patch).length === 0) return false;

            const merged = mergeBannerPatch(banner, patch);

            try {
                if (clearSpotlight) {
                    await unpinAllHostMessages();
                }
                await replaceBanner(buildBannerUpdate(merged));
                return true;
            } catch (err) {
                console.error('[useCommunityChatRoom] banner update', err);
                showToast(t('failed_send_message', 'Failed to send. Please try again.'), 'error');
                return false;
            }
        },
        [banner, isHost, partnerId, replaceBanner, unpinAllHostMessages, showToast, t]
    );

    const detectBigEmoji = useCallback((text) => {
        const trimmed = String(text || '').trim();
        try {
            const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
            const graphemes = Array.from(segmenter.segment(trimmed));
            return (
                graphemes.length === 1 &&
                /^(\p{Emoji_Presentation}|\p{Emoji}\uFE0F|\p{Emoji_Modifier_Base}\p{Emoji_Modifier}?|\p{Emoji_Component})+$/u.test(
                    trimmed
                )
            );
        } catch {
            return (
                Array.from(trimmed).length <= 2 &&
                /^(\p{Emoji_Presentation}|\p{Emoji}\uFE0F|\p{Emoji_Modifier_Base}\p{Emoji_Modifier}?|\p{Emoji_Component})+$/u.test(
                    trimmed
                )
            );
        }
    }, []);

    const postChatMessage = useCallback(
        async ({ text, type = 'text', replyTo = null }) => {
            if (!partnerId || !uid) return false;

            if (isMutedInChat) {
                showToast(
                    t('community_chat_muted', 'You are muted in this community chat.'),
                    'error'
                );
                return false;
            }

            try {
                const messagesRef = collection(db, 'communities', partnerId, 'messages');
                const spotlightDefault =
                    uid === partnerId
                        ? resolveNewHostSpotlightPosition({
                              hasTitle: Boolean(banner?.title),
                          })
                        : {
                              x: DEFAULT_HOST_SPOTLIGHT_POS.x,
                              y: DEFAULT_HOST_SPOTLIGHT_POS.y,
                          };
                const messagePayload = {
                    text,
                    senderId: uid,
                    senderName: userProfile?.display_name || currentUser.displayName || 'User',
                    senderAvatar: getSafeAvatar(userProfile || currentUser),
                    senderGender:
                        userProfile?.gender ||
                        currentUser?.gender ||
                        userProfile?.genderIdentity ||
                        '',
                    createdAt: serverTimestamp(),
                    type,
                    pinned: false,
                    bannerSpotlight: false,
                    spotlightX: sanitizeBannerAxis(spotlightDefault.x),
                    spotlightY: sanitizeBannerAxis(spotlightDefault.y),
                    ...buildReplyFields(replyTo),
                };

                await addDoc(messagesRef, messagePayload);

                if (uid === partnerId && banner?.hostSpotlightAuto) {
                    await setDoc(
                        doc(db, 'communities', partnerId),
                        { host_spotlight_dismissed: false, ownerId: partnerId },
                        { merge: true }
                    );
                }

                if (uid !== partnerId) {
                    void createNotification({
                        userId: partnerId,
                        type: 'message',
                        title: userProfile?.display_name || 'New message in your community',
                        message:
                            type === 'image'
                                ? t('community_chat_image_notification', 'Sent a photo')
                                : String(text).slice(0, 80),
                        actionUrl: `/community/${partnerId}`,
                    });
                }

                return true;
            } catch (err) {
                console.error('[useCommunityChatRoom] postChatMessage', err);
                showToast(t('failed_send_message', 'Failed to send. Please try again.'), 'error');
                return false;
            }
        },
        [
            partnerId,
            uid,
            isMutedInChat,
            userProfile,
            currentUser,
            showToast,
            t,
            banner,
        ]
    );

    const sendMessage = useCallback(
        async (text) => {
            const trimmed = String(text || '').trim();
            if (!trimmed) return false;

            const isBigEmoji = detectBigEmoji(trimmed);
            const replyTo = pendingReplyTo;
            if (replyTo) {
                setPendingReplyTo(null);
            }

            return postChatMessage({
                text: trimmed,
                type: isBigEmoji ? 'emoji-big' : 'text',
                replyTo,
            });
        },
        [detectBigEmoji, postChatMessage, pendingReplyTo]
    );

    const sendImageMessage = useCallback(
        async (file) => {
            if (!file || !partnerId || !uid) return false;

            setUploadingChatImage(true);
            try {
                const url = await uploadImage(file, uid);
                const replyTo = pendingReplyTo;
                if (replyTo) {
                    setPendingReplyTo(null);
                }
                return await postChatMessage({ text: url, type: 'image', replyTo });
            } catch (err) {
                console.error('[useCommunityChatRoom] sendImageMessage', err);
                notifyImageUploadError(showToast, err, t);
                return false;
            } finally {
                setUploadingChatImage(false);
            }
        },
        [partnerId, uid, postChatMessage, showToast, t, pendingReplyTo]
    );

    const deleteChatMessage = useCallback(
        async (message) => {
            if (!partnerId || !message?.id) return false;

            const canDelete = isHost || message.senderId === uid;
            if (!canDelete) return false;

            try {
                await deleteDoc(doc(db, 'communities', partnerId, 'messages', message.id));
                if (pendingReplyTo?.id === message.id) {
                    setPendingReplyTo(null);
                }
                return true;
            } catch (err) {
                console.error('[useCommunityChatRoom] deleteChatMessage', err);
                showToast(t('failed_send_message', 'Failed to send. Please try again.'), 'error');
                return false;
            }
        },
        [isHost, partnerId, uid, pendingReplyTo, showToast, t]
    );

    const startReplyToMessage = useCallback(
        (message) => {
            if (!isHost || !message?.id) return;
            setPendingReplyTo(message);
        },
        [isHost]
    );

    const cancelReplyToMessage = useCallback(() => {
        setPendingReplyTo(null);
    }, []);

    const muteMemberInChat = useCallback(
        async (memberId) => {
            if (!isHost || !partnerId || !memberId || memberId === partnerId) return false;

            const confirmMute = window.confirm(
                t(
                    'mute_member_confirm',
                    'Mute this member? They can read the chat but cannot write or react.'
                )
            );
            if (!confirmMute) return false;

            try {
                const setCommunityMembership = httpsCallable(functions, 'setCommunityMembership');
                await setCommunityMembership({ partnerId, action: 'muteMember', memberId });
                showToast(t('member_muted_success', 'Member muted in group chat'), 'success');
                return true;
            } catch (err) {
                console.error('[useCommunityChatRoom] muteMemberInChat', err);
                showToast(t('member_mute_error', 'Failed to update mute status'), 'error');
                return false;
            }
        },
        [isHost, partnerId, functions, showToast, t]
    );

    const deleteHostSpotlightMessage = useCallback(
        async (messageId) => {
            if (!isHost || !partnerId || !messageId) return false;

            try {
                await deleteDoc(doc(db, 'communities', partnerId, 'messages', messageId));
                return true;
            } catch (err) {
                console.error('[useCommunityChatRoom] deleteHostSpotlightMessage', err);
                showToast(t('failed_send_message', 'Failed to send. Please try again.'), 'error');
                return false;
            }
        },
        [isHost, partnerId, showToast, t]
    );

    const pinHostMessage = useCallback(
        async (messageId) => {
            if (!isHost || !partnerId || !messageId) return false;
            try {
                const hostMessages = messages.filter((m) => m.senderId === partnerId);
                const target = hostMessages.find((m) => m.id === messageId);
                if (!target) return false;

                const batch = writeBatch(db);
                hostMessages.forEach((m) => {
                    batch.update(doc(db, 'communities', partnerId, 'messages', m.id), {
                        pinned: m.id === messageId,
                    });
                });
                await batch.commit();
                return true;
            } catch (err) {
                console.error('[useCommunityChatRoom] pinHostMessage', err);
                showToast(t('failed_send_message', 'Failed to send. Please try again.'), 'error');
                return false;
            }
        },
        [isHost, messages, partnerId, showToast, t]
    );

    const unpinHostMessage = useCallback(
        async (messageId) => {
            if (!isHost || !partnerId || !messageId) return false;
            try {
                await updateDoc(doc(db, 'communities', partnerId, 'messages', messageId), {
                    pinned: false,
                });
                return true;
            } catch (err) {
                console.error('[useCommunityChatRoom] unpinHostMessage', err);
                return false;
            }
        },
        [isHost, partnerId]
    );

    const showMessageOnBanner = useCallback(
        async (messageId) => {
            if (!isHost || !partnerId || !messageId) return false;
            try {
                const hostMessages = messages.filter((m) => m.senderId === partnerId);
                const target = hostMessages.find((m) => m.id === messageId);
                if (!target) return false;

                const batch = writeBatch(db);
                hostMessages.forEach((m) => {
                    batch.update(doc(db, 'communities', partnerId, 'messages', m.id), {
                        bannerSpotlight: m.id === messageId,
                    });
                });
                await batch.commit();
                await setDoc(
                    doc(db, 'communities', partnerId),
                    { host_spotlight_dismissed: false, ownerId: partnerId },
                    { merge: true }
                );
                return true;
            } catch (err) {
                console.error('[useCommunityChatRoom] showMessageOnBanner', err);
                showToast(t('failed_send_message', 'Failed to send. Please try again.'), 'error');
                return false;
            }
        },
        [isHost, messages, partnerId, showToast, t]
    );

    const hideMessageFromBanner = useCallback(
        async (messageId) => {
            if (!isHost || !partnerId) return false;
            try {
                if (messageId) {
                    await updateDoc(doc(db, 'communities', partnerId, 'messages', messageId), {
                        bannerSpotlight: false,
                    });
                }
                await setDoc(
                    doc(db, 'communities', partnerId),
                    { host_spotlight_dismissed: true, ownerId: partnerId },
                    { merge: true }
                );
                return true;
            } catch (err) {
                console.error('[useCommunityChatRoom] hideMessageFromBanner', err);
                return false;
            }
        },
        [isHost, partnerId]
    );

    const updateHostSpotlightPosition = useCallback(
        async (messageId, x, y) => {
            if (!isHost || !partnerId || !messageId) return false;

            try {
                await updateDoc(doc(db, 'communities', partnerId, 'messages', messageId), {
                    spotlightX: sanitizeBannerAxis(x),
                    spotlightY: sanitizeBannerAxis(y),
                });
                return true;
            } catch (err) {
                console.error('[useCommunityChatRoom] updateHostSpotlightPosition', err);
                return false;
            }
        },
        [isHost, partnerId]
    );

    const setHostSpotlightAuto = useCallback(
        async (enabled) => {
            if (!isHost || !partnerId) return false;
            const next = Boolean(enabled);
            try {
                await setDoc(
                    doc(db, 'communities', partnerId),
                    {
                        host_spotlight_auto: next,
                        host_spotlight_dismissed: !next,
                        ownerId: partnerId,
                    },
                    { merge: true }
                );
                return true;
            } catch (err) {
                console.error('[useCommunityChatRoom] setHostSpotlightAuto', err);
                showToast(t('failed_send_message', 'Failed to send. Please try again.'), 'error');
                return false;
            }
        },
        [isHost, partnerId, showToast, t]
    );

    return {
        loading,
        isMember,
        isHost,
        isMutedInChat,
        partner,
        messages,
        banner,
        bannerDisplay,
        uploadingBanner,
        sendMessage,
        sendImageMessage,
        uploadingChatImage,
        deleteHostSpotlightMessage,
        updateHostSpotlightPosition,
        pinHostMessage,
        unpinHostMessage,
        showMessageOnBanner,
        hideMessageFromBanner,
        setHostSpotlightAuto,
        deleteChatMessage,
        pendingReplyTo,
        startReplyToMessage,
        cancelReplyToMessage,
        muteMemberInChat,
        setBannerImage,
        clearBannerImage,
        setBannerYoutube,
        syncYoutubePlayback,
        updateBanner,
        currentUserId: uid,
        participants,
        participantsLoading,
        partnerId,
    };
}
