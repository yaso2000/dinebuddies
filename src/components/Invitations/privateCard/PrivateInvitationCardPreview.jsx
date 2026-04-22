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
import { getPrivateCardFontById, DEFAULT_FONT_ID } from './privateCardFonts';
import {
    adjustFrameTextForDarkTemplate,
    DARK_TEMPLATE_TEXT_SHADOW
} from './privateCardFrameTextContrast';
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

/**
 * Non-AI visual card preview: gradient or template bg + frame + text + avatar + meta.
 * Frame color controls both border and all text colors; optional template bg is art only.
 */
export default function PrivateInvitationCardPreview({
    frameColorId = DEFAULT_FRAME_COLOR_ID,
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
    className = ''
}) {
    const { t } = useTranslation();
    const frame = useMemo(() => getFrameColorById(frameColorId), [frameColorId]);
    const font = useMemo(() => getPrivateCardFontById(cardFontId), [cardFontId]);

    const categoryId = useMemo(() => {
        if (occasionCategoryIdProp) return occasionCategoryIdProp;
        return resolveOccasionCategoryId(occasionType);
    }, [occasionType, occasionCategoryIdProp]);

    const bgCandidates = useMemo(
        () => resolveCardBackgroundUrlCandidates(categoryId, cardBackgroundId),
        [categoryId, cardBackgroundId]
    );
    const hasTemplateBg = bgCandidates.length > 0;
    const [bgSrcIndex, setBgSrcIndex] = useState(0);

    useEffect(() => {
        setBgSrcIndex(0);
    }, [categoryId, cardBackgroundId]);

    const bgSrc = bgCandidates[bgSrcIndex];
    /** Active when a candidate URL exists; after all fail, index points past last → bgSrc undefined → gradient card */
    const templateArtActive = hasTemplateBg && Boolean(bgSrc);
    const canonicalBackgroundId = useMemo(() => {
        if (!categoryId || !cardBackgroundId) return null;
        return resolveCanonicalBackgroundId(categoryId, cardBackgroundId);
    }, [categoryId, cardBackgroundId]);
    const darkTemplateArt =
        templateArtActive &&
        DARK_TEMPLATE_BACKGROUND_IDS.has(String(canonicalBackgroundId || '').toLowerCase());

    /**
     * On template art, use frame palette. Dark artwork needs lifted tints + shadow or
     * the (intentionally dark) frame colors vanish on the photo.
     */
    const textStyles = useMemo(() => {
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
            return {
                occasion: { color: frame.textMeta, textShadow: 'none' },
                title: { color: frame.textTitle, textShadow: 'none' },
                message: { color: frame.textMessage, textShadow: 'none' },
                host: { color: frame.textHost, textShadow: 'none' }
            };
        }

        return {
            occasion: { color: 'rgba(255, 255, 255, 0.82)', textShadow: 'none' },
            title: { color: '#fafafa', textShadow: 'none' },
            message: { color: 'rgba(255, 255, 255, 0.78)', textShadow: 'none' },
            host: { color: 'rgba(255, 255, 255, 0.9)', textShadow: 'none' }
        };
    }, [frame, templateArtActive, darkTemplateArt]);

    const locale = typeof navigator !== 'undefined' ? navigator.language : 'en';

    const dateLine = useMemo(() => {
        const a = formatPreviewDate(date, locale);
        const b = formatPreviewTime(time, locale);
        if (a && b) return `${a} · ${b}`;
        return a || b || '';
    }, [date, time, locale]);

    const titleText = (title || '').trim() || '—';
    const descText = (description || '').trim();
    const locText = (location || '').trim();

    const occasionName = t(`occasion_${categoryId}`, occasionType || '');
    const occasionLine = t('private_card_occasion_line', {
        occasion: occasionName,
        defaultValue: '{{occasion}} invitation'
    });

    const handleBgImageError = () => {
        setBgSrcIndex((prev) => prev + 1);
    };

    return (
        <div
            className={`private-invitation-card-preview ${className}${templateArtActive ? ' private-invitation-card-preview--photo-bg' : ''}${darkTemplateArt ? ' private-invitation-card-preview--dark-template-bg' : ''}`.trim()}
        >
            <div
                className={`private-invitation-card-preview__inner${templateArtActive ? ' private-invitation-card-preview__inner--photo-bg' : ''}`}
                style={{
                    borderColor: frame.border,
                    boxShadow: frame.shadow
                }}
            >
                {templateArtActive && bgSrc ? (
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

                <div
                    className="private-invitation-card-preview__main"
                    style={{ fontFamily: font.cssFamily }}
                >
                    <p className="private-invitation-card-preview__occasion" style={textStyles.occasion}>
                        {occasionLine}
                    </p>

                    {!templateArtActive && (
                        <div className="private-invitation-card-preview__icon-wrap">
                            <PrivateCardCategoryIcon categoryId={categoryId} />
                        </div>
                    )}

                    <h3 className="private-invitation-card-preview__title" style={textStyles.title}>
                        {titleText}
                    </h3>

                    {descText ? (
                        <p className="private-invitation-card-preview__message" style={textStyles.message}>
                            {descText.length > 120 ? `${descText.slice(0, 117)}…` : descText}
                        </p>
                    ) : (
                        <p
                            className="private-invitation-card-preview__message private-invitation-card-preview__message--placeholder"
                            aria-hidden="true"
                            style={textStyles.message}
                        >
                            &nbsp;
                        </p>
                    )}

                    <div className="private-invitation-card-preview__host">
                        {inviterAvatarUrl ? (
                            <img src={inviterAvatarUrl} alt="" className="private-invitation-card-preview__avatar" />
                        ) : (
                            <div className="private-invitation-card-preview__avatar private-invitation-card-preview__avatar--empty" />
                        )}
                        <span className="private-invitation-card-preview__host-name" style={textStyles.host}>
                            {inviterName || '—'}
                        </span>
                    </div>
                </div>

                <div className="private-invitation-card-preview__meta">
                    {dateLine && (
                        <span className="private-invitation-card-preview__meta-line private-invitation-card-preview__meta-line--datetime">
                            {dateLine}
                        </span>
                    )}
                    {locText && (
                        <span className="private-invitation-card-preview__meta-line private-invitation-card-preview__meta-line--location">
                            {locText}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}
