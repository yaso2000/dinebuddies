import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    getDocs,
    onSnapshot,
    orderBy,
    query,
    runTransaction,
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
    resolveBannerYoutubeSyncFields,
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

/**
 * Real-time social (group) invitation chat — the invitation's own "Stage":
 * same banner/YouTube-sync/pin-spotlight/moderation feature set as
 * useStageChatRoom, retargeted at social_invitations/{invitationId} instead
 * of stages/{stageId}. Membership lives entirely on the invitation doc via
 * rsvps[uid] === 'accepted' (the same field the accept/decline flow already
 * writes) — no separate memberIds array or user-profile join list to keep in
 * sync.
 * @param {string | undefined} invitationId
 */
export function useSocialInvitationChatRoom(invitationId) {
    const partnerId = invitationId; // room id (UI still uses partnerId)
    const { t } = useTranslation();
    const { currentUser, userProfile } = useAuth();
    const { showToast } = useToast();

    const [messages, setMessages] = useState([]);
    const [banner, setBanner] = useState(() => normalizeCommunityBanner(null));
    const [partner, setPartner] = useState(null);
    const [isBlockedFromCommunity, setIsBlockedFromCommunity] = useState(false);
    const [isMutedInChat, setIsMutedInChat] = useState(false);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(null);
    const [uploadingBanner, setUploadingBanner] = useState(false);
    const [uploadingChatImage, setUploadingChatImage] = useState(false);
    const [pendingReplyTo, setPendingReplyTo] = useState(null);
    const [participants, setParticipants] = useState([]);
    const [participantsLoading, setParticipantsLoading] = useState(false);
    const [zoneThemeSaving, setZoneThemeSaving] = useState(false);
    const [bannerVisibleSaving, setBannerVisibleSaving] = useState(false);
    const [guestFrameBackgroundUploading, setGuestFrameBackgroundUploading] = useState(false);
    const [guestFrameBackgroundGenerating, setGuestFrameBackgroundGenerating] = useState(false);
    const latestMessageDocsRef = useRef([]);
    const readReceiptTimeoutRef = useRef(null);
    const expiredMuteClearRef = useRef(null);

    const uid = currentUser?.uid || auth.currentUser?.uid || userProfile?.id || null;
    const hostId = partner?.hostId || partner?.ownerId || null;
    const isHost = Boolean(hostId && uid && uid === hostId);
    const functions = getFunctions(app, 'us-central1');

    const rsvps = partner?.rsvps && typeof partner.rsvps === 'object' ? partner.rsvps : {};
    const isAccepted = Boolean(uid && rsvps[uid] === 'accepted');

    const isMember = useMemo(() => {
        if (!partnerId || !uid) return false;
        if (isBlockedFromCommunity) return false;
        if (isHost) return true;
        return isAccepted;
    }, [partnerId, uid, isBlockedFromCommunity, isHost, isAccepted]);

    const bannerDisplay = useMemo(
        () => resolveCommunityBannerDisplay(banner, partner),
        [banner, partner]
    );

    const zoneThemeId = useMemo(() => resolveCommunityChatZoneThemeId(partner), [partner]);

    const zoneThemeInlineStyle = useMemo(() => {
        const overrides = partner?.communityChatZoneThemeTokens;
        return buildCommunityChatZoneThemeInlineStyle(overrides);
    }, [partner]);

    const guestFrameBackground = useMemo(
        () => resolveCommunityChatGuestFrameBackground(partner),
        [partner]
    );

    const hostBannerVisible = useMemo(() => resolveCommunityChatBannerVisible(partner), [partner]);
    const [guestBannerLocalVisible, setGuestBannerLocalVisible] = useState(() =>
        uid && partnerId ? readGuestCommunityBannerVisible(uid, partnerId) : true
    );

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

    // Invitation doc — host id comes from authorId/author.id, not hostId/ownerId.
    useEffect(() => {
        if (!partnerId || !uid) {
            setLoading(false);
            setLoadError(null);
            setPartner(null);
            return undefined;
        }

        let cancelled = false;
        let loadTimer = null;
        const invRef = doc(db, 'social_invitations', partnerId);

        loadTimer = window.setTimeout(() => {
            if (!cancelled) {
                console.warn('[useSocialInvitationChatRoom] invitation snapshot timed out');
                setLoading(false);
                setLoadError((prev) => prev || 'timeout');
            }
        }, 2500);

        const unsub = onSnapshot(
            invRef,
            (snap) => {
                if (cancelled) return;
                if (loadTimer) {
                    window.clearTimeout(loadTimer);
                    loadTimer = null;
                }
                if (!snap.exists()) {
                    setPartner(null);
                    setLoading(false);
                    setLoadError('not-found');
                    return;
                }
                const data = snap.data() || {};
                const invHostId = data.authorId || data.author?.id || null;
                const merged = {
                    ...data,
                    hostId: invHostId,
                    ownerId: invHostId,
                    id: partnerId,
                    display_name: data.title || data.author?.name || 'Event',
                };
                setPartner(merged);
                setLoadError(null);
                setLoading(false);

                const blockedIds = Array.isArray(merged.communityBlockedUserIds)
                    ? merged.communityBlockedUserIds
                    : [];
                const viewerIsHost = Boolean(invHostId && uid === invHostId);

                if (!viewerIsHost && blockedIds.includes(uid)) {
                    setIsBlockedFromCommunity(true);
                    setIsMutedInChat(false);
                    return;
                }
                setIsBlockedFromCommunity(false);

                const mutedIds = Array.isArray(merged.communityMutedUserIds)
                    ? merged.communityMutedUserIds
                    : [];
                const mutedUntil =
                    merged.communityMutedUntil && typeof merged.communityMutedUntil === 'object'
                        ? merged.communityMutedUntil
                        : {};
                let mutedNow = !viewerIsHost && mutedIds.includes(uid);
                if (mutedNow) {
                    const untilRaw = mutedUntil[uid];
                    const untilMs =
                        typeof untilRaw?.toMillis === 'function'
                            ? untilRaw.toMillis()
                            : typeof untilRaw?.toDate === 'function'
                              ? untilRaw.toDate().getTime()
                              : Number(untilRaw) || 0;
                    if (untilMs && untilMs <= Date.now()) {
                        mutedNow = false;
                        const clearKey = `${partnerId}:${uid}:${untilMs}`;
                        if (expiredMuteClearRef.current !== clearKey) {
                            expiredMuteClearRef.current = clearKey;
                            void httpsCallable(functions, 'setSocialInvitationMembership')({
                                invitationId: partnerId,
                                action: 'unmute_member',
                                targetUid: uid,
                            }).catch(() => {});
                        }
                    }
                }
                setIsMutedInChat(mutedNow);
            },
            (err) => {
                if (cancelled) return;
                if (loadTimer) {
                    window.clearTimeout(loadTimer);
                    loadTimer = null;
                }
                console.error('[useSocialInvitationChatRoom] invitation snapshot', err);
                setLoading(false);
                setLoadError(err?.code || err?.message || 'snapshot-failed');
            }
        );

        return () => {
            cancelled = true;
            if (loadTimer) window.clearTimeout(loadTimer);
            try {
                unsub();
            } catch {
                /* ignore */
            }
        };
    }, [partnerId, uid, functions]);

    // Banner lives on the same invitation doc.
    useEffect(() => {
        if (!partnerId || !isMember) {
            setBanner(normalizeCommunityBanner(null));
            return undefined;
        }
        const unsub = onSnapshot(
            doc(db, 'social_invitations', partnerId),
            (snap) => {
                setBanner(normalizeCommunityBanner(snap.exists() ? snap.data() : null));
            },
            (err) => {
                console.error('[useSocialInvitationChatRoom] banner snapshot', err);
                setBanner(normalizeCommunityBanner(null));
            }
        );
        return unsub;
    }, [partnerId, isMember]);

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
                collection(db, 'social_invitations', partnerId, 'messages'),
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
                    console.error('[useSocialInvitationChatRoom] messages snapshot', err);
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
        if (!isMember || !partnerId || !uid || messages.length === 0) return undefined;
        if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return undefined;

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
    }, [isMember, messages, partnerId, uid]);

    const acceptedMemberIds = useMemo(
        () => Object.keys(rsvps).filter((id) => rsvps[id] === 'accepted'),
        [rsvps]
    );
    const memberIdsKey = acceptedMemberIds.join(',');

    const muteStateKey = useMemo(() => {
        const muted = Array.isArray(partner?.communityMutedUserIds)
            ? partner.communityMutedUserIds.map(String).sort().join(',')
            : '';
        const until =
            partner?.communityMutedUntil && typeof partner.communityMutedUntil === 'object'
                ? Object.keys(partner.communityMutedUntil).sort().join(',')
                : '';
        return `${muted}|${until}`;
    }, [partner?.communityMutedUserIds, partner?.communityMutedUntil]);

    const activeMutedIds = useMemo(() => {
        const mutedIds = Array.isArray(partner?.communityMutedUserIds)
            ? partner.communityMutedUserIds.map(String)
            : [];
        const mutedUntil =
            partner?.communityMutedUntil && typeof partner.communityMutedUntil === 'object'
                ? partner.communityMutedUntil
                : {};
        const now = Date.now();
        return new Set(
            mutedIds.filter((id) => {
                const untilRaw = mutedUntil[id];
                const untilMs =
                    typeof untilRaw?.toMillis === 'function'
                        ? untilRaw.toMillis()
                        : typeof untilRaw?.toDate === 'function'
                          ? untilRaw.toDate().getTime()
                          : Number(untilRaw) || 0;
                if (untilMs && untilMs <= now) return false;
                return true;
            })
        );
    }, [muteStateKey, partner?.communityMutedUntil, partner?.communityMutedUserIds]);

    // Participants — live profile + isOnline from users/{uid}, host + accepted rsvps.
    useEffect(() => {
        if (!partnerId || !isMember) {
            setParticipants([]);
            setParticipantsLoading(false);
            return undefined;
        }

        const uniqueIds = [...new Set([hostId, ...acceptedMemberIds].filter(Boolean))];
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
                            displayName: data.display_name || data.name || data.displayName || 'User',
                            avatar: getSafeAvatar(data),
                            photoURL: data.photo_url || data.photoURL,
                            isOnline: Boolean(data.isOnline),
                            isHost: Boolean(hostId && memberId === hostId),
                            isMuted: activeMutedIds.has(String(memberId)),
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
    }, [partnerId, isMember, memberIdsKey, activeMutedIds, hostId]);

    /** Unpin all host messages (banner edits no longer delete chat history). */
    const unpinAllHostMessages = useCallback(async () => {
        if (!partnerId || !hostId) return;
        const messagesRef = collection(db, 'social_invitations', partnerId, 'messages');
        const hostQuery = query(messagesRef, where('senderId', '==', hostId));
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
    }, [partnerId, hostId]);

    const replaceBanner = useCallback(
        async (fields) => {
            if (!isHost || !partnerId) return;
            const payload = {
                ...fields,
                ...resolveBannerYoutubeSyncFields(fields, serverTimestamp()),
                banner_updated_at: serverTimestamp(),
            };
            await setDoc(doc(db, 'social_invitations', partnerId), payload, { merge: true });
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
                    banner_youtube_sync_client_ms: Date.now(),
                };
                if (typeof paused === 'boolean') {
                    payload.banner_youtube_paused = paused;
                }
                if (positionSec !== undefined && Number.isFinite(Number(positionSec))) {
                    payload.banner_youtube_position_sec = Math.max(0, Math.floor(Number(positionSec)));
                }
                await setDoc(doc(db, 'social_invitations', partnerId), payload, { merge: true });
            } catch (err) {
                console.error('[useSocialInvitationChatRoom] youtube sync', err);
            }
        },
        [banner.youtubeId, banner.youtubePlaylistId, isHost, partnerId]
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
                console.error('[useSocialInvitationChatRoom] banner image', err);
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
            console.error('[useSocialInvitationChatRoom] clear banner image', err);
            showToast(t('failed_send_message', 'Failed to send. Please try again.'), 'error');
            return false;
        }
    }, [banner.url, isHost, partnerId, replaceBanner, showToast, t]);

    const setBannerYoutube = useCallback(
        async (videoId, { isShort = false, isLive = false, isMusic = false, playlistId = '' } = {}) => {
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
                console.error('[useSocialInvitationChatRoom] banner youtube', err);
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
                    Math.min(BANNER_VOICE_MAX_DURATION_SEC, Math.floor(Number(durationSec) || 0) || 1)
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
                console.error('[useSocialInvitationChatRoom] banner voice', err);
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
            console.error('[useSocialInvitationChatRoom] clear banner voice', err);
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
                console.error('[useSocialInvitationChatRoom] banner voice loop', err);
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

            try {
                if (clearSpotlight) {
                    await unpinAllHostMessages();
                }
                const invRef = doc(db, 'social_invitations', partnerId);
                await runTransaction(db, async (tx) => {
                    const snap = await tx.get(invRef);
                    const current = normalizeCommunityBanner(snap.exists() ? snap.data() : null);
                    const merged = mergeBannerPatch(current, patch);
                    const fields = buildBannerUpdate(merged);
                    tx.set(
                        invRef,
                        {
                            ...fields,
                            ...resolveBannerYoutubeSyncFields(fields, serverTimestamp()),
                            banner_updated_at: serverTimestamp(),
                        },
                        { merge: true }
                    );
                });
                return true;
            } catch (err) {
                console.error('[useSocialInvitationChatRoom] banner update', err);
                showToast(t('failed_send_message', 'Failed to send. Please try again.'), 'error');
                return false;
            }
        },
        [isHost, partnerId, unpinAllHostMessages, showToast, t]
    );

    const detectBigEmoji = useCallback((text) => {
        const trimmed = String(text || '').trim();
        try {
            const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
            const graphemes = Array.from(segmenter.segment(trimmed));
            return (
                graphemes.length === 1 &&
                /^(\p{Emoji_Presentation}|\p{Emoji}️|\p{Emoji_Modifier_Base}\p{Emoji_Modifier}?|\p{Emoji_Component})+$/u.test(
                    trimmed
                )
            );
        } catch {
            return (
                Array.from(trimmed).length <= 2 &&
                /^(\p{Emoji_Presentation}|\p{Emoji}️|\p{Emoji_Modifier_Base}\p{Emoji_Modifier}?|\p{Emoji_Component})+$/u.test(
                    trimmed
                )
            );
        }
    }, []);

    const postChatMessage = useCallback(
        async ({ text, type = 'text', replyTo = null }) => {
            if (!partnerId || !uid) return false;

            if (isMutedInChat) {
                showToast(t('community_chat_muted', 'You are muted in this community chat.'), 'error');
                return false;
            }

            try {
                const messagesRef = collection(db, 'social_invitations', partnerId, 'messages');
                const spotlightDefault =
                    uid === hostId
                        ? resolveNewHostSpotlightPosition({ hasTitle: Boolean(banner?.title) })
                        : { x: DEFAULT_HOST_SPOTLIGHT_POS.x, y: DEFAULT_HOST_SPOTLIGHT_POS.y };
                const messagePayload = {
                    text,
                    senderId: uid,
                    senderName: userProfile?.display_name || currentUser.displayName || 'User',
                    senderAvatar: getSafeAvatar(userProfile || currentUser),
                    senderGender: userProfile?.gender || currentUser?.gender || userProfile?.genderIdentity || '',
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
                const localMessage = { id: docRef.id, ...messagePayload, createdAt: Timestamp.now() };
                setMessages((prev) => {
                    if (prev.some((m) => m.id === docRef.id)) return prev;
                    return [...prev, localMessage];
                });

                if (uid === hostId && banner?.hostSpotlightAuto) {
                    try {
                        await setDoc(
                            doc(db, 'social_invitations', partnerId),
                            { host_spotlight_dismissed: false },
                            { merge: true }
                        );
                    } catch (spotlightErr) {
                        console.warn(
                            '[useSocialInvitationChatRoom] host spotlight update skipped',
                            spotlightErr
                        );
                    }
                }

                if (uid !== hostId && hostId) {
                    void createNotification({
                        userId: hostId,
                        type: 'message',
                        title: userProfile?.display_name || 'New message in your event chat',
                        message:
                            type === 'image'
                                ? t('community_chat_image_notification', 'Sent a photo')
                                : String(text).slice(0, 80),
                        actionUrl: `/invitation/social/${partnerId}/chat`,
                    }).catch((notifErr) => {
                        console.warn('[useSocialInvitationChatRoom] host notify skipped', notifErr);
                    });
                }

                return true;
            } catch (err) {
                console.error('[useSocialInvitationChatRoom] postChatMessage', err);
                showToast(t('failed_send_message', 'Failed to send. Please try again.'), 'error');
                return false;
            }
        },
        [partnerId, uid, isMutedInChat, userProfile, currentUser, showToast, t, banner, hostId]
    );

    const sendMessage = useCallback(
        async (text) => {
            const trimmed = String(text || '').trim();
            if (!trimmed) return false;

            const isBigEmoji = detectBigEmoji(trimmed);
            const replyTo = pendingReplyTo;
            if (replyTo) setPendingReplyTo(null);

            return postChatMessage({ text: trimmed, type: isBigEmoji ? 'emoji-big' : 'text', replyTo });
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
                if (replyTo) setPendingReplyTo(null);
                return await postChatMessage({ text: url, type: 'image', replyTo });
            } catch (err) {
                console.error('[useSocialInvitationChatRoom] sendImageMessage', err);
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
                await deleteDoc(doc(db, 'social_invitations', partnerId, 'messages', message.id));
                if (pendingReplyTo?.id === message.id) setPendingReplyTo(null);
                return true;
            } catch (err) {
                console.error('[useSocialInvitationChatRoom] deleteChatMessage', err);
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

    const callInvitationModeration = useCallback(
        async (action, targetUid, extra = {}) => {
            if (!partnerId || !targetUid || targetUid === hostId) return false;
            try {
                const setSocialInvitationMembership = httpsCallable(
                    functions,
                    'setSocialInvitationMembership'
                );
                await setSocialInvitationMembership({
                    invitationId: partnerId,
                    action,
                    targetUid,
                    ...extra,
                });
                return true;
            } catch (err) {
                console.error(`[useSocialInvitationChatRoom] ${action}`, err);
                throw err;
            }
        },
        [functions, hostId, partnerId]
    );

    /** Mute for this event only. duration: 5m | 1h | session */
    const muteMemberInChat = useCallback(
        async (memberId, duration = 'session') => {
            if (!isHost || !partnerId || !memberId || memberId === hostId) return false;
            try {
                await callInvitationModeration('mute_member', memberId, { duration });
                const label =
                    duration === '5m'
                        ? t('stage_mute_5_minutes', '5 minutes')
                        : duration === '1h'
                          ? t('stage_mute_1_hour', '1 hour')
                          : t('stage_mute_entire_broadcast', 'Entire broadcast');
                showToast(
                    t('stage_member_muted_success', 'Muted for {{duration}}', { duration: label }),
                    'success'
                );
                return true;
            } catch (err) {
                showToast(t('member_mute_error', 'Failed to update mute status'), 'error');
                return false;
            }
        },
        [callInvitationModeration, hostId, isHost, partnerId, showToast, t]
    );

    const kickMemberFromStage = useCallback(
        async (memberId) => {
            if (!isHost || !partnerId || !memberId || memberId === hostId) return false;
            try {
                await callInvitationModeration('remove_member', memberId);
                showToast(t('stage_member_removed', 'Member removed from Stage'), 'success');
                return true;
            } catch (err) {
                showToast(t('stage_member_remove_error', 'Failed to remove member from Stage'), 'error');
                return false;
            }
        },
        [callInvitationModeration, hostId, isHost, partnerId, showToast, t]
    );

    const blockMemberFromStages = useCallback(
        async (memberId) => {
            if (!isHost || !partnerId || !memberId || memberId === hostId) return false;
            try {
                await callInvitationModeration('block_member', memberId);
                showToast(t('stage_member_blocked_success', 'Blocked from this event'), 'success');
                return true;
            } catch (err) {
                showToast(t('member_blocked_error', 'Failed to block member'), 'error');
                return false;
            }
        },
        [callInvitationModeration, hostId, isHost, partnerId, showToast, t]
    );

    const deleteHostSpotlightMessage = useCallback(
        async (messageId) => {
            if (!isHost || !partnerId || !messageId) return false;
            try {
                await deleteDoc(doc(db, 'social_invitations', partnerId, 'messages', messageId));
                return true;
            } catch (err) {
                console.error('[useSocialInvitationChatRoom] deleteHostSpotlightMessage', err);
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
                    batch.update(doc(db, 'social_invitations', partnerId, 'messages', m.id), {
                        pinned: m.id === messageId,
                    });
                });
                await batch.commit();
                return true;
            } catch (err) {
                console.error('[useSocialInvitationChatRoom] pinHostMessage', err);
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
                await updateDoc(doc(db, 'social_invitations', partnerId, 'messages', messageId), {
                    pinned: false,
                });
                return true;
            } catch (err) {
                console.error('[useSocialInvitationChatRoom] unpinHostMessage', err);
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
                    batch.update(doc(db, 'social_invitations', partnerId, 'messages', m.id), {
                        bannerSpotlight: m.id === messageId,
                    });
                });
                await batch.commit();
                await setDoc(
                    doc(db, 'social_invitations', partnerId),
                    { host_spotlight_dismissed: false },
                    { merge: true }
                );
                return true;
            } catch (err) {
                console.error('[useSocialInvitationChatRoom] showMessageOnBanner', err);
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
                    await updateDoc(doc(db, 'social_invitations', partnerId, 'messages', messageId), {
                        bannerSpotlight: false,
                    });
                }
                await setDoc(
                    doc(db, 'social_invitations', partnerId),
                    { host_spotlight_dismissed: true },
                    { merge: true }
                );
                return true;
            } catch (err) {
                console.error('[useSocialInvitationChatRoom] hideMessageFromBanner', err);
                return false;
            }
        },
        [isHost, partnerId]
    );

    const updateHostSpotlightPosition = useCallback(
        async (messageId, x, y) => {
            if (!isHost || !partnerId || !messageId) return false;
            try {
                await updateDoc(doc(db, 'social_invitations', partnerId, 'messages', messageId), {
                    spotlightX: sanitizeBannerAxis(x),
                    spotlightY: sanitizeBannerAxis(y),
                });
                return true;
            } catch (err) {
                console.error('[useSocialInvitationChatRoom] updateHostSpotlightPosition', err);
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
                    doc(db, 'social_invitations', partnerId),
                    { host_spotlight_auto: next, host_spotlight_dismissed: !next },
                    { merge: true }
                );
                return true;
            } catch (err) {
                console.error('[useSocialInvitationChatRoom] setHostSpotlightAuto', err);
                showToast(t('failed_send_message', 'Failed to send. Please try again.'), 'error');
                return false;
            }
        },
        [isHost, partnerId, showToast, t]
    );

    /** Device upload removed — guest-frame images are AI-only. */
    const uploadCommunityChatGuestFrameBackgroundFile = useCallback(async () => {
        showToast(
            t('community_guest_frame_bg_upload_disabled', 'Chat backgrounds are AI-generated only.'),
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
                        showToast(result.message || t('ai_insufficient_credits_default'), 'error');
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
                console.error(
                    '[useSocialInvitationChatRoom] generateCommunityChatGuestFrameBackgroundImage',
                    err
                );
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
            const customUrl = imageMode === 'custom' ? String(guestFrame?.customUrl || '').trim() : '';
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
                await updateDoc(doc(db, 'social_invitations', partnerId), update);
                showToast(t('community_chat_zone_theme_saved', 'Chat colors updated.'), 'success');
                return true;
            } catch (err) {
                console.error('[useSocialInvitationChatRoom] saveCommunityChatZoneThemeSettings', err);
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
                await updateDoc(doc(db, 'social_invitations', partnerId), {
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
                console.error('[useSocialInvitationChatRoom] setCommunityChatBannerVisible', err);
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
        loadError,
        isMember,
        isBlockedFromCommunity,
        isHost,
        isDisplaySession: false,
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
        isStageRoom: true,
        muteMemberInChat,
        kickMemberFromStage,
        blockMemberFromStages,
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
        hostId,
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
