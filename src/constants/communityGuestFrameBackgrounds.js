/**
 * Preset guest-frame textures are retired.
 * Chat-area images are AI-generated only (stored as custom URLs).
 */

export const COMMUNITY_GUEST_FRAME_BACKGROUNDS_BASE = '/community-guest-textures';

/** @typedef {'color' | 'custom' | 'none'} CommunityGuestFrameBackgroundMode */

/** @type {readonly { id: string, file: string, labelKey: string, labelDefault: string }[]} */
export const COMMUNITY_GUEST_FRAME_BACKGROUND_PRESETS = [];

export const COMMUNITY_GUEST_FRAME_BACKGROUND_PRESET_IDS = [];

export function getCommunityGuestFramePresetAsset(_presetId) {
  return null;
}

export function getCommunityGuestFramePresetUrl(_presetId) {
  return null;
}
