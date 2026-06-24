import React, { useMemo, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import SocialCardCategoryIcon from './SocialCardCategoryIcon';
import { getFrameColorById, DEFAULT_FRAME_COLOR_ID } from './socialCardFrameColors';
import { resolveOccasionCategoryId } from './socialCardOccasionMap';
import {
  resolveCardBackgroundUrlCandidates,
  resolveCanonicalBackgroundId,
  DARK_TEMPLATE_BACKGROUND_IDS } from
'./socialCardBackgrounds';
import {
  resolvePrivateCardBackgroundUrlCandidates,
  resolveCanonicalPrivateBackgroundId,
  PRIVATE_DARK_TEMPLATE_BACKGROUND_IDS } from
'../privateCard/privateCardBackgrounds';
import { getPrivateCardFontById, DEFAULT_FONT_ID } from './socialCardFonts';
import {
  DEFAULT_CARD_COPY_OFFSET_Y,
  DEFAULT_CARD_COPY_WIDTH_PCT,
  DEFAULT_CARD_COPY_FONT_SCALE,
  clampCardCopyFontScale,
  clampCardCopyWidthPct,
  clampCardCopyOffsetY,
  cardCopyOffsetToCssPercent,
  cardCopyFontScaleToMultiplier } from
'./socialCardCopyLayout';
import {
  adjustFrameTextForDarkTemplate,
  DARK_TEMPLATE_TEXT_SHADOW,
  PHOTO_BACKGROUND_TEXT_SHADOW } from
'./socialCardFrameTextContrast';
import {
  DEFAULT_PRIVATE_TEXT_BACKDROP_TONE,
  PRIVATE_TEXT_BACKDROP_PANEL_WIDTH,
  privateTextBackdropToneToRgba } from
'./socialCardTextBackdrop';
import { resolvePrivateCardColorBackgroundCss } from './socialCardGradientBackgrounds';
import { INVITATION_CARD_MESSAGE_MAX } from '../../../constants/invitationCardLimits';
import {
  getCardPreviewStructureClass,
  normalizeCardStructure,
  resolveCardStructureFromBackgroundId } from
'../../../utils/cardStructure';
import { prepareBidiDisplayText } from '../../../utils/bidiText';
import './SocialInvitationCardPreview.css';
import { AppText } from "../../base";

function hexToRgbaString(hex, alpha) {
  if (!hex || typeof hex !== 'string' || !/^#[0-9A-Fa-f]{6}$/.test(hex)) return `rgba(0,0,0,${alpha})`;
  const h = hex.slice(1);
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/** One flowing paragraph for card overlay — no hard line breaks from AI/textarea. */
function normalizeInvitationFlowText(text) {
  return String(text || '').
  replace(/\r\n/g, '\n').
  replace(/\n+/g, ' ').
  replace(/\s+/g, ' ').
  trim();
}

/**
 * Non-AI visual card preview: gradient or template bg + frame + text + avatar + meta.
 * Frame preset sets border + text tints. Optional `cardThemeColor` (#rrggbb) uses one flat color
 * for the border and all copy, with no text-shadow.
 */
export default function SocialInvitationCardPreview({
  frameColorId = DEFAULT_FRAME_COLOR_ID,
  /** When #rrggbb, border + all card copy use this color (flat, no text-shadow). */
  cardThemeColor = null,
  cardFontId = DEFAULT_FONT_ID,
  occasionType,
  occasionCategoryId: occasionCategoryIdProp,
  cardBackgroundId = null,
  /** Preset gradient or solid fill id (see privateCardGradientBackgrounds). */
  cardGradientId = null,
  title = '',
  description = '',
  date = '',
  time = '',
  location = '',
  inviterName = '',
  inviterAvatarUrl = '',
  className = '',
  copyOffsetY = DEFAULT_CARD_COPY_OFFSET_Y,
  copyWidthPct = DEFAULT_CARD_COPY_WIDTH_PCT,
  copyFontScale = DEFAULT_CARD_COPY_FONT_SCALE,
  /** When true, card export / details — no sway animation */
  freezeMotion = false,
  /** @type {'social' | 'private'} */
  cardTemplateSet = 'private',
  /** Full-bleed hero (dating: user photo/video); same layout as template art */
  heroCoverSrc = null,
  /** @type {'image' | 'video' | null} */
  heroCoverMediaType = null,
  heroCoverPoster = null,
  /** When false, hide occasion headline, custom title, message, and host corner badge. */
  showHostAndMessage = true,
  /** `dark` | `light` | `none` — panel behind copy when `showHostAndMessage` on photo backgrounds. */
  textBackdropTone = DEFAULT_PRIVATE_TEXT_BACKDROP_TONE,
  /** Visual structure for template safe zones (dating card templates). */
  cardStructure: cardStructureProp = null,
  heroCoverPending = false
}) {
  const { i18n } = useTranslation();
  const frame = useMemo(() => getFrameColorById(frameColorId), [frameColorId]);
  const font = useMemo(() => getPrivateCardFontById(cardFontId), [cardFontId]);

  const categoryId = useMemo(() => {
    if (occasionCategoryIdProp) return occasionCategoryIdProp;
    return resolveOccasionCategoryId(occasionType);
  }, [occasionType, occasionCategoryIdProp]);

  const bgCandidates = useMemo(() => {
    if (cardTemplateSet === 'dating') {
      return resolvePrivateCardBackgroundUrlCandidates(cardBackgroundId, categoryId);
    }
    return resolveCardBackgroundUrlCandidates(categoryId, cardBackgroundId);
  }, [cardTemplateSet, categoryId, cardBackgroundId]);
  const hasTemplateBg = bgCandidates.length > 0;
  const [bgSrcIndex, setBgSrcIndex] = useState(0);

  useEffect(() => {
    setBgSrcIndex(0);
  }, [categoryId, cardBackgroundId]);

  const bgSrc = bgCandidates[bgSrcIndex];
  /** Active when a candidate URL exists; after all fail, index points past last → bgSrc undefined → gradient card */
  const templateArtActive = hasTemplateBg && Boolean(bgSrc);
  const canonicalBackgroundId = useMemo(() => {
    if (cardTemplateSet === 'dating') {
      if (!cardBackgroundId) return null;
      return resolveCanonicalPrivateBackgroundId(cardBackgroundId);
    }
    if (!categoryId || !cardBackgroundId) return null;
    return resolveCanonicalBackgroundId(categoryId, cardBackgroundId);
  }, [cardTemplateSet, categoryId, cardBackgroundId]);
  const hasHeroCover = Boolean(heroCoverSrc && heroCoverMediaType);
  const colorBackgroundCss = useMemo(
    () => resolvePrivateCardColorBackgroundCss(cardGradientId),
    [cardGradientId]
  );
  const colorBackgroundActive = Boolean(colorBackgroundCss) && !hasHeroCover;
  const hasPhotoBackground = templateArtActive || hasHeroCover;
  /** Color/gradient fills use the same centered copy layout as template art. */
  const fullBleedBackground = hasPhotoBackground || colorBackgroundActive;

  const resolvedCardStructure = useMemo(() => {
    if (cardStructureProp) return normalizeCardStructure(cardStructureProp);
    if (cardTemplateSet === 'dating' && cardBackgroundId) {
      return resolveCardStructureFromBackgroundId(cardBackgroundId);
    }
    return null;
  }, [cardStructureProp, cardTemplateSet, cardBackgroundId]);

  const textBackdropRgba = useMemo(() => {
    if (!showHostAndMessage || !hasPhotoBackground) return null;
    return privateTextBackdropToneToRgba(textBackdropTone);
  }, [showHostAndMessage, hasPhotoBackground, textBackdropTone]);

  /** One centered copy column on photo/template backgrounds — private & dating, with or without backdrop. */
  const preferUnifiedCopyPanel = showHostAndMessage && hasPhotoBackground;

  const useStructureLayout =
  showHostAndMessage &&
  templateArtActive &&
  !hasHeroCover &&
  cardTemplateSet === 'dating' &&
  Boolean(resolvedCardStructure) &&
  !preferUnifiedCopyPanel;

  const structureLayoutClass = useStructureLayout ?
  ` ${getCardPreviewStructureClass(resolvedCardStructure)} social-invitation-card-preview--structure-layout` :
  '';

  const darkTemplateArt =
  !hasHeroCover &&
  templateArtActive && (
  cardTemplateSet === 'dating' ?
  PRIVATE_DARK_TEMPLATE_BACKGROUND_IDS.has(String(canonicalBackgroundId || '').toLowerCase()) :
  DARK_TEMPLATE_BACKGROUND_IDS.has(String(canonicalBackgroundId || '').toLowerCase()));

  const resolvedThemeHex = useMemo(() => {
    if (!cardThemeColor || typeof cardThemeColor !== 'string') return null;
    const s = cardThemeColor.trim();
    return /^#[0-9A-Fa-f]{6}$/.test(s) ? s : null;
  }, [cardThemeColor]);

  const innerChromeStyle = useMemo(() => {
    if (resolvedThemeHex) {
      return {
        borderColor: resolvedThemeHex,
        boxShadow: `0 0 0 1px ${hexToRgbaString(resolvedThemeHex, 0.4)}, 0 10px 28px rgba(0, 0, 0, 0.26)`
      };
    }
    return { borderColor: frame.border, boxShadow: frame.shadow };
  }, [resolvedThemeHex, frame]);

  const lightBackdropOnPhoto =
  textBackdropTone === 'light' && Boolean(textBackdropRgba);
  const frostedGlassBackdrop =
  textBackdropTone === 'glass' && Boolean(textBackdropRgba);

  /**
   * On template art, use frame palette. Dark artwork needs lifted tints + shadow or
   * the (intentionally dark) frame colors vanish on the photo.
   */
  const textStyles = useMemo(() => {
    if (resolvedThemeHex) {
      const flat = { color: resolvedThemeHex, textShadow: 'none' };
      return { occasion: flat, title: flat, message: flat, host: flat };
    }
    const photoShadow =
    hasPhotoBackground && textBackdropTone === 'none' ?
    PHOTO_BACKGROUND_TEXT_SHADOW :
    hasPhotoBackground ?
    '0 1px 2px rgba(0, 0, 0, 0.45)' :
    'none';
    if (templateArtActive) {
      if (darkTemplateArt) {
        const shadow = DARK_TEMPLATE_TEXT_SHADOW;
        return {
          occasion: {
            color: adjustFrameTextForDarkTemplate(frame.textMeta),
            textShadow: shadow
          },
          title: {
            color: adjustFrameTextForDarkTemplate(frame.textTitle),
            textShadow: shadow
          },
          message: {
            color: adjustFrameTextForDarkTemplate(frame.textMessage),
            textShadow: shadow
          },
          host: {
            color: adjustFrameTextForDarkTemplate(frame.textHost),
            textShadow: shadow
          }
        };
      }
      const withShadow = (color) => ({ color, textShadow: photoShadow });
      return {
        occasion: withShadow(frame.textMeta),
        title: withShadow(frame.textTitle),
        message: withShadow(frame.textMessage),
        host: withShadow(frame.textHost)
      };
    }

    if (colorBackgroundActive) {
      return {
        occasion: { color: frame.textMeta, textShadow: 'none' },
        title: { color: frame.textTitle, textShadow: 'none' },
        message: { color: frame.textMessage, textShadow: 'none' },
        host: { color: frame.textHost, textShadow: 'none' }
      };
    }

    if (hasHeroCover) {
      if (lightBackdropOnPhoto) {
        const flat = (color) => ({ color, textShadow: 'none' });
        return {
          occasion: flat(frame.textMeta),
          title: flat(frame.textTitle),
          message: flat(frame.textMessage),
          host: flat(frame.textHost)
        };
      }
      if (frostedGlassBackdrop) {
        const withShadow = (color) => ({ color, textShadow: photoShadow });
        return {
          occasion: withShadow('rgba(255, 255, 255, 0.88)'),
          title: withShadow('#fafafa'),
          message: withShadow('rgba(255, 255, 255, 0.84)'),
          host: withShadow('rgba(255, 255, 255, 0.92)')
        };
      }
      const withShadow = (color) => ({ color, textShadow: photoShadow });
      return {
        occasion: withShadow('rgba(255, 255, 255, 0.82)'),
        title: withShadow('#fafafa'),
        message: withShadow('rgba(255, 255, 255, 0.78)'),
        host: withShadow('rgba(255, 255, 255, 0.9)')
      };
    }

    return {
      occasion: { color: 'rgba(255, 255, 255, 0.82)', textShadow: 'none' },
      title: { color: '#fafafa', textShadow: 'none' },
      message: { color: 'rgba(255, 255, 255, 0.78)', textShadow: 'none' },
      host: { color: 'rgba(255, 255, 255, 0.9)', textShadow: 'none' }
    };
  }, [
  frame,
  templateArtActive,
  darkTemplateArt,
  resolvedThemeHex,
  colorBackgroundActive,
  hasPhotoBackground,
  hasHeroCover,
  textBackdropTone,
  textBackdropRgba,
  frostedGlassBackdrop,
  lightBackdropOnPhoto]
  );

  const titleTrimmed = normalizeInvitationFlowText(title);
  const hasCardTitle = Boolean(titleTrimmed);
  const descRaw = normalizeInvitationFlowText(description);
  const descClipped =
  descRaw.length > INVITATION_CARD_MESSAGE_MAX ?
  `${descRaw.slice(0, INVITATION_CARD_MESSAGE_MAX - 1)}…` :
  descRaw;

  const titleBidi = useMemo(
    () => prepareBidiDisplayText(titleTrimmed, i18n.language),
    [titleTrimmed, i18n.language]
  );
  const messageBidi = useMemo(
    () => prepareBidiDisplayText(descClipped, i18n.language),
    [descClipped, i18n.language]
  );
  const hostBidi = useMemo(
    () => prepareBidiDisplayText(inviterName || '—', i18n.language),
    [inviterName, i18n.language]
  );
  const isShareExport = className.includes('share-export');
  const handleBgImageError = () => {
    setBgSrcIndex((prev) => prev + 1);
  };

  const resolvedCopyOffsetY = clampCardCopyOffsetY(copyOffsetY);
  const resolvedCopyWidthPct = clampCardCopyWidthPct(copyWidthPct);
  const resolvedCopyFontScale = clampCardCopyFontScale(copyFontScale);

  const copyLayoutVars = useMemo(
    () => ({
      '--private-card-copy-width': `${resolvedCopyWidthPct}%`,
      '--private-text-backdrop-width': `${resolvedCopyWidthPct}%`,
      '--private-card-copy-offset-y': cardCopyOffsetToCssPercent(resolvedCopyOffsetY),
      '--private-card-copy-font-scale': String(cardCopyFontScaleToMultiplier(resolvedCopyFontScale))
    }),
    [resolvedCopyOffsetY, resolvedCopyWidthPct, resolvedCopyFontScale]
  );

  const motionClass = !freezeMotion ? ' social-invitation-card-preview--card-motion-bob' : '';

  const minimalBodyClass = showHostAndMessage ? '' : ' social-invitation-card-preview--host-message-hidden';
  const hostChipVisibleClass =
  showHostAndMessage && Boolean(hostBidi.text && hostBidi.text !== '—') ?
  ' social-invitation-card-preview--host-chip-visible' :
  '';
  const textBackdropClass = textBackdropRgba ? ' social-invitation-card-preview--text-backdrop' : '';
  const textBackdropLightClass =
  lightBackdropOnPhoto ? ' social-invitation-card-preview--text-backdrop-light' : '';
  const textBackdropFrostedClass =
  frostedGlassBackdrop ? ' social-invitation-card-preview--text-backdrop-frosted' : '';
  const unifiedCopyClass = preferUnifiedCopyPanel ? ' social-invitation-card-preview--unified-copy' : '';
  const colorBgClass = colorBackgroundActive ? ' social-invitation-card-preview--color-bg' : '';
  const photoBgClass = fullBleedBackground ? ' social-invitation-card-preview--photo-bg' : '';

  const iconEl =
  !templateArtActive && !colorBackgroundActive ?
  <div className="social-invitation-card-preview__icon-wrap">
                <SocialCardCategoryIcon categoryId={categoryId} />
            </div> :
  null;

  const titleEl = hasCardTitle ?
  <AppText as="h3"
  className="social-invitation-card-preview__title social-invitation-card-preview__bidi"
  style={textStyles.title}
  dir={titleBidi.dir}
  lang={titleBidi.lang}>
    
            {titleBidi.text}
        </AppText> :
  null;

  const messageEl = messageBidi.text ?
  <AppText as="p"
  className="social-invitation-card-preview__message social-invitation-card-preview__bidi"
  style={textStyles.message}
  dir={messageBidi.dir}
  lang={messageBidi.lang}>
    
            {messageBidi.text}
        </AppText> :
  !textBackdropRgba ?
  <AppText as="p"
  className="social-invitation-card-preview__message social-invitation-card-preview__message--placeholder"
  aria-hidden="true"
  style={textStyles.message}>
    
            &nbsp;
        </AppText> :
  null;

  const hostChipEl =
  showHostAndMessage && hostBidi.text && hostBidi.text !== '—' ?
  <div className="social-invitation-card-preview__host-chip" dir={hostBidi.dir} aria-hidden>
                {inviterAvatarUrl ?
    <img
      className="social-invitation-card-preview__host-chip-avatar"
      src={inviterAvatarUrl}
      alt=""
      decoding="async"
      loading={isShareExport ? 'eager' : 'lazy'}
      draggable={false} /> :


    <AppText as="span"
    className="social-invitation-card-preview__host-chip-avatar social-invitation-card-preview__host-chip-avatar--empty"
    aria-hidden />

    }
                <AppText as="span"
    className="social-invitation-card-preview__host-chip-name social-invitation-card-preview__bidi"
    dir={hostBidi.dir}
    lang={hostBidi.lang}>
      
                    {hostBidi.text}
                </AppText>
            </div> :
  null;

  const copyContent =
  <>
            {iconEl}
            {titleEl}
            {messageEl}
        </>;


  const cardDir = i18n.dir?.() || (i18n.language?.startsWith('ar') ? 'rtl' : 'ltr');

  return (
    <div
      className={`social-invitation-card-preview ${className}${photoBgClass}${colorBgClass}${darkTemplateArt ? ' social-invitation-card-preview--dark-template-bg' : ''}${textBackdropClass}${textBackdropLightClass}${textBackdropFrostedClass}${unifiedCopyClass}${structureLayoutClass}${motionClass}${minimalBodyClass}${hostChipVisibleClass}`.trim()}
      dir={cardDir}
      style={copyLayoutVars}>
      
            <div
        className={`social-invitation-card-preview__inner${fullBleedBackground ? ' social-invitation-card-preview__inner--photo-bg' : ''}`}
        dir={cardDir}
        style={{
          ...innerChromeStyle,
          ...(textBackdropRgba ? { '--private-text-backdrop-bg': textBackdropRgba } : null)
        }}>
        
                {hasHeroCover && heroCoverMediaType === 'video' ?
        <video
          key={heroCoverSrc}
          className="social-invitation-card-preview__bg social-invitation-card-preview__bg--video"
          src={heroCoverSrc}
          poster={heroCoverPoster || undefined}
          autoPlay={!freezeMotion}
          muted
          loop={!freezeMotion}
          playsInline
          preload="metadata"
          aria-hidden /> :

        hasHeroCover && heroCoverMediaType === 'image' ?
        <img
          className="social-invitation-card-preview__bg social-invitation-card-preview__bg--image"
          src={heroCoverSrc}
          alt=""
          decoding="async"
          loading="eager"
          draggable={false} /> :

        colorBackgroundActive ?
        <div
          className="social-invitation-card-preview__bg social-invitation-card-preview__bg--color"
          style={{ background: colorBackgroundCss }} /> :

        templateArtActive && bgSrc ?
        <img
          className="social-invitation-card-preview__bg social-invitation-card-preview__bg--image"
          src={bgSrc}
          alt=""
          decoding="async"
          loading="eager"
          draggable={false}
          onError={handleBgImageError} /> :


        <div className="social-invitation-card-preview__bg" />
        }

                {heroCoverPending ?
        <div className="social-invitation-card-preview__pending" aria-hidden>
                        <div className="social-invitation-card-preview__pending-inner">
                            <AppText as="span" className="social-invitation-card-preview__pending-spinner" aria-hidden />
                            <AppText as="span" className="social-invitation-card-preview__pending-text">Preparing image…</AppText>
                        </div>
                    </div> :
        null}

                {hostChipEl}

                <div className="social-invitation-card-preview__text-stack">
                    <div
            className={`social-invitation-card-preview__main${
            textBackdropRgba ? ' social-invitation-card-preview__text-panel' : ''}`
            }
            style={{ fontFamily: font.cssFamily }}>
            
                        {showHostAndMessage ?
            useStructureLayout ?
            <div className="social-invitation-card-preview__copy-zone">{copyContent}</div> :

            copyContent :

            null}
                    </div>
                </div>
            </div>
        </div>);

}