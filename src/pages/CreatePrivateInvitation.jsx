import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    FaCalendarAlt, FaMapMarkerAlt, FaTimes, FaCheckCircle,
    FaClock, FaUserFriends, FaLock, FaChevronLeft, FaSearch,
    FaMoneyBillWave, FaUsers, FaBriefcase,
    FaBirthdayCake, FaMoon, FaUtensils, FaCoffee, FaGamepad,
    FaStar, FaHome, FaFilm, FaFutbol, FaFire,
    FaCamera, FaUpload, FaImage
} from 'react-icons/fa';
import { useInvitations } from '../context/InvitationContext';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import VenueLocationPicker from '../components/VenueLocationPicker';
import { processInvitationMedia, commitInvitationAiCover, verifyPublicStorageImageUrl } from '../services/mediaService';
import { notifyImageUploadError } from '../utils/imageModerationErrors';
import { getFollowing } from '../utils/followHelpers';
import { db } from '../firebase/config';
import { getSafeAvatar } from '../utils/avatarUtils';
import UserAvatar from '../components/UserAvatar';
import { serverTimestamp, updateDoc, doc, getDoc, collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { detectUserLocationContext } from '../utils/locationUtils';
import './PrivateInvitation.css';
import { rememberPrivateDraftCreateKind } from '../utils/privateInvitationDraft';
import { isExcludedFromUserDocSearch } from '../utils/consumerSearchExclusions';
import { searchAccounts } from '../services/accountSearch';
import { resolveVenueCountryIso } from '../utils/countryIso';
import { getAppBidiFieldProps } from '../utils/bidiText';
import PrivateInvitationCardPreview from '../components/Invitations/privateCard/PrivateInvitationCardPreview';
import DatingCardPreviewStage from '../components/Invitations/privateCard/DatingCardPreviewStage';
import {
    DEFAULT_PRIVATE_TEXT_BACKDROP_TONE,
    getPrivateCardTextBackdropFromInvitation
} from '../components/Invitations/privateCard/privateCardTextBackdrop';
import {
    INVITATION_CARD_MESSAGE_MAX,
    INVITATION_CARD_TITLE_MAX
} from '../constants/invitationCardLimits';
import PrivateInvitationCoverRightRail from '../components/Invitations/privateCard/PrivateInvitationCoverRightRail';
import { DEFAULT_FRAME_COLOR_ID } from '../components/Invitations/privateCard/privateCardFrameColors';
import { DEFAULT_FONT_ID } from '../components/Invitations/privateCard/privateCardFonts';
import { DEFAULT_MOTION_ID } from '../components/Invitations/privateCard/privateCardMotions';
import { resolveOccasionCategoryId } from '../components/Invitations/privateCard/privateCardOccasionMap';
import {
    getCardBackgroundOptions,
    parsePrivateInvitationCardBackgroundFromUrl,
    DEFAULT_PRIVATE_OCCASION_LABEL,
    DEFAULT_PRIVATE_CARD_BACKGROUND_ID
} from '../components/Invitations/privateCard/privateCardBackgrounds';
import { getPrivateHeroCoverFromMediaData } from '../components/Invitations/datingCard/datingCardBackgrounds';
import DatingCoverCameraPanel from '../components/Invitations/datingCard/DatingCoverCameraPanel';
import { getTotalDineCredits, PRIVATE_INVITATION_PUBLISH_CREDITS } from '../utils/privateInvitationCredits';
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
import { extractAIContentFields } from '../utils/aiContentFieldMapper';
import { parseAiStudioImageFromState } from '../utils/aiStudioImagePayload';
import { resolveCardStructureFromBackgroundId } from '../utils/cardStructure';

function resolvePrivateInvitationAuthorUid(authUser, invitationContextUser) {
    return authUser?.uid || invitationContextUser?.uid || invitationContextUser?.id || null;
}

const CreatePrivateInvitation = () => {
    const { t, i18n } = useTranslation();
    const bidiFieldProps = useMemo(() => getAppBidiFieldProps(i18n.language), [i18n.language]);
    const navigate = useNavigate();
    const location = useLocation();
    const { addPrivateInvitation, currentUser, canCreatePrivateInvitation } = useInvitations();
    const { showToast } = useToast();
    const { currentUser: authUser, userProfile } = useAuth();

    const quotaInfo = canCreatePrivateInvitation('private');

    const restaurantData = location.state?.restaurantData || location.state?.selectedRestaurant;
    const editInvitation = location.state?.editInvitation;

    // UI State
    const [mediaData, setMediaData] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [mutualFriends, setMutualFriends] = useState([]);
    const [friendSearchQuery, setFriendSearchQuery] = useState('');
    const [friendsLoading, setFriendsLoading] = useState(false);
    const [friendSearchLoading, setFriendSearchLoading] = useState(false);
    const [friendSearchResults, setFriendSearchResults] = useState([]);
    const [existingDraftId, setExistingDraftId] = useState(null);
    const [cardFontId, setCardFontId] = useState(DEFAULT_FONT_ID);
    const [cardFrameColorId, setCardFrameColorId] = useState(DEFAULT_FRAME_COLOR_ID);
    const [privateCardThemeColor, setPrivateCardThemeColor] = useState(null);
    const [cardMotionId, setCardMotionId] = useState(DEFAULT_MOTION_ID);
    const [cardBackgroundId, setCardBackgroundId] = useState(
        () => editInvitation?.cardBackgroundId || DEFAULT_PRIVATE_CARD_BACKGROUND_ID
    );
    const [privateCoverTab, setPrivateCoverTab] = useState(() => (editInvitation ? 'camera' : 'template'));
    const [cameraOpenNonce, setCameraOpenNonce] = useState(0);
    const [aiCoverCommittingId, setAiCoverCommittingId] = useState(null);
    const [privateCardShowHostAndMessage, setPrivateCardShowHostAndMessage] = useState(true);
    const [privateCardTextBackdropTone, setPrivateCardTextBackdropTone] = useState(
        DEFAULT_PRIVATE_TEXT_BACKDROP_TONE
    );
    /** Temp upload/video drafts shown as thumbnails until publish. */
    const [coverMediaStash, setCoverMediaStash] = useState([]);

    const privateCoverDraftsRef = useRef({ template: null, upload: null, camera: null, ai: null });
    const mediaDataRef = useRef(null);
    const privateCoverTabRef = useRef(editInvitation ? 'camera' : 'template');
    const coverUploadInputRef = useRef(null);
    const coverMediaStashRef = useRef([]);

    useEffect(() => {
        mediaDataRef.current = mediaData;
    }, [mediaData]);
    useEffect(() => {
        privateCoverTabRef.current = privateCoverTab;
    }, [privateCoverTab]);
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
        setPrivateCoverTab('upload');
        privateCoverDraftsRef.current.upload = media;
    }, [location.state?.aiStudioImage]);

    useEffect(() => {
        return () => {
            revokeAllPrivateCoverStash(coverMediaStashRef.current);
        };
    }, []);

    const privateHeroCover = useMemo(() => getPrivateHeroCoverFromMediaData(mediaData), [mediaData]);

    const heroCoverPending = useMemo(() => {
        if (!mediaData) return false;
        return Boolean(mediaData?.pending || (mediaData?.source === 'ai_generated' && !mediaData?.publishedUrl));
    }, [mediaData]);

    const [formData, setFormData] = useState({
        title: restaurantData ? `${t('dinner_at')} ${restaurantData.name}` : '',
        restaurantId: restaurantData?.id || null,
        restaurantName: restaurantData?.name || '',
        city: restaurantData?.city || '',
        date: '',
        time: '',
        location: restaurantData?.address || restaurantData?.location || '',
        paymentType: 'Split',
        description: '',
        privacy: 'private',
        invitedFriends: [],
        country: restaurantData?.country || '',
        lat: restaurantData?.lat || restaurantData?.coordinates?.lat,
        lng: restaurantData?.lng || restaurantData?.coordinates?.lng,
        userLat: null,
        userLng: null,
        occasionType: editInvitation?.occasionType || DEFAULT_PRIVATE_OCCASION_LABEL,
    });

    const privateCoverTabLabel = useMemo(() => {
        const labels = {
            camera: t('private_cover_tab_camera_record', { defaultValue: 'Record video' }),
            upload: t('private_cover_tab_upload_device', { defaultValue: 'Upload from device' }),
            template: t('dating_cover_tab_template', { defaultValue: 'Template' })
        };
        return labels[privateCoverTab] || '';
    }, [privateCoverTab, t]);

    const editorPhotoBackgroundActive = useMemo(() => {
        if (privateHeroCover?.src) return true;
        const cat = resolveOccasionCategoryId(formData.occasionType);
        return getCardBackgroundOptions(cat).some((o) => o.id === cardBackgroundId);
    }, [privateHeroCover?.src, formData.occasionType, cardBackgroundId]);

    // Populate data when editing
    useEffect(() => {
        if (editInvitation) {
            console.log('📝 Editing existing invitation:', editInvitation);
            setExistingDraftId(editInvitation.id);
            setFormData({
                title: editInvitation.title || '',
                restaurantId: editInvitation.restaurantId || null,
                restaurantName: editInvitation.restaurantName || '',
                city: editInvitation.city || '',
                date: editInvitation.date || '',
                time: editInvitation.time || '',
                location: editInvitation.location || '',
                paymentType: editInvitation.paymentType || 'Split',
                description: editInvitation.description || '',
                privacy: 'private',
                invitedFriends: editInvitation.invitedFriends || [],
                country: editInvitation.country || '',
                lat: editInvitation.lat || null,
                lng: editInvitation.lng || null,
                userLat: editInvitation.userLat || null,
                userLng: editInvitation.userLng || null,
                occasionType: editInvitation.occasionType || DEFAULT_PRIVATE_OCCASION_LABEL
            });

            setPrivateCardShowHostAndMessage(editInvitation.privateCardShowHostAndMessage !== false);

            const backdrop = getPrivateCardTextBackdropFromInvitation(editInvitation);
            setPrivateCardTextBackdropTone(backdrop.tone);

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
                setPrivateCoverTab('camera');
                setMediaData(m);
                privateCoverDraftsRef.current = { template: null, upload: null, camera: m };
            } else if (imgUrl) {
                const cat = resolveOccasionCategoryId(editInvitation.occasionType);
                const parsedBg = parsePrivateInvitationCardBackgroundFromUrl(imgUrl);
                if (parsedBg && parsedBg.categoryId === cat) {
                    setCardBackgroundId(parsedBg.assetId);
                    setPrivateCoverTab('template');
                    setMediaData(null);
                    privateCoverDraftsRef.current = { template: null, upload: null, camera: null };
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
                    setPrivateCoverTab('upload');
                    setMediaData(m);
                    privateCoverDraftsRef.current = { template: null, upload: m, camera: null };
                }
            } else {
                setPrivateCoverTab('template');
                privateCoverDraftsRef.current = { template: null, upload: null, camera: null };
            }

            setCardFontId(editInvitation.cardFontId || DEFAULT_FONT_ID);
            setCardFrameColorId(editInvitation.cardFrameColorId || DEFAULT_FRAME_COLOR_ID);
            const rawTheme =
                (typeof editInvitation.privateCardThemeColor === 'string' && editInvitation.privateCardThemeColor.trim()) ||
                '';
            setPrivateCardThemeColor(/^#[0-9A-Fa-f]{6}$/.test(rawTheme) ? rawTheme : null);
            setCardMotionId(editInvitation.cardMotionId || DEFAULT_MOTION_ID);
        }
    }, [editInvitation]);

    /** Sync card background when occasion changes; pick first template if none selected. */
    useEffect(() => {
        const cat = resolveOccasionCategoryId(formData.occasionType);
        const opts = getCardBackgroundOptions(cat);
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
    }, [formData.occasionType, editInvitation?.id]);

    // Redirect guests
    useEffect(() => {
        if (userProfile?.isGuest || userProfile?.role === 'guest' || currentUser?.id === 'guest') {
            goToLogin();
        }
    }, [userProfile, currentUser, navigate]);

    // Fetch Mutual Followers for Selection
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
                // People you follow (not mutual-only) so invite list is usable when they have not followed back yet.
                const friends = await getFollowing(userId, followingIds);
                setMutualFriends(friends);
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
            location: placeData.name,
            lat: placeData.lat,
            lng: placeData.lng,
            title: placeData.name ? `${t('invitation_at')} ${placeData.name}` : prev.title
        }));
    };

    useEffect(() => {
        const rawQ = friendSearchQuery.trim();
        const searchQ = rawQ.toLowerCase();
        const uid = authUser?.uid || currentUser?.uid || currentUser?.id;
        if (!rawQ || rawQ.length < 2 || !uid) {
            setFriendSearchResults([]);
            setFriendSearchLoading(false);
            return;
        }

        let cancelled = false;
        const timer = setTimeout(async () => {
            setFriendSearchLoading(true);
            try {
                const localMatches = mutualFriends.filter((friend) => {
                    const name = `${friend.display_name || ''} ${friend.name || ''}`.trim().toLowerCase();
                    return name.includes(searchQ);
                });

                const merged = new Map();
                const addCandidate = (id, data) => {
                    if (!id || id === uid) return;
                    if (isExcludedFromUserDocSearch(data)) return;
                    const role = (data?.role || '').toLowerCase();
                    if (role === 'business' || role === 'guest' || data?.isBusiness === true) return;
                    const display = data?.display_name || data?.displayName || data?.name || '';
                    if (!display) return;
                    const normalized = {
                        id,
                        display_name: display,
                        name: display,
                        photo_url: data?.photo_url || data?.photoURL || data?.avatar || '',
                        photoURL: data?.photoURL || data?.photo_url || data?.avatar || '',
                        avatar: data?.avatar || data?.photo_url || data?.photoURL || '',
                        gender: data?.gender || null
                    };
                    const matchText = `${normalized.display_name} ${normalized.name}`.toLowerCase();
                    if (!matchText.includes(searchQ)) return;
                    merged.set(id, normalized);
                };

                localMatches.forEach((f) => addCandidate(f.id, f));

                const { users } = await searchAccounts(rawQ);
                users.forEach((u) =>
                    addCandidate(u.id, {
                        display_name: u.display_name || u.displayName,
                        displayName: u.displayName || u.display_name,
                        photoURL: u.photoURL || u.photo_url,
                        photo_url: u.photo_url || u.photoURL,
                        gender: u.gender,
                    })
                );

                if (!cancelled) {
                    setFriendSearchResults(Array.from(merged.values()));
                }
            } catch (error) {
                console.error('Private invite friend search failed:', error);
                if (!cancelled) setFriendSearchResults([]);
            } finally {
                if (!cancelled) setFriendSearchLoading(false);
            }
        }, 300);

        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [friendSearchQuery, authUser?.uid, currentUser?.uid, currentUser?.id, mutualFriends]);

    const searchQ = friendSearchQuery.trim().toLowerCase();
    const filteredFriends = searchQ ? friendSearchResults : mutualFriends;

    // Max guests per private invitation
    const getMaxGuests = () => 30;

    const maxGuests = getMaxGuests();
    const isAtLimit = (formData.invitedFriends || []).length >= maxGuests;

    const toggleFriendSelection = (friendId) => {
        const current = formData.invitedFriends || [];
        if (current.includes(friendId)) {
            setFormData(prev => ({ ...prev, invitedFriends: current.filter(id => id !== friendId) }));
            return;
        }

        // Block adding if at limit
        if (current.length >= getMaxGuests()) return;

        setFormData(prev => ({ ...prev, invitedFriends: [...(prev.invitedFriends || []), friendId] }));
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
            privateCoverDraftsRef.current[privateCoverTabRef.current] = resolved;
            return resolved;
        });
    };

    const handlePrivateCoverTab = (tab) => {
        if (tab === privateCoverTab) return;
        privateCoverDraftsRef.current[privateCoverTab] = mediaDataRef.current;

        setPrivateCoverTab(tab);
        const restored = privateCoverDraftsRef.current[tab];
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
            const authorUid = resolvePrivateInvitationAuthorUid(authUser, currentUser);
            if (!authorUid) {
                throw new Error('not_signed_in');
            }
            const publishedUrl = await commitInvitationAiCover(media, authorUid);
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

    /** Stage 1: switch to Upload tab (thumbnails). Stage 2: open file picker. */
    const handlePrivateCoverUploadTabClick = () => {
        if (privateCoverTab === 'upload') {
            if (isCoverStashKindAtLimit(coverMediaStashRef.current, 'upload')) {
                toastCoverStashLimit('upload');
                return;
            }
            triggerPrivateCoverUpload();
        } else {
            handlePrivateCoverTab('upload');
        }
    };

    /** Stage 1: switch to Camera tab (thumbnails). Stage 2: open recorder. */
    const handlePrivateCoverCameraTabClick = () => {
        if (privateCoverTab === 'camera') {
            if (isCoverStashKindAtLimit(coverMediaStashRef.current, 'camera')) {
                toastCoverStashLimit('camera');
                return;
            }
            setCameraOpenNonce((n) => n + 1);
        } else {
            handlePrivateCoverTab('camera');
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
        privateCoverDraftsRef.current[privateCoverTab] = mediaDataRef.current;
        if (!stashCoverMedia('camera', media)) {
            revokePrivateCoverMedia(media);
            return;
        }
        setPrivateCoverTab('camera');
        setMediaData(media);
        privateCoverDraftsRef.current.camera = media;
    };

    const handlePrivateCoverUploadPick = (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file?.type?.startsWith('image/')) {
            if (file) {
                showToast(t('image_only_upload', { defaultValue: 'Please choose an image file.' }), 'error');
            }
            return;
        }
        privateCoverDraftsRef.current[privateCoverTab] = mediaDataRef.current;
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
        setPrivateCoverTab('upload');
        setMediaData(media);
        privateCoverDraftsRef.current.upload = media;
    };

    const handleSelectCoverStashItem = async (id) => {
        const entry = coverMediaStashRef.current.find((e) => e.id === id);
        if (!entry) return;
        privateCoverDraftsRef.current[privateCoverTab] = mediaDataRef.current;

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

        setPrivateCoverTab(entry.kind);
        setMediaData(media);
        privateCoverDraftsRef.current[entry.kind] = media;
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
                privateCoverDraftsRef.current[entry.kind] = replacement;
            }
            return next;
        });
    };

    const clearCoverMediaStashAfterPublish = () => {
        revokeAllPrivateCoverStash(coverMediaStashRef.current);
        setCoverMediaStash([]);
        revokePrivateCoverMedia(mediaDataRef.current);
    };

    const triggerPrivateCoverUpload = () => {
        coverUploadInputRef.current?.click();
    };

    const buildPrivateInvitationAiPrompt = useCallback(() => {
        const parts = [
            formData.occasionType && `المناسبة: ${formData.occasionType}`,
            formData.location?.trim() && `المكان: ${formData.location.trim()}`,
            formData.date && formData.time && `الموعد: ${formData.date} ${formData.time}`,
            formData.title?.trim() && `عنوان حالي: ${formData.title.trim()}`,
            formData.description?.trim() && `رسالة حالية: ${formData.description.trim()}`,
        ].filter(Boolean);
        return parts.join('\n') || 'اكتب عنوان دعوة خاصة ورسالة ترحيبية مناسبة للمناسبة والمكان';
    }, [formData]);

    const handlePrivateInvitationAiContent = useCallback((data) => {
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
            showToast(t('please_invite_at_least_one_guest') || 'Please invite at least one guest for a private invitation', 'error');
            return;
        }

        const quota = canCreatePrivateInvitation('private');
        if (!editInvitation && !quota.profileLoading && !quota.canCreate) {
            showToast(
                t(
                    'dine_credits_private_insufficient',
                    `Publishing costs ${PRIVATE_INVITATION_PUBLISH_CREDITS} Dine Credits. Open Settings → Dine Credits to top up.`
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
                    privateCoverDraftsRef.current.ai = activeMedia;
                } catch (mediaError) {
                    console.error('❌ AI cover commit failed:', mediaError);
                    notifyImageUploadError(showToast, mediaError, t, 'media_upload_failed');
                    return;
                }
            }
            if (activeMedia) {
                const isVideoUpload = activeMedia.type === 'video' || activeMedia.source === 'custom_video';
                if (isVideoUpload) {
                    showToast(
                        t('private_cover_video_uploading', {
                            defaultValue: 'Uploading your video cover… this may take a moment.'
                        }),
                        'info',
                        null,
                        4000
                    );
                }
                try {
                    mediaFields = await processInvitationMedia(activeMedia, authorUid);
                } catch (mediaError) {
                    console.error('❌ Media processing failed:', mediaError);
                    notifyImageUploadError(showToast, mediaError, t, 'media_upload_failed');
                    return;
                }
            }

            // Initialize RSVPs as 'pending' for all invited friends
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
                cardStructure: resolveCardStructureFromBackgroundId(cardBackgroundId),
                privateCardThemeColor,
                privateCardShowHostAndMessage,
                privateCardTextBackdropTone,
                rsvps: initialRsvps,
                type: 'Private',
                status: 'draft',
                createdAt: serverTimestamp()
            };

            rememberPrivateDraftCreateKind('private');

            if (existingDraftId) {
                // UPDATE EXISTING
                const draftRef = doc(db, 'private_invitations', existingDraftId);
                await updateDoc(draftRef, {
                    ...draftData,
                    updatedAt: serverTimestamp()
                });
                navigate(`/invitation/private/preview/${existingDraftId}`, { replace: true });
                clearCoverMediaStashAfterPublish();
            } else {
                // CREATE NEW
                console.log('🔏 Creating private invitation draft...');
                const draftId = await addPrivateInvitation(draftData);
                console.log('📋 Draft result:', draftId);
                if (draftId) {
                    navigate(`/invitation/private/preview/${draftId}`, { replace: true });
                    clearCoverMediaStashAfterPublish();
                } else {
                    showToast(t('failed_create_invitation'), 'error');
                }
            }
        } catch (error) {
            console.error('Error creating private draft:', error);
            showToast(t('failed_create_invitation'), 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const quota = quotaInfo.quota;
    const isUnlimited = quota === 'unlimited' || quota === '∞' || quota === -1;
    const profilePending = Boolean(quotaInfo.profileLoading) || quota === 'pending';
    const dineBalance = getTotalDineCredits(userProfile);
    const publishCost = PRIVATE_INVITATION_PUBLISH_CREDITS;
    const lowCredits = !isUnlimited && !profilePending && dineBalance < publishCost;

    return (
        <div className="private-create-wrapper private-theme">
            <div className="private-header-premium">
                <button onClick={() => navigate(-1)} className="private-back-btn">
                    <FaChevronLeft />
                </button>
                <div className="private-header-badge">
                    🔒 {t('dinebuddy_private', 'DineBuddy Private')}
                </div>
                <h2 className="private-header-title">
                    <FaLock />
                    {t('dinebuddy_private', 'DineBuddy Private')}
                </h2>
                <p className="private-header-desc">
                    {t('private_invitation_desc', 'This invitation will not be visible to the public. Only people you invite can see and join.')}
                </p>

                {!quotaInfo.profileLoading && (
                    <div style={{
                        margin: '12px 0 0',
                        padding: '10px 16px',
                        borderRadius: '12px',
                        background: isUnlimited
                            ? 'rgba(72,187,120,0.1)'
                            : lowCredits
                                ? 'rgba(239,68,68,0.1)'
                                : 'rgba(139,92,246,0.1)',
                        border: `1px solid ${isUnlimited ? 'rgba(72,187,120,0.3)' : lowCredits ? 'rgba(239,68,68,0.3)' : 'rgba(139,92,246,0.3)'}`,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        fontSize: '0.875rem',
                        color: isUnlimited ? '#4ade80' : lowCredits ? '#f87171' : '#a78bfa',
                        fontWeight: 600
                    }}>
                        <span>{isUnlimited ? '∞' : `${dineBalance}`}</span>
                        <span style={{ opacity: 0.85, fontWeight: 400 }}>
                            {isUnlimited
                                ? t('unlimited_private_invitations', 'Unlimited private invitations')
                                : t(
                                      'dine_credits_private_banner',
                                      '{{balance}} Dine Credits — publishing uses {{cost}} credits (free pool is used first).',
                                      { balance: dineBalance, cost: publishCost }
                                  )}
                        </span>
                    </div>
                )}
            </div>

            <div className="private-form-container">
                <form onSubmit={handlePreview} className="elegant-form">
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

                    <div className="form-group mb-4">
                        <label className="elegant-label">{t('form_occasion_label')}</label>
                        <div className="occasion-options" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
                            {[
                                { id: 'birthday', icon: <FaBirthdayCake />, label: 'Birthday' },
                                { id: 'social', icon: <FaUsers />, label: 'Social' },
                                { id: 'work', icon: <FaBriefcase />, label: 'Work' },
                                { id: 'nightlife', icon: <FaMoon />, label: 'Nightlife' },
                                { id: 'dining', icon: <FaUtensils />, label: 'Dining' },
                                { id: 'cafe', icon: <FaCoffee />, label: 'Café' },
                                { id: 'gaming', icon: <FaGamepad />, label: 'Gaming' },
                                { id: 'family', icon: <FaHome />, label: 'Family' },
                                { id: 'celebration', icon: <FaStar />, label: 'Celebration' },
                                { id: 'cinema', icon: <FaFilm />, label: 'Cinema' },
                                { id: 'sports', icon: <FaFutbol />, label: 'Sports' },
                                { id: 'bbq', icon: <FaFire />, label: 'BBQ' },
                            ].map((occ) => {
                                const selected = formData.occasionType === occ.label;
                                return (
                                    <div
                                        key={occ.id}
                                        role="button"
                                        tabIndex={0}
                                        onClick={() => setFormData((prev) => ({ ...prev, occasionType: occ.label }))}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                e.preventDefault();
                                                setFormData((prev) => ({ ...prev, occasionType: occ.label }));
                                            }
                                        }}
                                        className={`private-occasion-chip${selected ? ' private-occasion-chip--selected' : ''}`}
                                    >
                                        <span className="private-occasion-chip__icon">{occ.icon}</span>
                                        {t(`occasion_${occ.id}`, occ.label)}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

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

                    <div className="form-group mb-4">
                        <label className="elegant-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                            {t('invitation_title')}
                            <span
                                style={{
                                    fontSize: '0.75rem',
                                    color: (formData.title?.length || 0) >= INVITATION_CARD_TITLE_MAX
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
                        ></textarea>
                    </div>

                    <div className="mb-4">
                        <AIFloatingLauncher
                            postType="invitation"
                            subType="private"
                            onTextSuccess={handlePrivateInvitationAiContent}
                            buildContextPrompt={buildPrivateInvitationAiPrompt}
                            disabled={isSubmitting}
                        />
                    </div>

                    {/* Card + cover: same preview chrome as dating (tools on card + right rail). */}
                    <div className="private-section-card private-section-card--templates mb-4">
                        <h3 className="private-section-card__title">
                            <span aria-hidden>🃏</span>{' '}
                            {t('private_section_templates_title', { defaultValue: 'Ready card looks' })}
                        </h3>
                        <input
                            ref={coverUploadInputRef}
                            type="file"
                            accept="image/*"
                            className="private-cover-upload-input"
                            onChange={handlePrivateCoverUploadPick}
                            tabIndex={-1}
                            aria-hidden
                        />
                        <div className="private-cover-tabs-wrap">
                            <p className="private-cover-tabs__active-label" aria-live="polite">
                                {privateCoverTabLabel}
                            </p>
                            <div
                                role="tablist"
                                aria-label={t('dating_cover_tabs_label', { defaultValue: 'Cover source' })}
                                className="private-cover-tabs private-cover-tabs--icons-only"
                            >
                                <button
                                    type="button"
                                    role="tab"
                                    aria-selected={privateCoverTab === 'camera'}
                                    onClick={handlePrivateCoverCameraTabClick}
                                    className={`private-cover-tab${privateCoverTab === 'camera' ? ' private-cover-tab--active' : ''}`}
                                    title={t('private_cover_tab_camera_open', { defaultValue: 'Video' })}
                                    aria-label={t('private_cover_tab_camera_open', { defaultValue: 'Video' })}
                                >
                                    <FaCamera aria-hidden />
                                </button>
                                <button
                                    type="button"
                                    role="tab"
                                    aria-selected={privateCoverTab === 'upload'}
                                    onClick={handlePrivateCoverUploadTabClick}
                                    className={`private-cover-tab${privateCoverTab === 'upload' ? ' private-cover-tab--active' : ''}`}
                                    title={t('private_cover_tab_upload_open', { defaultValue: 'From device' })}
                                    aria-label={t('private_cover_tab_upload_open', { defaultValue: 'From device' })}
                                >
                                    <FaUpload aria-hidden />
                                </button>
                                <button
                                    type="button"
                                    role="tab"
                                    aria-selected={privateCoverTab === 'template'}
                                    onClick={() => handlePrivateCoverTab('template')}
                                    className={`private-cover-tab${privateCoverTab === 'template' ? ' private-cover-tab--active' : ''}`}
                                    title={t('dating_cover_tab_template', { defaultValue: 'Template' })}
                                    aria-label={t('dating_cover_tab_template', { defaultValue: 'Template' })}
                                >
                                    <FaImage aria-hidden />
                                </button>
                            </div>
                        </div>

                        {privateCoverTab === 'camera' && (
                            <DatingCoverCameraPanel onMediaSelect={handleCameraCoverMedia} openNonce={cameraOpenNonce} />
                        )}

                        <div className="form-group mb-0">
                            <div className="private-card-preview-with-bg">
                                <div className="private-card-preview-with-bg__preview-wrap">
                                    <DatingCardPreviewStage
                                        showHostAndMessage={privateCardShowHostAndMessage}
                                        onShowHostAndMessageChange={setPrivateCardShowHostAndMessage}
                                        editorPhotoBackgroundActive={editorPhotoBackgroundActive}
                                        textBackdropTone={privateCardTextBackdropTone}
                                        onTextBackdropToneChange={setPrivateCardTextBackdropTone}
                                        cardMotionId={cardMotionId}
                                        onCardMotionChange={setCardMotionId}
                                        fontId={cardFontId}
                                        themeColorHex={privateCardThemeColor}
                                        onFontChange={setCardFontId}
                                        onThemeColorChange={setPrivateCardThemeColor}
                                    >
                                        <PrivateInvitationCardPreview
                                            cardTemplateSet="private"
                                            className="private-invitation-card-preview--showcase private-invitation-card-preview--showcase-compact private-invitation-card-preview--dating-editor-meta"
                                            frameColorId={cardFrameColorId}
                                            cardThemeColor={privateCardThemeColor}
                                            cardFontId={cardFontId}
                                            cardMotionId={cardMotionId}
                                            occasionType={formData.occasionType}
                                            cardBackgroundId={cardBackgroundId}
                                            cardStructure={resolveCardStructureFromBackgroundId(cardBackgroundId)}
                                            heroCoverSrc={privateHeroCover?.src ?? null}
                                            heroCoverMediaType={privateHeroCover?.mediaType ?? null}
                                            heroCoverPoster={privateHeroCover?.poster ?? null}
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
                                            showHostAndMessage={privateCardShowHostAndMessage}
                                            textBackdropTone={privateCardTextBackdropTone}
                                        />
                                    </DatingCardPreviewStage>
                                </div>
                                <PrivateInvitationCoverRightRail
                                    categoryId={resolveOccasionCategoryId(formData.occasionType)}
                                    cardBackgroundId={cardBackgroundId}
                                    onCardBackgroundIdChange={setCardBackgroundId}
                                    mode={privateCoverTab}
                                    mediaData={mediaData}
                                    coverStash={coverMediaStash}
                                    onSelectStashItem={handleSelectCoverStashItem}
                                    onRemoveStashItem={handleRemoveCoverStashItem}
                                    committingStashId={aiCoverCommittingId}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Payment Type */}
                    <div className="form-group mb-4">
                        <label className="elegant-label"><FaMoneyBillWave /> {t('payment_type')}</label>
                        <div className="payment-options" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                            {['Split', 'Host Pays'].map((type) => {
                                const selected = formData.paymentType === type;
                                return (
                                    <div
                                        key={type}
                                        role="button"
                                        tabIndex={0}
                                        onClick={() => setFormData((prev) => ({ ...prev, paymentType: type }))}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                e.preventDefault();
                                                setFormData((prev) => ({ ...prev, paymentType: type }));
                                            }
                                        }}
                                        className={`private-payment-chip${selected ? ' private-payment-chip--selected' : ''}`}
                                    >
                                        {t(type.toLowerCase().replace(' ', '_'))}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Friend Selection — Grid Layout */}
                    <div className="form-group mb-4 private-friends-panel">
                        <label className="elegant-label" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                            <span><FaUserFriends /> {t('invite_friends')}</span>
                            <span style={{
                                color: isAtLimit ? '#f87171' : 'var(--primary)',
                                fontSize: '0.8rem',
                                fontWeight: 700
                            }}>
                                {formData.invitedFriends.length}/{maxGuests}
                                {isAtLimit && ' 🔒'}
                            </span>
                        </label>
                        {isAtLimit && (
                            <div style={{
                                marginBottom: 10,
                                padding: '8px 12px',
                                borderRadius: '10px',
                                background: 'rgba(239,68,68,0.08)',
                                border: '1px solid rgba(239,68,68,0.3)',
                                color: '#f87171',
                                fontSize: '0.82rem',
                                fontWeight: 600
                            }}>
                                {'⛔ ' + t('max_guests_reached', { count: maxGuests, defaultValue: `Maximum of ${maxGuests} guests reached` })}
                            </div>
                        )}

                        {/* Search bar */}
                        <div style={{ position: 'relative', marginBottom: 12 }}>
                            <input
                                type="text"
                                placeholder={t('search_friends')}
                                value={friendSearchQuery}
                                onChange={(e) => setFriendSearchQuery(e.target.value)}
                                className="private-friend-search-input"
                                autoComplete="off"
                            />
                            <FaSearch
                                style={{
                                    position: 'absolute',
                                    right: '12px',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    opacity: 0.45,
                                    color: 'rgba(148, 163, 184, 0.9)',
                                    pointerEvents: 'none'
                                }}
                            />
                        </div>

                        {/* Friend grid */}
                        {friendsLoading || friendSearchLoading ? (
                            <div style={{ textAlign: 'center', padding: '20px', opacity: 0.5 }}>{t('loading')}</div>
                        ) : filteredFriends.length > 0 ? (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: 10, maxHeight: 240, overflowY: 'auto', padding: '4px 2px' }}>
                                {filteredFriends.map(friend => {
                                    const isSelected = formData.invitedFriends.includes(friend.id);
                                    const isDisabled = !isSelected && isAtLimit;
                                    return (
                                        <div
                                            key={friend.id}
                                            onClick={() => !isDisabled && toggleFriendSelection(friend.id)}
                                            className={`private-friend-chip${isSelected ? ' private-friend-chip--selected' : ''}${isDisabled ? ' private-friend-chip--disabled' : ''}`}
                                        >
                                            {isSelected ? (
                                                <FaCheckCircle className="private-friend-chip__check-icon" aria-hidden />
                                            ) : null}
                                            <UserAvatar
                                                user={friend}
                                                alt={friend.display_name}
                                                ringColorOverride={isSelected ? 'var(--primary)' : undefined}
                                                style={{ width: 48, height: 48 }}
                                            />
                                            <span className="private-friend-chip__name">
                                                {friend.display_name?.split(' ')[0]}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div style={{ textAlign: 'center', padding: '20px', fontSize: '0.85rem', opacity: 0.4 }}>
                                {mutualFriends.length === 0 ? t('follow_people_first', 'Follow people first to invite them') : t('no_friends_found')}
                            </div>
                        )}
                    </div>

                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="ui-btn ui-btn--primary"
                        style={{ width: '100%', marginTop: '10px', fontSize: '1.1rem', opacity: isSubmitting ? 0.7 : 1 }}
                    >
                        {isSubmitting ? t('processing') : t('preview_invitation')}
                    </button>
                </form>
            </div>

        </div>
    );
};

export default CreatePrivateInvitation;
