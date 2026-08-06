import React from 'react';
import { useTranslation } from 'react-i18next';
import { AppText } from '../base';
import {
  COMMUNITY_CHAT_ZONE_THEME_LIST,
  COMMUNITY_CHAT_ZONE_THEMES,
} from '../../constants/communityChatZoneThemes';
import CommunityGuestFrameBackgroundPicker from './CommunityGuestFrameBackgroundPicker';
import './CommunityChatZoneThemePicker.css';

function ZoneThemeChip({ themeId, selected, disabled, onSelect, t }) {
  const theme = COMMUNITY_CHAT_ZONE_THEMES[themeId];
  if (!theme) return null;
  const label = t(theme.labelKey, theme.labelDefault);

  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={label}
      title={label}
      disabled={disabled}
      className={`community-zone-theme-picker__theme-chip${selected ? ' community-zone-theme-picker__theme-chip--active' : ''}`}
      onClick={() => onSelect?.(themeId)}
    >
      <span
        className="community-zone-theme-picker__theme-swatch"
        style={{ background: theme.swatchColor }}
        aria-hidden
      />
      <AppText as="span" className="community-zone-theme-picker__theme-chip-label">
        {label}
      </AppText>
    </button>
  );
}

export default function CommunityChatZoneThemePicker({
  themeId = 'stage',
  onSelectTheme,
  guestFrameBackground,
  onSelectTransparent,
  onSelectGradientPreset,
  onChangeGuestFrameColors,
  onChangeGuestFrameDensity,
  onSelectImageNone,
  onGenerateGuestFrameBackgroundAi,
  guestFrameBackgroundGenerating = false,
  saving = false,
}) {
  const { t } = useTranslation();
  const busy = saving || guestFrameBackgroundGenerating;

  return (
    <div className="community-zone-theme-picker">
      <AppText as="p" className="community-zone-theme-picker__hint">
        {t(
          'community_chat_zone_theme_hint',
          'Pick bubble colors, then optionally generate an AI background for the chat area.'
        )}
      </AppText>

      <AppText as="span" className="community-zone-theme-picker__subsection-label">
        {t('community_chat_zone_theme_bubbles_section', 'Bubble colors')}
      </AppText>
      <div
        className="community-zone-theme-picker__theme-row"
        role="radiogroup"
        aria-label={t('community_chat_zone_theme_bubbles_section', 'Bubble colors')}
      >
        {COMMUNITY_CHAT_ZONE_THEME_LIST.map((id) => (
          <ZoneThemeChip
            key={id}
            themeId={id}
            selected={themeId === id}
            disabled={busy}
            onSelect={onSelectTheme}
            t={t}
          />
        ))}
      </div>

      <AppText as="span" className="community-zone-theme-picker__subsection-label">
        {t('community_guest_frame_section', 'Guest chat area')}
      </AppText>
      <CommunityGuestFrameBackgroundPicker
        background={guestFrameBackground}
        saving={saving}
        generating={guestFrameBackgroundGenerating}
        onSelectTransparent={onSelectTransparent}
        onSelectGradientPreset={onSelectGradientPreset}
        onChangeColors={onChangeGuestFrameColors}
        onChangeDensity={onChangeGuestFrameDensity}
        onSelectImageNone={onSelectImageNone}
        onGenerateAi={onGenerateGuestFrameBackgroundAi}
      />
    </div>
  );
}
