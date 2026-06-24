import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { FaPlus } from 'react-icons/fa';
import {
  layoutToPreviewAspect,
  STUDIO_PROMO_STICKERS,
  studioOverlayFill,
  studioPromoStickerLabel } from
'./studioConstants';
import {
  STUDIO_ANIM_BODY_DELAY_MS,
  normalizeStudioTextAnimation,
  studioTextAnimStyle } from
'./studioTextAnimation';
import StudioTextBlock from './StudioTextBlock';
import StudioTextAnimWrap from './StudioTextAnimWrap';
import './StudioLivePreview.css';

/** @param {{ stickers: { id: string; stickerId: string; slot?: string }[]; onRemoveSticker?: (id: string) => void; zone?: 'cover' | 'overlay'; t: (key: string, fallback?: string) => string }} props */import { AppText } from "../../../components/base";
function PromoStickersLayer({ stickers, onRemoveSticker, zone = 'overlay', t }) {
  if (!stickers?.length) return null;

  const zoneClass = zone === 'overlay' ? 'sps-preview__promos--overlay' : 'sps-preview__promos--cover';

  return (
    <div className={`sps-preview__promos ${zoneClass}`} aria-label="Promotional stickers">
            {stickers.map((inst) => {
        const def = STUDIO_PROMO_STICKERS.find((s) => s.id === inst.stickerId);
        if (!def) return null;
        const corner = inst.slot || 'corner-ts';
        return (
          <div
            key={inst.id}
            className={`sps-preview__promo sps-preview__promo--${def.variant} sps-preview__promo--${corner}`}
            style={{
              background: def.bg || undefined,
              color: def.color || undefined
            }}>

                        <AppText as="span" className="sps-preview__promo-text">{studioPromoStickerLabel(def, t)}</AppText>
                        {onRemoveSticker ?
            <button
              type="button"
              className="sps-preview__promo-remove"
              onClick={(e) => {
                e.stopPropagation();
                onRemoveSticker(inst.id);
              }}
              aria-label="Remove sticker">

                                ×
                            </button> :
            null}
                    </div>);

      })}
        </div>);

}

function ImagePickZone({
  hasImage,
  imageUrl,
  onPick,
  addLabel,
  changeLabel,
  readOnly = false,
  colorOnly = false,
  /** Banner header: dedicated cover strip above the text panel */
  variant = 'default'
}) {
  const isBannerCover = variant === 'banner-cover';

  return (
    <div
      className={`sps-preview__image-zone${!hasImage ? ' sps-preview__image-zone--empty' : ''}${
      colorOnly ? ' sps-preview__image-zone--color-only' : ''}${
      isBannerCover ? ' sps-preview__image-zone--banner-cover' : ''}`}>

            {hasImage ? <img src={imageUrl} alt="" className="sps-preview__media" /> : null}
            {!readOnly && isBannerCover && !hasImage ?
      <button
        type="button"
        className="sps-preview__banner-cover-pick"
        onClick={onPick}
        aria-label={addLabel}
        title={addLabel}>

                    <FaPlus size={18} aria-hidden />
                    <AppText as="span">{addLabel}</AppText>
                </button> :
      null}
            {!readOnly && (!isBannerCover || hasImage) ?
      <button
        type="button"
        className={`sps-preview__image-add-btn${
        hasImage || isBannerCover ? '' : ' sps-preview__image-add-btn--corner'}`
        }
        onClick={onPick}
        aria-label={hasImage ? changeLabel : addLabel}
        title={hasImage ? changeLabel : addLabel}>

                    <FaPlus size={14} aria-hidden />
                    {hasImage || isBannerCover ? <AppText as="span">{hasImage ? changeLabel : addLabel}</AppText> : null}
                </button> :
      null}
        </div>);

}

/**
 * Fast local preview with inline editing on the card.
 */
export default function StudioLivePreview({
  layoutModel = 'square',
  title = '',
  body = '',
  imageUrl = '',
  style = {},
  activeField = 'title',
  onTitleChange,
  onBodyChange,
  onFocusField,
  onBlurField,
  typingMode = false,
  /** Mobile: tap opens plain composer; preview shows formatted text only. */
  handoffComposer = false,
  readOnly = false,
  onImagePick,
  scrollContainerRef,
  imagePickLabel,
  imageChangeLabel,
  promoStickers = [],
  onRemovePromoSticker,
  textAnimation = 'slide',
  animPlayKey = 0,
  /** When true (feed), text stays at pre-animation state until animPlayKey > 0. */
  freezeUntilPlayed = false
}) {
  const { t } = useTranslation();
  const resolvedImagePickLabel = imagePickLabel ?? t('studio_tap_image', 'Tap to add image');
  const resolvedImageChangeLabel = imageChangeLabel ?? t('studio_tap_change_image', 'Tap to change image');
  const titlePh = t('studio_title_placeholder', 'Write title here');
  const bodyPh = t('studio_body_placeholder', 'Write message here');

  const entranceAnim = normalizeStudioTextAnimation(textAnimation);
  const aspectClass =
  layoutModel === 'story' ?
  'sps-preview--story' :
  layoutModel === 'header_card' ?
  'sps-preview--header' :
  'sps-preview--square';

  const textStyle = useMemo(
    () => ({
      fontFamily: style.fontFamily || '"Cairo", "Tajawal", sans-serif',
      fontSize: `${style.titleFontSize ?? style.fontSize ?? 26}px`,
      fontWeight: style.fontWeight || 700,
      fontStyle: style.fontStyle || 'normal',
      textAlign: style.textAlign || 'center',
      letterSpacing: `${style.letterSpacing ?? 0}px`,
      lineHeight: style.lineHeight ?? 1.25
    }),
    [style]
  );

  const bodyStyle = useMemo(
    () => ({
      ...textStyle,
      fontSize: `${style.bodyFontSize ?? Math.max(14, (style.titleFontSize ?? style.fontSize ?? 26) - 4)}px`,
      fontWeight: Math.min(600, style.fontWeight || 600)
    }),
    [textStyle, style.bodyFontSize, style.titleFontSize, style.fontSize, style.fontWeight]
  );

  const hasImage = Boolean(imageUrl);
  const userBackdrop =
  style.backgroundColor && style.backgroundColor !== 'transparent' ?
  style.backgroundColor :
  null;
  /** Custom canvas color only; default empty canvas uses --sps-preview-bg from theme CSS. */
  const canvasBg = userBackdrop || null;
  /** Published feed (readOnly) keeps the original behavior: split only when there is an image. */
  const useHeaderSplit = layoutModel === 'header_card' && (hasImage || !readOnly);
  /** Zone divider/labels are editor chrome only — never shown on the published post. */
  const showZoneChrome = useHeaderSplit && !readOnly;
  const imageZoneLabel = t('studio_banner_image_zone', 'Image area');
  const textZoneLabel = t('studio_banner_text_zone', 'Text area');

  const headerPanelBg =
  useHeaderSplit && userBackdrop ?
  userBackdrop :
  useHeaderSplit && readOnly ?
  'var(--sps-panel-bg, #161920)' :
  useHeaderSplit ?
  'var(--sps-preview-text-panel-bg, #0f1115)' :
  'transparent';

  const overlayTint = style.overlayTintColor ?? '#000000';
  const overlayAlpha = Math.min(1, Math.max(0, Number(style.overlayOpacity ?? 35) / 100));
  const overlayFill = studioOverlayFill(overlayTint, overlayAlpha);
  const showPhotoOverlay = hasImage && overlayTint !== 'transparent' && overlayAlpha > 0;
  const useTextScrim =
  !useHeaderSplit && !showPhotoOverlay && !hasImage && Boolean(userBackdrop);

  const vAlign = style.textVerticalAlign || 'center';
  const vAlignClass = `sps-preview__text-zone--${vAlign}`;

  const textStackStyle = useMemo(
    () => ({
      display: 'flex',
      flexDirection: 'column',
      width: '100%',
      minWidth: 0,
      gap: `${Number(style.textStackGap ?? 6)}px`,
      paddingTop: `${style.textPaddingTop ?? 0}px`,
      paddingBottom: `${style.textPaddingBottom ?? 0}px`
    }),
    [style.textStackGap, style.textPaddingTop, style.textPaddingBottom]
  );

  const shouldAnimate = !freezeUntilPlayed || animPlayKey > 0;
  const titleAnimStyle = useMemo(
    () => shouldAnimate ? studioTextAnimStyle(entranceAnim, 0) : {},
    [entranceAnim, animPlayKey, shouldAnimate]
  );
  const bodyAnimStyle = useMemo(
    () => shouldAnimate ? studioTextAnimStyle(entranceAnim, STUDIO_ANIM_BODY_DELAY_MS) : {},
    [entranceAnim, animPlayKey, shouldAnimate]
  );

  const editableClass = handoffComposer || readOnly ? '' : ' sps-preview__editable sps-preview__editable--entrance';
  const blockReadOnly = readOnly || handoffComposer;

  const wrapComposerHit = (field, node) => {
    if (!handoffComposer || readOnly) return node;
    return (
      <div
        role="button"
        tabIndex={0}
        className={`sps-preview__composer-hit${activeField === field ? ' is-active' : ''}`}
        onPointerDown={(e) => {
          if (e.pointerType === 'mouse' && e.button !== 0) return;
          onFocusField?.(field);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onFocusField?.(field);
          }
        }}
        aria-label={field === 'title' ? titlePh : bodyPh}>

                {node}
            </div>);

  };

  const textBlock =
  <div key={animPlayKey} className="sps-preview__text-stack" style={textStackStyle}>
            <StudioTextAnimWrap animStyle={titleAnimStyle}>
                {wrapComposerHit(
        'title',
        <StudioTextBlock
          tag="h2"
          layer="title"
          studioStyle={style}
          className={`sps-preview__title${editableClass}`}
          value={title}
          placeholder={titlePh}
          style={textStyle}
          maxLength={60}
          onChange={onTitleChange}
          onFocus={() => !handoffComposer && onFocusField?.('title')}
          onBlurField={onBlurField}
          typingMode={typingMode}
          isActive={activeField === 'title'}
          scrollContainerRef={scrollContainerRef}
          readOnly={blockReadOnly} />

      )}
            </StudioTextAnimWrap>
            <StudioTextAnimWrap animStyle={bodyAnimStyle}>
                {wrapComposerHit(
        'body',
        <StudioTextBlock
          tag="p"
          layer="body"
          studioStyle={style}
          className={`sps-preview__body${editableClass}`}
          value={body}
          placeholder={bodyPh}
          style={bodyStyle}
          maxLength={180}
          onChange={onBodyChange}
          onFocus={() => !handoffComposer && onFocusField?.('body')}
          onBlurField={onBlurField}
          typingMode={typingMode}
          isActive={activeField === 'body'}
          scrollContainerRef={scrollContainerRef}
          readOnly={blockReadOnly} />

      )}
            </StudioTextAnimWrap>
        </div>;


  const fullCanvasLayout =
  <div className="sps-preview__overlay-wrap">
            {userBackdrop && hasImage ?
    <div
      className="sps-preview__backdrop"
      style={{ background: userBackdrop }}
      aria-hidden /> :

    null}
            <ImagePickZone
      hasImage={hasImage}
      imageUrl={imageUrl}
      onPick={onImagePick}
      addLabel={resolvedImagePickLabel}
      changeLabel={resolvedImageChangeLabel}
      readOnly={readOnly}
      colorOnly={!hasImage} />

            {showPhotoOverlay ?
    <div
      className="sps-preview__photo-tint"
      style={{ background: overlayFill }}
      aria-hidden /> :

    null}
            {useTextScrim ? <div className="sps-preview__scrim" aria-hidden /> : null}
            <PromoStickersLayer
      stickers={promoStickers}
      onRemoveSticker={readOnly ? undefined : onRemovePromoSticker}
      zone="overlay"
      t={t} />

            <div
      className={`sps-preview__overlay-text sps-preview__text-zone ${vAlignClass}${
      useTextScrim ? ' sps-preview__overlay-text--scrim' : ''}`
      }
      data-v-align={vAlign}>

                {textBlock}
            </div>
        </div>;


  return (
    <div
      className={`sps-preview ${aspectClass}${freezeUntilPlayed && !shouldAnimate ? ' sps-preview--hold-anim' : ''}${
      !hasImage && !useHeaderSplit ? ' sps-preview--no-image' : ''}${
      showZoneChrome ? ' sps-preview--header-split' : ''}`}
      style={canvasBg ? { background: canvasBg } : undefined}
      data-aspect={layoutToPreviewAspect(layoutModel)}
      aria-label="Live preview">

            {useHeaderSplit ?
      <>
                    <div
          className={`sps-preview__cover${hasImage ? '' : ' sps-preview__cover--empty'}`}
          aria-label={imageZoneLabel}>

                        {showZoneChrome ?
          <AppText as="span" className="sps-preview__zone-tag sps-preview__zone-tag--cover">
                                {imageZoneLabel}
                            </AppText> :
          null}
                        {userBackdrop ?
          <div
            className="sps-preview__backdrop"
            style={{ background: userBackdrop }}
            aria-hidden /> :

          null}
                        <ImagePickZone
            hasImage={hasImage}
            imageUrl={imageUrl}
            onPick={onImagePick}
            addLabel={resolvedImagePickLabel}
            changeLabel={resolvedImageChangeLabel}
            readOnly={readOnly}
            variant="banner-cover" />

                        {showPhotoOverlay ?
          <div
            className="sps-preview__photo-tint"
            style={{ background: overlayFill }}
            aria-hidden /> :

          null}
                        <PromoStickersLayer
            stickers={promoStickers}
            onRemoveSticker={readOnly ? undefined : onRemovePromoSticker}
            zone="cover"
            t={t} />

                    </div>
                    {showZoneChrome ?
        <div className="sps-preview__header-divider" aria-hidden /> :
        null}
                    <div
          className={`sps-preview__panel sps-preview__text-zone ${vAlignClass}`}
          style={{ background: headerPanelBg }}
          aria-label={textZoneLabel}>

                        {showZoneChrome ?
          <AppText as="span" className="sps-preview__zone-tag sps-preview__zone-tag--text">
                                {textZoneLabel}
                            </AppText> :
          null}
                        {textBlock}
                    </div>
                </> :

      fullCanvasLayout
      }
        </div>);

}