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
import { uploadImage, uploadVoiceMessage } from '../utils/mediaUtils';
import { notifyImageUploadError } from '../utils/imageModerationErrors';
import { createNotification } from '../utils/notificationHelpers';
import { deleteStorageFileByUrl } from '../utils/storageCleanup';
import {
    buildBannerImageUpdate,
    buildBannerClearImageUpdate,
    buildBannerYoutubeUpdate,
    buildBannerVoiceUpdate,
    buildBannerVoiceClearFields,
    buildBannerVoiceLoopUpdate,
    buildBannerUpdate,
    mergeBannerPatch,
    normalizeCommunityBanner,
    sanitizeBannerAxis,
    BANNER_VOICE_MAX_DURATION_SEC,
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
import { getBusinessSubscriptionAccess } from '../utils/businessSubscription';

/**
 * Real-time community chat room state (messages + single-slot banner + membership).
 * @param {string | undefined} partnerId — business community owner uid
 */
export function useCommunityChatRoom(partnerId) {
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
    const isHost = Boolean(partnerId && uid && uid === partnerId);
    const functions = getFunctions(app, 'us-central1');
    const joinedCommunities =
        inviteCurrentUser?.joinedCommunities ??
        userProfile?.joinedCommunities ??
        [];

    const isMember = useMemo(() => {
        if (isDisplaySession) return true;
        if (!partnerId || !uid) return false;
        if (isBlockedFromCommunity) return false;
        if (uid === partnerId) return true;
        if (joinedCommunities.includes(partnerId)) return true;
        const members = Array.isArray(partner?.communityMembers) ? partner.communityMembers : [];
        return members.includes(uid);
    }, [partnerId, uid, isBlockedFromCommunity, joinedCommunities, partner?.communityMembers, isDisplaySession]);

    /** Group chat stream is Paid-only; membership/join remains available on Free. */
    const chatEnabled = getBusinessSubscriptionAccess(partner?.subscriptionTier).canUseCommunityGroupChat;
    const canUseChat = Boolean(isMember && chatEnabled);

    useEffect(() => {
        if (!partnerId || !uid) {
            setIsDisplaySession(false);
            return undefined;
        }

        const firebaseUser = auth.currentUser;
        if (!firebaseUser || firebaseUser.uid !== uid) {
            setIsDisplaySession(false);
            return undefined;
        }

        let cancelled = false;
        void firebaseUser
            .getIdTokenResult()
            .then((result) => {
                if (cancelled) return;
                const claims = result?.claims || {};
                setIsDisplaySession(
                    claims.communityDisplay === true &&
                        String(claims.communityDisplayPartnerId || '') === partnerId
                );
            })
            .catch(() => {
                if (!cancelled) setIsDisplaySession(false);
            });

        return () => {
            cancelled = true;
        };
    }, [uid, partnerId]);

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

    // Partner profile + moderation (users/{partnerId}, fallback restaurants/{partnerId})
    useEffect(() => {
        if (!partnerId || !uid) {
            setLoading(false);
            return undefined;
        }

        let cancelled = false;
        let unsubPartner = () => {};

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
                setIsBlockedFromCommunity(true);
                setIsMutedInChat(false);
                return;
            }

            setIsBlockedFromCommunity(false);
            setIsMutedInChat(uid !== partnerId && mutedIds.includes(uid));
        };

        setLoading(true);

        void (async () => {
            try {
                const userRef = doc(db, 'users', partnerId);
                const restaurantRef = doc(db, 'restaurants', partnerId);
                const [userSnap, restaurantSnap] = await Promise.all([
                    getDoc(userRef),
                    getDoc(restaurantRef),
                ]);
                if (cancelled) return;

                const partnerRef = userSnap.exists()
                    ? userRef
                    : restaurantSnap.exists()
                      ? restaurantRef
                      : null;

                if (!partnerRef) {
                    setPartner(null);
                    setLoading(false);
                    return;
                }

                if (userSnap.exists()) {
                    applyPartnerModeration(userSnap.data());
                } else if (restaurantSnap.exists()) {
                    applyPartnerModeration(restaurantSnap.data());
                }

                unsubPartner = onSnapshot(
                    partnerRef,
                    (snap) => {
                        if (snap.exists()) applyPartnerModeration(snap.data());
                        setLoading(false);
                    },
                    (err) => {
                        console.error('[useCommunityChatRoom] partner snapshot', err);
                        setLoading(false);
                    }
                );
            } catch (err) {
                console.error('[useCommunityChatRoom] partner resolve', err);
                if (!cancelled) setLoading(false);
            }
        })();

        return () => {
            cancelled = true;
            unsubPartner();
        };
    // uid only — AuthContext rebuilds currentUser object every render.
    }, [partnerId, uid]);

    // Single-slot banner on communities/{partnerId}
    useEffect(() => {
        if (!partnerId || !canUseChat) {
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
    }, [partnerId, canUseChat, uid]);

    // Messages subcollection — retry on permission-denied (join race / rules lag)
    useEffect(() => {
        if (!canUseChat || !partnerId) {
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
                collection(db, 'communities', partnerId, 'messages'),
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
                    console.error('[useCommunityChatRoom] messages snapshot', err);
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
    }, [partnerId, canUseChat, uid]);

    useEffect(() => {
        if (readReceiptTimeoutRef.current) {
            clearTimeout(readReceiptTimeoutRef.current);
            readReceiptTimeoutRef.current = null;
        }
        if (!canUseChat || !partnerId || !uid || messages.length === 0 || isDisplaySession) {
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
    }, [canUseChat, messages, partnerId, uid, isDisplaySession]);

    const memberIdsKey = (partner?.communityMembers || []).join(',');

    // Community participants — live profile + isOnline from users/{uid}
    useEffect(() => {
        if (!partnerId || !canUseChat) {
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
    }, [partnerId, canUseChat, memberIdsKey]);

    // Mark community as read
    useEffect(() => {
        if (!canUseChat || !partnerId || !uid) return undefined;

        void updateDoc(doc(db, 'users', uid), {
            [`communityLastRead.${partnerId}`]: serverTimestamp(),
        }).catch(() => {});

        return undefined;
    }, [canUseChat, partnerId, uid]);

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
            if (
                Object.prototype.hasOwnProperty.call(fields, 'banner_youtube_id') ||
                Object.prototype.hasOwnProperty.call(fields, 'banner_youtube_playlist_id')
            ) {
                const ytId = String(fields.banner_youtube_id || '').trim();
                const listId = String(fields.banner_youtube_playlist_id || '').trim();
                const hasYt =
                    /^[a-zA-Z0-9_-]{11}$/.test(ytId) ||
                    (/^[a-zA-Z0-9_-]{10,64}$/.test(listId) &&
                        !(listId.length === 11 && !/^(PL|UU|RD|OL|LL|FL|WL)/i.test(listId)));
                if (hasYt) {
                    // Only stamp a new sync epoch when the caller asks for it
                    // (new YouTube media / explicit syncYoutubePlayback).
                    const refreshSync = Object.prototype.hasOwnProperty.call(
                        fields,
                        'banner_youtube_sync_client_ms'
                    );
                    if (refreshSync) {
                        payload.banner_youtube_sync_at = serverTimestamp();
                        if (!Object.prototype.hasOwnProperty.call(fields, 'banner_youtube_paused')) {
                            payload.banner_youtube_paused = false;
                        }
                        if (
                            !Object.prototype.hasOwnProperty.call(
                                fields,
                                'banner_youtube_position_sec'
                            )
                        ) {
                            payload.banner_youtube_position_sec = 0;
                        }
                    }
                } else if (!ytId && !listId) {
                    payload.banner_youtube_sync_at = null;
                    payload.banner_youtube_sync_client_ms = 0;
                }
            }
            await setDoc(doc(db, 'communities', partnerId), payload, { merge: true });
        },
        [isHost, partnerId]
    );

    const syncYoutubePlayback = useCallback(
        async ({ paused, positionSec } = {}) => {
            if (!isHost || !partnerId) return;
            if (!banner.youtubeId && !banner.youtubePlaylistId) return;
            try {
                const payload = {
                    banner_youtube_sync_at: serverTimestamp(),
                    // Instant guest math — avoid waiting for serverTimestamp resolution.
                    banner_youtube_sync_client_ms: Date.now(),
                    ownerId: partnerId,
                };
                if (typeof paused === 'boolean') {
                    payload.banner_youtube_paused = paused;
                }
                // Only update position when explicitly provided (0 = hard stop / restart from start).
                if (positionSec !== undefined && Number.isFinite(Number(positionSec))) {
                    payload.banner_youtube_position_sec = Math.max(
                        0,
                        Math.floor(Number(positionSec))
                    );
                }
                await setDoc(doc(db, 'communities', partnerId), payload, { merge: true });
            } catch (err) {
                console.error('[useCommunityChatRoom] youtube sync', err);
            }
        },
        [isHost, partnerId, banner.youtubeId, banner.youtubePlaylistId]
    );

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
        async (
            videoId,
            { isShort = false, isLive = false, isMusic = false, playlistId = '' } = {}
        ) => {
            if (!isHost || !partnerId) return false;
            const id = String(videoId || '').trim();
            const listId = String(playlistId || '').trim();
            try {
                if (id || listId) {
                    await unpinAllHostMessages();
                }
                await replaceBanner(
                    buildBannerYoutubeUpdate(id, { isShort, isLive, isMusic, playlistId: listId })
                );
                return true;
            } catch (err) {
                console.error('[useCommunityChatRoom] banner youtube', err);
                showToast(t('failed_send_message', 'Failed to send. Please try again.'), 'error');
                return false;
            }
        },
        [isHost, partnerId, replaceBanner, unpinAllHostMessages, showToast, t]
    );

    const setBannerVoice = useCallback(
        async (audioBlob, durationSec = 0) => {
            if (!audioBlob || !isHost || !partnerId || !uid) return false;
            setUploadingBanner(true);
            const previousUrl = String(banner.voiceUrl || '').trim();
            try {
                const url = await uploadVoiceMessage(audioBlob, uid);
                const secs = Math.max(
                    1,
                    Math.min(
                        BANNER_VOICE_MAX_DURATION_SEC,
                        Math.floor(Number(durationSec) || 0) || 1
                    )
                );
                await replaceBanner({
                    ...buildBannerVoiceUpdate(url, secs),
                    banner_voice_updated_at: serverTimestamp(),
                });
                if (previousUrl && previousUrl !== url) {
                    void deleteStorageFileByUrl(previousUrl);
                }
                showToast(
                    t('community_banner_voice_published', 'Voice message published to the banner.'),
                    'success'
                );
                return true;
            } catch (err) {
                console.error('[useCommunityChatRoom] banner voice', err);
                showToast(t('failed_send_voice', 'Could not send voice message.'), 'error');
                return false;
            } finally {
                setUploadingBanner(false);
            }
        },
        [banner.voiceUrl, isHost, partnerId, uid, replaceBanner, showToast, t]
    );

    const clearBannerVoice = useCallback(async () => {
        if (!isHost || !partnerId) return false;
        const previousUrl = String(banner.voiceUrl || '').trim();
        if (!previousUrl) return false;
        try {
            await replaceBanner(buildBannerVoiceClearFields());
            void deleteStorageFileByUrl(previousUrl);
            return true;
        } catch (err) {
            console.error('[useCommunityChatRoom] clear banner voice', err);
            showToast(t('failed_send_message', 'Failed to send. Please try again.'), 'error');
            return false;
        }
    }, [banner.voiceUrl, isHost, partnerId, replaceBanner, showToast, t]);

    const setBannerVoiceLoop = useCallback(
        async (loop) => {
            if (!isHost || !partnerId) return false;
            if (!String(banner.voiceUrl || '').trim()) return false;
            try {
                await replaceBanner(buildBannerVoiceLoopUpdate(loop));
                showToast(
                    loop
                        ? t('community_banner_voice_loop_on', 'Voice will repeat.')
                        : t('community_banner_voice_loop_off', 'Voice plays once.'),
                    'success'
                );
                return true;
            } catch (err) {
                console.error('[useCommunityChatRoom] banner voice loop', err);
                showToast(t('failed_send_message', 'Failed to send. Please try again.'), 'error');
                return false;
            }
        },
        [banner.voiceUrl, isHost, partnerId, replaceBanner, showToast, t]
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

    /** Device upload removed — guest-frame images are AI-only. */
    const uploadCommunityChatGuestFrameBackgroundFile = useCallback(async () => {
        showToast(
            t(
                'community_guest_frame_bg_upload_disabled',
                'Chat backgrounds are AI-generated only.'
            ),
            'info'
        );
        return null;
    }, [showToast, t]);

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
                console.error('[useCommunityChatRoom] generateCommunityChatGuestFrameBackgroundImage', err);
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
            // Image backgrounds: AI-generated custom URLs only (no presets / device upload).
            const imageMode = guestFrame?.imageMode || 'none';
            const customUrl =
                imageMode === 'custom' ? String(guestFrame?.customUrl || '').trim() : '';
            const hasImage = Boolean(customUrl);
            const hasColor = guestFrame?.colorOverlayEnabled !== false;
            const intensity = sanitizeBannerBgDensity(guestFrame?.intensity, 100);
            const color1 = normalizeCommunityGuestFrameHexColor(guestFrame?.colorStart);
            const color2 = normalizeCommunityGuestFrameHexColor(guestFrame?.colorEnd);

            const update = {
                communityChatZoneTheme: id,
                communityChatGuestFrameBgPreset: null,
            };

            if (!hasImage && !hasColor) {
                update.communityChatGuestFrameBgMode = 'none';
                update.communityChatGuestFrameBgUrl = null;
                update.communityChatGuestFrameBgColor1 = null;
                update.communityChatGuestFrameBgColor2 = null;
                update.communityChatGuestFrameBgIntensity = null;
            } else if (hasImage) {
                update.communityChatGuestFrameBgMode = 'custom';
                update.communityChatGuestFrameBgUrl = customUrl;
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
                update.communityChatGuestFrameBgUrl = null;
                update.communityChatGuestFrameBgIntensity = intensity;
                update.communityChatGuestFrameBgColor1 = color1;
                update.communityChatGuestFrameBgColor2 = color2;
            }

            setZoneThemeSaving(true);
            try {
                await updateDoc(doc(db, 'users', partnerId), update);
                showToast(
                    t('community_chat_zone_theme_saved', 'Chat colors updated.'),
                    'success'
                );
                return true;
            } catch (err) {
                console.error('[useCommunityChatRoom] saveCommunityChatZoneThemeSettings', err);
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
                await updateDoc(doc(db, 'users', partnerId), {
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
                console.error('[useCommunityChatRoom] setCommunityChatBannerVisible', err);
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
        chatEnabled,
        isBlockedFromCommunity,
        isHost,
        isDisplaySession,
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
        setBannerVoice,
        clearBannerVoice,
        setBannerVoiceLoop,
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
