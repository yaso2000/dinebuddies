import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import {
  FaBold,
  FaBullhorn,
  FaGamepad,
  FaFont,
  FaHeading,
  FaImage,
  FaItalic,
  FaMicrophone,
  FaPalette,
  FaStop,
  FaTh,
  FaTimes,
  FaTrash,
  FaYoutube,
} from 'react-icons/fa';
import { formatDuration, startRecording } from '../../utils/mediaUtils';
import { dispatchBannerVoiceLocalPlay } from '../../utils/bannerVoiceLocalPlay';
import { setBannerVoiceAudioPriority } from '../../utils/bannerVoiceAudioPriority';
import { useToast } from '../../context/ToastContext';
import { AppText, AppTextInput } from '../base';
import UnifiedCamera from '../UnifiedCamera';
import {
  BANNER_BG_PRESETS,
  BANNER_BG_TRANSPARENT,
  BANNER_BODY_SLOT_COUNT,
  BANNER_BODY_TEXT_INDEX,
  BANNER_TEXT_MAX_TOTAL,
  BANNER_TITLE_FONT_FAMILIES,
  BANNER_VOICE_MAX_DURATION_SEC,
  DEFAULT_BANNER_BG,
  DEFAULT_BANNER_BG2,
  DEFAULT_BANNER_BG_DENSITY,
  DEFAULT_BANNER_FONT_SIZE,
  DEFAULT_BANNER_TITLE_FONT_SIZE,
  clampBannerBodySlotText,
  createDefaultBannerBodySlot,
  createDefaultBannerTitleStyle,
  hasBannerBodyPlainText,
  isBannerBgTransparent,
  resolveBannerBackgroundStyle,
  resolveBannerBodyInlineStyle,
  resolveBannerFontFamilyCss,
  resolveBannerFontSizeCss,
  resolveBannerTitleFontSizeCss,
  resolveBannerTitleInlineStyle,
  sanitizeBannerBgDensity,
  sanitizeBannerBorderWidth,
  sanitizeBannerFontFamily,
  sanitizeBannerHexColor,
  sanitizeBannerTextColor,
  sanitizeBannerTextMaxWidth,
  sumBannerBodyChars,
} from '../../utils/communityChatBanner';
import {
  COMMUNITY_BANNER_TEMPLATES,
  getCommunityBannerTemplatePublicUrl,
} from '../../utils/communityBannerTemplates';
import {
  parseYoutubeLink,
  sanitizeYoutubeVideoId,
} from '../../utils/videoEmbedUtils';
import CommunityBannerYoutubeBackground from './CommunityBannerYoutubeBackground';
import BannerGradientPresetCarousel from './BannerGradientPresetCarousel';
import useZoneThemeModal from './useZoneThemeModal';
import YoutubeSearchModal from '../YoutubeSearchModal';

const TITLE_FONT_FAMILY_OPTIONS = [
  { key: 'system', labelKey: 'community_banner_font_system', fallback: 'System' },
  { key: 'sans', labelKey: 'community_banner_font_sans', fallback: 'Sans' },
  { key: 'serif', labelKey: 'community_banner_font_serif', fallback: 'Serif' },
  { key: 'display', labelKey: 'community_banner_font_display', fallback: 'Display' },
];

const FONT_SIZE_OPTIONS = [
  { key: 'sm', labelKey: 'community_banner_font_sm', fallback: 'S' },
  { key: 'md', labelKey: 'community_banner_font_md', fallback: 'M' },
  { key: 'lg', labelKey: 'community_banner_font_lg', fallback: 'L' },
  { key: 'xl', labelKey: 'community_banner_font_xl', fallback: 'XL' },
];

function BannerToggleRow({ label, children }) {
  return (
    <div className="community-banner-modal__section community-banner-modal__section--compact">
      <AppText as="span" className="community-banner-modal__label">
        {label}
      </AppText>
      <div className="community-banner-modal__toggle-row">{children}</div>
    </div>
  );
}

function BannerIconBtn({ active, onClick, ariaLabel, title, children, className = '' }) {
  return (
    <button
      type="button"
      className={`community-banner-modal__icon-btn${active ? ' community-banner-modal__icon-btn--active' : ''}${className ? ` ${className}` : ''}`}
      aria-pressed={Boolean(active)}
      aria-label={ariaLabel}
      title={title || ariaLabel}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

const KEYBOARD_OPEN_THRESHOLD_PX = 100;

export function BannerToolModal({ title, titleId, onClose, children, footer, headerActions }) {
  const overlayRef = useRef(null);
  const bodyRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const handleClose = (event) => {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    // Blur focused inputs so iOS keyboard does not trap the next tap.
    const active = document.activeElement;
    if (active && typeof active.blur === 'function' && overlayRef.current?.contains(active)) {
      active.blur();
    }
    onCloseRef.current?.();
  };

  // Keep the sheet inside the visible viewport above the iOS/Android keyboard
  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay || typeof window === 'undefined') return undefined;

    const vv = window.visualViewport;
    const clearGeometry = () => {
      overlay.style.top = '';
      overlay.style.left = '';
      overlay.style.width = '';
      overlay.style.height = '';
      overlay.style.right = '';
      overlay.style.bottom = '';
      overlay.classList.remove('community-banner-modal--keyboard');
    };

    if (!vv) return clearGeometry;

    const sync = () => {
      overlay.style.top = `${vv.offsetTop}px`;
      overlay.style.left = `${vv.offsetLeft}px`;
      overlay.style.width = `${vv.width}px`;
      overlay.style.height = `${vv.height}px`;
      overlay.style.right = 'auto';
      overlay.style.bottom = 'auto';

      const keyboardOpen =
        window.innerHeight - vv.height - vv.offsetTop > KEYBOARD_OPEN_THRESHOLD_PX;
      overlay.classList.toggle('community-banner-modal--keyboard', keyboardOpen);

      const active = document.activeElement;
      if (
        keyboardOpen &&
        active &&
        overlay.contains(active) &&
        (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')
      ) {
        active.scrollIntoView({ block: 'center', behavior: 'auto' });
      }
    };

    sync();
    vv.addEventListener('resize', sync);
    vv.addEventListener('scroll', sync);
    window.addEventListener('resize', sync);
    return () => {
      vv.removeEventListener('resize', sync);
      vv.removeEventListener('scroll', sync);
      window.removeEventListener('resize', sync);
      clearGeometry();
    };
  }, []);

  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return undefined;

    const scrollFocusedField = (el) => {
      if (!el) return;
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    };

    const onFocusIn = (event) => {
      const el = event.target;
      if (!el || (el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA')) return;
      requestAnimationFrame(() => scrollFocusedField(el));
      window.setTimeout(() => scrollFocusedField(el), 280);
    };

    body.addEventListener('focusin', onFocusIn);
    return () => body.removeEventListener('focusin', onFocusIn);
  }, []);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        handleClose(event);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      ref={overlayRef}
      className="community-banner-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) handleClose(event);
      }}
      onTouchStart={(event) => {
        if (event.target === event.currentTarget) handleClose(event);
      }}
    >
      <div
        className="community-banner-modal__panel"
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
      >
        <div className="community-banner-modal__head">
          <AppText as="h2" id={titleId} className="community-banner-modal__title">
            {title}
          </AppText>
          <div className="community-banner-modal__head-actions">
            {headerActions}
            <button
              type="button"
              className="community-banner-modal__close"
              aria-label="Close"
              onClick={handleClose}
            >
              <FaTimes size={16} aria-hidden />
            </button>
          </div>
        </div>
        <div ref={bodyRef} className="community-banner-modal__body">
          {children}
        </div>
        {footer ? <div className="community-banner-modal__footer">{footer}</div> : null}
      </div>
    </div>,
    document.body
  );
}

function BannerPreviewStrip({
  banner,
  title,
  body,
  bgColor,
  bgColor2,
  bgDensity = DEFAULT_BANNER_BG_DENSITY,
  fontSize,
  mode,
  onTitleChange,
  onBodyChange,
  t,
}) {
  const transparent = isBannerBgTransparent(bgColor);
  const previewImageUrl = banner.url || '';
  const hasColorOverlay = !transparent;
  const overlayStyle = resolveBannerBackgroundStyle({
    bgColor,
    bgColor2,
    transparent,
    hasBackground: hasColorOverlay,
    bgDensity,
  });
  const textOverImage = Boolean(previewImageUrl && hasColorOverlay);
  const showTitle = mode === 'title' || mode === 'background';
  const showBody = mode === 'body' || mode === 'background';

  return (
    <div
      className={`community-banner-modal__banner-strip${transparent ? ' community-banner-modal__banner-strip--transparent' : ''}${textOverImage ? ' community-banner-modal__banner-strip--layered' : ''}`}
    >
      {previewImageUrl ? (
        <img src={previewImageUrl} alt="" className="community-banner-modal__banner-strip-bg" />
      ) : hasColorOverlay ? (
        <div className="community-banner-modal__banner-strip-fallback" style={overlayStyle} />
      ) : null}
      {hasColorOverlay && previewImageUrl ? (
        <div className="community-banner-modal__banner-strip-overlay" style={overlayStyle} aria-hidden />
      ) : null}
      <div
        className={`community-banner-modal__banner-preview${mode === 'title' ? ' community-banner-modal__banner-preview--title-only' : ''}${mode === 'body' ? ' community-banner-modal__banner-preview--body-only' : ''}`}
      >
        {showTitle ? (
          <div className="community-banner-modal__banner-preview-title">
            {mode === 'title' ? (
              <AppTextInput
                type="text"
                className="community-banner-modal__textarea community-banner-modal__textarea--live community-banner-modal__textarea--title"
                style={{
                  background: textOverImage ? 'transparent' : overlayStyle.background,
                  opacity: textOverImage ? 1 : overlayStyle.opacity,
                  fontSize: resolveBannerTitleFontSizeCss(fontSize),
                }}
                placeholder={t('community_banner_title_placeholder', 'Banner title…')}
                value={title}
                onChange={(e) => onTitleChange?.(e.target.value)}
              />
            ) : (
              <AppText
                as="p"
                className="community-banner-modal__preview-line community-banner-modal__preview-line--title"
                style={{ fontSize: resolveBannerTitleFontSizeCss(fontSize) }}
              >
                {title || t('community_banner_title_placeholder', 'Banner title…')}
              </AppText>
            )}
          </div>
        ) : null}
        {showBody ? (
          <div className="community-banner-modal__banner-preview-body">
            {mode === 'body' ? (
              <AppTextInput
                as="textarea"
                rows={2}
                className="community-banner-modal__textarea community-banner-modal__textarea--live community-banner-modal__textarea--body"
                style={{
                  background: textOverImage ? 'transparent' : overlayStyle.background,
                  opacity: textOverImage ? 1 : overlayStyle.opacity,
                  fontSize: resolveBannerFontSizeCss(fontSize),
                }}
                placeholder={t('community_banner_body_placeholder', 'Banner text…')}
                value={body}
                onChange={(e) => onBodyChange?.(e.target.value)}
              />
            ) : (
              <AppText
                as="p"
                className="community-banner-modal__preview-line community-banner-modal__preview-line--body"
                style={{ fontSize: resolveBannerFontSizeCss(fontSize) }}
              >
                {body || t('community_banner_body_placeholder', 'Banner text…')}
              </AppText>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** Host-only banner tools — image + title + body + background + templates (vertical rail on banner). */
export default function CommunityHostBannerComposerTools({
  room,
  layout = 'banner-rail',
  hostToolsVisible = true,
  onOpenTrivia,
}) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const {
    banner,
    bannerDisplay,
    uploadingBanner,
    setBannerImage,
    clearBannerImage,
    setBannerYoutube,
    setBannerVoice,
    updateBanner,
    setHostSpotlightAuto,
    zoneThemeId,
    zoneThemeSaving,
  } = room;

  const zoneTheme = useZoneThemeModal(room);

  const bannerForPreview = {
    ...banner,
    url: bannerDisplay?.url || banner.url || '',
  };

  const [activeModal, setActiveModal] = useState(null);
  const [titleDraft, setTitleDraft] = useState('');
  const [titleStyleDraft, setTitleStyleDraft] = useState(createDefaultBannerTitleStyle());
  const [editingBodySlot, setEditingBodySlot] = useState(BANNER_BODY_TEXT_INDEX);
  const [bodySlotDraft, setBodySlotDraft] = useState(() =>
    createDefaultBannerBodySlot(BANNER_BODY_TEXT_INDEX)
  );
  const [bgColorDraft, setBgColorDraft] = useState(DEFAULT_BANNER_BG);
  const [bgColor2Draft, setBgColor2Draft] = useState(DEFAULT_BANNER_BG2);
  const [bgDensityDraft, setBgDensityDraft] = useState(DEFAULT_BANNER_BG_DENSITY);
  const [fontSizeDraft, setFontSizeDraft] = useState(DEFAULT_BANNER_FONT_SIZE);
  const [showCamera, setShowCamera] = useState(false);
  const [youtubeDraft, setYoutubeDraft] = useState('');
  const [showYoutubeSearch, setShowYoutubeSearch] = useState(false);
  const [voiceRecording, setVoiceRecording] = useState(false);
  const [voiceRecordingSec, setVoiceRecordingSec] = useState(0);
  const [voicePublishing, setVoicePublishing] = useState(false);
  const voiceStopRef = useRef(null);
  const voiceTimerRef = useRef(null);
  const voiceDurationRef = useRef(0);
  const voiceAutoStopRef = useRef(false);
  const stopVoiceRecordingRef = useRef(async () => {});

  const parsedYoutubeDraft = parseYoutubeLink(youtubeDraft);
  const youtubePreviewId =
    parsedYoutubeDraft?.id ||
    sanitizeYoutubeVideoId(youtubeDraft) ||
    sanitizeYoutubeVideoId(banner.youtubeId);
  const youtubePreviewPlaylistId =
    parsedYoutubeDraft?.playlistId || banner.youtubePlaylistId || '';
  const youtubePreviewReady = Boolean(youtubePreviewId || youtubePreviewPlaylistId);

  const isTransparentBg = isBannerBgTransparent(bgColorDraft);
  const hasYoutubeBanner = Boolean(banner.youtubeId || banner.youtubePlaylistId);
  const hasCustomBannerImage = Boolean(String(banner.url || '').trim()) && !hasYoutubeBanner;
  const hasBannerBackgroundTool =
    hasCustomBannerImage || Boolean(banner.hasBackground && !banner.transparent);

  const readBgFromBanner = () => {
    if (banner.transparent) {
      return {
        color1: BANNER_BG_TRANSPARENT,
        color2: banner.bgColor2 || DEFAULT_BANNER_BG2,
      };
    }
    if (banner.hasBackground) {
      return {
        color1: banner.bgColor || DEFAULT_BANNER_BG,
        color2: banner.bgColor2 || DEFAULT_BANNER_BG2,
      };
    }
    return {
      color1: BANNER_BG_PRESETS[0].color,
      color2: BANNER_BG_PRESETS[0].color2,
    };
  };

  const openTitleModal = () => {
    setTitleDraft(banner.title || '');
    setTitleStyleDraft({ ...createDefaultBannerTitleStyle(), ...(banner.titleStyle || {}) });
    setActiveModal('title');
  };

  const openTextModal = () => {
    const slotIndex = BANNER_BODY_TEXT_INDEX;
    const slot = (banner.texts || [])[slotIndex] || createDefaultBannerBodySlot(slotIndex);
    setEditingBodySlot(slotIndex);
    setBodySlotDraft({
      ...createDefaultBannerBodySlot(slotIndex),
      ...slot,
      mode: 'text',
      url: '',
    });
    setActiveModal('bodyText');
  };

  const openBackgroundModal = () => {
    setTitleDraft(banner.title || '');
    const bg = readBgFromBanner();
    setBgColorDraft(bg.color1);
    setBgColor2Draft(bg.color2);
    setBgDensityDraft(sanitizeBannerBgDensity(banner.bgDensity));
    setFontSizeDraft(banner.fontSize || DEFAULT_BANNER_FONT_SIZE);
    setActiveModal('background');
  };

  const clearVoiceTimer = () => {
    if (voiceTimerRef.current) {
      clearInterval(voiceTimerRef.current);
      voiceTimerRef.current = null;
    }
  };

  const stopVoiceRecording = async (shouldPublish = true) => {
    if (!voiceStopRef.current) return;
    clearVoiceTimer();
    const stop = voiceStopRef.current;
    voiceStopRef.current = null;
    const durationSec = voiceDurationRef.current;
    setVoiceRecording(false);
    setVoiceRecordingSec(0);
    voiceDurationRef.current = 0;

    let blob = null;
    try {
      blob = await stop();
    } catch (err) {
      console.error('[CommunityHostBannerComposerTools] stop voice', err);
      showToast(t('failed_send_voice', 'Could not send voice message.'), 'error');
      voiceAutoStopRef.current = false;
      return;
    }

    if (!shouldPublish || !blob || !setBannerVoice) {
      setBannerVoiceAudioPriority('recording', false);
      voiceAutoStopRef.current = false;
      return;
    }
    if (durationSec < 1 && blob.size < 800) {
      showToast(t('community_banner_voice_too_short', 'Recording is too short.'), 'error');
      setBannerVoiceAudioPriority('recording', false);
      voiceAutoStopRef.current = false;
      return;
    }

    // Play for the host immediately (still inside the stop-tap gesture), then upload.
    // Local play claims playback priority before recording priority is released.
    try {
      const previewUrl = URL.createObjectURL(blob);
      dispatchBannerVoiceLocalPlay(previewUrl, durationSec || 1);
    } catch (err) {
      console.warn('[CommunityHostBannerComposerTools] local voice preview', err);
    }
    setBannerVoiceAudioPriority('recording', false);

    setVoicePublishing(true);
    try {
      await setBannerVoice(blob, durationSec || 1);
    } finally {
      setVoicePublishing(false);
      voiceAutoStopRef.current = false;
    }
  };

  stopVoiceRecordingRef.current = stopVoiceRecording;

  const startVoiceRecording = async () => {
    if (voiceRecording || voicePublishing || uploadingBanner || !setBannerVoice) return;
    try {
      // Voice recording is allowed with YouTube present; pause YT for audio priority.
      setBannerVoiceAudioPriority('recording', true);
      const started = await startRecording();
      voiceStopRef.current = started.stop;
      voiceDurationRef.current = 0;
      voiceAutoStopRef.current = false;
      setVoiceRecording(true);
      setVoiceRecordingSec(0);
      clearVoiceTimer();
      voiceTimerRef.current = setInterval(() => {
        voiceDurationRef.current += 1;
        const next = voiceDurationRef.current;
        setVoiceRecordingSec(next);
        if (next >= BANNER_VOICE_MAX_DURATION_SEC && !voiceAutoStopRef.current) {
          voiceAutoStopRef.current = true;
          void stopVoiceRecordingRef.current(true);
        }
      }, 1000);
    } catch (err) {
      setBannerVoiceAudioPriority('recording', false);
      console.error('[CommunityHostBannerComposerTools] mic', err);
      showToast(t('no_mic_access', 'Microphone access is required.'), 'error');
    }
  };

  const toggleVoiceRecording = () => {
    if (voiceRecording) {
      void stopVoiceRecording(true);
      return;
    }
    void startVoiceRecording();
  };

  useEffect(
    () => () => {
      clearVoiceTimer();
      setBannerVoiceAudioPriority('recording', false);
      if (voiceStopRef.current) {
        void voiceStopRef.current().catch(() => {});
        voiceStopRef.current = null;
      }
    },
    []
  );

  const openYoutubeModal = () => {
    if (banner.youtubeId && banner.youtubePlaylistId) {
      setYoutubeDraft(
        `https://www.youtube.com/watch?v=${banner.youtubeId}&list=${banner.youtubePlaylistId}`
      );
    } else if (banner.youtubePlaylistId) {
      setYoutubeDraft(`https://www.youtube.com/playlist?list=${banner.youtubePlaylistId}`);
    } else if (banner.youtubeLive && banner.youtubeId) {
      setYoutubeDraft(`https://www.youtube.com/live/${banner.youtubeId}`);
    } else if (banner.youtubeMusic && banner.youtubeId) {
      setYoutubeDraft(`https://music.youtube.com/watch?v=${banner.youtubeId}`);
    } else {
      setYoutubeDraft(banner.youtubeId ? `https://youtu.be/${banner.youtubeId}` : '');
    }
    setActiveModal('youtube');
  };

  const closeModal = () => setActiveModal(null);

  const handleMediaCaptured = async (file) => {
    setShowCamera(false);
    if (!file) return;
    await setBannerImage(file);
  };

  const publishTitle = async () => {
    const ok = await updateBanner(
      { title: titleDraft.trim(), titleStyle: titleStyleDraft },
      { clearSpotlight: true }
    );
    if (ok) closeModal();
  };

  const deleteTitle = async () => {
    const ok = await updateBanner({ title: '' }, { clearSpotlight: true });
    if (ok) closeModal();
  };

  const publishBody = async () => {
    const label = String(bodySlotDraft.text || '').trim();
    if (!label) return;

    const texts = (
      banner.texts ||
      Array.from({ length: BANNER_BODY_SLOT_COUNT }, (_, index) =>
        createDefaultBannerBodySlot(index)
      )
    ).map((slot, index) =>
      index === editingBodySlot
        ? {
            ...slot,
            ...bodySlotDraft,
            text: label,
            mode: 'text',
            url: '',
          }
        : slot
    );
    const ok = await updateBanner({ texts }, { clearSpotlight: true });
    if (ok) closeModal();
  };

  const deleteBody = async () => {
    const texts = (
      banner.texts ||
      Array.from({ length: BANNER_BODY_SLOT_COUNT }, (_, index) =>
        createDefaultBannerBodySlot(index)
      )
    ).map((slot, index) =>
      index === editingBodySlot ? createDefaultBannerBodySlot(index) : slot
    );
    const ok = await updateBanner({ texts }, { clearSpotlight: true });
    if (ok) closeModal();
  };

  const updateBodySlotDraft = (patch) => {
    setBodySlotDraft((prev) => {
      const next = { ...prev, ...patch };
      if (patch.text !== undefined) {
        const mergedSlots = (
          banner.texts ||
          Array.from({ length: BANNER_BODY_SLOT_COUNT }, (_, index) =>
            createDefaultBannerBodySlot(index)
          )
        ).map((slot, index) =>
          index === editingBodySlot ? { ...slot, text: '' } : slot
        );
        next.text = clampBannerBodySlotText(patch.text, mergedSlots, editingBodySlot);
      }
      return next;
    });
  };

  const bodySlotsForBudget = (
    banner.texts ||
    Array.from({ length: BANNER_BODY_SLOT_COUNT }, (_, index) =>
      createDefaultBannerBodySlot(index)
    )
  ).map((slot, index) =>
    index === editingBodySlot ? { ...slot, ...bodySlotDraft } : slot
  );
  const bodyCharUsed = sumBannerBodyChars(bodySlotsForBudget);
  const bannerBodySlotHasText = Boolean(
    String((banner.texts || [])[editingBodySlot]?.text || '').trim()
  );
  const bodyPublishDisabled = !String(bodySlotDraft.text || '').trim();

  const publishBackground = async () => {
    const transparent = isBannerBgTransparent(bgColorDraft);
    const ok = await updateBanner({
      bgColor: transparent
        ? BANNER_BG_TRANSPARENT
        : sanitizeBannerHexColor(bgColorDraft),
      bgColor2: transparent
        ? ''
        : sanitizeBannerHexColor(bgColor2Draft, DEFAULT_BANNER_BG2),
      bgDensity: transparent ? DEFAULT_BANNER_BG_DENSITY : sanitizeBannerBgDensity(bgDensityDraft),
      hasBackground: !transparent,
    });
    if (ok) closeModal();
  };

  const openBannerImagePicker = () => {
    // Keep the unified background modal open underneath the camera sheet.
    setShowCamera(true);
  };

  const removeBannerBackgroundImage = async () => {
    if (!hasCustomBannerImage || uploadingBanner) return;
    await clearBannerImage();
  };

  const publishYoutube = async () => {
    const id = parsedYoutubeDraft?.id || sanitizeYoutubeVideoId(youtubeDraft);
    const playlistId = parsedYoutubeDraft?.playlistId || '';
    if (!id && !playlistId) return;
    const ok = await setBannerYoutube(id, {
      isShort: Boolean(parsedYoutubeDraft?.isShort),
      isLive: Boolean(parsedYoutubeDraft?.isLive),
      isMusic: Boolean(parsedYoutubeDraft?.isMusic),
      playlistId,
    });
    if (ok) closeModal();
  };

  const deleteYoutube = async () => {
    const ok = await setBannerYoutube('');
    if (ok) closeModal();
  };

  const resetBtn = (label, disabled, onClick, compact = false) => (
    <button
      type="button"
      className={`community-banner-modal__reset${compact ? ' community-banner-modal__reset--compact' : ''}`}
      disabled={disabled}
      onClick={onClick}
    >
      {label}
    </button>
  );

  const publishBtn = (label, disabled, onClick, compact = false) => (
    <button
      type="button"
      className={`community-main-chat__send-btn community-banner-modal__publish${compact ? ' community-banner-modal__publish--compact' : ''}`}
      disabled={disabled}
      onClick={() => void onClick()}
    >
      {label}
    </button>
  );

  const deleteBtn = (label, onClick, compact = false) => (
    <button
      type="button"
      className={`community-banner-modal__delete${compact ? ' community-banner-modal__delete--compact' : ''}`}
      onClick={() => void onClick()}
    >
      <FaTrash size={compact ? 12 : 14} aria-hidden />
      {label}
    </button>
  );

  const modalFooter = (publishLabel, publishDisabled, onPublish, showDelete, deleteLabel, onDelete, compact = false) => (
    <div className="community-banner-modal__footer-actions">
      {showDelete
        ? deleteBtn(deleteLabel, onDelete, compact)
        : null}
      {publishBtn(publishLabel, publishDisabled, onPublish, compact)}
    </div>
  );

  const titleModal =
    activeModal === 'title' ? (
      <BannerToolModal
        title={t('community_banner_title_tool', 'Banner title')}
        titleId="community-banner-title-modal"
        onClose={closeModal}
        footer={modalFooter(
          t('community_banner_publish_title', 'Publish title'),
          !titleDraft.trim(),
          publishTitle,
          Boolean(banner.title),
          t('community_banner_delete_title', 'Delete title'),
          deleteTitle
        )}
      >
        <BannerPreviewStrip
          banner={bannerForPreview}
          title={titleDraft}
          body={banner.texts?.[0]?.text || banner.text}
          bgColor={readBgFromBanner().color1}
          bgColor2={readBgFromBanner().color2}
          bgDensity={banner.bgDensity}
          fontSize={titleStyleDraft.fontSize || DEFAULT_BANNER_TITLE_FONT_SIZE}
          mode="title"
          onTitleChange={setTitleDraft}
          t={t}
        />
        <BannerToggleRow label={t('community_banner_title_style_toolbar', 'Title style')}>
          <div className="community-banner-modal__icon-toolbar">
            {FONT_SIZE_OPTIONS.map(({ key, labelKey, fallback }) => (
              <BannerIconBtn
                key={key}
                active={titleStyleDraft.fontSize === key}
                ariaLabel={t(labelKey, fallback)}
                onClick={() => setTitleStyleDraft((prev) => ({ ...prev, fontSize: key }))}
              >
                {t(labelKey, fallback)}
              </BannerIconBtn>
            ))}
            {TITLE_FONT_FAMILY_OPTIONS.map(({ key, labelKey, fallback }) => (
              <BannerIconBtn
                key={key}
                active={titleStyleDraft.fontFamily === key}
                ariaLabel={t(labelKey, fallback)}
                onClick={() => setTitleStyleDraft((prev) => ({ ...prev, fontFamily: key }))}
              >
                {key === 'system' ? 'A' : key === 'sans' ? 'S' : key === 'serif' ? 'T' : 'D'}
              </BannerIconBtn>
            ))}
            <label
              className="community-banner-modal__icon-btn community-banner-modal__icon-btn--color"
              title={t('community_banner_title_color', 'Title color')}
            >
              <input
                type="color"
                value={sanitizeBannerTextColor(titleStyleDraft.color)}
                onChange={(e) =>
                  setTitleStyleDraft((prev) => ({ ...prev, color: e.target.value }))
                }
                aria-label={t('community_banner_title_color', 'Title color')}
              />
              <FaPalette size={14} aria-hidden />
            </label>
            <label
              className="community-banner-modal__icon-btn community-banner-modal__icon-btn--color"
              title={t('community_banner_title_stroke_color', 'Outline color')}
            >
              <input
                type="color"
                value={sanitizeBannerTextColor(titleStyleDraft.borderColor, '#000000')}
                onChange={(e) =>
                  setTitleStyleDraft((prev) => ({ ...prev, borderColor: e.target.value }))
                }
                aria-label={t('community_banner_title_stroke_color', 'Outline color')}
              />
              <span className="community-banner-modal__icon-btn-glyph" aria-hidden>
                O
              </span>
            </label>
            <input
              type="range"
              className="community-banner-modal__stroke-slider"
              min={0}
              max={6}
              step={1}
              value={titleStyleDraft.borderWidth || 0}
              aria-label={t('community_banner_title_stroke_width', 'Outline width')}
              title={t('community_banner_title_stroke_width', 'Outline width')}
              onChange={(e) =>
                setTitleStyleDraft((prev) => ({
                  ...prev,
                  borderWidth: sanitizeBannerBorderWidth(e.target.value, 0),
                }))
              }
            />
          </div>
        </BannerToggleRow>
        <AppText
          as="p"
          className="community-banner-modal__preview-line community-banner-modal__preview-line--title"
          style={resolveBannerTitleInlineStyle(titleStyleDraft)}
        >
          {titleDraft || t('community_banner_title_placeholder', 'Banner title…')}
        </AppText>
      </BannerToolModal>
    ) : null;

  const bodyTextModal =
    activeModal === 'bodyText' ? (
      <BannerToolModal
        title={t('community_banner_body_tool', 'Banner text')}
        titleId="community-banner-body-text-modal"
        onClose={closeModal}
        footer={modalFooter(
          t('community_banner_publish_body', 'Publish text'),
          bodyPublishDisabled,
          publishBody,
          bannerBodySlotHasText,
          t('community_banner_delete_body', 'Delete text'),
          deleteBody,
          true
        )}
      >
        <div className="community-banner-modal__section community-banner-modal__section--compact">
          <AppText as="span" className="community-banner-modal__label">
            {t('community_banner_body_tool', 'Banner text')} ({bodyCharUsed}/{BANNER_TEXT_MAX_TOTAL})
          </AppText>
        </div>

        <AppTextInput
          type="text"
          className="community-banner-modal__textarea community-banner-modal__textarea--body community-banner-modal__textarea--compact community-banner-modal__input--single-line"
          style={resolveBannerBodyInlineStyle(bodySlotDraft)}
          placeholder={t('community_banner_body_placeholder', 'Banner text…')}
          value={bodySlotDraft.text || ''}
          onChange={(e) => updateBodySlotDraft({ text: e.target.value })}
        />

        <BannerToggleRow label={t('community_banner_body_style', 'Style')}>
          <div className="community-banner-modal__icon-toolbar">
            {FONT_SIZE_OPTIONS.map(({ key, labelKey, fallback }) => (
              <BannerIconBtn
                key={key}
                active={bodySlotDraft.fontSize === key}
                ariaLabel={t(labelKey, fallback)}
                onClick={() => updateBodySlotDraft({ fontSize: key })}
              >
                {t(labelKey, fallback)}
              </BannerIconBtn>
            ))}
            <label
              className="community-banner-modal__icon-btn community-banner-modal__icon-btn--color"
              title={t('community_banner_body_color', 'Text color')}
            >
              <input
                type="color"
                value={sanitizeBannerTextColor(bodySlotDraft.color)}
                onChange={(e) => updateBodySlotDraft({ color: e.target.value })}
                aria-label={t('community_banner_body_color', 'Text color')}
              />
              <FaPalette size={14} aria-hidden />
            </label>
            <BannerIconBtn
              active={bodySlotDraft.bold}
              ariaLabel={t('community_banner_body_bold', 'Bold')}
              onClick={() => updateBodySlotDraft({ bold: !bodySlotDraft.bold })}
            >
              <FaBold size={14} aria-hidden />
            </BannerIconBtn>
            <BannerIconBtn
              active={bodySlotDraft.italic}
              ariaLabel={t('community_banner_body_italic', 'Italic')}
              onClick={() => updateBodySlotDraft({ italic: !bodySlotDraft.italic })}
            >
              <FaItalic size={14} aria-hidden />
            </BannerIconBtn>
            <input
              type="range"
              className="community-banner-modal__stroke-slider community-banner-modal__stroke-slider--width"
              min={40}
              max={95}
              step={1}
              value={bodySlotDraft.maxWidth || 88}
              aria-label={t('community_banner_body_width', 'Width')}
              title={t('community_banner_body_width', 'Width')}
              onChange={(e) =>
                updateBodySlotDraft({
                  maxWidth: sanitizeBannerTextMaxWidth(e.target.value),
                })
              }
            />
          </div>
        </BannerToggleRow>
      </BannerToolModal>
    ) : null;

  const backgroundModal =
    activeModal === 'background' ? (
      <BannerToolModal
        title={t('community_banner_bg_tool', 'Banner background')}
        titleId="community-banner-bg-modal"
        onClose={closeModal}
        footer={publishBtn(
          t('community_banner_publish_bg', 'Apply background'),
          uploadingBanner,
          publishBackground
        )}
      >
        <BannerPreviewStrip
          banner={bannerForPreview}
          title={titleDraft || banner.title || ''}
          body={(banner.texts || []).map((slot) => slot.text).filter(Boolean).join(' · ')}
          bgColor={bgColorDraft}
          bgColor2={bgColor2Draft}
          bgDensity={bgDensityDraft}
          fontSize={fontSizeDraft}
          mode="background"
          t={t}
        />

        <div className="community-banner-modal__section">
          <AppText as="span" className="community-banner-modal__label">
            {t('community_banner_bg_image', 'Banner image')}
          </AppText>
          <AppText as="span" className="community-banner-modal__hint">
            {t(
              'community_banner_bg_image_hint',
              'Optional photo. Add a color overlay below, or choose Transparent to show the photo alone.'
            )}
          </AppText>
          <div className="community-banner-modal__media-actions">
            <button
              type="button"
              className="community-banner-modal__media-btn"
              onClick={openBannerImagePicker}
              disabled={uploadingBanner}
            >
              <FaImage size={14} aria-hidden />
              {uploadingBanner
                ? t('community_chat_uploading_image', 'Uploading…')
                : hasCustomBannerImage
                  ? t('community_banner_bg_change_image', 'Change photo')
                  : t('community_banner_bg_add_image', 'Add photo')}
            </button>
            {hasCustomBannerImage ? (
              <button
                type="button"
                className="community-banner-modal__media-btn community-banner-modal__media-btn--danger"
                onClick={() => void removeBannerBackgroundImage()}
                disabled={uploadingBanner}
              >
                <FaTrash size={14} aria-hidden />
                {t('community_banner_bg_remove_image', 'Remove photo')}
              </button>
            ) : null}
          </div>
          {hasYoutubeBanner && !hasCustomBannerImage ? (
            <AppText as="span" className="community-banner-modal__hint">
              {t(
                'community_banner_bg_image_replaces_youtube',
                'Adding a photo replaces the current YouTube / Music banner.'
              )}
            </AppText>
          ) : null}
        </div>

        <div className="community-banner-modal__section">
          <AppText as="span" className="community-banner-modal__label">
            {t('community_banner_bg_gradient_optional', 'Color overlay')}
          </AppText>
          <AppText as="span" className="community-banner-modal__hint">
            {t(
              'community_banner_bg_gradient_optional_hint',
              'Pick a gradient over the photo, use gradient alone with no photo, or Transparent for no color.'
            )}
          </AppText>
          <BannerGradientPresetCarousel
            colorStart={bgColorDraft}
            colorEnd={bgColor2Draft}
            showTransparent
            transparentSelected={isTransparentBg}
            onSelectTransparent={() => setBgColorDraft(BANNER_BG_TRANSPARENT)}
            onSelectGradient={(start, end) => {
              setBgColorDraft(sanitizeBannerHexColor(start, DEFAULT_BANNER_BG));
              setBgColor2Draft(sanitizeBannerHexColor(end, DEFAULT_BANNER_BG2));
            }}
            ariaLabel={t('community_banner_bg_gradient_optional', 'Color overlay')}
          />
          {!isTransparentBg ? (
            <div className="community-banner-modal__density">
              <div className="community-banner-modal__density-head">
                <AppText as="span" className="community-banner-modal__label">
                  {t('community_banner_bg_density', 'Density')}
                </AppText>
                <AppText as="span" className="community-banner-modal__density-value">
                  {bgDensityDraft}%
                </AppText>
              </div>
              <input
                type="range"
                className="community-banner-modal__density-slider"
                min={0}
                max={100}
                step={1}
                value={bgDensityDraft}
                aria-label={t('community_banner_bg_density', 'Density')}
                onChange={(e) => setBgDensityDraft(sanitizeBannerBgDensity(e.target.value))}
              />
              <AppText as="span" className="community-banner-modal__hint">
                {t(
                  'community_banner_bg_density_hint',
                  '0 = no color overlay · 100 = full color over the banner image'
                )}
              </AppText>
            </div>
          ) : null}
        </div>
      </BannerToolModal>
    ) : null;

  const youtubeModal =
    activeModal === 'youtube' ? (
      <BannerToolModal
        title={t('community_banner_youtube_tool', 'YouTube / Music / Live')}
        titleId="community-banner-youtube-modal"
        onClose={closeModal}
        footer={modalFooter(
          t('community_banner_publish_youtube', 'Apply media'),
          !youtubePreviewReady,
          publishYoutube,
          hasYoutubeBanner,
          t('community_banner_delete_youtube', 'Remove media'),
          deleteYoutube
        )}
      >
        <div className="community-banner-modal__section">
          <label className="community-banner-modal__label" htmlFor="community-banner-youtube-url">
            {t('community_banner_youtube_url_label', 'YouTube / Music / playlist / live link')}
          </label>
          <AppTextInput
            id="community-banner-youtube-url"
            type="url"
            className="community-banner-modal__textarea"
            placeholder={t(
              'community_banner_youtube_url_placeholder',
              'Video, live, playlist, or music.youtube.com link'
            )}
            value={youtubeDraft}
            onChange={(e) => setYoutubeDraft(e.target.value)}
            autoComplete="off"
          />
          <button
            type="button"
            className="community-banner-modal__youtube-search-btn"
            onClick={() => setShowYoutubeSearch(true)}
          >
            <FaYoutube size={20} />
            {t('youtube_search_button', 'Search YouTube')}
          </button>
          <AppText as="p" className="community-banner-modal__hint">
            {t(
              'community_banner_youtube_host_hint',
              'Supports videos, live streams, playlists, and YouTube Music. You control playback; guests stay muted until they tap sound.'
            )}
          </AppText>
          <AppText as="p" className="community-banner-modal__hint community-banner-modal__hint--warn">
            {t(
              'community_banner_youtube_embed_hint',
              'The media must allow embedding. Live joins at the live edge. Playlists advance for everyone when you sync.'
            )}
          </AppText>
          {parsedYoutubeDraft?.kind ? (
            <AppText as="p" className="community-banner-modal__hint">
              {parsedYoutubeDraft.kind === 'live'
                ? t('community_banner_youtube_kind_live', 'Detected: live stream')
                : parsedYoutubeDraft.kind === 'playlist'
                  ? t('community_banner_youtube_kind_playlist', 'Detected: playlist')
                  : parsedYoutubeDraft.kind === 'music'
                    ? t('community_banner_youtube_kind_music', 'Detected: YouTube Music')
                    : t('community_banner_youtube_kind_video', 'Detected: video')}
            </AppText>
          ) : null}
        </div>
        {youtubePreviewReady ? (
          <div className="community-banner-modal__banner-strip community-banner-modal__banner-strip--youtube">
            <CommunityBannerYoutubeBackground
              videoId={youtubePreviewId}
              playlistId={youtubePreviewPlaylistId}
              isShort={Boolean(parsedYoutubeDraft?.isShort || banner.youtubeShort)}
              isLive={Boolean(parsedYoutubeDraft?.isLive || banner.youtubeLive)}
              preview
              isHost
            />
          </div>
        ) : null}
      </BannerToolModal>
    ) : null;

  const templatesModal =
    activeModal === 'templates' ? (
      <BannerToolModal
        title={t('community_banner_templates_tool', 'Banner templates')}
        titleId="community-banner-templates-modal"
        onClose={closeModal}
      >
        {COMMUNITY_BANNER_TEMPLATES.length === 0 ? (
          <div className="community-banner-templates__empty">
            <FaTh size={28} aria-hidden />
            <AppText as="p" className="community-banner-templates__empty-title">
              {t('community_banner_templates_empty_title', 'Templates coming soon')}
            </AppText>
            <AppText as="p" className="community-banner-templates__empty-hint">
              {t(
                'community_banner_templates_empty_hint',
                'Add images or loop videos to community-chat-banner-templates and register them in the manifest.'
              )}
            </AppText>
          </div>
        ) : (
          <div className="community-banner-templates__grid" role="list">
            {COMMUNITY_BANNER_TEMPLATES.map((template) => {
              const thumbUrl = getCommunityBannerTemplatePublicUrl(template);
              const label =
                template.label ||
                (template.labelKey ? t(template.labelKey, template.id) : template.id);
              return (
                <button
                  key={template.id}
                  type="button"
                  className="community-banner-templates__card"
                  role="listitem"
                  disabled
                  title={label}
                >
                  {template.kind === 'video' ? (
                    <video
                      src={thumbUrl}
                      className="community-banner-templates__thumb"
                      muted
                      loop
                      playsInline
                      aria-hidden
                    />
                  ) : (
                    <img
                      src={thumbUrl}
                      alt=""
                      className="community-banner-templates__thumb"
                    />
                  )}
                  <AppText as="span" className="community-banner-templates__label">
                    {label}
                  </AppText>
                </button>
              );
            })}
          </div>
        )}
      </BannerToolModal>
    ) : null;

  const railClass =
    layout === 'banner-rail'
      ? 'community-banner-host-tools community-banner-host-tools--bar community-banner-host-tools--side'
      : 'community-banner-host-tools community-banner-host-tools--inline';

  const voiceBroadcastControl = (
    <div
      className={`community-banner-voice-fab${layout === 'banner-rail' ? ' community-banner-voice-fab--rail' : ' community-banner-voice-fab--inline'}${voiceRecording ? ' community-banner-voice-fab--recording' : ''}${banner.voiceUrl ? ' community-banner-voice-fab--live' : ''}${voicePublishing ? ' community-banner-voice-fab--publishing' : ''}`}
      data-banner-voice-control="record"
    >
      <button
        type="button"
        className="community-banner-voice-fab__btn"
        aria-label={
          voiceRecording
            ? t('community_banner_voice_stop', 'Stop and publish ({{time}})', {
                time: formatDuration(voiceRecordingSec),
              })
            : t('community_banner_voice_record', 'Record voice for banner (max 2 min)')
        }
        title={
          voiceRecording
            ? t('community_banner_voice_stop_title', 'Stop & publish · {{time}} / 2:00', {
                time: formatDuration(voiceRecordingSec),
              })
            : t('community_banner_voice_record', 'Record voice for banner (max 2 min)')
        }
        aria-pressed={voiceRecording}
        onClick={toggleVoiceRecording}
        disabled={uploadingBanner || voicePublishing || !setBannerVoice}
      >
        <span className="community-banner-voice-fab__glow" aria-hidden />
        {voiceRecording ? <FaStop size={18} aria-hidden /> : <FaMicrophone size={24} aria-hidden />}
        <AppText as="span" className="community-banner-voice-fab__btn-label">
          {voiceRecording
            ? t('community_banner_voice_stop_short', 'Stop')
            : t('community_banner_voice_rec_short', 'Rec')}
        </AppText>
        {voiceRecording ? (
          <AppText as="span" className="community-banner-voice-fab__timer" aria-live="polite">
            {formatDuration(voiceRecordingSec)}
          </AppText>
        ) : null}
        {voicePublishing && !voiceRecording ? (
          <AppText as="span" className="community-banner-voice-fab__btn-label">
            {t('community_banner_voice_publishing', 'Publishing…')}
          </AppText>
        ) : null}
      </button>
    </div>
  );

  /* 7 controls: 3 left + 3 right + voice (bottom center) */
  const toolsLeftRail = (
    <div
      className={`${railClass} community-banner-host-tools--start`}
      role="toolbar"
      aria-label={t('community_banner_host_tools_left', 'Banner tools left')}
      data-banner-tools="side-start"
    >
      {onOpenTrivia ? (
        <button
          type="button"
          className="community-banner-host-tools__btn community-banner-host-tools__game"
          aria-label={t('trivia_start', 'Start Food Trivia')}
          title={t('trivia_start', 'Start Food Trivia')}
          onClick={onOpenTrivia}
        >
          <FaGamepad size={22} aria-hidden />
        </button>
      ) : null}
      <button
        type="button"
        className={`community-banner-host-tools__btn community-banner-host-tools__btn--bg${hasBannerBackgroundTool ? ' community-banner-host-tools__btn--active' : ''}`}
        aria-label={t('community_banner_bg_tool', 'Banner background')}
        title={t('community_banner_bg_tool', 'Banner background')}
        onClick={openBackgroundModal}
        disabled={uploadingBanner}
      >
        <FaImage size={17} aria-hidden />
      </button>
      <button
        type="button"
        className={`community-banner-host-tools__btn community-banner-host-tools__btn--youtube${hasYoutubeBanner ? ' community-banner-host-tools__btn--active' : ''}`}
        aria-label={t('community_banner_youtube_tool', 'YouTube / Music / Live')}
        title={t('community_banner_youtube_tool', 'YouTube / Music / Live')}
        onClick={openYoutubeModal}
        disabled={uploadingBanner || voiceRecording || voicePublishing}
      >
        <FaYoutube size={18} aria-hidden />
      </button>
      <button
        type="button"
        className="community-banner-host-tools__btn community-banner-host-tools__btn--title"
        aria-label={t('community_banner_title_tool', 'Banner title')}
        title={t('community_banner_title_tool', 'Banner title')}
        onClick={openTitleModal}
        disabled={uploadingBanner}
      >
        <FaHeading size={16} aria-hidden />
      </button>
    </div>
  );

  const toolsRightRail = (
    <div
      className={`${railClass} community-banner-host-tools--end`}
      role="toolbar"
      aria-label={t('community_banner_host_tools_right', 'Banner tools right')}
      data-banner-tools="side-end"
    >
      <button
        type="button"
        className={`community-banner-host-tools__btn community-banner-host-tools__btn--body${hasBannerBodyPlainText(banner.texts) ? ' community-banner-host-tools__btn--active' : ''}`}
        aria-label={t('community_banner_body_tool', 'Banner text')}
        title={t('community_banner_body_tool', 'Banner text')}
        onClick={openTextModal}
        disabled={uploadingBanner}
      >
        <FaFont size={16} aria-hidden />
      </button>
      <button
        type="button"
        className={`community-banner-host-tools__btn community-banner-host-tools__btn--look${zoneThemeId && zoneThemeId !== 'default' ? ' community-banner-host-tools__btn--active' : ''}`}
        aria-label={t('community_guest_frame_bg_tool', 'Chat look')}
        title={t('community_guest_frame_bg_tool', 'Chat look')}
        onClick={zoneTheme.open}
        disabled={uploadingBanner || zoneThemeSaving}
      >
        <FaPalette size={16} aria-hidden />
      </button>
      <button
        type="button"
        className={`community-banner-host-tools__btn community-banner-host-tools__btn--spotlight${banner.hostSpotlightAuto ? ' community-banner-host-tools__btn--active' : ''}`}
        aria-label={t('community_host_spotlight_auto', 'Auto-show messages on banner')}
        aria-pressed={banner.hostSpotlightAuto}
        title={t('community_host_spotlight_auto', 'Auto-show messages on banner')}
        onClick={() => void setHostSpotlightAuto(!banner.hostSpotlightAuto)}
        disabled={uploadingBanner}
      >
        <FaBullhorn size={16} aria-hidden />
      </button>
    </div>
  );

  return (
    <>
      {hostToolsVisible || voiceRecording || voicePublishing ? (
        <>
          {hostToolsVisible ? toolsLeftRail : null}
          {hostToolsVisible ? toolsRightRail : null}
          {voiceBroadcastControl}
        </>
      ) : null}

      {titleModal}
      {bodyTextModal}
      {backgroundModal}
      {youtubeModal}
      <YoutubeSearchModal
        open={showYoutubeSearch}
        onClose={() => setShowYoutubeSearch(false)}
        onSelect={(video) => setYoutubeDraft(`https://www.youtube.com/watch?v=${video.id}`)}
      />
      {zoneTheme.modal}
      {templatesModal}

      {showCamera ? (
        <UnifiedCamera
          className="community-banner-camera-shell"
          stopCamera={() => setShowCamera(false)}
          onMediaCaptured={(file, _previewUrl, type) => {
            if (type === 'video') {
              setShowCamera(false);
              return;
            }
            void handleMediaCaptured(file);
          }}
          maxDuration={0}
          mode="photo"
          allowFilePicker
          compactCapture
          captureAspectRatio="16/9"
          accentColor="#e86e2e"
          compactTitle={t('community_banner_camera_title', 'Banner photo')}
          hintText={t(
            'community_banner_camera_hint',
            '16:9 banner — take a photo or pick from gallery'
          )}
          previewRetakeLabel={t('camera_retake', 'Retake')}
        />
      ) : null}
    </>
  );
}
