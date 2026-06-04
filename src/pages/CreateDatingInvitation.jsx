import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { flushSync } from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    FaCalendarAlt, FaMapMarkerAlt, FaTimes, FaCheckCircle,
    FaUserFriends, FaLock, FaChevronLeft, FaSearch,
    FaHeart, FaCamera, FaUpload, FaImage
} from 'react-icons/fa';
import { useInvitations } from '../context/InvitationContext';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import VenueLocationPicker from '../components/VenueLocationPicker';
import { processInvitationMedia, commitInvitationAiCover, verifyPublicStorageImageUrl } from '../services/mediaService';
import { notifyImageUploadError } from '../utils/imageModerationErrors';
import { getMutualFollowers } from '../utils/followHelpers';
import { db } from '../firebase/config';
import { getSafeAvatar } from '../utils/avatarUtils';
import UserAvatar from '../components/UserAvatar';
import { doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { detectUserLocationContext } from '../utils/locationUtils';
import './PrivateInvitation.css';
import { resolveVenueCountryIso } from '../utils/countryIso';
import { getAppBidiFieldProps } from '../utils/bidiText';
import { getTotalDineCredits, DATING_INVITATION_PUBLISH_CREDITS } from '../utils/privateInvitationCredits';
import PrivateInvitationCardPreview from '../components/Invitations/privateCard/PrivateInvitationCardPreview';
import {
    INVITATION_CARD_MESSAGE_MAX,
    INVITATION_CARD_TITLE_MAX
} from '../constants/invitationCardLimits';
import DatingCardPreviewStage from '../components/Invitations/privateCard/DatingCardPreviewStage';
import {
    DEFAULT_PRIVATE_TEXT_BACKDROP_TONE,
    getDatingCardTextBackdropFromInvitation
} from '../components/Invitations/privateCard/privateCardTextBackdrop';
import { DEFAULT_FRAME_COLOR_ID } from '../components/Invitations/privateCard/privateCardFrameColors';
import { DEFAULT_FONT_ID } from '../components/Invitations/privateCard/privateCardFonts';
import { DEFAULT_MOTION_ID } from '../components/Invitations/privateCard/privateCardMotions';
import {
    getDatingCardBackgroundOptions,
    getDatingHeroCoverFromMediaData,
    parseDatingCoverTemplateIdFromUrl,
    DEFAULT_DATING_CARD_BACKGROUND_ID
} from '../components/Invitations/datingCard/datingCardBackgrounds';
import DatingCoverCameraPanel from '../components/Invitations/datingCard/DatingCoverCameraPanel';
import PrivateInvitationCoverRightRail from '../components/Invitations/privateCard/PrivateInvitationCoverRightRail';
import {
    createPrivateCoverStashId,
    isCoverStashKindAtLimit,
    isSamePrivateCoverMedia,
    PRIVATE_COVER_STASH_MAX_IMAGES,
    PRIVATE_COVER_STASH_MAX_VIDEOS,
    PRIVATE_COVER_STASH_MAX_AI_IMAGES,
    revokeAllPrivateCoverStash,
    revokePrivateCoverMedia,
    revokePrivateCoverStashEntry
} from '../utils/privateCoverMediaStash';
import AIFloatingLauncher from '../components/AIFloatingLauncher';
import { applyInvitationAiFields } from '../utils/aiContentFieldMapper';
import { parseAiStudioImageFromState } from '../utils/aiStudioImagePayload';
import { validateDatingAiContext, createDatingAiContextFromForm } from '../utils/datingAiRequestPayload';
import { resolveCardStructureFromBackgroundId } from '../utils/cardStructure';
import { rememberPrivateDraftCreateKind } from '../utils/privateInvitationDraft';

function resolvePrivateInvitationAuthorUid(authUser, invitationContextUser) {
    return authUser?.uid || invitationContextUser?.uid || invitationContextUser?.id || null;
}

/** Firestore rejects `undefined` field values. */
function sanitizeFirestoreDraft(obj) {
    const clean = {};
    Object.entries(obj).forEach(([k, v]) => {
        if (v !== undefined) clean[k] = v;
    });
    return clean;
}

const CreateDatingInvitation = () => {
    const { t, i18n } = useTranslation();
    const bidiFieldProps = useMemo(() => getAppBidiFieldProps(i18n.language), [i18n.language]);
    const navigate = useNavigate();
    const location = useLocation();
    const { addPrivateInvitation, currentUser, canCreatePrivateInvitation } = useInvitations();
    const { showToast } = useToast();
    const { currentUser: authUser, userProfile } = useAuth();

    const quotaInfo = canCreatePrivateInvitation('dating');

    const restaurantData = location.state?.restaurantData || location.state?.selectedRestaurant;
    const editInvitation = location.state?.editInvitation;

    const [mediaData, setMediaData] = useState(null);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [mutualFriends, setMutualFriends] = useState([]);
    const [friendSearchQuery, setFriendSearchQuery] = useState('');
    const [friendsLoading, setFriendsLoading] = useState(false);
    const [existingDraftId, setExistingDraftId] = useState(null);
    const [cardFontId, setCardFontId] = useState(DEFAULT_FONT_ID);
    const [cardFrameColorId, setCardFrameColorId] = useState(DEFAULT_FRAME_COLOR_ID);
    /** `#rrggbb` or null — one color for frame border + all text; null uses `cardFrameColorId` preset. */
    const [datingCardThemeColor, setDatingCardThemeColor] = useState(null);
    const [cardMotionId, setCardMotionId] = useState(DEFAULT_MOTION_ID);
    const [cardBackgroundId, setCardBackgroundId] = useState(
        () => editInvitation?.cardBackgroundId || DEFAULT_DATING_CARD_BACKGROUND_ID
    );
    const [datingCoverTab, setDatingCoverTab] = useState(() => (editInvitation ? 'camera' : 'template'));
    /** Bumps when user selects the Camera cover tab (or taps it again) to open the recorder. */
    const [cameraOpenNonce, setCameraOpenNonce] = useState(0);
    const [aiCoverCommittingId, setAiCoverCommittingId] = useState(null);
    /** Dating card: show personal message + profile on the preview (default on). */
    const [datingCardShowHostAndMessage, setDatingCardShowHostAndMessage] = useState(true);
    const [datingCardTextBackdropTone, setDatingCardTextBackdropTone] = useState(
        DEFAULT_PRIVATE_TEXT_BACKDROP_TONE
    );
    /** Temp upload/video drafts shown as thumbnails until publish. */
    const [coverMediaStash, setCoverMediaStash] = useState([]);

    const [formData, setFormData] = useState({
        title: restaurantData ? `${t('dinner_at')} ${restaurantData.name}` : '',
        restaurantId: restaurantData?.id || null,
        restaurantName: restaurantData?.name || '',
        city: restaurantData?.city || '',
        date: '',
        time: '',
        location: restaurantData?.address || restaurantData?.location || '',
        description: '',
        privacy: 'private',
        invitedFriends: [],
        country: restaurantData?.country || '',
        lat: restaurantData?.lat || restaurantData?.coordinates?.lat,
        lng: restaurantData?.lng || restaurantData?.coordinates?.lng,
        userLat: null,
        userLng: null,
        occasionType: 'Dating',
        venueType: restaurantData?.businessType || 'Restaurant',
    });

    /** Persist cover media per tab when switching Camera / Upload / Template */
    const datingCoverDraftsRef = useRef({ template: null, upload: null, camera: null, ai: null });
    const mediaDataRef = useRef(null);
    const datingCoverTabRef = useRef(editInvitation ? 'camera' : 'template');
    const coverUploadInputRef = useRef(null);
    const datingAiFieldsRef = useRef(null);
    const [datingAiFieldsPulse, setDatingAiFieldsPulse] = useState(false);
    const formDataRef = useRef(null);
    const mutualFriendsRef = useRef([]);
    const coverMediaStashRef = useRef([]);
    const cardBackgroundIdRef = useRef(cardBackgroundId);

    useEffect(() => {
        mediaDataRef.current = mediaData;
    }, [mediaData]);
    useEffect(() => {
        datingCoverTabRef.current = datingCoverTab;
    }, [datingCoverTab]);
    useEffect(() => {
        coverMediaStashRef.current = coverMediaStash;
    }, [coverMediaStash]);

    const aiStudioAppliedRef = useRef(false);
    useEffect(() => {
        const studio = parseAiStudioImageFromState(location.state?.aiStudioImage);
        if (!studio || aiStudioAppliedRef.current) return;
        aiStudioAppliedRef.current = true;
        const media = {
            source: 'ai_generated',
            type: 'image',
            url: studio.publishedUrl,
            preview: studio.publishedUrl,
            publishedUrl: studio.publishedUrl,
        };
        setMediaData(media);
        setDatingCoverTab('upload');
        datingCoverDraftsRef.current.upload = media;
    }, [location.state?.aiStudioImage]);

    formDataRef.current = formData;
    mutualFriendsRef.current = mutualFriends;
    cardBackgroundIdRef.current = cardBackgroundId;

    useEffect(() => {
        return () => {
            revokeAllPrivateCoverStash(coverMediaStashRef.current);
        };
    }, []);

    const datingHeroCover = useMemo(() => getDatingHeroCoverFromMediaData(mediaData), [mediaData]);

    const heroCoverPending = useMemo(() => {
        if (!mediaData) return false;
        // mediaData may be a pending AI image entry (pending:true) or an ai_generated preview without publishedUrl
        return Boolean(mediaData?.pending || (mediaData?.source === 'ai_generated' && !mediaData?.publishedUrl));
    }, [mediaData]);

    const editorPhotoBackgroundActive = useMemo(() => {
        if (datingHeroCover?.src) return true;
        return getDatingCardBackgroundOptions().some((o) => o.id === cardBackgroundId);
    }, [datingHeroCover?.src, cardBackgroundId]);

    // Populate when editing
    useEffect(() => {
        if (editInvitation) {
            setExistingDraftId(editInvitation.id);
            setFormData({
                title: editInvitation.title || '',
                restaurantId: editInvitation.restaurantId || null,
                restaurantName: editInvitation.restaurantName || '',
                city: editInvitation.city || '',
                date: editInvitation.date || '',
                time: editInvitation.time || '',
                location: editInvitation.location || '',
                description: editInvitation.description || '',
                privacy: 'private',
                invitedFriends: editInvitation.invitedFriends || [],
                country: editInvitation.country || '',
                lat: editInvitation.lat || null,
                lng: editInvitation.lng || null,
                userLat: editInvitation.userLat || null,
                userLng: editInvitation.userLng || null,
                occasionType: 'Dating',
                venueType: editInvitation.venueType || 'Restaurant',
            });
            setDatingCardShowHostAndMessage(editInvitation.datingCardShowHostAndMessage !== false);
            const backdrop = getDatingCardTextBackdropFromInvitation(editInvitation);
            setDatingCardTextBackdropTone(backdrop.tone);

            const videoUrl = editInvitation.customVideo;
            const imgUrl = editInvitation.customImage || editInvitation.image;
            if (videoUrl) {
                const m = {
                    source: 'custom_video',
                    type: 'video',
                    preview: videoUrl,
                    file: null,
                    videoThumbnail: editInvitation.videoThumbnail
                };
                const videoEntry = { id: createPrivateCoverStashId(), kind: 'camera', media: m };
                setCoverMediaStash([videoEntry]);
                setDatingCoverTab('camera');
                setMediaData(m);
                datingCoverDraftsRef.current = { template: null, upload: null, camera: m };
            } else if (imgUrl) {
                const templateId =
                    parseDatingCoverTemplateIdFromUrl(imgUrl) || editInvitation.cardBackgroundId;
                if (templateId && getDatingCardBackgroundOptions().some((o) => o.id === templateId)) {
                    setCardBackgroundId(templateId);
                    setDatingCoverTab('template');
                    setMediaData(null);
                    datingCoverDraftsRef.current = { template: null, upload: null, camera: null };
                } else {
                    const m = {
                        source: 'custom_image',
                        type: 'image',
                        preview: imgUrl,
                        url: imgUrl,
                        file: null
                    };
                    const imageEntry = { id: createPrivateCoverStashId(), kind: 'upload', media: m };
                    setCoverMediaStash([imageEntry]);
                    setDatingCoverTab('upload');
                    setMediaData(m);
                    datingCoverDraftsRef.current = { template: null, upload: m, camera: null };
                }
            } else if (
                editInvitation.cardBackgroundId &&
                getDatingCardBackgroundOptions().some((o) => o.id === editInvitation.cardBackgroundId)
            ) {
                setCardBackgroundId(editInvitation.cardBackgroundId);
                setDatingCoverTab('template');
                setMediaData(null);
                datingCoverDraftsRef.current = { template: null, upload: null, camera: null };
            } else {
                setDatingCoverTab('template');
                datingCoverDraftsRef.current = { template: null, upload: null, camera: null };
            }

            setCardFontId(editInvitation.cardFontId || DEFAULT_FONT_ID);
            setCardFrameColorId(editInvitation.cardFrameColorId || DEFAULT_FRAME_COLOR_ID);
            const rawTheme =
                (typeof editInvitation.datingCardThemeColor === 'string' && editInvitation.datingCardThemeColor.trim()) ||
                (typeof editInvitation.datingCardTextColor === 'string' && editInvitation.datingCardTextColor.trim()) ||
                '';
            setDatingCardThemeColor(/^#[0-9A-Fa-f]{6}$/.test(rawTheme) ? rawTheme : null);
            setCardMotionId(editInvitation.cardMotionId || DEFAULT_MOTION_ID);
        }
    }, [editInvitation]);

    /** Default dating card background + validate when opening editor */
    useEffect(() => {
        const opts = getDatingCardBackgroundOptions();
        if (opts.length === 0) {
            setCardBackgroundId(null);
            return;
        }
        if (
            editInvitation?.cardBackgroundId &&
            opts.some((o) => o.id === editInvitation.cardBackgroundId)
        ) {
            setCardBackgroundId(editInvitation.cardBackgroundId);
            return;
        }
        setCardBackgroundId((prev) => (prev && opts.some((o) => o.id === prev) ? prev : opts[0].id));
    }, [editInvitation?.id]);

    // Fetch mutual followers
    useEffect(() => {
        const fetchFriends = async () => {
            const userId = authUser?.uid || currentUser?.id;
            if (!userId || userId === 'guest') return;

            setFriendsLoading(true);
            try {
                let followingIds = userProfile?.following || [];
                if (followingIds.length === 0) {
                    const userDoc = await getDoc(doc(db, 'users', userId));
                    followingIds = userDoc.data()?.following || [];
                }
                const friends = await getMutualFollowers(userId, followingIds);
                const enrichedFriends = await Promise.all(
                    friends.map(async (friend) => {
                        try {
                            const friendDoc = await getDoc(doc(db, 'users', friend.id));
                            const friendData = friendDoc.exists() ? friendDoc.data() : {};
                            return {
                                ...friend,
                                availableForDating: friendData.availableForDating !== false
                            };
                        } catch {
                            return {
                                ...friend,
                                availableForDating: true
                            };
                        }
                    })
                );
                setMutualFriends(enrichedFriends);
            } catch (error) {
                console.error('Error fetching friends:', error);
            } finally {
                setFriendsLoading(false);
            }
        };
        fetchFriends();
    }, [authUser, currentUser, userProfile]);

    // Unified location discovery for all users/pages.
    useEffect(() => {
        if (restaurantData) return;

        const detectLocation = async () => {
            const detected = await detectUserLocationContext(userProfile);
            if (!detected.success) return;
            setFormData(prev => ({
                ...prev,
                city: detected.city || prev.city,
                country: detected.country || prev.country || '',
                countryCode: detected.countryCode || prev.countryCode || '',
                userLat: detected.latitude ?? prev.userLat,
                userLng: detected.longitude ?? prev.userLng
            }));
        };

        detectLocation();
    }, [restaurantData, userProfile]);

    const handleLocationSelect = (placeData) => {
        setFormData(prev => ({
            ...prev,
            location: placeData.fullAddress || placeData.name || prev.location,
            lat: placeData.lat ?? prev.lat,
            lng: placeData.lng ?? prev.lng,
            restaurantId: placeData.restaurantId || null,
            restaurantName: placeData.restaurantName || placeData.name || prev.restaurantName,
            city: placeData.city || prev.city,
            venueType:
                placeData.businessType ||
                placeData.venueType ||
                prev.venueType ||
                'Restaurant',
            title: placeData.name ? `${t('invitation_at')} ${placeData.name}` : prev.title
        }));
    };

    const selectedInviteeId = formData.invitedFriends?.[0] || null;
    const selectedInvitee = useMemo(
        () => mutualFriends.find((f) => f.id === selectedInviteeId) || null,
        [mutualFriends, selectedInviteeId]
    );

    const datingAiContext = useMemo(
        () => createDatingAiContextFromForm(formData, selectedInvitee?.display_name || '', cardBackgroundId),
        [formData, selectedInvitee, cardBackgroundId]
    );

    /** Always reads latest form state (safe inside floating portal). */
    const getDatingAiContext = useCallback(() => {
        const fd = formDataRef.current || formData;
        const friends = mutualFriendsRef.current || mutualFriends;
        const inviteeId = fd?.invitedFriends?.[0] || '';
        const invitee = friends.find((f) => f.id === inviteeId);
        return createDatingAiContextFromForm(
            fd,
            invitee?.display_name || '',
            cardBackgroundIdRef.current || cardBackgroundId
        );
    }, [formData, mutualFriends, cardBackgroundId]);

    const datingAiReady = useMemo(
        () => validateDatingAiContext(datingAiContext).ok,
        [datingAiContext]
    );

    const datingAiDisabledHint = useMemo(() => {
        if (datingAiReady) return undefined;
        return t('dating_ai_all_fields_required', {
            defaultValue: 'يرجى ملء جميع الحقول أولاً لتخصيص الدعوة.',
        });
    }, [datingAiReady, t]);

    const filteredFriends = mutualFriends.filter(friend =>
        friend.display_name?.toLowerCase().includes(friendSearchQuery.toLowerCase())
    );

    // Dating: max 1 guest
    const MAX_GUESTS = 1;
    const isAtLimit = (formData.invitedFriends || []).length >= MAX_GUESTS;

    const toggleFriendSelection = async (friendId) => {
        const current = formData.invitedFriends || [];
        if (current.includes(friendId)) {
            setFormData(prev => ({ ...prev, invitedFriends: current.filter(id => id !== friendId) }));
            return;
        }

        if (isAtLimit) return;

        const target = mutualFriends.find((f) => f.id === friendId);
        if (target?.availableForDating === false) {
            showToast(t('dating_invite_disabled_by_user', 'This person has disabled receiving dating invitations.'), 'error');
            return;
        }

        setFormData(prev => ({ ...prev, invitedFriends: [friendId] }));
    };

    const revokeBlobPreview = (prev) => {
        if (!prev) return;
        const stillInStash = coverMediaStashRef.current.some((e) => isSamePrivateCoverMedia(e.media, prev));
        if (!stillInStash) {
            revokePrivateCoverMedia(prev);
        }
    };

    const setCoverMedia = (next) => {
        setMediaData((prev) => {
            let resolved;
            if (next === null) {
                revokeBlobPreview(prev);
                resolved = null;
            } else if (typeof next === 'function') {
                resolved = next(prev);
                if (
                    prev?.preview &&
                    String(prev.preview).startsWith('blob:') &&
                    resolved?.preview !== prev.preview
                ) {
                    revokeBlobPreview(prev);
                }
            } else {
                if (
                    prev?.preview &&
                    String(prev.preview).startsWith('blob:') &&
                    prev.preview !== next?.preview
                ) {
                    revokeBlobPreview(prev);
                }
                resolved = next;
            }
            datingCoverDraftsRef.current[datingCoverTabRef.current] = resolved;
            return resolved;
        });
    };

    const handleDatingCoverTab = (tab) => {
        if (tab === datingCoverTab) return;
        datingCoverDraftsRef.current[datingCoverTab] = mediaDataRef.current;

        setDatingCoverTab(tab);
        const restored = datingCoverDraftsRef.current[tab];
        setMediaData(restored ?? null);
    };

    const toastCoverStashLimit = (kind) => {
        if (kind === 'upload') {
            showToast(
                t('private_cover_stash_max_images', {
                    defaultValue: `You can add up to ${PRIVATE_COVER_STASH_MAX_IMAGES} photos. Remove one from the thumbnails to add another.`,
                    max: PRIVATE_COVER_STASH_MAX_IMAGES
                }),
                'error'
            );
        } else if (kind === 'ai') {
            showToast(
                t('private_cover_stash_max_ai', {
                    defaultValue: `You can keep up to ${PRIVATE_COVER_STASH_MAX_AI_IMAGES} AI covers. Remove one from the thumbnails to generate another.`,
                    max: PRIVATE_COVER_STASH_MAX_AI_IMAGES
                }),
                'error'
            );
        } else {
            showToast(
                t('private_cover_stash_max_videos', {
                    defaultValue: `You can add up to ${PRIVATE_COVER_STASH_MAX_VIDEOS} videos. Remove one from the thumbnails to record another.`,
                    max: PRIVATE_COVER_STASH_MAX_VIDEOS
                }),
                'error'
            );
        }
    };

    const commitAiCoverMedia = async (media, stashId = null) => {
        if (media?.publishedUrl) return media;
        if (stashId) setAiCoverCommittingId(stashId);
        try {
            const userId = currentUser?.id || authUser?.uid;
            if (!userId) {
                throw new Error('not_signed_in');
            }
            const publishedUrl = await commitInvitationAiCover(media, userId);
            if (media.preview && String(media.preview).startsWith('blob:')) {
                const ready = await verifyPublicStorageImageUrl(publishedUrl, { attempts: 4, delayMs: 400 });
                if (ready) {
                    revokePrivateCoverMedia({ preview: media.preview });
                    return {
                        ...media,
                        source: 'ai_generated',
                        url: publishedUrl,
                        preview: publishedUrl,
                        publishedUrl,
                    };
                }
                return {
                    ...media,
                    source: 'ai_generated',
                    url: publishedUrl,
                    publishedUrl,
                };
            }
            return {
                ...media,
                source: 'ai_generated',
                url: publishedUrl,
                preview: publishedUrl,
                publishedUrl,
            };
        } finally {
            if (stashId) setAiCoverCommittingId(null);
        }
    };

    const updateAiStashMedia = (stashId, media) => {
        setCoverMediaStash((prev) =>
            prev.map((entry) => (entry.id === stashId ? { ...entry, media } : entry))
        );
    };

    const handleDatingCoverUploadTabClick = () => {
        if (datingCoverTab === 'upload') {
            if (isCoverStashKindAtLimit(coverMediaStashRef.current, 'upload')) {
                toastCoverStashLimit('upload');
                return;
            }
            triggerDatingCoverUpload();
        } else {
            handleDatingCoverTab('upload');
        }
    };

    const handleDatingCoverCameraTabClick = () => {
        if (datingCoverTab === 'camera') {
            if (isCoverStashKindAtLimit(coverMediaStashRef.current, 'camera')) {
                toastCoverStashLimit('camera');
                return;
            }
            setCameraOpenNonce((n) => n + 1);
        } else {
            handleDatingCoverTab('camera');
        }
    };

    const stashCoverMedia = (kind, media) => {
        if (isCoverStashKindAtLimit(coverMediaStashRef.current, kind)) {
            toastCoverStashLimit(kind);
            return null;
        }
        const entry = { id: createPrivateCoverStashId(), kind, media };
        setCoverMediaStash((prev) => [...prev, entry]);
        return entry;
    };

    const handleCameraCoverMedia = (media) => {
        datingCoverDraftsRef.current[datingCoverTab] = mediaDataRef.current;
        if (!stashCoverMedia('camera', media)) {
            revokePrivateCoverMedia(media);
            return;
        }
        setDatingCoverTab('camera');
        setMediaData(media);
        datingCoverDraftsRef.current.camera = media;
    };

    const handleDatingCoverUploadPick = (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file?.type?.startsWith('image/')) {
            if (file) {
                showToast(t('image_only_upload', { defaultValue: 'Please choose an image file.' }), 'error');
            }
            return;
        }
        datingCoverDraftsRef.current[datingCoverTab] = mediaDataRef.current;
        const preview = URL.createObjectURL(file);
        const media = {
            source: 'custom_image',
            type: 'image',
            file,
            preview
        };
        if (!stashCoverMedia('upload', media)) {
            revokePrivateCoverMedia(media);
            return;
        }
        setDatingCoverTab('upload');
        setMediaData(media);
        datingCoverDraftsRef.current.upload = media;
    };

    const handleSelectCoverStashItem = async (id) => {
        const entry = coverMediaStashRef.current.find((e) => e.id === id);
        if (!entry) return;
        datingCoverDraftsRef.current[datingCoverTab] = mediaDataRef.current;

        let media = entry.media;
        if (entry.kind === 'ai' && !media.publishedUrl) {
            try {
                media = await commitAiCoverMedia(media, id);
                updateAiStashMedia(id, media);
            } catch (err) {
                console.error('AI cover commit failed:', err);
                showToast(
                    err?.message === 'not_signed_in'
                        ? t('please_sign_in', { defaultValue: 'Please sign in to continue.' })
                        : t('media_upload_failed', { defaultValue: 'Failed to upload media.' }),
                    'error'
                );
                return;
            }
        }

        setDatingCoverTab(entry.kind);
        setMediaData(media);
        datingCoverDraftsRef.current[entry.kind] = media;
    };

    const handleRemoveCoverStashItem = (id) => {
        setCoverMediaStash((prev) => {
            const entry = prev.find((e) => e.id === id);
            if (!entry) return prev;
            revokePrivateCoverStashEntry(entry);
            const next = prev.filter((e) => e.id !== id);
            if (isSamePrivateCoverMedia(entry.media, mediaDataRef.current)) {
                const sameKind = next.filter((e) => e.kind === entry.kind);
                const replacement = sameKind.length ? sameKind[sameKind.length - 1].media : null;
                setMediaData(replacement);
                datingCoverDraftsRef.current[entry.kind] = replacement;
            }
            return next;
        });
    };

    const clearCoverMediaStashAfterPublish = () => {
        revokeAllPrivateCoverStash(coverMediaStashRef.current);
        setCoverMediaStash([]);
        revokePrivateCoverMedia(mediaDataRef.current);
    };

    const triggerDatingCoverUpload = () => {
        coverUploadInputRef.current?.click();
    };

    const buildDatingInvitationAiPrompt = useCallback(() => {
        const parts = [
            selectedInvitee?.display_name &&
                `المدعو/ة: ${selectedInvitee.display_name}`,
            formData.location?.trim() && `المكان: ${formData.location.trim()}`,
            formData.date && formData.time && `الموعد: ${formData.date} ${formData.time}`,
            formData.title?.trim() && `عنوان حالي: ${formData.title.trim()}`,
            formData.description?.trim() && `رسالة حالية: ${formData.description.trim()}`,
        ].filter(Boolean);
        return parts.join('\n') || 'اكتب عنوان دعوة موعد ورسالة رومانسية قصيرة ومناسبة';
    }, [formData, selectedInvitee]);

    const handleDatingInvitationAiContent = useCallback((data) => {
        const applied = applyInvitationAiFields(data, {
            titleMax: INVITATION_CARD_TITLE_MAX,
            descriptionMax: INVITATION_CARD_MESSAGE_MAX,
            cardStructure: resolveCardStructureFromBackgroundId(cardBackgroundId),
        });

        if (!applied.hasContent) {
            console.warn('[CreateDatingInvitation] AI response had no mappable title/description', data);
            showToast(
                t(
                    'dating_ai_fields_empty',
                    'تم التوليد لكن لم نتمكن من قراءة العنوان أو الرسالة. حاول مرة أخرى.'
                ),
                'error'
            );
            return false;
        }

        flushSync(() => {
            setFormData((prev) => ({
                ...prev,
                title: applied.hasTitle ? applied.title : prev.title,
                description: applied.hasDescription ? applied.description : prev.description,
            }));
        });

        setDatingAiFieldsPulse(true);
        window.setTimeout(() => setDatingAiFieldsPulse(false), 1600);

        requestAnimationFrame(() => {
            datingAiFieldsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });

        if (!applied.hasDescription) {
            showToast(
                t(
                    'dating_ai_description_missing',
                    'تم ملء العنوان فقط — أعد التوليد أو اكتب الرسالة يدوياً.'
                ),
                'info'
            );
        }

        return true;
    }, [showToast, t, cardBackgroundId]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handlePreview = async (e) => {
        e.preventDefault();

        if (!formData.title.trim() || !formData.date || !formData.time || !formData.location.trim()) {
            showToast(t('please_fill_required_fields') || 'Please fill in all required fields', 'error');
            return;
        }

        if (formData.invitedFriends.length === 0) {
            showToast(t('please_invite_one_person') || 'Please invite someone for your date', 'error');
            return;
        }

        const quota = canCreatePrivateInvitation('dating');
        if (!editInvitation && !quota.profileLoading && !quota.canCreate) {
            showToast(
                t(
                    'dine_credits_dating_insufficient',
                    `Publishing costs ${DATING_INVITATION_PUBLISH_CREDITS} Dine Credits. Open Settings → Dine Credits to top up.`
                ),
                'error'
            );
            return;
        }

        setIsSubmitting(true);
        try {
            const authorUid = resolvePrivateInvitationAuthorUid(authUser, currentUser);
            if (!authorUid) {
                showToast(t('please_sign_in', { defaultValue: 'Please sign in to continue.' }), 'error');
                return;
            }

            let mediaFields = {};
            let activeMedia = mediaData;
            if (activeMedia?.source === 'ai_generated' && !activeMedia.publishedUrl) {
                showToast(
                    t('private_cover_ai_uploading', {
                        defaultValue: 'Saving your AI cover to storage…',
                    }),
                    'info',
                    null,
                    4000
                );
                try {
                    const stashEntry = coverMediaStashRef.current.find((e) =>
                        isSamePrivateCoverMedia(e.media, activeMedia)
                    );
                    activeMedia = await commitAiCoverMedia(activeMedia, stashEntry?.id ?? null);
                    if (stashEntry) {
                        updateAiStashMedia(stashEntry.id, activeMedia);
                    }
                    setMediaData(activeMedia);
                    datingCoverDraftsRef.current.ai = activeMedia;
                } catch (mediaError) {
                    console.error('❌ AI cover commit failed:', mediaError);
                    notifyImageUploadError(showToast, mediaError, t, 'media_upload_failed');
                    return;
                }
            }
            if (activeMedia) {
                try {
                    mediaFields = await processInvitationMedia(activeMedia, authorUid);
                } catch (mediaError) {
                    console.error('❌ Media processing failed:', mediaError);
                    notifyImageUploadError(showToast, mediaError, t, 'media_upload_failed');
                    return;
                }
            }

            const initialRsvps = {};
            formData.invitedFriends.forEach(friendId => {
                initialRsvps[friendId] = 'pending';
            });

            const draftData = sanitizeFirestoreDraft({
                ...formData,
                ...mediaFields,
                cardFrameColorId,
                cardFontId,
                cardMotionId,
                cardBackgroundId: cardBackgroundId || null,
                datingCardThemeColor,
                datingCardShowHostAndMessage,
                datingCardTextBackdropTone,
                rsvps: initialRsvps,
                type: 'Dating',
                status: 'draft',
            });

            rememberPrivateDraftCreateKind('dating');

            if (existingDraftId) {
                const draftRef = doc(db, 'private_invitations', existingDraftId);
                await updateDoc(draftRef, {
                    ...draftData,
                    updatedAt: serverTimestamp(),
                });
                navigate(`/invitation/private/preview/${existingDraftId}`, { replace: true });
                clearCoverMediaStashAfterPublish();
            } else {
                const draftId = await addPrivateInvitation({
                    ...draftData,
                    createdAt: serverTimestamp(),
                });
                if (draftId) {
                    navigate(`/invitation/private/preview/${draftId}`, { replace: true });
                    clearCoverMediaStashAfterPublish();
                } else {
                    showToast(t('failed_create_invitation'), 'error');
                }
            }
        } catch (error) {
            console.error('Error creating dating draft:', error);
            showToast(t('failed_create_invitation'), 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const quota = quotaInfo.quota;
    const isUnlimited = quota === 'unlimited' || quota === '∞' || quota === -1;
    const profilePending = Boolean(quotaInfo.profileLoading) || quota === 'pending';
    const dineBalance = getTotalDineCredits(userProfile);
    const publishCost = DATING_INVITATION_PUBLISH_CREDITS;
    const lowCredits = !isUnlimited && !profilePending && dineBalance < publishCost;

    const datingCoverTabLabel = useMemo(() => {
        const labels = {
            camera: t('private_cover_tab_camera_record', { defaultValue: 'Record video' }),
            upload: t('private_cover_tab_upload_device', { defaultValue: 'Upload from device' }),
            template: t('dating_cover_tab_template', { defaultValue: 'Template' })
        };
        return labels[datingCoverTab] || '';
    }, [datingCoverTab, t]);

    return (
        <div className="private-create-wrapper private-theme dating-invite-page">
            <div className="private-header-premium dating-invite-header">
                <button onClick={() => navigate(-1)} className="private-back-btn">
                    <FaChevronLeft />
                </button>
                <div className="private-header-badge dating-invite-header__badge">
                    💑 {t('dinebuddy_date', 'DineBuddy Date')}
                </div>
                <h2 className="private-header-title dating-invite-header__title">
                    <FaHeart />
                    {t('dinebuddy_date', 'DineBuddy Date')}
                </h2>
                <p className="private-header-desc">
                    {t('dating_invitation_desc', 'Send an exclusive private date invitation to one special person.')}
                </p>

                {!quotaInfo.profileLoading && (
                    <div
                        className={`dating-invite-header__credits${
                            lowCredits ? ' dating-invite-header__credits--low' : ''
                        }${isUnlimited ? ' dating-invite-header__credits--unlimited' : ''}`}
                    >
                        <span>{isUnlimited ? '∞' : `${dineBalance}`}</span>
                        <span className="dating-invite-header__credits-text">
                            {isUnlimited
                                ? t('unlimited_date_invitations', 'Unlimited date invitations')
                                : t(
                                      'dine_credits_dating_banner',
                                      '{{balance}} Dine Credits — publishing uses {{cost}} credits.',
                                      { balance: dineBalance, cost: publishCost }
                                  )}
                        </span>
                    </div>
                )}
            </div>

            <div className="private-form-container" style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
                <form onSubmit={handlePreview} className="elegant-form">

                    {/* Date & time — one compact row */}
                    <div className="form-group mb-3 dating-datetime-inline">
                        <label className="elegant-label dating-datetime-inline__label">
                            <FaCalendarAlt aria-hidden /> {t('date_and_time', 'Date & time')}
                        </label>
                        <div className="dating-datetime-inline__row">
                            <input
                                type="date"
                                name="date"
                                value={formData.date}
                                onChange={handleChange}
                                className="elegant-input dating-datetime-inline__input"
                                min={new Date().toISOString().split('T')[0]}
                                required
                                aria-label={t('date')}
                            />
                            <input
                                type="time"
                                name="time"
                                value={formData.time}
                                onChange={handleChange}
                                className="elegant-input dating-datetime-inline__input"
                                required
                                aria-label={t('time')}
                            />
                        </div>
                    </div>

                    {/* Location */}
                    <div className="form-group mb-3 venue-search-stack">
                        <label className="elegant-label"><FaMapMarkerAlt className="label-icon" /> {t('location')}</label>
                        <VenueLocationPicker
                            compact
                            value={formData.location}
                            onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                            onSelect={handleLocationSelect}
                            city={formData.city}
                            countryCode={resolveVenueCountryIso(formData, userProfile)}
                            userLat={formData.userLat ?? userProfile?.coordinates?.lat}
                            userLng={formData.userLng ?? userProfile?.coordinates?.lng}
                            className="elegant-input"
                        />
                    </div>

                    {/* Date Selection — 1 person only */}
                    <div className="form-group mb-4" style={{ background: 'rgba(236,72,153,0.05)', padding: '15px', borderRadius: '16px', border: '1px solid rgba(236,72,153,0.2)' }}>
                        <label className="elegant-label" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                            <span><FaUserFriends /> {t('select_your_date', 'Select Your Date')}</span>
                            <span style={{
                                color: isAtLimit ? '#ec4899' : 'var(--text-muted)',
                                fontSize: '0.8rem',
                                fontWeight: 700
                            }}>
                                {formData.invitedFriends.length}/{MAX_GUESTS}
                                {isAtLimit && ' 💑'}
                            </span>
                        </label>

                        {isAtLimit && (
                            <div style={{
                                marginBottom: 10,
                                padding: '8px 12px',
                                borderRadius: '10px',
                                background: 'rgba(236,72,153,0.08)',
                                border: '1px solid rgba(236,72,153,0.3)',
                                color: '#ec4899',
                                fontSize: '0.82rem',
                                fontWeight: 600
                            }}>
                                💑 {t('dating_one_person_selected', 'Your date is selected. Remove to choose someone else.')}
                            </div>
                        )}

                        {/* Search */}
                        <div style={{ position: 'relative', marginBottom: 12 }}>
                            <input
                                type="text"
                                placeholder={t('search_friends')}
                                value={friendSearchQuery}
                                onChange={(e) => setFriendSearchQuery(e.target.value)}
                                style={{ width: '100%', padding: '10px 36px 10px 14px', borderRadius: '10px', border: '1px solid rgba(236,72,153,0.3)', background: 'var(--bg-card)', color: 'var(--text-main)', fontSize: '0.9rem' }}
                            />
                            <FaSearch style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }} />
                        </div>

                        {/* Friends grid */}
                        {friendsLoading ? (
                            <div style={{ textAlign: 'center', padding: '20px', opacity: 0.5 }}>{t('loading')}</div>
                        ) : filteredFriends.length > 0 ? (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: 10, maxHeight: 240, overflowY: 'auto', padding: '4px 2px' }}>
                                {filteredFriends.map(friend => {
                                    const isSelected = formData.invitedFriends.includes(friend.id);
                                    const isDisabled = !isSelected && isAtLimit;
                                    const canReceiveDating = friend.availableForDating !== false;
                                    return (
                                        <div
                                            key={friend.id}
                                            onClick={() => {
                                                if (isDisabled || !canReceiveDating) return;
                                                toggleFriendSelection(friend.id);
                                            }}
                                            style={{
                                                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                                                padding: '10px 6px', borderRadius: 12,
                                                background: isSelected ? 'rgba(236,72,153,0.15)' : 'rgba(255,255,255,0.03)',
                                                border: `1.5px solid ${isSelected ? '#ec4899' : 'rgba(255,255,255,0.07)'}`,
                                                cursor: (isDisabled || !canReceiveDating) ? 'not-allowed' : 'pointer',
                                                opacity: (isDisabled || !canReceiveDating) ? 0.4 : 1,
                                                transition: 'all 0.18s',
                                                position: 'relative'
                                            }}
                                        >
                                            {isSelected && (
                                                <div style={{ position: 'absolute', top: 4, right: 4, width: 16, height: 16, borderRadius: '50%', background: '#ec4899', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    <FaHeart style={{ color: 'white', fontSize: '0.5rem' }} />
                                                </div>
                                            )}
                                            <UserAvatar
                                                user={friend}
                                                alt={friend.display_name}
                                                ringColorOverride={isSelected ? '#ec4899' : undefined}
                                                style={{ width: 48, height: 48 }}
                                            />
                                            <span style={{ fontSize: '0.7rem', fontWeight: 600, color: isSelected ? '#ec4899' : 'var(--text-muted)', textAlign: 'center', lineHeight: 1.2, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {friend.display_name?.split(' ')[0]}
                                            </span>
                                            {!canReceiveDating && (
                                                <span style={{ fontSize: '0.58rem', fontWeight: 800, color: '#fca5a5', textAlign: 'center' }}>
                                                    {t('dating_invites_reject', 'Reject')}
                                                </span>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div style={{ textAlign: 'center', padding: '20px', fontSize: '0.85rem', opacity: 0.4 }}>
                                {mutualFriends.length === 0 ? 'Follow people first to invite them' : t('no_friends_found')}
                            </div>
                        )}
                    </div>

                    <div className="mb-4">
                        <AIFloatingLauncher
                            postType="invitation"
                            subType="date"
                            onTextSuccess={handleDatingInvitationAiContent}
                            buildContextPrompt={buildDatingInvitationAiPrompt}
                            datingAiContext={datingAiContext}
                            getDatingAiContext={getDatingAiContext}
                            disabled={isSubmitting}
                            disabledHint={!datingAiReady ? datingAiDisabledHint : undefined}
                        />
                    </div>

                    <div
                        ref={datingAiFieldsRef}
                        className={`dating-ai-text-fields mb-4${datingAiFieldsPulse ? ' dating-ai-text-fields--pulse' : ''}`}
                    >
                        <p
                            className="dating-ai-text-fields__hint"
                            style={{
                                fontSize: '0.78rem',
                                color: 'var(--text-muted)',
                                margin: '0 0 12px',
                                lineHeight: 1.45,
                            }}
                        >
                            {t('dating_ai_text_fields_hint', {
                                defaultValue:
                                    'Use AI above to draft the title and message, or write them yourself.'
                            })}
                        </p>

                        <div className="form-group mb-4">
                            <label className="elegant-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                                {t('invitation_title')}
                                <span
                                    style={{
                                        fontSize: '0.75rem',
                                        color:
                                            (formData.title?.length || 0) >= INVITATION_CARD_TITLE_MAX
                                                ? '#f87171'
                                                : 'var(--text-muted)'
                                    }}
                                >
                                    {(formData.title?.length || 0)}/{INVITATION_CARD_TITLE_MAX}
                                </span>
                            </label>
                            <input
                                type="text"
                                name="title"
                                value={formData.title}
                                onChange={handleChange}
                                placeholder={t('enter_title')}
                                className="elegant-input"
                                maxLength={INVITATION_CARD_TITLE_MAX}
                                required
                                dir={bidiFieldProps.dir}
                                lang={bidiFieldProps.lang}
                                style={bidiFieldProps.style}
                            />
                        </div>

                        <div className="form-group mb-4">
                            <label className="elegant-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                                {t('message_to_friends')}
                                <span
                                    style={{
                                        fontSize: '0.75rem',
                                        color:
                                            (formData.description?.length || 0) >= INVITATION_CARD_MESSAGE_MAX
                                                ? '#f87171'
                                                : 'var(--text-muted)'
                                    }}
                                >
                                    {(formData.description?.length || 0)}/{INVITATION_CARD_MESSAGE_MAX}
                                </span>
                            </label>
                            <textarea
                                name="description"
                                value={formData.description}
                                onChange={handleChange}
                                placeholder={t('write_something_personal')}
                                className="elegant-textarea"
                                rows="3"
                                maxLength={INVITATION_CARD_MESSAGE_MAX}
                                dir={bidiFieldProps.dir}
                                lang={bidiFieldProps.lang}
                                style={bidiFieldProps.style}
                            />
                        </div>
                    </div>

                    {/* Card + cover: one preview row; thumbnails only on the right (template / upload / camera) */}
                    <div className="private-section-card private-section-card--templates mb-4" style={{ borderColor: 'rgba(236,72,153,0.25)' }}>
                        <h3 className="private-section-card__title" style={{ color: '#ec4899' }}>
                            <span aria-hidden>🃏</span>{' '}
                            {t('private_section_templates_title', { defaultValue: 'Ready card looks' })}
                        </h3>
                        <input
                            ref={coverUploadInputRef}
                            type="file"
                            accept="image/*"
                            className="private-cover-upload-input"
                            onChange={handleDatingCoverUploadPick}
                            tabIndex={-1}
                            aria-hidden
                        />
                        <div className="private-cover-tabs-wrap">
                            <p className="private-cover-tabs__active-label" aria-live="polite">
                                {datingCoverTabLabel}
                            </p>
                            <div
                                role="tablist"
                                aria-label={t('dating_cover_tabs_label', { defaultValue: 'Cover source' })}
                                className="private-cover-tabs private-cover-tabs--icons-only"
                            >
                            <button
                                type="button"
                                role="tab"
                                aria-selected={datingCoverTab === 'camera'}
                                onClick={handleDatingCoverCameraTabClick}
                                className={`private-cover-tab${datingCoverTab === 'camera' ? ' private-cover-tab--active' : ''}`}
                                title={t('private_cover_tab_camera_open', { defaultValue: 'Video' })}
                                aria-label={t('private_cover_tab_camera_open', { defaultValue: 'Video' })}
                            >
                                <FaCamera aria-hidden />
                            </button>
                            <button
                                type="button"
                                role="tab"
                                aria-selected={datingCoverTab === 'upload'}
                                onClick={handleDatingCoverUploadTabClick}
                                className={`private-cover-tab${datingCoverTab === 'upload' ? ' private-cover-tab--active' : ''}`}
                                title={t('private_cover_tab_upload_open', { defaultValue: 'From device' })}
                                aria-label={t('private_cover_tab_upload_open', { defaultValue: 'From device' })}
                            >
                                <FaUpload aria-hidden />
                            </button>
                            <button
                                type="button"
                                role="tab"
                                aria-selected={datingCoverTab === 'template'}
                                onClick={() => handleDatingCoverTab('template')}
                                className={`private-cover-tab${datingCoverTab === 'template' ? ' private-cover-tab--active' : ''}`}
                                title={t('dating_cover_tab_template', { defaultValue: 'Template' })}
                                aria-label={t('dating_cover_tab_template', { defaultValue: 'Template' })}
                            >
                                <FaImage aria-hidden />
                            </button>
                            </div>
                        </div>

                        {datingCoverTab === 'camera' && (
                            <DatingCoverCameraPanel
                                onMediaSelect={handleCameraCoverMedia}
                                openNonce={cameraOpenNonce}
                            />
                        )}

                        <div className="form-group mb-0">
                            <div className="private-card-preview-with-bg">
                                <div className="private-card-preview-with-bg__preview-wrap">
                                    <DatingCardPreviewStage
                                        showHostAndMessage={datingCardShowHostAndMessage}
                                        onShowHostAndMessageChange={setDatingCardShowHostAndMessage}
                                        editorPhotoBackgroundActive={editorPhotoBackgroundActive}
                                        textBackdropTone={datingCardTextBackdropTone}
                                        onTextBackdropToneChange={setDatingCardTextBackdropTone}
                                        cardMotionId={cardMotionId}
                                        onCardMotionChange={setCardMotionId}
                                        fontId={cardFontId}
                                        themeColorHex={datingCardThemeColor}
                                        onFontChange={setCardFontId}
                                        onThemeColorChange={setDatingCardThemeColor}
                                    >
                                        <PrivateInvitationCardPreview
                                        cardTemplateSet="dating"
                                        className="private-invitation-card-preview--showcase private-invitation-card-preview--showcase-compact private-invitation-card-preview--dating-editor-meta"
                                        frameColorId={cardFrameColorId}
                                        cardThemeColor={datingCardThemeColor}
                                        cardFontId={cardFontId}
                                        cardMotionId={cardMotionId}
                                        occasionType={formData.occasionType}
                                        cardBackgroundId={cardBackgroundId}
                                        cardStructure={datingAiContext.cardStructure}
                                        heroCoverSrc={datingHeroCover?.src ?? null}
                                        heroCoverMediaType={datingHeroCover?.mediaType ?? null}
                                        heroCoverPoster={datingHeroCover?.poster ?? null}
                                            heroCoverPending={heroCoverPending}
                                        title={formData.title}
                                        description={formData.description}
                                        date={formData.date}
                                        time={formData.time}
                                        location={formData.location}
                                        inviterName={
                                            userProfile?.display_name ||
                                            userProfile?.displayName ||
                                            currentUser?.display_name ||
                                            currentUser?.displayName ||
                                            ''
                                        }
                                        inviterAvatarUrl={getSafeAvatar(userProfile || currentUser || {})}
                                        showHostAndMessage={datingCardShowHostAndMessage}
                                        textBackdropTone={datingCardTextBackdropTone}
                                    />
                                    </DatingCardPreviewStage>
                                </div>
                                <PrivateInvitationCoverRightRail
                                    templateVariant="dating"
                                    categoryId="dating"
                                    cardBackgroundId={cardBackgroundId}
                                    onCardBackgroundIdChange={setCardBackgroundId}
                                    mode={datingCoverTab}
                                    mediaData={mediaData}
                                    coverStash={coverMediaStash}
                                    onSelectStashItem={handleSelectCoverStashItem}
                                    onRemoveStashItem={handleRemoveCoverStashItem}
                                    committingStashId={aiCoverCommittingId}
                                />
                            </div>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="ui-btn ui-btn--primary"
                        style={{
                            width: '100%', marginTop: '10px', fontSize: '1.1rem',
                            opacity: isSubmitting ? 0.7 : 1,
                            background: 'linear-gradient(135deg, #ec4899, #be185d)',
                            border: 'none'
                        }}
                    >
                        {isSubmitting ? t('processing') : t('preview_invitation')}
                    </button>
                </form>
            </div>

        </div>
    );
};

export default CreateDatingInvitation;
