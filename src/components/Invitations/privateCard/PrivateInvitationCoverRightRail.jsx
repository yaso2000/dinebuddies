import React, { useMemo, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { FaTimes } from 'react-icons/fa';
import { getCardBackgroundOptions, resolveCardBackgroundUrlCandidates } from './privateCardBackgrounds';
import {
    getDatingCardBackgroundOptions,
    resolveDatingCardBackgroundUrlCandidates
} from '../datingCard/datingCardBackgrounds';
import {
    isSamePrivateCoverMedia,
    PRIVATE_COVER_STASH_MAX_IMAGES,
    PRIVATE_COVER_STASH_MAX_VIDEOS,
    PRIVATE_COVER_STASH_MAX_AI_IMAGES
} from '../../../utils/privateCoverMediaStash';
import '../datingCard/DatingPreviewRightRail.css';
import './PrivateInvitationCoverRightRail.css';

function TemplateThumb({ resolveCandidates, optionId, selected, onClick, title }) {
    const candidates = useMemo(() => resolveCandidates(optionId), [resolveCandidates, optionId]);
    const [idx, setIdx] = useState(0);
    const url = candidates[idx];

    useEffect(() => {
        setIdx(0);
    }, [optionId, candidates]);

    return (
        <button
            type="button"
            role="radio"
            aria-checked={selected}
            className={`dating-preview-rail__thumb${selected ? ' dating-preview-rail__thumb--selected' : ''}`}
            onClick={onClick}
            title={title}
        >
            {url ? (
                <img
                    className="dating-preview-rail__thumb-img"
                    src={url}
                    alt=""
                    draggable={false}
                    onError={() => setIdx((i) => (i + 1 < candidates.length ? i + 1 : i))}
                />
            ) : null}
        </button>
    );
}

function StashMediaThumb({ selected, onSelect, onClear, committing, children }) {
    return (
        <div
            className={[
                'dating-preview-rail__thumb-wrap',
                selected ? 'dating-preview-rail__thumb-wrap--selected' : '',
                committing ? 'dating-preview-rail__thumb-wrap--committing' : ''
            ]
                .filter(Boolean)
                .join(' ')}
        >
            <button
                type="button"
                className="dating-preview-rail__thumb dating-preview-rail__thumb--media"
                onClick={onSelect}
                aria-pressed={selected}
                disabled={committing}
                aria-busy={committing}
            >
                {children}
                {committing ? (
                    <span className="dating-preview-rail__thumb-loading" aria-hidden>
                        <span className="dating-preview-rail__thumb-spinner" />
                    </span>
                ) : null}
            </button>
            {onClear && (
                <button
                    type="button"
                    className="dating-preview-rail__clear"
                    onClick={(e) => {
                        e.stopPropagation();
                        onClear();
                    }}
                    aria-label="Remove"
                >
                    <FaTimes size={11} />
                </button>
            )}
        </div>
    );
}

/**
 * Private create: vertical strip beside the card — template art, or temp upload/video thumbnails.
 */
export default function PrivateInvitationCoverRightRail({
    categoryId,
    cardBackgroundId,
    onCardBackgroundIdChange,
    mode,
    mediaData,
    coverStash = [],
    onSelectStashItem,
    onRemoveStashItem,
    committingStashId = null,
    /** @type {'private'|'dating'} */
    templateVariant = 'private'
}) {
    const { t } = useTranslation();
    const occasionOptions = useMemo(() => {
        if (templateVariant === 'dating') return getDatingCardBackgroundOptions();
        return getCardBackgroundOptions(categoryId);
    }, [templateVariant, categoryId]);

    const resolveTemplateCandidates = useMemo(() => {
        if (templateVariant === 'dating') {
            return (optionId) => resolveDatingCardBackgroundUrlCandidates(optionId);
        }
        return (optionId) => resolveCardBackgroundUrlCandidates(categoryId, optionId);
    }, [templateVariant, categoryId]);

    const uploadItems = useMemo(
        () => coverStash.filter((e) => e.kind === 'upload' && e.media?.type === 'image'),
        [coverStash]
    );
    const aiItems = useMemo(
        () => coverStash.filter((e) => e.kind === 'ai' && e.media?.type === 'image'),
        [coverStash]
    );
    const cameraItems = useMemo(
        () => coverStash.filter((e) => e.kind === 'camera' && e.media?.type === 'video'),
        [coverStash]
    );

    const templateLabel =
        templateVariant === 'dating'
            ? t('dating_card_template_label', { defaultValue: 'Card templates' })
            : t('private_card_occasion_art_label', { defaultValue: 'Occasion artwork' });
    const uploadLabel = t('private_cover_upload_rail_label', {
        defaultValue: 'Your photos ({{count}}/{{max}})',
        count: uploadItems.length,
        max: PRIVATE_COVER_STASH_MAX_IMAGES
    });
    const aiLabel = t('private_cover_ai_rail_label', {
        defaultValue: 'AI photos ({{count}}/{{max}})',
        count: aiItems.length,
        max: PRIVATE_COVER_STASH_MAX_AI_IMAGES
    });
    const cameraLabel = t('private_cover_video_rail_label', {
        defaultValue: 'Your videos ({{count}}/{{max}})',
        count: cameraItems.length,
        max: PRIVATE_COVER_STASH_MAX_VIDEOS
    });

    const sectionLabel =
        mode === 'template'
            ? templateLabel
            : mode === 'upload'
              ? uploadLabel
              : mode === 'ai'
                ? aiLabel
                : cameraLabel;

    const scrollRole = mode === 'template' ? 'radiogroup' : 'group';
    const isMediaMode = mode === 'upload' || mode === 'camera' || mode === 'ai';
    const mediaItems =
        mode === 'upload' ? uploadItems : mode === 'ai' ? aiItems : mode === 'camera' ? cameraItems : [];

    return (
        <div
            className={[
                'private-invite-cover-rail',
                'dating-preview-rail',
                'private-card-bg-picker',
                'private-card-bg-picker--beside',
                'dating-preview-rail--template-column',
                mode === 'template' ? 'private-invite-cover-rail--template-mode' : '',
                isMediaMode ? 'private-invite-cover-rail--media-mode' : ''
            ]
                .filter(Boolean)
                .join(' ')}
        >
            <p className="private-card-bg-picker__label private-card-bg-picker__label--beside">{sectionLabel}</p>
            <div
                className="private-card-bg-picker__scroll dating-preview-rail__scroll"
                role={scrollRole}
                aria-label={sectionLabel}
            >
                {mode === 'template' &&
                    (occasionOptions.length === 0 ? (
                        <p className="private-invite-cover-rail__empty">
                            {t('private_cover_no_templates_category', {
                                defaultValue:
                                    'No artwork files for this category yet. Add images under invitation-card-backgrounds in the app.'
                            })}
                        </p>
                    ) : (
                        occasionOptions.map((opt) => {
                            const selected =
                                cardBackgroundId === opt.id ||
                                (opt.id === 'birthday-candlecake' && cardBackgroundId === 'birthday-candlake');
                            return (
                                <TemplateThumb
                                    key={opt.id}
                                    resolveCandidates={resolveTemplateCandidates}
                                    optionId={opt.id}
                                    selected={selected}
                                    onClick={() => onCardBackgroundIdChange(opt.id)}
                                    title={t(`card_bg_${opt.id.replace(/-/g, '_')}`, { defaultValue: opt.id })}
                                />
                            );
                        })
                    ))}

                {isMediaMode && mediaItems.length === 0 && (
                    <p className="private-invite-cover-rail__empty private-invite-cover-rail__empty--media">
                        {mode === 'upload'
                            ? t('private_cover_upload_rail_empty', {
                                  defaultValue:
                                      'Tap “Upload photo” to add from your device (up to {{max}}).',
                                  max: PRIVATE_COVER_STASH_MAX_IMAGES
                              })
                            : mode === 'ai'
                              ? t('private_cover_ai_rail_empty', {
                                    defaultValue:
                                        'Use “Generate with AI” above to create covers (up to {{max}}).',
                                    max: PRIVATE_COVER_STASH_MAX_AI_IMAGES
                                })
                              : t('private_cover_video_rail_empty', {
                                    defaultValue:
                                        'Tap “Record video” to capture a clip (up to {{max}}).',
                                    max: PRIVATE_COVER_STASH_MAX_VIDEOS
                                })}
                    </p>
                )}

                {isMediaMode &&
                    mediaItems.map((entry) => {
                        const selected = isSamePrivateCoverMedia(entry.media, mediaData);
                        return (
                            <StashMediaThumb
                                key={entry.id}
                                selected={selected}
                                committing={committingStashId === entry.id}
                                onSelect={() => onSelectStashItem?.(entry.id)}
                                onClear={() => onRemoveStashItem?.(entry.id)}
                            >
                                {entry.media.type === 'video' ? (
                                    <video
                                        src={entry.media.preview}
                                        poster={entry.media.videoThumbnail || undefined}
                                        className="dating-preview-rail__thumb-video"
                                        muted
                                        playsInline
                                        preload="metadata"
                                    />
                                ) : (
                                    <img
                                        src={entry.media.preview || entry.media.url}
                                        alt=""
                                        className="dating-preview-rail__thumb-img"
                                        draggable={false}
                                    />
                                )}
                            </StashMediaThumb>
                        );
                    })}
            </div>
        </div>
    );
}
