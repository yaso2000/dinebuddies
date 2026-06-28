import React from 'react';
import { useTranslation } from 'react-i18next';
import { FaCheck } from 'react-icons/fa';
import { AppText } from '../base';
import {
  COMMUNITY_CHAT_ZONE_THEME_LIST,
  COMMUNITY_CHAT_ZONE_THEMES,
} from '../../constants/communityChatZoneThemes';
import CommunityGuestFrameBackgroundPicker from './CommunityGuestFrameBackgroundPicker';
import './CommunityChatZoneThemePicker.css';

export default function CommunityChatZoneThemePicker({
  value,
  guestFrameBackground,
  onSelect,
  onSelectTransparent,
  onSelectGradientPreset,
  onChangeGuestFrameColors,
  onChangeGuestFrameDensity,
  onSelectImageNone,
  onSelectGuestFramePreset,
  onUploadGuestFrameBackground,
  onGenerateGuestFrameBackgroundAi,
  guestFrameBackgroundUploading = false,
  guestFrameBackgroundGenerating = false,
  saving = false,
}) {
  const { t } = useTranslation();
  const busy = saving || guestFrameBackgroundUploading || guestFrameBackgroundGenerating;

  return (
    <div className="community-zone-theme-picker">
      <AppText as="p" className="community-zone-theme-picker__hint">
        {t(
          'community_chat_zone_theme_hint',
          'Pick colors for the banner, guest chat, bubbles, and message bar. Tap Save when you are done.'
        )}
      </AppText>
      <AppText as="span" className="community-zone-theme-picker__subsection-label">
        {t('community_chat_zone_theme_section', 'Color themes')}
      </AppText>
      <div
        className="community-zone-theme-picker__theme-row"
        role="radiogroup"
        aria-label={t('community_chat_zone_theme_section', 'Color themes')}
      >
        {COMMUNITY_CHAT_ZONE_THEME_LIST.map((themeId) => {
          const meta = COMMUNITY_CHAT_ZONE_THEMES[themeId];
          const selected = value === themeId;
          const label = t(meta.labelKey, meta.labelDefault);

          return (
            <button
              key={themeId}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={label}
              title={label}
              disabled={busy}
              className={`community-zone-theme-picker__theme-chip${selected ? ' community-zone-theme-picker__theme-chip--active' : ''}`}
              onClick={() => onSelect(themeId)}
            >
              <span
                className="community-zone-theme-picker__theme-swatch"
                style={{ background: meta.swatchColor || '#64748b' }}
                aria-hidden
              />
              <AppText as="span" className="community-zone-theme-picker__theme-chip-label">
                {label}
              </AppText>
              {selected ? (
                <FaCheck size={10} className="community-zone-theme-picker__check" aria-hidden />
              ) : null}
            </button>
          );
        })}
      </div>

      <AppText as="h3" className="community-zone-theme-picker__section-title">
        {t('community_guest_frame_section', 'Guest chat area (GuestFrame)')}
      </AppText>
      <AppText as="p" className="community-zone-theme-picker__section-hint">
        {t(
          'community_guest_frame_section_hint',
          'Background image plus an optional color overlay on top — like the banner cover.'
        )}
      </AppText>

      <CommunityGuestFrameBackgroundPicker
        background={guestFrameBackground}
        saving={saving}
        uploading={guestFrameBackgroundUploading}
        generating={guestFrameBackgroundGenerating}
        onSelectTransparent={onSelectTransparent}
        onSelectGradientPreset={onSelectGradientPreset}
        onChangeColors={onChangeGuestFrameColors}
        onChangeDensity={onChangeGuestFrameDensity}
        onSelectImageNone={onSelectImageNone}
        onSelectPreset={onSelectGuestFramePreset}
        onUploadFile={onUploadGuestFrameBackground}
        onGenerateAi={onGenerateGuestFrameBackgroundAi}
      />
    </div>
  );
}
