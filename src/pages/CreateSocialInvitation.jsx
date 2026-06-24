import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  FaCalendarAlt, FaMapMarkerAlt, FaTimes, FaCheckCircle,
  FaClock, FaLock, FaChevronLeft,
  FaMoneyBillWave, FaUsers, FaBriefcase,
  FaBirthdayCake, FaMoon, FaUtensils, FaCoffee, FaGamepad,
  FaStar, FaHome, FaFilm, FaFutbol, FaMicrophone,
  FaCamera, FaUpload, FaImage, FaMagic } from
'react-icons/fa';
import { useInvitations } from '../context/InvitationContext';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import VenueLocationPicker from '../components/VenueLocationPicker';
import { commitInvitationAiCover, resolveAiGeneratedCoverPreview, verifyPublicStorageImageUrl } from '../services/mediaService';
import { isServerPersistedAiCoverUrl } from '../utils/aiGeneratedMediaUrl';
import { notifyImageUploadError } from '../utils/imageModerationErrors';
import { db } from '../firebase/config';
import { getSafeAvatar } from '../utils/avatarUtils';
import { doc, getDoc } from 'firebase/firestore';
import { detectUserLocationContext } from '../utils/locationUtils';
import './SocialInvitation.css';
import { useEditorSessionAutosave } from '../hooks/useEditorSessionAutosave';
import {
  privateInvitationEditorDraftKey,
  isPrivateInvitationEditorDraftEmpty,
  hasPrivateInvitationEditorWork,
  serializeEditorMedia,
  restoreEditorMedia,
  serializeCoverMediaStash,
  restoreCoverMediaStash,
  syncSerializeEditorMedia } from
'../utils/editorSessionDraft';
import { persistPrivateInvitationEditorDraft } from '../utils/persistPrivateInvitationEditorDraft';
import SocialInvitationEditorFooter from '../components/Invitations/socialCard/SocialInvitationEditorFooter';
import InvitationEditorLeaveDialog from '../components/Invitations/socialCard/InvitationEditorLeaveDialog';
import '../components/Invitations/socialCard/SocialInvitationEditorFooter.css';
import { resolveVenueCountryIso } from '../utils/countryIso';
import { getAppBidiFieldProps } from '../utils/bidiText';
import { buildSocialInvitationAiUserPrompt } from '../utils/aiPromptLocale';
import SocialInvitationCardPreview from '../components/Invitations/socialCard/SocialInvitationCardPreview';
import SocialCardPreviewStage from '../components/Invitations/socialCard/SocialCardPreviewStage';
import {
  DEFAULT_PRIVATE_TEXT_BACKDROP_TONE,
  getPrivateCardTextBackdropFromInvitation } from
'../components/Invitations/socialCard/socialCardTextBackdrop';
import {
  INVITATION_CARD_MESSAGE_MAX,
  INVITATION_CARD_TITLE_MAX } from
'../constants/invitationCardLimits';
import SocialInvitationCoverRightRail from '../components/Invitations/socialCard/SocialInvitationCoverRightRail';
import SocialInvitationAiCoverPanel from '../components/Invitations/socialCard/SocialInvitationAiCoverPanel';
import { DEFAULT_FRAME_COLOR_ID } from '../components/Invitations/socialCard/socialCardFrameColors';
import { DEFAULT_FONT_ID } from '../components/Invitations/socialCard/socialCardFonts';
import {
  DEFAULT_CARD_COPY_OFFSET_Y,
  DEFAULT_CARD_COPY_WIDTH_PCT,
  DEFAULT_CARD_COPY_FONT_SCALE } from
'../components/Invitations/socialCard/socialCardCopyLayout';
import { resolveOccasionCategoryId } from '../components/Invitations/socialCard/socialCardOccasionMap';
import {
  getCardBackgroundOptions,
  parsePrivateInvitationCardBackgroundFromUrl,
  DEFAULT_PRIVATE_OCCASION_LABEL,
  DEFAULT_PRIVATE_CARD_BACKGROUND_ID } from
'../components/Invitations/socialCard/socialCardBackgrounds';
import {
  isPrivateCardGradientBackgroundId } from
'../components/Invitations/socialCard/socialCardGradientBackgrounds';
import { getPrivateHeroCoverFromMediaData } from '../components/Invitations/privateCard/privateCardBackgrounds';
import PrivateCoverCameraPanel from '../components/Invitations/privateCard/PrivateCoverCameraPanel';
import { getTotalDineCredits, SOCIAL_INVITATION_PUBLISH_CREDITS } from '../utils/privateInvitationCredits';
import {
  createPrivateCoverStashId,
  isCoverStashKindAtLimit,
  isSamePrivateCoverMedia,
  PRIVATE_COVER_STASH_MAX_IMAGES,
  PRIVATE_COVER_STASH_MAX_VIDEOS,
  PRIVATE_COVER_STASH_MAX_AI_IMAGES,
  revokeAllPrivateCoverStash,
  revokePrivateCoverMedia,
  revokePrivateCoverStashEntry } from
'../utils/privateCoverMediaStash';
import AIFloatingLauncher from '../components/AIFloatingLauncher';
import { extractAIContentFields } from '../utils/aiContentFieldMapper';
import { parseAiStudioImageFromState } from '../utils/aiStudioImagePayload';
import { goToLogin, getCurrentReturnPath } from '../utils/goToLogin';
import { resolveCardStructureFromBackgroundId } from '../utils/cardStructure';
import { AppText, AppTextInput } from "../components/base";

function resolvePrivateInvitationAuthorUid(authUser, invitationContextUser) {
  return authUser?.uid || invitationContextUser?.uid || invitationContextUser?.id || null;
}

const CreateSocialInvitation = () => {
  const { t, i18n } = useTranslation();
  const bidiFieldProps = useMemo(() => getAppBidiFieldProps(i18n.language), [i18n.language]);
  const navigate = useNavigate();
  const location = useLocation();
  const { addHostedInvitation, currentUser, canCreateSocialInvitation } = useInvitations();
  const { showToast } = useToast();
  const { currentUser: authUser, userProfile } = useAuth();

  const quotaInfo = canCreateSocialInvitation('social');

  const restaurantData = location.state?.restaurantData || location.state?.selectedRestaurant;
  const editInvitation = location.state?.editInvitation;

  // UI State
  const [mediaData, setMediaData] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [existingDraftId, setExistingDraftId] = useState(null);
  const [cardFontId, setCardFontId] = useState(DEFAULT_FONT_ID);
  const [cardFrameColorId, setCardFrameColorId] = useState(DEFAULT_FRAME_COLOR_ID);
  const [socialCardThemeColor, setPrivateCardThemeColor] = useState(null);
  const [cardCopyOffsetY, setCardCopyOffsetY] = useState(DEFAULT_CARD_COPY_OFFSET_Y);
  const [cardCopyWidthPct, setCardCopyWidthPct] = useState(DEFAULT_CARD_COPY_WIDTH_PCT);
  const [cardCopyFontScale, setCardCopyFontScale] = useState(DEFAULT_CARD_COPY_FONT_SCALE);
  const [cardBackgroundId, setCardBackgroundId] = useState(
    () => editInvitation?.cardBackgroundId || DEFAULT_PRIVATE_CARD_BACKGROUND_ID
  );
  const [cardGradientId, setCardGradientId] = useState(
    () =>
    editInvitation?.cardGradientId &&
    isPrivateCardGradientBackgroundId(editInvitation.cardGradientId) &&
    editInvitation.cardGradientId ||
    null
  );
  const [privateCoverTab, setPrivateCoverTab] = useState(() => editInvitation ? 'camera' : 'template');
  const [cameraOpenNonce, setCameraOpenNonce] = useState(0);
  const [aiCoverSheetOpen, setAiCoverSheetOpen] = useState(false);
  const [aiCoverCommittingId, setAiCoverCommittingId] = useState(null);
  const [socialCardShowHostAndMessage, setPrivateCardShowHostAndMessage] = useState(true);
  const [socialCardTextBackdropTone, setPrivateCardTextBackdropTone] = useState(
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
    paymentType: 'Split',
    description: '',
    privacy: 'social',
    invitedFriends: [],
    country: restaurantData?.country || '',
    lat: restaurantData?.lat || restaurantData?.coordinates?.lat,
    lng: restaurantData?.lng || restaurantData?.coordinates?.lng,
    userLat: null,
    userLng: null,
    occasionType: editInvitation?.occasionType || DEFAULT_PRIVATE_OCCASION_LABEL
  });

  const privateCoverDraftsRef = useRef({ template: null, upload: null, camera: null, ai: null });
  const formDataRef = useRef(null);
  const mediaDataRef = useRef(null);
  const privateCoverTabRef = useRef(editInvitation ? 'camera' : 'template');
  const coverUploadInputRef = useRef(null);
  const coverMediaStashRef = useRef([]);

  useEffect(() => {
    formDataRef.current = formData;
  }, [formData]);
  useEffect(() => {
    mediaDataRef.current = mediaData;
  }, [mediaData]);

  const editorUid = resolvePrivateInvitationAuthorUid(authUser, currentUser);
  const editorDraftKey = editorUid ?
  privateInvitationEditorDraftKey(editorUid, 'private', editInvitation?.id) :
  null;
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
      publishedUrl: studio.publishedUrl
    };
    const entry = { id: createPrivateCoverStashId(), kind: 'ai', media };
    setCoverMediaStash([entry]);
    setMediaData(media);
    setPrivateCoverTab('ai');
    privateCoverDraftsRef.current.ai = media;
  }, [location.state?.aiStudioImage]);

  useEffect(() => {
    return () => {
      revokeAllPrivateCoverStash(coverMediaStashRef.current);
    };
  }, []);

  const privateHeroCover = useMemo(() => getPrivateHeroCoverFromMediaData(mediaData), [mediaData]);

  const heroCoverPending = useMemo(() => {
    if (!mediaData) return false;
    return Boolean(mediaData?.pending || mediaData?.source === 'ai_generated' && !mediaData?.publishedUrl);
  }, [mediaData]);

  const privateCoverTabLabel = useMemo(() => {
    const labels = {
      camera: t('social_cover_tab_camera_record', { defaultValue: 'Record video' }),
      upload: t('social_cover_tab_upload_device', { defaultValue: 'Upload from device' }),
      template: t('private_cover_tab_template', { defaultValue: 'Template' }),
      ai: t('social_cover_tab_ai_generate', { defaultValue: 'Generate AI cover' })
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
        privacy: 'social',
        invitedFriends: editInvitation.invitedFriends || [],
        country: editInvitation.country || '',
        lat: editInvitation.lat || null,
        lng: editInvitation.lng || null,
        userLat: editInvitation.userLat || null,
        userLng: editInvitation.userLng || null,
        occasionType: editInvitation.occasionType || DEFAULT_PRIVATE_OCCASION_LABEL
      });

      setPrivateCardShowHostAndMessage(editInvitation.socialCardShowHostAndMessage !== false);

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
      } else if (
      editInvitation.cardGradientId &&
      isPrivateCardGradientBackgroundId(editInvitation.cardGradientId))
      {
        setCardGradientId(editInvitation.cardGradientId);
        setCardBackgroundId(null);
        setPrivateCoverTab('template');
        setMediaData(null);
        privateCoverDraftsRef.current = { template: null, upload: null, camera: null, ai: null };
      } else if (editInvitation.cardBackgroundId) {
        setPrivateCoverTab('template');
        privateCoverDraftsRef.current = { template: null, upload: null, camera: null, ai: null };
      } else {
        setPrivateCoverTab('template');
        privateCoverDraftsRef.current = { template: null, upload: null, camera: null, ai: null };
      }

      setCardFontId(editInvitation.cardFontId || DEFAULT_FONT_ID);
      setCardFrameColorId(editInvitation.cardFrameColorId || DEFAULT_FRAME_COLOR_ID);
      const rawTheme =
      typeof editInvitation.socialCardThemeColor === 'string' && editInvitation.socialCardThemeColor.trim() ||
      '';
      setPrivateCardThemeColor(/^#[0-9A-Fa-f]{6}$/.test(rawTheme) ? rawTheme : null);
      setCardCopyOffsetY(editInvitation.cardCopyOffsetY ?? DEFAULT_CARD_COPY_OFFSET_Y);
      setCardCopyWidthPct(editInvitation.cardCopyWidthPct ?? DEFAULT_CARD_COPY_WIDTH_PCT);
      setCardCopyFontScale(editInvitation.cardCopyFontScale ?? DEFAULT_CARD_COPY_FONT_SCALE);
    }
  }, [editInvitation]);

  /** Sync card background when occasion changes; pick first template if none selected. */
  useEffect(() => {
    if (cardGradientId) return;
    const cat = resolveOccasionCategoryId(formData.occasionType);
    const opts = getCardBackgroundOptions(cat);
    if (opts.length === 0) {
      setCardBackgroundId(null);
      return;
    }
    if (
    editInvitation?.cardBackgroundId &&
    opts.some((o) => o.id === editInvitation.cardBackgroundId))
    {
      setCardBackgroundId(editInvitation.cardBackgroundId);
      return;
    }
    setCardBackgroundId((prev) => prev && opts.some((o) => o.id === prev) ? prev : opts[0].id);
  }, [formData.occasionType, editInvitation?.id, cardGradientId]);

  // Redirect guests
  useEffect(() => {
    if (userProfile?.isGuest || userProfile?.role === 'guest' || currentUser?.id === 'guest') {
      goToLogin({ returnPath: getCurrentReturnPath() || '/create-social' });
    }
  }, [userProfile, currentUser]);

  // Unified location discovery for all users/pages.
  useEffect(() => {
    if (restaurantData) return;

    const detectLocation = async () => {
      const detected = await detectUserLocationContext(userProfile);
      if (!detected.success) return;
      setFormData((prev) => ({
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
    setFormData((prev) => ({
      ...prev,
      location: placeData.name,
      lat: placeData.lat,
      lng: placeData.lng,
      title: placeData.name ? `${t('invitation_at')} ${placeData.name}` : prev.title
    }));
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
        resolved?.preview !== prev.preview)
        {
          revokeBlobPreview(prev);
        }
      } else {
        if (
        prev?.preview &&
        String(prev.preview).startsWith('blob:') &&
        prev.preview !== next?.preview)
        {
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

    if (tab === 'template') {
      setCardGradientId(null);
      const cat = resolveOccasionCategoryId(formData.occasionType);
      const opts = getCardBackgroundOptions(cat);
      setCardBackgroundId((prev) =>
      prev && opts.some((o) => o.id === prev) ? prev : opts[0]?.id || null
      );
    } else if (tab === 'ai' || tab === 'upload' || tab === 'camera') {
      setCardGradientId(null);
    }
  };

  const handlePrivateCardBackgroundChange = (id) => {
    setCardBackgroundId(id);
    setCardGradientId(null);
  };

  const toastCoverStashLimit = (kind) => {
    if (kind === 'upload') {
      showToast(
        t('social_cover_stash_max_images', {
          defaultValue: `You can add up to ${PRIVATE_COVER_STASH_MAX_IMAGES} photos. Remove one from the thumbnails to add another.`,
          max: PRIVATE_COVER_STASH_MAX_IMAGES
        }),
        'error'
      );
    } else if (kind === 'ai') {
      showToast(
        t('social_cover_stash_max_ai', {
          defaultValue: `You can keep up to ${PRIVATE_COVER_STASH_MAX_AI_IMAGES} AI covers. Remove one from the thumbnails to generate another.`,
          max: PRIVATE_COVER_STASH_MAX_AI_IMAGES
        }),
        'error'
      );
    } else {
      showToast(
        t('social_cover_stash_max_videos', {
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
            publishedUrl
          };
        }
        return {
          ...media,
          source: 'ai_generated',
          url: publishedUrl,
          publishedUrl
        };
      }
      return {
        ...media,
        source: 'ai_generated',
        url: publishedUrl,
        preview: publishedUrl,
        publishedUrl
      };
    } finally {
      if (stashId) setAiCoverCommittingId(null);
    }
  };

  const updateAiStashMedia = (stashId, media) => {
    setCoverMediaStash((prev) =>
    prev.map((entry) => entry.id === stashId ? { ...entry, media } : entry)
    );
  };

  const handleAiCoverImageGenerated = useCallback(
    async (url) => {
      if (!url) return;
      if (isCoverStashKindAtLimit(coverMediaStashRef.current, 'ai')) {
        toastCoverStashLimit('ai');
        return;
      }

      privateCoverDraftsRef.current[privateCoverTab] = mediaDataRef.current;

      let media;
      try {
        const resolved = await resolveAiGeneratedCoverPreview(url);
        media = {
          source: 'ai_generated',
          type: 'image',
          url: resolved.remoteUrl,
          preview: resolved.displayUrl,
          ...(isServerPersistedAiCoverUrl(resolved.remoteUrl) ?
          { publishedUrl: resolved.remoteUrl } :
          {})
        };
      } catch (err) {
        console.error('AI cover preview resolve failed:', err);
        showToast(
          t('social_cover_ai_preview_failed', {
            defaultValue:
            'The cover was generated but the preview could not load. Try again in a moment.'
          }),
          'error'
        );
        return;
      }

      const entry = stashCoverMedia('ai', media);
      if (!entry) return;

      setPrivateCoverTab('ai');
      setMediaData(media);
      privateCoverDraftsRef.current.ai = media;

      try {
        const committed = await commitAiCoverMedia(media, entry.id);
        updateAiStashMedia(entry.id, committed);
        if (isSamePrivateCoverMedia(mediaDataRef.current, media)) {
          setMediaData(committed);
          privateCoverDraftsRef.current.ai = committed;
        }
        showToast(
          t('magic_cover_applied_toast', { defaultValue: 'AI cover applied to this invitation.' }),
          'success'
        );
      } catch (err) {
        console.error('AI cover commit failed:', err);
        showToast(
          err?.message === 'not_signed_in' ?
          t('please_sign_in', { defaultValue: 'Please sign in to continue.' }) :
          t('media_upload_failed', { defaultValue: 'Failed to upload media.' }),
          'error'
        );
      }
    },
    [showToast, t]
  );

  const handlePrivateCoverAiTabClick = () => {
    if (privateCoverTab === 'ai') {
      if (isCoverStashKindAtLimit(coverMediaStashRef.current, 'ai')) {
        toastCoverStashLimit('ai');
        return;
      }
      setAiCoverSheetOpen(true);
    } else {
      handlePrivateCoverTab('ai');
      setAiCoverSheetOpen(true);
    }
  };

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

  /** Switch to Camera tab and open recorder (single tap). */
  const handlePrivateCoverCameraTabClick = () => {
    if (privateCoverTab === 'camera') {
      if (isCoverStashKindAtLimit(coverMediaStashRef.current, 'camera')) {
        toastCoverStashLimit('camera');
        return;
      }
      setCameraOpenNonce((n) => n + 1);
    } else {
      handlePrivateCoverTab('camera');
      setCameraOpenNonce((n) => n + 1);
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
          err?.message === 'not_signed_in' ?
          t('please_sign_in', { defaultValue: 'Please sign in to continue.' }) :
          t('media_upload_failed', { defaultValue: 'Failed to upload media.' }),
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

  const buildPrivateInvitationAiPrompt = useCallback(
    () => buildSocialInvitationAiUserPrompt(formData),
    [formData]
  );

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
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const pickCoverMediaUrl = useCallback((m) => m?.publishedUrl || m?.url, []);

  const buildSessionDraftPayload = useCallback(async () => {
    const media = await serializeEditorMedia(mediaDataRef.current, pickCoverMediaUrl);
    const coverMediaStashSerialized = await serializeCoverMediaStash(
      coverMediaStashRef.current,
      (m) => serializeEditorMedia(m, pickCoverMediaUrl)
    );
    return {
      formData: formDataRef.current,
      existingDraftId,
      cardFontId,
      cardFrameColorId,
      socialCardThemeColor,
      cardCopyOffsetY,
      cardCopyWidthPct,
      cardCopyFontScale,
      cardBackgroundId,
      cardGradientId,
      privateCoverTab,
      socialCardShowHostAndMessage,
      socialCardTextBackdropTone,
      media,
      coverMediaStash: coverMediaStashSerialized
    };
  }, [
  existingDraftId,
  cardFontId,
  cardFrameColorId,
  socialCardThemeColor,
  cardCopyOffsetY,
  cardCopyWidthPct,
  cardCopyFontScale,
  cardBackgroundId,
  cardGradientId,
  privateCoverTab,
  socialCardShowHostAndMessage,
  socialCardTextBackdropTone,
  pickCoverMediaUrl]
  );

  const buildSyncDraftPayload = useCallback(() => {
    const coverMediaStashSerialized = (coverMediaStashRef.current || []).
    map((entry) => {
      const media = syncSerializeEditorMedia(entry?.media);
      if (!media || !entry?.id) return null;
      return { id: entry.id, kind: entry.kind || 'upload', media };
    }).
    filter(Boolean);
    return {
      formData: formDataRef.current,
      existingDraftId,
      cardFontId,
      cardFrameColorId,
      socialCardThemeColor,
      cardCopyOffsetY,
      cardCopyWidthPct,
      cardCopyFontScale,
      cardBackgroundId,
      cardGradientId,
      privateCoverTab,
      socialCardShowHostAndMessage,
      socialCardTextBackdropTone,
      media: syncSerializeEditorMedia(mediaDataRef.current),
      coverMediaStash: coverMediaStashSerialized
    };
  }, [
  existingDraftId,
  cardFontId,
  cardFrameColorId,
  socialCardThemeColor,
  cardCopyOffsetY,
  cardCopyWidthPct,
  cardCopyFontScale,
  cardBackgroundId,
  cardGradientId,
  privateCoverTab,
  socialCardShowHostAndMessage,
  socialCardTextBackdropTone]
  );

  const applySessionDraftPayload = useCallback(async (draft) => {
    if (draft.existingDraftId) setExistingDraftId(draft.existingDraftId);
    if (draft.formData && typeof draft.formData === 'object') {
      setFormData((prev) => ({ ...prev, ...draft.formData }));
    }
    if (draft.cardFontId) setCardFontId(draft.cardFontId);
    if (draft.cardFrameColorId) setCardFrameColorId(draft.cardFrameColorId);
    if (draft.socialCardThemeColor !== undefined) setPrivateCardThemeColor(draft.socialCardThemeColor);
    if (draft.cardCopyOffsetY !== undefined) setCardCopyOffsetY(draft.cardCopyOffsetY);
    if (draft.cardCopyWidthPct !== undefined) setCardCopyWidthPct(draft.cardCopyWidthPct);
    if (draft.cardCopyFontScale !== undefined) setCardCopyFontScale(draft.cardCopyFontScale);
    if (draft.cardBackgroundId) setCardBackgroundId(draft.cardBackgroundId);
    if (draft.cardGradientId !== undefined) setCardGradientId(draft.cardGradientId);
    if (draft.privateCoverTab) {
      setPrivateCoverTab(draft.privateCoverTab === 'gradient' ? 'template' : draft.privateCoverTab);
    }
    if (typeof draft.socialCardShowHostAndMessage === 'boolean') {
      setPrivateCardShowHostAndMessage(draft.socialCardShowHostAndMessage);
    }
    if (draft.socialCardTextBackdropTone) {
      setPrivateCardTextBackdropTone(draft.socialCardTextBackdropTone);
    }
    const restoredMedia = await restoreEditorMedia(draft.media);
    if (restoredMedia) {
      setMediaData(restoredMedia);
      privateCoverDraftsRef.current[privateCoverTabRef.current] = restoredMedia;
    }
    const restoredStash = await restoreCoverMediaStash(draft.coverMediaStash, restoreEditorMedia);
    if (restoredStash.length) {
      setCoverMediaStash(restoredStash);
      if (!restoredMedia) {
        const last = restoredStash[restoredStash.length - 1];
        setMediaData(last.media);
        if (last.kind) {
          setPrivateCoverTab(
            last.kind === 'camera' ? 'camera' : last.kind === 'ai' ? 'ai' : 'upload'
          );
          privateCoverDraftsRef.current[last.kind] = last.media;
        }
      }
    }
  }, []);

  const { clearDraft: clearSessionDraft, flushSave: flushSessionDraft } = useEditorSessionAutosave({
    enabled: Boolean(editorUid),
    storageKey: editorDraftKey,
    ready: Boolean(editorUid),
    skipRestore: Boolean(editInvitation) || Boolean(location.state?.aiStudioImage),
    buildPayload: buildSessionDraftPayload,
    buildSyncPayload: buildSyncDraftPayload,
    applyPayload: applySessionDraftPayload,
    isEmpty: isPrivateInvitationEditorDraftEmpty,
    onRestored: () =>
    showToast(
      t('social_editor_draft_restored', {
        defaultValue: 'Your unsaved invitation was restored.'
      }),
      'info'
    ),
    deps: [
    formData,
    mediaData,
    cardFontId,
    cardFrameColorId,
    socialCardThemeColor,
    cardCopyOffsetY,
    cardCopyWidthPct,
    cardCopyFontScale,
    cardBackgroundId,
    cardGradientId,
    privateCoverTab,
    socialCardShowHostAndMessage,
    socialCardTextBackdropTone,
    existingDraftId,
    coverMediaStash]

  });

  const getActiveMediaForPersist = useCallback(async () => {
    let activeMedia = mediaDataRef.current;
    if (activeMedia?.source === 'ai_generated' && !activeMedia.publishedUrl) {
      showToast(
        t('social_cover_ai_uploading', {
          defaultValue: 'Saving your AI cover to storage…'
        }),
        'info',
        null,
        4000
      );
      const stashEntry = coverMediaStashRef.current.find((e) =>
      isSamePrivateCoverMedia(e.media, activeMedia)
      );
      activeMedia = await commitAiCoverMedia(activeMedia, stashEntry?.id ?? null);
      if (stashEntry) updateAiStashMedia(stashEntry.id, activeMedia);
      setMediaData(activeMedia);
      privateCoverDraftsRef.current.ai = activeMedia;
    }
    if (
    activeMedia && (
    activeMedia.type === 'video' || activeMedia.source === 'custom_video'))
    {
      showToast(
        t('social_cover_video_uploading', {
          defaultValue: 'Uploading your video cover… this may take a moment.'
        }),
        'info',
        null,
        4000
      );
    }
    return activeMedia;
  }, [showToast, t]);

  const persistEditorDraft = useCallback(async () => {
    const authorUid = resolvePrivateInvitationAuthorUid(authUser, currentUser);
    if (!authorUid) {
      showToast(t('please_sign_in', { defaultValue: 'Please sign in to continue.' }), 'error');
      return { ok: false };
    }
    try {
      return await persistPrivateInvitationEditorDraft({
        type: 'Social',
        formData: formDataRef.current || formData,
        getActiveMedia: getActiveMediaForPersist,
        authorUid,
        cardFrameColorId,
        cardFontId,
        cardCopyOffsetY,
        cardCopyWidthPct,
        cardCopyFontScale,
        cardBackgroundId,
        cardGradientId,
        existingDraftId,
        addHostedInvitation,
        socialCardThemeColor,
        socialCardShowHostAndMessage,
        socialCardTextBackdropTone
      });
    } catch (mediaError) {
      console.error('❌ Draft save failed:', mediaError);
      notifyImageUploadError(showToast, mediaError, t, 'media_upload_failed');
      return { ok: false };
    }
  }, [
  authUser,
  currentUser,
  cardFrameColorId,
  cardFontId,
  cardCopyOffsetY,
  cardCopyWidthPct,
  cardCopyFontScale,
  cardBackgroundId,
  cardGradientId,
  existingDraftId,
  addHostedInvitation,
  socialCardThemeColor,
  socialCardShowHostAndMessage,
  socialCardTextBackdropTone,
  getActiveMediaForPersist,
  formData,
  showToast,
  t]
  );

  const validateEditorRequiredFields = useCallback(() => {
    const fd = formDataRef.current || formData;
    if (!fd.title?.trim() || !fd.date || !fd.time || !fd.location?.trim()) {
      showToast(t('please_fill_required_fields') || 'Please fill in all required fields', 'error');
      return false;
    }
    return true;
  }, [formData, showToast, t]);

  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  const hasEditorWork = useMemo(
    () =>
    hasPrivateInvitationEditorWork({
      existingDraftId,
      formData,
      mediaData,
      coverMediaStash,
      cardBackgroundId,
      cardGradientId
    }),
    [existingDraftId, formData, mediaData, coverMediaStash, cardBackgroundId, cardGradientId]
  );

  const handleCloseRequest = useCallback(() => {
    if (!hasEditorWork) {
      void flushSessionDraft().then(() => navigate(-1));
      return;
    }
    setShowCloseDialog(true);
  }, [flushSessionDraft, hasEditorWork, navigate]);

  const handleCloseSave = useCallback(async () => {
    const payload = await buildSessionDraftPayload();
    if (isPrivateInvitationEditorDraftEmpty(payload)) {
      setShowCloseDialog(false);
      await flushSessionDraft();
      navigate(-1);
      return;
    }
    setIsClosing(true);
    try {
      const result = await persistEditorDraft();
      if (!result.ok) {
        if (result.code === 'create_failed') {
          showToast(t('failed_create_invitation'), 'error');
        }
        return;
      }
      clearSessionDraft();
      setShowCloseDialog(false);
      showToast(
        t('social_invitation_draft_saved', {
          defaultValue: 'Invitation saved. You can continue editing or open preview.'
        }),
        'success'
      );
      navigate(-1);
    } finally {
      setIsClosing(false);
    }
  }, [
  buildSessionDraftPayload,
  clearSessionDraft,
  navigate,
  persistEditorDraft,
  showToast,
  t,
  flushSessionDraft]
  );

  const handleCloseDiscard = useCallback(() => {
    setShowCloseDialog(false);
    clearSessionDraft();
    navigate(-1);
  }, [clearSessionDraft, navigate]);

  const handleBack = useCallback(() => {
    handleCloseRequest();
  }, [handleCloseRequest]);

  const handleSaveDraft = useCallback(async () => {
    const payload = await buildSessionDraftPayload();
    if (isPrivateInvitationEditorDraftEmpty(payload)) {
      showToast(
        t('social_editor_nothing_to_save', {
          defaultValue: 'Add invitation details before saving.'
        }),
        'info'
      );
      return;
    }
    setIsSubmitting(true);
    try {
      const result = await persistEditorDraft();
      if (!result.ok) {
        if (result.code === 'create_failed') {
          showToast(t('failed_create_invitation'), 'error');
        }
        return;
      }
      setExistingDraftId(result.draftId);
      clearSessionDraft();
      showToast(
        t('social_invitation_draft_saved', {
          defaultValue: 'Invitation saved. You can continue editing or open preview.'
        }),
        'success'
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [buildSessionDraftPayload, clearSessionDraft, persistEditorDraft, showToast, t]);

  const handlePreview = useCallback(async () => {
    if (!validateEditorRequiredFields()) return;

    const quota = canCreateSocialInvitation('social');
    if (!editInvitation && !quota.profileLoading && !quota.canCreate) {
      showToast(
        t(
          'dine_credits_private_insufficient',
          `Publishing costs ${SOCIAL_INVITATION_PUBLISH_CREDITS} Dine Credits. Open Settings → Dine Credits to top up.`
        ),
        'error'
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await persistEditorDraft();
      if (!result.ok) {
        if (result.code === 'create_failed') {
          showToast(t('failed_create_invitation'), 'error');
        }
        return;
      }
      clearSessionDraft();
      clearCoverMediaStashAfterPublish();
      navigate(`/invitation/social/preview/${result.draftId}`, { replace: true });
    } catch (error) {
      console.error('Error creating private draft:', error);
      showToast(t('failed_create_invitation'), 'error');
    } finally {
      setIsSubmitting(false);
    }
  }, [
  validateEditorRequiredFields,
  canCreateSocialInvitation,
  editInvitation,
  persistEditorDraft,
  clearSessionDraft,
  navigate,
  showToast,
  t]
  );

  const quota = quotaInfo.quota;
  const isUnlimited = quota === 'unlimited' || quota === '∞' || quota === -1;
  const profilePending = Boolean(quotaInfo.profileLoading) || quota === 'pending';
  const dineBalance = getTotalDineCredits(userProfile);
  const publishCost = SOCIAL_INVITATION_PUBLISH_CREDITS;
  const lowCredits = !isUnlimited && !profilePending && dineBalance < publishCost;

  return (
    <div className="private-create-wrapper private-theme">
            <div className="private-header-premium">
                <button type="button" onClick={handleBack} className="private-back-btn">
                    <FaChevronLeft />
                </button>
                <div className="private-header-badge">
                    🔒 {t('dinebuddy_private', 'DineBuddy Private')}
                </div>
                <AppText as="h2" className="private-header-title">
                    <FaLock />
                    {t('dinebuddy_private', 'DineBuddy Private')}
                </AppText>
                <AppText as="p" className="private-header-desc">
                    {t('social_invitation_desc', 'This invitation will not be visible to the public. Only people you invite can see and join.')}
                </AppText>

                {!quotaInfo.profileLoading &&
        <div style={{
          margin: '12px 0 0',
          padding: '10px 16px',
          borderRadius: '12px',
          background: isUnlimited ?
          'rgba(72,187,120,0.1)' :
          lowCredits ?
          'rgba(239,68,68,0.1)' :
          'rgba(139,92,246,0.1)',
          border: `1px solid ${isUnlimited ? 'rgba(72,187,120,0.3)' : lowCredits ? 'rgba(239,68,68,0.3)' : 'rgba(139,92,246,0.3)'}`,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontSize: '0.875rem',
          color: isUnlimited ? '#4ade80' : lowCredits ? '#f87171' : '#a78bfa',
          fontWeight: 600
        }}>
                        <AppText as="span">{isUnlimited ? '∞' : `${dineBalance}`}</AppText>
                        <AppText as="span" style={{ opacity: 0.85, fontWeight: 400 }}>
                            {isUnlimited ?
            t('unlimited_private_invitations', 'Unlimited private invitations') :
            t(
              'dine_credits_private_banner',
              '{{balance}} Dine Credits — publishing uses {{cost}} credits (free pool is used first).',
              { balance: dineBalance, cost: publishCost }
            )}
                        </AppText>
                    </div>
        }
            </div>

            <div className="private-form-container">
                <form onSubmit={(e) => e.preventDefault()} className="elegant-form">
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
                required />

                        </div>
                        <div className="form-group">
                            <label className="elegant-label"><FaClock /> {t('time')}</label>
                            <input
                type="time"
                name="time"
                value={formData.time}
                onChange={handleChange}
                className="elegant-input"
                required />

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
              { id: 'concert', icon: <FaMicrophone />, label: 'Concert' }].
              map((occ) => {
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
                    className={`private-occasion-chip${selected ? ' private-occasion-chip--selected' : ''}`}>

                                        <AppText as="span" className="private-occasion-chip__icon">{occ.icon}</AppText>
                                        {t(`occasion_${occ.id}`, occ.label)}
                                    </div>);

              })}
                        </div>
                    </div>

                    <div className="form-group mb-4 venue-search-stack">
                        <label className="elegant-label"><FaMapMarkerAlt className="label-icon" /> {t('location')}</label>
                        <VenueLocationPicker
              value={formData.location}
              onChange={(e) => setFormData((prev) => ({ ...prev, location: e.target.value }))}
              onSelect={handleLocationSelect}
              city={formData.city}
              countryCode={resolveVenueCountryIso(formData, userProfile)}
              userLat={formData.userLat ?? userProfile?.coordinates?.lat}
              userLng={formData.userLng ?? userProfile?.coordinates?.lng}
              className="elegant-input" />

                    </div>

                    <div className="form-group mb-4">
                        <label className="elegant-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                            {t('invitation_title')}
                            <AppText as="span"
              style={{
                fontSize: '0.75rem',
                color: (formData.title?.length || 0) >= INVITATION_CARD_TITLE_MAX ?
                '#f87171' :
                'var(--text-muted)'
              }}>

                                {formData.title?.length || 0}/{INVITATION_CARD_TITLE_MAX}
                            </AppText>
                        </label>
                        <AppTextInput
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
              style={bidiFieldProps.style} />

                    </div>

                    <div className="form-group mb-4">
                        <label className="elegant-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                            {t('message_to_friends')}
                            <AppText as="span"
              style={{
                fontSize: '0.75rem',
                color:
                (formData.description?.length || 0) >= INVITATION_CARD_MESSAGE_MAX ?
                '#f87171' :
                'var(--text-muted)'
              }}>

                                {formData.description?.length || 0}/{INVITATION_CARD_MESSAGE_MAX}
                            </AppText>
                        </label>
                        <AppTextInput as="textarea"
            name="description"
            value={formData.description}
            onChange={handleChange}
            placeholder={t('write_something_personal')}
            className="elegant-textarea"
            rows="3"
            maxLength={INVITATION_CARD_MESSAGE_MAX}
            dir={bidiFieldProps.dir}
            lang={bidiFieldProps.lang}
            style={bidiFieldProps.style}>
            </AppTextInput>
                    </div>

                    <div className="mb-4">
                        <AIFloatingLauncher
              postType="invitation"
              subType="private"
              onTextSuccess={handlePrivateInvitationAiContent}
              buildContextPrompt={buildPrivateInvitationAiPrompt}
              disabled={isSubmitting} />

                    </div>

                    {/* Card + cover: same preview chrome as dating (tools on card + right rail). */}
                    <div className="private-section-card private-section-card--templates mb-4">
                        <AppText as="h3" className="private-section-card__title">
                            <AppText as="span" aria-hidden>🃏</AppText>{' '}
                            {t('social_section_templates_title', { defaultValue: 'Ready card looks' })}
                        </AppText>
                        <input
              ref={coverUploadInputRef}
              type="file"
              accept="image/*"
              className="private-cover-upload-input"
              onChange={handlePrivateCoverUploadPick}
              tabIndex={-1}
              aria-hidden />

                        <div className="private-cover-tabs-wrap">
                            <AppText as="p" className="private-cover-tabs__active-label" aria-live="polite">
                                {privateCoverTabLabel}
                            </AppText>
                            <div
                role="tablist"
                aria-label={t('private_cover_tabs_label', { defaultValue: 'Cover source' })}
                className="private-cover-tabs private-cover-tabs--icons-only">

                                <button
                  type="button"
                  role="tab"
                  aria-selected={privateCoverTab === 'camera'}
                  onClick={handlePrivateCoverCameraTabClick}
                  className={`private-cover-tab${privateCoverTab === 'camera' ? ' private-cover-tab--active' : ''}`}
                  title={t('social_cover_tab_camera_open', { defaultValue: 'Video' })}
                  aria-label={t('social_cover_tab_camera_open', { defaultValue: 'Video' })}>

                                    <FaCamera aria-hidden />
                                </button>
                                <button
                  type="button"
                  role="tab"
                  aria-selected={privateCoverTab === 'upload'}
                  onClick={handlePrivateCoverUploadTabClick}
                  className={`private-cover-tab${privateCoverTab === 'upload' ? ' private-cover-tab--active' : ''}`}
                  title={t('social_cover_tab_upload_open', { defaultValue: 'From device' })}
                  aria-label={t('social_cover_tab_upload_open', { defaultValue: 'From device' })}>

                                    <FaUpload aria-hidden />
                                </button>
                                <button
                  type="button"
                  role="tab"
                  aria-selected={privateCoverTab === 'template'}
                  onClick={() => handlePrivateCoverTab('template')}
                  className={`private-cover-tab${privateCoverTab === 'template' ? ' private-cover-tab--active' : ''}`}
                  title={t('private_cover_tab_template', { defaultValue: 'Template' })}
                  aria-label={t('private_cover_tab_template', { defaultValue: 'Template' })}>

                                    <FaImage aria-hidden />
                                </button>
                                <button
                  type="button"
                  role="tab"
                  aria-selected={privateCoverTab === 'ai'}
                  onClick={handlePrivateCoverAiTabClick}
                  className={`private-cover-tab${privateCoverTab === 'ai' ? ' private-cover-tab--active' : ''}`}
                  title={t('social_cover_tab_ai_generate', { defaultValue: 'Generate AI cover' })}
                  aria-label={t('social_cover_tab_ai_generate', { defaultValue: 'Generate AI cover' })}>

                                    <FaMagic aria-hidden />
                                </button>
                            </div>
                        </div>

                        {privateCoverTab === 'camera' &&
            <PrivateCoverCameraPanel onMediaSelect={handleCameraCoverMedia} openNonce={cameraOpenNonce} />
            }

                        <SocialInvitationAiCoverPanel
              open={aiCoverSheetOpen}
              onClose={() => setAiCoverSheetOpen(false)}
              subType="private"
              buildBrief={buildPrivateInvitationAiPrompt}
              onUseImage={handleAiCoverImageGenerated}
              disabled={isSubmitting} />


                        <div className="form-group mb-0">
                            <div className="private-card-preview-with-bg">
                                <div className="private-card-preview-with-bg__preview-wrap">
                                    <SocialCardPreviewStage
                    showHostAndMessage={socialCardShowHostAndMessage}
                    onShowHostAndMessageChange={setPrivateCardShowHostAndMessage}
                    editorPhotoBackgroundActive={editorPhotoBackgroundActive}
                    textBackdropTone={socialCardTextBackdropTone}
                    onTextBackdropToneChange={setPrivateCardTextBackdropTone}
                    copyOffsetY={cardCopyOffsetY}
                    copyWidthPct={cardCopyWidthPct}
                    copyFontScale={cardCopyFontScale}
                    onCopyOffsetYChange={setCardCopyOffsetY}
                    onCopyWidthPctChange={setCardCopyWidthPct}
                    onCopyFontScaleChange={setCardCopyFontScale}
                    fontId={cardFontId}
                    themeColorHex={socialCardThemeColor}
                    onFontChange={setCardFontId}
                    onThemeColorChange={setPrivateCardThemeColor}>

                                        <SocialInvitationCardPreview
                      cardTemplateSet="private"
                      className="social-invitation-card-preview--showcase social-invitation-card-preview--showcase-compact social-invitation-card-preview--private-editor-meta"
                      frameColorId={cardFrameColorId}
                      cardThemeColor={socialCardThemeColor}
                      cardFontId={cardFontId}
                      copyOffsetY={cardCopyOffsetY}
                      copyWidthPct={cardCopyWidthPct}
                      copyFontScale={cardCopyFontScale}
                      occasionType={formData.occasionType}
                      cardBackgroundId={cardBackgroundId}
                      cardGradientId={cardGradientId}
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
                      showHostAndMessage={socialCardShowHostAndMessage}
                      textBackdropTone={socialCardTextBackdropTone} />

                                    </SocialCardPreviewStage>
                                    <SocialInvitationCoverRightRail
                    categoryId={resolveOccasionCategoryId(formData.occasionType)}
                    cardBackgroundId={cardBackgroundId}
                    onCardBackgroundIdChange={handlePrivateCardBackgroundChange}
                    mode={privateCoverTab}
                    mediaData={mediaData}
                    coverStash={coverMediaStash}
                    onSelectStashItem={handleSelectCoverStashItem}
                    onRemoveStashItem={handleRemoveCoverStashItem}
                    committingStashId={aiCoverCommittingId} />

                                </div>
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
                    className={`private-payment-chip${selected ? ' private-payment-chip--selected' : ''}`}>

                                        {t(type.toLowerCase().replace(' ', '_'))}
                                    </div>);

              })}
                        </div>
                    </div>

                    <SocialInvitationEditorFooter
            onClose={handleCloseRequest}
            onSave={handleSaveDraft}
            onPreview={handlePreview}
            busy={isSubmitting} />

                </form>
            </div>

            <InvitationEditorLeaveDialog
        open={showCloseDialog}
        saving={isClosing}
        onSave={handleCloseSave}
        onDiscard={handleCloseDiscard}
        onCancel={() => setShowCloseDialog(false)} />

        </div>);

};

export default CreateSocialInvitation;