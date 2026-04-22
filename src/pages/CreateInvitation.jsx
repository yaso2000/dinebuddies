import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FaCalendarAlt, FaMapMarkerAlt, FaUsers, FaImage, FaTimes, FaCheckCircle, FaClock, FaUserFriends, FaVenusMars, FaMoneyBillWave, FaLock, FaGlobe, FaPlus, FaCocktail, FaSearch } from 'react-icons/fa';
import { IoMale, IoFemale, IoMaleFemale, IoPeople } from 'react-icons/io5';
import { HiUserGroup, HiUser } from 'react-icons/hi2';
import { useInvitations } from '../context/InvitationContext';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import ImageUpload from '../components/ImageUpload';
import MediaSelector from '../components/Invitations/MediaSelector';
import VenueLocationPicker from '../components/VenueLocationPicker';
import { Country, State, City } from 'country-state-city';
import { uploadInvitationPhoto } from '../utils/imageUpload';
import { processInvitationMedia, uploadVideoWithThumbnail, uploadMedia, uploadGoogleImage } from '../services/mediaService';
import { deleteFilesAtFirebaseDownloadUrls } from '../utils/firebaseStorageDelete';
import { validateInvitationCreation } from '../utils/invitationValidation';
import { canCreateInvitation } from '../utils/cancellationPolicy';
import { doc, getDoc, updateDoc, serverTimestamp, deleteField, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config';
import { callSuggestInvitationMessages } from '../utils/callSuggestInvitationMessages';
import { detectUserLocationContext } from '../utils/locationUtils';
import { COLOR_SCHEMES, TEMPLATE_STYLES, LEGACY_PUBLIC_TEMPLATE_MAP, TEMPLATE_PICKER_KEYS } from '../utils/invitationTemplates';
import InvitationTemplateSwatch from '../components/InvitationTemplateSwatch';
import {
    defaultSmartBioOptions,
    buildInvitationAiPayload,
    invitationMessageMaxLength
} from '../utils/invitationSmartDescription';
import {
    normalizeHeadlineSuggestionsFromApi,
    padHeadlinesToTen
} from '../utils/invitationHeadlineSuggestions';

import { goToLogin } from '../utils/goToLogin';
import { resolveVenueCountryIso } from '../utils/countryIso';
const CreateInvitation = () => {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const location = useLocation();
    const { addInvitation, allUsers, currentUser } = useInvitations();
    const { showToast } = useToast();
    const { currentUser: authUser, userProfile } = useAuth(); // Get userProfile for guest check

    // Redirect guests to login immediately
    useEffect(() => {
        if (userProfile?.isGuest || userProfile?.role === 'guest' || currentUser?.id === 'guest') {
            goToLogin();
        }
    }, [userProfile, currentUser, navigate]);

    // UI State
    const [locationLoading, setLocationLoading] = useState(false);
    const [citySearchOpen, setCitySearchOpen] = useState(false);
    const [imageFile, setImageFile] = useState(null);
    const [mediaData, setMediaData] = useState(null); // NEW: For MediaSelector
    /** Single saved selfie / upload video (library). New recording blocked until this is deleted from Storage. */
    const [libraryVideo, setLibraryVideo] = useState(null);
    const [libraryImages, setLibraryImages] = useState([]);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isGeneratingBio, setIsGeneratingBio] = useState(false);
    const [smartBioOptions, setSmartBioOptions] = useState(() => defaultSmartBioOptions());
    const [smartSuggestionsOpen, setSmartSuggestionsOpen] = useState(false);
    const [smartSuggestionsLoading, setSmartSuggestionsLoading] = useState(false);
    const [smartSuggestions, setSmartSuggestions] = useState([]);
    /** True when AI returned nothing usable and built-in lines are shown (non-technical hint only). */
    const [headlineSuggestionsAreFallback, setHeadlineSuggestionsAreFallback] = useState(false);
    const [friendsLoading, setFriendsLoading] = useState(false);

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
    const templateScrollRef = useRef(null);
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
        type: restaurantData?.type || 'Restaurant',
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
        occasionType: editingInvitation?.occasionType || 'Social',
        colorScheme: editingInvitation?.colorScheme || prefilledData?.colorScheme || 'oceanBlue',
        templateType: editingInvitation?.templateType || prefilledData?.templateType || 'photoBottom',
        // Override with editingInvitation data if present
        ...(editingInvitation ? {
            ...editingInvitation,
            title: editingInvitation.title,
            description: String(editingInvitation.description || '').slice(0, invitationMessageMaxLength),
            date: editingInvitation.date,
            time: editingInvitation.time,
            guestsNeeded: editingInvitation.guestsNeeded,
            genderGroups: editingInvitation.genderGroups || ['male', 'female', 'unspecified'],
            ageGroups: editingInvitation.ageGroups || ['18-24', '25-34', '35-44', '45-54', '55+'],
            colorScheme: editingInvitation.colorScheme || 'oceanBlue',
            templateType: editingInvitation.templateType || 'photoBottom',
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
                            description: String(draft.description || '').slice(0, invitationMessageMaxLength)
                        });
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

    const ALLOWED_INVITATION_TYPES = ['Restaurant', 'Cafe', 'Bar', 'Night Club', 'Food Truck', 'Fast Food'];
    useEffect(() => {
        if (formData.type && !ALLOWED_INVITATION_TYPES.includes(formData.type)) {
            setFormData(prev => ({ ...prev, type: 'Restaurant' }));
        }
    }, [formData.type]);

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

    /** Loads 10 headline suggestions (AI + OpenAI when available); always shows 10 tappable lines with safe fallbacks. */
    const generateSmartBio = async () => {
        if (!authUser || currentUser?.id === 'guest') {
            showToast(t('login_to_create') || 'Please sign in', 'error');
            goToLogin();
            return;
        }
        setSmartSuggestionsOpen(true);
        setSmartSuggestionsLoading(true);
        setSmartSuggestions([]);
        setHeadlineSuggestionsAreFallback(false);
        setIsGeneratingBio(true);
        try {
            const payload = buildInvitationAiPayload(formData, {
                t,
                language: i18n.language,
                userProfile,
                currentUser,
                options: smartBioOptions
            });
            const result = await callSuggestInvitationMessages(payload);
            const normalized = normalizeHeadlineSuggestionsFromApi(result);
            const final = padHeadlinesToTen(normalized, formData);
            setSmartSuggestions(final);
            setHeadlineSuggestionsAreFallback(normalized.length === 0);
        } catch (err) {
            console.warn('[headline suggestions]', err?.code || err?.message || err);
            const final = padHeadlinesToTen([], formData);
            setSmartSuggestions(final);
            setHeadlineSuggestionsAreFallback(true);
        } finally {
            setSmartSuggestionsLoading(false);
            setIsGeneratingBio(false);
        }
    };

    const pickSmartSuggestion = (line) => {
        const text = String(line || '').slice(0, invitationMessageMaxLength);
        setFormData((prev) => ({ ...prev, description: text }));
        setSmartSuggestionsOpen(false);
        showToast(t('smart_bio_applied'), 'success');
    };

    const closeSmartSuggestions = () => {
        setSmartSuggestionsOpen(false);
        setHeadlineSuggestionsAreFallback(false);
    };

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
        setFormData(prev => ({
            ...prev,
            location: placeData.name,
            lat: placeData.lat,
            lng: placeData.lng,
            title: generateTitle(placeData.name) // Auto-generate title
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

    const today = new Date().toISOString().split('T')[0];

    return (
        <div className="page-container form-page">
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

                {/* 1. Location Search - FIRST STEP - Hidden when editing */}
                {!editingInvitation && (
                    <div className="ui-card venue-search-stack" style={{ marginBottom: '1rem' }}>
                        <h3 style={{ fontSize: '1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            📍 {t('search_venue') || 'Search for a Venue'}
                        </h3>



                        <div className="form-group" style={{ marginBottom: '1rem' }}>
                            <label style={{ fontSize: '0.9rem', marginBottom: '8px', display: 'block' }}>
                                {t('form_type_label')}
                            </label>
                            <select
                                name="type"
                                value={ALLOWED_INVITATION_TYPES.includes(formData.type) ? formData.type : 'Restaurant'}
                                onChange={handleChange}
                                className="input-field"
                            >
                                <option value="Restaurant">{t('type_restaurant')}</option>
                                <option value="Cafe">{t('type_cafe')}</option>
                                <option value="Bar">{t('type_bar', 'Bar')}</option>
                                <option value="Night Club">{t('type_nightclub', 'Night Club')}</option>
                                <option value="Food Truck">{t('type_foodtruck', 'Food Truck')}</option>
                                <option value="Fast Food">{t('type_fastfood', 'Fast Food')}</option>
                            </select>
                            <small style={{ color: 'var(--text-muted)', display: 'block', marginTop: '6px' }}>
                                {t('invitation_type_venue_search_hint', 'Choose the venue type first so search suggests matching places (café, bar, etc.).')}
                            </small>
                        </div>

                        {/* Venue Search */}
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
                    </div>
                )}

                {/* 2. Media Selection - SECOND STEP */}
                <div style={{
                    background: 'var(--card-bg)',
                    padding: '1rem', // Condensed padding
                    borderRadius: '16px',
                    border: '1px solid var(--border-color)',
                    marginBottom: '1rem' // Condensed margin
                }}>
                    <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        🎬 {t('form_media_label') || t('form_image_label')}
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
                    />
                    {uploadProgress > 0 && uploadProgress < 100 && (
                        <div style={{
                            marginTop: '12px',
                            background: 'var(--bg-card)',
                            borderRadius: '8px',
                            padding: '12px',
                            border: '1px solid var(--border-color)'
                        }}>
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                marginBottom: '8px',
                                fontSize: '0.85rem',
                                color: 'var(--text-secondary)'
                            }}>
                                <span>{t('processing')}</span>
                                <span>{uploadProgress}%</span>
                            </div>
                            <div style={{
                                width: '100%',
                                height: '6px',
                                background: 'var(--border-color)',
                                borderRadius: '3px',
                                overflow: 'hidden'
                            }}>
                                <div style={{
                                    width: `${uploadProgress}%`,
                                    height: '100%',
                                    background: 'linear-gradient(90deg, var(--primary), var(--accent))',
                                    transition: 'width 0.3s ease',
                                    borderRadius: '3px'
                                }} />
                            </div>
                        </div>
                    )}
                </div>

                {/* 3. Invitation Title */}
                <div className="form-group">
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


                <div className="form-group">
                    <label>{t('form_payment_label')}</label>
                    <select name="paymentType" value={formData.paymentType} onChange={handleChange} className="input-field">
                        <option value="Split">{t('payment_split')}</option>
                        <option value="Host Pays">{t('payment_host')}</option>
                    </select>
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

                {/* 4. Message Area (Moved to bottom) */}
                <div className="form-group">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <label style={{ marginBottom: 0 }}>{t('form_message_label', 'Message')}</label>
                            <button 
                                type="button" 
                                onClick={generateSmartBio}
                                disabled={isGeneratingBio || isSubmitting}
                                style={{
                                    background: 'linear-gradient(135deg, #a855f7, #ec4899)',
                                    color: 'white',
                                    border: 'none',
                                    padding: '4px 10px',
                                    borderRadius: '8px',
                                    fontSize: '0.8rem',
                                    fontWeight: 'bold',
                                    cursor: (isGeneratingBio || isSubmitting) ? 'wait' : 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '5px',
                                    opacity: (isGeneratingBio || isSubmitting) ? 0.7 : 1,
                                    boxShadow: '0 2px 4px rgba(236, 72, 153, 0.3)'
                                }}
                            >
                                ✨ {isGeneratingBio ? t('generating') : t('smart_bio')}
                            </button>
                        </div>
                        <span style={{ fontSize: '0.75rem', color: (formData.description?.length || 0) >= invitationMessageMaxLength ? '#f87171' : 'var(--text-muted)' }}>
                            {(formData.description?.length || 0)}/{invitationMessageMaxLength}
                        </span>
                    </div>
                    <details style={{ marginBottom: '10px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        <summary style={{ cursor: 'pointer', userSelect: 'none' }}>
                            {t('smart_bio_options')}
                        </summary>
                        <div
                            style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fill, minmax(148px, 1fr))',
                                gap: '6px 12px',
                                marginTop: '10px',
                                padding: '10px',
                                background: 'var(--hover-overlay, rgba(128, 128, 128, 0.08))',
                                borderRadius: '8px',
                                alignItems: 'center'
                            }}
                        >
                            {[
                                ['includeCity', 'smart_bio_include_city'],
                                ['includeDateTime', 'smart_bio_include_datetime'],
                                ['includeVenueType', 'smart_bio_include_venue_type'],
                                ['includeGender', 'smart_bio_include_gender'],
                                ['includeAge', 'smart_bio_include_age'],
                                ['includeGuests', 'smart_bio_include_guests'],
                                ['includePayment', 'smart_bio_include_payment'],
                                ['includeTitle', 'smart_bio_include_title']
                            ].map(([key, labelKey]) => (
                                <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                                    <input
                                        type="checkbox"
                                        checked={!!smartBioOptions[key]}
                                        onChange={(e) =>
                                            setSmartBioOptions((prev) => ({ ...prev, [key]: e.target.checked }))
                                        }
                                    />
                                    <span>{t(labelKey)}</span>
                                </label>
                            ))}
                            <div style={{ gridColumn: '1 / -1', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px', marginTop: '4px' }}>
                                <span style={{ fontWeight: 600 }}>{t('smart_bio_format')}</span>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                                    <input
                                        type="radio"
                                        name="smartBioFormat"
                                        checked={smartBioOptions.format === 'sentence'}
                                        onChange={() => setSmartBioOptions((prev) => ({ ...prev, format: 'sentence' }))}
                                    />
                                    {t('smart_bio_format_sentence')}
                                </label>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                                    <input
                                        type="radio"
                                        name="smartBioFormat"
                                        checked={smartBioOptions.format === 'lines'}
                                        onChange={() => setSmartBioOptions((prev) => ({ ...prev, format: 'lines' }))}
                                    />
                                    {t('smart_bio_format_lines')}
                                </label>
                            </div>
                        </div>
                        <p style={{ margin: '8px 0 0', fontSize: '0.72rem', opacity: 0.9, lineHeight: 1.4 }}>
                            {t('smart_bio_disclaimer_ai')}
                        </p>
                    </details>
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

                {/* Privacy Settings */}
                <div className="form-group ui-form-surface" style={{ marginTop: '1.5rem' }}>
                    <label className="elegant-label" style={{ marginBottom: '1rem' }}>
                        <span className="label-icon"><FaLock /></span>
                        {t('privacy_settings') || 'Privacy Settings'}
                    </label>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                        {['public', 'followers'].map(mode => (
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
                                    transition: 'all 0.2s'
                                }}
                            >
                                {/* Icons */}
                                {mode === 'public' && <FaGlobe style={{ fontSize: '1.4rem', color: formData.privacy === mode ? 'var(--primary)' : 'var(--text-muted)' }} />}
                                {mode === 'followers' && <FaUserFriends style={{ fontSize: '1.4rem', color: formData.privacy === mode ? 'var(--primary)' : 'var(--text-muted)' }} />}

                                <span style={{ fontSize: '0.75rem', fontWeight: '700' }}>
                                    {mode === 'public' ? (t('public') || 'Public') : (t('followers_only') || 'Followers')}
                                </span>
                            </button>
                        ))}
                    </div>
                </div >

                {/* Card layout templates — above colors */}
                <div className="form-group ui-form-surface" style={{ marginTop: '1.5rem', overflow: 'hidden' }}>
                    <label className="elegant-label" style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>{'\u{1F4D0}'}</span>
                        {t('invitation_card_layout', { defaultValue: 'Card layout' })}
                    </label>
                    <div style={{
                        display: 'flex',
                        overflowX: 'auto',
                        gap: '10px',
                        padding: '10px 4px',
                        scrollbarWidth: 'none',
                        msOverflowStyle: 'none',
                        cursor: 'grab',
                    }}
                        className="hide-scroll-bar"
                        ref={templateScrollRef}
                        onMouseDown={(e) => startHorizontalDrag('templates', templateScrollRef, e)}
                        onMouseMove={(e) => moveHorizontalDrag('templates', templateScrollRef, e)}
                        onMouseUp={() => endHorizontalDrag('templates', templateScrollRef)}
                        onMouseLeave={() => endHorizontalDrag('templates', templateScrollRef)}
                    >
                        {TEMPLATE_PICKER_KEYS.map((key) => {
                            const resolvedKey = LEGACY_PUBLIC_TEMPLATE_MAP[key] || key;
                            const tmpl = TEMPLATE_STYLES[resolvedKey] || TEMPLATE_STYLES.photoBottom;
                            const isSel = formData.templateType === key;
                            const scheme = COLOR_SCHEMES[formData.colorScheme] || COLOR_SCHEMES.sunsetOrange;
                            return (
                                <button
                                    key={key}
                                    type="button"
                                    onClick={() => setFormData({ ...formData, templateType: key })}
                                    style={{
                                        minWidth: '118px',
                                        maxWidth: '148px',
                                        flex: '0 0 auto',
                                        padding: '10px 10px 12px',
                                        borderRadius: '14px',
                                        border: isSel ? '3px solid var(--primary)' : '1px solid var(--border-color)',
                                        background: isSel ? 'color-mix(in srgb, var(--primary) 18%, var(--bg-card))' : 'var(--bg-card)',
                                        color: 'var(--text-main)',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        gap: '8px',
                                        transition: 'all 0.2s',
                                        boxShadow: isSel ? '0 6px 18px rgba(0,0,0,0.12)' : 'none',
                                    }}
                                >
                                    <InvitationTemplateSwatch templateKey={key} accentGradient={scheme.gradient} />
                                    <span style={{ fontSize: '0.72rem', fontWeight: 800, textAlign: 'center', lineHeight: 1.25 }}>
                                        {t(`invitation_template_${key}`, { defaultValue: tmpl.name })}
                                    </span>
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

                <button type="submit" className="ui-btn ui-btn--primary" style={{ width: '100%', height: '60px', marginTop: '1rem', fontSize: '1.1rem' }} disabled={isSubmitting}>
                    {isSubmitting ? t('loading') : (editingInvitation ? (t('save_changes') || '💾 Save Changes') : (t('preview_invitation') || '📋 Preview Invitation'))}
                </button>
            </form>

            {smartSuggestionsOpen && (
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="smart-suggestions-title"
                    onClick={closeSmartSuggestions}
                    style={{
                        position: 'fixed',
                        inset: 0,
                        zIndex: 10050,
                        background: 'rgba(0,0,0,0.55)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '16px',
                        boxSizing: 'border-box'
                    }}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        dir="auto"
                        style={{
                            width: '100%',
                            maxWidth: '420px',
                            maxHeight: 'min(85vh, 560px)',
                            overflow: 'hidden',
                            display: 'flex',
                            flexDirection: 'column',
                            background: 'var(--bg-card, #1a1a24)',
                            color: 'var(--text-main)',
                            borderRadius: '16px',
                            border: '1px solid var(--border-color, rgba(255,255,255,0.12))',
                            boxShadow: '0 20px 50px rgba(0,0,0,0.45)'
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', padding: '16px 16px 8px' }}>
                            <div>
                                <h2 id="smart-suggestions-title" style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800 }}>
                                    {t('smart_bio_suggestions_title')}
                                </h2>
                                <p style={{ margin: '6px 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                    {t('smart_bio_suggestions_hint')}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={closeSmartSuggestions}
                                aria-label={t('close')}
                                style={{
                                    flexShrink: 0,
                                    border: 'none',
                                    background: 'transparent',
                                    color: 'var(--text-muted)',
                                    cursor: 'pointer',
                                    padding: '6px',
                                    borderRadius: '8px'
                                }}
                            >
                                <FaTimes size={18} />
                            </button>
                        </div>
                        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px 16px' }}>
                            {smartSuggestionsLoading && (
                                <p style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                                    {t('smart_bio_suggestions_loading')}
                                </p>
                            )}
                            {!smartSuggestionsLoading && headlineSuggestionsAreFallback && smartSuggestions.length > 0 && (
                                <p style={{ textAlign: 'center', padding: '0 8px 12px', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                                    {t('smart_bio_suggestions_fallback_hint', { defaultValue: 'Built-in suggestions — pick one to get started.' })}
                                </p>
                            )}
                            {!smartSuggestionsLoading && smartSuggestions.map((line, idx) => (
                                <button
                                    key={`${idx}-${line.slice(0, 24)}`}
                                    type="button"
                                    onClick={() => pickSmartSuggestion(line)}
                                    style={{
                                        display: 'block',
                                        width: '100%',
                                        textAlign: 'start',
                                        marginBottom: '8px',
                                        padding: '12px 14px',
                                        borderRadius: '12px',
                                        border: '1px solid var(--border-color)',
                                        background: 'var(--bg-elevated, rgba(255,255,255,0.04))',
                                        color: 'var(--text-main)',
                                        cursor: 'pointer',
                                        fontSize: '0.9rem',
                                        lineHeight: 1.35
                                    }}
                                >
                                    <span style={{ opacity: 0.55, marginInlineEnd: '8px', fontWeight: 700 }}>{idx + 1}.</span>
                                    {line}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
};

export default CreateInvitation;
