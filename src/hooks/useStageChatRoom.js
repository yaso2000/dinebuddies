import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    onSnapshot,
    orderBy,
    query,
    serverTimestamp,
    setDoc,
    Timestamp,
    updateDoc,
    where,
    writeBatch,
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useTranslation } from 'react-i18next';
import app, { auth, db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { useInvitations } from '../context/InvitationContext';
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
    COMMUNITY_CHAT_ZONE_THEME_IDS,
    resolveCommunityChatZoneThemeId,
    buildCommunityChatZoneThemeInlineStyle,
} from '../constants/communityChatZoneThemes';
import {
    normalizeCommunityGuestFrameHexColor,
    resolveCommunityChatGuestFrameBackground,
} from '../constants/communityChatGuestFrameLook';
import { sanitizeBannerBgDensity } from '../utils/communityChatBanner';
import { COMMUNITY_GUEST_FRAME_BACKGROUND_PRESET_IDS } from '../constants/communityGuestFrameBackgrounds';
import { resolveCommunityChatBannerVisible } from '../constants/communityChatBannerMode';
import {
    readGuestCommunityBannerVisible,
    writeGuestCommunityBannerVisible,
} from '../utils/communityChatBannerLocalPref';
import { resolveNewHostSpotlightPosition } from '../utils/communityHostSpotlightPins';
import {
    generateAIDesignStudioImage,
    formatAiErrorMessage,
    isInsufficientCreditsError,
} from '../services/generateAIContent';
import { extractAIImageUrl } from '../utils/aiContentFieldMapper';
import {
    apiImageNeedsClientUpload,
    uploadInvitationMagicCoverFromApiBytes,
} from '../utils/clientInvitationAiCoverUpload';
import { AI_IMAGE_GENERATION_CREDITS } from '../utils/aiCreditCosts';
import { syncMessageReceiptDocs } from '../utils/chatMessageReceipts';

/**
 * Real-time Stage event chat (consumer) — mirrors community chat against stages/{stageId}.
 * @param {string | undefined} stageId
 */
export function useStageChatRoom(stageId) {
    const partnerId = stageId; // room id (UI still uses partnerId)
    const { t } = useTranslation();
    const { currentUser, userProfile } = useAuth();
    const { currentUser: inviteCurrentUser } = useInvitations();
    const { showToast } = useToast();

    const [messages, setMessages] = useState([]);
    const [banner, setBanner] = useState(() => normalizeCommunityBanner(null));
    const [partner, setPartner] = useState(null);
    const [isBlockedFromCommunity, setIsBlockedFromCommunity] = useState(false);
    const [isMutedInChat, setIsMutedInChat] = useState(false);
    const [loading, setLoading] = useState(true);
    const [uploadingBanner, setUploadingBanner] = useState(false);
    const [uploadingChatImage, setUploadingChatImage] = useState(false);
    const [pendingReplyTo, setPendingReplyTo] = useState(null);
    const [participants, setParticipants] = useState([]);
    const [participantsLoading, setParticipantsLoading] = useState(false);
    const [zoneThemeSaving, setZoneThemeSaving] = useState(false);
    const [bannerVisibleSaving, setBannerVisibleSaving] = useState(false);
    const [guestFrameBackgroundUploading, setGuestFrameBackgroundUploading] = useState(false);
    const [guestFrameBackgroundGenerating, setGuestFrameBackgroundGenerating] = useState(false);
    const [isDisplaySession, setIsDisplaySession] = useState(false);
    const latestMessageDocsRef = useRef([]);
    const readReceiptTimeoutRef = useRef(null);

    const uid = auth.currentUser?.uid ?? currentUser?.uid;
    const hostId = partner?.hostId || partner?.ownerId || null;
    const isHost = Boolean(hostId && uid && uid === hostId);
    const functions = getFunctions(app, 'us-central1');
    const joinedStages =
        inviteCurrentUser?.joinedStages ??
        userProfile?.joinedStages ??
        [];

    const isMember = useMemo(() => {
        if (!partnerId || !uid) return false;
        if (isBlockedFromCommunity) return false;
        if (hostId && uid === hostId) return true;
        if (joinedStages.includes(partnerId)) return true;
        const members = Array.isArray(partner?.communityMembers)
            ? partner.communityMembers
            : Array.isArray(partner?.memberIds)
              ? partner.memberIds
              : [];
        return members.includes(uid);
    }, [
        partnerId,
        uid,
        isBlockedFromCommunity,
        joinedStages,
        partner?.communityMembers,
        partner?.memberIds,
        hostId,
    ]);

    useEffect(() => {
        setIsDisplaySession(false);
    }, []);

    const bannerDisplay = useMemo(
        () => resolveCommunityBannerDisplay(banner, partner),
        [banner, partner]
    );

    const zoneThemeId = useMemo(() => resolveCommunityChatZoneThemeId(partner), [partner]);

    const zoneThemeInlineStyle = useMemo(() => {
        const overrides =
            partner?.communityChatZoneThemeTokens ||
            partner?.businessInfo?.communityChatZoneThemeTokens ||
            partner?.businessInfo?.drafts?.communityChatZoneThemeTokens;
        return buildCommunityChatZoneThemeInlineStyle(overrides);
    }, [partner]);

    const guestFrameBackground = useMemo(
        () => resolveCommunityChatGuestFrameBackground(partner),
        [partner]
    );

    const hostBannerVisible = useMemo(() => resolveCommunityChatBannerVisible(partner), [partner]);
    const [guestBannerLocalVisible, setGuestBannerLocalVisible] = useState(true);

    useEffect(() => {
        if (!partnerId || !uid || isHost) return;
        setGuestBannerLocalVisible(readGuestCommunityBannerVisible(uid, partnerId));
    }, [partnerId, uid, isHost]);

    const bannerVisible = useMemo(() => {
        if (hostBannerVisible === false) return false;
        if (isHost) return true;
        return guestBannerLocalVisible !== false;
    }, [hostBannerVisible, isHost, guestBannerLocalVisible]);

    const bannerToggleDisabled = !isHost && hostBannerVisible === false;

    // Stage room doc + host profile (theme/membership on stage; display from host)
    useEffect(() => {
        if (!partnerId || !currentUser) {
            setLoading(false);
            return undefined;
        }

        let unsubStage = () => {};
        let unsubHost = () => {};
        let stageData = null;
        let hostProfile = null;

        const publish = () => {
            if (!stageData) {
                setPartner(null);
                return;
            }
            const stageHostId = stageData.hostId || stageData.ownerId || null;
            const merged = {
                ...(hostProfile || {}),
                ...stageData,
                hostId: stageHostId,
                ownerId: stageHostId,
                id: partnerId,
                display_name:
                    stageData.title ||
                    hostProfile?.display_name ||
                    hostProfile?.displayName ||
                    hostProfile?.name ||
                    'Stage',
                communityMembers: Array.isArray(stageData.memberIds)
                    ? stageData.memberIds
                    : Array.isArray(stageData.communityMembers)
                      ? stageData.communityMembers
                      : [],
            };
            setPartner(merged);

            const mutedIds = Array.isArray(merged.communityMutedUserIds)
                ? merged.communityMutedUserIds
                : [];
            const blockedIds = Array.isArray(merged.communityBlockedUserIds)
                ? merged.communityBlockedUserIds
                : [];
            const viewerIsHost = Boolean(stageHostId && uid === stageHostId);

            if (!viewerIsHost && blockedIds.includes(uid)) {
                setIsBlockedFromCommunity(true);
                setIsMutedInChat(false);
                return;
            }

            setIsBlockedFromCommunity(false);
            setIsMutedInChat(!viewerIsHost && mutedIds.includes(uid));
        };

        setLoading(true);
        unsubStage = onSnapshot(
            doc(db, 'stages', partnerId),
            (snap) => {
                if (!snap.exists()) {
                    stageData = null;
                    setPartner(null);
                    setLoading(false);
                    return;
                }
                stageData = snap.data() || {};
                const stageHostId = stageData.hostId || stageData.ownerId;
                publish();
                setLoading(false);

                if (!stageHostId) return;
                try {
                    unsubHost();
                } catch {
                    /* ignore */
                }
                unsubHost = onSnapshot(
                    doc(db, 'users', stageHostId),
                    (hostSnap) => {
                        hostProfile = hostSnap.exists() ? hostSnap.data() : null;
                        publish();
                    },
                    () => {
                        hostProfile = null;
                        publish();
                    }
                );
            },
            (err) => {
                console.error('[useStageChatRoom] stage snapshot', err);
                setLoading(false);
            }
        );

        return () => {
            try {
                unsubStage();
            } catch {
                /* ignore */
            }
            try {
                unsubHost();
            } catch {
                /* ignore */
            }
        };
    }, [partnerId, currentUser, uid]);

    // Single-slot banner on stages/{stageId}
    useEffect(() => {
        if (!partnerId || !isMember) {
            setBanner(normalizeCommunityBanner(null));
            return undefined;
        }

        const unsub = onSnapshot(
            doc(db, 'stages', partnerId),
            (snap) => {
                setBanner(normalizeCommunityBanner(snap.exists() ? snap.data() : null));
            },
            (err) => {
                console.error('[useStageChatRoom] banner snapshot', err);
                setBanner(normalizeCommunityBanner(null));
            }
        );

        return unsub;
    }, [partnerId, isMember, uid]);

    // Messages subcollection — retry on permission-denied (join race / rules lag)
    useEffect(() => {
        if (!isMember || !partnerId) {
            setMessages([]);
            return undefined;
        }

        let cancelled = false;
        let unsub = null;
        let retryTimer = null;
        let attempt = 0;

        const mapDocs = (snapshot) =>
            snapshot.docs.map((d) => ({
                id: d.id,
                ...d.data({ serverTimestamps: 'estimate' }),
            }));

        const subscribe = () => {
            if (cancelled) return;
            const q = query(
                collection(db, 'stages', partnerId, 'messages'),
                orderBy('createdAt', 'asc')
            );

            unsub = onSnapshot(
                q,
                (snapshot) => {
                    attempt = 0;
                    latestMessageDocsRef.current = snapshot.docs;
                    setMessages(mapDocs(snapshot));
                    if (uid) {
                        void syncMessageReceiptDocs({
                            db,
                            messageDocs: snapshot.docs,
                            viewerId: uid,
                            markRead: false,
                        });
                    }
                },
                (err) => {
                    console.error('[useStageChatRoom] messages snapshot', err);
                    try {
                        unsub?.();
                    } catch {
                        /* ignore */
                    }
                    unsub = null;
                    if (cancelled) return;
                    const code = String(err?.code || '');
                    if (code === 'permission-denied' || code === 'failed-precondition') {
                        attempt += 1;
                        const delay = Math.min(5000, 250 * 1.7 ** Math.min(attempt, 8));
                        retryTimer = window.setTimeout(subscribe, delay);
                    }
                }
            );
        };

        subscribe();

        return () => {
            cancelled = true;
            if (retryTimer) window.clearTimeout(retryTimer);
            try {
                unsub?.();
            } catch {
                /* ignore */
            }
        };
    }, [partnerId, isMember, uid]);

    useEffect(() => {
        if (readReceiptTimeoutRef.current) {
            clearTimeout(readReceiptTimeoutRef.current);
            readReceiptTimeoutRef.current = null;
        }
        if (!isMember || !partnerId || !uid || messages.length === 0 || isDisplaySession) {
            return undefined;
        }
        if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
            return undefined;
        }

        readReceiptTimeoutRef.current = setTimeout(() => {
            void syncMessageReceiptDocs({
                db,
                messageDocs: latestMessageDocsRef.current,
                viewerId: uid,
                markRead: true,
            });
        }, 900);

        return () => {
            if (readReceiptTimeoutRef.current) {
                clearTimeout(readReceiptTimeoutRef.current);
                readReceiptTimeoutRef.current = null;
            }
        };
    }, [isMember, messages, partnerId, uid, isDisplaySession]);

    const memberIdsKey = (partner?.communityMembers || []).join(',');

    // Community participants — live profile + isOnline from users/{uid}
    useEffect(() => {
        if (!partnerId || !isMember) {
            setParticipants([]);
            setParticipantsLoading(false);
            return undefined;
        }

        const memberIds = Array.isArray(partner?.communityMembers) ? partner.communityMembers : [];
        const stageHostId = partner?.hostId || partner?.ownerId || null;
        const uniqueIds = [...new Set([stageHostId, ...memberIds.filter(Boolean)].filter(Boolean))];

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
                            isHost: Boolean(stageHostId && memberId === stageHostId),
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
            [`stageLastRead.${partnerId}`]: serverTimestamp(),
        }).catch(() => {});

        return undefined;
    }, [isMember, partnerId, uid]);

    /** Unpin all host messages (banner edits no longer delete chat history). */
    const unpinAllHostMessages = useCallback(async () => {
        if (!partnerId) return;
        const messagesRef = collection(db, 'stages', partnerId, 'messages');
        const stageHostId = partner?.hostId || partner?.ownerId;
        if (!stageHostId) return;
        const hostQuery = query(messagesRef, where('senderId', '==', stageHostId));
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
                ownerId: hostId || partnerId,
            };
            if (Object.prototype.hasOwnProperty.call(fields, 'banner_youtube_id')) {
                const ytId = String(fields.banner_youtube_id || '').trim();
                if (/^[a-zA-Z0-9_-]{11}$/.test(ytId)) {
                    payload.banner_youtube_sync_at = serverTimestamp();
                } else if (!ytId) {
                    payload.banner_youtube_sync_at = null;
                }
            }
            await setDoc(doc(db, 'stages', partnerId), payload, { merge: true });
        },
        [isHost, partnerId]
    );

    const syncYoutubePlayback = useCallback(async () => {
        if (!isHost || !partnerId || !banner.youtubeId) return;
        try {
            await setDoc(
                doc(db, 'stages', partnerId),
                {
                    banner_youtube_sync_at: serverTimestamp(),
                    ownerId: hostId || partnerId,
                },
                { merge: true }
            );
        } catch (err) {
            console.error('[useStageChatRoom] youtube sync', err);
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
                console.error('[useStageChatRoom] banner image', err);
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
            console.error('[useStageChatRoom] clear banner image', err);
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
                console.error('[useStageChatRoom] banner youtube', err);
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
                console.error('[useStageChatRoom] banner update', err);
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

    const stageStatus = partner?.status || 'active';
    const isStageClosed = stageStatus === 'closed';

    const postChatMessage = useCallback(
        async ({ text, type = 'text', replyTo = null }) => {
            if (!partnerId || !uid) return false;

            if (isStageClosed || stageStatus !== 'active') {
                showToast(
                    t(
                        'stage_closed_cannot_write',
                        'This Stage is closed. The host can reopen it within 24 hours.'
                    ),
                    'error'
                );
                return false;
            }

            if (isMutedInChat) {
                showToast(
                    t('community_chat_muted', 'You are muted in this community chat.'),
                    'error'
                );
                return false;
            }

            try {
                const messagesRef = collection(db, 'stages', partnerId, 'messages');
                const spotlightDefault =
                    uid === hostId
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
                    status: 'sent',
                    deliveredTo: [],
                    readBy: [],
                    pinned: false,
                    bannerSpotlight: false,
                    spotlightX: sanitizeBannerAxis(spotlightDefault.x),
                    spotlightY: sanitizeBannerAxis(spotlightDefault.y),
                    ...buildReplyFields(replyTo),
                };

                const docRef = await addDoc(messagesRef, messagePayload);
                const localMessage = {
                    id: docRef.id,
                    ...messagePayload,
                    createdAt: Timestamp.now(),
                };
                setMessages((prev) => {
                    if (prev.some((m) => m.id === docRef.id)) return prev;
                    return [...prev, localMessage];
                });

                if (uid === hostId && banner?.hostSpotlightAuto) {
                    try {
                        await setDoc(
                            doc(db, 'stages', partnerId),
                            { host_spotlight_dismissed: false, ownerId: hostId || partnerId },
                            { merge: true }
                        );
                    } catch (spotlightErr) {
                        console.warn('[useStageChatRoom] host spotlight update skipped', spotlightErr);
                    }
                }

                if (uid !== hostId && hostId) {
                    void createNotification({
                        userId: hostId,
                        type: 'message',
                        title: userProfile?.display_name || 'New message in your Stage',
                        message:
                            type === 'image'
                                ? t('community_chat_image_notification', 'Sent a photo')
                                : String(text).slice(0, 80),
                        actionUrl: `/stage/${partnerId}`,
                    }).catch((notifErr) => {
                        console.warn('[useStageChatRoom] host notify skipped', notifErr);
                    });
                }

                return true;
            } catch (err) {
                console.error('[useStageChatRoom] postChatMessage', err);
                showToast(t('failed_send_message', 'Failed to send. Please try again.'), 'error');
                return false;
            }
        },
        [
            partnerId,
            uid,
            isMutedInChat,
            isStageClosed,
            stageStatus,
            userProfile,
            currentUser,
            showToast,
            t,
            banner,
            hostId,
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
                console.error('[useStageChatRoom] sendImageMessage', err);
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
                await deleteDoc(doc(db, 'stages', partnerId, 'messages', message.id));
                if (pendingReplyTo?.id === message.id) {
                    setPendingReplyTo(null);
                }
                return true;
            } catch (err) {
                console.error('[useStageChatRoom] deleteChatMessage', err);
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
            if (!isHost || !partnerId || !memberId || memberId === hostId) return false;

            const confirmRemove = window.confirm(
                t(
                    'stage_remove_member_confirm',
                    'Remove this member from the Stage? They will lose access to the chat.'
                )
            );
            if (!confirmRemove) return false;

            try {
                const setStageMembership = httpsCallable(functions, 'setStageMembership');
                await setStageMembership({
                    stageId: partnerId,
                    action: 'remove_member',
                    targetUid: memberId,
                });
                showToast(t('stage_member_removed', 'Member removed from Stage'), 'success');
                return true;
            } catch (err) {
                console.error('[useStageChatRoom] muteMemberInChat', err);
                showToast(t('member_mute_error', 'Failed to update mute status'), 'error');
                return false;
            }
        },
        [isHost, partnerId, hostId, functions, showToast, t]
    );

    const deleteHostSpotlightMessage = useCallback(
        async (messageId) => {
            if (!isHost || !partnerId || !messageId) return false;

            try {
                await deleteDoc(doc(db, 'stages', partnerId, 'messages', messageId));
                return true;
            } catch (err) {
                console.error('[useStageChatRoom] deleteHostSpotlightMessage', err);
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
                const hostMessages = messages.filter((m) => m.senderId === hostId);
                const target = hostMessages.find((m) => m.id === messageId);
                if (!target) return false;

                const batch = writeBatch(db);
                hostMessages.forEach((m) => {
                    batch.update(doc(db, 'stages', partnerId, 'messages', m.id), {
                        pinned: m.id === messageId,
                    });
                });
                await batch.commit();
                return true;
            } catch (err) {
                console.error('[useStageChatRoom] pinHostMessage', err);
                showToast(t('failed_send_message', 'Failed to send. Please try again.'), 'error');
                return false;
            }
        },
        [isHost, messages, partnerId, hostId, showToast, t]
    );

    const unpinHostMessage = useCallback(
        async (messageId) => {
            if (!isHost || !partnerId || !messageId) return false;
            try {
                await updateDoc(doc(db, 'stages', partnerId, 'messages', messageId), {
                    pinned: false,
                });
                return true;
            } catch (err) {
                console.error('[useStageChatRoom] unpinHostMessage', err);
                return false;
            }
        },
        [isHost, partnerId]
    );

    const showMessageOnBanner = useCallback(
        async (messageId) => {
            if (!isHost || !partnerId || !messageId) return false;
            try {
                const hostMessages = messages.filter((m) => m.senderId === hostId);
                const target = hostMessages.find((m) => m.id === messageId);
                if (!target) return false;

                const batch = writeBatch(db);
                hostMessages.forEach((m) => {
                    batch.update(doc(db, 'stages', partnerId, 'messages', m.id), {
                        bannerSpotlight: m.id === messageId,
                    });
                });
                await batch.commit();
                await setDoc(
                    doc(db, 'stages', partnerId),
                    { host_spotlight_dismissed: false, ownerId: hostId || partnerId },
                    { merge: true }
                );
                return true;
            } catch (err) {
                console.error('[useStageChatRoom] showMessageOnBanner', err);
                showToast(t('failed_send_message', 'Failed to send. Please try again.'), 'error');
                return false;
            }
        },
        [isHost, messages, partnerId, hostId, showToast, t]
    );

    const hideMessageFromBanner = useCallback(
        async (messageId) => {
            if (!isHost || !partnerId) return false;
            try {
                if (messageId) {
                    await updateDoc(doc(db, 'stages', partnerId, 'messages', messageId), {
                        bannerSpotlight: false,
                    });
                }
                await setDoc(
                    doc(db, 'stages', partnerId),
                    { host_spotlight_dismissed: true, ownerId: hostId || partnerId },
                    { merge: true }
                );
                return true;
            } catch (err) {
                console.error('[useStageChatRoom] hideMessageFromBanner', err);
                return false;
            }
        },
        [isHost, partnerId]
    );

    const updateHostSpotlightPosition = useCallback(
        async (messageId, x, y) => {
            if (!isHost || !partnerId || !messageId) return false;

            try {
                await updateDoc(doc(db, 'stages', partnerId, 'messages', messageId), {
                    spotlightX: sanitizeBannerAxis(x),
                    spotlightY: sanitizeBannerAxis(y),
                });
                return true;
            } catch (err) {
                console.error('[useStageChatRoom] updateHostSpotlightPosition', err);
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
                    doc(db, 'stages', partnerId),
                    {
                        host_spotlight_auto: next,
                        host_spotlight_dismissed: !next,
                        ownerId: hostId || partnerId,
                    },
                    { merge: true }
                );
                return true;
            } catch (err) {
                console.error('[useStageChatRoom] setHostSpotlightAuto', err);
                showToast(t('failed_send_message', 'Failed to send. Please try again.'), 'error');
                return false;
            }
        },
        [isHost, partnerId, showToast, t]
    );

    const uploadCommunityChatGuestFrameBackgroundFile = useCallback(
        async (file) => {
            if (!file || !uid) return null;
            setGuestFrameBackgroundUploading(true);
            try {
                return await uploadImage(file, uid);
            } catch (err) {
                console.error('[useStageChatRoom] uploadCommunityChatGuestFrameBackgroundFile', err);
                notifyImageUploadError(showToast, err, t);
                return null;
            } finally {
                setGuestFrameBackgroundUploading(false);
            }
        },
        [showToast, t, uid]
    );

    const generateCommunityChatGuestFrameBackgroundImage = useCallback(
        async (userPrompt) => {
            if (!isHost || !partnerId) return null;
            setGuestFrameBackgroundGenerating(true);
            try {
                const result = await generateAIDesignStudioImage({
                    userPrompt: String(userPrompt || '').trim(),
                    designCategory: 'landscape',
                    aspectRatio: '16:9',
                });

                if (!result.success) {
                    if (isInsufficientCreditsError(result)) {
                        showToast(
                            result.message || t('ai_insufficient_credits_default'),
                            'error'
                        );
                        return null;
                    }
                    if (result.code === 'MODERATION_FAILED' || result.status === 422) {
                        showToast(t('magic_cover_moderation_failed'), 'error');
                        return null;
                    }
                    showToast(formatAiErrorMessage(result, t), 'error');
                    return null;
                }

                let imageUrl = extractAIImageUrl(result.data);
                if (!imageUrl && apiImageNeedsClientUpload(result.data?.image)) {
                    imageUrl = await uploadInvitationMagicCoverFromApiBytes(result.data.image);
                }
                if (!imageUrl) {
                    showToast(t('ai_generate_failed'), 'error');
                    return null;
                }

                const creditsCharged = result.meta?.creditsCharged ?? AI_IMAGE_GENERATION_CREDITS;
                if (creditsCharged) {
                    showToast(t('magic_cover_charged_notice', { cost: creditsCharged }), 'info');
                }
                return imageUrl;
            } catch (err) {
                console.error('[useStageChatRoom] generateCommunityChatGuestFrameBackgroundImage', err);
                showToast(t('ai_generate_failed'), 'error');
                return null;
            } finally {
                setGuestFrameBackgroundGenerating(false);
            }
        },
        [isHost, partnerId, showToast, t]
    );

    const saveCommunityChatZoneThemeSettings = useCallback(
        async ({ themeId, guestFrame }) => {
            if (!isHost || !partnerId) return false;
            const id = COMMUNITY_CHAT_ZONE_THEME_IDS.includes(themeId) ? themeId : 'stage';
            const imageMode = guestFrame?.imageMode || 'none';
            const hasImage = imageMode === 'preset' || imageMode === 'custom';
            const hasColor = guestFrame?.colorOverlayEnabled !== false;
            const intensity = sanitizeBannerBgDensity(guestFrame?.intensity, 100);
            const color1 = normalizeCommunityGuestFrameHexColor(guestFrame?.colorStart);
            const color2 = normalizeCommunityGuestFrameHexColor(guestFrame?.colorEnd);

            const update = {
                communityChatZoneTheme: id,
            };

            if (!hasImage && !hasColor) {
                update.communityChatGuestFrameBgMode = 'none';
                update.communityChatGuestFrameBgPreset = null;
                update.communityChatGuestFrameBgUrl = null;
                update.communityChatGuestFrameBgColor1 = null;
                update.communityChatGuestFrameBgColor2 = null;
                update.communityChatGuestFrameBgIntensity = null;
            } else if (hasImage) {
                if (imageMode === 'preset') {
                    const presetId = COMMUNITY_GUEST_FRAME_BACKGROUND_PRESET_IDS.includes(
                        guestFrame?.presetId
                    )
                        ? guestFrame.presetId
                        : null;
                    if (!presetId) return false;
                    update.communityChatGuestFrameBgMode = 'preset';
                    update.communityChatGuestFrameBgPreset = presetId;
                    update.communityChatGuestFrameBgUrl = null;
                } else {
                    const url = String(guestFrame?.customUrl || '').trim();
                    if (!url) return false;
                    update.communityChatGuestFrameBgMode = 'custom';
                    update.communityChatGuestFrameBgPreset = null;
                    update.communityChatGuestFrameBgUrl = url;
                }
                if (hasColor) {
                    update.communityChatGuestFrameBgColor1 = color1;
                    update.communityChatGuestFrameBgColor2 = color2;
                    update.communityChatGuestFrameBgIntensity = intensity;
                } else {
                    update.communityChatGuestFrameBgColor1 = null;
                    update.communityChatGuestFrameBgColor2 = null;
                    update.communityChatGuestFrameBgIntensity = null;
                }
            } else {
                update.communityChatGuestFrameBgMode = 'color';
                update.communityChatGuestFrameBgPreset = null;
                update.communityChatGuestFrameBgUrl = null;
                update.communityChatGuestFrameBgIntensity = intensity;
                update.communityChatGuestFrameBgColor1 = color1;
                update.communityChatGuestFrameBgColor2 = color2;
            }

            setZoneThemeSaving(true);
            try {
                await updateDoc(doc(db, 'stages', partnerId), update);
                showToast(
                    t('community_chat_zone_theme_saved', 'Chat colors updated.'),
                    'success'
                );
                return true;
            } catch (err) {
                console.error('[useStageChatRoom] saveCommunityChatZoneThemeSettings', err);
                showToast(t('failed_save', 'Could not save. Please try again.'), 'error');
                return false;
            } finally {
                setZoneThemeSaving(false);
            }
        },
        [isHost, partnerId, showToast, t]
    );

    const setCommunityChatBannerVisible = useCallback(
        async (visible) => {
            if (!partnerId || !uid) return false;
            const next = Boolean(visible);

            if (!isHost) {
                if (hostBannerVisible === false) return false;
                setGuestBannerLocalVisible(next);
                writeGuestCommunityBannerVisible(uid, partnerId, next);
                showToast(
                    next
                        ? t('community_chat_banner_shown_local', 'Top banner is visible on your device.')
                        : t(
                              'community_chat_banner_hidden_local',
                              'Top banner hidden on your device — normal chat layout.'
                          ),
                    'success'
                );
                return true;
            }

            setBannerVisibleSaving(true);
            try {
                await updateDoc(doc(db, 'stages', partnerId), {
                    communityChatBannerVisible: next,
                });
                showToast(
                    next
                        ? t('community_chat_banner_shown', 'Top banner is visible for everyone.')
                        : t('community_chat_banner_hidden', 'Top banner hidden — normal chat layout.'),
                    'success'
                );
                return true;
            } catch (err) {
                console.error('[useStageChatRoom] setCommunityChatBannerVisible', err);
                showToast(t('failed_save', 'Could not save. Please try again.'), 'error');
                return false;
            } finally {
                setBannerVisibleSaving(false);
            }
        },
        [hostBannerVisible, isHost, partnerId, showToast, t, uid]
    );

    return {
        loading,
        isMember,
        isBlockedFromCommunity,
        isHost,
        isDisplaySession,
        isMutedInChat: isMutedInChat || isStageClosed,
        stageStatus,
        isStageClosed,
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
        zoneThemeId,
        zoneThemeInlineStyle,
        saveCommunityChatZoneThemeSettings,
        zoneThemeSaving,
        guestFrameBackground,
        uploadCommunityChatGuestFrameBackgroundFile,
        generateCommunityChatGuestFrameBackgroundImage,
        guestFrameBackgroundUploading,
        guestFrameBackgroundGenerating,
        bannerVisible,
        hostBannerVisible,
        setCommunityChatBannerVisible,
        bannerVisibleSaving,
        bannerToggleDisabled,
    };
}
