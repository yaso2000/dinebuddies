import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { FaCamera, FaImages, FaTimes } from 'react-icons/fa';
import {
  getPrivateCardBackgroundOptions,
  resolvePrivateCardBackgroundUrlCandidates,
} from './privateCardBackgrounds';
import './PrivatePreviewRightRail.css';
import { AppText } from "../../base";

function TemplateThumb({ optionId, personalInviteCategory, selected, onClick, title }) {
  const candidates = useMemo(
    () => resolvePrivateCardBackgroundUrlCandidates(optionId, personalInviteCategory),
    [optionId, personalInviteCategory]
  );
  const [idx, setIdx] = useState(0);
  const url = candidates[idx];

  useEffect(() => {
    setIdx(0);
  }, [optionId]);

  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      className={`private-preview-rail__thumb${selected ? ' private-preview-rail__thumb--selected' : ''}`}
      onClick={onClick}
      title={title}>

            {url ?
      <img
        className="private-preview-rail__thumb-img"
        src={url}
        alt=""
        draggable={false}
        onError={() => setIdx((i) => i + 1 < candidates.length ? i + 1 : i)} /> :

      null}
        </button>);

}

function MediaThumb({ selected, children, onClear, showClear }) {
  return (
    <div
      className={`private-preview-rail__thumb-wrap${selected ? ' private-preview-rail__thumb-wrap--selected' : ''}`}>

            <div className="private-preview-rail__thumb private-preview-rail__thumb--media">{children}</div>
            {showClear && onClear &&
      <button
        type="button"
        className="private-preview-rail__clear"
        onClick={(e) => {
          e.stopPropagation();
          onClear();
        }}
        aria-label="Remove">

                    <FaTimes size={11} />
                </button>
      }
        </div>);

}

/**
 * Vertical strip beside the card preview — strict single column for templates.
 * Upload: separate library vs camera capture inputs (fewer iOS picker options than one combined file input).
 */
export default function PrivatePreviewRightRail({
  mode,
  cardBackgroundId,
  personalInviteCategory = 'dating',
  /** When set (e.g. private invites), template tab highlights this id instead of `cardBackgroundId`. */
  templateSelectedId = null,
  onTemplateSelect,
  mediaData,
  onMediaSelect
}) {
  const { t } = useTranslation();
  const libraryInputRef = useRef(null);
  const captureInputRef = useRef(null);
  const templateOptions = getPrivateCardBackgroundOptions(personalInviteCategory);

  const railLabel =
  mode === 'template' ?
  t('social_card_background_label', { defaultValue: 'Card background' }) :
  mode === 'upload' ?
  t('private_rail_upload_label', { defaultValue: 'Your photo' }) :
  t('private_rail_camera_label', { defaultValue: 'Video' });

  const uploadSelected =
  mode === 'upload' &&
  mediaData?.source === 'custom_image' &&
  mediaData?.type === 'image' && (
  mediaData?.preview || mediaData?.url) &&
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

  return (
    <div
      className={`private-preview-rail private-card-bg-picker private-card-bg-picker--beside${mode === 'template' ? ' private-preview-rail--template-column' : ''}`.trim()}>

            <AppText as="p" className="private-card-bg-picker__label private-card-bg-picker__label--beside">{railLabel}</AppText>
            <div className="private-card-bg-picker__scroll private-preview-rail__scroll" role="list">
                {mode === 'template' &&
        templateOptions.map((opt) => {
          const selected =
          templateSelectedId != null && String(templateSelectedId).length > 0 ?
          templateSelectedId === opt.id :
          cardBackgroundId === opt.id;
          return (
            <TemplateThumb
              key={opt.id}
              optionId={opt.id}
              personalInviteCategory={personalInviteCategory}
              selected={selected}
              onClick={() => onTemplateSelect(opt.id)}
              title={
              opt.labelKey ?
              t(opt.labelKey, { defaultValue: opt.id }) :
              t(`card_bg_${opt.id.replace(/-/g, '_')}`, { defaultValue: opt.id })
              } />);


        })}

                {mode === 'upload' &&
        <>
                        <button
            type="button"
            className="private-preview-rail__thumb private-preview-rail__thumb--action"
            onClick={() => libraryInputRef.current?.click()}
            title={t('private_upload_library_title', { defaultValue: 'Choose from library' })}>

                            <FaImages className="private-preview-rail__action-icon" aria-hidden />
                            <AppText as="span" className="private-preview-rail__action-text">
                                {t('private_upload_library_short', { defaultValue: 'Library' })}
                            </AppText>
                        </button>
                        <input
            ref={libraryInputRef}
            type="file"
            accept="image/*"
            className="private-preview-rail__file-input"
            onChange={handleLibraryChange} />


                        <button
            type="button"
            className="private-preview-rail__thumb private-preview-rail__thumb--action"
            onClick={() => captureInputRef.current?.click()}
            title={t('private_upload_capture_title', { defaultValue: 'Take a photo' })}>

                            <FaCamera className="private-preview-rail__action-icon" aria-hidden />
                            <AppText as="span" className="private-preview-rail__action-text">
                                {t('private_upload_capture_short', { defaultValue: 'Camera' })}
                            </AppText>
                        </button>
                        <input
            ref={captureInputRef}
            type="file"
            accept="image/*"
            capture="user"
            className="private-preview-rail__file-input"
            onChange={handleCaptureChange} />


                        {uploadSelected &&
          <MediaThumb showClear onClear={() => onMediaSelect(null)} selected>
                                <img
              src={mediaData.preview || mediaData.url}
              alt=""
              className="private-preview-rail__thumb-img"
              draggable={false} />

                            </MediaThumb>
          }
                    </>
        }

                {mode === 'camera' &&
        <>
                        {!cameraVideoSelected &&
          <div
            className="private-preview-rail__placeholder private-preview-rail__placeholder--video-slot"
            aria-hidden />

          }
                        {cameraVideoSelected &&
          <MediaThumb showClear onClear={() => onMediaSelect(null)} selected>
                                <video
              src={mediaData.preview}
              poster={mediaData.videoThumbnail || undefined}
              className="private-preview-rail__thumb-video"
              muted
              playsInline
              preload="metadata" />

                            </MediaThumb>
          }
                    </>
        }
            </div>
        </div>);

}