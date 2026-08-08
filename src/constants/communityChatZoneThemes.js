/** Preset zone themes for community / stage chat bubble colors. */
export const COMMUNITY_CHAT_ZONE_THEME_IDS = [
  'default',
  'stage',
  'warm',
  'cool',
  'vivid',
  'neon',
  'spring',
  'romantic',
];

/** Distinct primary hues shown in the Chat look picker (no near-duplicate oranges). */
export const COMMUNITY_CHAT_ZONE_THEME_LIST = [
  'default',
  'stage',
  'cool',
  'vivid',
  'neon',
  'spring',
  'romantic',
  'warm',
];

export const COMMUNITY_CHAT_ZONE_THEMES = {
  default: {
    id: 'default',
    labelKey: 'community_chat_zone_theme_default',
    labelDefault: 'Slate',
    descriptionKey: 'community_chat_zone_theme_default_desc',
    descriptionDefault: 'Neutral gray bubbles.',
    swatchColor: '#64748b',
  },
  stage: {
    id: 'stage',
    labelKey: 'community_chat_zone_theme_stage',
    labelDefault: 'Orange',
    descriptionKey: 'community_chat_zone_theme_stage_desc',
    descriptionDefault: 'Brand orange bubbles.',
    swatchColor: '#e86e2e',
  },
  cool: {
    id: 'cool',
    labelKey: 'community_chat_zone_theme_cool',
    labelDefault: 'Blue',
    descriptionKey: 'community_chat_zone_theme_cool_desc',
    descriptionDefault: 'Sky blue bubbles.',
    swatchColor: '#0284c7',
  },
  vivid: {
    id: 'vivid',
    labelKey: 'community_chat_zone_theme_vivid',
    labelDefault: 'Purple',
    descriptionKey: 'community_chat_zone_theme_vivid_desc',
    descriptionDefault: 'Violet purple bubbles.',
    swatchColor: '#7c3aed',
  },
  neon: {
    id: 'neon',
    labelKey: 'community_chat_zone_theme_neon',
    labelDefault: 'Cyan',
    descriptionKey: 'community_chat_zone_theme_neon_desc',
    descriptionDefault: 'Electric cyan bubbles.',
    swatchColor: '#06b6d4',
  },
  spring: {
    id: 'spring',
    labelKey: 'community_chat_zone_theme_spring',
    labelDefault: 'Green',
    descriptionKey: 'community_chat_zone_theme_spring_desc',
    descriptionDefault: 'Fresh green bubbles.',
    swatchColor: '#16a34a',
  },
  romantic: {
    id: 'romantic',
    labelKey: 'community_chat_zone_theme_romantic',
    labelDefault: 'Rose',
    descriptionKey: 'community_chat_zone_theme_romantic_desc',
    descriptionDefault: 'Deep rose bubbles.',
    swatchColor: '#e11d48',
  },
  warm: {
    id: 'warm',
    labelKey: 'community_chat_zone_theme_warm',
    labelDefault: 'Gold',
    descriptionKey: 'community_chat_zone_theme_warm_desc',
    descriptionDefault: 'Warm gold bubbles.',
    swatchColor: '#ca8a04',
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
