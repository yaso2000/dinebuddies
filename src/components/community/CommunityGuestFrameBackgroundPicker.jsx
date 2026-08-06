import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaBan, FaCheck, FaImage, FaMagic, FaTrash } from 'react-icons/fa';
import { AppText, AppTextInput } from '../base';
import { buildCommunityGuestFrameColorBackgroundCss } from '../../constants/communityChatGuestFrameLook';
import BannerGradientPresetCarousel from './BannerGradientPresetCarousel';
import {
  DEFAULT_BANNER_BG,
  DEFAULT_BANNER_BG2,
  sanitizeBannerBgDensity,
  sanitizeBannerHexColor,
} from '../../utils/communityChatBanner';
import { AI_IMAGE_GENERATION_CREDITS } from '../../utils/aiCreditCosts';
import { AI_USER_PROMPT_MAX_CHARS } from '../../constants/aiPromptLimits';

function NoneBackgroundCard({ selected, disabled, onSelect, label }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={label}
      disabled={disabled}
      className={`community-zone-theme-picker__texture-card${selected ? ' community-zone-theme-picker__texture-card--active' : ''}`}
      onClick={() => onSelect?.()}
    >
      <div
        className="community-zone-theme-picker__bg-preview community-zone-theme-picker__bg-preview--none"
        aria-hidden
      >
        <FaBan size={14} />
      </div>
      <AppText as="span" className="community-zone-theme-picker__texture-card-title">
        {label}
        {selected ? (
          <FaCheck size={10} className="community-zone-theme-picker__check" aria-hidden />
        ) : null}
      </AppText>
    </button>
  );
}

function GuestFrameBackgroundPreview({ background }) {
  const imageUrl = background?.imageUrl || '';
  const colorOverlayEnabled = background?.colorOverlayEnabled !== false;
  const colorStart = sanitizeBannerHexColor(
    background?.pickerColorStart,
    DEFAULT_BANNER_BG
  );
  const colorEnd = sanitizeBannerHexColor(
    background?.pickerColorEnd,
    DEFAULT_BANNER_BG2
  );
  const density = sanitizeBannerBgDensity(background?.intensity ?? 100);
  const overlayStyle = {
    background: buildCommunityGuestFrameColorBackgroundCss(colorStart, colorEnd, density),
  };

  return (
    <div className="community-zone-theme-picker__frame-preview" aria-hidden>
      {imageUrl ? (
        <img src={imageUrl} alt="" className="community-zone-theme-picker__frame-preview-bg" />
      ) : colorOverlayEnabled ? (
        <div
          className="community-zone-theme-picker__frame-preview-fallback"
          style={overlayStyle}
        />
      ) : (
        <div className="community-zone-theme-picker__frame-preview-fallback" />
      )}
      {colorOverlayEnabled && imageUrl ? (
        <div
          className="community-zone-theme-picker__frame-preview-overlay"
          style={overlayStyle}
        />
      ) : null}
    </div>
  );
}

/**
 * Lower chat-frame background editor.
 * Image backgrounds are AI-generated only (no device upload / camera / presets).
 */
export default function CommunityGuestFrameBackgroundPicker({
  background,
  saving = false,
  generating = false,
  onSelectTransparent,
  onSelectGradientPreset,
  onChangeDensity,
  onSelectImageNone,
  onGenerateAi,
}) {
  const { t } = useTranslation();
  const [aiPrompt, setAiPrompt] = useState('');
  const busy = saving || generating;
  const imageMode = background?.imageMode || 'none';
  const hasAiImage = imageMode === 'custom' && Boolean(background?.imageUrl);
  const isImageNone = !hasAiImage;
  const colorOverlayEnabled = background?.colorOverlayEnabled !== false;
  const colorStart = sanitizeBannerHexColor(
    background?.pickerColorStart,
    DEFAULT_BANNER_BG
  );
  const colorEnd = sanitizeBannerHexColor(
    background?.pickerColorEnd,
    DEFAULT_BANNER_BG2
  );
  const density = sanitizeBannerBgDensity(background?.intensity ?? 100);
  const noneLabel = t('community_guest_frame_bg_none', 'None');

  const handleGenerateAi = () => {
    if (busy) return;
    onGenerateAi?.(aiPrompt);
  };

  return (
    <>
      <AppText as="span" className="community-zone-theme-picker__subsection-label">
        {t('community_guest_frame_bg_image_section', 'Background image')}
      </AppText>
      <AppText as="p" className="community-zone-theme-picker__bg-ai-hint">
        {t(
          'community_guest_frame_bg_image_ai_only_hint',
          'AI-generated images only — no upload from device or camera. Optional color overlay sits on top.'
        )}
      </AppText>

      <div className="community-zone-theme-picker__texture-grid" role="radiogroup">
        <NoneBackgroundCard
          selected={isImageNone}
          disabled={busy}
          onSelect={onSelectImageNone}
          label={noneLabel}
        />
      </div>

      <div className="community-zone-theme-picker__bg-ai">
        <AppText as="span" className="community-zone-theme-picker__subsection-label">
          <FaMagic aria-hidden style={{ marginInlineEnd: '0.35rem' }} />
          {t('community_guest_frame_bg_ai_label', 'Design with AI')}
        </AppText>
        <AppText as="p" className="community-zone-theme-picker__bg-ai-hint">
          {t(
            'community_guest_frame_bg_ai_hint',
            'Describe the mood and colors. No text in the image — it sits behind chat messages.'
          )}
        </AppText>
        <AppTextInput
          as="textarea"
          className="community-zone-theme-picker__bg-ai-input"
          value={aiPrompt}
          maxLength={AI_USER_PROMPT_MAX_CHARS}
          placeholder={t(
            'community_guest_frame_bg_ai_placeholder',
            'Example: soft emerald gradient with subtle smoke, elegant restaurant lounge, no text…'
          )}
          onChange={(event) => setAiPrompt(event.target.value)}
          disabled={busy}
        />
        <div className="community-zone-theme-picker__bg-actions">
          <button
            type="button"
            className="community-zone-theme-picker__bg-action-btn"
            disabled={busy}
            onClick={handleGenerateAi}
          >
            <FaImage aria-hidden />
            {generating
              ? t('community_guest_frame_bg_generating', 'Generating…')
              : t('community_guest_frame_bg_ai_generate', {
                  cost: AI_IMAGE_GENERATION_CREDITS,
                  defaultValue: 'Generate background ({{cost}} credits)',
                })}
          </button>
          {hasAiImage ? (
            <button
              type="button"
              className="community-zone-theme-picker__bg-action-btn community-zone-theme-picker__bg-action-btn--danger"
              disabled={busy}
              onClick={() => onSelectImageNone?.()}
            >
              <FaTrash aria-hidden />
              {t('community_guest_frame_bg_remove_ai', 'Remove AI image')}
            </button>
          ) : null}
        </div>
      </div>

      {hasAiImage ? (
        <div className="community-zone-theme-picker__bg-custom-active">
          <img src={background.imageUrl} alt="" />
        </div>
      ) : null}

      <div className="community-banner-modal__section">
        <AppText as="span" className="community-banner-modal__label">
          {t('community_guest_frame_bg_preview', 'Preview')}
        </AppText>
        <GuestFrameBackgroundPreview background={background} />
      </div>

      <div className="community-banner-modal__section">
        <AppText as="span" className="community-banner-modal__label">
          {t('community_guest_frame_bg_overlay_section', 'Color overlay')}
        </AppText>
        <AppText as="p" className="community-banner-modal__hint">
          {t(
            'community_guest_frame_bg_overlay_hint',
            'Gradient cover on top of the AI background (or alone if no image).'
          )}
        </AppText>
        <BannerGradientPresetCarousel
          colorStart={colorStart}
          colorEnd={colorEnd}
          disabled={busy}
          showTransparent
          transparentSelected={!colorOverlayEnabled}
          onSelectTransparent={() => onSelectTransparent?.()}
          onSelectGradient={(start, end) => onSelectGradientPreset?.(start, end)}
          ariaLabel={t('community_guest_frame_bg_overlay_section', 'Color overlay')}
        />
        {colorOverlayEnabled ? (
          <div className="community-banner-modal__density">
            <div className="community-banner-modal__density-head">
              <AppText as="span" className="community-banner-modal__label">
                {t('community_banner_bg_density', 'Density')}
              </AppText>
              <AppText as="span" className="community-banner-modal__density-value">
                {density}%
              </AppText>
            </div>
            <input
              type="range"
              className="community-banner-modal__density-slider"
              min={0}
              max={100}
              step={5}
              value={density}
              disabled={busy}
              aria-label={t('community_banner_bg_density', 'Density')}
              onChange={(event) => onChangeDensity?.(Number(event.target.value))}
            />
            <AppText as="p" className="community-banner-modal__hint">
              {t(
                'community_guest_frame_bg_density_hint',
                '0 = no color overlay · 100 = full color over the background'
              )}
            </AppText>
          </div>
        ) : null}
      </div>
    </>
  );
}
