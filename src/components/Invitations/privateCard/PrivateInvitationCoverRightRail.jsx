import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { FaCamera, FaImages, FaTimes } from 'react-icons/fa';
import { getCardBackgroundOptions, resolveCardBackgroundUrlCandidates } from './privateCardBackgrounds';
import '../datingCard/DatingPreviewRightRail.css';
import './PrivateInvitationCoverRightRail.css';

function PrivateOccasionThumb({ categoryId, optionId, selected, onClick, title }) {
    const candidates = useMemo(
        () => resolveCardBackgroundUrlCandidates(categoryId, optionId),
        [categoryId, optionId]
    );
    const [idx, setIdx] = useState(0);
    const url = candidates[idx];

    useEffect(() => {
        setIdx(0);
    }, [categoryId, optionId]);

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

function MediaThumb({ selected, children, onClear, showClear }) {
    return (
        <div
            className={`dating-preview-rail__thumb-wrap${selected ? ' dating-preview-rail__thumb-wrap--selected' : ''}`}
        >
            <div className="dating-preview-rail__thumb dating-preview-rail__thumb--media">{children}</div>
            {showClear && onClear && (
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
 * Private create: one vertical strip beside the card. Content depends on the active tab only
 * (template / upload / camera). Thumbnails scroll when taller than the card preview.
 */
export default function PrivateInvitationCoverRightRail({
    categoryId,
    cardBackgroundId,
    onCardBackgroundIdChange,
    mode,
    mediaData,
    onMediaSelect
}) {
    const { t } = useTranslation();
    const libraryInputRef = useRef(null);
    const captureInputRef = useRef(null);
    const occasionOptions = useMemo(() => getCardBackgroundOptions(categoryId), [categoryId]);

    const templateLabel = t('private_card_occasion_art_label', { defaultValue: 'Occasion artwork' });
    const uploadLabel = t('private_cover_upload_rail_label', { defaultValue: 'Your photo' });
    const cameraLabel = t('private_cover_video_rail_label', { defaultValue: 'Video' });

    const sectionLabel = mode === 'template' ? templateLabel : mode === 'upload' ? uploadLabel : cameraLabel;

    const uploadSelected =
        mode === 'upload' &&
        mediaData?.source === 'custom_image' &&
        mediaData?.type === 'image' &&
        (mediaData?.preview || mediaData?.url) &&
        !mediaData?.coverTemplateId;

    const cameraVideoSelected =
        mode === 'camera' && mediaData?.type === 'video' && Boolean(mediaData?.preview);

    const applyImageFile = (file) => {
        if (!file || !file.type?.startsWith('image/')) return;
        const preview = URL.createObjectURL(file);
        onMediaSelect({
            source: 'custom_image',
            type: 'image',
            file,
            preview
        });
    };

    const handleLibraryChange = (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        applyImageFile(file);
    };

    const handleCaptureChange = (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        applyImageFile(file);
    };

    const scrollRole = mode === 'template' ? 'radiogroup' : 'group';

    return (
        <div
            className={[
                'private-invite-cover-rail',
                'dating-preview-rail',
                'private-card-bg-picker',
                'private-card-bg-picker--beside',
                'dating-preview-rail--template-column',
                mode === 'template' ? 'private-invite-cover-rail--template-mode' : ''
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
                                <PrivateOccasionThumb
                                    key={opt.id}
                                    categoryId={categoryId}
                                    optionId={opt.id}
                                    selected={selected}
                                    onClick={() => onCardBackgroundIdChange(opt.id)}
                                    title={t(`card_bg_${opt.id.replace(/-/g, '_')}`, { defaultValue: opt.id })}
                                />
                            );
                        })
                    ))}

                {mode === 'upload' && (
                    <>
                        <button
                            type="button"
                            className="dating-preview-rail__thumb dating-preview-rail__thumb--action"
                            onClick={() => libraryInputRef.current?.click()}
                            title={t('dating_upload_library_title', { defaultValue: 'Choose from library' })}
                        >
                            <FaImages className="dating-preview-rail__action-icon" aria-hidden />
                            <span className="dating-preview-rail__action-text">
                                {t('dating_upload_library_short', { defaultValue: 'Library' })}
                            </span>
                        </button>
                        <input
                            ref={libraryInputRef}
                            type="file"
                            accept="image/*"
                            className="dating-preview-rail__file-input"
                            onChange={handleLibraryChange}
                        />

                        <button
                            type="button"
                            className="dating-preview-rail__thumb dating-preview-rail__thumb--action"
                            onClick={() => captureInputRef.current?.click()}
                            title={t('dating_upload_capture_title', { defaultValue: 'Take a photo' })}
                        >
                            <FaCamera className="dating-preview-rail__action-icon" aria-hidden />
                            <span className="dating-preview-rail__action-text">
                                {t('dating_upload_capture_short', { defaultValue: 'Camera' })}
                            </span>
                        </button>
                        <input
                            ref={captureInputRef}
                            type="file"
                            accept="image/*"
                            capture="user"
                            className="dating-preview-rail__file-input"
                            onChange={handleCaptureChange}
                        />

                        {uploadSelected && (
                            <MediaThumb showClear onClear={() => onMediaSelect(null)} selected>
                                <img
                                    src={mediaData.preview || mediaData.url}
                                    alt=""
                                    className="dating-preview-rail__thumb-img"
                                    draggable={false}
                                />
                            </MediaThumb>
                        )}
                    </>
                )}

                {mode === 'camera' && (
                    <>
                        {!cameraVideoSelected && (
                            <div
                                className="dating-preview-rail__placeholder dating-preview-rail__placeholder--video-slot"
                                aria-hidden
                            />
                        )}
                        {cameraVideoSelected && (
                            <MediaThumb showClear onClear={() => onMediaSelect(null)} selected>
                                <video
                                    src={mediaData.preview}
                                    poster={mediaData.videoThumbnail || undefined}
                                    className="dating-preview-rail__thumb-video"
                                    muted
                                    playsInline
                                    preload="metadata"
                                />
                            </MediaThumb>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
