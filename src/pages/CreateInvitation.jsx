import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FaCalendarAlt, FaMapMarkerAlt, FaCheckCircle, FaClock, FaUserFriends, FaVenusMars, FaMoneyBillWave, FaLock, FaGlobe } from 'react-icons/fa';
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
import { notifyImageUploadError } from '../utils/imageModerationErrors';
import { deleteFilesAtFirebaseDownloadUrls } from '../utils/firebaseStorageDelete';
import { validateInvitationCreation } from '../utils/invitationValidation';
import { canCreateInvitation } from '../utils/cancellationPolicy';
import { doc, getDoc, updateDoc, serverTimestamp, deleteField } from 'firebase/firestore';
import { db } from '../firebase/config';
import { detectLiveUserGps, geocode } from '../utils/locationUtils';
import { resolveVenueCoordinates } from '../utils/invitationCoords';
import { validatePublicInvitationCreate, invitationErrorI18nKey } from '../utils/invitationRules';
import { extractCityTokenFromAddress } from '../utils/locationUtils';
import { TEMPLATE_STYLES, LEGACY_PUBLIC_TEMPLATE_MAP, TEMPLATE_PICKER_KEYS, normalizePublicCardTemplateKey } from '../utils/invitationTemplates';
import { PUBLIC_VENUE_CATEGORIES } from '../constants/publicVenueCategories';
import {
  PUBLIC_VENUE_TYPES,
  migrateLegacyOccasionToInviteMood,
  normalizePublicVenueType,
  publicVenueTypeI18nKey } from
'../utils/publicInvitationVibes';
import InvitationCard from '../components/InvitationCard';
import './CreateInvitation.css';
import PublicInviteCardStyleStudio from '../components/Invitations/publicCard/PublicInviteCardStyleStudio';
import { invitationMessageMaxLength } from '../utils/invitationSmartDescription';
import AIFloatingLauncher from '../components/AIFloatingLauncher';
import { extractAIContentFields } from '../utils/aiContentFieldMapper';
import { buildPublicInvitationAiUserPrompt } from '../utils/aiPromptLocale';
import { parseAiStudioImageFromState } from '../utils/aiStudioImagePayload';
import { useDragScrollRail } from '../hooks/useDragScrollRail';

import { goToLogin } from '../utils/goToLogin';
import { resolveVenueCountryIso } from '../utils/countryIso';
import { AppText, AppTextInput } from "../components/base";

const MAX_PUBLIC_GUESTS = 10;

const CreateInvitation = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { addInvitation, currentUser, restaurants } = useInvitations();
  const { showToast } = useToast();
  const { currentUser: authUser, userProfile, updateUserProfile } = useAuth(); // Get userProfile for guest check

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

  const [restrictionInfo, setRestrictionInfo] = useState(null); // Cancellation restriction info
  /** Creator GPS — isolated from venue form fields (never use formData.city for display). */
  const [liveUserGps, setLiveUserGps] = useState({
    status: 'pending',
    city: '',
    lat: null,
    lng: null,
    countryCode: ''
  });
  const gpsRunIdRef = useRef(0);

  const refreshLiveUserGps = useCallback(async () => {
    const runId = ++gpsRunIdRef.current;
    setLiveUserGps((prev) => {
      if (prev.status === 'ready' && prev.lat != null && prev.lng != null) {
        return prev;
      }
      return { ...prev, status: 'pending' };
    });

    const detected = await detectLiveUserGps();
    if (runId !== gpsRunIdRef.current) return detected;

    if (!detected.success) {
      setLiveUserGps((prev) => ({
        status: detected.code === 'denied' ? 'denied' : 'unavailable',
        city: prev.lat != null ? prev.city : '',
        lat: prev.lat,
        lng: prev.lng,
        countryCode: prev.countryCode || ''
      }));
      return detected;
    }

    setLiveUserGps({
      status: 'ready',
      city: detected.city || '',
      lat: detected.latitude,
      lng: detected.longitude,
      countryCode: detected.countryCode || ''
    });
    return detected;
  }, []);

  const restaurantData = location.state?.restaurantData || location.state?.selectedRestaurant;
  const prefilledData = location.state?.prefilledData; // From BusinessProfile
  const offerData = location.state?.offerData; // From Special Offer
  const fromRestaurant = location.state?.fromRestaurant || !!restaurantData;
  const editingDraft = location.state?.editingDraft; // Editing draft from preview
  const draftId = location.state?.draftId; // Draft ID to load
  const editingInvitation = location.state?.editingInvitation; // Editing PUBLISHED invitation
  const editVideoHydratedRef = useRef(null);
  const mediaLibraryHydratedRef = useRef(false);
  const templateCarouselScrollTimerRef = useRef(null);
  const {
    railRef: templateCarouselRef,
    onPointerDown: onTemplateCarouselDown,
    onPointerMove: onTemplateCarouselMove,
    onPointerUp: onTemplateCarouselUp,
    onPointerCancel: onTemplateCarouselCancel,
    wasDragged: templateCarouselWasDragged
  } = useDragScrollRail();

  const mediaLibraryStorageKey = React.useMemo(() => {
    const userId = currentUser?.id || authUser?.uid;
    return userId ? `db_invitation_media_library_${userId}` : null;
  }, [currentUser?.id, authUser?.uid]);

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
      video: libraryVideo || null
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
      thumbnailUrl: editingInvitation.videoThumbnail || editingInvitation.customVideo
    });
    setMediaData({
      source: 'custom_video',
      type: 'video',
      file: null,
      preview: editingInvitation.customVideo,
      videoThumbnail: editingInvitation.videoThumbnail || null,
      fromLibrary: true
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
      fromLibrary: true
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
            fromLibrary: true
          });
          return;
        }
      } catch (e) {
        console.warn('Could not persist venue image immediately:', e);
      }
    }
    setMediaData(data);
  }, [currentUser?.id, authUser?.uid]);

  const aiStudioAppliedRef = useRef(false);
  useEffect(() => {
    const studio = parseAiStudioImageFromState(location.state?.aiStudioImage);
    if (!studio || aiStudioAppliedRef.current) return;
    aiStudioAppliedRef.current = true;
    handleMediaSelect({
      source: 'custom_image',
      type: 'image',
      file: null,
      url: studio.publishedUrl,
      preview: studio.publishedUrl,
      publishedUrl: studio.publishedUrl,
      fromLibrary: true
    });
  }, [location.state?.aiStudioImage, handleMediaSelect]);

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
    title: offerData?.title ?
    offerData.title :
    restaurantData ?
    `${t('dinner_at')} ${restaurantData.name}` :
    prefilledData?.restaurantName ?
    `${t('dinner_at')} ${prefilledData.restaurantName}` :
    '',
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
      editingInvitation?.templateType || prefilledData?.templateType || 'hero_4_5'
    ),
    cardFontFamily: editingInvitation?.cardFontFamily || '',
    // Override with editingInvitation data if present
    ...(editingInvitation ? {
      ...editingInvitation,
      occasionType: undefined,
      title: editingInvitation.title,
      description: String(editingInvitation.description || '').slice(0, invitationMessageMaxLength),
      date: editingInvitation.date,
      time: editingInvitation.time,
      guestsNeeded: Math.min(
        MAX_PUBLIC_GUESTS,
        Math.max(1, Number(editingInvitation.guestsNeeded) || 3)
      ),
      genderGroups: editingInvitation.genderGroups || ['male', 'female', 'unspecified'],
      ageGroups: editingInvitation.ageGroups || ['18-24', '25-34', '35-44', '45-54', '55+'],
      colorScheme: editingInvitation.colorScheme || 'oceanBlue',
      templateType: normalizePublicCardTemplateKey(editingInvitation.templateType || 'hero_4_5'),
      cardFontFamily: editingInvitation.cardFontFamily || '',
      inviteMood:
      editingInvitation.inviteMood ||
      migrateLegacyOccasionToInviteMood(editingInvitation.occasionType),
      type: normalizePublicVenueType(editingInvitation.type),
      image: editingInvitation.image, // Keep existing image URL
      location: editingInvitation.location,
      lat: editingInvitation.lat,
      lng: editingInvitation.lng,
      city: editingInvitation.city,
      country: editingInvitation.country
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
              inviteMood:
              draft.inviteMood || migrateLegacyOccasionToInviteMood(draft.occasionType),
              type: normalizePublicVenueType(draft.type),
              templateType: normalizePublicCardTemplateKey(draft.templateType)
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
      setFormData((prev) => ({
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

  // Handle image selection
  const handleImageSelect = (file) => {
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = () => {
      setFormData((prev) => ({ ...prev, image: reader.result }));
    };
    reader.readAsDataURL(file);
  };

  // Remove image
  const handleRemoveImage = () => {
    setFormData((prev) => ({ ...prev, image: null }));
    setImageFile(null);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handlePreview = async (e, templateKeyOverride) => {
    if (e?.preventDefault) e.preventDefault();
    const templateType = templateKeyOverride || formData.templateType;
    if (templateKeyOverride && templateKeyOverride !== formData.templateType) {
      setFormData((prev) => ({ ...prev, templateType: templateKeyOverride }));
    }
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

    const liveGps = await refreshLiveUserGps();
    if (!liveGps.success) {
      showToast(t('location_not_determined'), 'error');
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

    const isUpdate = editingDraft && draftId || editingInvitation;
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
            const isUpdate = editingDraft && draftId || editingInvitation;

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
          notifyImageUploadError(showToast, mediaError, t, 'media_upload_failed');
          setMediaData(null);
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
        Object.keys(newObj).forEach((key) => {
          if (newObj[key] === undefined) {
            delete newObj[key];
          } else if (newObj[key] !== null && typeof newObj[key] === 'object' && !Array.isArray(newObj[key]) && typeof newObj[key].toDate !== 'function' && typeof newObj[key].isEqual !== 'function') {
            // Skip FieldValue instances (which have isEqual method)
            newObj[key] = stripUndefined(newObj[key]);
          }
        });
        return newObj;
      };

      let draftData = await applyVenueCoordinates({
        ...formData,
        templateType,
        ...mediaFields, // Merge media fields
        isFollowersOnly: formData.privacy === 'followers',
        status: 'draft' // Mark as draft
      });

      draftData = stripUndefined(draftData);
      delete draftData.coverAnimationType;

      draftData.userCity = liveGps.city || '';
      draftData.userLat = liveGps.latitude;
      draftData.userLng = liveGps.longitude;
      draftData.userCountryCode = liveGps.countryCode || draftData.countryCode || formData.countryCode || '';

      if (draftData.restaurantId && Array.isArray(restaurants)) {
        const venue = restaurants.find((r) => r.id === draftData.restaurantId);
        if (venue) {
          if (venue.lat != null && draftData.lat == null) draftData.lat = venue.lat;
          if (venue.lng != null && draftData.lng == null) draftData.lng = venue.lng;
          draftData.restaurantCity =
          draftData.restaurantCity ||
          draftData.city ||
          venue.city ||
          extractCityTokenFromAddress(venue.address || venue.location) ||
          '';
        }
      }

      // Remove old image field if exists
      if (draftData.image) {
        delete draftData.image;
      }

      console.log('📝 Creating draft with data:', draftData);

      let finalDraftId;

      if (editingDraft && draftId) {
        // Update existing draft
        console.log('🔄 Updating existing draft:', draftId);
        const ruleBlock = validatePublicInvitationCreate({
          creatorProfile: userProfile,
          creatorCoords: {
            lat: liveGps.latitude,
            lng: liveGps.longitude
          },
          venueCoords: { lat: draftData.lat, lng: draftData.lng },
          creatorCountryCode: liveGps.countryCode,
          venueCountryCode: draftData.countryCode
        });
        if (ruleBlock) {
          showToast(t(invitationErrorI18nKey(ruleBlock.code), ruleBlock.message), 'error');
          return;
        }
        const invitationRef = doc(db, 'invitations', draftId);
        await updateDoc(invitationRef, {
          ...draftData,
          userCity: draftData.userCity || null,
          userLat: draftData.userLat ?? null,
          userLng: draftData.userLng ?? null,
          restaurantCity: draftData.restaurantCity || draftData.city || null,
          coverAnimationType: deleteField()
        });
        finalDraftId = draftId;
      } else {
        // Create new draft
        console.log('➕ Creating new draft...');
        finalDraftId = await addInvitation(draftData);
        console.log('✅ Draft created with ID:', finalDraftId);
      }

      const draftIdResult =
      typeof finalDraftId === 'object' && finalDraftId?.ok === true ?
      finalDraftId.id :
      typeof finalDraftId === 'string' ?
      finalDraftId :
      null;

      if (draftIdResult) {
        console.log('🚀 Navigating to preview:', `/invitation/preview/${draftIdResult}`);
        navigate(`/invitation/preview/${draftIdResult}`);
      } else if (typeof finalDraftId === 'object' && finalDraftId?.ok === false) {
        // Rule errors already toasted in InvitationContext — avoid false business-account mapping.
        if (
        finalDraftId.code !== 'business-accounts-cannot-create-invitations' &&
        finalDraftId.code !== 'public-invite-must-be-local' &&
        finalDraftId.code !== 'location-not-determined')
        {
          showToast(t('failed_save_draft', 'Could not save draft. Try again.'), 'error');
        }
      } else {
        showToast(t('failed_save_draft', 'Could not save draft. Try again.'), 'error');
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
        const confirmMessage = i18n.language === 'ar' ?
        `${validation.error}\n\n${t('go_to_current_invitation')}` :
        `${validation.error}\n\nDo you want to go to your current invitation?`;

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
          notifyImageUploadError(showToast, mediaError, t, 'media_upload_failed');
          setMediaData(null);
          setIsSubmitting(false);
          setUploadProgress(0);
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
          mediaSource: deleteField()
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
        Object.keys(newObj).forEach((key) => {
          if (newObj[key] === undefined) {
            delete newObj[key];
          } else if (newObj[key] !== null && typeof newObj[key] === 'object' && !Array.isArray(newObj[key]) && typeof newObj[key].toDate !== 'function' && typeof newObj[key].isEqual !== 'function') {
            newObj[key] = stripUndefined(newObj[key]);
          }
        });
        return newObj;
      };

      let cleanData = await applyVenueCoordinates({
        ...formData,
        ...mediaFields, // Merge new media fields
        templateType: normalizePublicCardTemplateKey(formData.templateType),
        image: finalImageUrl !== undefined ? finalImageUrl : null, // Ensure backward compatibility for views using 'image'
        isFollowersOnly: formData.privacy === 'followers'
      });

      cleanData = stripUndefined(cleanData);
      delete cleanData.coverAnimationType;

      // Remove purely UI fields if strictly necessary, but Firestore ignores undefined usually.
      // If mediaFields provided a video, ensure we don't accidentally keep old image as primary if unnecessary
      if (mediaFields.mediaType === 'video') {



        // If video, maybe clear image field if it was a photo? 
        // But usually we need a thumbnail. processInvitationMedia returns thumbnail in restaurantImage or similar? 
        // Let's rely on mediaFields return values.
      }if (editingInvitation) {console.log('📝 Upprivate invite:', editingInvitation.id);
        const invitationRef = doc(db, 'invitations', editingInvitation.id);

        await updateDoc(invitationRef, { ...cleanData, coverAnimationType: deleteField() });
        console.log('✅ Invitation updated');
        showToast(t('invitation_updated', { defaultValue: 'Invitation updated successfully' }), 'success');
        navigate(`/invitation/${editingInvitation.id}`);
      } else {
        // This path is usually handled by handlePreview -> Draft -> Publish, but logic remains
        console.log('📝 Creating invitation via direct submit...');
        const createResult = await addInvitation(cleanData);
        const newId =
        typeof createResult === 'object' && createResult?.ok === true ?
        createResult.id :
        typeof createResult === 'string' ?
        createResult :
        null;
        if (newId) {
          navigate(`/invitation/${newId}`);
        }
      }
    } catch (error) {
      console.error('❌ Error creating/upprivate invite:', error);
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

  const applyVenueCoordinates = async (data) => {
    const resolved = await resolveVenueCoordinates({
      lat: data.lat,
      lng: data.lng,
      location: data.location,
      city: data.city,
      country: data.country
    });
    const next = { ...data };
    if (resolved.lat != null && resolved.lng != null) {
      next.lat = resolved.lat;
      next.lng = resolved.lng;
    } else {
      delete next.lat;
      delete next.lng;
    }
    return next;
  };

  const handleLocationSelect = async (placeData) => {
    const name = placeData.name || placeData.fullAddress || '';
    const address = placeData.fullAddress || name;
    const isDbVenue = !!(placeData.restaurantId || placeData.isDineBuddiesVenue);
    let lat = placeData.lat ?? null;
    let lng = placeData.lng ?? null;

    if ((lat == null || lng == null) && address) {
      const geoQuery = [address, placeData.city, placeData.country].filter(Boolean).join(', ');
      const geo = await geocode(geoQuery);
      if (geo.success && geo.results?.[0]) {
        lat = geo.results[0].lat;
        lng = geo.results[0].lng;
      }
    }

    setFormData((prev) => {
      const venueCity =
      placeData.city ||
      extractCityTokenFromAddress(placeData.fullAddress || address) ||
      prev.city;
      return {
        ...prev,
        location: address || name || prev.location,
        lat: lat ?? prev.lat,
        lng: lng ?? prev.lng,
        city: venueCity,
        restaurantCity: venueCity,
        country: placeData.country || prev.country,
        countryCode: placeData.countryCode || prev.countryCode,
        restaurantId: isDbVenue ? placeData.restaurantId || prev.restaurantId : null,
        restaurantName: isDbVenue ? (placeData.restaurantName || name || '').trim() : '',
        placeId: placeData.placeId || prev.placeId || null,
        title: generateTitle(name || address || 'Venue'),
        ...(isDbVenue ? { isDineBuddiesVenue: true } : {}),
        ...(isDbVenue && placeData.image ? { image: placeData.image } : {}),
        ...(placeData.matchedFromGoogle ? { venueMatchedFromGoogle: true } : {})
      };
    });
  };

  // Live GPS for creator position — single detect on mount (deduped in refreshLiveUserGps).
  useEffect(() => {
    if (restaurantData) return;

    let active = true;

    (async () => {
      const detected = await refreshLiveUserGps();
      if (!active || !detected?.success) return;

      if (detected.city && authUser?.uid && userProfile?.city !== detected.city) {
        updateUserProfile({
          city: detected.city,
          country: detected.country || userProfile?.country || '',
          countryCode: detected.countryCode || userProfile?.countryCode || '',
          coordinates: { lat: detected.latitude, lng: detected.longitude }
        }).catch(() => {});
      }
    })();

    return () => {
      active = false;
    };
    // Intentionally once per page entry — refreshLiveUserGps dedupes concurrent calls.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantData]);

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

  const invitationAiContext = useMemo(() => {
    const venueType = PUBLIC_VENUE_TYPES.includes(formData.type) ?
    t(publicVenueTypeI18nKey(formData.type), formData.type) :
    '';
    const venueName = (formData.restaurantName || formData.location || '').trim();
    return { venueType, venueName };
  }, [formData.type, formData.restaurantName, formData.location, t]);

  const buildInvitationAiPrompt = useCallback(
    () => buildPublicInvitationAiUserPrompt(formData),
    [formData]
  );

  const handleInvitationAiContent = useCallback(
    (data) => {
      const fields = extractAIContentFields('invitation', data);
      setFormData((prev) => {
        const next = { ...prev };
        if (fields.title) {
          next.title = fields.title;
        }
        if (fields.description) {
          next.description = fields.description.slice(0, invitationMessageMaxLength);
        }
        return next;
      });
    },
    []
  );

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

  /** Shared invitation payload for live template carousel (templateType set per slide). */
  const previewInvitationBase = useMemo(() => {
    const heroUrl = previewHeroUrl;
    const useVideo = mediaData?.type === 'video';

    return {
      id: '__create_preview__',
      author: {
        id: currentUser?.id || authUser?.uid || 'preview',
        name: previewHostName
      },
      title: formData.title || '\u00A0',
      type: formData.type,
      location: formData.location || '',
      paymentType: formData.paymentType,
      guestsNeeded: formData.guestsNeeded,
      joined: [],
      requests: [],
      date: formData.date,
      time: formData.time,
      description: (formData.description || '').slice(0, invitationMessageMaxLength),
      genderPreference: formData.genderPreference,
      genderGroups: formData.genderGroups,
      ageGroups: formData.ageGroups,
      ageRange: formData.ageRange,
      image: heroUrl,
      mediaType: useVideo ? 'video' : 'image',
      customVideo: useVideo ? mediaData.preview || mediaData.url || null : undefined,
      videoThumbnail: useVideo ? mediaData.videoThumbnail || mediaData.preview : undefined,
      customImage: !useVideo && heroUrl ? heroUrl : undefined,
      restaurantImage:
      mediaData?.source === 'restaurant' || mediaData?.source === 'google_place' ? previewHeroUrl : undefined,
      mediaSource: mediaData?.source,
      inviteMood: formData.inviteMood,
      colorScheme: formData.colorScheme,
      cardFontFamily: formData.cardFontFamily || undefined
    };
  }, [
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
  mediaData,
  previewHeroUrl,
  previewHostName,
  currentUser?.id,
  authUser?.uid]
  );

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
    setFormData((prev) => prev.templateType === bestKey ? prev : { ...prev, templateType: bestKey });
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

  return (
    <>
        <div className="page-container form-page create-public-invitation">
            <AppText as="h2" style={{ marginBottom: '1rem', fontSize: '1.5rem', fontWeight: '900' }}>
                {editingInvitation ? t('edit_invitation', { defaultValue: 'Edit Invitation' }) : t('create_invitation_title')}
            </AppText>

            {/* Restriction Warning Banner — page-specific red theme preserved */}
            {restrictionInfo && !restrictionInfo.canCreate &&
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
                            <AppText as="span">⏰</AppText>
                            <AppText as="span">{t('restriction_info', { days: restrictionInfo.daysLeft })}</AppText>
                        </div>
                    </div>
                </div>
        }

            {fromRestaurant && restaurantData &&
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
        }

            {/* Show prefilled venue from PartnerProfile */}
            {!fromRestaurant && prefilledData?.restaurantName &&
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
        }

            {/* Show Locked Venue when Editing (Title/Location cannot change) */}
            {editingInvitation &&
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
                        {formData.city &&
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                {formData.city}
                            </div>
            }
                    </div>
                    <div style={{ fontSize: '1.2rem', color: 'var(--text-muted)', opacity: 0.5 }}>
                        <FaLock />
                    </div>
                </div>
        }

            <form
          onSubmit={(e) => {
            e.preventDefault();
            if (editingInvitation) handleSubmit(e);
          }}
          className="create-form">


                {!editingInvitation &&
          <div className="ui-card venue-search-stack" style={{ marginBottom: '1rem', padding: '1rem', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
                        <AppText as="h3" style={{ fontSize: '1.05rem', marginBottom: '0.35rem', fontWeight: 800 }}>
                            {t('create_section_venue_location', { defaultValue: 'Venue & location' })}
                        </AppText>
                        <AppText as="p" style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '0.85rem' }}>
                            {t('create_section_venue_location_hint', {
                defaultValue: 'Pick a place and venue category — this drives the hero background and venue image options.'
              })}
                        </AppText>
                        <AppText as="h4" style={{ fontSize: '0.95rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700 }}>
                            📍 {t('search_venue') || 'Search for a Venue'}
                        </AppText>

                        <div className="form-group public-invite-prefs" style={{ marginBottom: '1rem' }}>
                            <label style={{ fontSize: '0.9rem', marginBottom: '8px', display: 'block' }}>
                                {t('venue_category_label', { defaultValue: 'Venue category' })}
                            </label>
                            <div
                className="public-invite-pref-grid public-invite-pref-grid--venue"
                role="radiogroup"
                aria-label={t('venue_category_label', { defaultValue: 'Venue category' })}>

                                {PUBLIC_VENUE_CATEGORIES.map(({ type, Icon }) => {
                  const selected =
                  (PUBLIC_VENUE_TYPES.includes(formData.type) ? formData.type : 'Restaurant') ===
                  type;
                  return (
                    <button
                      key={type}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      className={`public-invite-pref-chip public-invite-pref-chip--venue${selected ? ' is-selected' : ''}`}
                      onClick={() => setFormData((prev) => ({ ...prev, type }))}>

                                            {selected ?
                      <AppText as="span" className="public-invite-pref-chip__check" aria-hidden>
                                                    <FaCheckCircle />
                                                </AppText> :
                      null}
                                            <Icon
                        className="public-invite-pref-chip__icon public-invite-pref-chip__icon--venue"
                        aria-hidden />

                                            <AppText as="span" className="public-invite-pref-chip__label">
                                                {t(publicVenueTypeI18nKey(type), { defaultValue: type })}
                                            </AppText>
                                        </button>);

                })}
                            </div>
                            <small style={{ color: 'var(--text-muted)', display: 'block', marginTop: '6px' }}>
                                {t('invitation_type_venue_search_hint', 'Choose the venue type first so search suggests matching places (café, bar, etc.).')}
                            </small>
                        </div>

                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label style={{ fontSize: '0.9rem', marginBottom: '8px', display: 'block' }}>
                                {t('form_location_label')}
                                {liveUserGps.status === 'pending' &&
                <AppText as="span" style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginInlineStart: '8px' }}>
                                        ({t('detecting_location', 'Detecting your location…')} ⏳)
                                    </AppText>
                }
                                {liveUserGps.status === 'ready' && liveUserGps.city &&
                <AppText as="span" style={{
                  color: 'var(--primary)',
                  fontWeight: 'bold',
                  fontSize: '0.95rem',
                  marginInlineStart: '8px'
                }}>
                                        ({t('in_my_city') || 'In'} {liveUserGps.city} 📍)
                                    </AppText>
                }
                                {liveUserGps.status === 'ready' && !liveUserGps.city &&
                <AppText as="span" style={{ color: 'var(--primary)', fontSize: '0.85rem', marginInlineStart: '8px' }}>
                                        ({t('gps_location_detected', 'GPS location detected')} 📍)
                                    </AppText>
                }
                                {(liveUserGps.status === 'denied' || liveUserGps.status === 'unavailable') &&
                <AppText as="span" style={{ color: '#ef4444', fontSize: '0.85rem', marginInlineStart: '8px' }}>
                                        ({t('location_not_determined')} ⚠️)
                                    </AppText>
                }
                            </label>
                            <VenueLocationPicker
                value={formData.location}
                onChange={handleChange}
                onSelect={handleLocationSelect}
                city={liveUserGps.city || undefined}
                countryCode={liveUserGps.countryCode || resolveVenueCountryIso(formData, userProfile)}
                userLat={liveUserGps.lat}
                userLng={liveUserGps.lng}
                invitationType={formData.type} />

                            <small style={{ color: 'var(--text-muted)', display: 'block', marginTop: '5px' }}>
                                {t('location_helper_text') || 'Search for venues, cafes, or restaurants near you'}
                            </small>
                        </div>
                        <AppText as="p" style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '10px 0 0', lineHeight: 1.4 }}>
                            {t('create_section_geo_search_note', {
                defaultValue: 'One search bar: DineBuddies venues in your city first, then Google Places if not listed.'
              })}
                        </AppText>
                    </div>
          }

                <div className="ui-card ui-form-surface" style={{ marginBottom: '1rem', padding: '1rem', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
                    <AppText as="h3" style={{ fontSize: '1.05rem', marginBottom: '0.85rem', fontWeight: 800 }}>
                        {t('create_section_core', { defaultValue: 'Invitation details' })}
                    </AppText>
                    <div style={{ marginBottom: '0.85rem' }}>
                        <AIFloatingLauncher
                postType="invitation"
                subType="public"
                onTextSuccess={handleInvitationAiContent}
                buildContextPrompt={buildInvitationAiPrompt}
                disabled={isSubmitting}
                invitationVenue={{
                  venueType: invitationAiContext.venueType,
                  venueName: invitationAiContext.venueName
                }} />

                    </div>
                    <div className="form-group" style={{ marginBottom: '1rem' }}>
                        <label>{t('form_title_label')}</label>
                        <AppTextInput
                type="text"
                name="title"
                placeholder={t('form_title_placeholder')}
                value={formData.title}
                onChange={handleChange}
                required
                className="input-field"
                disabled={!!editingInvitation}
                style={editingInvitation ? { opacity: 0.6, cursor: 'not-allowed', background: 'var(--hover-overlay)' } : {}} />

                    </div>
                    <div className="form-group public-invite-message-field" style={{ marginBottom: '1rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                            <label style={{ marginBottom: 0 }}>{t('form_message_label', 'Message')}</label>
                            <AppText as="span" style={{ fontSize: '0.7rem', color: (formData.description?.length || 0) >= invitationMessageMaxLength ? '#f87171' : 'var(--text-muted)' }}>
                                {formData.description?.length || 0}/{invitationMessageMaxLength}
                            </AppText>
                        </div>
                        <AppTextInput as="textarea"
              name="description"
              rows="2"
              placeholder={t('form_message_placeholder', 'Write your message to the invitees here...')}
              value={formData.description}
              onChange={handleChange}
              className="input-field text-area"
              maxLength={invitationMessageMaxLength}
              style={{ minHeight: '44px' }} />

                    </div>
                    <div className="form-group" style={{ marginBottom: '1rem' }}>
                        <label className="public-payment-label">
                            <FaMoneyBillWave aria-hidden />
                            {t('form_payment_label')}
                        </label>
                        <div className="public-payment-chips" role="radiogroup" aria-label={t('form_payment_label')}>
                            {[
                { value: 'Split', label: t('payment_split'), Icon: FaUserFriends },
                { value: 'Host Pays', label: t('payment_host'), Icon: FaMoneyBillWave }].
                map(({ value, label, Icon }) => {
                  const selected = formData.paymentType === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      className={`public-payment-chip${selected ? ' public-payment-chip--active' : ''}`}
                      onClick={() =>
                      setFormData((prev) => ({ ...prev, paymentType: value }))
                      }>

                                        <AppText as="span" className="public-payment-chip__icon" aria-hidden>
                                            <Icon />
                                        </AppText>
                                        <AppText as="span" className="public-payment-chip__label">{label}</AppText>
                                    </button>);

                })}
                        </div>
                    </div>
                    {editingInvitation && formData.location &&
            <div className="form-group" style={{ marginBottom: 0 }}>
                            <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{t('form_location_label')}</label>
                            <div className="input-field" style={{ opacity: 0.85, cursor: 'default' }}>
                                {formData.location}
                            </div>
                        </div>
            }
                </div>

                <div className="form-grid inv-datetime-row inv-datetime-row--compact">
                    <div className="form-group">
                        <label className="elegant-label">
                            <AppText as="span" className="label-icon">
                                <FaCalendarAlt />
                            </AppText>
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
                className="input-field input-field--compact-datetime"
                style={editingInvitation ? { opacity: 0.6, cursor: 'not-allowed', background: 'var(--hover-overlay)' } : {}} />

                    </div>

                    <div className="form-group">
                        <label className="elegant-label">
                            <AppText as="span" className="label-icon">
                                <FaClock />
                            </AppText>
                            {t('form_time_label')}
                        </label>
                        <input
                type="time"
                name="time"
                value={formData.time}
                onChange={handleChange}
                required
                disabled={!!editingInvitation} // Lock Time
                className="input-field input-field--compact-datetime"
                style={editingInvitation ? { opacity: 0.6, cursor: 'not-allowed', background: 'var(--hover-overlay)' } : {}} />

                    </div>
                </div>

                <div className="form-group public-guest-field">
                    <label className="elegant-label public-guest-field__label">
                        <AppText as="span" className="label-icon">
                            <FaUserFriends />
                        </AppText>
                        {t('guests_needed_label', { defaultValue: 'Guests Needed' })}
                        <AppText as="span" className="public-guest-field__max">
                            {t('public_guests_max_hint', { max: MAX_PUBLIC_GUESTS, defaultValue: `Max ${MAX_PUBLIC_GUESTS}` })}
                        </AppText>
                    </label>
                    <div
              className="public-guest-cloud"
              role="radiogroup"
              aria-label={t('guests_needed_label', { defaultValue: 'Guests Needed' })}>

                        {Array.from({ length: MAX_PUBLIC_GUESTS }, (_, i) => i + 1).map((count) => {
                const selected = Number(formData.guestsNeeded) === count;
                return (
                  <button
                    key={count}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    className={`public-guest-chip${selected ? ' public-guest-chip--active' : ''}`}
                    onClick={() =>
                    setFormData((prev) => ({ ...prev, guestsNeeded: count }))
                    }>

                                    {count}
                                </button>);

              })}
                    </div>
                </div>

                {/* Gender Groups Preference */}
                <div className="form-group public-invite-prefs">
                    <label className="elegant-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <AppText as="span">
                            <AppText as="span" className="label-icon"><FaVenusMars /></AppText>
                            {t('guest_gender_preference')}
                        </AppText>
                        <AppText as="span" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>
                            {t('multi_select', { defaultValue: '(Select multiple)' })}
                        </AppText>
                    </label>
                    <div className="public-invite-pref-grid public-invite-pref-grid--gender">
                        {[
              { value: 'male', label: t('male'), icon: IoMale },
              { value: 'female', label: t('female'), icon: IoFemale },
              { value: 'unspecified', label: t('non_binary', { defaultValue: 'Non-Binary' }), icon: IoMaleFemale }].
              map((option) => {
                const currentGroups = formData.genderGroups || [];
                const isSelected = currentGroups.includes(option.value);

                return (
                  <button
                    key={option.value}
                    type="button"
                    className={`public-invite-pref-chip${isSelected ? ' is-selected' : ''}`}
                    onClick={() => {
                      let newGroups = [...currentGroups];
                      if (isSelected) {
                        // PREVENT REMOVAL if it was in the original invitation (Normalized)
                        if (originalGenderGroups.includes(option.value)) {
                          showToast(t('cannot_remove_gender_group', { defaultValue: 'Cannot remove a previously selected group. You can only add more.' }), 'error');
                          return;
                        }
                        newGroups = newGroups.filter((g) => g !== option.value);
                      } else {
                        newGroups.push(option.value);
                      }
                      setFormData({ ...formData, genderGroups: newGroups, genderPreference: 'custom' });
                    }}>

                                    {isSelected &&
                    <AppText as="span" className="public-invite-pref-chip__check" aria-hidden>
                                            <FaCheckCircle />
                                        </AppText>
                    }
                                    <option.icon className="public-invite-pref-chip__icon" style={{ color: isSelected ? 'var(--primary)' : 'inherit' }} />
                                    <AppText as="span" className="public-invite-pref-chip__label">{option.label}</AppText>
                                </button>);

              })}
                    </div>
                    {(!formData.genderGroups || formData.genderGroups.length === 0) &&
            <AppText as="p" style={{ fontSize: '0.85rem', color: '#f87171', marginTop: '8px', textAlign: 'center', background: 'rgba(248, 113, 113, 0.1)', padding: '4px', borderRadius: '8px' }}>
                            ⚠️ {t('select_at_least_one_gender', { defaultValue: 'Please select at least one option' })}
                        </AppText>
            }
                </div>

                {/* Age Groups Preference */}
                <div className="form-group public-invite-prefs">
                    <label className="elegant-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <AppText as="span">
                            <AppText as="span" className="label-icon"><FaUserFriends /></AppText>
                            {t('age_range_preference')}
                        </AppText>
                        <AppText as="span" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>
                            {t('multi_select', { defaultValue: '(Select multiple)' })}
                        </AppText>
                    </label>
                    <div className="public-invite-pref-grid public-invite-pref-grid--age">
                        {[
              { value: '18-24', label: '18-24' },
              { value: '25-34', label: '25-34' },
              { value: '35-44', label: '35-44' },
              { value: '45-54', label: '45-54' },
              { value: '55+', label: '55+' }
              // Removed 'Any' option as requested
              ].map((option) => {
                const currentGroups = formData.ageGroups || [];
                const isSelected = currentGroups.includes(option.value);

                return (
                  <button
                    key={option.value}
                    type="button"
                    className={`public-invite-pref-chip public-invite-pref-chip--age${isSelected ? ' is-selected' : ''}`}
                    onClick={() => {
                      let newGroups = [...currentGroups];
                      if (isSelected) {
                        // PREVENT REMOVAL if it was in the original invitation (Normalized)
                        if (originalAgeGroups.includes(option.value)) {
                          showToast(t('cannot_remove_age_group', { defaultValue: 'Cannot remove a previously selected age group. You can only add more.' }), 'error');
                          return;
                        }
                        newGroups = newGroups.filter((g) => g !== option.value);
                      } else {
                        newGroups.push(option.value);
                      }
                      // If ageGroups is modified, we set ageRange to 'custom' to avoid legacy logic taking over
                      setFormData({ ...formData, ageGroups: newGroups, ageRange: 'custom' });
                    }}>

                                    {isSelected &&
                    <AppText as="span" className="public-invite-pref-chip__check" aria-hidden>
                                            <FaCheckCircle />
                                        </AppText>
                    }
                                    <HiUser className="public-invite-pref-chip__icon public-invite-pref-chip__icon--age" style={{ color: isSelected ? 'var(--primary)' : 'inherit' }} />
                                    <AppText as="span" className="public-invite-pref-chip__label">{option.label}</AppText>
                                </button>);

              })}
                    </div>
                    {(!formData.ageGroups || formData.ageGroups.length === 0) &&
            <AppText as="p" style={{ fontSize: '0.85rem', color: '#f87171', marginTop: '8px', textAlign: 'center', background: 'rgba(248, 113, 113, 0.1)', padding: '4px', borderRadius: '8px' }}>
                            ⚠️ {t('select_at_least_one_age', { defaultValue: 'Please select at least one age group' })}
                        </AppText>
            }
                </div>

                <div className="form-group ui-form-surface public-privacy-field" style={{ marginBottom: '1rem' }}>
                    <label className="elegant-label" style={{ marginBottom: '1rem' }}>
                        <AppText as="span" className="label-icon"><FaLock /></AppText>
                        {t('privacy_settings') || 'Privacy Settings'}
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                        {['public', 'followers'].map((mode) =>
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
                }}>

                                {mode === 'public' && <FaGlobe style={{ fontSize: '1.4rem', color: formData.privacy === mode ? 'var(--primary)' : 'var(--text-muted)' }} />}
                                {mode === 'followers' && <FaUserFriends style={{ fontSize: '1.4rem', color: formData.privacy === mode ? 'var(--primary)' : 'var(--text-muted)' }} />}
                                <AppText as="span" style={{ fontSize: '0.75rem', fontWeight: '700' }}>
                                    {mode === 'public' ? t('public') || 'Public' : t('followers_only') || 'Followers'}
                                </AppText>
                            </button>
              )}
                    </div>
                </div>

                <div
            style={{
              background: 'var(--card-bg)',
              padding: '1rem',
              borderRadius: '16px',
              border: '1px solid var(--border-color)',
              marginBottom: '1rem'
            }}>

                    <AppText as="h3" style={{ fontSize: '1rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        🎬 {t('create_section_media', { defaultValue: 'Photo or video' })}
                    </AppText>
                    <AppText as="p" style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                        {t('media_helper_text') || 'Choose a photo or video for your invitation'}
                    </AppText>
                    <MediaSelector
              restaurant={restaurantData || prefilledData}
              mediaData={mediaData}
              libraryVideo={libraryVideo}
              libraryImages={libraryImages}
              onPersistSelfieVideo={persistSelfieVideo}
              onPersistImage={persistImageToLibrary}
              onDeleteLibraryVideo={deleteLibraryVideo}
              onDeleteLibraryImage={deleteLibraryImage}
              onImageUploadError={(err) => notifyImageUploadError(showToast, err, t, 'media_upload_failed')}
              onMediaSelect={handleMediaSelect}
              simplified
              hideVenueCover />

                    {uploadProgress > 0 && uploadProgress < 100 &&
            <div
              style={{
                marginTop: '12px',
                background: 'var(--bg-card)',
                borderRadius: '8px',
                padding: '12px',
                border: '1px solid var(--border-color)'
              }}>

                            <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: '8px',
                  fontSize: '0.85rem',
                  color: 'var(--text-secondary)'
                }}>

                                <AppText as="span">
                                    {mediaData?.type === 'image' && uploadProgress < 80 ?
                  t('image_upload_checking') :
                  t('processing')}
                                </AppText>
                                <AppText as="span">{uploadProgress}%</AppText>
                            </div>
                            <div
                style={{
                  width: '100%',
                  height: '6px',
                  background: 'var(--border-color)',
                  borderRadius: '3px',
                  overflow: 'hidden'
                }}>

                                <div
                  style={{
                    width: `${uploadProgress}%`,
                    height: '100%',
                    background: 'linear-gradient(90deg, var(--primary), var(--accent))',
                    transition: 'width 0.3s ease',
                    borderRadius: '3px'
                  }} />

                            </div>
                        </div>
            }
                </div>

                {/* Live template carousel — colors, fonts, motion rail + layout previews */}
                <div className="form-group ui-form-surface" style={{ marginTop: '1.5rem', overflowX: 'hidden' }}>
                    <label className="elegant-label" style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <AppText as="span">{'\u{1F4D0}'}</AppText>
                        {t('invitation_card_layout', { defaultValue: 'Card layout' })}
                    </label>
                    <AppText as="p" style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '0 0 12px', lineHeight: 1.45 }}>
                        {t('invitation_layout_live_carousel_hint', {
                defaultValue: 'Swipe or drag sideways to compare layouts. Your colors, font, and media apply to each preview — tap a card to select it.'
              })}
                    </AppText>
                    <PublicInviteCardStyleStudio
              colorScheme={formData.colorScheme}
              onColorSchemeChange={(key) => setFormData((prev) => ({ ...prev, colorScheme: key }))}
              cardFontFamily={formData.cardFontFamily}
              onCardFontFamilyChange={(cssFamily) =>
              setFormData((prev) => ({ ...prev, cardFontFamily: cssFamily }))
              }>

                    <div
                ref={templateCarouselRef}
                role="listbox"
                aria-label={t('invitation_card_layout', { defaultValue: 'Card layout' })}
                onScroll={onTemplateCarouselScroll}
                onPointerDown={onTemplateCarouselDown}
                onPointerMove={onTemplateCarouselMove}
                onPointerUp={onTemplateCarouselUp}
                onPointerCancel={onTemplateCarouselCancel}
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
                  cursor: 'grab'
                }}
                className="hide-scroll-bar invitation-template-carousel">

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
                      onClick={() => {
                        if (templateCarouselWasDragged()) return;
                        setFormData((prev) => ({ ...prev, templateType: key }));
                      }}
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
                        outline: 'none'
                      }}>

                                    <div
                        style={{
                          borderRadius: '16px',
                          overflow: 'hidden',
                          border: isSel ? '3px solid var(--primary)' : '1px solid var(--border-color)',
                          boxShadow: isSel ?
                          '0 8px 28px rgba(139, 92, 246, 0.35)' :
                          '0 4px 16px rgba(0,0,0,0.12)',
                          background: 'var(--bg-card)',
                          transition: 'border-color 0.2s, box-shadow 0.2s'
                        }}>

                                        <div
                          style={{
                            width: '100%',
                            overflow: 'hidden',
                            position: 'relative',
                            pointerEvents: 'none',
                            touchAction: 'pan-y'
                          }}>

                                            <InvitationCard
                            invitation={{
                              ...previewInvitationBase,
                              templateType: key
                            }} />

                                        </div>
                                    </div>
                                    <div
                        style={{
                          textAlign: 'center',
                          marginTop: '10px',
                          fontSize: '0.75rem',
                          fontWeight: 800,
                          color: isSel ? 'var(--primary)' : 'var(--text-secondary)'
                        }}>

                                        {t(`invitation_template_${key}`, { defaultValue: tmpl.name })}
                                    </div>
                                    {!editingInvitation &&
                      <button
                        type="button"
                        className="ui-btn ui-btn--primary invitation-template-preview-btn"
                        disabled={isSubmitting}
                        onClick={(ev) => {
                          ev.stopPropagation();
                          handlePreview(ev, key);
                        }}
                        style={{
                          width: '100%',
                          marginTop: '10px',
                          minHeight: '44px',
                          fontSize: '0.85rem',
                          fontWeight: 800
                        }}>

                                            {isSubmitting ?
                        t('loading') :
                        t('preview_invitation', { defaultValue: 'Preview invitation' })}
                                        </button>
                      }
                                </div>);

                })}
                    </div>
                    </PublicInviteCardStyleStudio>
                    <AppText as="p" style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '12px 0 0', textAlign: 'center', lineHeight: 1.4 }}>
                        {t('public_invitation_guests_hint', { defaultValue: 'Public invitations appear in the feed; guests tap join on the card after you publish.' })}
                    </AppText>
                </div>

                {editingInvitation &&
          <button type="submit" className="ui-btn ui-btn--primary" style={{ width: '100%', height: '60px', marginTop: '1rem', fontSize: '1.1rem' }} disabled={isSubmitting}>
                        {isSubmitting ? t('loading') : t('save_changes') || '💾 Save Changes'}
                    </button>
          }
            </form>
        </div>
        </>);

};

export default CreateInvitation;