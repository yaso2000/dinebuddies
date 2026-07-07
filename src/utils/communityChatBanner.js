/**
 * Layered community chat banner on `communities/{partnerId}`.
 * Image, gradient background, title, and body text are independent layers.
 */

export const BANNER_BG_TRANSPARENT = 'transparent';

export const BANNER_FONT_SIZES = {
    sm: '0.875rem',
    md: '1rem',
    lg: '1.375rem',
    xl: '1.75rem',
};

export const DEFAULT_BANNER_BG = '#0f2744';
export const DEFAULT_BANNER_BG2 = '#1e3a5f';
export const DEFAULT_BANNER_FONT_SIZE = 'md';
/** Title occupies the top 25% of the banner; body text the lower 75%. */
export const BANNER_TITLE_ZONE_PERCENT = 25;
export const BANNER_TEXT_ZONE_PERCENT = 75;
export const BANNER_AXIS_EDGE_MARGIN = 6;

export const DEFAULT_BANNER_TITLE_POS = { x: 50, y: 12.5 };
export const DEFAULT_BANNER_TEXT_POS = { x: 50, y: 62.5 };
export const DEFAULT_BANNER_GRADIENT_ANGLE = 135;
export const DEFAULT_BANNER_BG_DENSITY = 100;
export const BANNER_BODY_SLOT_COUNT = 3;
export const BANNER_TEXT_MAX_TOTAL = 300;
export const DEFAULT_BANNER_TEXT_COLOR = '#ffffff';
export const DEFAULT_BANNER_TITLE_COLOR = '#ffffff';
export const DEFAULT_BANNER_TITLE_FONT_SIZE = 'lg';
export const DEFAULT_BANNER_TITLE_FONT_FAMILY = 'system';
export const DEFAULT_BANNER_BODY_MAX_WIDTH = 88;

export const BANNER_TITLE_FONT_FAMILIES = {
    system: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    serif: 'Georgia, "Times New Roman", Times, serif',
    sans: '"Helvetica Neue", Arial, sans-serif',
    display: '"Trebuchet MS", "Segoe UI", sans-serif',
};

export const DEFAULT_BANNER_BODY_SLOT_POS = [
    { x: 22, y: 58 },
    { x: 50, y: 58 },
    { x: 78, y: 58 },
];

export const BANNER_BG_PRESETS = [
    { id: 'midnight', color: '#0f2744', color2: '#1e3a5f', label: 'Midnight' },
    { id: 'ember', color: '#7c2d12', color2: '#c2410c', label: 'Ember' },
    { id: 'violet', color: '#4c1d95', color2: '#7c3aed', label: 'Violet' },
    { id: 'forest', color: '#14532d', color2: '#22c55e', label: 'Forest' },
    { id: 'slate', color: '#1e293b', color2: '#475569', label: 'Slate' },
    { id: 'brand', color: '#c2410c', color2: '#f97316', label: 'Sunset' },
    { id: 'ocean', color: '#0c4a6e', color2: '#0284c7', label: 'Ocean' },
    { id: 'rose', color: '#831843', color2: '#f43f5e', label: 'Rose' },
    { id: 'lavender', color: '#312e81', color2: '#a78bfa', label: 'Lavender' },
    { id: 'gold', color: '#78350f', color2: '#fbbf24', label: 'Gold' },
    { id: 'neon', color: '#0f172a', color2: '#22d3ee', label: 'Neon' },
    { id: 'cherry', color: '#450a0a', color2: '#dc2626', label: 'Cherry' },
    { id: 'mint', color: '#064e3b', color2: '#34d399', label: 'Mint' },
    { id: 'royal', color: '#1e1b4b', color2: '#6366f1', label: 'Royal' },
    { id: 'peach', color: '#9a3412', color2: '#fdba74', label: 'Peach' },
    { id: 'night', color: '#020617', color2: '#334155', label: 'Night' },
];

export function sanitizeBannerAxis(value, fallback = 50, min = BANNER_AXIS_EDGE_MARGIN, max = 100 - BANNER_AXIS_EDGE_MARGIN) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(min, Math.min(max, Math.round(n * 10) / 10));
}

export function sanitizeBannerTitleY(value, fallback = DEFAULT_BANNER_TITLE_POS.y) {
    return sanitizeBannerAxis(
        value,
        fallback,
        BANNER_AXIS_EDGE_MARGIN,
        BANNER_TITLE_ZONE_PERCENT - BANNER_AXIS_EDGE_MARGIN
    );
}

export function sanitizeBannerTextY(value, fallback = DEFAULT_BANNER_TEXT_POS.y) {
    return sanitizeBannerAxis(
        value,
        fallback,
        BANNER_TITLE_ZONE_PERCENT + BANNER_AXIS_EDGE_MARGIN,
        100 - BANNER_AXIS_EDGE_MARGIN
    );
}

/**
 * Clamp draggable banner layer position within its zone (title top 25% / body lower 75%).
 * @param {'title' | 'text' | 'full'} zone — `full` uses the entire banner height (text-only).
 */
export function clampBannerDraggablePosition({
    zone,
    x,
    y,
    bannerRect,
    elementRect,
}) {
    const fallback =
        zone === 'title'
            ? { x: DEFAULT_BANNER_TITLE_POS.x, y: DEFAULT_BANNER_TITLE_POS.y }
            : { x: DEFAULT_BANNER_TEXT_POS.x, y: DEFAULT_BANNER_TEXT_POS.y };

    if (!bannerRect?.width || !bannerRect?.height) {
        return {
            x: sanitizeBannerAxis(x, fallback.x),
            y:
                zone === 'title'
                    ? sanitizeBannerTitleY(y, fallback.y)
                    : zone === 'text'
                      ? sanitizeBannerTextY(y, fallback.y)
                      : sanitizeBannerAxis(y, fallback.y),
        };
    }

    const halfW = (elementRect?.width || 0) / 2;
    const halfH = (elementRect?.height || 0) / 2;
    const widthPct = (px) => (px / bannerRect.width) * 100;
    const heightPct = (px) => (px / bannerRect.height) * 100;

    const minX = BANNER_AXIS_EDGE_MARGIN + widthPct(halfW);
    const maxX = 100 - BANNER_AXIS_EDGE_MARGIN - widthPct(halfW);

    let minY;
    let maxY;
    if (zone === 'title') {
        minY = BANNER_AXIS_EDGE_MARGIN + heightPct(halfH);
        maxY = BANNER_TITLE_ZONE_PERCENT - BANNER_AXIS_EDGE_MARGIN - heightPct(halfH);
    } else if (zone === 'text') {
        minY = BANNER_TITLE_ZONE_PERCENT + BANNER_AXIS_EDGE_MARGIN + heightPct(halfH);
        maxY = 100 - BANNER_AXIS_EDGE_MARGIN - heightPct(halfH);
    } else {
        minY = BANNER_AXIS_EDGE_MARGIN + heightPct(halfH);
        maxY = 100 - BANNER_AXIS_EDGE_MARGIN - heightPct(halfH);
    }

    if (minY > maxY) {
        const centerY =
            zone === 'title'
                ? BANNER_TITLE_ZONE_PERCENT / 2
                : zone === 'text'
                  ? BANNER_TITLE_ZONE_PERCENT + BANNER_TEXT_ZONE_PERCENT / 2
                  : 50;
        minY = centerY;
        maxY = centerY;
    }

    return {
        x: Math.max(minX, Math.min(maxX, x)),
        y: Math.max(minY, Math.min(maxY, y)),
    };
}

export function isBannerBgTransparent(value) {
    return String(value || '').trim().toLowerCase() === BANNER_BG_TRANSPARENT;
}

export function sanitizeBannerBgDensity(value, fallback = DEFAULT_BANNER_BG_DENSITY) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(0, Math.min(100, Math.round(n)));
}

export function resolveBannerBgOpacity(density) {
    return sanitizeBannerBgDensity(density) / 100;
}

export function sanitizeBannerHexColor(value, fallback = DEFAULT_BANNER_BG) {
    const s = String(value || '').trim();
    if (isBannerBgTransparent(s)) return BANNER_BG_TRANSPARENT;
    if (/^#[0-9A-Fa-f]{6}$/.test(s)) return s.toLowerCase();
    return fallback;
}

export function adjustHexLightness(hex, deltaPercent = 18) {
    const normalized = sanitizeBannerHexColor(hex);
    const n = parseInt(normalized.slice(1), 16);
    const r = (n >> 16) & 255;
    const g = (n >> 8) & 255;
    const b = n & 255;
    const factor = 1 + deltaPercent / 100;
    const clamp = (v) => Math.max(0, Math.min(255, Math.round(v * factor)));
    const toHex = (v) => clamp(v).toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function resolveBannerGradientColors(color1, color2) {
    const start = sanitizeBannerHexColor(color1 || DEFAULT_BANNER_BG);
    const end = color2
        ? sanitizeBannerHexColor(color2, adjustHexLightness(start))
        : adjustHexLightness(start);
    return { color1: start, color2: end };
}

export function buildBannerGradientCss(
    color1,
    color2,
    angle = DEFAULT_BANNER_GRADIENT_ANGLE
) {
    const { color1: start, color2: end } = resolveBannerGradientColors(color1, color2);
    return `linear-gradient(${angle}deg, ${start} 0%, ${end} 100%)`;
}

export function resolveBannerBackgroundCss({
    bgColor,
    bgColor2,
    bgGradientCss,
    bgDensity,
    transparent,
} = {}) {
    if (transparent || isBannerBgTransparent(bgColor)) return 'transparent';
    if (bgGradientCss) return bgGradientCss;
    if (bgColor) return buildBannerGradientCss(bgColor, bgColor2);
    return buildBannerGradientCss(DEFAULT_BANNER_BG, DEFAULT_BANNER_BG2);
}

export function resolveBannerBackgroundStyle({
    bgColor,
    bgColor2,
    bgGradientCss,
    bgDensity,
    transparent,
    hasBackground,
} = {}) {
    const css = resolveBannerBackgroundCss({
        bgColor,
        bgColor2,
        bgGradientCss,
        bgDensity,
        transparent,
    });
    if (!hasBackground || transparent || isBannerBgTransparent(bgColor) || css === 'transparent') {
        return { background: 'transparent' };
    }
    return {
        background: css,
        opacity: resolveBannerBgOpacity(bgDensity),
    };
}

export function sanitizeBannerFontSize(value) {
    const s = String(value || '').trim();
    if (Object.prototype.hasOwnProperty.call(BANNER_FONT_SIZES, s)) return s;
    return DEFAULT_BANNER_FONT_SIZE;
}

export function resolveBannerFontSizeCss(sizeKey) {
    return BANNER_FONT_SIZES[sanitizeBannerFontSize(sizeKey)];
}

/** Title line — uses dedicated title font size when set. */
export function resolveBannerTitleFontSizeCss(sizeKey) {
    return BANNER_FONT_SIZES[sanitizeBannerFontSize(sizeKey || DEFAULT_BANNER_TITLE_FONT_SIZE)];
}

export function sanitizeBannerTitleFontSize(value) {
    return sanitizeBannerFontSize(value || DEFAULT_BANNER_TITLE_FONT_SIZE);
}

export function sanitizeBannerFontFamily(value) {
    const key = String(value || '').trim();
    return Object.prototype.hasOwnProperty.call(BANNER_TITLE_FONT_FAMILIES, key)
        ? key
        : DEFAULT_BANNER_TITLE_FONT_FAMILY;
}

export function resolveBannerFontFamilyCss(familyKey) {
    return BANNER_TITLE_FONT_FAMILIES[sanitizeBannerFontFamily(familyKey)];
}

export function sanitizeBannerTextColor(value, fallback = DEFAULT_BANNER_TEXT_COLOR) {
    const s = String(value || '').trim();
    if (/^#[0-9A-Fa-f]{6}$/.test(s)) return s.toLowerCase();
    return fallback;
}

export function sanitizeBannerBorderWidth(value, fallback = 0) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(0, Math.min(6, Math.round(n)));
}

export function sanitizeBannerBorderRadius(value, fallback = 4) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(0, Math.min(16, Math.round(n)));
}

export function sanitizeBannerTextMaxWidth(value, fallback = DEFAULT_BANNER_BODY_MAX_WIDTH) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(40, Math.min(95, Math.round(n)));
}

export function sanitizeBannerBool(value) {
    return value === true || value === 'true' || value === 1;
}

export function createDefaultBannerBodySlot(index = 0) {
    const pos = DEFAULT_BANNER_BODY_SLOT_POS[index] || DEFAULT_BANNER_TEXT_POS;
    return {
        text: '',
        x: pos.x,
        y: pos.y,
        color: DEFAULT_BANNER_TEXT_COLOR,
        bold: false,
        italic: false,
        fontSize: DEFAULT_BANNER_FONT_SIZE,
        maxWidth: DEFAULT_BANNER_BODY_MAX_WIDTH,
    };
}

export function createDefaultBannerTitleStyle() {
    return {
        color: DEFAULT_BANNER_TITLE_COLOR,
        fontFamily: DEFAULT_BANNER_TITLE_FONT_FAMILY,
        fontSize: DEFAULT_BANNER_TITLE_FONT_SIZE,
        borderColor: '#000000',
        borderWidth: 0,
    };
}

/** CSS text outline (stroke) — not a box border around the text block. */
export function buildBannerTextStrokeStyle(strokeWidth, strokeColor, fallbackColor = '#000000') {
    const width = sanitizeBannerBorderWidth(strokeWidth, 0);
    if (width <= 0) return {};
    const color = sanitizeBannerTextColor(strokeColor, fallbackColor);
    return {
        WebkitTextStroke: `${width}px ${color}`,
        paintOrder: 'stroke fill',
    };
}

export function sumBannerBodyChars(texts = []) {
    return (texts || []).reduce((sum, slot) => sum + String(slot?.text || '').length, 0);
}

export function hasAnyBannerBodyText(texts = []) {
    return (texts || []).some((slot) => String(slot?.text || '').trim());
}

/** @param {string} nextText @param {Array} slots @param {number} slotIndex */
export function clampBannerBodySlotText(nextText, slots, slotIndex) {
    const others = sumBannerBodyChars(
        (slots || []).map((slot, idx) =>
            idx === slotIndex ? { ...slot, text: '' } : slot
        )
    );
    const budget = Math.max(0, BANNER_TEXT_MAX_TOTAL - others);
    return String(nextText || '').slice(0, budget);
}

function readBodySlotFromData(data, index) {
    const n = index + 1;
    const legacyText = index === 0 ? String(data?.banner_text || '').trim() : '';
    const text = String(data?.[`banner_text_${n}`] || '').trim() || legacyText;
    const hasTitle = Boolean(String(data?.banner_title || '').trim());
    const defaultPos = DEFAULT_BANNER_BODY_SLOT_POS[index] || DEFAULT_BANNER_TEXT_POS;
    const x = text
        ? sanitizeBannerAxis(data?.[`banner_text_${n}_x`], defaultPos.x)
        : null;
    let y = null;
    if (text) {
        const rawY = data?.[`banner_text_${n}_y`];
        y = hasTitle
            ? sanitizeBannerTextY(rawY, defaultPos.y)
            : sanitizeBannerAxis(rawY, defaultPos.y);
    }
    return {
        text,
        x,
        y,
        color: sanitizeBannerTextColor(data?.[`banner_text_${n}_color`]),
        bold: sanitizeBannerBool(data?.[`banner_text_${n}_bold`]),
        italic: sanitizeBannerBool(data?.[`banner_text_${n}_italic`]),
        fontSize: sanitizeBannerFontSize(data?.[`banner_text_${n}_font_size`]),
        maxWidth: sanitizeBannerTextMaxWidth(data?.[`banner_text_${n}_max_width`]),
    };
}

export function normalizeBannerBodySlots(data) {
    return Array.from({ length: BANNER_BODY_SLOT_COUNT }, (_, index) =>
        readBodySlotFromData(data, index)
    );
}

export function normalizeBannerTitleStyle(data) {
    return {
        color: sanitizeBannerTextColor(data?.banner_title_color, DEFAULT_BANNER_TITLE_COLOR),
        fontFamily: sanitizeBannerFontFamily(data?.banner_title_font_family),
        fontSize: sanitizeBannerTitleFontSize(data?.banner_title_font_size),
        borderColor: sanitizeBannerTextColor(data?.banner_title_border_color, '#000000'),
        borderWidth: sanitizeBannerBorderWidth(data?.banner_title_border_width, 0),
    };
}

export function resolveBannerTitleInlineStyle(titleStyle = {}) {
    const style = titleStyle || createDefaultBannerTitleStyle();
    return {
        color: sanitizeBannerTextColor(style.color, DEFAULT_BANNER_TITLE_COLOR),
        fontFamily: resolveBannerFontFamilyCss(style.fontFamily),
        fontSize: resolveBannerTitleFontSizeCss(style.fontSize),
        fontWeight: 800,
        ...buildBannerTextStrokeStyle(style.borderWidth, style.borderColor),
    };
}

export function resolveBannerBodyInlineStyle(slot = {}) {
    const s = slot || createDefaultBannerBodySlot(0);
    return {
        color: sanitizeBannerTextColor(s.color),
        fontSize: resolveBannerFontSizeCss(s.fontSize),
        fontWeight: s.bold ? 700 : 600,
        fontStyle: s.italic ? 'italic' : 'normal',
        whiteSpace: 'nowrap',
        ...buildBannerTextStrokeStyle(s.borderWidth, s.borderColor),
    };
}

function serializeBodySlotsToFirestore(texts = [], hasTitle = false) {
    const out = { banner_text: '' };
    for (let i = 0; i < BANNER_BODY_SLOT_COUNT; i += 1) {
        const n = i + 1;
        const slot = texts[i] || createDefaultBannerBodySlot(i);
        const trimmed = String(slot.text || '').trim();
        const defaultPos = DEFAULT_BANNER_BODY_SLOT_POS[i] || DEFAULT_BANNER_TEXT_POS;
        out[`banner_text_${n}`] = trimmed;
        out[`banner_text_${n}_x`] = trimmed
            ? sanitizeBannerAxis(slot.x, defaultPos.x)
            : '';
        out[`banner_text_${n}_y`] = trimmed
            ? hasTitle
                ? sanitizeBannerTextY(slot.y, defaultPos.y)
                : sanitizeBannerAxis(slot.y, defaultPos.y)
            : '';
        out[`banner_text_${n}_color`] = trimmed
            ? sanitizeBannerTextColor(slot.color)
            : '';
        out[`banner_text_${n}_bold`] = trimmed ? Boolean(slot.bold) : false;
        out[`banner_text_${n}_italic`] = trimmed ? Boolean(slot.italic) : false;
        out[`banner_text_${n}_font_size`] = trimmed
            ? sanitizeBannerFontSize(slot.fontSize)
            : '';
        out[`banner_text_${n}_max_width`] = trimmed
            ? sanitizeBannerTextMaxWidth(slot.maxWidth)
            : '';
    }
    return out;
}

function serializeTitleStyleToFirestore(titleStyle = {}) {
    const style = titleStyle || createDefaultBannerTitleStyle();
    return {
        banner_title_color: sanitizeBannerTextColor(style.color, DEFAULT_BANNER_TITLE_COLOR),
        banner_title_font_family: sanitizeBannerFontFamily(style.fontFamily),
        banner_title_font_size: sanitizeBannerTitleFontSize(style.fontSize),
        banner_title_border_color: sanitizeBannerTextColor(style.borderColor, '#000000'),
        banner_title_border_width: sanitizeBannerBorderWidth(style.borderWidth, 0),
        banner_title_border_radius: '',
    };
}

function firestoreTimestampToMs(ts) {
    if (ts == null) return 0;
    if (typeof ts === 'number' && Number.isFinite(ts)) return ts;
    if (typeof ts.toMillis === 'function') return ts.toMillis();
    if (typeof ts.seconds === 'number') return ts.seconds * 1000;
    return 0;
}

function hasStoredBgField(data) {
    const raw = data?.banner_bg_color;
    return raw !== undefined && raw !== null && String(raw).trim() !== '';
}

function resolveStoredBannerType({ url, title, texts, hasBackground }) {
    const hasOverlay = Boolean(title || hasAnyBannerBodyText(texts));
    if (url && !hasOverlay && !hasBackground) return 'image';
    if (!url && !hasOverlay && !hasBackground) return 'none';
    return 'text';
}

export function normalizeCommunityBanner(data) {
    const url = data?.banner_url ? String(data.banner_url).trim() : '';
    const youtubeRaw = data?.banner_youtube_id ? String(data.banner_youtube_id).trim() : '';
    const youtubeId = /^[a-zA-Z0-9_-]{11}$/.test(youtubeRaw) ? youtubeRaw : '';
    const youtubeShort = data?.banner_youtube_short === true;
    const youtubeSyncAt = youtubeId
        ? firestoreTimestampToMs(data?.banner_youtube_sync_at) ||
          firestoreTimestampToMs(data?.banner_updated_at)
        : 0;
    const title = String(data?.banner_title || '').trim();
    const texts = normalizeBannerBodySlots(data);
    const titleStyle = normalizeBannerTitleStyle(data);
    const text = texts[0]?.text || '';
    const hasBgField = hasStoredBgField(data);
    const bgRaw = data?.banner_bg_color;
    const transparent = hasBgField && isBannerBgTransparent(bgRaw);
    const hasBackground = hasBgField && !transparent;
    const fontSize = sanitizeBannerFontSize(data?.banner_font_size);

    const gradientColors = hasBackground
        ? resolveBannerGradientColors(bgRaw, data?.banner_bg_color2)
        : { color1: '', color2: '' };
    const bgGradientCss = hasBackground
        ? buildBannerGradientCss(gradientColors.color1, gradientColors.color2)
        : '';
    const bgDensity = hasBackground
        ? sanitizeBannerBgDensity(data?.banner_bg_density)
        : DEFAULT_BANNER_BG_DENSITY;

    const titleX = title
        ? sanitizeBannerAxis(data?.banner_title_x, DEFAULT_BANNER_TITLE_POS.x)
        : null;
    const titleY = title
        ? sanitizeBannerTitleY(data?.banner_title_y, DEFAULT_BANNER_TITLE_POS.y)
        : null;

    const textX = texts[0]?.x ?? null;
    const textY = texts[0]?.y ?? null;

    return {
        url,
        youtubeId,
        youtubeShort,
        youtubeSyncAt,
        title,
        text,
        texts,
        titleStyle,
        titleX,
        titleY,
        textX,
        textY,
        bgColor: transparent
            ? BANNER_BG_TRANSPARENT
            : hasBackground
              ? gradientColors.color1
              : '',
        bgColor2: hasBackground ? gradientColors.color2 : '',
        bgGradientCss,
        bgDensity,
        hasBackground,
        fontSize,
        transparent,
        hostSpotlightDismissed: data?.host_spotlight_dismissed === true,
        hostSpotlightAuto: data?.host_spotlight_auto === true,
    };
}

/** Image upload — only replaces the image layer. */
export function buildBannerImageUpdate(url) {
    return {
        banner_url: url,
        banner_youtube_id: '',
        banner_youtube_short: false,
    };
}

/** Remove custom banner image (falls back to business cover). */
export function buildBannerClearImageUpdate() {
    return { banner_url: '' };
}

/** YouTube background — replaces image/upload layer. */
export function buildBannerYoutubeUpdate(videoId, { isShort = false } = {}) {
    const id = String(videoId || '').trim();
    if (!/^[a-zA-Z0-9_-]{11}$/.test(id)) {
        return { banner_youtube_id: '', banner_youtube_short: false };
    }
    return {
        banner_youtube_id: id,
        banner_youtube_short: Boolean(isShort),
        banner_url: '',
    };
}

export function buildBannerUpdate({
    title,
    text,
    texts,
    titleStyle,
    bgColor,
    bgColor2,
    bgDensity,
    hasBackground,
    fontSize,
    imageUrl,
    url,
    youtubeId,
    youtubeShort,
    titleX,
    titleY,
    textX,
    textY,
} = {}) {
    const transparent = isBannerBgTransparent(bgColor);
    const trimmedTitle = String(title || '').trim();
    const normalizedTexts = Array.isArray(texts)
        ? texts.map((slot, index) => ({
              ...createDefaultBannerBodySlot(index),
              ...slot,
              text: String(slot?.text || '').trim(),
          }))
        : normalizeBannerBodySlots({
              banner_text: String(text || '').trim(),
              banner_text_1: String(text || '').trim(),
          });
    const style = titleStyle || createDefaultBannerTitleStyle();
    const ytRaw = String(youtubeId ?? '').trim();
    const bannerYoutubeId = /^[a-zA-Z0-9_-]{11}$/.test(ytRaw) ? ytRaw : '';
    const bannerUrl = bannerYoutubeId ? '' : String(imageUrl ?? url ?? '').trim();
    const showBackground = hasBackground ?? (!transparent && Boolean(bgColor));
    const colors = showBackground && !transparent
        ? resolveBannerGradientColors(bgColor || DEFAULT_BANNER_BG, bgColor2)
        : { color1: BANNER_BG_TRANSPARENT, color2: '' };

    return {
        banner_type: resolveStoredBannerType({
            url: bannerUrl || (bannerYoutubeId ? `youtube:${bannerYoutubeId}` : ''),
            title: trimmedTitle,
            texts: normalizedTexts,
            hasBackground: showBackground,
        }),
        banner_url: bannerUrl,
        banner_youtube_id: bannerYoutubeId,
        banner_youtube_short: bannerYoutubeId ? Boolean(youtubeShort) : false,
        banner_title: trimmedTitle,
        ...serializeBodySlotsToFirestore(normalizedTexts, Boolean(trimmedTitle)),
        ...serializeTitleStyleToFirestore(style),
        banner_title_x: trimmedTitle
            ? sanitizeBannerAxis(titleX, DEFAULT_BANNER_TITLE_POS.x)
            : '',
        banner_title_y: trimmedTitle
            ? sanitizeBannerTitleY(titleY, DEFAULT_BANNER_TITLE_POS.y)
            : '',
        banner_bg_color: transparent
            ? BANNER_BG_TRANSPARENT
            : showBackground
              ? colors.color1
              : '',
        banner_bg_color2: transparent || !showBackground ? '' : colors.color2,
        banner_bg_density:
            transparent || !showBackground
                ? ''
                : sanitizeBannerBgDensity(bgDensity),
        banner_font_size: sanitizeBannerFontSize(fontSize),
    };
}

/** @deprecated Use buildBannerUpdate */
export const buildBannerTextUpdate = buildBannerUpdate;

/** Merge a partial patch onto the current normalized banner (for split host tools). */
export function mergeBannerPatch(current, patch = {}) {
    const base = current || normalizeCommunityBanner(null);

    let bgColor = patch.bgColor !== undefined ? patch.bgColor : base.bgColor;
    let bgColor2 = patch.bgColor2 !== undefined ? patch.bgColor2 : base.bgColor2;
    let bgDensity =
        patch.bgDensity !== undefined ? patch.bgDensity : base.bgDensity ?? DEFAULT_BANNER_BG_DENSITY;
    const transparent = isBannerBgTransparent(bgColor);

    let hasBackground = base.hasBackground;
    if (patch.bgColor !== undefined) {
        hasBackground = !transparent;
    } else if (patch.hasBackground !== undefined) {
        hasBackground = Boolean(patch.hasBackground);
    }

    const title =
        patch.title !== undefined ? String(patch.title).trim() : base.title;

    let texts = (base.texts || normalizeBannerBodySlots(null)).map((slot, index) => ({
        ...createDefaultBannerBodySlot(index),
        ...slot,
    }));
    if (patch.texts !== undefined && Array.isArray(patch.texts)) {
        texts = texts.map((slot, index) => ({
            ...slot,
            ...(patch.texts[index] || {}),
            text:
                patch.texts[index]?.text !== undefined
                    ? String(patch.texts[index].text || '').trim()
                    : slot.text,
        }));
    } else if (patch.text !== undefined) {
        texts = texts.map((slot, index) =>
            index === 0 ? { ...slot, text: String(patch.text || '').trim() } : slot
        );
    }

    let titleStyle = { ...createDefaultBannerTitleStyle(), ...(base.titleStyle || {}) };
    if (patch.titleStyle !== undefined) {
        titleStyle = { ...titleStyle, ...patch.titleStyle };
    }
    if (patch.titleColor !== undefined) titleStyle.color = patch.titleColor;
    if (patch.titleFontFamily !== undefined) titleStyle.fontFamily = patch.titleFontFamily;
    if (patch.titleFontSize !== undefined) titleStyle.fontSize = patch.titleFontSize;
    if (patch.titleBorderColor !== undefined) titleStyle.borderColor = patch.titleBorderColor;
    if (patch.titleBorderWidth !== undefined) titleStyle.borderWidth = patch.titleBorderWidth;
    if (patch.titleBorderRadius !== undefined) titleStyle.borderRadius = patch.titleBorderRadius;

    let titleX = base.titleX;
    let titleY = base.titleY;
    if (!title) {
        titleX = null;
        titleY = null;
    } else if (patch.titleX !== undefined) {
        titleX = sanitizeBannerAxis(patch.titleX, DEFAULT_BANNER_TITLE_POS.x);
    } else if (titleX == null) {
        titleX = DEFAULT_BANNER_TITLE_POS.x;
        titleY = DEFAULT_BANNER_TITLE_POS.y;
    }
    if (title && patch.titleY !== undefined) {
        titleY = sanitizeBannerTitleY(patch.titleY, DEFAULT_BANNER_TITLE_POS.y);
    } else if (title && titleY == null) {
        titleY = DEFAULT_BANNER_TITLE_POS.y;
    }

    texts = texts.map((slot, index) => {
        const defaultPos = DEFAULT_BANNER_BODY_SLOT_POS[index] || DEFAULT_BANNER_TEXT_POS;
        if (!slot.text) {
            return { ...slot, x: null, y: null };
        }
        let x = slot.x ?? defaultPos.x;
        let y = slot.y ?? defaultPos.y;
        const xKey = `text${index + 1}X`;
        const yKey = `text${index + 1}Y`;
        if (patch[xKey] !== undefined) {
            x = sanitizeBannerAxis(patch[xKey], defaultPos.x);
        }
        if (patch[yKey] !== undefined) {
            y = title
                ? sanitizeBannerTextY(patch[yKey], defaultPos.y)
                : sanitizeBannerAxis(patch[yKey], defaultPos.y);
        }
        return { ...slot, x, y };
    });

    const fontSize =
        patch.fontSize !== undefined
            ? sanitizeBannerFontSize(patch.fontSize)
            : base.fontSize;

    let imageUrl = base.url || '';
    if (patch.imageUrl !== undefined) {
        imageUrl = String(patch.imageUrl).trim();
    }

    let youtubeId = base.youtubeId || '';
    if (patch.youtubeId !== undefined) {
        youtubeId = /^[a-zA-Z0-9_-]{11}$/.test(String(patch.youtubeId || '').trim())
            ? String(patch.youtubeId).trim()
            : '';
    }
    if (patch.imageUrl !== undefined && imageUrl) {
        youtubeId = '';
    }
    if (patch.youtubeId !== undefined && youtubeId) {
        imageUrl = '';
    }

    let youtubeShort = Boolean(base.youtubeShort);
    if (patch.youtubeShort !== undefined) {
        youtubeShort = Boolean(patch.youtubeShort);
    }
    if (!youtubeId) {
        youtubeShort = false;
    }
    if (patch.imageUrl !== undefined && imageUrl) {
        youtubeShort = false;
    }

    const gradientColors = hasBackground && !transparent
        ? resolveBannerGradientColors(bgColor || DEFAULT_BANNER_BG, bgColor2)
        : { color1: '', color2: '' };

    return {
        title,
        text: texts[0]?.text || '',
        texts,
        titleStyle,
        titleX,
        titleY,
        textX: texts[0]?.x ?? null,
        textY: texts[0]?.y ?? null,
        bgColor: transparent
            ? BANNER_BG_TRANSPARENT
            : hasBackground
              ? gradientColors.color1
              : bgColor,
        bgColor2: hasBackground ? gradientColors.color2 : '',
        bgGradientCss:
            hasBackground && !transparent
                ? buildBannerGradientCss(gradientColors.color1, gradientColors.color2)
                : '',
        bgDensity: hasBackground && !transparent
            ? sanitizeBannerBgDensity(bgDensity)
            : DEFAULT_BANNER_BG_DENSITY,
        hasBackground,
        fontSize,
        imageUrl,
        youtubeId,
        youtubeShort,
        transparent,
    };
}
