import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    FaCalendarAlt, FaMapMarkerAlt, FaTimes, FaCheckCircle,
    FaClock, FaUserFriends, FaLock, FaChevronLeft, FaSearch,
    FaHeart, FaCamera, FaUpload, FaImage, FaMagic
} from 'react-icons/fa';
import { useInvitations } from '../context/InvitationContext';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import VenueLocationPicker from '../components/VenueLocationPicker';
import { processInvitationMedia, commitInvitationAiCover } from '../services/mediaService';
import { notifyImageUploadError } from '../utils/imageModerationErrors';
import { getMutualFollowers } from '../utils/followHelpers';
import { db } from '../firebase/config';
import { getSafeAvatar, getGenderBorderColor } from '../utils/avatarUtils';
import { doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { detectUserLocationContext } from '../utils/locationUtils';
import './PrivateInvitation.css';
import { goToLogin } from '../utils/goToLogin';
import { resolveVenueCountryIso } from '../utils/countryIso';
import { getTotalDineCredits, DATING_INVITATION_PUBLISH_CREDITS } from '../utils/privateInvitationCredits';
import PrivateInvitationCardPreview from '../components/Invitations/privateCard/PrivateInvitationCardPreview';
import {
    INVITATION_CARD_MESSAGE_MAX,
    INVITATION_CARD_TITLE_MAX
} from '../constants/invitationCardLimits';
import PrivateCardDatingTypographySheet from '../components/Invitations/privateCard/PrivateCardDatingTypographySheet';
import PrivateCardTextBackdropTonePicker from '../components/Invitations/privateCard/PrivateCardTextBackdropTonePicker';
import PrivateCardMotionPicker from '../components/Invitations/privateCard/PrivateCardMotionPicker';
import {
    DEFAULT_PRIVATE_TEXT_BACKDROP_TONE,
    getDatingCardTextBackdropFromInvitation
} from '../components/Invitations/privateCard/privateCardTextBackdrop';
import { DEFAULT_FRAME_COLOR_ID, getFrameColorById } from '../components/Invitations/privateCard/privateCardFrameColors';
import { DEFAULT_FONT_ID, PRIVATE_CARD_FONTS } from '../components/Invitations/privateCard/privateCardFonts';
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
import MagicCoverGeneratePanel from '../components/Invitations/MagicCoverGeneratePanel';
import { extractAIContentFields } from '../utils/aiContentFieldMapper';

const CreateDatingInvitation = () => {
    const { t } = useTranslation();
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
    const [typographySheetOpen, setTypographySheetOpen] = useState(false);
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

    /** Persist cover media per tab when switching Camera / Upload / Template */
    const datingCoverDraftsRef = useRef({ template: null, upload: null, camera: null, ai: null });
    const mediaDataRef = useRef(null);
    const datingCoverTabRef = useRef(editInvitation ? 'camera' : 'template');
    const coverUploadInputRef = useRef(null);
    const coverMediaStashRef = useRef([]);

    useEffect(() => {
        mediaDataRef.current = mediaData;
    }, [mediaData]);
    useEffect(() => {
        datingCoverTabRef.current = datingCoverTab;
    }, [datingCoverTab]);
    useEffect(() => {
        coverMediaStashRef.current = coverMediaStash;
    }, [coverMediaStash]);

    useEffect(() => {
        return () => {
            revokeAllPrivateCoverStash(coverMediaStashRef.current);
        };
    }, []);

    const datingHeroCover = useMemo(() => getDatingHeroCoverFromMediaData(mediaData), [mediaData]);

    const editorPhotoBackgroundActive = useMemo(() => {
        if (datingHeroCover?.src) return true;
        return getDatingCardBackgroundOptions().some((o) => o.id === cardBackgroundId);
    }, [datingHeroCover?.src, cardBackgroundId]);

    const datingFontSummary = useMemo(() => {
        const f = PRIVATE_CARD_FONTS.find((x) => x.id === cardFontId);
        return f ? t(f.labelKey, { defaultValue: f.defaultLabel }) : cardFontId;
    }, [cardFontId, t]);

    const datingCardColorSummary = useMemo(() => {
        const raw = typeof datingCardThemeColor === 'string' ? datingCardThemeColor.trim() : '';
        if (/^#[0-9A-Fa-f]{6}$/.test(raw)) return raw;
        const fr = getFrameColorById(cardFrameColorId);
        return t(fr.labelKey, { defaultValue: fr.defaultLabel });
    }, [datingCardThemeColor, cardFrameColorId, t]);

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
    });

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

    // Redirect guests
    useEffect(() => {
        if (userProfile?.isGuest || userProfile?.role === 'guest' || currentUser?.id === 'guest') {
            goToLogin();
        }
    }, [userProfile, currentUser, navigate]);

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
            title: placeData.name ? `${t('invitation_at')} ${placeData.name}` : prev.title
        }));
    };

    const selectedInviteeId = formData.invitedFriends?.[0] || null;
    const selectedInvitee = useMemo(
        () => mutualFriends.find((f) => f.id === selectedInviteeId) || null,
        [mutualFriends, selectedInviteeId]
    );

    const hasDatingVenue = useMemo(() => {
        const loc = String(formData.location || '').trim();
        if (!loc) return false;
        if (formData.restaurantId) return true;
        return formData.lat != null && formData.lng != null;
    }, [formData.location, formData.restaurantId, formData.lat, formData.lng]);

    const datingAiReady = useMemo(
        () =>
            Boolean(selectedInviteeId) &&
            Boolean(formData.date?.trim()) &&
            Boolean(formData.time?.trim()) &&
            hasDatingVenue,
        [selectedInviteeId, formData.date, formData.time, hasDatingVenue]
    );

    const datingAiContext = useMemo(() => {
        if (!datingAiReady) return undefined;
        return {
            inviteeId: selectedInviteeId,
            date: formData.date,
            time: formData.time,
            venueDetails: {
                venueId: formData.restaurantId || undefined,
                name: formData.restaurantName || formData.location?.trim() || '',
                address: formData.location?.trim() || '',
                city: formData.city || undefined,
                country: formData.country || undefined,
                lat: formData.lat ?? undefined,
                lng: formData.lng ?? undefined,
            },
        };
    }, [datingAiReady, selectedInviteeId, formData]);

    const datingAiDisabledHint = t('dating_ai_prerequisites_hint', {
        defaultValue:
            'Select your invitee, venue, date, and time above to unlock AI text generation.',
    });

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

    const handleDatingCoverAiTabClick = () => {
        handleDatingCoverTab('ai');
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
        const fields = extractAIContentFields('invitation', data);
        setFormData((prev) => {
            const next = { ...prev };
            if (fields.title) {
                next.title = fields.title.slice(0, INVITATION_CARD_TITLE_MAX);
            }
            if (fields.description) {
                next.description = fields.description.slice(0, INVITATION_CARD_MESSAGE_MAX);
            }
            return next;
        });
    }, []);

    const buildDatingMagicCoverBrief = useCallback(() => {
        const parts = [
            formData.location?.trim() && `المكان: ${formData.location.trim()}`,
            formData.date && formData.time && `الموعد: ${formData.date} ${formData.time}`,
            formData.title?.trim() && `عنوان: ${formData.title.trim()}`,
        ].filter(Boolean);
        return (
            parts.join('\n') ||
            'غلاف دعوة موعد رومانسي بلا نص مكتوب — أجواء دافئة مناسبة للموعد.'
        );
    }, [formData]);

    const handleDatingAiCoverImage = useCallback(
        async (url) => {
            if (!url) return;
            const stagedMedia = {
                source: 'ai_generated',
                type: 'image',
                file: null,
                url,
                preview: url,
            };
            datingCoverDraftsRef.current[datingCoverTab] = mediaDataRef.current;
            if (isCoverStashKindAtLimit(coverMediaStashRef.current, 'ai')) {
                toastCoverStashLimit('ai');
                return;
            }
            const entry = { id: createPrivateCoverStashId(), kind: 'ai', media: stagedMedia };
            setCoverMediaStash((prev) => [...prev, entry]);
            setDatingCoverTab('ai');

            try {
                const committed = await commitAiCoverMedia(stagedMedia, entry.id);
                updateAiStashMedia(entry.id, committed);
                setMediaData(committed);
                datingCoverDraftsRef.current.ai = committed;
            } catch (err) {
                console.error('AI cover commit failed:', err);
                setMediaData(stagedMedia);
                datingCoverDraftsRef.current.ai = stagedMedia;
                showToast(
                    err?.message === 'not_signed_in'
                        ? t('please_sign_in', { defaultValue: 'Please sign in to continue.' })
                        : t('private_cover_ai_commit_pending', {
                              defaultValue:
                                  'Cover saved in AI photos. It will upload when you select it or publish.',
                          }),
                    err?.message === 'not_signed_in' ? 'error' : 'info'
                );
            }
        },
        [datingCoverTab, toastCoverStashLimit, authUser, currentUser, showToast, t]
    );

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
                    const userId = currentUser?.id || authUser?.uid;
                    mediaFields = await processInvitationMedia(activeMedia, userId);
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

            const draftData = {
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
                createdAt: serverTimestamp()
            };

            if (existingDraftId) {
                const draftRef = doc(db, 'private_invitations', existingDraftId);
                await updateDoc(draftRef, { ...draftData, updatedAt: serverTimestamp() });
                clearCoverMediaStashAfterPublish();
                navigate(`/invitation/private/preview/${existingDraftId}`);
            } else {
                const draftId = await addPrivateInvitation(draftData);
                if (draftId) {
                    clearCoverMediaStashAfterPublish();
                    navigate(`/invitation/private/preview/${draftId}`);
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

    return (
        <div className="private-create-wrapper private-theme">
            <div className="private-header-premium" style={{ background: 'linear-gradient(135deg, #1a0010, #2d0020, #1a0010)' }}>
                <button onClick={() => navigate(-1)} className="private-back-btn">
                    <FaChevronLeft />
                </button>
                <div className="private-header-badge" style={{ background: 'rgba(236,72,153,0.2)', color: '#ec4899', border: '1px solid rgba(236,72,153,0.4)' }}>
                    💑 {t('dinebuddy_date', 'DineBuddy Date')}
                </div>
                <h2 className="private-header-title" style={{ color: '#ec4899' }}>
                    <FaHeart />
                    {t('dinebuddy_date', 'DineBuddy Date')}
                </h2>
                <p className="private-header-desc">
                    {t('dating_invitation_desc', 'Send an exclusive private date invitation to one special person.')}
                </p>

                {!quotaInfo.profileLoading && (
                    <div style={{
                        margin: '12px 0 0',
                        padding: '10px 16px',
                        borderRadius: '12px',
                        background: isUnlimited ? 'rgba(236,72,153,0.1)' : lowCredits ? 'rgba(239,68,68,0.1)' : 'rgba(236,72,153,0.1)',
                        border: `1px solid ${isUnlimited ? 'rgba(236,72,153,0.3)' : lowCredits ? 'rgba(239,68,68,0.3)' : 'rgba(236,72,153,0.3)'}`,
                        display: 'flex', alignItems: 'center', gap: 8,
                        fontSize: '0.875rem',
                        color: isUnlimited ? '#ec4899' : lowCredits ? '#f87171' : '#ec4899',
                        fontWeight: 600
                    }}>
                        <span>{isUnlimited ? '∞' : `${dineBalance}`}</span>
                        <span style={{ opacity: 0.85, fontWeight: 400 }}>
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

                    {/* Title */}
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
                        />
                    </div>

                    {/* Message — directly under title */}
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
                        />
                    </div>

                    {/* Date & Time */}
                    <div className="inv-datetime-row mb-4">
                        <div className="form-group">
                            <label className="elegant-label"><FaCalendarAlt /> {t('date')}</label>
                            <input
                                type="date"
                                name="date"
                                value={formData.date}
                                onChange={handleChange}
                                className="elegant-input"
                                min={new Date().toISOString().split('T')[0]}
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label className="elegant-label"><FaClock /> {t('time')}</label>
                            <input
                                type="time"
                                name="time"
                                value={formData.time}
                                onChange={handleChange}
                                className="elegant-input"
                                required
                            />
                        </div>
                    </div>

                    {/* Location */}
                    <div className="form-group mb-4 venue-search-stack">
                        <label className="elegant-label"><FaMapMarkerAlt className="label-icon" /> {t('location')}</label>
                        <VenueLocationPicker
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
                                            <img
                                                src={getSafeAvatar(friend)}
                                                alt={friend.display_name}
                                                style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover', border: `2px solid ${isSelected ? '#ec4899' : getGenderBorderColor(friend)}` }}
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
                            disabled={isSubmitting || !datingAiReady}
                            disabledHint={!datingAiReady ? datingAiDisabledHint : undefined}
                        />
                    </div>

                    {/* Card + cover: one preview row; thumbnails only on the right (template / upload / camera) */}
                    <div className="private-section-card private-section-card--templates mb-4" style={{ borderColor: 'rgba(236,72,153,0.25)' }}>
                        <h3 className="private-section-card__title" style={{ color: '#ec4899' }}>
                            <span aria-hidden>🃏</span>{' '}
                            {t('private_section_templates_title', { defaultValue: 'Ready card looks' })}
                        </h3>
                        <p className="private-section-card__hint">
                            {t('private_section_card_art_beside_hint', {
                                defaultValue:
                                    'Template shows artwork beside the card. Tap Upload or Camera to open that tab, then tap again to add photos or record video.'
                            })}
                        </p>
                        <input
                            ref={coverUploadInputRef}
                            type="file"
                            accept="image/*"
                            className="private-cover-upload-input"
                            onChange={handleDatingCoverUploadPick}
                            tabIndex={-1}
                            aria-hidden
                        />
                        <div
                            role="tablist"
                            aria-label={t('dating_cover_tabs_label', { defaultValue: 'Cover source' })}
                            className="private-cover-tabs"
                        >
                            <button
                                type="button"
                                role="tab"
                                aria-selected={datingCoverTab === 'camera'}
                                onClick={handleDatingCoverCameraTabClick}
                                className={`private-cover-tab${datingCoverTab === 'camera' ? ' private-cover-tab--active' : ''}`}
                            >
                                <FaCamera />{' '}
                                {datingCoverTab === 'camera'
                                    ? t('private_cover_tab_camera_record', { defaultValue: 'Record video' })
                                    : t('private_cover_tab_camera_open', { defaultValue: 'Video' })}
                            </button>
                            <button
                                type="button"
                                role="tab"
                                aria-selected={datingCoverTab === 'upload'}
                                onClick={handleDatingCoverUploadTabClick}
                                className={`private-cover-tab${datingCoverTab === 'upload' ? ' private-cover-tab--active' : ''}`}
                            >
                                <FaUpload />{' '}
                                {datingCoverTab === 'upload'
                                    ? t('private_cover_tab_upload_add', { defaultValue: 'Upload photo' })
                                    : t('private_cover_tab_upload_open', { defaultValue: 'From device' })}
                            </button>
                            <button
                                type="button"
                                role="tab"
                                aria-selected={datingCoverTab === 'ai'}
                                onClick={handleDatingCoverAiTabClick}
                                className={`private-cover-tab${datingCoverTab === 'ai' ? ' private-cover-tab--active' : ''}`}
                            >
                                <FaMagic />{' '}
                                {t('private_cover_tab_ai_open', { defaultValue: 'AI photos' })}
                            </button>
                            <button
                                type="button"
                                role="tab"
                                aria-selected={datingCoverTab === 'template'}
                                onClick={() => handleDatingCoverTab('template')}
                                className={`private-cover-tab${datingCoverTab === 'template' ? ' private-cover-tab--active' : ''}`}
                            >
                                <FaImage /> {t('dating_cover_tab_template', { defaultValue: 'Template' })}
                            </button>
                        </div>

                        {datingCoverTab === 'camera' && (
                            <DatingCoverCameraPanel
                                onMediaSelect={handleCameraCoverMedia}
                                openNonce={cameraOpenNonce}
                            />
                        )}

                        {datingCoverTab === 'ai' && (
                            <MagicCoverGeneratePanel
                                subType="date"
                                aspectRatio="9:16"
                                buildBrief={buildDatingMagicCoverBrief}
                                onImageGenerated={handleDatingAiCoverImage}
                                requireVenue={false}
                                disabled={isSubmitting}
                                embedded
                            />
                        )}

                        <div className="private-card-show-content-block">
                            <div
                                className="dating-card-show-content-toggle"
                                title={t('dating_card_show_content_title', {
                                    defaultValue:
                                        'Off: date and place only on the card. On: show title, message, and profile photo.'
                                })}
                            >
                                <span className="dating-card-show-content-toggle__label">
                                    {t('dating_card_show_content_label', {
                                        defaultValue: 'Show title, message & profile on card'
                                    })}
                                </span>
                                <button
                                    type="button"
                                    role="switch"
                                    className="dating-card-show-content-toggle__switch"
                                    aria-checked={datingCardShowHostAndMessage}
                                    aria-label={t('dating_card_show_content_label', {
                                        defaultValue: 'Show title, message & profile on card'
                                    })}
                                    onClick={() => setDatingCardShowHostAndMessage((v) => !v)}
                                >
                                    <span className="dating-card-show-content-toggle__thumb" aria-hidden />
                                </button>
                            </div>
                            {datingCardShowHostAndMessage && editorPhotoBackgroundActive && (
                                <PrivateCardTextBackdropTonePicker
                                    tone={datingCardTextBackdropTone}
                                    onToneChange={setDatingCardTextBackdropTone}
                                />
                            )}
                        </div>

                        <div className="form-group mb-0">
                            <label className="elegant-label">
                                {t('private_card_preview_label', { defaultValue: 'Invitation card' })}
                            </label>
                            <PrivateCardMotionPicker value={cardMotionId} onChange={setCardMotionId} />
                            <div className="private-card-preview-with-bg">
                                <div className="private-card-preview-with-bg__preview-wrap">
                                    <PrivateInvitationCardPreview
                                        cardTemplateSet="dating"
                                        className="private-invitation-card-preview--showcase private-invitation-card-preview--showcase-compact"
                                        frameColorId={cardFrameColorId}
                                        cardThemeColor={datingCardThemeColor}
                                        cardFontId={cardFontId}
                                        cardMotionId={cardMotionId}
                                        occasionType={formData.occasionType}
                                        cardBackgroundId={cardBackgroundId}
                                        heroCoverSrc={datingHeroCover?.src ?? null}
                                        heroCoverMediaType={datingHeroCover?.mediaType ?? null}
                                        heroCoverPoster={datingHeroCover?.poster ?? null}
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
                            <div style={{ marginTop: 12 }}>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
                                    <button
                                        type="button"
                                        onClick={() => setTypographySheetOpen(true)}
                                        style={{
                                            padding: '10px 16px',
                                            borderRadius: 12,
                                            border: '2px solid rgba(236,72,153,0.55)',
                                            background: 'rgba(236,72,153,0.12)',
                                            color: '#ec4899',
                                            fontWeight: 800,
                                            fontSize: '0.85rem',
                                            cursor: 'pointer',
                                            touchAction: 'manipulation'
                                        }}
                                    >
                                        {t('dating_card_style_btn', { defaultValue: 'Font & card color' })}
                                    </button>
                                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', flex: '1 1 160px', minWidth: 0 }}>
                                        {datingFontSummary} · {datingCardColorSummary}
                                    </span>
                                </div>
                            </div>
                            <PrivateCardDatingTypographySheet
                                open={typographySheetOpen}
                                onClose={() => setTypographySheetOpen(false)}
                                fontId={cardFontId}
                                themeColorHex={datingCardThemeColor}
                                onFontChange={setCardFontId}
                                onThemeColorChange={setDatingCardThemeColor}
                            />
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
