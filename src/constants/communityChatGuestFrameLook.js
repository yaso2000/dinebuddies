/** Guest chat frame: optional image + optional banner-style color overlay. */

import {
  DEFAULT_BANNER_BG,
  DEFAULT_BANNER_BG2,
  DEFAULT_BANNER_GRADIENT_ANGLE,
  resolveBannerBgOpacity,
  resolveBannerGradientColors,
  sanitizeBannerBgDensity,
} from '../utils/communityChatBanner';
import {
  COMMUNITY_GUEST_FRAME_BACKGROUND_PRESET_IDS,
  getCommunityGuestFramePresetUrl,
} from './communityGuestFrameBackgrounds';

export {
  COMMUNITY_GUEST_FRAME_BACKGROUND_PRESETS,
  getCommunityGuestFramePresetUrl,
} from './communityGuestFrameBackgrounds';

const DEFAULT_COLOR_START = DEFAULT_BANNER_BG;
const DEFAULT_COLOR_END = DEFAULT_BANNER_BG2;
const DEFAULT_INTENSITY = 100;

function readPartnerGuestFrameField(partner, key) {
  return (
    partner?.[key] ||
    partner?.businessInfo?.[key] ||
    partner?.businessInfo?.drafts?.[key] ||
    null
  );
}

export function normalizeCommunityGuestFrameHexColor(raw, fallback = DEFAULT_COLOR_START) {
  const s = String(raw || '').trim();
  if (/^#[0-9a-fA-F]{6}$/.test(s)) return s.toLowerCase();
  if (/^#[0-9a-fA-F]{3}$/.test(s)) {
    return `#${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}`.toLowerCase();
  }
  return fallback;
}

export function resolveCommunityChatGuestFrameBgColorStart(partner) {
  const raw = readPartnerGuestFrameField(partner, 'communityChatGuestFrameBgColor1');
  if (!raw) return null;
  return normalizeCommunityGuestFrameHexColor(raw, null);
}

export function resolveCommunityChatGuestFrameBgColorEnd(partner) {
  const raw = readPartnerGuestFrameField(partner, 'communityChatGuestFrameBgColor2');
  if (!raw) return null;
  return normalizeCommunityGuestFrameHexColor(raw, null);
}

export function resolveCommunityChatGuestFrameBgIntensity(partner) {
  const raw = readPartnerGuestFrameField(partner, 'communityChatGuestFrameBgIntensity');
  return sanitizeBannerBgDensity(raw, DEFAULT_INTENSITY);
}

function normalizeGuestFrameBackgroundMode(raw) {
  const mode = String(raw || 'color').trim().toLowerCase();
  if (mode === 'none' || mode === 'preset' || mode === 'custom') return mode;
  return 'color';
}

export function getCommunityGuestFramePickerColorDefaults() {
  return {
    colorStart: DEFAULT_COLOR_START,
    colorEnd: DEFAULT_COLOR_END,
  };
}

function resolveGuestFrameImageUrl(presetId, customUrl) {
  if (presetId) return getCommunityGuestFramePresetUrl(presetId);
  if (customUrl) return customUrl;
  return null;
}

/**
 * @returns {{
 *   imageMode: 'none' | 'preset' | 'custom',
 *   colorOverlayEnabled: boolean,
 *   presetId: string | null,
 *   customUrl: string | null,
 *   colorStart: string | null,
 *   colorEnd: string | null,
 *   pickerColorStart: string,
 *   pickerColorEnd: string,
 *   intensity: number,
 *   imageUrl: string | null,
 * }}
 */
export function resolveCommunityChatGuestFrameBackground(partner) {
  const defaults = getCommunityGuestFramePickerColorDefaults();
  const storedMode = normalizeGuestFrameBackgroundMode(
    readPartnerGuestFrameField(partner, 'communityChatGuestFrameBgMode')
  );

  const presetRaw = readPartnerGuestFrameField(partner, 'communityChatGuestFrameBgPreset');
  const presetId = String(presetRaw || '').trim().toLowerCase();
  const safePresetId = COMMUNITY_GUEST_FRAME_BACKGROUND_PRESET_IDS.includes(presetId)
    ? presetId
    : null;

  const customRaw = readPartnerGuestFrameField(partner, 'communityChatGuestFrameBgUrl');
  const customUrl =
    typeof customRaw === 'string' && customRaw.trim() ? customRaw.trim() : null;

  const colorStart = resolveCommunityChatGuestFrameBgColorStart(partner);
  const colorEnd = resolveCommunityChatGuestFrameBgColorEnd(partner);
  const intensity = resolveCommunityChatGuestFrameBgIntensity(partner);

  let imageMode = 'none';
  let imageUrl = null;

  if (safePresetId) {
    imageMode = 'preset';
    imageUrl = resolveGuestFrameImageUrl(safePresetId, null);
  } else if (customUrl) {
    imageMode = 'custom';
    imageUrl = customUrl;
  }

  const colorOverlayEnabled =
    storedMode !== 'none' && Boolean(colorStart && colorEnd);

  if (storedMode === 'none') {
    return {
      imageMode: 'none',
      colorOverlayEnabled: false,
      presetId: null,
      customUrl: null,
      colorStart: null,
      colorEnd: null,
      pickerColorStart: defaults.colorStart,
      pickerColorEnd: defaults.colorEnd,
      intensity,
      imageUrl: null,
    };
  }

  return {
    imageMode,
    colorOverlayEnabled,
    presetId: safePresetId,
    customUrl,
    colorStart,
    colorEnd,
    pickerColorStart: colorStart || defaults.colorStart,
    pickerColorEnd: colorEnd || defaults.colorEnd,
    intensity,
    imageUrl,
  };
}

/** data-* attrs for .community-chat-root guest frame layer. */
export function getCommunityGuestFrameShellAttributes({ background } = {}) {
  const attrs = {};
  const resolved = background || {};

  if (resolved.imageUrl) {
    attrs['data-cchat-guest-frame-has-image'] = 'true';
  }
  if (resolved.colorOverlayEnabled) {
    attrs['data-cchat-guest-frame-color'] = 'true';
  }

  return attrs;
}

export function buildCommunityGuestFrameColorBackgroundCss(colorStart, colorEnd, density = 100) {
  const { color1, color2 } = resolveBannerGradientColors(colorStart, colorEnd);
  const alpha = resolveBannerBgOpacity(density);
  if (alpha <= 0) return 'transparent';
  const start = hexWithAlpha(color1, alpha);
  const end = hexWithAlpha(color2, alpha);
  return `linear-gradient(${DEFAULT_BANNER_GRADIENT_ANGLE}deg, ${start} 0%, ${end} 100%)`;
}

export function buildCommunityGuestFrameGradientPreview(colorStart, colorEnd, intensity = 100) {
  return buildCommunityGuestFrameColorBackgroundCss(colorStart, colorEnd, intensity);
}

function hexWithAlpha(hex, alpha) {
  const normalized = normalizeCommunityGuestFrameHexColor(hex);
  const r = parseInt(normalized.slice(1, 3), 16);
  const g = parseInt(normalized.slice(3, 5), 16);
  const b = parseInt(normalized.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function buildCommunityGuestFrameBackgroundStyle(background) {
  const style = {};
  const resolved = background || {};

  if (resolved.imageUrl) {
    style['--cchat-guest-frame-bg-image'] = `url("${String(resolved.imageUrl).replace(/"/g, '\\"')}")`;
  }

  if (resolved.colorOverlayEnabled) {
    const density = sanitizeBannerBgDensity(resolved.intensity, DEFAULT_INTENSITY);
    style['--cchat-guest-frame-bg-gradient'] = buildCommunityGuestFrameColorBackgroundCss(
      resolved.colorStart || resolved.pickerColorStart || DEFAULT_COLOR_START,
      resolved.colorEnd || resolved.pickerColorEnd || DEFAULT_COLOR_END,
      density
    );
  }

  return Object.keys(style).length ? style : undefined;
}

/** Build preview object from editor draft. */
export function buildGuestFrameBackgroundFromDraft(guestFrame) {
  const gf = guestFrame || {};
  const defaults = getCommunityGuestFramePickerColorDefaults();
  const imageMode = gf.imageMode || 'none';
  let imageUrl = null;

  if (imageMode === 'preset' && gf.presetId) {
    imageUrl = getCommunityGuestFramePresetUrl(gf.presetId);
  } else if (imageMode === 'custom' && gf.customUrl) {
    imageUrl = gf.customUrl;
  }

  const colorOverlayEnabled = gf.colorOverlayEnabled !== false;

  return {
    imageMode,
    colorOverlayEnabled,
    presetId: gf.presetId || null,
    customUrl: gf.customUrl || null,
    colorStart: gf.colorStart,
    colorEnd: gf.colorEnd,
    pickerColorStart: gf.colorStart || defaults.colorStart,
    pickerColorEnd: gf.colorEnd || defaults.colorEnd,
    intensity: gf.intensity ?? DEFAULT_INTENSITY,
    imageUrl,
  };
}

export function createGuestFrameDraftFromResolved(resolved) {
  const gb = resolved || {};
  let imageMode = gb.imageMode || 'none';
  if (!gb.imageMode) {
    if (gb.mode === 'preset' || gb.presetId) imageMode = 'preset';
    else if (gb.mode === 'custom' || gb.customUrl || gb.imageUrl) imageMode = 'custom';
    else imageMode = 'none';
  }

  const colorOverlayEnabled =
    gb.colorOverlayEnabled ??
    (gb.mode === 'color' || Boolean(gb.colorStart && gb.colorEnd));

  return {
    imageMode,
    colorOverlayEnabled,
    presetId: gb.presetId || null,
    customUrl:
      imageMode === 'custom'
        ? String(gb.customUrl || gb.imageUrl || '').trim() || null
        : null,
    colorStart: gb.pickerColorStart || gb.colorStart || DEFAULT_COLOR_START,
    colorEnd: gb.pickerColorEnd || gb.colorEnd || DEFAULT_COLOR_END,
    intensity: gb.intensity ?? DEFAULT_INTENSITY,
  };
}
