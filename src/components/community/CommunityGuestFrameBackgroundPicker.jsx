import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaBan, FaCheck, FaImage, FaMagic, FaUpload } from 'react-icons/fa';
import { AppText, AppTextInput } from '../base';
import {
  COMMUNITY_GUEST_FRAME_BACKGROUND_PRESETS,
  buildCommunityGuestFrameColorBackgroundCss,
  getCommunityGuestFramePresetUrl,
} from '../../constants/communityChatGuestFrameLook';
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

function PresetBackgroundCard({ preset, selected, disabled, onSelect, t }) {
  const label = t(preset.labelKey, preset.labelDefault);
  const imageUrl = getCommunityGuestFramePresetUrl(preset.id);

  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={label}
      disabled={disabled}
      className={`community-zone-theme-picker__texture-card${selected ? ' community-zone-theme-picker__texture-card--active' : ''}`}
      onClick={() => onSelect?.(preset.id)}
    >
      <div
        className="community-zone-theme-picker__bg-preview"
        style={{ backgroundImage: imageUrl ? `url("${imageUrl}")` : undefined }}
        aria-hidden
      />
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

export default function CommunityGuestFrameBackgroundPicker({
  background,
  saving = false,
  uploading = false,
  generating = false,
  onSelectTransparent,
  onSelectGradientPreset,
  onChangeColors,
  onChangeDensity,
  onSelectImageNone,
  onSelectPreset,
  onUploadFile,
  onGenerateAi,
}) {
  const { t } = useTranslation();
  const fileInputRef = useRef(null);
  const [aiPrompt, setAiPrompt] = useState('');
  const busy = saving || uploading || generating;
  const imageMode = background?.imageMode || 'none';
  const isImageNone = imageMode !== 'preset' && imageMode !== 'custom';
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

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    onUploadFile?.(file);
  };

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
          'community_guest_frame_bg_image_hint',
          'Optional image behind the message list. Color overlay (below) sits on top.'
        )}
      </AppText>

      <AppText as="span" className="community-zone-theme-picker__subsection-label">
        {t('community_guest_frame_bg_presets_label', 'Preset backgrounds')}
      </AppText>
      <div className="community-zone-theme-picker__texture-grid" role="radiogroup">
        <NoneBackgroundCard
          selected={isImageNone}
          disabled={busy}
          onSelect={onSelectImageNone}
          label={noneLabel}
        />
        {COMMUNITY_GUEST_FRAME_BACKGROUND_PRESETS.map((preset) => (
          <PresetBackgroundCard
            key={preset.id}
            preset={preset}
            selected={imageMode === 'preset' && background?.presetId === preset.id}
            disabled={busy}
            onSelect={onSelectPreset}
            t={t}
          />
        ))}
      </div>

      <AppText as="span" className="community-zone-theme-picker__subsection-label">
        {t('community_guest_frame_bg_custom_label', 'Your own background')}
      </AppText>
      <div className="community-zone-theme-picker__bg-actions">
        <button
          type="button"
          className="community-zone-theme-picker__bg-action-btn"
          disabled={busy}
          onClick={() => fileInputRef.current?.click()}
        >
          <FaUpload aria-hidden />
          {uploading
            ? t('community_guest_frame_bg_uploading', 'Uploading…')
            : t('community_guest_frame_bg_upload', 'Upload from device')}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          hidden
          onChange={handleFileChange}
        />
      </div>
      <AppText as="p" className="community-zone-theme-picker__bg-ai-hint">
        {t(
          'community_guest_frame_bg_upload_hint',
          'Use a wide image (16:9 works best). Members see it behind the message list.'
        )}
      </AppText>

      {imageMode === 'custom' && background?.imageUrl ? (
        <div className="community-zone-theme-picker__bg-custom-active">
          <img src={background.imageUrl} alt="" />
        </div>
      ) : null}

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
      </div>

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
            'Gradient cover on top of the selected background image (same as the banner).'
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
