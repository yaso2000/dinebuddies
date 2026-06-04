import React, { useMemo, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import PrivateCardCategoryIcon from './PrivateCardCategoryIcon';
import { getFrameColorById, DEFAULT_FRAME_COLOR_ID } from './privateCardFrameColors';
import { resolveOccasionCategoryId } from './privateCardOccasionMap';
import {
    resolveCardBackgroundUrlCandidates,
    resolveCanonicalBackgroundId,
    DARK_TEMPLATE_BACKGROUND_IDS
} from './privateCardBackgrounds';
import {
    resolveDatingCardBackgroundUrlCandidates,
    resolveCanonicalDatingBackgroundId,
    DATING_DARK_TEMPLATE_BACKGROUND_IDS
} from '../datingCard/datingCardBackgrounds';
import { getPrivateCardFontById, DEFAULT_FONT_ID } from './privateCardFonts';
import { DEFAULT_MOTION_ID, isPrivateCardMotionId } from './privateCardMotions';
import {
    adjustFrameTextForDarkTemplate,
    DARK_TEMPLATE_TEXT_SHADOW,
    PHOTO_BACKGROUND_TEXT_SHADOW
} from './privateCardFrameTextContrast';
import {
    DEFAULT_PRIVATE_TEXT_BACKDROP_TONE,
    privateTextBackdropToneToRgba
} from './privateCardTextBackdrop';
import { INVITATION_CARD_MESSAGE_MAX } from '../../../constants/invitationCardLimits';
import {
    getCardPreviewStructureClass,
    normalizeCardStructure,
    resolveCardStructureFromBackgroundId
} from '../../../utils/cardStructure';
import { prepareBidiDisplayText } from '../../../utils/bidiText';
import './PrivateInvitationCardPreview.css';

function formatPreviewDate(dateStr, locale) {
    if (!dateStr || typeof dateStr !== 'string') return '';
    const d = new Date(dateStr + 'T12:00:00');
    if (Number.isNaN(d.getTime())) return dateStr;
    try {
        return d.toLocaleDateString(locale || undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    } catch {
        return dateStr;
    }
}

function formatPreviewTime(timeStr, locale) {
    if (!timeStr || typeof timeStr !== 'string') return '';
    const [h, m] = timeStr.split(':').map((x) => parseInt(x, 10));
    if (Number.isNaN(h)) return timeStr;
    const d = new Date();
    d.setHours(h, Number.isNaN(m) ? 0 : m, 0, 0);
    try {
        return d.toLocaleTimeString(locale || undefined, { hour: 'numeric', minute: '2-digit' });
    } catch {
        return timeStr;
    }
}

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
    return String(text || '')
        .replace(/\r\n/g, '\n')
        .replace(/\n+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Non-AI visual card preview: gradient or template bg + frame + text + avatar + meta.
 * Frame preset sets border + text tints. Optional `cardThemeColor` (#rrggbb) uses one flat color
 * for the border and all copy, with no text-shadow.
 */
export default function PrivateInvitationCardPreview({
    frameColorId = DEFAULT_FRAME_COLOR_ID,
    /** When #rrggbb, border + all card copy use this color (flat, no text-shadow). */
    cardThemeColor = null,
    cardFontId = DEFAULT_FONT_ID,
    occasionType,
    occasionCategoryId: occasionCategoryIdProp,
    cardBackgroundId = null,
    title = '',
    description = '',
    date = '',
    time = '',
    location = '',
    inviterName = '',
    inviterAvatarUrl = '',
    className = '',
    cardMotionId = DEFAULT_MOTION_ID,
    freezeMotion = false,
    /** @type {'private' | 'dating'} */
    cardTemplateSet = 'private',
    /** Full-bleed hero (dating: user photo/video); same layout as template art */
    heroCoverSrc = null,
    /** @type {'image' | 'video' | null} */
    heroCoverMediaType = null,
    heroCoverPoster = null,
    /** When false, hide occasion headline, custom title, message, and host; only date/place meta stay. */
    showHostAndMessage = true,
    /** `dark` | `light` | `none` — panel behind copy when `showHostAndMessage` on photo backgrounds. */
    textBackdropTone = DEFAULT_PRIVATE_TEXT_BACKDROP_TONE,
    /** Visual structure for template safe zones (dating card templates). */
    cardStructure: cardStructureProp = null,
    heroCoverPending = false,
}) {
    const { t, i18n } = useTranslation();
    const frame = useMemo(() => getFrameColorById(frameColorId), [frameColorId]);
    const font = useMemo(() => getPrivateCardFontById(cardFontId), [cardFontId]);

    const categoryId = useMemo(() => {
        if (occasionCategoryIdProp) return occasionCategoryIdProp;
        return resolveOccasionCategoryId(occasionType);
    }, [occasionType, occasionCategoryIdProp]);

    const bgCandidates = useMemo(() => {
        if (cardTemplateSet === 'dating') {
            return resolveDatingCardBackgroundUrlCandidates(cardBackgroundId);
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
            return resolveCanonicalDatingBackgroundId(cardBackgroundId);
        }
        if (!categoryId || !cardBackgroundId) return null;
        return resolveCanonicalBackgroundId(categoryId, cardBackgroundId);
    }, [cardTemplateSet, categoryId, cardBackgroundId]);
    const hasHeroCover = Boolean(heroCoverSrc && heroCoverMediaType);
    const hasPhotoBackground = templateArtActive || hasHeroCover;

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

    const preferUnifiedCopyPanel =
        cardTemplateSet === 'dating' &&
        (Boolean(textBackdropRgba) || String(className).includes('dating-editor-meta'));

    const useStructureLayout =
        showHostAndMessage &&
        templateArtActive &&
        !hasHeroCover &&
        cardTemplateSet === 'dating' &&
        Boolean(resolvedCardStructure) &&
        !preferUnifiedCopyPanel;

    const structureLayoutClass = useStructureLayout
        ? ` ${getCardPreviewStructureClass(resolvedCardStructure)} private-invitation-card-preview--structure-layout`
        : '';

    const darkTemplateArt =
        !hasHeroCover &&
        templateArtActive &&
        (cardTemplateSet === 'dating'
            ? DATING_DARK_TEMPLATE_BACKGROUND_IDS.has(String(canonicalBackgroundId || '').toLowerCase())
            : DARK_TEMPLATE_BACKGROUND_IDS.has(String(canonicalBackgroundId || '').toLowerCase()));

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
            hasPhotoBackground && textBackdropTone === 'none'
                ? PHOTO_BACKGROUND_TEXT_SHADOW
                : hasPhotoBackground
                  ? '0 1px 2px rgba(0, 0, 0, 0.45)'
                  : 'none';
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
        hasPhotoBackground,
        hasHeroCover,
        textBackdropTone,
        textBackdropRgba,
        frostedGlassBackdrop
    ]);

    const metaLineStyle = resolvedThemeHex
        ? { color: resolvedThemeHex, textShadow: 'none' }
        : lightBackdropOnPhoto
          ? { color: frame.textMeta, textShadow: 'none' }
          : frostedGlassBackdrop
            ? { color: 'rgba(248, 250, 252, 0.96)', textShadow: '0 1px 2px rgba(0, 0, 0, 0.45)' }
            : undefined;

    const locale = typeof navigator !== 'undefined' ? navigator.language : 'en';

    const dateLine = useMemo(() => {
        const a = formatPreviewDate(date, locale);
        const b = formatPreviewTime(time, locale);
        if (a && b) return `${a} · ${b}`;
        return a || b || '';
    }, [date, time, locale]);

    const titleTrimmed = normalizeInvitationFlowText(title);
    const hasCardTitle = Boolean(titleTrimmed);
    const locText = (location || '').trim();
    const descRaw = normalizeInvitationFlowText(description);
    const descClipped =
        descRaw.length > INVITATION_CARD_MESSAGE_MAX
            ? `${descRaw.slice(0, INVITATION_CARD_MESSAGE_MAX - 1)}…`
            : descRaw;

    const titleBidi = useMemo(
        () => prepareBidiDisplayText(titleTrimmed, i18n.language),
        [titleTrimmed, i18n.language]
    );
    const messageBidi = useMemo(
        () => prepareBidiDisplayText(descClipped, i18n.language),
        [descClipped, i18n.language]
    );
    const occasionBidi = useMemo(
        () =>
            prepareBidiDisplayText(
                t('private_card_occasion_line', {
                    occasion: t(`occasion_${categoryId}`, occasionType || ''),
                    defaultValue: '{{occasion}} invitation'
                }),
                i18n.language
            ),
        [t, categoryId, occasionType, i18n.language]
    );
    const hostBidi = useMemo(
        () => prepareBidiDisplayText(inviterName || '—', i18n.language),
        [inviterName, i18n.language]
    );
    const dateBidi = useMemo(
        () => prepareBidiDisplayText(dateLine, i18n.language),
        [dateLine, i18n.language]
    );
    const locBidi = useMemo(
        () => prepareBidiDisplayText(locText, i18n.language),
        [locText, i18n.language]
    );

    const handleBgImageError = () => {
        setBgSrcIndex((prev) => prev + 1);
    };

    const motionClass =
        !freezeMotion &&
        cardMotionId &&
        cardMotionId !== DEFAULT_MOTION_ID &&
        isPrivateCardMotionId(cardMotionId)
            ? ` private-invitation-card-preview--card-motion-${cardMotionId}`
            : '';

    const minimalBodyClass = showHostAndMessage ? '' : ' private-invitation-card-preview--host-message-hidden';
    const textBackdropClass = textBackdropRgba ? ' private-invitation-card-preview--text-backdrop' : '';
    const textBackdropLightClass =
        lightBackdropOnPhoto ? ' private-invitation-card-preview--text-backdrop-light' : '';
    const textBackdropFrostedClass =
        frostedGlassBackdrop ? ' private-invitation-card-preview--text-backdrop-frosted' : '';
    const unifiedCopyClass = preferUnifiedCopyPanel ? ' private-invitation-card-preview--unified-copy' : '';

    const occasionEl = (
        <p
            className="private-invitation-card-preview__occasion private-invitation-card-preview__bidi"
            style={textStyles.occasion}
            dir={occasionBidi.dir}
            lang={occasionBidi.lang}
        >
            {occasionBidi.text}
        </p>
    );

    const iconEl =
        !templateArtActive ? (
            <div className="private-invitation-card-preview__icon-wrap">
                <PrivateCardCategoryIcon categoryId={categoryId} />
            </div>
        ) : null;

    const titleEl = hasCardTitle ? (
        <h3
            className="private-invitation-card-preview__title private-invitation-card-preview__bidi"
            style={textStyles.title}
            dir={titleBidi.dir}
            lang={titleBidi.lang}
        >
            {titleBidi.text}
        </h3>
    ) : null;

    const messageEl = messageBidi.text ? (
        <p
            className="private-invitation-card-preview__message private-invitation-card-preview__bidi"
            style={textStyles.message}
            dir={messageBidi.dir}
            lang={messageBidi.lang}
        >
            {messageBidi.text}
        </p>
    ) : !textBackdropRgba ? (
        <p
            className="private-invitation-card-preview__message private-invitation-card-preview__message--placeholder"
            aria-hidden="true"
            style={textStyles.message}
        >
            &nbsp;
        </p>
    ) : null;

    const hostEl = (
        <div className="private-invitation-card-preview__host">
            {inviterAvatarUrl ? (
                <img src={inviterAvatarUrl} alt="" className="private-invitation-card-preview__avatar" />
            ) : (
                <div className="private-invitation-card-preview__avatar private-invitation-card-preview__avatar--empty" />
            )}
            <span
                className="private-invitation-card-preview__host-name private-invitation-card-preview__bidi"
                style={textStyles.host}
                dir={hostBidi.dir}
                lang={hostBidi.lang}
            >
                {hostBidi.text}
            </span>
        </div>
    );

    return (
        <div
            className={`private-invitation-card-preview ${className}${templateArtActive ? ' private-invitation-card-preview--photo-bg' : ''}${darkTemplateArt ? ' private-invitation-card-preview--dark-template-bg' : ''}${textBackdropClass}${textBackdropLightClass}${textBackdropFrostedClass}${unifiedCopyClass}${structureLayoutClass}${motionClass}${minimalBodyClass}`.trim()}
        >
            <div
                className={`private-invitation-card-preview__inner${templateArtActive ? ' private-invitation-card-preview__inner--photo-bg' : ''}`}
                style={innerChromeStyle}
            >
                {templateArtActive && hasHeroCover && heroCoverMediaType === 'video' ? (
                    <video
                        key={heroCoverSrc}
                        className="private-invitation-card-preview__bg private-invitation-card-preview__bg--video"
                        src={heroCoverSrc}
                        poster={heroCoverPoster || undefined}
                        autoPlay={!freezeMotion}
                        muted
                        loop={!freezeMotion}
                        playsInline
                        preload="metadata"
                        aria-hidden
                    />
                ) : templateArtActive && hasHeroCover && heroCoverMediaType === 'image' ? (
                    <img
                        className="private-invitation-card-preview__bg private-invitation-card-preview__bg--image"
                        src={heroCoverSrc}
                        alt=""
                        decoding="async"
                        draggable={false}
                    />
                ) : templateArtActive && bgSrc ? (
                    <img
                        className="private-invitation-card-preview__bg private-invitation-card-preview__bg--image"
                        src={bgSrc}
                        alt=""
                        decoding="async"
                        draggable={false}
                        onError={handleBgImageError}
                    />
                ) : (
                    <div className="private-invitation-card-preview__bg" />
                )}

                {heroCoverPending ? (
                    <div className="private-invitation-card-preview__pending" aria-hidden>
                        <div className="private-invitation-card-preview__pending-inner">
                            <span className="private-invitation-card-preview__pending-spinner" aria-hidden />
                            <span className="private-invitation-card-preview__pending-text">Preparing image…</span>
                        </div>
                    </div>
                ) : null}

                <div
                    className="private-invitation-card-preview__text-stack"
                    style={
                        textBackdropRgba
                            ? {
                                  '--private-text-backdrop-bg': textBackdropRgba,
                                  '--private-text-backdrop-width': '50%',
                                  '--private-text-backdrop-max-height': '50%',
                              }
                            : undefined
                    }
                >
                <div
                    className={`private-invitation-card-preview__main${
                        textBackdropRgba ? ' private-invitation-card-preview__text-panel' : ''
                    }`}
                    style={{ fontFamily: font.cssFamily }}
                >
                    {showHostAndMessage ? (
                        useStructureLayout ? (
                            <>
                                <div className="private-invitation-card-preview__copy-zone">
                                    {iconEl}
                                    {titleEl}
                                    {messageEl}
                                </div>
                                <div className="private-invitation-card-preview__signatory">
                                    {occasionEl}
                                    {hostEl}
                                </div>
                            </>
                        ) : (
                            <>
                                {occasionEl}
                                {iconEl}
                                {titleEl}
                                {messageEl}
                                {hostEl}
                            </>
                        )
                    ) : null}
                </div>

                <div className="private-invitation-card-preview__meta">
                    {dateBidi.text && (
                        <span
                            className="private-invitation-card-preview__meta-line private-invitation-card-preview__meta-line--datetime private-invitation-card-preview__bidi"
                            style={metaLineStyle}
                            dir={dateBidi.dir}
                            lang={dateBidi.lang}
                        >
                            {dateBidi.text}
                        </span>
                    )}
                    {locBidi.text && (
                        <span
                            className="private-invitation-card-preview__meta-line private-invitation-card-preview__meta-line--location private-invitation-card-preview__bidi"
                            style={metaLineStyle}
                            dir={locBidi.dir}
                            lang={locBidi.lang}
                        >
                            {locBidi.text}
                        </span>
                    )}
                </div>
                </div>
            </div>
        </div>
    );
}
