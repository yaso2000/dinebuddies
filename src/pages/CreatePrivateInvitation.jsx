import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { flushSync } from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  FaCalendarAlt, FaTimes, FaCheckCircle,
  FaLock, FaChevronLeft,
  FaCamera, FaUpload, FaImage, FaMagic } from
'react-icons/fa';
import { useInvitations } from '../context/InvitationContext';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import InvitationVenueLocationSection from '../components/InvitationVenueLocationSection';
import { commitInvitationAiCover, resolveAiGeneratedCoverPreview, verifyPublicStorageImageUrl } from '../services/mediaService';
import { isServerPersistedAiCoverUrl } from '../utils/aiGeneratedMediaUrl';
import { notifyImageUploadError } from '../utils/imageModerationErrors';
import { db } from '../firebase/config';
import { getSafeAvatar } from '../utils/avatarUtils';
import { doc, getDoc } from 'firebase/firestore';
import { detectUserLocationContext } from '../utils/locationUtils';
import './SocialInvitation.css';
import { resolveVenueCountryIso } from '../utils/countryIso';
import { getAppBidiFieldProps } from '../utils/bidiText';
import { buildPrivateInvitationAiUserPrompt } from '../utils/aiPromptLocale';
import { getTotalDineCredits, PRIVATE_INVITATION_PUBLISH_CREDITS } from '../utils/privateInvitationCredits';
import SocialInvitationCardPreview from '../components/Invitations/socialCard/SocialInvitationCardPreview';
import {
  INVITATION_CARD_MESSAGE_MAX,
  INVITATION_CARD_TITLE_MAX } from
'../constants/invitationCardLimits';
import PrivateCardPreviewStage from '../components/Invitations/privateCard/PrivateCardPreviewStage';
import PrivateCoverCameraPanel from '../components/Invitations/privateCard/PrivateCoverCameraPanel';
import {
  DEFAULT_PRIVATE_TEXT_BACKDROP_TONE,
  getDatingCardTextBackdropFromInvitation } from
'../components/Invitations/socialCard/socialCardTextBackdrop';
import { DEFAULT_FRAME_COLOR_ID } from '../components/Invitations/socialCard/socialCardFrameColors';
import { DEFAULT_FONT_ID } from '../components/Invitations/socialCard/socialCardFonts';
import {
  DEFAULT_CARD_COPY_OFFSET_Y,
  DEFAULT_CARD_COPY_WIDTH_PCT,
  DEFAULT_CARD_COPY_FONT_SCALE } from
'../components/Invitations/socialCard/socialCardCopyLayout';
import {
  getPrivateCardBackgroundOptions,
  getDatingHeroCoverFromMediaData,
  parseDatingCoverTemplateIdFromUrl,
  getDefaultPrivateCardBackgroundId,
  isPrivateBackgroundIdForCategory,
  createPrivateCategoryCoverSlice,
  getFirstPrivateBackgroundFileUrl } from
'../components/Invitations/privateCard/privateCardBackgrounds';
import {
  PERSONAL_INVITE_CATEGORIES,
  DEFAULT_PERSONAL_INVITE_CATEGORY,
  normalizePersonalInviteCategory } from
'../constants/personalInviteCategories';
import SocialInvitationCoverRightRail from '../components/Invitations/socialCard/SocialInvitationCoverRightRail';
import SocialInvitationAiCoverPanel from '../components/Invitations/socialCard/SocialInvitationAiCoverPanel';
import {
  isPrivateCardGradientBackgroundId } from
'../components/Invitations/socialCard/socialCardGradientBackgrounds';
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
import { applyInvitationAiFields } from '../utils/aiContentFieldMapper';
import { parseAiStudioImageFromState } from '../utils/aiStudioImagePayload';
import { validatePrivateAiContext, createPrivateAiContextFromForm } from '../utils/privateAiRequestPayload';
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
import SocialInvitationInviteePanel from '../components/Invitations/socialCard/SocialInvitationInviteePanel';
import InvitationEditorLeaveDialog from '../components/Invitations/socialCard/InvitationEditorLeaveDialog';
import {
  getPrivateInviteeDisplayName,
  isUserAvailableForPrivateInvite,
  senderFollowsInvitee } from
'../utils/privateInviteAvailability';
import '../components/Invitations/socialCard/SocialInvitationEditorFooter.css';
import { goToLogin, getCurrentReturnPath } from '../utils/goToLogin';
import { resolveCardStructureFromBackgroundId } from '../utils/cardStructure';
import { AppText, AppTextInput } from "../components/base";
import LookingForChips from '../components/profile/LookingForChips';
import { normalizeLookingFor } from '../constants/personalInviteCategories';

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

const CreatePrivateInvitation = () => {
  const { t, i18n } = useTranslation();
  const bidiFieldProps = useMemo(() => getAppBidiFieldProps(i18n.language), [i18n.language]);
  const navigate = useNavigate();
  const location = useLocation();
  const { addHostedInvitation, currentUser, canCreateSocialInvitation } = useInvitations();
  const { showToast } = useToast();
  const { currentUser: authUser, userProfile } = useAuth();

  const quotaInfo = canCreateSocialInvitation('private');

  const restaurantData = location.state?.restaurantData || location.state?.selectedRestaurant;
  const editInvitation = location.state?.editInvitation;
  const preselectedInvitee = location.state?.preselectedInvitee;

  const [privateInviteeProfile, setDatingInviteeProfile] = useState(null);

  const [mediaData, setMediaData] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [existingDraftId, setExistingDraftId] = useState(null);
  const [cardFontId, setCardFontId] = useState(DEFAULT_FONT_ID);
  const [cardFrameColorId, setCardFrameColorId] = useState(DEFAULT_FRAME_COLOR_ID);
  /** `#rrggbb` or null — one color for frame border + all text; null uses `cardFrameColorId` preset. */
  const [privateCardThemeColor, setDatingCardThemeColor] = useState(null);
  const [cardCopyOffsetY, setCardCopyOffsetY] = useState(DEFAULT_CARD_COPY_OFFSET_Y);
  const [cardCopyWidthPct, setCardCopyWidthPct] = useState(DEFAULT_CARD_COPY_WIDTH_PCT);
  const [cardCopyFontScale, setCardCopyFontScale] = useState(DEFAULT_CARD_COPY_FONT_SCALE);
  const [cardBackgroundId, setCardBackgroundId] = useState(() => {
    if (editInvitation?.cardBackgroundId) {
      const cat = normalizePersonalInviteCategory(editInvitation.personalInviteCategory);
      if (isPrivateBackgroundIdForCategory(editInvitation.cardBackgroundId, cat)) {
        return editInvitation.cardBackgroundId;
      }
    }
    return getDefaultPrivateCardBackgroundId(
      editInvitation?.personalInviteCategory || DEFAULT_PERSONAL_INVITE_CATEGORY
    );
  });
  const [cardGradientId, setCardGradientId] = useState(
    () =>
    editInvitation?.cardGradientId &&
    isPrivateCardGradientBackgroundId(editInvitation.cardGradientId) &&
    editInvitation.cardGradientId ||
    null
  );
  const [datingCoverTab, setDatingCoverTab] = useState(() => editInvitation ? 'camera' : 'template');
  /** Bumps when user selects the Camera cover tab (or taps it again) to open the recorder. */
  const [cameraOpenNonce, setCameraOpenNonce] = useState(0);
  const pendingCameraStreamRef = useRef(null);
  const [aiCoverSheetOpen, setAiCoverSheetOpen] = useState(false);
  const [aiCoverCommittingId, setAiCoverCommittingId] = useState(null);
  /** Dating card: show personal message + profile on the preview (default on). */
  const [privateCardShowHostAndMessage, setDatingCardShowHostAndMessage] = useState(true);
  const [privateCardTextBackdropTone, setDatingCardTextBackdropTone] = useState(
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
    privacy: 'social',
    invitedFriends: [],
    country: restaurantData?.country || '',
    lat: restaurantData?.lat || restaurantData?.coordinates?.lat,
    lng: restaurantData?.lng || restaurantData?.coordinates?.lng,
    userLat: null,
    userLng: null,
    occasionType: 'Private',
    personalInviteCategory: DEFAULT_PERSONAL_INVITE_CATEGORY,
    venueType: restaurantData?.businessType || 'Restaurant'
  });

  /** Persist cover media per tab when switching Camera / Upload / Template */
  const datingCoverDraftsRef = useRef({ template: null, upload: null, camera: null, ai: null });
  /** Isolated cover editor state per personal invite category (dating / friendship / social). */
  const coverByCategoryRef = useRef(null);
  const mediaDataRef = useRef(null);
  const datingCoverTabRef = useRef(editInvitation ? 'camera' : 'template');
  const coverUploadInputRef = useRef(null);
  const datingAiFieldsRef = useRef(null);
  const [datingAiFieldsPulse, setDatingAiFieldsPulse] = useState(false);
  const formDataRef = useRef(null);
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
      publishedUrl: studio.publishedUrl
    };
    const entry = { id: createPrivateCoverStashId(), kind: 'ai', media };
    setCoverMediaStash([entry]);
    setMediaData(media);
    setDatingCoverTab('ai');
    datingCoverDraftsRef.current.ai = media;
  }, [location.state?.aiStudioImage]);

  /** Profile → create-dating: pre-select invitee (must accept private invites + sender follows). */
  useEffect(() => {
    if (editInvitation || !preselectedInvitee?.id) return;
    if (!isUserAvailableForPrivateInvite(preselectedInvitee)) {
      showToast(
        t('private_invitee_not_available', {
          defaultValue: 'This member is not available for private invites.'
        }),
        'warning'
      );
      return;
    }
    const following = userProfile?.following ?? currentUser?.following ?? [];
    if (!senderFollowsInvitee(following, preselectedInvitee.id)) {
      showToast(
        t(
          'private_invite_follow_required',
          'Follow this member first to send a private invite.'
        ),
        'warning'
      );
      return;
    }
    setFormData((prev) => {
      if (prev.invitedFriends?.includes(preselectedInvitee.id)) return prev;
      return { ...prev, invitedFriends: [preselectedInvitee.id] };
    });
  }, [editInvitation, preselectedInvitee, showToast, t, userProfile?.following, currentUser?.following]);

  /** Load selected invitee profile for AI personalization. */
  useEffect(() => {
    const inviteeId = formData.invitedFriends?.[0];
    if (!inviteeId) {
      setDatingInviteeProfile(null);
      return undefined;
    }

    let cancelled = false;
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'users', inviteeId));
        if (cancelled) return;
        if (snap.exists()) {
          const data = snap.data();
          if (!isUserAvailableForPrivateInvite(data)) {
            setDatingInviteeProfile(null);
            setFormData((prev) =>
            prev.invitedFriends?.[0] === inviteeId ?
            { ...prev, invitedFriends: [] } :
            prev
            );
            showToast(
              t('private_invitee_not_available', {
                defaultValue: 'This member is not available for private invites.'
              }),
              'warning'
            );
            return;
          }
          setDatingInviteeProfile({
            id: inviteeId,
            display_name: getPrivateInviteeDisplayName(data),
            ...data
          });
        } else if (preselectedInvitee?.id === inviteeId) {
          setDatingInviteeProfile({
            id: inviteeId,
            display_name: getPrivateInviteeDisplayName(preselectedInvitee),
            ...preselectedInvitee
          });
        } else {
          setDatingInviteeProfile({ id: inviteeId, display_name: t('user', 'User') });
        }
      } catch {
        if (!cancelled) {
          setDatingInviteeProfile({ id: inviteeId, display_name: t('user', 'User') });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [formData.invitedFriends, preselectedInvitee, showToast, t]);

  formDataRef.current = formData;
  cardBackgroundIdRef.current = cardBackgroundId;

  useEffect(() => {
    return () => {
      const bucket = coverByCategoryRef.current;
      if (bucket) {
        Object.values(bucket).forEach((slice) => revokeAllPrivateCoverStash(slice.stash || []));
      }
      revokeAllPrivateCoverStash(coverMediaStashRef.current);
    };
  }, []);

  const datingHeroCover = useMemo(() => getDatingHeroCoverFromMediaData(mediaData), [mediaData]);

  /** Template art as hero — same path as sent invites / notifications (not internal bg resolver). */
  const privatePreviewHeroCover = useMemo(() => {
    if (datingHeroCover?.src) return datingHeroCover;
    if (cardGradientId) return null;
    if (!cardBackgroundId) return null;
    if (!isPrivateBackgroundIdForCategory(cardBackgroundId, formData.personalInviteCategory)) {
      return null;
    }
    const url = getFirstPrivateBackgroundFileUrl(
      cardBackgroundId,
      formData.personalInviteCategory
    );
    if (!url || String(url).startsWith('data:')) return null;
    return { src: url, mediaType: 'image', poster: null };
  }, [
    datingHeroCover,
    cardGradientId,
    cardBackgroundId,
    formData.personalInviteCategory,
  ]);

  const heroCoverPending = useMemo(() => {
    if (!mediaData) return false;
    // mediaData may be a pending AI image entry (pending:true) or an ai_generated preview without publishedUrl
    return Boolean(mediaData?.pending || mediaData?.source === 'ai_generated' && !mediaData?.publishedUrl);
  }, [mediaData]);

  const editorPhotoBackgroundActive = useMemo(() => {
    if (privatePreviewHeroCover?.src) return true;
    return isPrivateBackgroundIdForCategory(cardBackgroundId, formData.personalInviteCategory);
  }, [privatePreviewHeroCover?.src, cardBackgroundId, formData.personalInviteCategory]);

  const ensureCoverByCategoryRef = useCallback(() => {
    if (!coverByCategoryRef.current) {
      coverByCategoryRef.current = {
        dating: createPrivateCategoryCoverSlice('dating'),
        friendship: createPrivateCategoryCoverSlice('friendship'),
        social: createPrivateCategoryCoverSlice('social'),
      };
    }
    return coverByCategoryRef.current;
  }, []);

  const snapshotCoverStateToCategory = useCallback(
    (categoryId) => {
      const bucket = ensureCoverByCategoryRef();
      const cat = normalizePersonalInviteCategory(categoryId);
      bucket[cat] = {
        cardBackgroundId,
        cardGradientId,
        coverTab: datingCoverTab,
        mediaData,
        drafts: { ...datingCoverDraftsRef.current },
        stash: coverMediaStash,
      };
    },
    [
      cardBackgroundId,
      cardGradientId,
      datingCoverTab,
      mediaData,
      coverMediaStash,
      ensureCoverByCategoryRef,
    ]
  );

  const applyCoverStateFromCategory = useCallback(
    (categoryId) => {
      const bucket = ensureCoverByCategoryRef();
      const cat = normalizePersonalInviteCategory(categoryId);
      let slice = bucket[cat];
      if (!slice) {
        slice = createPrivateCategoryCoverSlice(cat);
        bucket[cat] = slice;
      }
      const bgId =
        slice.cardBackgroundId && isPrivateBackgroundIdForCategory(slice.cardBackgroundId, cat)
          ? slice.cardBackgroundId
          : getDefaultPrivateCardBackgroundId(cat);
      setCardBackgroundId(bgId);
      setCardGradientId(slice.cardGradientId ?? null);
      const tab = slice.coverTab ?? 'template';
      setDatingCoverTab(tab);
      datingCoverTabRef.current = tab;
      datingCoverDraftsRef.current = {
        template: null,
        upload: null,
        camera: null,
        ai: null,
        ...(slice.drafts || {}),
      };
      setMediaData(slice.mediaData ?? null);
      setCoverMediaStash(slice.stash ?? []);
    },
    [ensureCoverByCategoryRef]
  );

  const handlePersonalInviteCategoryChange = useCallback(
    (nextCategoryId) => {
      const prevCat = formData.personalInviteCategory;
      const nextCat = normalizePersonalInviteCategory(nextCategoryId);
      if (prevCat === nextCat) return;
      snapshotCoverStateToCategory(prevCat);
      applyCoverStateFromCategory(nextCat);
      setFormData((prev) => ({ ...prev, personalInviteCategory: nextCat }));
    },
    [formData.personalInviteCategory, snapshotCoverStateToCategory, applyCoverStateFromCategory]
  );

  // Populate when editing
  useEffect(() => {
    if (editInvitation) {
      const editCategory = normalizePersonalInviteCategory(editInvitation.personalInviteCategory);
      let initialCoverTab = 'template';
      let initialCoverBgId = getDefaultPrivateCardBackgroundId(editCategory);
      let initialCoverGradient =
        editInvitation.cardGradientId &&
        isPrivateCardGradientBackgroundId(editInvitation.cardGradientId)
          ? editInvitation.cardGradientId
          : null;
      let initialCoverMedia = null;
      let initialCoverDrafts = { template: null, upload: null, camera: null, ai: null };
      let initialCoverStash = [];

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
        privacy: 'social',
        invitedFriends: editInvitation.invitedFriends || [],
        country: editInvitation.country || '',
        lat: editInvitation.lat || null,
        lng: editInvitation.lng || null,
        userLat: editInvitation.userLat || null,
        userLng: editInvitation.userLng || null,
        occasionType: 'Private',
        personalInviteCategory: normalizePersonalInviteCategory(
          editInvitation.personalInviteCategory
        ),
        venueType: editInvitation.venueType || 'Restaurant'
      });
      setDatingCardShowHostAndMessage(editInvitation.privateCardShowHostAndMessage !== false);
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
        initialCoverStash = [videoEntry];
        initialCoverTab = 'camera';
        initialCoverMedia = m;
        initialCoverDrafts = { template: null, upload: null, camera: m, ai: null };
        setCoverMediaStash(initialCoverStash);
        setDatingCoverTab(initialCoverTab);
        setMediaData(initialCoverMedia);
        datingCoverDraftsRef.current = initialCoverDrafts;
      } else if (imgUrl) {
        const templateId =
        parseDatingCoverTemplateIdFromUrl(imgUrl) || editInvitation.cardBackgroundId;
        if (templateId && isPrivateBackgroundIdForCategory(templateId, editCategory)) {
          initialCoverBgId = templateId;
          initialCoverTab = 'template';
          initialCoverMedia = null;
          initialCoverDrafts = { template: null, upload: null, camera: null, ai: null };
          setCardBackgroundId(initialCoverBgId);
          setDatingCoverTab(initialCoverTab);
          setMediaData(null);
          datingCoverDraftsRef.current = initialCoverDrafts;
        } else {
          const m = {
            source: 'custom_image',
            type: 'image',
            preview: imgUrl,
            url: imgUrl,
            file: null
          };
          const imageEntry = { id: createPrivateCoverStashId(), kind: 'upload', media: m };
          initialCoverStash = [imageEntry];
          initialCoverTab = 'upload';
          initialCoverMedia = m;
          initialCoverDrafts = { template: null, upload: m, camera: null, ai: null };
          setCoverMediaStash(initialCoverStash);
          setDatingCoverTab(initialCoverTab);
          setMediaData(initialCoverMedia);
          datingCoverDraftsRef.current = initialCoverDrafts;
        }
      } else if (initialCoverGradient) {
        initialCoverBgId = null;
        initialCoverTab = 'template';
        initialCoverMedia = null;
        initialCoverDrafts = { template: null, upload: null, camera: null, ai: null };
        setCardGradientId(initialCoverGradient);
        setCardBackgroundId(null);
        setDatingCoverTab(initialCoverTab);
        setMediaData(null);
        datingCoverDraftsRef.current = initialCoverDrafts;
      } else if (
      editInvitation.cardBackgroundId &&
      isPrivateBackgroundIdForCategory(editInvitation.cardBackgroundId, editCategory))
      {
        initialCoverBgId = editInvitation.cardBackgroundId;
        initialCoverTab = 'template';
        initialCoverMedia = null;
        initialCoverDrafts = { template: null, upload: null, camera: null, ai: null };
        setCardBackgroundId(initialCoverBgId);
        setDatingCoverTab(initialCoverTab);
        setMediaData(null);
        datingCoverDraftsRef.current = initialCoverDrafts;
      } else {
        initialCoverTab = 'template';
        datingCoverDraftsRef.current = initialCoverDrafts;
        setDatingCoverTab(initialCoverTab);
      }

      coverByCategoryRef.current = {
        dating: createPrivateCategoryCoverSlice('dating'),
        friendship: createPrivateCategoryCoverSlice('friendship'),
        social: createPrivateCategoryCoverSlice('social'),
      };
      coverByCategoryRef.current[editCategory] = createPrivateCategoryCoverSlice(editCategory, {
        cardBackgroundId: initialCoverBgId,
        cardGradientId: initialCoverGradient,
        coverTab: initialCoverTab,
        mediaData: initialCoverMedia,
        drafts: initialCoverDrafts,
        stash: initialCoverStash,
      });

      setCardFontId(editInvitation.cardFontId || DEFAULT_FONT_ID);
      setCardFrameColorId(editInvitation.cardFrameColorId || DEFAULT_FRAME_COLOR_ID);
      const rawTheme =
      typeof editInvitation.privateCardThemeColor === 'string' && editInvitation.privateCardThemeColor.trim() ||
      typeof editInvitation.datingCardTextColor === 'string' && editInvitation.datingCardTextColor.trim() ||
      '';
      setDatingCardThemeColor(/^#[0-9A-Fa-f]{6}$/.test(rawTheme) ? rawTheme : null);
      setCardCopyOffsetY(editInvitation.cardCopyOffsetY ?? DEFAULT_CARD_COPY_OFFSET_Y);
      setCardCopyWidthPct(editInvitation.cardCopyWidthPct ?? DEFAULT_CARD_COPY_WIDTH_PCT);
      setCardCopyFontScale(editInvitation.cardCopyFontScale ?? DEFAULT_CARD_COPY_FONT_SCALE);
    }
  }, [editInvitation]);

  useEffect(() => {
    if (userProfile?.isGuest || userProfile?.role === 'guest' || currentUser?.id === 'guest') {
      goToLogin({ returnPath: getCurrentReturnPath() || '/create-private' });
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
    const isDbVenue = !!(placeData.restaurantId || placeData.isDineBuddiesVenue);
    setFormData((prev) => ({
      ...prev,
      location: placeData.fullAddress || placeData.name || prev.location,
      lat: placeData.lat ?? prev.lat,
      lng: placeData.lng ?? prev.lng,
      restaurantId: isDbVenue ? placeData.restaurantId || null : null,
      restaurantName: isDbVenue ? placeData.restaurantName || placeData.name || prev.restaurantName : '',
      placeId: placeData.placeId || prev.placeId || null,
      city: placeData.city || prev.city,
      country: placeData.country || prev.country,
      countryCode: placeData.countryCode || prev.countryCode,
      ...(isDbVenue ? { isDineBuddiesVenue: true } : {}),
      venueType:
      placeData.businessType ||
      placeData.venueType ||
      prev.venueType ||
      'Restaurant',
      title: placeData.name ? `${t('invitation_at')} ${placeData.name}` : prev.title,
      ...(placeData.matchedFromGoogle ? { venueMatchedFromGoogle: true } : {})
    }));
  };

  const privateAiContext = useMemo(
    () =>
    createPrivateAiContextFromForm(
      formData,
      getPrivateInviteeDisplayName(privateInviteeProfile),
      cardBackgroundId
    ),
    [formData, privateInviteeProfile, cardBackgroundId]
  );

  /** Always reads latest form state (safe inside floating portal). */
  const getPrivateAiContext = useCallback(() => {
    const fd = formDataRef.current || formData;
    const inviteeId = fd?.invitedFriends?.[0];
    const inviteeName =
    inviteeId && privateInviteeProfile?.id === inviteeId ?
    getPrivateInviteeDisplayName(privateInviteeProfile) :
    '';
    return createPrivateAiContextFromForm(
      fd,
      inviteeName,
      cardBackgroundIdRef.current || cardBackgroundId
    );
  }, [formData, privateInviteeProfile, cardBackgroundId]);

  const datingAiReady = useMemo(
    () => validatePrivateAiContext(privateAiContext).ok,
    [privateAiContext]
  );

  const datingAiDisabledHint = useMemo(() => {
    if (datingAiReady) return undefined;
    return t('private_ai_schedule_venue_required', {
      defaultValue: 'Set the date, time, and location first — then AI can draft your message.'
    });
  }, [datingAiReady, t]);

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

    if (tab === 'template') {
      setCardGradientId(null);
      setCardBackgroundId((prev) =>
      prev && isPrivateBackgroundIdForCategory(prev, formData.personalInviteCategory) ?
      prev :
      getDefaultPrivateCardBackgroundId(formData.personalInviteCategory)
      );
    } else if (tab === 'ai' || tab === 'upload' || tab === 'camera') {
      setCardGradientId(null);
    }
  };

  const handleDatingCardBackgroundChange = (id) => {
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

      datingCoverDraftsRef.current[datingCoverTab] = mediaDataRef.current;

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

      setDatingCoverTab('ai');
      setMediaData(media);
      datingCoverDraftsRef.current.ai = media;

      try {
        const committed = await commitAiCoverMedia(media, entry.id);
        updateAiStashMedia(entry.id, committed);
        if (isSamePrivateCoverMedia(mediaDataRef.current, media)) {
          setMediaData(committed);
          datingCoverDraftsRef.current.ai = committed;
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

  const handleDatingCoverAiTabClick = () => {
    if (datingCoverTab === 'ai') {
      if (isCoverStashKindAtLimit(coverMediaStashRef.current, 'ai')) {
        toastCoverStashLimit('ai');
        return;
      }
      setAiCoverSheetOpen(true);
    } else {
      handleDatingCoverTab('ai');
      setAiCoverSheetOpen(true);
    }
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

  const handleDatingCoverCameraTabClick = async () => {
    if (datingCoverTab !== 'camera') {
      handleDatingCoverTab('camera');
    }
    if (isCoverStashKindAtLimit(coverMediaStashRef.current, 'camera')) {
      toastCoverStashLimit('camera');
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      showToast(
        t('camera_error_generic', 'Could not open the camera. Check permissions and try again.'),
        'error'
      );
      return;
    }

    try {
      if (pendingCameraStreamRef.current) {
        pendingCameraStreamRef.current.getTracks().forEach((track) => track.stop());
        pendingCameraStreamRef.current = null;
      }
      pendingCameraStreamRef.current = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: true
      });
      setCameraOpenNonce((n) => n + 1);
    } catch (err) {
      pendingCameraStreamRef.current = null;
      console.error('[CreatePrivateInvitation] camera permission', err);
      const denied =
        err?.name === 'NotAllowedError' ||
        err?.name === 'PermissionDeniedError' ||
        String(err?.message || '').toLowerCase().includes('permission');
      showToast(
        denied ?
          t(
            'camera_error_permission',
            'Camera access was blocked. Allow camera in browser settings, then try again.'
          ) :
          t('camera_error_generic', 'Could not open the camera. Check permissions and try again.'),
        'error'
      );
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
          err?.message === 'not_signed_in' ?
          t('please_sign_in', { defaultValue: 'Please sign in to continue.' }) :
          t('media_upload_failed', { defaultValue: 'Failed to upload media.' }),
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

  const buildDatingInvitationAiPrompt = useCallback(
    () => buildPrivateInvitationAiUserPrompt(formData, privateInviteeProfile),
    [formData, privateInviteeProfile]
  );

  const handleDatingInvitationAiContent = useCallback((data) => {
    const applied = applyInvitationAiFields(data, {
      titleMax: INVITATION_CARD_TITLE_MAX,
      descriptionMax: INVITATION_CARD_MESSAGE_MAX,
      cardStructure: resolveCardStructureFromBackgroundId(cardBackgroundId)
    });

    if (!applied.hasContent) {
      console.warn('[CreatePrivateInvitation] AI response had no mappable title/description', data);
      showToast(
        t('private_ai_fields_empty'),
        'error'
      );
      return false;
    }

    flushSync(() => {
      setFormData((prev) => ({
        ...prev,
        title: applied.hasTitle ? applied.title : prev.title,
        description: applied.hasDescription ? applied.description : prev.description
      }));
    });

    setDatingAiFieldsPulse(true);
    window.setTimeout(() => setDatingAiFieldsPulse(false), 1600);

    requestAnimationFrame(() => {
      datingAiFieldsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });

    if (!applied.hasDescription) {
      showToast(
        t('private_ai_description_missing'),
        'info'
      );
    }

    return true;
  }, [showToast, t, cardBackgroundId]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handlePrivateInviteesChange = useCallback((nextIds) => {
    setFormData((prev) => ({ ...prev, invitedFriends: nextIds }));
  }, []);

  const editorUid = resolvePrivateInvitationAuthorUid(authUser, currentUser);
  const editorDraftKey = editorUid ?
  privateInvitationEditorDraftKey(editorUid, 'dating', editInvitation?.id) :
  null;

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
      privateCardThemeColor,
      cardCopyOffsetY,
      cardCopyWidthPct,
      cardCopyFontScale,
      cardBackgroundId,
      cardGradientId,
      datingCoverTab,
      privateCardShowHostAndMessage,
      privateCardTextBackdropTone,
      media,
      coverMediaStash: coverMediaStashSerialized
    };
  }, [
  existingDraftId,
  cardFontId,
  cardFrameColorId,
  privateCardThemeColor,
  cardCopyOffsetY,
  cardCopyWidthPct,
  cardCopyFontScale,
  cardBackgroundId,
  cardGradientId,
  datingCoverTab,
  privateCardShowHostAndMessage,
  privateCardTextBackdropTone,
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
      privateCardThemeColor,
      cardCopyOffsetY,
      cardCopyWidthPct,
      cardCopyFontScale,
      cardBackgroundId,
      cardGradientId,
      datingCoverTab,
      privateCardShowHostAndMessage,
      privateCardTextBackdropTone,
      media: syncSerializeEditorMedia(mediaDataRef.current),
      coverMediaStash: coverMediaStashSerialized
    };
  }, [
  existingDraftId,
  cardFontId,
  cardFrameColorId,
  privateCardThemeColor,
  cardCopyOffsetY,
  cardCopyWidthPct,
  cardCopyFontScale,
  cardBackgroundId,
  cardGradientId,
  datingCoverTab,
  privateCardShowHostAndMessage,
  privateCardTextBackdropTone]
  );

  const applySessionDraftPayload = useCallback(async (draft) => {
    if (draft.existingDraftId) setExistingDraftId(draft.existingDraftId);
    if (draft.formData && typeof draft.formData === 'object') {
      setFormData((prev) => ({ ...prev, ...draft.formData }));
    }
    if (draft.cardFontId) setCardFontId(draft.cardFontId);
    if (draft.cardFrameColorId) setCardFrameColorId(draft.cardFrameColorId);
    if (draft.privateCardThemeColor !== undefined) setDatingCardThemeColor(draft.privateCardThemeColor);
    if (draft.cardCopyOffsetY !== undefined) setCardCopyOffsetY(draft.cardCopyOffsetY);
    if (draft.cardCopyWidthPct !== undefined) setCardCopyWidthPct(draft.cardCopyWidthPct);
    if (draft.cardCopyFontScale !== undefined) setCardCopyFontScale(draft.cardCopyFontScale);
    if (draft.cardBackgroundId) setCardBackgroundId(draft.cardBackgroundId);
    if (draft.cardGradientId !== undefined) setCardGradientId(draft.cardGradientId);
    if (draft.datingCoverTab) {
      setDatingCoverTab(draft.datingCoverTab === 'gradient' ? 'template' : draft.datingCoverTab);
    }
    if (typeof draft.privateCardShowHostAndMessage === 'boolean') {
      setDatingCardShowHostAndMessage(draft.privateCardShowHostAndMessage);
    }
    if (draft.privateCardTextBackdropTone) {
      setDatingCardTextBackdropTone(draft.privateCardTextBackdropTone);
    }
    const restoredMedia = await restoreEditorMedia(draft.media);
    if (restoredMedia) {
      setMediaData(restoredMedia);
      datingCoverDraftsRef.current[datingCoverTabRef.current] = restoredMedia;
    }
    const restoredStash = await restoreCoverMediaStash(draft.coverMediaStash, restoreEditorMedia);
    if (restoredStash.length) {
      setCoverMediaStash(restoredStash);
      if (!restoredMedia) {
        const last = restoredStash[restoredStash.length - 1];
        setMediaData(last.media);
        if (last.kind) {
          setDatingCoverTab(
            last.kind === 'camera' ? 'camera' : last.kind === 'ai' ? 'ai' : 'upload'
          );
          datingCoverDraftsRef.current[last.kind] = last.media;
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
    privateCardThemeColor,
    cardCopyOffsetY,
    cardCopyWidthPct,
    cardCopyFontScale,
    cardBackgroundId,
    cardGradientId,
    datingCoverTab,
    privateCardShowHostAndMessage,
    privateCardTextBackdropTone,
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
      datingCoverDraftsRef.current.ai = activeMedia;
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
        type: 'Private',
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
        privateCardThemeColor,
        privateCardShowHostAndMessage,
        privateCardTextBackdropTone,
        sanitizeDraft: sanitizeFirestoreDraft
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
  privateCardThemeColor,
  privateCardShowHostAndMessage,
  privateCardTextBackdropTone,
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

    const quota = canCreateSocialInvitation('private');
    if (!editInvitation && !quota.profileLoading && !quota.canCreate) {
      showToast(
        t(
          'dine_credits_dating_insufficient',
          `Publishing costs ${PRIVATE_INVITATION_PUBLISH_CREDITS} Dine Credits. Open Settings → Dine Credits to top up.`
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
      navigate(`/invitation/private/preview/${result.draftId}`, { replace: true });
    } catch (error) {
      console.error('Error creating dating draft:', error);
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
  const publishCost = PRIVATE_INVITATION_PUBLISH_CREDITS;
  const lowCredits = !isUnlimited && !profilePending && dineBalance < publishCost;

  const datingCoverTabLabel = useMemo(() => {
    const labels = {
      camera: t('social_cover_tab_camera_record', { defaultValue: 'Record video' }),
      upload: t('social_cover_tab_upload_device', { defaultValue: 'Upload from device' }),
      template: t('private_cover_tab_template', { defaultValue: 'Template' }),
      ai: t('social_cover_tab_ai_generate', { defaultValue: 'Generate AI cover' })
    };
    return labels[datingCoverTab] || '';
  }, [datingCoverTab, t]);

  return (
    <div className="private-create-wrapper private-theme private-invite-page">
            <div className="private-header-premium private-invite-header">
                <button type="button" onClick={handleBack} className="private-back-btn">
                    <FaChevronLeft />
                </button>
                <div className="private-header-badge private-invite-header__badge">
                    {t('personal_invite_badge', 'Personal invite')}
                </div>
                <AppText as="h2" className="private-header-title private-invite-header__title">
                    {t('personal_invite_title', 'Personal invite')}
                </AppText>
                <AppText as="p" className="private-header-desc">
                    {t(
            'personal_invite_subtitle',
            'Invite one person for a spontaneous meetup — pick the category that fits.'
          )}
                </AppText>

                {!quotaInfo.profileLoading &&
        <div
          className={`private-invite-header__credits${
          lowCredits ? ' private-invite-header__credits--low' : ''}${
          isUnlimited ? ' private-invite-header__credits--unlimited' : ''}`}>

                        <AppText as="span">{isUnlimited ? '∞' : `${dineBalance}`}</AppText>
                        <AppText as="span" className="private-invite-header__credits-text">
                            {isUnlimited ?
            t('unlimited_date_invitations', 'Unlimited private invites') :
            t(
              'dine_credits_dating_banner',
              '{{balance}} Dine Credits — publishing uses {{cost}} credits.',
              { balance: dineBalance, cost: publishCost }
            )}
                        </AppText>
                    </div>
        }
            </div>

            <div className="private-form-container" style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
                <form onSubmit={(e) => e.preventDefault()} className="elegant-form">

                    <SocialInvitationInviteePanel
            mode="dating"
            step="create"
            invitationId={existingDraftId}
            invitedFriendIds={formData.invitedFriends || []}
            onInvitedFriendsChange={handlePrivateInviteesChange}
            className="mb-3" />

                    {privateInviteeProfile?.id && normalizeLookingFor(privateInviteeProfile.lookingFor).length > 0 ?
            <div className="private-invitee-recipient-preview mb-3">
                        <AppText as="p" className="private-invitee-recipient-preview__label">
                            {t('profile_looking_for_title', 'Looking for')}
                        </AppText>
                        <LookingForChips
                ids={privateInviteeProfile.lookingFor}
                className="private-invitee-recipient-preview__chips"
                chipClassName="private-invitee-recipient-preview__chip" />
                    </div> :
            null}


                    <div className="form-group mb-4">
                        <label className="elegant-label">
                            {t('personal_invite_category_label', 'Purpose of invitation')}
                        </label>
                        <div className="personal-invite-categories" role="group" aria-label={t('personal_invite_category_label', 'Purpose of invitation')}>
                            {PERSONAL_INVITE_CATEGORIES.map((cat) => {
                const selected = formData.personalInviteCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    className={`private-occasion-chip personal-invite-purpose-chip${selected ? ' private-occasion-chip--selected' : ''}`}
                    aria-pressed={selected}
                    onClick={() => handlePersonalInviteCategoryChange(cat.id)}>

                                        <AppText as="span" className="private-occasion-chip__icon" aria-hidden>
                                            {cat.icon}
                                        </AppText>
                                        <AppText as="span" className="private-occasion-chip__label personal-invite-purpose-chip__label">
                                            {t(cat.labelKey, cat.defaultLabel)}
                                        </AppText>
                                    </button>);

              })}
                        </div>
                    </div>

                    {/* Date & time — one compact row */}
                    <div className="form-group mb-3 private-datetime-inline">
                        <label className="elegant-label private-datetime-inline__label">
                            <FaCalendarAlt aria-hidden /> {t('date_and_time', 'Date & time')}
                        </label>
                        <div className="private-datetime-inline__row">
                            <input
                type="date"
                name="date"
                value={formData.date}
                onChange={handleChange}
                className="elegant-input private-datetime-inline__input"
                min={new Date().toISOString().split('T')[0]}
                required
                aria-label={t('date')} />

                            <input
                type="time"
                name="time"
                value={formData.time}
                onChange={handleChange}
                className="elegant-input private-datetime-inline__input"
                required
                aria-label={t('time')} />

                        </div>
                    </div>

                    <InvitationVenueLocationSection
              value={formData.location}
              onChange={(e) => setFormData((prev) => ({ ...prev, location: e.target.value }))}
              onSelect={handleLocationSelect}
              city={formData.city}
              countryCode={resolveVenueCountryIso(formData, userProfile)}
              userLat={formData.userLat ?? userProfile?.coordinates?.lat}
              userLng={formData.userLng ?? userProfile?.coordinates?.lng}
              className="elegant-input"
            />

                    <div className="mb-4">
                        <AIFloatingLauncher
              postType="invitation"
              subType="date"
              onTextSuccess={handleDatingInvitationAiContent}
              buildContextPrompt={buildDatingInvitationAiPrompt}
              privateAiContext={privateAiContext}
              getPrivateAiContext={getPrivateAiContext}
              disabled={isSubmitting}
              disabledHint={!datingAiReady ? datingAiDisabledHint : undefined} />

                    </div>

                    <div
            ref={datingAiFieldsRef}
            className={`private-ai-text-fields mb-4${datingAiFieldsPulse ? ' private-ai-text-fields--pulse' : ''}`}>

                        <AppText as="p"
            className="private-ai-text-fields__hint"
            style={{
              fontSize: '0.78rem',
              color: 'var(--text-muted)',
              margin: '0 0 12px',
              lineHeight: 1.45
            }}>

                            {t('private_ai_text_fields_hint', {
                defaultValue:
                'Use AI above to draft the title and message, or write them yourself.'
              })}
                        </AppText>

                        <div className="form-group mb-4">
                            <label className="elegant-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                                {t('invitation_title')}
                                <AppText as="span"
                style={{
                  fontSize: '0.75rem',
                  color:
                  (formData.title?.length || 0) >= INVITATION_CARD_TITLE_MAX ?
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
              style={bidiFieldProps.style} />

                        </div>
                    </div>

                    {/* Card + cover: one preview row; thumbnails only on the right (template / upload / camera) */}
                    <div className="private-section-card private-section-card--templates mb-4" style={{ borderColor: 'rgba(236,72,153,0.25)' }}>
                        <AppText as="h3" className="private-section-card__title" style={{ color: '#ec4899' }}>
                            <AppText as="span" aria-hidden>🃏</AppText>{' '}
                            {t('social_section_templates_title', { defaultValue: 'Ready card looks' })}
                        </AppText>
                        <input
              ref={coverUploadInputRef}
              type="file"
              accept="image/*"
              className="private-cover-upload-input"
              onChange={handleDatingCoverUploadPick}
              tabIndex={-1}
              aria-hidden />

                        <div className="private-cover-tabs-wrap">
                            <AppText as="p" className="private-cover-tabs__active-label" aria-live="polite">
                                {datingCoverTabLabel}
                            </AppText>
                            <div
                role="tablist"
                aria-label={t('private_cover_tabs_label', { defaultValue: 'Cover source' })}
                className="private-cover-tabs private-cover-tabs--icons-only">

                            <button
                  type="button"
                  role="tab"
                  aria-selected={datingCoverTab === 'camera'}
                  onClick={handleDatingCoverCameraTabClick}
                  className={`private-cover-tab${datingCoverTab === 'camera' ? ' private-cover-tab--active' : ''}`}
                  title={t('social_cover_tab_camera_open', { defaultValue: 'Video' })}
                  aria-label={t('social_cover_tab_camera_open', { defaultValue: 'Video' })}>

                                <FaCamera aria-hidden />
                            </button>
                            <button
                  type="button"
                  role="tab"
                  aria-selected={datingCoverTab === 'upload'}
                  onClick={handleDatingCoverUploadTabClick}
                  className={`private-cover-tab${datingCoverTab === 'upload' ? ' private-cover-tab--active' : ''}`}
                  title={t('social_cover_tab_upload_open', { defaultValue: 'From device' })}
                  aria-label={t('social_cover_tab_upload_open', { defaultValue: 'From device' })}>

                                <FaUpload aria-hidden />
                            </button>
                            <button
                  type="button"
                  role="tab"
                  aria-selected={datingCoverTab === 'template'}
                  onClick={() => handleDatingCoverTab('template')}
                  className={`private-cover-tab${datingCoverTab === 'template' ? ' private-cover-tab--active' : ''}`}
                  title={t('private_cover_tab_template', { defaultValue: 'Template' })}
                  aria-label={t('private_cover_tab_template', { defaultValue: 'Template' })}>

                                <FaImage aria-hidden />
                            </button>
                            <button
                  type="button"
                  role="tab"
                  aria-selected={datingCoverTab === 'ai'}
                  onClick={handleDatingCoverAiTabClick}
                  className={`private-cover-tab${datingCoverTab === 'ai' ? ' private-cover-tab--active' : ''}`}
                  title={t('social_cover_tab_ai_generate', { defaultValue: 'Generate AI cover' })}
                  aria-label={t('social_cover_tab_ai_generate', { defaultValue: 'Generate AI cover' })}>

                                <FaMagic aria-hidden />
                            </button>
                            </div>
                        </div>

                        <div style={{ display: datingCoverTab === 'camera' ? 'block' : 'none' }}>
                            <PrivateCoverCameraPanel
              onMediaSelect={handleCameraCoverMedia}
              openNonce={cameraOpenNonce}
              preOpenedStreamRef={pendingCameraStreamRef} />
                        </div>

                        <SocialInvitationAiCoverPanel
              open={aiCoverSheetOpen}
              onClose={() => setAiCoverSheetOpen(false)}
              subType="date"
              buildBrief={buildDatingInvitationAiPrompt}
              onUseImage={handleAiCoverImageGenerated}
              disabled={isSubmitting} />


                        <div className="form-group mb-0">
                            <div className="private-card-preview-with-bg">
                                <div className="private-card-preview-with-bg__preview-wrap">
                                    <PrivateCardPreviewStage
                    showHostAndMessage={privateCardShowHostAndMessage}
                    onShowHostAndMessageChange={setDatingCardShowHostAndMessage}
                    editorPhotoBackgroundActive={editorPhotoBackgroundActive}
                    textBackdropTone={privateCardTextBackdropTone}
                    onTextBackdropToneChange={setDatingCardTextBackdropTone}
                    copyOffsetY={cardCopyOffsetY}
                    copyWidthPct={cardCopyWidthPct}
                    copyFontScale={cardCopyFontScale}
                    onCopyOffsetYChange={setCardCopyOffsetY}
                    onCopyWidthPctChange={setCardCopyWidthPct}
                    onCopyFontScaleChange={setCardCopyFontScale}
                    fontId={cardFontId}
                    themeColorHex={privateCardThemeColor}
                    onFontChange={setCardFontId}
                    onThemeColorChange={setDatingCardThemeColor}>

                                        <SocialInvitationCardPreview
                      cardTemplateSet="dating"
                      className="social-invitation-card-preview--showcase social-invitation-card-preview--showcase-compact social-invitation-card-preview--private-editor-meta"
                      frameColorId={cardFrameColorId}
                      cardThemeColor={privateCardThemeColor}
                      cardFontId={cardFontId}
                      copyOffsetY={cardCopyOffsetY}
                      copyWidthPct={cardCopyWidthPct}
                      copyFontScale={cardCopyFontScale}
                      occasionType={formData.occasionType}
                      occasionCategoryId={formData.personalInviteCategory}
                      cardBackgroundId={cardBackgroundId}
                      cardGradientId={cardGradientId}
                      cardStructure={privateAiContext.cardStructure}
                      heroCoverSrc={privatePreviewHeroCover?.src ?? null}
                      heroCoverMediaType={privatePreviewHeroCover?.mediaType ?? null}
                      heroCoverPoster={privatePreviewHeroCover?.poster ?? null}
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
                      textBackdropTone={privateCardTextBackdropTone} />

                                    </PrivateCardPreviewStage>
                                    <SocialInvitationCoverRightRail
                    templateVariant="dating"
                    personalInviteCategory={formData.personalInviteCategory}
                    cardBackgroundId={cardBackgroundId}
                    onCardBackgroundIdChange={handleDatingCardBackgroundChange}
                    mode={datingCoverTab}
                    mediaData={mediaData}
                    coverStash={coverMediaStash}
                    onSelectStashItem={handleSelectCoverStashItem}
                    onRemoveStashItem={handleRemoveCoverStashItem}
                    committingStashId={aiCoverCommittingId} />

                                </div>
                            </div>
                        </div>
                    </div>

                    <SocialInvitationEditorFooter
            variant="dating"
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

export default CreatePrivateInvitation;