/** Guest chat frame: optional image + optional banner-style color overlay. */

import {
  DEFAULT_BANNER_BG,
  DEFAULT_BANNER_BG2,
  DEFAULT_BANNER_GRADIENT_ANGLE,
  resolveBannerBgOpacity,
  resolveBannerGradientColors,
  sanitizeBannerBgDensity,
} from '../utils/communityChatBanner';

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
  // Preset textures are retired — treat legacy `preset` as no image.
  if (mode === 'preset') return 'none';
  if (mode === 'none' || mode === 'custom') return mode;
  return 'color';
}

export function getCommunityGuestFramePickerColorDefaults() {
  return {
    colorStart: DEFAULT_COLOR_START,
    colorEnd: DEFAULT_COLOR_END,
  };
}

/**
 * @returns {{
 *   imageMode: 'none' | 'custom',
 *   colorOverlayEnabled: boolean,
 *   presetId: null,
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

  // AI / Storage URL only — never surface retired preset textures.
  const customRaw = readPartnerGuestFrameField(partner, 'communityChatGuestFrameBgUrl');
  const customUrl =
    typeof customRaw === 'string' && customRaw.trim() ? customRaw.trim() : null;

  const colorStart = resolveCommunityChatGuestFrameBgColorStart(partner);
  const colorEnd = resolveCommunityChatGuestFrameBgColorEnd(partner);
  const intensity = resolveCommunityChatGuestFrameBgIntensity(partner);

  const imageMode = customUrl ? 'custom' : 'none';
  const imageUrl = customUrl;

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
    presetId: null,
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
  const customUrl =
    gf.imageMode === 'custom' && gf.customUrl
      ? String(gf.customUrl).trim()
      : '';
  const imageMode = customUrl ? 'custom' : 'none';
  const colorOverlayEnabled = gf.colorOverlayEnabled !== false;

  return {
    imageMode,
    colorOverlayEnabled,
    presetId: null,
    customUrl: customUrl || null,
    colorStart: gf.colorStart,
    colorEnd: gf.colorEnd,
    pickerColorStart: gf.colorStart || defaults.colorStart,
    pickerColorEnd: gf.colorEnd || defaults.colorEnd,
    intensity: gf.intensity ?? DEFAULT_INTENSITY,
    imageUrl: customUrl || null,
  };
}

export function createGuestFrameDraftFromResolved(resolved) {
  const gb = resolved || {};
  const customUrl = String(gb.customUrl || gb.imageUrl || '').trim();
  // Ignore legacy presets — AI / custom URL only.
  const imageMode = customUrl ? 'custom' : 'none';

  const colorOverlayEnabled =
    gb.colorOverlayEnabled ??
    (gb.mode === 'color' || Boolean(gb.colorStart && gb.colorEnd));

  return {
    imageMode,
    colorOverlayEnabled,
    presetId: null,
    customUrl: imageMode === 'custom' ? customUrl : null,
    colorStart: gb.pickerColorStart || gb.colorStart || DEFAULT_COLOR_START,
    colorEnd: gb.pickerColorEnd || gb.colorEnd || DEFAULT_COLOR_END,
    intensity: gb.intensity ?? DEFAULT_INTENSITY,
  };
}
