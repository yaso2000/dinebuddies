import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { FaAlignLeft, FaBold, FaBullhorn, FaHeading, FaImage, FaItalic, FaLink, FaPalette, FaTh, FaTimes, FaTrash, FaYoutube } from 'react-icons/fa';
import { AppText, AppTextInput } from '../base';
import UnifiedCamera from '../UnifiedCamera';
import {
  BANNER_BG_PRESETS,
  BANNER_BG_TRANSPARENT,
  BANNER_BODY_BUTTON_INDEX,
  BANNER_BODY_SLOT_COUNT,
  BANNER_BODY_TEXT_INDEX,
  BANNER_TEXT_MAX_TOTAL,
  BANNER_TITLE_FONT_FAMILIES,
  DEFAULT_BANNER_BG,
  DEFAULT_BANNER_BG2,
  DEFAULT_BANNER_BG_DENSITY,
  DEFAULT_BANNER_BUTTON_BG,
  DEFAULT_BANNER_FONT_SIZE,
  DEFAULT_BANNER_TITLE_FONT_SIZE,
  clampBannerBodySlotText,
  createDefaultBannerBodySlot,
  createDefaultBannerTitleStyle,
  hasBannerBodyButton,
  hasBannerBodyPlainText,
  isBannerBgTransparent,
  resolveBannerBackgroundStyle,
  resolveBannerBodyInlineStyle,
  resolveBannerButtonInlineStyle,
  resolveBannerFontFamilyCss,
  resolveBannerFontSizeCss,
  resolveBannerTitleFontSizeCss,
  resolveBannerTitleInlineStyle,
  sanitizeBannerBgDensity,
  sanitizeBannerBorderWidth,
  sanitizeBannerFontFamily,
  sanitizeBannerHexColor,
  sanitizeBannerLinkUrl,
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
import CommunityChatZoneThemePicker from './CommunityChatZoneThemePicker';
import InvitationEditorLeaveDialog from '../Invitations/socialCard/InvitationEditorLeaveDialog';
import {
  buildGuestFrameBackgroundFromDraft,
  createGuestFrameDraftFromResolved,
} from '../../constants/communityChatGuestFrameLook';

const DEFAULT_ZONE_THEME_DRAFT = {
  themeId: 'stage',
  guestFrame: {
    imageMode: 'none',
    colorOverlayEnabled: true,
    colorStart: DEFAULT_BANNER_BG,
    colorEnd: DEFAULT_BANNER_BG2,
    intensity: 100,
    presetId: null,
    customUrl: null,
  },
};

function createDefaultZoneThemeDraftSnapshot() {
  return {
    themeId: DEFAULT_ZONE_THEME_DRAFT.themeId,
    guestFrame: { ...DEFAULT_ZONE_THEME_DRAFT.guestFrame },
  };
}

function createZoneThemeDraftSnapshot(themeId, guestFrameBackground) {
  return {
    themeId: themeId || 'stage',
    guestFrame: createGuestFrameDraftFromResolved(guestFrameBackground),
  };
}

function zoneThemeDraftsEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

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

function BannerToolModal({ title, titleId, onClose, children, footer, headerActions }) {
  const overlayRef = useRef(null);
  const bodyRef = useRef(null);

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

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      ref={overlayRef}
      className="community-banner-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={onClose}
    >
      <div className="community-banner-modal__panel" onClick={(e) => e.stopPropagation()}>
        <div className="community-banner-modal__head">
          <AppText as="h2" id={titleId} className="community-banner-modal__title">
            {title}
          </AppText>
          <div className="community-banner-modal__head-actions">
            {headerActions}
            <button
              type="button"
              className="community-main-chat__attach-btn"
              aria-label="Close"
              onClick={onClose}
            >
              <FaTimes size={16} />
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
export default function CommunityHostBannerComposerTools({ room, layout = 'banner-rail' }) {
  const { t } = useTranslation();
  const { banner, bannerDisplay, uploadingBanner, setBannerImage, setBannerYoutube, updateBanner, setHostSpotlightAuto, zoneThemeId, saveCommunityChatZoneThemeSettings, zoneThemeSaving, guestFrameBackground, uploadCommunityChatGuestFrameBackgroundFile, generateCommunityChatGuestFrameBackgroundImage, guestFrameBackgroundUploading, guestFrameBackgroundGenerating } = room;

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
  const [zoneThemeDraft, setZoneThemeDraft] = useState(null);
  const [zoneThemeSavedSnapshot, setZoneThemeSavedSnapshot] = useState(null);
  const [zoneThemeLeaveOpen, setZoneThemeLeaveOpen] = useState(false);

  const parsedYoutubeDraft = parseYoutubeLink(youtubeDraft);
  const youtubePreviewId =
    parsedYoutubeDraft?.id ||
    sanitizeYoutubeVideoId(youtubeDraft) ||
    sanitizeYoutubeVideoId(banner.youtubeId);

  const isTransparentBg = isBannerBgTransparent(bgColorDraft);
  const hasCustomBannerImage = Boolean(String(banner.url || '').trim()) && !banner.youtubeId;

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

  const openButtonModal = () => {
    const slotIndex = BANNER_BODY_BUTTON_INDEX;
    const slot = (banner.texts || [])[slotIndex] || createDefaultBannerBodySlot(slotIndex);
    setEditingBodySlot(slotIndex);
    setBodySlotDraft({
      ...createDefaultBannerBodySlot(slotIndex),
      ...slot,
      mode: 'link',
      buttonBg: sanitizeBannerTextColor(slot.buttonBg, DEFAULT_BANNER_BUTTON_BG),
    });
    setActiveModal('bodyButton');
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

  const openZoneThemeModal = () => {
    const snapshot = createZoneThemeDraftSnapshot(zoneThemeId, guestFrameBackground);
    setZoneThemeDraft(snapshot);
    setZoneThemeSavedSnapshot(snapshot);
    setZoneThemeLeaveOpen(false);
    setActiveModal('zoneTheme');
  };

  const openYoutubeModal = () => {
    setYoutubeDraft(banner.youtubeId ? `https://youtu.be/${banner.youtubeId}` : '');
    setActiveModal('youtube');
  };

  const closeModal = () => setActiveModal(null);

  const isZoneThemeDraftDirty =
    zoneThemeDraft &&
    zoneThemeSavedSnapshot &&
    !zoneThemeDraftsEqual(zoneThemeDraft, zoneThemeSavedSnapshot);

  const zoneThemeDraftBusy =
    zoneThemeSaving || guestFrameBackgroundUploading || guestFrameBackgroundGenerating;

  const updateZoneThemeDraft = (patch) => {
    setZoneThemeDraft((prev) => (prev ? { ...prev, ...patch } : prev));
  };

  const updateZoneThemeGuestFrameDraft = (patch) => {
    setZoneThemeDraft((prev) =>
      prev
        ? {
            ...prev,
            guestFrame: { ...prev.guestFrame, ...patch },
          }
        : prev
    );
  };

  const publishZoneTheme = async () => {
    if (!zoneThemeDraft || zoneThemeDraftBusy) return false;
    const ok = await saveCommunityChatZoneThemeSettings(zoneThemeDraft);
    if (ok) {
      setZoneThemeSavedSnapshot(zoneThemeDraft);
    }
    return ok;
  };

  const closeZoneThemeModal = () => {
    setZoneThemeLeaveOpen(false);
    closeModal();
  };

  const requestCloseZoneThemeModal = () => {
    if (zoneThemeDraftBusy) return;
    if (isZoneThemeDraftDirty) {
      setZoneThemeLeaveOpen(true);
      return;
    }
    closeZoneThemeModal();
  };

  const saveZoneThemeAndClose = async () => {
    const ok = await publishZoneTheme();
    if (ok) closeZoneThemeModal();
  };

  const discardZoneThemeDraft = () => {
    closeZoneThemeModal();
  };

  const resetZoneThemeDraftToDefaults = () => {
    if (zoneThemeDraftBusy) return;
    setZoneThemeDraft(createDefaultZoneThemeDraftSnapshot());
  };

  const isZoneThemeDraftAtDefaults = zoneThemeDraft
    ? zoneThemeDraftsEqual(zoneThemeDraft, DEFAULT_ZONE_THEME_DRAFT)
    : true;

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
    const isButton = editingBodySlot === BANNER_BODY_BUTTON_INDEX;
    const label = String(bodySlotDraft.text || '').trim();
    const url = isButton ? sanitizeBannerLinkUrl(bodySlotDraft.url) : '';
    if (!label) return;
    if (isButton && !url) return;

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
            mode: isButton ? 'link' : 'text',
            url,
            buttonBg: isButton
              ? sanitizeBannerTextColor(bodySlotDraft.buttonBg, DEFAULT_BANNER_BUTTON_BG)
              : DEFAULT_BANNER_BUTTON_BG,
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
  const editingButton = editingBodySlot === BANNER_BODY_BUTTON_INDEX;
  const bodyDraftUrlValid = !editingButton || Boolean(sanitizeBannerLinkUrl(bodySlotDraft.url));
  const bodyPublishDisabled =
    !String(bodySlotDraft.text || '').trim() || (editingButton && !bodyDraftUrlValid);

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

  const publishYoutube = async () => {
    const id = parsedYoutubeDraft?.id || sanitizeYoutubeVideoId(youtubeDraft);
    if (!id) return;
    const ok = await setBannerYoutube(id, { isShort: Boolean(parsedYoutubeDraft?.isShort) });
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

  const bodyButtonModal =
    activeModal === 'bodyButton' ? (
      <BannerToolModal
        title={t('community_banner_button_tool', 'Banner button')}
        titleId="community-banner-body-button-modal"
        onClose={closeModal}
        footer={modalFooter(
          t('community_banner_publish_body_link', 'Publish button'),
          bodyPublishDisabled,
          publishBody,
          bannerBodySlotHasText,
          t('community_banner_delete_button', 'Delete button'),
          deleteBody,
          true
        )}
      >
        <div className="community-banner-modal__section community-banner-modal__section--compact">
          <AppText as="span" className="community-banner-modal__label">
            {t('community_banner_body_link_url', 'Link URL')}
          </AppText>
          <AppTextInput
            type="text"
            inputMode="url"
            autoComplete="url"
            enterKeyHint="done"
            className="community-banner-modal__textarea community-banner-modal__textarea--compact community-banner-modal__input--single-line"
            placeholder={t(
              'community_banner_body_link_url_placeholder',
              'https://… or /path'
            )}
            value={bodySlotDraft.url || ''}
            onChange={(e) => updateBodySlotDraft({ url: e.target.value })}
            dir="ltr"
          />
          {String(bodySlotDraft.url || '').trim() && !bodyDraftUrlValid ? (
            <AppText as="span" className="community-banner-modal__hint community-banner-modal__hint--error">
              {t(
                'community_banner_body_link_url_unsafe',
                'This link is not allowed (unsafe scheme, shortener, or hidden destination).'
              )}
            </AppText>
          ) : null}
        </div>

        <div className="community-banner-modal__section community-banner-modal__section--compact">
          <AppText as="span" className="community-banner-modal__label">
            {t('community_banner_body_link_label_placeholder', 'Button label…')} ({bodyCharUsed}/
            {BANNER_TEXT_MAX_TOTAL})
          </AppText>
          <AppTextInput
            type="text"
            className="community-banner-modal__textarea community-banner-modal__textarea--body community-banner-modal__textarea--compact community-banner-modal__input--single-line"
            style={resolveBannerButtonInlineStyle(bodySlotDraft)}
            placeholder={t('community_banner_body_link_label_placeholder', 'Button label…')}
            value={bodySlotDraft.text || ''}
            onChange={(e) => updateBodySlotDraft({ text: e.target.value })}
          />
        </div>

        <BannerToggleRow label={t('community_banner_button_style', 'Button style')}>
          <div className="community-banner-modal__icon-toolbar">
            <label
              className="community-banner-modal__icon-btn community-banner-modal__icon-btn--color"
              title={t('community_banner_button_bg_color', 'Button color')}
            >
              <input
                type="color"
                value={sanitizeBannerTextColor(bodySlotDraft.buttonBg, DEFAULT_BANNER_BUTTON_BG)}
                onChange={(e) => updateBodySlotDraft({ buttonBg: e.target.value })}
                aria-label={t('community_banner_button_bg_color', 'Button color')}
              />
              <i
                className="community-banner-modal__color-swatch"
                aria-hidden
                style={{
                  background: sanitizeBannerTextColor(
                    bodySlotDraft.buttonBg,
                    DEFAULT_BANNER_BUTTON_BG
                  ),
                }}
              />
            </label>
            <label
              className="community-banner-modal__icon-btn community-banner-modal__icon-btn--color"
              title={t('community_banner_button_text_color', 'Label color')}
            >
              <input
                type="color"
                value={sanitizeBannerTextColor(bodySlotDraft.color)}
                onChange={(e) => updateBodySlotDraft({ color: e.target.value })}
                aria-label={t('community_banner_button_text_color', 'Label color')}
              />
              <FaPalette size={14} aria-hidden />
            </label>
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
            <BannerIconBtn
              active={bodySlotDraft.bold}
              ariaLabel={t('community_banner_body_bold', 'Bold')}
              onClick={() => updateBodySlotDraft({ bold: !bodySlotDraft.bold })}
            >
              <FaBold size={14} aria-hidden />
            </BannerIconBtn>
          </div>
        </BannerToggleRow>

        <div className="community-banner-modal__section community-banner-modal__section--compact community-banner-modal__button-preview-wrap">
          <AppText as="span" className="community-banner-modal__hint">
            {t(
              'community_banner_button_preview_hint',
              'Guests can tap the button to open the link.'
            )}
          </AppText>
          <AppText
            as="span"
            className="community-banner-draggable-body__link-btn community-banner-modal__button-preview"
            style={resolveBannerButtonInlineStyle(bodySlotDraft)}
          >
            {bodySlotDraft.text ||
              t('community_banner_body_link_label_placeholder', 'Button label…')}
          </AppText>
        </div>
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
          false,
          publishBackground
        )}
      >
        <BannerPreviewStrip
          banner={bannerForPreview}
          title={titleDraft}
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
            {t('community_banner_bg_gradient', 'Gradient background')}
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
            ariaLabel={t('community_banner_bg_gradient', 'Gradient background')}
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
                  '0 = fully transparent · 100 = full color over the banner image'
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
        title={t('community_banner_youtube_tool', 'YouTube background')}
        titleId="community-banner-youtube-modal"
        onClose={closeModal}
        footer={modalFooter(
          t('community_banner_publish_youtube', 'Apply video'),
          !youtubePreviewId,
          publishYoutube,
          Boolean(banner.youtubeId),
          t('community_banner_delete_youtube', 'Remove video'),
          deleteYoutube
        )}
      >
        <div className="community-banner-modal__section">
          <label className="community-banner-modal__label" htmlFor="community-banner-youtube-url">
            {t('community_banner_youtube_url_label', 'YouTube link')}
          </label>
          <AppTextInput
            id="community-banner-youtube-url"
            type="url"
            className="community-banner-modal__textarea"
            placeholder={t(
              'community_banner_youtube_url_placeholder',
              'https://youtube.com/watch?v=… or youtu.be/…'
            )}
            value={youtubeDraft}
            onChange={(e) => setYoutubeDraft(e.target.value)}
            autoComplete="off"
          />
          <AppText as="p" className="community-banner-modal__hint">
            {t(
              'community_banner_youtube_host_hint',
              'You control the video with YouTube player buttons (play, pause, sound). Members only see it playing silently with no controls.'
            )}
          </AppText>
          <AppText as="p" className="community-banner-modal__hint community-banner-modal__hint--warn">
            {t(
              'community_banner_youtube_embed_hint',
              'The video must allow embedding. If playback fails, a cover image is shown instead. Avoid videos blocked on other devices or Premium limits.'
            )}
          </AppText>
        </div>
        {youtubePreviewId ? (
          <div className="community-banner-modal__banner-strip community-banner-modal__banner-strip--youtube">
            <CommunityBannerYoutubeBackground
              videoId={youtubePreviewId}
              isShort={Boolean(parsedYoutubeDraft?.isShort || banner.youtubeShort)}
              preview
              isHost
            />
          </div>
        ) : null}
      </BannerToolModal>
    ) : null;

  const zoneThemeModal =
    activeModal === 'zoneTheme' && zoneThemeDraft ? (
      <>
        <BannerToolModal
          title={t('community_guest_frame_bg_tool', 'Chat background')}
          titleId="community-chat-zone-theme-modal"
          onClose={requestCloseZoneThemeModal}
          headerActions={
            <>
              {resetBtn(
                t('community_chat_zone_theme_reset', 'Reset to default'),
                zoneThemeDraftBusy || isZoneThemeDraftAtDefaults,
                resetZoneThemeDraftToDefaults,
                true
              )}
              {publishBtn(
                zoneThemeSaving
                  ? t('saving', 'Saving…')
                  : t('save', 'Save'),
                zoneThemeDraftBusy || !isZoneThemeDraftDirty,
                saveZoneThemeAndClose,
                true
              )}
            </>
          }
        >
          <CommunityChatZoneThemePicker
            guestFrameBackground={buildGuestFrameBackgroundFromDraft(zoneThemeDraft.guestFrame)}
            saving={zoneThemeSaving}
            guestFrameBackgroundUploading={guestFrameBackgroundUploading}
            guestFrameBackgroundGenerating={guestFrameBackgroundGenerating}
            onSelectTransparent={() => {
              updateZoneThemeGuestFrameDraft({ colorOverlayEnabled: false });
            }}
            onSelectGradientPreset={(colorStart, colorEnd) =>
              updateZoneThemeGuestFrameDraft({
                colorOverlayEnabled: true,
                colorStart,
                colorEnd,
              })
            }
            onChangeGuestFrameColors={(colorStart, colorEnd) =>
              updateZoneThemeGuestFrameDraft({
                colorOverlayEnabled: true,
                colorStart,
                colorEnd,
              })
            }
            onChangeGuestFrameDensity={(intensity) =>
              updateZoneThemeGuestFrameDraft({
                colorOverlayEnabled: true,
                intensity,
              })
            }
            onSelectImageNone={() => {
              updateZoneThemeGuestFrameDraft({
                imageMode: 'none',
                presetId: null,
                customUrl: null,
              });
            }}
            onSelectGuestFramePreset={(presetId) =>
              updateZoneThemeGuestFrameDraft({
                imageMode: 'preset',
                presetId,
                customUrl: null,
              })
            }
            onUploadGuestFrameBackground={async (file) => {
              const url = await uploadCommunityChatGuestFrameBackgroundFile(file);
              if (url) {
                updateZoneThemeGuestFrameDraft({
                  imageMode: 'custom',
                  customUrl: url,
                  presetId: null,
                });
              }
            }}
            onGenerateGuestFrameBackgroundAi={async (prompt) => {
              const url = await generateCommunityChatGuestFrameBackgroundImage(prompt);
              if (url) {
                updateZoneThemeGuestFrameDraft({
                  imageMode: 'custom',
                  customUrl: url,
                  presetId: null,
                });
              }
            }}
          />
        </BannerToolModal>
        <InvitationEditorLeaveDialog
          open={zoneThemeLeaveOpen}
          saving={zoneThemeSaving}
          onSave={saveZoneThemeAndClose}
          onDiscard={discardZoneThemeDraft}
          onCancel={() => setZoneThemeLeaveOpen(false)}
          questionKey="community_chat_zone_theme_unsaved_question"
          questionDefault="Save your chat color changes before closing?"
        />
      </>
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
      ? 'community-banner-host-tools'
      : 'community-banner-host-tools community-banner-host-tools--inline';

  const mediaRail =
    layout === 'banner-rail' ? (
      <div
        className={`${railClass} community-banner-host-tools--start`}
        role="toolbar"
        aria-label={t('community_banner_media_tools', 'Banner media')}
      >
        <button
          type="button"
          className={`community-banner-host-tools__btn${hasCustomBannerImage ? ' community-banner-host-tools__btn--active' : ''}`}
          aria-label={t('community_banner_add_media', 'Add banner image from camera or gallery')}
          title={t('community_banner_add_media', 'Add banner image from camera or gallery')}
          onClick={() => setShowCamera(true)}
          disabled={uploadingBanner}
        >
          <FaImage size={16} />
        </button>
        <button
          type="button"
          className={`community-banner-host-tools__btn community-banner-host-tools__btn--youtube${banner.youtubeId ? ' community-banner-host-tools__btn--active' : ''}`}
          aria-label={t('community_banner_youtube_tool', 'YouTube background')}
          title={t('community_banner_youtube_tool', 'YouTube background')}
          onClick={openYoutubeModal}
          disabled={uploadingBanner}
        >
          <FaYoutube size={16} />
        </button>
        <button
          type="button"
          className={`community-banner-host-tools__btn${zoneThemeId && zoneThemeId !== 'default' ? ' community-banner-host-tools__btn--active' : ''}`}
          aria-label={t('community_guest_frame_bg_tool', 'Chat background')}
          title={t('community_guest_frame_bg_tool', 'Chat background')}
          onClick={openZoneThemeModal}
          disabled={uploadingBanner || zoneThemeSaving}
        >
          <FaTh size={16} />
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
          <FaBullhorn size={16} />
        </button>
      </div>
    ) : null;

  const textRail = (
    <div
      className={`${railClass}${layout === 'banner-rail' ? ' community-banner-host-tools--end' : ''}`}
      role="toolbar"
      aria-label={t('community_banner_text_tools', 'Banner text & style')}
    >
      {layout !== 'banner-rail' ? (
        <>
          <button
            type="button"
            className={`community-banner-host-tools__btn${hasCustomBannerImage ? ' community-banner-host-tools__btn--active' : ''}`}
            aria-label={t('community_banner_add_media', 'Add banner image from camera or gallery')}
            title={t('community_banner_add_media', 'Add banner image from camera or gallery')}
            onClick={() => setShowCamera(true)}
            disabled={uploadingBanner}
          >
            <FaImage size={16} />
          </button>
          <button
            type="button"
            className={`community-banner-host-tools__btn community-banner-host-tools__btn--youtube${banner.youtubeId ? ' community-banner-host-tools__btn--active' : ''}`}
            aria-label={t('community_banner_youtube_tool', 'YouTube background')}
            title={t('community_banner_youtube_tool', 'YouTube background')}
            onClick={openYoutubeModal}
            disabled={uploadingBanner}
          >
            <FaYoutube size={16} />
          </button>
        </>
      ) : null}
      <button
        type="button"
        className="community-banner-host-tools__btn"
        aria-label={t('community_banner_title_tool', 'Banner title')}
        title={t('community_banner_title_tool', 'Banner title')}
        onClick={openTitleModal}
        disabled={uploadingBanner}
      >
        <FaHeading size={16} />
      </button>
      <button
        type="button"
        className={`community-banner-host-tools__btn community-banner-host-tools__btn--body${hasBannerBodyPlainText(banner.texts) ? ' community-banner-host-tools__btn--active' : ''}`}
        aria-label={t('community_banner_body_tool', 'Banner text')}
        title={t('community_banner_body_tool', 'Banner text')}
        onClick={openTextModal}
        disabled={uploadingBanner}
      >
        <FaAlignLeft size={16} />
      </button>
      <button
        type="button"
        className={`community-banner-host-tools__btn community-banner-host-tools__btn--button${hasBannerBodyButton(banner.texts) ? ' community-banner-host-tools__btn--active' : ''}`}
        aria-label={t('community_banner_button_tool', 'Banner button')}
        title={t('community_banner_button_tool', 'Banner button')}
        onClick={openButtonModal}
        disabled={uploadingBanner}
      >
        <FaLink size={16} />
      </button>
      <button
        type="button"
        className="community-banner-host-tools__btn"
        aria-label={t('community_banner_bg_tool', 'Banner background')}
        title={t('community_banner_bg_tool', 'Banner background')}
        onClick={openBackgroundModal}
        disabled={uploadingBanner}
      >
        <FaPalette size={16} />
      </button>
      {layout !== 'banner-rail' ? (
        <>
          <button
            type="button"
            className={`community-banner-host-tools__btn community-banner-host-tools__btn--spotlight${banner.hostSpotlightAuto ? ' community-banner-host-tools__btn--active' : ''}`}
            aria-label={t('community_host_spotlight_auto', 'Auto-show messages on banner')}
            aria-pressed={banner.hostSpotlightAuto}
            title={t('community_host_spotlight_auto', 'Auto-show messages on banner')}
            onClick={() => void setHostSpotlightAuto(!banner.hostSpotlightAuto)}
            disabled={uploadingBanner}
          >
            <FaBullhorn size={16} />
          </button>
          <button
            type="button"
            className={`community-banner-host-tools__btn${zoneThemeId && zoneThemeId !== 'default' ? ' community-banner-host-tools__btn--active' : ''}`}
            aria-label={t('community_guest_frame_bg_tool', 'Chat background')}
            title={t('community_guest_frame_bg_tool', 'Chat background')}
            onClick={openZoneThemeModal}
            disabled={uploadingBanner || zoneThemeSaving}
          >
            <FaTh size={16} />
          </button>
        </>
      ) : null}
    </div>
  );

  return (
    <>
      {mediaRail}
      {textRail}

      {titleModal}
      {bodyTextModal}
      {bodyButtonModal}
      {backgroundModal}
      {youtubeModal}
      {zoneThemeModal}
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
