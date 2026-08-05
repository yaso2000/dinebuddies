/** Preset zone themes for business community chat (six visual regions). */
export const COMMUNITY_CHAT_ZONE_THEME_IDS = ['default', 'stage', 'warm', 'cool', 'vivid', 'neon', 'spring', 'romantic'];

export const COMMUNITY_CHAT_ZONE_THEME_LIST = ['default', 'stage', 'warm', 'cool', 'vivid', 'neon', 'spring', 'romantic'];

export const COMMUNITY_CHAT_ZONE_THEMES = {
  default: {
    id: 'default',
    labelKey: 'community_chat_zone_theme_default',
    labelDefault: 'Classic',
    descriptionKey: 'community_chat_zone_theme_default_desc',
    descriptionDefault: 'Follows the app light/dark theme.',
    swatchColor: '#94a3b8',
  },
  stage: {
    id: 'stage',
    labelKey: 'community_chat_zone_theme_stage',
    labelDefault: 'Stage (soft)',
    descriptionKey: 'community_chat_zone_theme_stage_desc',
    descriptionDefault: 'Layered look with light transparency.',
    swatchColor: '#e86e2e',
  },
  warm: {
    id: 'warm',
    labelKey: 'community_chat_zone_theme_warm',
    labelDefault: 'Warm (solid)',
    descriptionKey: 'community_chat_zone_theme_warm_desc',
    descriptionDefault: 'Full-strength amber and orange — no wash.',
    swatchColor: '#ea580c',
  },
  cool: {
    id: 'cool',
    labelKey: 'community_chat_zone_theme_cool',
    labelDefault: 'Cool (solid)',
    descriptionKey: 'community_chat_zone_theme_cool_desc',
    descriptionDefault: 'Solid slate and sky blue surfaces.',
    swatchColor: '#0284c7',
  },
  vivid: {
    id: 'vivid',
    labelKey: 'community_chat_zone_theme_vivid',
    labelDefault: 'Vivid',
    descriptionKey: 'community_chat_zone_theme_vivid_desc',
    descriptionDefault: 'Maximum contrast — 100% opaque colors.',
    swatchColor: '#f97316',
  },
  neon: {
    id: 'neon',
    labelKey: 'community_chat_zone_theme_neon',
    labelDefault: 'Neon lights',
    descriptionKey: 'community_chat_zone_theme_neon_desc',
    descriptionDefault: 'Electric cyan, magenta, and lime on deep black.',
    swatchColor: '#00e5ff',
  },
  spring: {
    id: 'spring',
    labelKey: 'community_chat_zone_theme_spring',
    labelDefault: 'Spring green',
    descriptionKey: 'community_chat_zone_theme_spring_desc',
    descriptionDefault: 'Vivid fresh greens — bold and natural.',
    swatchColor: '#22c55e',
  },
  romantic: {
    id: 'romantic',
    labelKey: 'community_chat_zone_theme_romantic',
    labelDefault: 'Romantic red',
    descriptionKey: 'community_chat_zone_theme_romantic_desc',
    descriptionDefault: 'Deep burgundy and rose — intimate and rich.',
    swatchColor: '#be123c',
  },
};

/** CSS custom properties consumed by community-chat-zone-themes.css */
export const COMMUNITY_CHAT_ZONE_TOKEN_KEYS = [
  'cchat-zone-header-bg',
  'cchat-zone-header-border',
  'cchat-zone-header-text',
  'cchat-zone-header-text-muted',
  'cchat-zone-banner-frame-bg',
  'cchat-zone-banner-frame-border',
  'cchat-zone-banner-placeholder-bg',
  'cchat-zone-banner-title-text',
  'cchat-zone-banner-title-border',
  'cchat-zone-banner-body-text',
  'cchat-zone-banner-text-shadow',
  'cchat-zone-spotlight-bg',
  'cchat-zone-spotlight-border',
  'cchat-zone-spotlight-text',
  'cchat-zone-spotlight-shadow',
  'cchat-zone-guest-frame-bg',
  'cchat-zone-guest-frame-border',
  'cchat-zone-guest-frame-shadow',
  'cchat-zone-incoming-bg',
  'cchat-zone-incoming-border',
  'cchat-zone-incoming-text',
  'cchat-zone-incoming-time',
  'cchat-zone-incoming-shadow',
  'cchat-zone-outgoing-bg',
  'cchat-zone-outgoing-border',
  'cchat-zone-outgoing-text',
  'cchat-zone-outgoing-time',
  'cchat-zone-outgoing-shadow',
  'cchat-zone-host-bg',
  'cchat-zone-host-border',
  'cchat-zone-host-text',
  'cchat-zone-composer-bg',
  'cchat-zone-composer-border',
  'cchat-zone-composer-input-bg',
  'cchat-zone-composer-input-border',
  'cchat-zone-composer-text',
  'cchat-zone-composer-placeholder',
];

const DEFAULT_ZONE_THEME_ID = 'stage';

export function resolveCommunityChatZoneThemeId(partner) {
  const raw =
    partner?.communityChatZoneTheme ||
    partner?.businessInfo?.communityChatZoneTheme ||
    partner?.businessInfo?.drafts?.communityChatZoneTheme ||
    DEFAULT_ZONE_THEME_ID;

  const id = String(raw || '').trim().toLowerCase();
  return COMMUNITY_CHAT_ZONE_THEME_IDS.includes(id) ? id : DEFAULT_ZONE_THEME_ID;
}

/** Apply optional per-business token overrides (future Firestore field). */
export function buildCommunityChatZoneThemeInlineStyle(tokenOverrides = {}) {
  if (!tokenOverrides || typeof tokenOverrides !== 'object') return undefined;

  const style = {};
  for (const key of COMMUNITY_CHAT_ZONE_TOKEN_KEYS) {
    const value = tokenOverrides[key];
    if (value != null && String(value).trim()) {
      style[`--${key}`] = String(value).trim();
    }
  }
  return Object.keys(style).length ? style : undefined;
}
