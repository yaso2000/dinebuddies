/** Preset guest-chat frame backgrounds in `public/community-guest-textures/`. */

export const COMMUNITY_GUEST_FRAME_BACKGROUNDS_BASE = '/community-guest-textures';

/** @typedef {'color' | 'preset' | 'custom'} CommunityGuestFrameBackgroundMode */

/** @type {readonly { id: string, file: string, labelKey: string, labelDefault: string }[]} */
export const COMMUNITY_GUEST_FRAME_BACKGROUND_PRESETS = [
  {
    id: 'midnight_aurora',
    file: 'midnight_aurora.webp',
    labelKey: 'community_guest_frame_bg_midnight_aurora',
    labelDefault: 'Midnight Aurora',
  },
  {
    id: 'emerald_smoke',
    file: 'emerald_smoke.webp',
    labelKey: 'community_guest_frame_bg_emerald_smoke',
    labelDefault: 'Emerald Smoke',
  },
  {
    id: 'royal_velvet',
    file: 'royal_velvet.webp',
    labelKey: 'community_guest_frame_bg_royal_velvet',
    labelDefault: 'Royal Velvet',
  },
  {
    id: 'golden_dusk',
    file: 'golden_dusk.webp',
    labelKey: 'community_guest_frame_bg_golden_dusk',
    labelDefault: 'Golden Dusk',
  },
  {
    id: 'rose_shadow',
    file: 'rose_shadow.webp',
    labelKey: 'community_guest_frame_bg_rose_shadow',
    labelDefault: 'Rose Shadow',
  },
  {
    id: 'soft_pearl',
    file: 'soft_pearl.webp',
    labelKey: 'community_guest_frame_bg_soft_pearl',
    labelDefault: 'Soft Pearl',
  },
  {
    id: 'silent_marble',
    file: 'silent_marble.webp',
    labelKey: 'community_guest_frame_bg_silent_marble',
    labelDefault: 'Silent Marble',
  },
  {
    id: 'blue_mirage',
    file: 'blue_mirage.webp',
    labelKey: 'community_guest_frame_bg_blue_mirage',
    labelDefault: 'Blue Mirage',
  },
];

export const COMMUNITY_GUEST_FRAME_BACKGROUND_PRESET_IDS =
  COMMUNITY_GUEST_FRAME_BACKGROUND_PRESETS.map((preset) => preset.id);

export function getCommunityGuestFramePresetAsset(presetId) {
  if (!presetId) return null;
  const id = String(presetId).trim().toLowerCase();
  return COMMUNITY_GUEST_FRAME_BACKGROUND_PRESETS.find((preset) => preset.id === id) || null;
}

export function getCommunityGuestFramePresetUrl(presetId) {
  const preset = getCommunityGuestFramePresetAsset(presetId);
  if (!preset?.file) return null;
  const base = COMMUNITY_GUEST_FRAME_BACKGROUNDS_BASE.replace(/\/$/, '');
  return `${base}/${encodeURIComponent(preset.file)}`;
}
