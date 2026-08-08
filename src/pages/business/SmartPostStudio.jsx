import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import {
  FaFont,
  FaEye,
  FaHighlighter,
  FaPalette,
  FaSlidersH,
  FaTextHeight,
  FaTags,
  FaSave,
  FaPaperPlane } from
'react-icons/fa';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { uploadPostMedia } from '../../utils/imageUpload';
import {
  getImageUploadErrorMessage,
  notifyImageUploadError } from
'../../utils/imageModerationErrors';

function studioPostErrorMessage(err, t) {
  const code = String(err?.code || '');
  if (code === 'permission-denied' || code.includes('permission')) {
    return t('studio_post_permission_denied');
  }
  if (code === 'unauthenticated') {
    return t('studio_post_sign_in');
  }
  return getImageUploadErrorMessage(err, t, 'post_failed');
}
import StudioLivePreview from '../../features/motion-post/studio/StudioLivePreview';
import {
  STUDIO_LAYOUTS,
  STUDIO_PROMO_STICKERS,
  STUDIO_QUICK_STYLES,
  STUDIO_PROMO_MAX,
  pickPromoCornerSlot,
  STUDIO_STYLE_PRESETS,
  layoutToMotionUi,
  studioFontsForLanguage } from
'../../features/motion-post/studio/studioConstants';
import {
  StudioAlignPanel,
  StudioEffectsPanel,
  StudioColorsPanel,
  StudioPromoPanel,
  StudioTransparencyPanel,
  StudioTypographyPanel,
  StudioStepperRow } from
'../../features/motion-post/studio/StudioToolPanels';
import {
  createMotionPostDraft,
  publishMotionPost,
  updateMotionPostDraft } from
'../../features/motion-post/motionPostDraftService';
import { syncPublishedMotionPostToCommunityFeed } from '../../features/motion-post/motionPostFeedPublish';
import {
  STUDIO_ANIM_DURATION_MS,
  STUDIO_TEXT_ANIMATIONS,
  normalizeStudioTextAnimation } from
'../../features/motion-post/studio/studioTextAnimation';
import AIFloatingLauncher from '../../components/AIFloatingLauncher';
import { extractAIContentFields, mapAiAnimationToStudio } from '../../utils/aiContentFieldMapper';
import { buildAnimatedPostAiUserPrompt } from '../../utils/aiPromptLocale';
import { parseAiStudioImageFromState } from '../../utils/aiStudioImagePayload';
import { pickAiRemoteImageUrl } from '../../utils/aiGeneratedMediaUrl';
import { ensurePublicImageUrl } from '../../services/mediaService';
import StudioTextComposerOverlay from '../../features/motion-post/studio/StudioTextComposerOverlay';
import { useEditorSessionAutosave } from '../../hooks/useEditorSessionAutosave';
import {
  isMotionStudioDraftEmpty,
  motionStudioDraftKey,
  restoreEditorMedia,
  serializeEditorMedia } from
'../../utils/editorSessionDraft';
import './SmartPostStudio.css';
import { AppText } from "../../components/base";

const MOBILE_COMPOSER_MQ = '(max-width: 1023px)';

function readMobileComposerEnabled() {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia(MOBILE_COMPOSER_MQ).matches;
}

const DEFAULT_STYLE = {
  ...STUDIO_STYLE_PRESETS.modern,
  preset: 'modern',
  fontId: 'cairo',
  animation: 'slide'
};

function StudioToolRail({ tools, activeTool, onToggle, t, showLabels = false, aiSlot = null }) {
  return (
    <nav
      className="sps-tool-rail"
      role="toolbar"
      aria-label={t('studio_edit_tools')}>

            {aiSlot ?
      <>
                    <div className="sps-tool-rail__ai">{aiSlot}</div>
                    <div className="sps-tool-rail__sep" aria-hidden />
                </> :
      null}
            {tools.map((tool) => {
        const Icon = tool.icon;
        const isActive = activeTool === tool.id;
        const label = t(tool.labelKey);
        return (
          <button
            key={tool.id}
            type="button"
            className={`sps-tool-rail__btn${isActive ? ' active' : ''}`}
            onClick={() => onToggle(tool.id)}
            aria-label={label}
            aria-expanded={isActive}
            title={label}>

                        <Icon size={16} aria-hidden />
                        {showLabels ? <AppText as="span" className="sps-tool-rail__label">{label}</AppText> : null}
                    </button>);

      })}
        </nav>);

}

function StudioAnimStrip({ animations, activeAnim, onSelect, t }) {
  return (
    <nav
      className="sps-anim-strip"
      role="toolbar"
      aria-label={t('studio_text_entrance')}>

            {animations.map((anim) => {
        const isActive = activeAnim === anim.id;
        const label = t(anim.labelKey, anim.label);
        return (
          <button
            key={anim.id}
            type="button"
            className={`sps-anim-strip__btn${isActive ? ' active' : ''}`}
            onClick={() => onSelect(anim.id)}
            aria-label={label}
            aria-pressed={isActive}
            title={label}>

                        <AppText as="span" className="sps-anim-strip__label">{label}</AppText>
                    </button>);

      })}
        </nav>);

}

function StudioQuickStyles({ styles, onApply, t, layout = 'horizontal' }) {
  return (
    <div className={`sps-quick-styles sps-quick-styles--${layout}`}>
            <AppText as="span" className="sps-quick-styles__label">{t('studio_quick_styles')}</AppText>
            <div className="sps-quick-styles__track">
                {styles.map((qs) =>
        <button
          key={qs.id}
          type="button"
          className="sps-quick-chip"
          style={{ '--sps-chip-accent': qs.patch.textColor }}
          onClick={() => onApply(qs.patch)}>

                        <AppText as="span" className="sps-quick-chip__dot" aria-hidden />
                        <AppText as="span" className="sps-quick-chip__label">{t(qs.labelKey, qs.label)}</AppText>
                    </button>
        )}
            </div>
        </div>);

}

function StudioPublishActions({
  canPublish,
  isBusy,
  savingDraft,
  publishing,
  onSaveDraft,
  onClose,
  onPublish,
  t
}) {
  return (
    <div className="sps-actions">
            <button
        type="button"
        className="sps-actions__ghost"
        disabled={!canPublish || isBusy}
        onClick={onSaveDraft}>

                <FaSave aria-hidden />
                {savingDraft ?
        t('studio_saving_draft') :
        t('studio_save_draft')}
            </button>
            <button
        type="button"
        className="sps-actions__close"
        disabled={isBusy}
        onClick={onClose}>

                {t('studio_close', 'Close')}
            </button>
            <button
        type="button"
        className="sps-actions__export"
        disabled={!canPublish || isBusy}
        onClick={onPublish}
        title={t('studio_publish_hint')}>

                <FaPaperPlane aria-hidden />
                {publishing ? t('posting') : t('studio_publish')}
            </button>
        </div>);

}

/** @typedef {string} StudioToolId */

const EDITOR_TOOLS = [
{ id: 'align', icon: FaSlidersH, labelKey: 'studio_tool_align' },
{ id: 'size', icon: FaTextHeight, labelKey: 'studio_tool_size' },
{ id: 'font', icon: FaFont, labelKey: 'studio_tool_font' },
{ id: 'transparency', icon: FaEye, labelKey: 'studio_tool_transparency' },
{ id: 'colors', icon: FaPalette, labelKey: 'studio_tool_colors' },
{ id: 'effects', icon: FaHighlighter, labelKey: 'studio_tool_effects' },
{ id: 'promo', icon: FaTags, labelKey: 'studio_tool_promo' }];


export default function SmartPostStudio() {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const editMotionPostId = location.state?.editMotionPostId ?
  String(location.state.editMotionPostId) :
  null;
  const isRtl = i18n.language === 'ar' || i18n.language?.startsWith('ar');
  const { currentUser, userProfile } = useAuth();
  const { showToast } = useToast();

  const [layoutModel, setLayoutModel] = useState('square');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [media, setMedia] = useState(null);
  const [studioStyle, setStudioStyle] = useState(DEFAULT_STYLE);
  const [activeField, setActiveField] = useState('title');
  const [activeTool, setActiveTool] = useState(null);
  const [publishing, setPublishing] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [promoStickers, setPromoStickers] = useState(
    /** @type {{ id: string; stickerId: string; slot: string }[]} */[]
  );
  const [animPlayKey, setAnimPlayKey] = useState(1);
  const [editingMotionId, setEditingMotionId] = useState(editMotionPostId);
  const [loadingEdit, setLoadingEdit] = useState(Boolean(editMotionPostId));
  const fileInputRef = useRef(null);
  const previewZoneRef = useRef(null);
  const cardRef = useRef(null);
  const mobileComposerRef = useRef(null);
  const [isTyping, setIsTyping] = useState(false);
  const [useMobileComposer, setUseMobileComposer] = useState(readMobileComposerEnabled);
  const [showCloseDialog, setShowCloseDialog] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_COMPOSER_MQ);
    const sync = () => setUseMobileComposer(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    return () => {
      if (media?.preview && String(media.preview).startsWith('blob:')) {
        URL.revokeObjectURL(media.preview);
      }
    };
  }, [media?.preview]);

  useEffect(() => {
    const studio = parseAiStudioImageFromState(location.state?.aiStudioImage);
    if (!studio) return;
    setMedia({ preview: studio.publishedUrl, url: studio.publishedUrl });
  }, [location.state?.aiStudioImage]);

  useEffect(() => {
    if (!editMotionPostId || !currentUser?.uid) {
      setLoadingEdit(false);
      return undefined;
    }

    let cancelled = false;
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'business_motion_posts', editMotionPostId));
        if (cancelled) return;
        if (!snap.exists()) {
          showToast(t('post_not_found', 'Post not found.'), 'error');
          return;
        }
        const data = snap.data();
        if (data.ownerId !== currentUser.uid) {
          showToast(t('post_edit_denied', 'You can only edit your own posts.'), 'error');
          return;
        }
        const content =
        data.content && typeof data.content === 'object' ? data.content : {};
        setTitle(String(content.title || ''));
        setBody(String(content.description || content.subtitle || ''));
        const imageUrl = String(
          data.media && data.media.imageUrl || content.imageUrl || ''
        ).trim();
        if (imageUrl) {
          setMedia({ preview: imageUrl });
        }
        const se =
        data.studioEditor && typeof data.studioEditor === 'object' ?
        data.studioEditor :
        null;
        if (se?.layoutModel) setLayoutModel(se.layoutModel);
        if (se?.style && typeof se.style === 'object') {
          setStudioStyle((s) => ({ ...s, ...se.style }));
        }
        if (Array.isArray(se?.promoStickers)) {
          setPromoStickers(se.promoStickers);
        }
        if (se?.textAnimation) {
          setStudioStyle((s) => ({
            ...s,
            animation: normalizeStudioTextAnimation(se.textAnimation)
          }));
        }
        setEditingMotionId(editMotionPostId);
      } catch (err) {
        console.error('[SmartPostStudio] load edit', err);
        if (!cancelled) showToast(t('post_failed', 'Failed to load post.'), 'error');
      } finally {
        if (!cancelled) setLoadingEdit(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [editMotionPostId, currentUser?.uid, showToast, t]);

  const previewStyle = useMemo(
    () => ({
      fontFamily: studioStyle.fontFamily,
      fontSize: studioStyle.titleFontSize ?? studioStyle.fontSize,
      titleFontSize: studioStyle.titleFontSize ?? studioStyle.fontSize ?? 26,
      bodyFontSize:
      studioStyle.bodyFontSize ??
      Math.max(14, (studioStyle.titleFontSize ?? studioStyle.fontSize ?? 26) - 4),
      fontWeight: studioStyle.fontWeight,
      fontStyle: studioStyle.fontStyle || 'normal',
      textAlign: studioStyle.textAlign,
      textVerticalAlign: studioStyle.textVerticalAlign || 'center',
      textColor: studioStyle.textColor || '#ffffff',
      subtitleColor: studioStyle.subtitleColor || '#ff9d2e',
      backgroundColor: studioStyle.backgroundColor || 'transparent',
      overlayTintColor: studioStyle.overlayTintColor ?? '#000000',
      overlayOpacity: studioStyle.overlayOpacity ?? 35,
      opacity: studioStyle.opacity ?? 100,
      glowIntensity: studioStyle.glowIntensity ?? 28,
      textStroke: studioStyle.textStroke,
      strokeWidth: studioStyle.strokeWidth ?? 2,
      strokeColor: studioStyle.strokeColor || '#000000',
      shadowDepth: studioStyle.shadowDepth ?? 55,
      shadowBlur: studioStyle.shadowBlur ?? 14,
      shadowOffsetX: studioStyle.shadowOffsetX ?? 0,
      shadowOffsetY: studioStyle.shadowOffsetY ?? 4,
      shadowColor: studioStyle.shadowColor || '#000000',
      glowColor: studioStyle.glowColor,
      titleColorMode: 'solid',
      bodyColorMode: 'solid',
      letterSpacing: studioStyle.letterSpacing ?? 0,
      lineHeight: studioStyle.lineHeight ?? 1.25,
      textShadow: studioStyle.textShadow !== false,
      textStackGap: studioStyle.textStackGap ?? 6,
      textPaddingTop: studioStyle.textPaddingTop ?? 0,
      textPaddingBottom: studioStyle.textPaddingBottom ?? 0
    }),
    [studioStyle]
  );

  const studioFonts = useMemo(() => studioFontsForLanguage(i18n.language), [i18n.language]);

  const applyFont = useCallback(
    (fontId) => {
      const font = studioFonts.find((f) => f.id === fontId);
      if (!font) return;
      setStudioStyle((s) => ({
        ...s,
        fontFamily: font.family,
        fontId: font.id
      }));
    },
    [studioFonts]
  );

  useEffect(() => {
    const list = studioFontsForLanguage(i18n.language);
    setStudioStyle((s) => {
      if (list.find((f) => f.id === s.fontId)) return s;
      const first = list[0];
      if (!first) return s;
      return { ...s, fontFamily: first.family, fontId: first.id };
    });
  }, [i18n.language]);

  const toggleTool = (toolId) => {
    setActiveTool((prev) => prev === toolId ? null : toolId);
  };

  const selectLayout = (id) => {
    setLayoutModel(id);
    setAnimPlayKey((k) => k + 1);
  };

  const selectTextAnimation = useCallback((animId) => {
    const next = normalizeStudioTextAnimation(animId);
    setStudioStyle((s) => ({ ...s, animation: next }));
    setAnimPlayKey((k) => k + 1);
  }, []);

  const buildAnimatedAiPrompt = useCallback(
    () => buildAnimatedPostAiUserPrompt({ title, body }),
    [title, body]
  );

  const handleAnimatedAiContent = useCallback(
    (data) => {
      const fields = extractAIContentFields('animated_post', data);
      if (fields.title) setTitle(fields.title);
      if (fields.description) setBody(fields.description);
      if (fields.animation_type) {
        selectTextAnimation(mapAiAnimationToStudio(fields.animation_type));
      }
    },
    [selectTextAnimation]
  );

  const openImagePicker = () => {
    fileInputRef.current?.click();
  };

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) {
      showToast(t('only_images_allowed', 'Please select an image file.'), 'error');
      return;
    }
    if (media?.preview) URL.revokeObjectURL(media.preview);
    setMedia({ file, preview: URL.createObjectURL(file) });
    e.target.value = '';
  };

  const handleFieldFocus = useCallback((field) => {
    setActiveField(field);
    setActiveTool(null);
    if (useMobileComposer) {
      mobileComposerRef.current?.focusField(field);
      setIsTyping(true);
    }
  }, [useMobileComposer]);

  const closeMobileComposer = useCallback(() => {
    setIsTyping(false);
  }, []);

  const dismissStudioEditors = useCallback(() => {
    setIsTyping(false);
    setActiveTool(null);
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  }, []);

  const handleFieldBlur = useCallback(() => {
    if (!useMobileComposer) return;
    window.setTimeout(() => {
      const active = document.activeElement;
      if (active?.closest?.('.sps-text-composer')) return;
      if (active?.closest?.('.sps-preview__editable')) return;
      setIsTyping(false);
    }, 150);
  }, [useMobileComposer]);

  const draftEditId = editMotionPostId || editingMotionId || null;
  const draftStorageKey = useMemo(() => {
    if (!currentUser?.uid) return null;
    return motionStudioDraftKey(currentUser.uid, draftEditId);
  }, [currentUser?.uid, draftEditId]);

  const buildSessionDraftPayload = useCallback(
    async () => ({
      editMotionPostId: draftEditId,
      layoutModel,
      title,
      body,
      studioStyle,
      promoStickers,
      media: await serializeEditorMedia(media, pickAiRemoteImageUrl)
    }),
    [
    body,
    draftEditId,
    layoutModel,
    media,
    promoStickers,
    studioStyle,
    title]

  );

  const applySessionDraftPayload = useCallback(
    async (draft) => {
      if (
      draftEditId &&
      draft.editMotionPostId &&
      String(draft.editMotionPostId) !== String(draftEditId))
      {
        return;
      }
      if (draft.layoutModel) setLayoutModel(draft.layoutModel);
      if (typeof draft.title === 'string') setTitle(draft.title);
      if (typeof draft.body === 'string') setBody(draft.body);
      if (draft.studioStyle && typeof draft.studioStyle === 'object') {
        setStudioStyle((s) => ({ ...s, ...draft.studioStyle }));
      }
      if (Array.isArray(draft.promoStickers)) setPromoStickers(draft.promoStickers);
      const restoredMedia = await restoreEditorMedia(draft.media);
      if (restoredMedia) setMedia(restoredMedia);
    },
    [draftEditId]
  );

  const { clearDraft: clearSessionDraft, flushSave: flushSessionDraft } = useEditorSessionAutosave({
    enabled: Boolean(currentUser?.uid),
    storageKey: draftStorageKey,
    ready: !loadingEdit,
    skipRestore: Boolean(location.state?.aiStudioImage),
    buildPayload: buildSessionDraftPayload,
    applyPayload: applySessionDraftPayload,
    isEmpty: isMotionStudioDraftEmpty,
    onRestored: () =>
    showToast(t('studio_draft_restored', 'Your unsaved work was restored.'), 'info'),
    deps: [layoutModel, title, body, studioStyle, promoStickers, media]
  });

  const hasText = Boolean(title.trim() || body.trim());
  const canPublish = hasText;
  const isBusy = publishing || savingDraft;

  const buildDraftInput = useCallback(async () => {
    if (!currentUser?.uid) throw new Error('Not signed in');
    let imageUrl = pickAiRemoteImageUrl(media);
    if (media?.file) {
      const safeName = String(media.file.name || 'cover.jpg').replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `business-motion/${currentUser.uid}/studio_${Date.now()}_${safeName}`;
      imageUrl = await uploadPostMedia(media.file, currentUser.uid, path, null, 'image');
    } else if (imageUrl) {
      imageUrl = await ensurePublicImageUrl(imageUrl, currentUser.uid, 'business-motion');
    }

    const motionUi = layoutToMotionUi(layoutModel);
    const businessId = userProfile?.businessId || currentUser.uid;
    const tier = String(userProfile?.subscriptionTier || 'free').toLowerCase();
    const publishTitle = title.trim().slice(0, 60) || body.trim().slice(0, 60);
    const publishBody = body.trim().slice(0, 180);

    return {
      ownerId: currentUser.uid,
      businessId,
      subscriptionTier: tier,
      payload: {
        type: 'normal_post',
        format: 'square',
        templateId: 'normal_post_stub_v1',
        content: {
          title: publishTitle,
          description: publishBody,
          imageUrl
        },
        style: {
          animation: normalizeStudioTextAnimation(studioStyle.animation),
          themeId: 'midnight',
          durationMs: STUDIO_ANIM_DURATION_MS
        }
      },
      ui: {
        ...motionUi,
        aiDesign: {
          textPlacement:
          layoutModel === 'header_card' ?
          'bottom_panel' :
          studioStyle.textVerticalAlign || 'center',
          styleMood: studioStyle.preset || 'modern'
        }
      },
      studioEditor: {
        layoutModel,
        style: previewStyle,
        promoStickers,
        textAnimation: normalizeStudioTextAnimation(studioStyle.animation)
      }
    };
  }, [
  body,
  currentUser?.uid,
  layoutModel,
  media?.file,
  media?.preview,
  media?.url,
  previewStyle,
  promoStickers,
  studioStyle.animation,
  studioStyle.preset,
  studioStyle.textVerticalAlign,
  title,
  userProfile?.businessId,
  userProfile?.subscriptionTier]
  );

  const handleSaveDraft = useCallback(async () => {
    if (!canPublish || isBusy) return;
    setSavingDraft(true);
    try {
      const input = await buildDraftInput();
      await createMotionPostDraft(input);
      showToast(t('studio_draft_saved'), 'success');
    } catch (err) {
      console.error('[SmartPostStudio] save draft', err);
      showToast(studioPostErrorMessage(err, t), 'error');
    } finally {
      setSavingDraft(false);
    }
  }, [buildDraftInput, canPublish, isBusy, showToast, t]);

  const hasAnyWork = Boolean(
    title.trim() || body.trim() || media?.preview || promoStickers.length > 0
  );

  const exitStudio = useCallback(() => {
    dismissStudioEditors();
    navigate('/posts-feed', { replace: true });
  }, [dismissStudioEditors, navigate]);

  const handleCloseRequest = useCallback(() => {
    if (!hasAnyWork) {
      clearSessionDraft();
      exitStudio();
      return;
    }
    setShowCloseDialog(true);
  }, [clearSessionDraft, exitStudio, hasAnyWork]);

  const handleCloseSaveDraft = useCallback(async () => {
    setShowCloseDialog(false);
    if (editingMotionId || !hasText) {
      // Editing an existing post (or image-only work): keep the session
      // draft so the work is restored next time the editor opens.
      await flushSessionDraft();
      showToast(t('studio_close_kept_session', 'Your work will be restored when you return.'), 'info');
      exitStudio();
      return;
    }
    setSavingDraft(true);
    try {
      const input = await buildDraftInput();
      await createMotionPostDraft(input);
      clearSessionDraft();
      showToast(t('studio_draft_saved'), 'success');
      exitStudio();
    } catch (err) {
      console.error('[SmartPostStudio] close save draft', err);
      showToast(studioPostErrorMessage(err, t), 'error');
    } finally {
      setSavingDraft(false);
    }
  }, [
  buildDraftInput,
  clearSessionDraft,
  editingMotionId,
  exitStudio,
  flushSessionDraft,
  hasText,
  showToast,
  t]
  );

  const handleCloseDiscard = useCallback(() => {
    setShowCloseDialog(false);
    clearSessionDraft();
    exitStudio();
  }, [clearSessionDraft, exitStudio]);

  const handlePublish = useCallback(async () => {
    if (!canPublish || isBusy) return;
    dismissStudioEditors();
    setPublishing(true);
    try {
      const input = await buildDraftInput();
      if (editingMotionId) {
        await updateMotionPostDraft(editingMotionId, input);
        await syncPublishedMotionPostToCommunityFeed(
          editingMotionId,
          input.ownerId,
          input.businessId
        );
        showToast(t('studio_post_updated'), 'success');
      } else {
        const postId = await createMotionPostDraft(input);
        await publishMotionPost(postId, input.ownerId, input.businessId);
        showToast(t('studio_published_feed'), 'success');
      }
      clearSessionDraft();
      navigate('/posts-feed', { replace: true });
    } catch (err) {
      console.error('[SmartPostStudio] publish', err);
      showToast(studioPostErrorMessage(err, t), 'error');
    } finally {
      setPublishing(false);
    }
  }, [
  buildDraftInput,
  canPublish,
  dismissStudioEditors,
  editingMotionId,
  isBusy,
  clearSessionDraft,
  navigate,
  showToast,
  t]
  );

  const insertPromoSticker = useCallback((stickerId) => {
    if (!STUDIO_PROMO_STICKERS.some((s) => s.id === stickerId)) return;
    setPromoStickers((list) => {
      if (list.length >= STUDIO_PROMO_MAX) return list;
      const slot = pickPromoCornerSlot(list.map((s) => s.slot));
      if (!slot) return list;
      return [
      ...list,
      {
        id: `promo_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        stickerId,
        slot
      }];

    });
  }, []);

  const removePromoSticker = useCallback((instanceId) => {
    setPromoStickers((list) => list.filter((s) => s.id !== instanceId));
  }, []);

  const applyQuickStyle = useCallback(
    (patch) => setStudioStyle((s) => ({ ...s, ...patch })),
    []
  );

  const activeAnim = normalizeStudioTextAnimation(studioStyle.animation);

  const renderToolPanel = () => {
    if (!activeTool) return null;
    const panelProps = { style: studioStyle, setStyle: setStudioStyle, t };

    switch (activeTool) {
      case 'align':
        return <StudioAlignPanel {...panelProps} />;
      case 'size':
        return (
          <div className="sps-glass-panel sps-glass-panel--compact sps-panel--size-dual">
                        <StudioStepperRow
              label={t('studio_title_font_size')}
              value={studioStyle.titleFontSize ?? studioStyle.fontSize ?? 26}
              min={16}
              max={56}
              onChange={(v) =>
              setStudioStyle((s) => ({
                ...s,
                titleFontSize: v,
                fontSize: v
              }))
              }
              suffix="px" />

                        <StudioStepperRow
              label={t('studio_body_font_size')}
              value={
              studioStyle.bodyFontSize ??
              Math.max(14, (studioStyle.titleFontSize ?? studioStyle.fontSize ?? 26) - 4)
              }
              min={12}
              max={40}
              onChange={(v) => setStudioStyle((s) => ({ ...s, bodyFontSize: v }))}
              suffix="px" />

                    </div>);

      case 'font':
        return (
          <StudioTypographyPanel
            {...panelProps}
            fonts={studioFonts}
            applyFont={applyFont} />);


      case 'transparency':
        return <StudioTransparencyPanel {...panelProps} />;
      case 'colors':
        return <StudioColorsPanel {...panelProps} />;
      case 'effects':
        return (
          <StudioEffectsPanel {...panelProps} t={t} />);

      case 'promo':
        return (
          <StudioPromoPanel
            onInsertSticker={insertPromoSticker}
            stickerCount={promoStickers.length}
            t={t} />);


      default:
        return null;
    }
  };

  const previewBlock =
  <>
            <div ref={cardRef} className="sps-canvas-stage__card">
                <StudioLivePreview
        layoutModel={layoutModel}
        title={title}
        body={body}
        imageUrl={media?.preview || ''}
        style={previewStyle}
        activeField={activeField}
        onTitleChange={setTitle}
        onBodyChange={setBody}
        onFocusField={handleFieldFocus}
        onBlurField={handleFieldBlur}
        onImagePick={openImagePicker}
        scrollContainerRef={previewZoneRef}
        imagePickLabel={t('studio_tap_image')}
        imageChangeLabel={t('studio_tap_change_image')}
        promoStickers={promoStickers}
        onRemovePromoSticker={removePromoSticker}
        textAnimation={studioStyle.animation}
        animPlayKey={animPlayKey}
        handoffComposer={useMobileComposer} />

            </div>
            {media?.preview &&
    <button
      type="button"
      className="sps-canvas-clear"
      onClick={() => {
        if (media.preview) URL.revokeObjectURL(media.preview);
        setMedia(null);
      }}
      aria-label={t('remove', 'Remove')}>

                    ×
                </button>
    }
        </>;


  if (loadingEdit) {
    return (
      <div className="sps-page sps-page--premium" dir={isRtl ? 'rtl' : 'ltr'}>
                <div style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--sps-muted)' }}>
                    {t('loading', 'Loading...')}
                </div>
            </div>);

  }

  return (
    <div
      className={`sps-page sps-page--premium${activeTool ? ' sps-page--panel-open' : ''}${isTyping ? ' sps-page--typing' : ''}`}
      dir={isRtl ? 'rtl' : 'ltr'}>

            <nav
        className="sps-layout-strip sps-layout-strip--top"
        role="tablist"
        aria-label={t('studio_layout_tabs')}>

                {STUDIO_LAYOUTS.map((item) =>
        <button
          key={item.id}
          type="button"
          role="tab"
          aria-selected={layoutModel === item.id}
          className={`sps-layout-strip__btn${layoutModel === item.id ? ' active' : ''}`}
          onClick={() => selectLayout(item.id)}>

                        {t(item.labelKey, item.label)}
                    </button>
        )}
            </nav>

            <main className="sps-canvas-zone" ref={previewZoneRef}>
                <div className="sps-canvas-stage">
                    <StudioToolRail
            tools={EDITOR_TOOLS}
            activeTool={activeTool}
            onToggle={toggleTool}
            t={t}
            aiSlot={
            <AIFloatingLauncher
              postType="animated_post"
              onTextSuccess={handleAnimatedAiContent}
              buildContextPrompt={buildAnimatedAiPrompt}
              disabled={isBusy}
              iconOnly
              className="ai-floating-launcher--studio-rail" />

            } />

                    <div className="sps-canvas-stage__viewport">
                        <StudioAnimStrip
              animations={STUDIO_TEXT_ANIMATIONS}
              activeAnim={activeAnim}
              onSelect={selectTextAnimation}
              t={t} />

                        <div className="sps-canvas-stage__preview-shell">{previewBlock}</div>
                    </div>
                </div>
            </main>

            <StudioTextComposerOverlay
        ref={mobileComposerRef}
        enabled={useMobileComposer}
        open={isTyping}
        activeField={activeField}
        title={title}
        body={body}
        onTitleChange={setTitle}
        onBodyChange={setBody}
        onClose={closeMobileComposer}
        dir={isRtl ? 'rtl' : 'ltr'} />


            <section className="sps-editor-dock">
                {activeTool && <div className="sps-editor-panels">{renderToolPanel()}</div>}

                <div className="sps-editor-dock__footer">
                    <StudioQuickStyles
            styles={STUDIO_QUICK_STYLES}
            onApply={applyQuickStyle}
            t={t}
            layout="horizontal" />

                    <StudioPublishActions
            canPublish={canPublish}
            isBusy={isBusy}
            savingDraft={savingDraft}
            publishing={publishing}
            onSaveDraft={handleSaveDraft}
            onClose={handleCloseRequest}
            onPublish={handlePublish}
            t={t} />

                </div>
            </section>

            <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={handleFile} />

            {showCloseDialog ?
      <div
        className="sps-close-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-label={t('studio_close_title', 'Save your work?')}>

                    <div className="sps-close-dialog__backdrop" onClick={() => setShowCloseDialog(false)} />
                    <div className="sps-close-dialog__card">
                        <AppText as="h3" className="sps-close-dialog__title">
                            {t('studio_close_title', 'Save your work?')}
                        </AppText>
                        <AppText as="p" className="sps-close-dialog__text">
                            {t(
              'studio_close_question',
              'Do you want to save this post as a draft before closing?'
            )}
                        </AppText>
                        <div className="sps-close-dialog__actions">
                            <button
              type="button"
              className="sps-close-dialog__btn sps-close-dialog__btn--save"
              onClick={handleCloseSaveDraft}
              disabled={isBusy}>

                                {t('studio_save_draft', 'Save draft')}
                            </button>
                            <button
              type="button"
              className="sps-close-dialog__btn sps-close-dialog__btn--discard"
              onClick={handleCloseDiscard}
              disabled={isBusy}>

                                {t('studio_close_discard', 'Discard')}
                            </button>
                            <button
              type="button"
              className="sps-close-dialog__btn sps-close-dialog__btn--cancel"
              onClick={() => setShowCloseDialog(false)}>

                                {t('studio_close_keep_editing', 'Keep editing')}
                            </button>
                        </div>
                    </div>
                </div> :
      null}
        </div>);

}