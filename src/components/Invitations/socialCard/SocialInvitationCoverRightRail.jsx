import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { FaTimes } from 'react-icons/fa';
import { useVerticalDragScrollRail } from '../../../hooks/useVerticalDragScrollRail';
import { getCardBackgroundOptions, resolveCardBackgroundUrlCandidates } from './socialCardBackgrounds';
import {
  getPrivateCardBackgroundOptions,
  resolvePrivateCardBackgroundUrlCandidates } from
'../privateCard/privateCardBackgrounds';
import {
  isSamePrivateCoverMedia,
  PRIVATE_COVER_STASH_MAX_IMAGES,
  PRIVATE_COVER_STASH_MAX_VIDEOS,
  PRIVATE_COVER_STASH_MAX_AI_IMAGES } from
'../../../utils/privateCoverMediaStash';
import '../privateCard/PrivatePreviewRightRail.css';
import './SocialInvitationCoverRightRail.css';
import { AppText } from "../../base";

function pickNearestRailOption(scrollEl) {
  const buttons = scrollEl.querySelectorAll('[data-rail-option-id]');
  if (!buttons.length) return null;

  const rect = scrollEl.getBoundingClientRect();
  const centerY = rect.top + rect.height / 2;
  let bestId = null;
  let bestDist = Infinity;

  buttons.forEach((btn) => {
    const br = btn.getBoundingClientRect();
    const dist = Math.abs(br.top + br.height / 2 - centerY);
    if (dist < bestDist) {
      bestDist = dist;
      bestId = btn.dataset.railOptionId;
    }
  });

  return bestId;
}

function TemplateThumb({ resolveCandidates, optionId, selected, onClick, title, wasDragged }) {
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
      data-rail-option-id={optionId}
      className={`private-preview-rail__thumb${selected ? ' private-preview-rail__thumb--selected' : ''}`}
      onClick={() => {
        if (wasDragged?.()) return;
        onClick?.();
      }}
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

function StashImageThumb({ media }) {
  const candidates = useMemo(() => {
    const list = [media?.preview, media?.publishedUrl, media?.url].filter(
      (u) => u && typeof u === 'string'
    );
    return [...new Set(list)];
  }, [media?.preview, media?.publishedUrl, media?.url]);
  const [idx, setIdx] = useState(0);
  const src = candidates[idx];

  useEffect(() => {
    setIdx(0);
  }, [candidates]);

  if (!src) return null;

  return (
    <img
      src={src}
      alt=""
      className="private-preview-rail__thumb-img"
      draggable={false}
      onError={() => setIdx((i) => i + 1 < candidates.length ? i + 1 : i)} />);


}

function StashMediaThumb({ selected, onSelect, onClear, committing, children }) {
  return (
    <div
      className={[
      'private-preview-rail__thumb-wrap',
      selected ? 'private-preview-rail__thumb-wrap--selected' : '',
      committing ? 'private-preview-rail__thumb-wrap--committing' : ''].

      filter(Boolean).
      join(' ')}>

            <button
        type="button"
        className="private-preview-rail__thumb private-preview-rail__thumb--media"
        onClick={onSelect}
        aria-pressed={selected}
        disabled={committing}
        aria-busy={committing}>

                {children}
                {committing ?
        <AppText as="span" className="private-preview-rail__thumb-loading" aria-hidden>
                        <AppText as="span" className="private-preview-rail__thumb-spinner" />
                    </AppText> :
        null}
            </button>
            {onClear &&
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
 * Private create: vertical strip beside the card — template art, or temp upload/video thumbnails.
 */
export default function SocialInvitationCoverRightRail({
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
  templateVariant = 'private',
  /** Personal invite intent folder: dating | friendship | icebreaker */
  personalInviteCategory = 'dating'
}) {
  const { t } = useTranslation();
  const occasionOptions = useMemo(() => {
    if (templateVariant === 'dating') return getPrivateCardBackgroundOptions(personalInviteCategory);
    return getCardBackgroundOptions(categoryId);
  }, [templateVariant, categoryId, personalInviteCategory]);

  const resolveTemplateCandidates = useMemo(() => {
    if (templateVariant === 'dating') {
      return (optionId) => resolvePrivateCardBackgroundUrlCandidates(optionId, personalInviteCategory);
    }
    return (optionId) => resolveCardBackgroundUrlCandidates(categoryId, optionId);
  }, [templateVariant, categoryId, personalInviteCategory]);

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
  templateVariant === 'dating' ?
  t('private_card_template_label', { defaultValue: 'Card templates' }) :
  t('social_card_occasion_art_label', { defaultValue: 'Occasion artwork' });
  const uploadLabel = t('social_cover_upload_rail_label', {
    defaultValue: 'Your photos ({{count}}/{{max}})',
    count: uploadItems.length,
    max: PRIVATE_COVER_STASH_MAX_IMAGES
  });
  const aiLabel = t('social_cover_ai_rail_label', {
    defaultValue: 'AI photos ({{count}}/{{max}})',
    count: aiItems.length,
    max: PRIVATE_COVER_STASH_MAX_AI_IMAGES
  });
  const cameraLabel = t('social_cover_video_rail_label', {
    defaultValue: 'Your videos ({{count}}/{{max}})',
    count: cameraItems.length,
    max: PRIVATE_COVER_STASH_MAX_VIDEOS
  });

  const sectionLabel =
  mode === 'template' ?
  templateLabel :
  mode === 'upload' ?
  uploadLabel :
  mode === 'ai' ?
  aiLabel :
  cameraLabel;

  const scrollRole = mode === 'template' ? 'radiogroup' : 'group';
  const isScrollColumnMode = mode === 'template';
  const isMediaMode = mode === 'upload' || mode === 'camera' || mode === 'ai';
  const mediaItems =
  mode === 'upload' ? uploadItems : mode === 'ai' ? aiItems : mode === 'camera' ? cameraItems : [];

  const selectingFromScrollRef = useRef(false);

  const handleScrollSettle = useCallback(
    (scrollEl) => {
      if (!isScrollColumnMode) return;
      const nearestId = pickNearestRailOption(scrollEl);
      if (!nearestId) return;

      if (mode === 'template') {
        const same =
        cardBackgroundId === nearestId ||
        nearestId === 'birthday-candlecake' && cardBackgroundId === 'birthday-candlake';
        if (!same) {
          selectingFromScrollRef.current = true;
          onCardBackgroundIdChange?.(nearestId);
        }
      }
    },
    [isScrollColumnMode, mode, cardBackgroundId, onCardBackgroundIdChange]
  );

  const {
    railRef,
    isDragging,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    onWheel,
    wasDragged
  } = useVerticalDragScrollRail({
    enabled: isScrollColumnMode,
    onScrollSettle: handleScrollSettle
  });

  useEffect(() => {
    if (!isScrollColumnMode) return;
    if (selectingFromScrollRef.current) {
      selectingFromScrollRef.current = false;
      return;
    }

    const el = railRef.current;
    if (!el) return;

    const selectedId =
    mode === 'template' ?
    cardBackgroundId === 'birthday-candlake' ?
    'birthday-candlecake' :
    cardBackgroundId :
    null;

    if (!selectedId) return;

    const btn = el.querySelector(`[data-rail-option-id="${selectedId}"]`);
    btn?.scrollIntoView({ block: 'center', behavior: 'auto' });
  }, [cardBackgroundId, mode, isScrollColumnMode, railRef, occasionOptions.length]);

  return (
    <div
      className={[
      'social-invite-cover-rail',
      'private-preview-rail',
      'private-card-bg-picker',
      'private-card-bg-picker--beside',
      'private-preview-rail--template-column',
      mode === 'template' ? 'social-invite-cover-rail--template-mode' : '',
      isScrollColumnMode ? 'social-invite-cover-rail--snap-column' : '',
      isMediaMode ? 'social-invite-cover-rail--media-mode' : ''].

      filter(Boolean).
      join(' ')}>

            {mode !== 'template' ?
      <AppText as="p" className="private-card-bg-picker__label private-card-bg-picker__label--beside">{sectionLabel}</AppText> :
      null}
            <div
        ref={isScrollColumnMode ? railRef : undefined}
        className={[
        'private-card-bg-picker__scroll',
        'private-preview-rail__scroll',
        isScrollColumnMode && isDragging ? 'is-dragging' : ''].

        filter(Boolean).
        join(' ')}
        role={scrollRole}
        aria-label={sectionLabel}
        onPointerDown={isScrollColumnMode ? onPointerDown : undefined}
        onPointerMove={isScrollColumnMode ? onPointerMove : undefined}
        onPointerUp={isScrollColumnMode ? onPointerUp : undefined}
        onPointerCancel={isScrollColumnMode ? onPointerCancel : undefined}
        onWheel={isScrollColumnMode ? onWheel : undefined}>

                {mode === 'template' && (
        occasionOptions.length === 0 ?
        <AppText as="p" className="social-invite-cover-rail__empty">
                            {t('social_cover_no_templates_category', {
            defaultValue:
            'No artwork files for this category yet. Add images under invitation-card-backgrounds in the app.'
          })}
                        </AppText> :

        occasionOptions.map((opt) => {
          const selected =
          cardBackgroundId === opt.id ||
          opt.id === 'birthday-candlecake' && cardBackgroundId === 'birthday-candlake';
          return (
            <TemplateThumb
              key={opt.id}
              resolveCandidates={resolveTemplateCandidates}
              optionId={opt.id}
              selected={selected}
              onClick={() => onCardBackgroundIdChange(opt.id)}
              title={t(`card_bg_${opt.id.replace(/-/g, '_')}`, { defaultValue: opt.id })}
              wasDragged={wasDragged} />);


        }))
        }

                {isMediaMode && mediaItems.length === 0 &&
        <AppText as="p" className="social-invite-cover-rail__empty social-invite-cover-rail__empty--media">
                        {mode === 'upload' ?
          t('social_cover_upload_rail_empty', {
            defaultValue:
            'Tap “Upload photo” to add from your device (up to {{max}}).',
            max: PRIVATE_COVER_STASH_MAX_IMAGES
          }) :
          mode === 'ai' ?
          t('social_cover_ai_rail_empty', {
            defaultValue:
            'Use “Generate with AI” to create covers (up to {{max}}).',
            max: PRIVATE_COVER_STASH_MAX_AI_IMAGES
          }) :
          t('social_cover_video_rail_empty', {
            defaultValue:
            'Tap “Record video” to capture a clip (up to {{max}}).',
            max: PRIVATE_COVER_STASH_MAX_VIDEOS
          })}
                    </AppText>
        }

                {isMediaMode &&
        mediaItems.map((entry) => {
          const selected = isSamePrivateCoverMedia(entry.media, mediaData);
          const isPending = Boolean(entry.media?.pending);
          return (
            <StashMediaThumb
              key={entry.id}
              selected={selected}
              committing={committingStashId === entry.id || isPending}
              onSelect={() => onSelectStashItem?.(entry.id)}
              onClear={() => onRemoveStashItem?.(entry.id)}>

                                {isPending ? null : entry.media.type === 'video' ?
              <video
                src={entry.media.preview}
                poster={entry.media.videoThumbnail || undefined}
                className="private-preview-rail__thumb-video"
                muted
                playsInline
                preload="metadata" /> :


              <StashImageThumb media={entry.media} />
              }
                            </StashMediaThumb>);

        })}
            </div>
        </div>);

}