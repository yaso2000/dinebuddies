import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FaCalendarAlt, FaMapMarkerAlt, FaCheckCircle, FaClock, FaUserFriends, FaVenusMars, FaMoneyBillWave, FaLock, FaGlobe, FaPlus, FaMagic, FaImage, FaTimes } from 'react-icons/fa';
import { IoMale, IoFemale, IoMaleFemale } from 'react-icons/io5';
import { HiUser } from 'react-icons/hi2';
import { useInvitations } from '../context/InvitationContext';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import MediaSelector from '../components/Invitations/MediaSelector';
import VenueLocationPicker from '../components/VenueLocationPicker';
import { Country, State, City } from 'country-state-city';
import { uploadInvitationPhoto } from '../utils/imageUpload';
import { processInvitationMedia, uploadVideoWithThumbnail, uploadMedia, uploadGoogleImage } from '../services/mediaService';
import { deleteFilesAtFirebaseDownloadUrls } from '../utils/firebaseStorageDelete';
import { validateInvitationCreation } from '../utils/invitationValidation';
import { canCreateInvitation } from '../utils/cancellationPolicy';
import { doc, getDoc, updateDoc, serverTimestamp, deleteField } from 'firebase/firestore';
import { db } from '../firebase/config';
import { callGenerateInvitationImage } from '../utils/callGenerateInvitationImage';
import { createAiInvitationCoverMediaData } from '../utils/createAiInvitationCoverMediaData';
import { detectUserLocationContext } from '../utils/locationUtils';
import {
    COLOR_SCHEMES,
    TEMPLATE_STYLES,
    LEGACY_PUBLIC_TEMPLATE_MAP,
    TEMPLATE_PICKER_KEYS,
    normalizePublicCardTemplateKey,
    MAGIC_COVER_ASPECT_RATIOS,
    templateTypeToMagicCoverAspect,
} from '../utils/invitationTemplates';
import {
    PUBLIC_INVITE_MOOD_KEYS,
    PUBLIC_VENUE_TYPES,
    migrateLegacyOccasionToInviteMood,
    normalizePublicVenueType,
} from '../utils/publicInvitationVibes';
import InvitationCard from '../components/InvitationCard';
import {
    mapAiFrameTextColorToColorSchemeKey,
    mapAiFontNameToCssFamily,
    normalizeCoverAnimationType,
    buildPublicInvitationUserPreferencesForAi,
    buildFormPatchFromAtomicInvitationApi,
    PUBLIC_INVITATION_FONT_OPTIONS,
} from '../utils/aiInvitationThemeBinding';
import { buildMagicCoverHints, invitationMessageMaxLength } from '../utils/invitationSmartDescription';
import { prepareMagicCoverReferenceImage } from '../utils/prepareMagicCoverReferenceImage';
import { getAdvertisedInvitationAiCoverCreditCost } from '../utils/publicInvitationAiCoverCost';

import { goToLogin } from '../utils/goToLogin';
import { resolveVenueCountryIso } from '../utils/countryIso';
const CreateInvitation = () => {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const location = useLocation();
    const { addInvitation, currentUser } = useInvitations();
    const { showToast } = useToast();
    const { currentUser: authUser, userProfile } = useAuth(); // Get userProfile for guest check

    // Redirect guests to login immediately
    useEffect(() => {
        if (userProfile?.isGuest || userProfile?.role === 'guest' || currentUser?.id === 'guest') {
            goToLogin();
        }
    }, [userProfile, currentUser, navigate]);

    // UI State
    const [imageFile, setImageFile] = useState(null);
    const [mediaData, setMediaData] = useState(null); // NEW: For MediaSelector
    /** Single saved selfie / upload video (library). New recording blocked until this is deleted from Storage. */
    const [libraryVideo, setLibraryVideo] = useState(null);
    const [libraryImages, setLibraryImages] = useState([]);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [magicImageLoading, setMagicImageLoading] = useState(false);
    /** Short occasion description sent to Gemini with “Magic cover” (optional). */
    const [geminiOccasionBrief, setGeminiOccasionBrief] = useState('');
    /** Optional reference image for multimodal Magic cover (preview URL + payload for API). */
    const [magicCoverRefImage, setMagicCoverRefImage] = useState(null);
    const [magicCoverAspectRatio, setMagicCoverAspectRatio] = useState('9:16');
    /** After a successful paid generation: user must explicitly apply to the form. */
    const [magicCoverPending, setMagicCoverPending] = useState(null);
    const magicCoverRefInputRef = useRef(null);
    const advertisedAiCoverCost = useMemo(() => getAdvertisedInvitationAiCoverCreditCost(), []);
    /** True after user picks a place from venue search (or pre-filled / edit / deep link). Required to show Magic Cover on public flow. */
    const [venuePickConfirmed, setVenuePickConfirmed] = useState(() =>
        Boolean(
            location.state?.editingInvitation ||
                (location.state?.fromRestaurant && location.state?.restaurantData) ||
                (location.state?.prefilledData && String(location.state.prefilledData.restaurantName || '').trim()) ||
                (location.state?.offerData &&
                    String(
                        location.state.offerData.location ||
                            location.state.offerData.locationDetails ||
                            ''
                    ).trim())
        )
    );

    const [restrictionInfo, setRestrictionInfo] = useState(null); // Cancellation restriction info

    const restaurantData = location.state?.restaurantData || location.state?.selectedRestaurant;
    const prefilledData = location.state?.prefilledData; // From BusinessProfile
    const offerData = location.state?.offerData; // From Special Offer
    const fromRestaurant = location.state?.fromRestaurant || !!restaurantData;
    const editingDraft = location.state?.editingDraft; // Editing draft from preview
    const draftId = location.state?.draftId; // Draft ID to load
    const editingInvitation = location.state?.editingInvitation; // Editing PUBLISHED invitation
    const editVideoHydratedRef = useRef(null);
    const mediaLibraryHydratedRef = useRef(false);
    const templateCarouselRef = useRef(null);
    const templateCarouselScrollTimerRef = useRef(null);
    const colorScrollRef = useRef(null);
    const dragStateRef = useRef({
        activeKey: null,
        startX: 0,
        startScrollLeft: 0,
    });

    const mediaLibraryStorageKey = React.useMemo(() => {
        const userId = currentUser?.id || authUser?.uid;
        return userId ? `db_invitation_media_library_${userId}` : null;
    }, [currentUser?.id, authUser?.uid]);

    const startHorizontalDrag = (key, ref, event) => {
        if (event.button !== 0 || !ref.current) return;
        dragStateRef.current = {
            activeKey: key,
            startX: event.clientX,
            startScrollLeft: ref.current.scrollLeft,
        };
        ref.current.style.cursor = 'grabbing';
        ref.current.style.userSelect = 'none';
    };

    const moveHorizontalDrag = (key, ref, event) => {
        const s = dragStateRef.current;
        if (s.activeKey !== key || !ref.current) return;
        const dx = event.clientX - s.startX;
        ref.current.scrollLeft = s.startScrollLeft - dx;
    };

    const endHorizontalDrag = (key, ref) => {
        const s = dragStateRef.current;
        if (s.activeKey !== key || !ref.current) return;
        dragStateRef.current.activeKey = null;
        ref.current.style.cursor = 'grab';
        ref.current.style.removeProperty('user-select');
    };

    useEffect(() => {
        if (!editingInvitation?.id) editVideoHydratedRef.current = null;
    }, [editingInvitation?.id]);

    useEffect(() => {
        if (!mediaLibraryStorageKey || mediaLibraryHydratedRef.current) return;
        try {
            const raw = localStorage.getItem(mediaLibraryStorageKey);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed.images)) setLibraryImages(parsed.images.slice(0, 24));
                if (parsed.video?.videoUrl) setLibraryVideo(parsed.video);
            }
        } catch (e) {
            console.warn('Failed to read invitation media library:', e);
        } finally {
            mediaLibraryHydratedRef.current = true;
        }
    }, [mediaLibraryStorageKey]);

    useEffect(() => {
        if (!mediaLibraryStorageKey || !mediaLibraryHydratedRef.current) return;
        const payload = {
            images: libraryImages.slice(0, 24),
            video: libraryVideo || null,
        };
        localStorage.setItem(mediaLibraryStorageKey, JSON.stringify(payload));
    }, [mediaLibraryStorageKey, libraryImages, libraryVideo]);

    // Load existing invitation video into the media library + selection (edit flow) — once per invitation id
    useEffect(() => {
        if (!editingInvitation?.id) return;
        if (editVideoHydratedRef.current === editingInvitation.id) return;
        if (editingInvitation.mediaType !== 'video' || !editingInvitation.customVideo) return;
        editVideoHydratedRef.current = editingInvitation.id;
        setLibraryVideo({
            videoUrl: editingInvitation.customVideo,
            thumbnailUrl: editingInvitation.videoThumbnail || editingInvitation.customVideo,
        });
        setMediaData({
            source: 'custom_video',
            type: 'video',
            file: null,
            preview: editingInvitation.customVideo,
            videoThumbnail: editingInvitation.videoThumbnail || null,
            fromLibrary: true,
        });
    }, [editingInvitation]);

    const persistSelfieVideo = useCallback(async (file) => {
        const userId = currentUser?.id || authUser?.uid;
        if (!userId) throw new Error('Not signed in');
        const { videoUrl, thumbnailUrl } = await uploadVideoWithThumbnail(file, userId, 'invitations');
        setLibraryVideo({ videoUrl, thumbnailUrl });
        setMediaData({
            source: 'custom_video',
            type: 'video',
            file: null,
            preview: videoUrl,
            videoThumbnail: thumbnailUrl,
            fromLibrary: true,
        });
    }, [currentUser?.id, authUser?.uid]);

    const persistImageToLibrary = useCallback(async (file) => {
        const userId = currentUser?.id || authUser?.uid;
        if (!userId || !file) throw new Error('Not signed in');
        const url = await uploadMedia(file, userId, 'image', 'invitations');
        setLibraryImages((prev) => [url, ...prev.filter((u) => u !== url)].slice(0, 24));
        return url;
    }, [currentUser?.id, authUser?.uid]);

    const deleteLibraryVideo = useCallback(async () => {
        if (!libraryVideo) return;
        const vUrl = libraryVideo.videoUrl;
        const tUrl = libraryVideo.thumbnailUrl;
        try {
            await deleteFilesAtFirebaseDownloadUrls([vUrl, tUrl]);
        } catch (e) {
            console.error(e);
            showToast(t('delete_failed', { defaultValue: 'Could not delete video' }), 'error');
            return;
        }
        setLibraryVideo(null);
        setMediaData((prev) => {
            if (prev?.type === 'video' && prev?.preview === vUrl) return null;
            return prev;
        });
        showToast(t('video_removed_from_library', { defaultValue: 'Video removed. You can record a new one.' }), 'success');
    }, [libraryVideo, showToast, t]);

    const deleteLibraryImage = useCallback(async (url) => {
        if (!url) return;
        try {
            await deleteFilesAtFirebaseDownloadUrls([url]);
        } catch (e) {
            console.error(e);
            showToast(t('delete_failed', { defaultValue: 'Could not delete image' }), 'error');
            return;
        }
        setLibraryImages((prev) => prev.filter((u) => u !== url));
        setMediaData((prev) => {
            if (prev?.type === 'image' && (prev?.preview === url || prev?.url === url)) return null;
            return prev;
        });
    }, [showToast, t]);

    const handleMediaSelect = useCallback(async (data) => {
        if (!data) {
            setMediaData(null);
            return;
        }
        const userId = currentUser?.id || authUser?.uid;
        if (!userId) {
            setMediaData(data);
            return;
        }

        // Persist external venue image (DineBuddies cover or legacy URL) to Storage before save.
        if ((data.source === 'restaurant' || data.source === 'google_place') && data.url && !String(data.url).includes('firebasestorage')) {
            try {
                const stored = await uploadGoogleImage(data.url, userId, 'invitations');
                if (stored) {
                    setLibraryImages((prev) => [stored, ...prev.filter((u) => u !== stored)].slice(0, 24));
                    setMediaData({
                        ...data,
                        source: data.source === 'google_place' ? 'google_place' : 'restaurant',
                        url: stored,
                        preview: stored,
                        fromLibrary: true,
                    });
                    return;
                }
            } catch (e) {
                console.warn('Could not persist venue image immediately:', e);
            }
        }
        setMediaData(data);
    }, [currentUser?.id, authUser?.uid]);

    // Normalize legacy invitation data for validation (Safety Check)
    const originalGenderGroups = React.useMemo(() => {
        if (!editingInvitation) return [];
        if (editingInvitation.genderGroups && editingInvitation.genderGroups.length > 0) return editingInvitation.genderGroups;
        // Legacy handling
        if (editingInvitation.genderPreference === 'any' || !editingInvitation.genderPreference) return ['male', 'female', 'unspecified'];
        return [editingInvitation.genderPreference];
    }, [editingInvitation]);

    const originalAgeGroups = React.useMemo(() => {
        if (!editingInvitation) return [];
        if (editingInvitation.ageGroups && editingInvitation.ageGroups.length > 0) return editingInvitation.ageGroups;
        // Legacy handling
        if (!editingInvitation.ageRange || editingInvitation.ageRange === 'any') {
            return ['18-24', '25-34', '35-44', '45-54', '55+'];
        }
        // If specific legacy range, we try to match or default to all to be safe (preventing removal of potentially huge groups)
        // For now, if it's not 'any', we assume it maps to 'all' to prevent accidental restriction, or just let them edit.
        // User specific case: "Defined all ages".
        return ['18-24', '25-34', '35-44', '45-54', '55+'];
    }, [editingInvitation]);


    const [formData, setFormData] = useState({
        title: offerData?.title
            ? offerData.title
            : restaurantData
                ? `${t('dinner_at')} ${restaurantData.name}`
                : prefilledData?.restaurantName
                    ? `${t('dinner_at')} ${prefilledData.restaurantName}`
                    : '',
        restaurantId: restaurantData?.id || offerData?.partnerId || null,
        restaurantName: restaurantData?.name || prefilledData?.restaurantName || offerData?.location || '',
        type: normalizePublicVenueType(restaurantData?.type || 'Restaurant'),
        country: '',
        state: '',
        city: prefilledData?.city || restaurantData?.city || offerData?.city || '',
        date: '',
        time: '',
        // Get location from multiple possible sources
        location: offerData?.locationDetails || offerData?.location || restaurantData?.address || restaurantData?.location || prefilledData?.location || '',
        guestsNeeded: 3,
        genderPreference: 'custom',
        genderGroups: [], // Default to NONE selected
        ageRange: 'custom',
        ageGroups: [], // Default to NONE selected
        paymentType: 'Split',
        description: String(offerData?.description || '').slice(0, invitationMessageMaxLength),
        image: offerData?.image || restaurantData?.image || prefilledData?.restaurantImage || null,
        // Get coordinates from multiple possible sources
        lat: offerData?.lat || restaurantData?.lat || restaurantData?.coordinates?.lat || prefilledData?.lat,
        lng: offerData?.lng || restaurantData?.lng || restaurantData?.coordinates?.lng || prefilledData?.lng,
        privacy: 'public',

        // Special Offer constraints
        minDate: offerData?.startDate || null,
        maxDate: offerData?.endDate || null,
        lastLocationUpdate: serverTimestamp(),
        inviteMood: 'social',
        colorScheme: editingInvitation?.colorScheme || prefilledData?.colorScheme || 'oceanBlue',
        templateType: normalizePublicCardTemplateKey(
            editingInvitation?.templateType || prefilledData?.templateType || 'hero_1_1'
        ),
        cardFontFamily: editingInvitation?.cardFontFamily || '',
        coverAnimationType: normalizeCoverAnimationType(editingInvitation?.coverAnimationType),
        // Override with editingInvitation data if present
        ...(editingInvitation ? {
            ...editingInvitation,
            occasionType: undefined,
            title: editingInvitation.title,
            description: String(editingInvitation.description || '').slice(0, invitationMessageMaxLength),
            date: editingInvitation.date,
            time: editingInvitation.time,
            guestsNeeded: editingInvitation.guestsNeeded,
            genderGroups: editingInvitation.genderGroups || ['male', 'female', 'unspecified'],
            ageGroups: editingInvitation.ageGroups || ['18-24', '25-34', '35-44', '45-54', '55+'],
            colorScheme: editingInvitation.colorScheme || 'oceanBlue',
            templateType: normalizePublicCardTemplateKey(editingInvitation.templateType || 'hero_1_1'),
            cardFontFamily: editingInvitation.cardFontFamily || '',
            coverAnimationType: normalizeCoverAnimationType(editingInvitation.coverAnimationType),
            inviteMood:
                editingInvitation.inviteMood ||
                migrateLegacyOccasionToInviteMood(editingInvitation.occasionType),
            type: normalizePublicVenueType(editingInvitation.type),
            image: editingInvitation.image, // Keep existing image URL
            location: editingInvitation.location,
            lat: editingInvitation.lat,
            lng: editingInvitation.lng,
            city: editingInvitation.city,
            country: editingInvitation.country,
            userLat: editingInvitation.userLat,
            userLng: editingInvitation.userLng,
        } : {})
    });

    // Load draft if editing
    useEffect(() => {
        const loadDraft = async () => {
            if (editingDraft && draftId) {
                try {
                    const invitationRef = doc(db, 'invitations', draftId);
                    const invitationDoc = await getDoc(invitationRef);

                    if (invitationDoc.exists()) {
                        const draft = invitationDoc.data();
                        setFormData({
                            ...draft,
                            description: String(draft.description || '').slice(0, invitationMessageMaxLength),
                            coverAnimationType: normalizeCoverAnimationType(draft.coverAnimationType),
                            inviteMood:
                                draft.inviteMood || migrateLegacyOccasionToInviteMood(draft.occasionType),
                            type: normalizePublicVenueType(draft.type),
                            templateType: normalizePublicCardTemplateKey(draft.templateType),
                        });
                        if (String(draft.location || '').trim()) {
                            setVenuePickConfirmed(true);
                        }
                        setMagicCoverAspectRatio(templateTypeToMagicCoverAspect(draft.templateType));
                    }
                } catch (error) {
                    console.error('Error loading draft:', error);
                }
            }
        };

        loadDraft();
    }, [editingDraft, draftId]);

    // Mutual friend fetching removed (Private-only feature)




    // Update title when language changes if from restaurant
    useEffect(() => {
        if (restaurantData) {
            setFormData(prev => ({
                ...prev,
                title: `${t('dinner_at')} ${restaurantData.name}`
            }));
        }
    }, [i18n.language, restaurantData]);

    useEffect(() => {
        if (formData.type && !PUBLIC_VENUE_TYPES.includes(formData.type)) {
            setFormData((prev) => ({ ...prev, type: normalizePublicVenueType(prev.type) }));
        }
    }, [formData.type]);

    useEffect(() => {
        const k = normalizePublicCardTemplateKey(formData.templateType);
        if (k === 'classic') return;
        setMagicCoverAspectRatio(templateTypeToMagicCoverAspect(k));
    }, [formData.templateType]);

    useEffect(() => {
        const loc = String(formData.location || '').trim();
        if (loc) return;
        if (editingInvitation || (fromRestaurant && restaurantData) || String(prefilledData?.restaurantName || '').trim()) {
            return;
        }
        setVenuePickConfirmed(false);
    }, [formData.location, editingInvitation, fromRestaurant, restaurantData, prefilledData?.restaurantName]);

    const canUseMagicCover =
        !!editingInvitation ||
        !!(fromRestaurant && restaurantData) ||
        !!String(prefilledData?.restaurantName || '').trim() ||
        !!formData.restaurantId ||
        venuePickConfirmed;

    useEffect(() => {
        const url = magicCoverRefImage?.previewUrl;
        return () => {
            if (url) URL.revokeObjectURL(url);
        };
    }, [magicCoverRefImage?.previewUrl]);

    const clearMagicCoverRefImage = useCallback(() => {
        setMagicCoverRefImage(null);
    }, []);

    const onMagicCoverReferenceFile = useCallback(
        async (e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (!file) return;
            if (!file.type.startsWith('image/')) {
                showToast(
                    t('magic_cover_reference_invalid', { defaultValue: 'Please choose an image file (JPEG, PNG, WebP, or GIF).' }),
                    'error'
                );
                return;
            }
            try {
                const { mimeType, dataBase64, blob } = await prepareMagicCoverReferenceImage(file);
                setMagicCoverRefImage((prev) => ({
                    previewUrl: URL.createObjectURL(blob),
                    mimeType,
                    dataBase64,
                }));
            } catch (err) {
                console.warn('Magic cover reference image:', err);
                showToast(
                    t('magic_cover_reference_error', { defaultValue: 'Could not use this image. Try a smaller file or another format.' }),
                    'error'
                );
            }
        },
        [showToast, t]
    );

    // Handle image selection
    const handleImageSelect = (file) => {
        setImageFile(file);
        const reader = new FileReader();
        reader.onload = () => {
            setFormData(prev => ({ ...prev, image: reader.result }));
        };
        reader.readAsDataURL(file);
    };

    // Remove image
    const handleRemoveImage = () => {
        setFormData(prev => ({ ...prev, image: null }));
        setImageFile(null);
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleMagicCoverGenerate = async () => {
        if (!authUser || currentUser?.id === 'guest') {
            showToast(t('login_to_create') || 'Please sign in', 'error');
            goToLogin();
            return;
        }
        if (!canUseMagicCover && !editingInvitation) {
            showToast(
                t('magic_cover_requires_venue', {
                    defaultValue: 'Choose a venue from search first, then generate a Magic cover.',
                }),
                'error'
            );
            return;
        }

        setMagicImageLoading(true);
        try {
            const userBrief =
                String(geminiOccasionBrief || '').trim() ||
                t('magic_cover_empty_brief_fallback', {
                    defaultValue:
                        'No extra host notes. Infer a short inviting title and message from the stated vibe, venue type, and place.',
                });

            const scheme = COLOR_SCHEMES[formData.colorScheme];
            const style = [scheme?.name, formData.templateType]
                .filter((x) => String(x || '').trim())
                .join(' · ');

            const hints = buildMagicCoverHints(formData, {
                t,
                language: i18n.language,
                userProfile,
                currentUser,
            });

            const apiResult = await callGenerateInvitationImage({
                userBrief,
                language: i18n.language,
                prompt: userBrief,
                style,
                hints,
                coverAspectRatio: magicCoverAspectRatio,
                referenceImage: magicCoverRefImage
                    ? { mimeType: magicCoverRefImage.mimeType, dataBase64: magicCoverRefImage.dataBase64 }
                    : undefined,
                userPreferences: buildPublicInvitationUserPreferencesForAi(formData),
            });

            setMagicCoverPending({ apiResult });
            showToast(
                t('magic_cover_generated_review', {
                    defaultValue: 'Cover generated. Review the preview, then apply to your invitation when ready.',
                }),
                'success'
            );
        } catch (e) {
            if (e.code === 'insufficient_credits') {
                showToast(t('invitation_magic_image_insufficient'), 'error');
            } else {
                showToast(e.message || t('invitation_magic_image_error'), 'error');
            }
        } finally {
            setMagicImageLoading(false);
        }
    };

    const handleMagicCoverApplyToInvitation = useCallback(async () => {
        const apiResult = magicCoverPending?.apiResult;
        if (!apiResult) return;
        try {
            setFormData((prev) => buildFormPatchFromAtomicInvitationApi(apiResult, prev, invitationMessageMaxLength));

            const mediaPayload = await createAiInvitationCoverMediaData(apiResult);
            await handleMediaSelect(mediaPayload);
            setMagicCoverPending(null);
            showToast(t('magic_cover_applied_toast', { defaultValue: 'AI cover applied to this invitation.' }), 'success');
        } catch (e) {
            showToast(e?.message || t('invitation_magic_image_error'), 'error');
        }
    }, [magicCoverPending, handleMediaSelect, t]);

    const handleMagicCoverDiscardPending = useCallback(() => {
        setMagicCoverPending(null);
    }, []);

    const openInvitationAiStudio = useCallback(() => {
        const el = document.getElementById('invitation-ai-gateway');
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            return;
        }
        showToast(t('magic_cover_sign_in_to_scroll', { defaultValue: 'Sign in to use Magic cover above.' }), 'info');
    }, [showToast, t]);

    const handlePreview = async (e) => {
        e.preventDefault();
        console.log('🔍 handlePreview called');

        // Check if user is guest
        if (!currentUser || currentUser.id === 'guest' || !authUser) {
            console.error('❌ Guest user cannot create invitations');
            showToast(t('login_to_create') || 'Please login to create an invitation', 'error');
            goToLogin();
            return;
        }

        if (isSubmitting) {
            console.log('⚠️ Already submitting, returning');
            return;
        }

        // Validation
        if (!formData.title.trim()) {
            console.log('❌ Title validation failed');
            showToast(t('please_enter_title'), 'error');
            return;
        }

        if (!formData.date || !formData.time) {
            console.log('❌ Date/Time validation failed');
            showToast(t('please_set_datetime'), 'error');
            return;
        }

        if (!formData.location.trim()) {
            console.log('❌ Location validation failed');
            showToast(t('please_enter_location'), 'error');
            return;
        }



        // Validate Gender Groups (Must have at least one)
        if (!formData.genderGroups || formData.genderGroups.length === 0) {
            showToast(t('please_select_gender_group', { defaultValue: 'Please select at least one gender group' }), 'error');
            return;
        }

        // Validate Age Groups (Must have at least one)
        if (!formData.ageGroups || formData.ageGroups.length === 0) {
            showToast(t('please_select_age_group', { defaultValue: 'Please select at least one age group' }), 'error');
            return;
        }


        // Check for cancellation restrictions
        if (restrictionInfo && !restrictionInfo.canCreate) {
            console.log('❌ Restriction check failed');
            showToast(t('cannot_create_restricted', {
                date: restrictionInfo.until?.toLocaleDateString()
            }), 'error');
            return;
        }

        // Check daily invitation limit
        console.log('✅ Starting validation check...');
        const userId = currentUser?.id || authUser?.uid;
        if (!userId) {
            showToast(t('login_required') || 'Authentication required', 'error');
            return;
        }

        const isUpdate = (editingDraft && draftId) || editingInvitation;
        let validation = { valid: true };
        
        if (!isUpdate) {
            validation = await validateInvitationCreation(userId);
        }
        if (!validation.valid) {
            console.log('❌ Daily limit validation failed:', validation.error);
            const confirmMessage = `${validation.error}\n\nDo you want to go to your current invitation?`;

            if (window.confirm(confirmMessage)) {
                navigate(`/invitation/${validation.existingInvitation.id}`);
            }
            return;
        }

        console.log('✅ All validations passed, starting submission...');
        setIsSubmitting(true);
        setUploadProgress(0);

        try {
            let mediaFields = {};

            // Process media (image or video)
            if (mediaData) {
                console.log('📤 Processing media...');
                setUploadProgress(20);

                try {
                    // Use the correct userId
                    const userId = currentUser?.id || authUser?.uid;

                    if (!userId) {
                        throw new Error('User not authenticated');
                    }

                    console.log('👤 Using User ID:', userId);
                    mediaFields = await processInvitationMedia(mediaData, userId);
                    console.log('✅ Media processed:', mediaFields);

                    if (mediaFields.mediaSource === 'restaurant' || mediaFields.mediaSource === 'google_place' || mediaData.source === 'google_place' || mediaData.source === 'venue') {
                        // For updates, use deleteField. For new docs, just exclude them.
                        const isUpdate = (editingDraft && draftId) || editingInvitation;

                        if (isUpdate) {
                            mediaFields.customImage = deleteField();
                            mediaFields.customVideo = deleteField();
                            mediaFields.videoThumbnail = deleteField();
                        } else {
                            // On new doc, we just ensure these aren't in the object if we don't want them
                            delete mediaFields.customImage;
                            delete mediaFields.customVideo;
                            delete mediaFields.videoThumbnail;
                        }
                        mediaFields.mediaType = 'image';
                    }

                } catch (mediaError) {
                    console.error('❌ Media processing failed:', mediaError);
                    showToast(t('media_upload_failed') || 'Failed to upload media. Try again.', 'error');
                    setIsSubmitting(false);
                    setUploadProgress(0);
                    return;
                }

                setUploadProgress(60);
            } else if (formData.image) {
                // Fallback: existing image URL
                mediaFields = {
                    mediaSource: 'restaurant',
                    restaurantImage: formData.image,
                    mediaType: 'image'
                };
            }

            // Helper to deeply remove undefined values
            const stripUndefined = (obj) => {
                if (obj === undefined) return obj;
                const newObj = { ...obj };
                Object.keys(newObj).forEach(key => {
                    if (newObj[key] === undefined) {
                        delete newObj[key];
                    } else if (newObj[key] !== null && typeof newObj[key] === 'object' && !Array.isArray(newObj[key]) && typeof newObj[key].toDate !== 'function' && typeof newObj[key].isEqual !== 'function') {
                        // Skip FieldValue instances (which have isEqual method)
                        newObj[key] = stripUndefined(newObj[key]);
                    }
                });
                return newObj;
            };

            let draftData = {
                ...formData,
                ...mediaFields, // Merge media fields
                isFollowersOnly: formData.privacy === 'followers',
                status: 'draft' // Mark as draft
            };

            draftData = stripUndefined(draftData);

            // Remove old image field if exists
            if (draftData.image) {
                delete draftData.image;
            }

            console.log('📝 Creating draft with data:', draftData);

            let finalDraftId;

            if (editingDraft && draftId) {
                // Update existing draft
                console.log('🔄 Updating existing draft:', draftId);
                const invitationRef = doc(db, 'invitations', draftId);
                await updateDoc(invitationRef, draftData);
                finalDraftId = draftId;
            } else {
                // Create new draft
                console.log('➕ Creating new draft...');
                finalDraftId = await addInvitation(draftData);
                console.log('✅ Draft created with ID:', finalDraftId);
            }

            if (finalDraftId) {
                console.log('🚀 Navigating to preview:', `/invitation/preview/${finalDraftId}`);
                navigate(`/invitation/preview/${finalDraftId}`);
            } else {
                showToast(
                    t('failed_save_draft', 'Could not save draft. Try again, or sign in with a personal account (business accounts cannot create public invitations).'),
                    'error'
                );
            }
        } catch (error) {
            console.error('❌ Error creating draft:', error);
            showToast(error.message || t('failed_create_invitation'), 'error');
        } finally {
            setIsSubmitting(false);
            setUploadProgress(0);
        }
    };

    // Keep original handleSubmit for backward compatibility (if needed)
    const handleSubmit = async (e) => {
        e.preventDefault();
        console.log('🚀 Publishing invitation directly/updating...');

        if (isSubmitting) return;

        // Check if user is guest
        if (!currentUser || currentUser.id === 'guest' || !authUser) {
            console.error('❌ Guest user cannot create invitations');
            showToast(t('login_to_create') || 'Please login to create an invitation', 'error');
            goToLogin();
            return;
        }

        // Validation (This part is now handled by handlePreview, but keeping it here for direct submission if needed)
        if (!formData.title.trim()) {
            showToast(t('please_enter_title'), 'error');
            return;
        }

        if (!formData.date || !formData.time) {
            showToast(t('please_set_datetime'), 'error');
            return;
        }

        if (!formData.location.trim()) {
            showToast(t('please_enter_location'), 'error');
            return;
        }



        // Check for cancellation restrictions
        if (restrictionInfo && !restrictionInfo.canCreate) {
            showToast(t('cannot_create_restricted', {
                date: restrictionInfo.until?.toLocaleDateString()
            }), 'error');
            return;
        }

        // Check daily invitation limit (only if creating new)
        if (!editingInvitation) {
            const validation = await validateInvitationCreation(currentUser.uid);
            if (!validation.valid) {
                const confirmMessage = i18n.language === 'ar'
                    ? `${validation.error}\n\n${t('go_to_current_invitation')}`
                    : `${validation.error}\n\nDo you want to go to your current invitation?`;

                if (window.confirm(confirmMessage)) {
                    navigate(`/invitation/${validation.existingInvitation.id}`);
                }
                return;
            }
        }

        setIsSubmitting(true);
        setUploadProgress(0);

        try {
            let finalImageUrl = formData.image;
            let mediaFields = {};

            // 1. Process New Media from MediaSelector (Prioritized)
            if (mediaData) {
                console.log('📤 Processing media from MediaSelector...');
                setUploadProgress(20);

                try {
                    const userId = currentUser?.id || authUser?.uid;
                    if (!userId) throw new Error('User ID missing');

                    mediaFields = await processInvitationMedia(mediaData, userId);
                    console.log('✅ Media processed successfully:', mediaFields);

                    if (mediaFields.mediaSource === 'restaurant' || mediaFields.mediaSource === 'google_place' || mediaData.source === 'google_place' || mediaData.source === 'venue') {
                        if (editingInvitation) {
                            mediaFields.customImage = deleteField();
                            mediaFields.customVideo = deleteField();
                            mediaFields.videoThumbnail = deleteField();
                        } else {
                            delete mediaFields.customImage;
                            delete mediaFields.customVideo;
                            delete mediaFields.videoThumbnail;
                        }
                        mediaFields.mediaType = 'image';
                    }

                    if (mediaFields.restaurantImage) {
                        finalImageUrl = mediaFields.restaurantImage;
                    }
                } catch (mediaError) {
                    console.error('❌ Media processing failed:', mediaError);
                    let errMsg = mediaError?.message || 'Failed to upload media. Try again.';
                    // Show exact error on screen instead of generic translation key for debugging
                    showToast(`Media Error: ${errMsg}`, 'error');
                    setIsSubmitting(false);
                    return;
                }
                setUploadProgress(80);
            } else if (editingInvitation?.customVideo && !mediaData) {
                // User removed the library video and did not choose another medium
                mediaFields = {
                    customVideo: deleteField(),
                    videoThumbnail: deleteField(),
                    videoDuration: deleteField(),
                    mediaType: deleteField(),
                    mediaSource: deleteField(),
                };
            }
            // 2. Fallback: Legacy Image Upload (if imageFile exists and no mediaData)
            else if (imageFile) {
                console.log('📤 Uploading image (Legacy)...');
                const invitationId = editingInvitation ? editingInvitation.id : `temp_${Date.now()}`;
                const url = await uploadInvitationPhoto(
                    imageFile,
                    invitationId,
                    currentUser?.id || authUser?.uid,
                    0,
                    (progress) => setUploadProgress(progress)
                );
                finalImageUrl = url;
                console.log('✅ Image uploaded:', url);

                // Construct legacy media fields
                mediaFields = {
                    mediaSource: 'custom',
                    restaurantImage: url,
                    mediaType: 'image'
                };
            }

            // Helper to deeply remove undefined values
            const stripUndefined = (obj) => {
                if (obj === undefined) return obj;
                const newObj = { ...obj };
                Object.keys(newObj).forEach(key => {
                    if (newObj[key] === undefined) {
                        delete newObj[key];
                    } else if (newObj[key] !== null && typeof newObj[key] === 'object' && !Array.isArray(newObj[key]) && typeof newObj[key].toDate !== 'function' && typeof newObj[key].isEqual !== 'function') {
                        newObj[key] = stripUndefined(newObj[key]);
                    }
                });
                return newObj;
            };

            let cleanData = {
                ...formData,
                ...mediaFields, // Merge new media fields
                templateType: normalizePublicCardTemplateKey(formData.templateType),
                image: finalImageUrl !== undefined ? finalImageUrl : null, // Ensure backward compatibility for views using 'image'
                isFollowersOnly: formData.privacy === 'followers'
            };

            cleanData = stripUndefined(cleanData);

            // Remove purely UI fields if strictly necessary, but Firestore ignores undefined usually.
            // If mediaFields provided a video, ensure we don't accidentally keep old image as primary if unnecessary
            if (mediaFields.mediaType === 'video') {
                // If video, maybe clear image field if it was a photo? 
                // But usually we need a thumbnail. processInvitationMedia returns thumbnail in restaurantImage or similar? 
                // Let's rely on mediaFields return values.
            }

            if (editingInvitation) {
                console.log('📝 Updating invitation:', editingInvitation.id);
                const invitationRef = doc(db, 'invitations', editingInvitation.id);

                await updateDoc(invitationRef, cleanData);
                console.log('✅ Invitation updated');
                showToast(t('invitation_updated', { defaultValue: 'Invitation updated successfully' }), 'success');
                navigate(`/invitation/${editingInvitation.id}`);
            } else {
                // This path is usually handled by handlePreview -> Draft -> Publish, but logic remains
                console.log('📝 Creating invitation via direct submit...');
                const newId = await addInvitation(cleanData);
                if (newId) {
                    navigate(`/invitation/${newId}`);
                }
            }
        } catch (error) {
            console.error('❌ Error creating/updating invitation:', error);
            showToast(t('failed_create_invitation'), 'error');
        } finally {
            setIsSubmitting(false);
            setUploadProgress(0);
        }
    };

    const generateTitle = (placeName) => {
        const prefix = t('invitation_at');
        return `${prefix} ${placeName}`;
    };

    const handleLocationSelect = (placeData) => {
        setVenuePickConfirmed(true);
        const name = placeData.name || placeData.fullAddress || '';
        const isDbVenue = !!(placeData.restaurantId || placeData.isDineBuddiesVenue);
        setFormData((prev) => ({
            ...prev,
            location: name || prev.location,
            lat: placeData.lat ?? prev.lat,
            lng: placeData.lng ?? prev.lng,
            restaurantId: isDbVenue ? placeData.restaurantId || prev.restaurantId : null,
            restaurantName: isDbVenue ? (placeData.restaurantName || name || '').trim() : '',
            title: generateTitle(name || 'Venue'),
            ...(isDbVenue && placeData.image ? { image: placeData.image } : {}),
        }));
    };

    // Unified location discovery for all users/pages.
    useEffect(() => {
        if (restaurantData) return; // Already have location from restaurant

        const detectLocation = async () => {
            const detected = await detectUserLocationContext(userProfile);
            if (!detected.success) return;
            setFormData(prev => ({
                ...prev,
                city: detected.city || prev.city,
                country: detected.country || prev.country || '',
                countryCode: detected.countryCode || prev.countryCode || '',
                userLat: detected.latitude ?? prev.userLat,
                userLng: detected.longitude ?? prev.userLng,
            }));
        };

        detectLocation();
    }, [restaurantData, userProfile]);

    // Check for cancellation restrictions
    useEffect(() => {
        const checkRestrictions = async () => {
            if (currentUser && currentUser.id && currentUser.id !== 'guest') {
                const permission = await canCreateInvitation(currentUser.id);
                if (!permission.canCreate) {
                    setRestrictionInfo(permission);
                }
            }
        };

        checkRestrictions();
    }, [currentUser]);

    // Derived Data for UI
    const currentCountry = Country.getCountryByCode(formData.country);

    const previewHeroUrl = useMemo(() => {
        if (mediaData?.type === 'video') {
            return mediaData.videoThumbnail || mediaData.preview || mediaData.url || null;
        }
        if (mediaData?.type === 'image') {
            return mediaData.preview || mediaData.url || null;
        }
        return formData.image || null;
    }, [mediaData, formData.image]);

    const previewHostName =
        userProfile?.display_name ||
        userProfile?.displayName ||
        currentUser?.name ||
        currentUser?.displayName ||
        t('host', 'Host');

    /** Shared invitation payload for live template carousel (templateType set per slide). Merges pending Magic Cover JSON + image for WYSIWYG before Apply. */
    const previewInvitationBase = useMemo(() => {
        const pending = magicCoverPending?.apiResult;
        const pendingSrc =
            pending?.dataBase64 && pending?.mimeType
                ? `data:${pending.mimeType};base64,${pending.dataBase64}`
                : null;
        const heroUrl = pendingSrc || previewHeroUrl;
        const useVideo = !pendingSrc && mediaData?.type === 'video';
        const colorKey = pending
            ? mapAiFrameTextColorToColorSchemeKey(pending.theme?.frame_text_color) || formData.colorScheme
            : formData.colorScheme;
        const cardFont = pending
            ? mapAiFontNameToCssFamily(pending.theme?.font_name) || formData.cardFontFamily
            : formData.cardFontFamily;
        const anim = pending
            ? normalizeCoverAnimationType(pending.animation_meta?.type)
            : formData.coverAnimationType;
        const titleAi = String(pending?.basic_info?.title || '').trim();
        const descAi = String(pending?.basic_info?.message || '').trim();
        const titleOut = titleAi || formData.title || '\u00A0';
        const descOut = (descAi || formData.description || '').slice(0, invitationMessageMaxLength);

        return {
            id: '__create_preview__',
            author: {
                id: currentUser?.id || authUser?.uid || 'preview',
                name: previewHostName,
            },
            title: titleOut,
            type: formData.type,
            location: formData.location || '',
            paymentType: formData.paymentType,
            guestsNeeded: formData.guestsNeeded,
            joined: [],
            requests: [],
            date: formData.date,
            time: formData.time,
            description: descOut,
            genderPreference: formData.genderPreference,
            genderGroups: formData.genderGroups,
            ageGroups: formData.ageGroups,
            ageRange: formData.ageRange,
            image: heroUrl,
            mediaType: useVideo ? 'video' : 'image',
            customVideo: useVideo ? (mediaData.preview || mediaData.url || null) : undefined,
            videoThumbnail: useVideo ? (mediaData.videoThumbnail || mediaData.preview) : undefined,
            customImage: !useVideo && heroUrl ? heroUrl : undefined,
            restaurantImage:
                !pendingSrc && (mediaData?.source === 'restaurant' || mediaData?.source === 'google_place')
                    ? previewHeroUrl
                    : undefined,
            mediaSource: pendingSrc ? undefined : mediaData?.source,
            inviteMood: formData.inviteMood,
            colorScheme: colorKey,
            cardFontFamily: cardFont || undefined,
            coverAnimationType: anim,
        };
    }, [
        magicCoverPending,
        formData.title,
        formData.type,
        formData.location,
        formData.paymentType,
        formData.guestsNeeded,
        formData.date,
        formData.time,
        formData.description,
        formData.genderPreference,
        formData.genderGroups,
        formData.ageGroups,
        formData.ageRange,
        formData.inviteMood,
        formData.colorScheme,
        formData.cardFontFamily,
        formData.coverAnimationType,
        mediaData,
        previewHeroUrl,
        previewHostName,
        currentUser?.id,
        authUser?.uid,
    ]);

    const syncTemplateTypeFromCarouselScroll = useCallback(() => {
        const root = templateCarouselRef.current;
        if (!root) return;
        const center = root.getBoundingClientRect().left + root.clientWidth / 2;
        const slides = root.querySelectorAll('[data-template-slide="1"]');
        let bestKey = null;
        let bestDist = Infinity;
        slides.forEach((el) => {
            const key = el.getAttribute('data-template-key');
            if (!key) return;
            const r = el.getBoundingClientRect();
            const mid = (r.left + r.right) / 2;
            const d = Math.abs(mid - center);
            if (d < bestDist) {
                bestDist = d;
                bestKey = key;
            }
        });
        if (!bestKey) return;
        setFormData((prev) => (prev.templateType === bestKey ? prev : { ...prev, templateType: bestKey }));
    }, []);

    const onTemplateCarouselScroll = useCallback(() => {
        if (templateCarouselScrollTimerRef.current) {
            clearTimeout(templateCarouselScrollTimerRef.current);
        }
        templateCarouselScrollTimerRef.current = setTimeout(() => {
            syncTemplateTypeFromCarouselScroll();
        }, 90);
    }, [syncTemplateTypeFromCarouselScroll]);

    useEffect(
        () => () => {
            if (templateCarouselScrollTimerRef.current) {
                clearTimeout(templateCarouselScrollTimerRef.current);
            }
        },
        []
    );

    useEffect(() => {
        const root = templateCarouselRef.current;
        if (!root) return;
        const esc = typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(formData.templateType) : formData.templateType;
        const slide = root.querySelector(`[data-template-key="${esc}"]`);
        if (!slide) return;
        requestAnimationFrame(() => {
            slide.scrollIntoView({ behavior: 'auto', inline: 'center', block: 'nearest' });
        });
    }, [formData.templateType]);

    const today = new Date().toISOString().split('T')[0];

    const magicCoverPreviewSrc =
        magicCoverPending?.apiResult?.dataBase64 && magicCoverPending?.apiResult?.mimeType
            ? `data:${magicCoverPending.apiResult.mimeType};base64,${magicCoverPending.apiResult.dataBase64}`
            : null;

    return (
        <>
        <div className="page-container form-page create-public-invitation">
            <h2 style={{ marginBottom: '1rem', fontSize: '1.5rem', fontWeight: '900' }}>
                {editingInvitation ? t('edit_invitation', { defaultValue: 'Edit Invitation' }) : t('create_invitation_title')}
            </h2>

            {/* Restriction Warning Banner — page-specific red theme preserved */}
            {restrictionInfo && !restrictionInfo.canCreate && (
                <div style={{
                    background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.2), rgba(220, 38, 38, 0.2))',
                    border: '2px solid #ef4444',
                    borderRadius: '16px',
                    padding: '1.5rem',
                    marginBottom: '2rem',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '1rem'
                }}>
                    <div style={{ fontSize: '2rem' }}>⛔</div>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '1.1rem', fontWeight: '800', color: '#ef4444', marginBottom: '0.5rem' }}>
                            {t('account_restricted')}
                        </div>
                        <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                            {restrictionInfo.reason}
                        </div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span>⏰</span>
                            <span>{t('restriction_info', { days: restrictionInfo.daysLeft })}</span>
                        </div>
                    </div>
                </div>
            )}

            {fromRestaurant && restaurantData && (
                <div style={{
                    background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.15), rgba(244, 63, 94, 0.15))',
                    border: '1px solid var(--primary)',
                    borderRadius: '15px',
                    padding: '1rem 1.25rem',
                    marginBottom: '1.5rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px'
                }}>
                    <FaCheckCircle style={{ color: 'var(--primary)', fontSize: '1.2rem' }} />
                    <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '2px' }}>
                            {t('venue_selected')}
                        </div>
                        <div style={{ fontSize: '0.95rem', fontWeight: '800', color: 'var(--text-main)' }}>
                            {restaurantData.name}
                        </div>
                    </div>
                </div>
            )}

            {/* Show prefilled venue from PartnerProfile */}
            {!fromRestaurant && prefilledData?.restaurantName && (
                <div style={{
                    background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.15), rgba(244, 63, 94, 0.15))',
                    border: '1px solid var(--primary)',
                    borderRadius: '15px',
                    padding: '1rem 1.25rem',
                    marginBottom: '1.5rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px'
                }}>
                    <FaCheckCircle style={{ color: 'var(--primary)', fontSize: '1.2rem' }} />
                    <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '2px' }}>
                            {t('venue_selected')}
                        </div>
                        <div style={{ fontSize: '0.95rem', fontWeight: '800', color: 'var(--text-main)' }}>
                            {prefilledData.restaurantName}
                        </div>
                    </div>
                </div>
            )}

            {/* Show Locked Venue when Editing (Title/Location cannot change) */}
            {editingInvitation && (
                <div style={{
                    background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.15), rgba(244, 63, 94, 0.15))',
                    border: '1px solid var(--primary)',
                    borderRadius: '15px',
                    padding: '1rem 1.25rem',
                    marginBottom: '1.5rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px'
                }}>
                    <FaMapMarkerAlt style={{ color: 'var(--primary)', fontSize: '1.2rem' }} />
                    <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '2px' }}>
                            {t('venue_location') || 'Venue Location'}
                        </div>
                        <div style={{ fontSize: '0.95rem', fontWeight: '800', color: 'var(--text-main)' }}>
                            {formData.restaurantName || formData.location || formData.title}
                        </div>
                        {formData.city && (
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                {formData.city}
                            </div>
                        )}
                    </div>
                    <div style={{ fontSize: '1.2rem', color: 'var(--text-muted)', opacity: 0.5 }}>
                        <FaLock />
                    </div>
                </div>
            )}

            <form onSubmit={editingInvitation ? handleSubmit : handlePreview} className="create-form">

                <div className="ui-card ui-form-surface" style={{ marginBottom: '1rem', padding: '1rem', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
                    <h3 style={{ fontSize: '1.05rem', marginBottom: '0.85rem', fontWeight: 800 }}>
                        {t('create_section_vibe', { defaultValue: 'Invitation vibe' })}
                    </h3>
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                        {t('create_section_vibe_hint', { defaultValue: 'Sets tone for AI cover, text, and motion — separate from venue type below.' })}
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {PUBLIC_INVITE_MOOD_KEYS.map((moodKey) => {
                            const selected = formData.inviteMood === moodKey;
                            return (
                                <button
                                    key={moodKey}
                                    type="button"
                                    onClick={() => setFormData((prev) => ({ ...prev, inviteMood: moodKey }))}
                                    style={{
                                        padding: '10px 14px',
                                        borderRadius: '999px',
                                        border: selected ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                                        background: selected ? 'rgba(139, 92, 246, 0.15)' : 'var(--bg-card)',
                                        color: 'var(--text-main)',
                                        fontSize: '0.82rem',
                                        fontWeight: selected ? 800 : 600,
                                        cursor: 'pointer',
                                    }}
                                >
                                    {t(`invite_mood_${moodKey}`)}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {!editingInvitation && (
                    <div className="ui-card venue-search-stack" style={{ marginBottom: '1rem', padding: '1rem', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
                        <h3 style={{ fontSize: '1.05rem', marginBottom: '0.35rem', fontWeight: 800 }}>
                            {t('create_section_venue_location', { defaultValue: 'Venue & location' })}
                        </h3>
                        <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '0.85rem' }}>
                            {t('create_section_venue_location_hint', {
                                defaultValue: 'Pick a place and venue category — this drives the hero background; vibe above drives tone and copy.',
                            })}
                        </p>
                        <h4 style={{ fontSize: '0.95rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700 }}>
                            📍 {t('search_venue') || 'Search for a Venue'}
                        </h4>

                        <div className="form-group" style={{ marginBottom: '1rem' }}>
                            <label style={{ fontSize: '0.9rem', marginBottom: '8px', display: 'block' }}>
                                {t('venue_category_label', { defaultValue: 'Venue category' })}
                            </label>
                            <select
                                name="type"
                                value={PUBLIC_VENUE_TYPES.includes(formData.type) ? formData.type : 'Restaurant'}
                                onChange={handleChange}
                                className="input-field"
                            >
                                {PUBLIC_VENUE_TYPES.map((vt) => (
                                    <option key={vt} value={vt}>
                                        {t(`venue_type_${vt.toLowerCase().replace(/\s+/g, '_')}`, { defaultValue: vt })}
                                    </option>
                                ))}
                            </select>
                            <small style={{ color: 'var(--text-muted)', display: 'block', marginTop: '6px' }}>
                                {t('invitation_type_venue_search_hint', 'Choose the venue type first so search suggests matching places (café, bar, etc.).')}
                            </small>
                        </div>

                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label style={{ fontSize: '0.9rem', marginBottom: '8px', display: 'block' }}>
                                {t('form_location_label')}
                                {formData.city && (
                                    <span style={{
                                        color: 'var(--primary)',
                                        fontWeight: 'bold',
                                        fontSize: '0.95rem',
                                        marginLeft: '8px',
                                        marginRight: '8px'
                                    }}>
                                        ({t('in_my_city') || 'In'} {formData.city} 📍)
                                    </span>
                                )}
                            </label>
                            <VenueLocationPicker
                                value={formData.location}
                                onChange={handleChange}
                                onSelect={handleLocationSelect}
                                city={formData.city}
                                countryCode={resolveVenueCountryIso(formData, userProfile)}
                                userLat={formData.userLat ?? userProfile?.coordinates?.lat}
                                userLng={formData.userLng ?? userProfile?.coordinates?.lng}
                                invitationType={formData.type}
                            />
                            <small style={{ color: 'var(--text-muted)', display: 'block', marginTop: '5px' }}>
                                {t('location_helper_text') || 'Search for venues, cafes, or restaurants near you'}
                            </small>
                        </div>
                        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '10px 0 0', lineHeight: 1.4 }}>
                            {t('create_section_geo_search_note', {
                                defaultValue: 'Use DineBuddies venues or Google Places; city and country context refine suggestions.',
                            })}
                        </p>
                    </div>
                )}

                {authUser && currentUser?.id !== 'guest' ? (
                    <div
                        id="invitation-ai-gateway"
                        className="ui-card ui-form-surface"
                        style={{
                            marginBottom: '1rem',
                            padding: '1rem',
                            borderRadius: '16px',
                            border: '1px solid rgba(245, 158, 11, 0.45)',
                            background:
                                'linear-gradient(145deg, rgba(245, 158, 11, 0.1), rgba(168, 85, 247, 0.08), rgba(6, 182, 212, 0.06))',
                            boxShadow: '0 8px 28px rgba(245, 158, 11, 0.1)',
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
                            <div
                                aria-hidden
                                style={{
                                    width: 44,
                                    height: 44,
                                    borderRadius: 12,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    background: 'linear-gradient(135deg, #f59e0b, #d946ef)',
                                    color: '#fff',
                                }}
                            >
                                <FaMagic style={{ fontSize: '1.2rem' }} />
                            </div>
                            <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                                <h3 style={{ fontSize: '1.05rem', fontWeight: 900, margin: 0, lineHeight: 1.25 }}>
                                    {t('create_section_ai_gateway', { defaultValue: 'AI gateway — Magic cover' })}
                                </h3>
                                <p style={{ margin: '4px 0 0', fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                                    {t('create_section_ai_gateway_hint', {
                                        defaultValue:
                                            'Full pack: Gemini proposes title, message, theme, font, motion, and a text-free hero with a clear center area for overlays.',
                                    })}
                                </p>
                            </div>
                            {magicCoverPending ? (
                                <span
                                    style={{
                                        fontSize: '0.7rem',
                                        fontWeight: 800,
                                        textTransform: 'uppercase',
                                        padding: '4px 8px',
                                        borderRadius: 999,
                                        background: 'rgba(251, 191, 36, 0.25)',
                                        color: '#fbbf24',
                                        border: '1px solid rgba(251, 191, 36, 0.5)',
                                    }}
                                >
                                    {t('magic_cover_cta_badge_ready', { defaultValue: 'Preview ready' })}
                                </span>
                            ) : null}
                        </div>

                        <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', margin: '0 0 10px', lineHeight: 1.45 }}>
                            {t('magic_cover_optional_intro', {
                                defaultValue:
                                    'You do not need AI to publish. You can keep a normal photo or venue image from the media picker — this assistant is only if you want an auto-styled cover and copy.',
                            })}
                        </p>
                        <div
                            style={{
                                fontSize: '0.82rem',
                                lineHeight: 1.45,
                                marginBottom: 12,
                                padding: '10px 12px',
                                borderRadius: 12,
                                border: '1px solid rgba(251, 191, 36, 0.45)',
                                background: 'rgba(251, 191, 36, 0.1)',
                                color: 'var(--text-main)',
                            }}
                        >
                            {advertisedAiCoverCost > 0
                                ? t('magic_cover_paid_notice', {
                                      cost: advertisedAiCoverCost,
                                      defaultValue:
                                          'Paid: about {{cost}} credits per successful generation. Credits are deducted as soon as generation succeeds, even if you discard the preview.',
                                  })
                                : t('magic_cover_paid_notice_generic', {
                                      defaultValue:
                                          'Paid: credits are charged per successful generation on the server. The exact amount depends on your account and promotions.',
                                  })}
                        </div>

                        {magicCoverPending && typeof magicCoverPending.apiResult?.creditsCharged === 'number' ? (
                            <p style={{ fontSize: '0.82rem', fontWeight: 700, margin: '0 0 12px', color: 'var(--text-main)' }}>
                                {t('magic_cover_charged_notice', {
                                    cost: magicCoverPending.apiResult.creditsCharged,
                                    defaultValue: 'This generation used {{cost}} credits.',
                                })}
                            </p>
                        ) : null}

                        <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '0 0 12px', lineHeight: 1.45 }}>
                            {t('create_section_ai_cover_hint', {
                                defaultValue:
                                    'After choosing a venue, add optional notes for Gemini. Generation sends vibe as tone, venue type as scene, then this text as context.',
                            })}
                        </p>

                        <div className="form-group" style={{ marginBottom: '1rem' }}>
                            <label style={{ fontSize: '0.9rem', marginBottom: '8px', display: 'block' }}>
                                {t('magic_cover_aspect_label', { defaultValue: 'Cover shape (same as layout ratios)' })}
                            </label>
                            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '0 0 10px', lineHeight: 1.4 }}>
                                {t('magic_cover_aspect_hint', {
                                    defaultValue:
                                        '1:1 (square) or 9:16 (vertical) — vertical works best for phone-first layouts with a centered text band.',
                                })}
                            </p>
                            <div
                                role="group"
                                aria-label={t('magic_cover_aspect_label', { defaultValue: 'Cover shape' })}
                                style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}
                            >
                                {MAGIC_COVER_ASPECT_RATIOS.map((ar) => {
                                    const selected = magicCoverAspectRatio === ar;
                                    return (
                                        <button
                                            key={ar}
                                            type="button"
                                            onClick={() => setMagicCoverAspectRatio(ar)}
                                            style={{
                                                padding: '8px 14px',
                                                borderRadius: '10px',
                                                fontWeight: 700,
                                                fontSize: '0.85rem',
                                                cursor: 'pointer',
                                                border: selected ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                                                background: selected ? 'color-mix(in srgb, var(--primary) 20%, transparent)' : 'var(--bg-card)',
                                                color: 'var(--text-main)',
                                                boxShadow: selected ? '0 0 0 1px var(--primary)' : 'none',
                                            }}
                                        >
                                            {t(`magic_cover_aspect_${ar.replace(':', '_')}`, { defaultValue: ar })}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="form-group" style={{ marginBottom: '1rem' }}>
                            <label style={{ fontSize: '0.9rem', marginBottom: '8px', display: 'block' }}>
                                {t('gemini_occasion_brief_label', { defaultValue: 'Smart description for Gemini (context)' })}
                            </label>
                            <textarea
                                value={geminiOccasionBrief}
                                onChange={(e) => setGeminiOccasionBrief(e.target.value.slice(0, 2000))}
                                rows={3}
                                className="input-field text-area"
                                placeholder={t('gemini_occasion_brief_placeholder', {
                                    defaultValue:
                                        'Who should join, occasion, or any detail — sent as the host context line to the model.',
                                })}
                                style={{ minHeight: '72px' }}
                            />
                            <small style={{ color: 'var(--text-muted)', display: 'block', marginTop: '8px' }}>
                                {t('gemini_occasion_brief_hint', {
                                    defaultValue:
                                        'This text is the main “step C” context. If you leave it empty, the model still uses your vibe and venue type.',
                                })}
                            </small>
                        </div>

                        <div
                            className="form-group"
                            style={{
                                marginBottom: '1rem',
                                padding: '12px',
                                borderRadius: 12,
                                border: '1px dashed rgba(139, 92, 246, 0.45)',
                                background: 'rgba(139, 92, 246, 0.06)',
                            }}
                        >
                            <label style={{ fontSize: '0.9rem', marginBottom: '8px', display: 'block', fontWeight: 800 }}>
                                {t('magic_cover_reference_section_title', { defaultValue: 'Reference image (optional)' })}
                            </label>
                            <input
                                ref={magicCoverRefInputRef}
                                type="file"
                                accept="image/jpeg,image/png,image/webp,image/gif"
                                style={{ display: 'none' }}
                                onChange={onMagicCoverReferenceFile}
                            />
                            {!magicCoverRefImage ? (
                                <button
                                    type="button"
                                    onClick={() => magicCoverRefInputRef.current?.click()}
                                    style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        padding: '8px 12px',
                                        borderRadius: '10px',
                                        cursor: 'pointer',
                                        fontWeight: 600,
                                        fontSize: '0.85rem',
                                        background: 'var(--bg-card)',
                                        border: '1px solid var(--border-color)',
                                        color: 'var(--text-main)',
                                    }}
                                >
                                    <FaImage aria-hidden />
                                    {t('magic_cover_reference_add', { defaultValue: 'Add reference image' })}
                                </button>
                            ) : (
                                <div
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '12px',
                                        flexWrap: 'wrap',
                                        padding: '10px',
                                        borderRadius: '12px',
                                        border: '1px solid var(--border-color)',
                                        background: 'var(--bg-elevated, rgba(255,255,255,0.04))',
                                    }}
                                >
                                    <img
                                        src={magicCoverRefImage.previewUrl}
                                        alt=""
                                        style={{
                                            width: 76,
                                            height: 76,
                                            objectFit: 'cover',
                                            borderRadius: 10,
                                            border: '1px solid var(--border-color)',
                                        }}
                                    />
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                        <button
                                            type="button"
                                            onClick={() => magicCoverRefInputRef.current?.click()}
                                            style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: 6,
                                                padding: '8px 12px',
                                                borderRadius: 10,
                                                border: '1px solid var(--border-color)',
                                                background: 'var(--bg-card)',
                                                color: 'var(--text-main)',
                                                fontWeight: 600,
                                                fontSize: '0.82rem',
                                                cursor: 'pointer',
                                            }}
                                        >
                                            <FaImage aria-hidden />
                                            {t('magic_cover_reference_replace', { defaultValue: 'Replace' })}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={clearMagicCoverRefImage}
                                            style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: 6,
                                                padding: '8px 12px',
                                                borderRadius: 10,
                                                border: '1px solid rgba(239, 68, 68, 0.45)',
                                                background: 'rgba(239, 68, 68, 0.1)',
                                                color: '#f87171',
                                                fontWeight: 600,
                                                fontSize: '0.82rem',
                                                cursor: 'pointer',
                                            }}
                                        >
                                            <FaTimes aria-hidden />
                                            {t('magic_cover_reference_remove', { defaultValue: 'Remove' })}
                                        </button>
                                    </div>
                                </div>
                            )}
                            <small style={{ color: 'var(--text-muted)', display: 'block', marginTop: '8px' }}>
                                {t('magic_cover_reference_hint', {
                                    defaultValue:
                                        'Optional: attach a photo for Gemini to match mood, colors, or setting. The generated cover stays text-free and original.',
                                })}
                            </small>
                        </div>

                        {!canUseMagicCover && !editingInvitation ? (
                            <p
                                style={{
                                    fontSize: '0.82rem',
                                    color: '#fbbf24',
                                    marginBottom: 10,
                                    padding: '8px 10px',
                                    borderRadius: 10,
                                    background: 'rgba(251, 191, 36, 0.12)',
                                    border: '1px solid rgba(251, 191, 36, 0.35)',
                                }}
                            >
                                {t('magic_cover_requires_venue', {
                                    defaultValue: 'Choose a venue from search above to enable Generate Magic Cover.',
                                })}
                            </p>
                        ) : null}

                        <button
                            type="button"
                            onClick={handleMagicCoverGenerate}
                            disabled={
                                magicImageLoading || !authUser || currentUser?.id === 'guest' || (!canUseMagicCover && !editingInvitation)
                            }
                            title={
                                !canUseMagicCover && !editingInvitation
                                    ? t('magic_cover_requires_venue', {
                                          defaultValue: 'Choose a venue from search above to enable Generate Magic Cover.',
                                      })
                                    : undefined
                            }
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px',
                                width: '100%',
                                padding: '12px 14px',
                                borderRadius: '12px',
                                border: 'none',
                                fontWeight: 800,
                                fontSize: '0.95rem',
                                cursor:
                                    magicImageLoading || !authUser || currentUser?.id === 'guest' || (!canUseMagicCover && !editingInvitation)
                                        ? 'not-allowed'
                                        : 'pointer',
                                opacity: magicImageLoading || (!canUseMagicCover && !editingInvitation) ? 0.72 : 1,
                                background: 'linear-gradient(135deg, var(--primary), var(--accent))',
                                color: '#fff',
                            }}
                        >
                            <FaMagic aria-hidden />
                            {magicImageLoading
                                ? t('invitation_magic_image_loading')
                                : t('invitation_magic_image_btn_generate', { defaultValue: 'Generate Magic Cover' })}
                        </button>

                        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '12px 0', lineHeight: 1.45 }}>
                            {t('invitation_magic_image_hint')}
                        </p>

                        {magicCoverPreviewSrc ? (
                            <div style={{ marginBottom: 8 }}>
                                <p style={{ fontSize: '0.88rem', fontWeight: 700, margin: '0 0 8px' }}>
                                    {t('magic_cover_preview_heading', { defaultValue: 'Preview — not applied yet' })}
                                </p>
                                <img
                                    src={magicCoverPreviewSrc}
                                    alt=""
                                    style={{
                                        width: '100%',
                                        maxHeight: 240,
                                        objectFit: 'contain',
                                        borderRadius: 12,
                                        border: '1px solid var(--border-color)',
                                        background: 'var(--bg-elevated, #111)',
                                    }}
                                />
                                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '8px 0 0', lineHeight: 1.4 }}>
                                    {t('magic_cover_apply_explain', {
                                        defaultValue:
                                            'Apply updates the title, message, colors, font, motion, and cover image on this draft. You can still edit everything afterward.',
                                    })}
                                </p>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 12 }}>
                                    <button
                                        type="button"
                                        className="ui-btn ui-btn--primary"
                                        onClick={handleMagicCoverApplyToInvitation}
                                        style={{ flex: '1 1 160px', fontWeight: 700 }}
                                    >
                                        {t('magic_cover_btn_apply', { defaultValue: 'Apply to invitation' })}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleMagicCoverDiscardPending}
                                        style={{
                                            flex: '1 1 140px',
                                            padding: '10px 14px',
                                            borderRadius: 12,
                                            fontWeight: 600,
                                            border: '1px solid var(--border-color)',
                                            background: 'var(--bg-card)',
                                            color: 'var(--text-main)',
                                            cursor: 'pointer',
                                        }}
                                    >
                                        {t('magic_cover_btn_discard_result', { defaultValue: 'Discard preview' })}
                                    </button>
                                </div>
                                <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: '10px 0 0', lineHeight: 1.35 }}>
                                    {t('magic_cover_discard_credits_note', {
                                        defaultValue: 'Discarding does not refund credits — they were already charged when generation succeeded.',
                                    })}
                                </p>
                            </div>
                        ) : null}
                    </div>
                ) : null}

                <div className="ui-card ui-form-surface" style={{ marginBottom: '1rem', padding: '1rem', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
                    <h3 style={{ fontSize: '1.05rem', marginBottom: '0.85rem', fontWeight: 800 }}>
                        {t('create_section_core', { defaultValue: 'Invitation details' })}
                    </h3>
                    <div className="form-group" style={{ marginBottom: '1rem' }}>
                        <label>{t('form_title_label')}</label>
                        <input
                            type="text"
                            name="title"
                            placeholder={t('form_title_placeholder')}
                            value={formData.title}
                            onChange={handleChange}
                            required
                            className="input-field"
                            disabled={!!editingInvitation}
                            style={editingInvitation ? { opacity: 0.6, cursor: 'not-allowed', background: 'var(--hover-overlay)' } : {}}
                        />
                    </div>
                    <div className="form-group" style={{ marginBottom: '1rem' }}>
                        <label>{t('form_payment_label')}</label>
                        <select name="paymentType" value={formData.paymentType} onChange={handleChange} className="input-field">
                            <option value="Split">{t('payment_split')}</option>
                            <option value="Host Pays">{t('payment_host')}</option>
                        </select>
                    </div>
                    {editingInvitation && formData.location && (
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{t('form_location_label')}</label>
                            <div className="input-field" style={{ opacity: 0.85, cursor: 'default' }}>
                                {formData.location}
                            </div>
                        </div>
                    )}
                </div>

                <div className="form-grid">
                    <div className="form-group">
                        <label className="elegant-label">
                            <span className="label-icon">
                                <FaCalendarAlt />
                            </span>
                            {t('form_date_label')}
                        </label>
                        <input
                            type="date"
                            name="date"
                            min={formData.minDate ? new Date(formData.minDate.seconds ? formData.minDate.toDate() : formData.minDate).toISOString().split('T')[0] : today}
                            max={formData.maxDate ? new Date(formData.maxDate.seconds ? formData.maxDate.toDate() : formData.maxDate).toISOString().split('T')[0] : undefined}
                            value={formData.date}
                            onChange={handleChange}
                            required
                            disabled={!!editingInvitation} // Lock Date
                            className="input-field"
                            style={editingInvitation ? { opacity: 0.6, cursor: 'not-allowed', background: 'var(--hover-overlay)' } : {}}
                        />
                    </div>

                    <div className="form-group">
                        <label className="elegant-label">
                            <span className="label-icon">
                                <FaClock />
                            </span>
                            {t('form_time_label')}
                        </label>
                        <input
                            type="time"
                            name="time"
                            value={formData.time}
                            onChange={handleChange}
                            required
                            disabled={!!editingInvitation} // Lock Time
                            className="input-field"
                            style={editingInvitation ? { opacity: 0.6, cursor: 'not-allowed', background: 'var(--hover-overlay)' } : {}}
                        />
                    </div>
                </div>

                <div className="form-group">
                    <label className="elegant-label">
                        <span className="label-icon">
                            <FaUserFriends />
                        </span>
                        {t('guests_needed_label', { defaultValue: 'Guests Needed' })}
                    </label>
                    <input
                        type="number"
                        name="guestsNeeded"
                        min="1"
                        max="20"
                        value={formData.guestsNeeded}
                        onChange={handleChange}
                        required
                        className="input-field"
                    />
                </div>

                {/* Gender Groups Preference */}
                <div className="form-group">
                    <label className="elegant-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>
                            <span className="label-icon"><FaVenusMars /></span>
                            {t('guest_gender_preference')}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>
                            {t('multi_select', { defaultValue: '(Select multiple)' })}
                        </span>
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                        {[
                            { value: 'male', label: t('male'), icon: IoMale },
                            { value: 'female', label: t('female'), icon: IoFemale },
                            { value: 'unspecified', label: t('non_binary', { defaultValue: 'Non-Binary' }), icon: IoMaleFemale }
                        ].map((option) => {
                            const currentGroups = formData.genderGroups || [];
                            const isSelected = currentGroups.includes(option.value);

                            return (
                                <button
                                    key={option.value}
                                    type="button"
                                    onClick={() => {
                                        let newGroups = [...currentGroups];
                                        if (isSelected) {
                                            // PREVENT REMOVAL if it was in the original invitation (Normalized)
                                            if (originalGenderGroups.includes(option.value)) {
                                                showToast(t('cannot_remove_gender_group', { defaultValue: 'Cannot remove a previously selected group. You can only add more.' }), 'error');
                                                return;
                                            }
                                            newGroups = newGroups.filter(g => g !== option.value);
                                        } else {
                                            newGroups.push(option.value);
                                        }
                                        setFormData({ ...formData, genderGroups: newGroups, genderPreference: 'custom' });
                                    }}
                                    style={{
                                        position: 'relative',
                                        padding: '16px 12px',
                                        borderRadius: '16px',
                                        border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                                        background: isSelected ? 'rgba(139, 92, 246, 0.2)' : 'var(--hover-overlay)',
                                        color: isSelected ? 'var(--text-main)' : 'var(--text-secondary)',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        gap: '8px',
                                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                        transform: isSelected ? 'translateY(-2px)' : 'none',
                                        boxShadow: isSelected ? '0 4px 12px rgba(139, 92, 246, 0.3)' : 'none'
                                    }}
                                >
                                    {isSelected && (
                                        <div style={{ position: 'absolute', top: '8px', right: '8px', color: 'var(--primary)', fontSize: '0.8rem' }}>
                                            <FaCheckCircle />
                                        </div>
                                    )}
                                    <option.icon style={{ fontSize: '2rem', color: isSelected ? 'var(--primary)' : 'inherit', filter: isSelected ? 'drop-shadow(0 0 8px rgba(139, 92, 246, 0.5))' : 'none' }} />
                                    <span style={{ fontSize: '0.9rem', fontWeight: isSelected ? '800' : '600' }}>
                                        {option.label}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                    {(!formData.genderGroups || formData.genderGroups.length === 0) && (
                        <p style={{ fontSize: '0.85rem', color: '#f87171', marginTop: '8px', textAlign: 'center', background: 'rgba(248, 113, 113, 0.1)', padding: '4px', borderRadius: '8px' }}>
                            ⚠️ {t('select_at_least_one_gender', { defaultValue: 'Please select at least one option' })}
                        </p>
                    )}
                </div>

                {/* Age Groups Preference */}
                <div className="form-group">
                    <label className="elegant-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>
                            <span className="label-icon"><FaUserFriends /></span>
                            {t('age_range_preference')}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>
                            {t('multi_select', { defaultValue: '(Select multiple)' })}
                        </span>
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                        {[
                            { value: '18-24', label: '18-24' },
                            { value: '25-34', label: '25-34' },
                            { value: '35-44', label: '35-44' },
                            { value: '45-54', label: '45-54' },
                            { value: '55+', label: '55+' },
                            // Removed 'Any' option as requested
                        ].map((option) => {
                            const currentGroups = formData.ageGroups || [];
                            const isSelected = currentGroups.includes(option.value);

                            return (
                                <button
                                    key={option.value}
                                    type="button"
                                    onClick={() => {
                                        let newGroups = [...currentGroups];
                                        if (isSelected) {
                                            // PREVENT REMOVAL if it was in the original invitation (Normalized)
                                            if (originalAgeGroups.includes(option.value)) {
                                                showToast(t('cannot_remove_age_group', { defaultValue: 'Cannot remove a previously selected age group. You can only add more.' }), 'error');
                                                return;
                                            }
                                            newGroups = newGroups.filter(g => g !== option.value);
                                        } else {
                                            newGroups.push(option.value);
                                        }
                                        // If ageGroups is modified, we set ageRange to 'custom' to avoid legacy logic taking over
                                        setFormData({ ...formData, ageGroups: newGroups, ageRange: 'custom' });
                                    }}
                                    style={{
                                        position: 'relative',
                                        padding: '16px 12px',
                                        borderRadius: '16px',
                                        border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                                        background: isSelected ? 'rgba(139, 92, 246, 0.2)' : 'var(--hover-overlay)',
                                        color: isSelected ? 'var(--text-main)' : 'var(--text-secondary)',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '4px',
                                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                        opacity: 1, // Full opacity for clear visibility
                                        minHeight: '80px',
                                        transform: isSelected ? 'translateY(-2px)' : 'none',
                                        boxShadow: isSelected ? '0 4px 12px rgba(139, 92, 246, 0.3)' : 'none'
                                    }}
                                >
                                    {isSelected && (
                                        <div style={{ position: 'absolute', top: '6px', right: '6px', color: 'var(--primary)', fontSize: '0.7rem' }}>
                                            <FaCheckCircle />
                                        </div>
                                    )}
                                    <HiUser style={{
                                        fontSize: '1.8rem',
                                        color: isSelected ? 'var(--primary)' : 'inherit',
                                        marginBottom: '4px',
                                        filter: isSelected ? 'drop-shadow(0 0 5px rgba(139, 92, 246, 0.5))' : 'none'
                                    }} />
                                    <span style={{ fontSize: '0.9rem', fontWeight: isSelected ? '800' : '600' }}>
                                        {option.label}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                    {(!formData.ageGroups || formData.ageGroups.length === 0) && (
                        <p style={{ fontSize: '0.85rem', color: '#f87171', marginTop: '8px', textAlign: 'center', background: 'rgba(248, 113, 113, 0.1)', padding: '4px', borderRadius: '8px' }}>
                            ⚠️ {t('select_at_least_one_age', { defaultValue: 'Please select at least one age group' })}
                        </p>
                    )}
                </div>

                <div className="form-group">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <label style={{ marginBottom: 0 }}>{t('form_message_label', 'Message')}</label>
                        <span style={{ fontSize: '0.75rem', color: (formData.description?.length || 0) >= invitationMessageMaxLength ? '#f87171' : 'var(--text-muted)' }}>
                            {(formData.description?.length || 0)}/{invitationMessageMaxLength}
                        </span>
                    </div>
                    <textarea
                        name="description"
                        rows="2"
                        placeholder={t('form_message_placeholder', 'Write your message to the invitees here...')}
                        value={formData.description}
                        onChange={handleChange}
                        className="input-field text-area"
                        maxLength={invitationMessageMaxLength}
                        style={{ minHeight: '44px' }}
                    ></textarea>
                </div>

                <div
                    style={{
                        background: 'var(--card-bg)',
                        padding: '1rem',
                        borderRadius: '16px',
                        border: '1px solid var(--border-color)',
                        marginBottom: '1rem',
                    }}
                >
                    <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        🎬 {t('create_section_media', { defaultValue: 'Photo or video' })}
                    </h3>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                        {t('media_helper_text') || 'Choose a photo or video for your invitation'}
                    </p>
                    <MediaSelector
                        restaurant={restaurantData || prefilledData}
                        mediaData={mediaData}
                        libraryVideo={libraryVideo}
                        libraryImages={libraryImages}
                        onPersistSelfieVideo={persistSelfieVideo}
                        onPersistImage={persistImageToLibrary}
                        onDeleteLibraryVideo={deleteLibraryVideo}
                        onDeleteLibraryImage={deleteLibraryImage}
                        onMediaSelect={handleMediaSelect}
                        deviceAndAiTabs
                        onOpenAiStudio={openInvitationAiStudio}
                    />
                    {uploadProgress > 0 && uploadProgress < 100 && (
                        <div
                            style={{
                                marginTop: '12px',
                                background: 'var(--bg-card)',
                                borderRadius: '8px',
                                padding: '12px',
                                border: '1px solid var(--border-color)',
                            }}
                        >
                            <div
                                style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    marginBottom: '8px',
                                    fontSize: '0.85rem',
                                    color: 'var(--text-secondary)',
                                }}
                            >
                                <span>{t('processing')}</span>
                                <span>{uploadProgress}%</span>
                            </div>
                            <div
                                style={{
                                    width: '100%',
                                    height: '6px',
                                    background: 'var(--border-color)',
                                    borderRadius: '3px',
                                    overflow: 'hidden',
                                }}
                            >
                                <div
                                    style={{
                                        width: `${uploadProgress}%`,
                                        height: '100%',
                                        background: 'linear-gradient(90deg, var(--primary), var(--accent))',
                                        transition: 'width 0.3s ease',
                                        borderRadius: '3px',
                                    }}
                                />
                            </div>
                        </div>
                    )}
                </div>

                <div className="form-group ui-form-surface" style={{ marginTop: '1rem' }}>
                    <label className="elegant-label" style={{ marginBottom: '1rem' }}>
                        <span className="label-icon"><FaLock /></span>
                        {t('privacy_settings') || 'Privacy Settings'}
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                        {['public', 'followers'].map((mode) => (
                            <button
                                key={mode}
                                type="button"
                                onClick={() => setFormData({ ...formData, privacy: mode })}
                                style={{
                                    padding: '12px 8px',
                                    borderRadius: '12px',
                                    border: formData.privacy === mode ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                                    background: formData.privacy === mode ? 'rgba(139, 92, 246, 0.15)' : 'var(--bg-card)',
                                    color: 'var(--text-main)',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    gap: '8px',
                                    transition: 'all 0.2s',
                                }}
                            >
                                {mode === 'public' && <FaGlobe style={{ fontSize: '1.4rem', color: formData.privacy === mode ? 'var(--primary)' : 'var(--text-muted)' }} />}
                                {mode === 'followers' && <FaUserFriends style={{ fontSize: '1.4rem', color: formData.privacy === mode ? 'var(--primary)' : 'var(--text-muted)' }} />}
                                <span style={{ fontSize: '0.75rem', fontWeight: '700' }}>
                                    {mode === 'public' ? (t('public') || 'Public') : (t('followers_only') || 'Followers')}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="form-group ui-form-surface" style={{ marginTop: '1.5rem', overflow: 'hidden' }}>
                    <label className="elegant-label" style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>✍️</span>
                        {t('invitation_card_font', { defaultValue: 'Title & message font' })}
                    </label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        <button
                            type="button"
                            onClick={() => setFormData((prev) => ({ ...prev, cardFontFamily: '' }))}
                            style={{
                                padding: '8px 12px',
                                borderRadius: '10px',
                                border: !formData.cardFontFamily ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                                background: !formData.cardFontFamily ? 'rgba(139, 92, 246, 0.12)' : 'var(--bg-card)',
                                color: 'var(--text-main)',
                                fontSize: '0.78rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                            }}
                        >
                            {t('invitation_font_default', { defaultValue: 'Default' })}
                        </button>
                        {PUBLIC_INVITATION_FONT_OPTIONS.map((f) => {
                            const sel = formData.cardFontFamily === f.cssFamily;
                            return (
                                <button
                                    key={f.label}
                                    type="button"
                                    onClick={() => setFormData((prev) => ({ ...prev, cardFontFamily: f.cssFamily }))}
                                    style={{
                                        padding: '8px 12px',
                                        borderRadius: '10px',
                                        border: sel ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                                        background: sel ? 'rgba(139, 92, 246, 0.12)' : 'var(--bg-card)',
                                        color: 'var(--text-main)',
                                        fontFamily: f.cssFamily,
                                        fontSize: '0.82rem',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                    }}
                                >
                                    {f.label}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Color Theme Horizontal Picker */}
                <div className="form-group ui-form-surface" style={{ marginTop: '1.5rem', overflow: 'hidden' }}>
                    <label className="elegant-label" style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>🎨</span>
                        {t('choose_color_theme', { defaultValue: 'Choose Color Theme' })}
                    </label>

                    <div style={{
                        display: 'flex',
                        overflowX: 'auto',
                        gap: '12px',
                        padding: '10px 4px',
                        scrollbarWidth: 'none', // Firefox
                        msOverflowStyle: 'none', // IE/Edge
                        cursor: 'grab',
                    }}
                        className="hide-scroll-bar"
                        ref={colorScrollRef}
                        onMouseDown={(e) => startHorizontalDrag('colors', colorScrollRef, e)}
                        onMouseMove={(e) => moveHorizontalDrag('colors', colorScrollRef, e)}
                        onMouseUp={() => endHorizontalDrag('colors', colorScrollRef)}
                        onMouseLeave={() => endHorizontalDrag('colors', colorScrollRef)}
                    >
                        {Object.entries(COLOR_SCHEMES).map(([key, color]) => {
                            const isSelected = formData.colorScheme === key;
                            return (
                                <button
                                    key={key}
                                    type="button"
                                    onClick={() => setFormData({ ...formData, colorScheme: key })}
                                    style={{
                                        minWidth: '70px',
                                        height: '70px',
                                        borderRadius: '50%',
                                        background: color.gradient,
                                        border: isSelected ? '4px solid var(--text-main)' : '2px solid transparent',
                                        cursor: 'pointer',
                                        flexShrink: 0,
                                        position: 'relative',
                                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                        transform: isSelected ? 'scale(1.1)' : 'scale(1)',
                                        boxShadow: isSelected ? `0 8px 20px ${color.shadow}` : `0 4px 10px rgba(0,0,0,0.1)`
                                    }}
                                >
                                    {isSelected && (
                                        <div style={{
                                            position: 'absolute',
                                            top: '50%',
                                            left: '50%',
                                            transform: 'translate(-50%, -50%)',
                                            color: 'white',
                                            fontSize: '1.5rem',
                                            filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))'
                                        }}>
                                            <FaCheckCircle />
                                        </div>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                    {/* Inject a tiny bit of CSS to hide webkit scrollbars for this specific row */}
                    <style>{`.hide-scroll-bar::-webkit-scrollbar { display: none; }`}</style>
                </div>

                {/* Live template carousel — last section before submit (layout + motion + previews) */}
                <div className="form-group ui-form-surface" style={{ marginTop: '1.5rem', overflow: 'hidden' }}>
                    <label className="elegant-label" style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>{'\u{1F4D0}'}</span>
                        {t('invitation_card_layout', { defaultValue: 'Card layout' })}
                    </label>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '0 0 12px', lineHeight: 1.45 }}>
                        {t('invitation_layout_live_carousel_hint', {
                            defaultValue: 'Swipe or drag sideways to compare layouts. Your colors, font, and media apply to each preview — tap a card to select it.',
                        })}
                    </p>
                    <div className="form-group" style={{ marginTop: 0, marginBottom: '1rem' }}>
                        <label style={{ fontSize: '0.85rem', marginBottom: '6px', display: 'block' }}>
                            {t('cover_animation_label')}
                        </label>
                        <select
                            className="input-field"
                            value={normalizeCoverAnimationType(formData.coverAnimationType)}
                            onChange={(e) =>
                                setFormData((prev) => ({
                                    ...prev,
                                    coverAnimationType: normalizeCoverAnimationType(e.target.value),
                                }))
                            }
                        >
                            <option value="elegant-fade">{t('cover_animation_elegant_fade')}</option>
                            <option value="gentle-pulse">{t('cover_animation_gentle_pulse')}</option>
                            <option value="glide-up">{t('cover_animation_glide_up')}</option>
                            <option value="none">{t('cover_animation_none')}</option>
                        </select>
                    </div>
                    <div
                        ref={templateCarouselRef}
                        role="listbox"
                        aria-label={t('invitation_card_layout', { defaultValue: 'Card layout' })}
                        onScroll={onTemplateCarouselScroll}
                        onMouseDown={(e) => startHorizontalDrag('templateCarousel', templateCarouselRef, e)}
                        onMouseMove={(e) => moveHorizontalDrag('templateCarousel', templateCarouselRef, e)}
                        onMouseUp={() => endHorizontalDrag('templateCarousel', templateCarouselRef)}
                        onMouseLeave={() => endHorizontalDrag('templateCarousel', templateCarouselRef)}
                        style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            overflowX: 'auto',
                            scrollSnapType: 'x mandatory',
                            WebkitOverflowScrolling: 'touch',
                            gap: '12px',
                            padding: '4px 12px 12px',
                            margin: '0 -12px',
                            scrollbarWidth: 'none',
                            msOverflowStyle: 'none',
                            cursor: 'grab',
                        }}
                        className="hide-scroll-bar invitation-template-carousel"
                    >
                        {TEMPLATE_PICKER_KEYS.map((key) => {
                            const resolvedKey = LEGACY_PUBLIC_TEMPLATE_MAP[key] || key;
                            const tmpl = TEMPLATE_STYLES[resolvedKey] || TEMPLATE_STYLES.photoBottom;
                            const isSel = formData.templateType === key;
                            return (
                                <div
                                    key={key}
                                    role="option"
                                    aria-selected={isSel}
                                    data-template-slide="1"
                                    data-template-key={key}
                                    tabIndex={0}
                                    onClick={() => setFormData((prev) => ({ ...prev, templateType: key }))}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault();
                                            setFormData((prev) => ({ ...prev, templateType: key }));
                                        }
                                    }}
                                    style={{
                                        flex: '0 0 min(88vw, 380px)',
                                        scrollSnapAlign: 'center',
                                        cursor: 'pointer',
                                        outline: 'none',
                                    }}
                                >
                                    <div
                                        style={{
                                            borderRadius: '16px',
                                            overflow: 'hidden',
                                            border: isSel ? '3px solid var(--primary)' : '1px solid var(--border-color)',
                                            boxShadow: isSel
                                                ? '0 8px 28px rgba(139, 92, 246, 0.35)'
                                                : '0 4px 16px rgba(0,0,0,0.12)',
                                            background: 'var(--bg-card)',
                                            transition: 'border-color 0.2s, box-shadow 0.2s',
                                        }}
                                    >
                                        <div
                                            style={{
                                                width: '100%',
                                                overflow: 'hidden',
                                                position: 'relative',
                                                pointerEvents: 'none',
                                                touchAction: 'pan-y',
                                            }}
                                        >
                                            <InvitationCard
                                                invitation={{
                                                    ...previewInvitationBase,
                                                    templateType: key,
                                                }}
                                            />
                                        </div>
                                    </div>
                                    <div
                                        style={{
                                            textAlign: 'center',
                                            marginTop: '10px',
                                            fontSize: '0.75rem',
                                            fontWeight: 800,
                                            color: isSel ? 'var(--primary)' : 'var(--text-secondary)',
                                        }}
                                    >
                                        {t(`invitation_template_${key}`, { defaultValue: tmpl.name })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '12px 0 0', textAlign: 'center', lineHeight: 1.4 }}>
                        {t('public_invitation_guests_hint', { defaultValue: 'Public invitations appear in the feed; guests tap join on the card after you publish.' })}
                    </p>
                </div>

                <button type="submit" className="ui-btn ui-btn--primary" style={{ width: '100%', height: '60px', marginTop: '1rem', fontSize: '1.1rem' }} disabled={isSubmitting}>
                    {isSubmitting ? t('loading') : (editingInvitation ? (t('save_changes') || '💾 Save Changes') : (t('preview_invitation') || '📋 Preview Invitation'))}
                </button>
            </form>
        </div>
        </>
    );
};

export default CreateInvitation;
