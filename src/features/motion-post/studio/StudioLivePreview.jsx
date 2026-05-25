import React, { useMemo } from 'react';
import { FaPlus } from 'react-icons/fa';
import {
    layoutToPreviewAspect,
    STUDIO_NEON_BG,
    STUDIO_PROMO_STICKERS,
    studioOverlayFill,
} from './studioConstants';
import {
    STUDIO_ANIM_BODY_DELAY_MS,
    normalizeStudioTextAnimation,
    studioTextAnimStyle,
} from './studioTextAnimation';
import StudioTextBlock from './StudioTextBlock';
import StudioTextAnimWrap from './StudioTextAnimWrap';
import './StudioLivePreview.css';

/** @param {{ stickers: { id: string; stickerId: string; slot?: string }[]; onRemoveSticker?: (id: string) => void; zone?: 'cover' | 'overlay' }} props */
function PromoStickersLayer({ stickers, onRemoveSticker, zone = 'overlay' }) {
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
                            color: def.color || undefined,
                        }}
                    >
                        <span className="sps-preview__promo-text">{def.display}</span>
                        {onRemoveSticker ? (
                            <button
                                type="button"
                                className="sps-preview__promo-remove"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onRemoveSticker(inst.id);
                                }}
                                aria-label="Remove sticker"
                            >
                                ×
                            </button>
                        ) : null}
                    </div>
                );
            })}
        </div>
    );
}

function ImagePickZone({
    hasImage,
    imageUrl,
    onPick,
    addLabel,
    changeLabel,
    readOnly = false,
    colorOnly = false,
}) {
    return (
        <div
            className={`sps-preview__image-zone${!hasImage ? ' sps-preview__image-zone--empty' : ''}${
                colorOnly ? ' sps-preview__image-zone--color-only' : ''
            }`}
        >
            {hasImage ? <img src={imageUrl} alt="" className="sps-preview__media" /> : null}
            {!readOnly ? (
                <button
                    type="button"
                    className={`sps-preview__image-add-btn${
                        hasImage ? '' : ' sps-preview__image-add-btn--corner'
                    }`}
                    onClick={onPick}
                    aria-label={hasImage ? changeLabel : addLabel}
                    title={hasImage ? changeLabel : addLabel}
                >
                    <FaPlus size={14} aria-hidden />
                    {hasImage ? <span>{changeLabel}</span> : null}
                </button>
            ) : null}
        </div>
    );
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
    readOnly = false,
    onImagePick,
    scrollContainerRef,
    imagePickLabel = 'إضافة صورة',
    imageChangeLabel = 'تغيير الصورة',
    promoStickers = [],
    onRemovePromoSticker,
    textAnimation = 'slide',
    animPlayKey = 0,
    /** When true (feed), text stays at pre-animation state until animPlayKey > 0. */
    freezeUntilPlayed = false,
}) {
    const entranceAnim = normalizeStudioTextAnimation(textAnimation);
    const aspectClass =
        layoutModel === 'story'
            ? 'sps-preview--story'
            : layoutModel === 'header_card'
              ? 'sps-preview--header'
              : 'sps-preview--square';

    const textStyle = useMemo(
        () => ({
            fontFamily: style.fontFamily || '"Cairo", "Tajawal", sans-serif',
            fontSize: `${style.titleFontSize ?? style.fontSize ?? 26}px`,
            fontWeight: style.fontWeight || 700,
            fontStyle: style.fontStyle || 'normal',
            textAlign: style.textAlign || 'center',
            letterSpacing: `${style.letterSpacing ?? 0}px`,
            lineHeight: style.lineHeight ?? 1.25,
        }),
        [style]
    );

    const bodyStyle = useMemo(
        () => ({
            ...textStyle,
            fontSize: `${style.bodyFontSize ?? Math.max(14, (style.titleFontSize ?? style.fontSize ?? 26) - 4)}px`,
            fontWeight: Math.min(600, style.fontWeight || 600),
        }),
        [textStyle, style.bodyFontSize, style.titleFontSize, style.fontSize, style.fontWeight]
    );

    const hasImage = Boolean(imageUrl);
    const userBackdrop =
        style.backgroundColor && style.backgroundColor !== 'transparent'
            ? style.backgroundColor
            : null;
    /** Unified canvas: custom color, or default panel tone when posting without a photo. */
    const canvasBg = userBackdrop || (!hasImage ? STUDIO_NEON_BG : null);
    const useHeaderSplit = layoutModel === 'header_card' && hasImage;

    const headerPanelBg =
        useHeaderSplit && userBackdrop
            ? userBackdrop
            : useHeaderSplit
              ? 'var(--sps-panel-bg, #161920)'
              : 'transparent';

    const overlayTint = style.overlayTintColor ?? '#000000';
    const overlayAlpha = Math.min(1, Math.max(0, Number(style.overlayOpacity ?? 35) / 100));
    const overlayFill = studioOverlayFill(overlayTint, overlayAlpha);
    const showPhotoOverlay = hasImage && overlayTint !== 'transparent' && overlayAlpha > 0;
    const useTextScrim =
        !useHeaderSplit && !showPhotoOverlay && !hasImage && !canvasBg;

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
            paddingBottom: `${style.textPaddingBottom ?? 0}px`,
        }),
        [style.textStackGap, style.textPaddingTop, style.textPaddingBottom]
    );

    const titlePh = 'اكتب العنوان هنا';
    const bodyPh = 'اكتب الرسالة هنا';

    const shouldAnimate = !freezeUntilPlayed || animPlayKey > 0;
    const titleAnimStyle = useMemo(
        () => (shouldAnimate ? studioTextAnimStyle(entranceAnim, 0) : {}),
        [entranceAnim, animPlayKey, shouldAnimate]
    );
    const bodyAnimStyle = useMemo(
        () => (shouldAnimate ? studioTextAnimStyle(entranceAnim, STUDIO_ANIM_BODY_DELAY_MS) : {}),
        [entranceAnim, animPlayKey, shouldAnimate]
    );

    const textBlock = (
        <div key={animPlayKey} className="sps-preview__text-stack" style={textStackStyle}>
            <StudioTextAnimWrap animStyle={titleAnimStyle}>
                <StudioTextBlock
                    tag="h2"
                    layer="title"
                    studioStyle={style}
                    className={`sps-preview__title${readOnly ? '' : ' sps-preview__editable sps-preview__editable--entrance'}`}
                    value={title}
                    placeholder={titlePh}
                    style={textStyle}
                    maxLength={60}
                    onChange={onTitleChange}
                    onFocus={() => onFocusField?.('title')}
                    onBlurField={onBlurField}
                    typingMode={typingMode}
                    isActive={activeField === 'title'}
                    scrollContainerRef={scrollContainerRef}
                    readOnly={readOnly}
                />
            </StudioTextAnimWrap>
            <StudioTextAnimWrap animStyle={bodyAnimStyle}>
                <StudioTextBlock
                    tag="p"
                    layer="body"
                    studioStyle={style}
                    className={`sps-preview__body${readOnly ? '' : ' sps-preview__editable sps-preview__editable--entrance'}`}
                    value={body}
                    placeholder={bodyPh}
                    style={bodyStyle}
                    maxLength={180}
                    onChange={onBodyChange}
                    onFocus={() => onFocusField?.('body')}
                    onBlurField={onBlurField}
                    typingMode={typingMode}
                    isActive={activeField === 'body'}
                    scrollContainerRef={scrollContainerRef}
                    readOnly={readOnly}
                />
            </StudioTextAnimWrap>
        </div>
    );

    const fullCanvasLayout = (
        <div className="sps-preview__overlay-wrap">
            {userBackdrop && hasImage ? (
                <div
                    className="sps-preview__backdrop"
                    style={{ background: userBackdrop }}
                    aria-hidden
                />
            ) : null}
            <ImagePickZone
                hasImage={hasImage}
                imageUrl={imageUrl}
                onPick={onImagePick}
                addLabel={imagePickLabel}
                changeLabel={imageChangeLabel}
                readOnly={readOnly}
                colorOnly={!hasImage}
            />
            {showPhotoOverlay ? (
                <div
                    className="sps-preview__photo-tint"
                    style={{ background: overlayFill }}
                    aria-hidden
                />
            ) : null}
            {useTextScrim ? <div className="sps-preview__scrim" aria-hidden /> : null}
            <PromoStickersLayer
                stickers={promoStickers}
                onRemoveSticker={readOnly ? undefined : onRemovePromoSticker}
                zone="overlay"
            />
            <div
                className={`sps-preview__overlay-text sps-preview__text-zone ${vAlignClass}${
                    useTextScrim ? ' sps-preview__overlay-text--scrim' : ''
                }`}
                data-v-align={vAlign}
            >
                {textBlock}
            </div>
        </div>
    );

    return (
        <div
            className={`sps-preview ${aspectClass}${freezeUntilPlayed && !shouldAnimate ? ' sps-preview--hold-anim' : ''}${
                !hasImage ? ' sps-preview--no-image' : ''
            }`}
            style={canvasBg ? { background: canvasBg } : undefined}
            data-aspect={layoutToPreviewAspect(layoutModel)}
            aria-label="Live preview"
        >
            {useHeaderSplit ? (
                <>
                    <div className="sps-preview__cover">
                        {userBackdrop ? (
                            <div
                                className="sps-preview__backdrop"
                                style={{ background: userBackdrop }}
                                aria-hidden
                            />
                        ) : null}
                        <ImagePickZone
                            hasImage={hasImage}
                            imageUrl={imageUrl}
                            onPick={onImagePick}
                            addLabel={imagePickLabel}
                            changeLabel={imageChangeLabel}
                            readOnly={readOnly}
                        />
                        {showPhotoOverlay ? (
                            <div
                                className="sps-preview__photo-tint"
                                style={{ background: overlayFill }}
                                aria-hidden
                            />
                        ) : null}
                        <PromoStickersLayer
                            stickers={promoStickers}
                            onRemoveSticker={readOnly ? undefined : onRemovePromoSticker}
                            zone="cover"
                        />
                    </div>
                    <div
                        className={`sps-preview__panel sps-preview__text-zone ${vAlignClass}`}
                        style={{ background: headerPanelBg }}
                    >
                        {textBlock}
                    </div>
                </>
            ) : (
                fullCanvasLayout
            )}
        </div>
    );
}
