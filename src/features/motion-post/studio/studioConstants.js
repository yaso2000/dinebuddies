import { POST_BACKGROUND_GRADIENT_VALUES } from '../../../constants/postBackgroundGradients';

/** @typedef {'square' | 'story' | 'header_card'} StudioLayoutModel */

export const STUDIO_NEON_PRIMARY = '#ff7a00';
export const STUDIO_NEON_GLOW = '#ff9d2e';
export const STUDIO_NEON_BG = '#0f1115';

export const STUDIO_LAYOUTS = [
    { id: 'header_card', labelKey: 'studio_layout_header', label: 'Header', aspect: 'header' },
    { id: 'story', labelKey: 'studio_layout_story', label: '9:16', aspect: 'vertical' },
    { id: 'square', labelKey: 'studio_layout_square', label: '1:1', aspect: 'square' },
];

/** @typedef {'top' | 'center' | 'bottom'} StudioTextVerticalAlign */

/** Spacing between title/body and vertical inset inside the text block */
/** @typedef {'circle' | 'pill' | 'ribbon' | 'burst'} StudioPromoVariant */

/** @type {{ id: string; display: string; variant: StudioPromoVariant; bg?: string; color?: string }[]} */
export const STUDIO_PROMO_STICKERS = [
    { id: 'pct_70', display: '70%', variant: 'circle' },
    { id: 'pct_50', display: '50%', variant: 'circle' },
    { id: 'pct_30', display: '30%', variant: 'circle' },
    { id: 'pct_25', display: '25%', variant: 'pill' },
    { id: 'off', display: 'OFF', variant: 'ribbon', bg: '#ff7a00' },
    { id: 'sale', display: 'SALE', variant: 'ribbon', bg: '#e11d48' },
    { id: 'new', display: 'NEW', variant: 'pill', bg: '#22c55e' },
    { id: 'hot', display: '🔥', variant: 'burst' },
    { id: 'gift', display: '🎁', variant: 'burst' },
    { id: 'tag_ar', labelKey: 'studio_promo_offer', display: 'OFFER', variant: 'pill', bg: STUDIO_NEON_PRIMARY },
    { id: 'free', display: 'FREE', variant: 'pill', bg: '#3b82f6' },
    { id: 'star', display: '⭐', variant: 'burst' },
];

/** Corner slots on the image (max one sticker per corner). */
export const STUDIO_PROMO_CORNER_SLOTS = ['corner-ts', 'corner-te', 'corner-bs', 'corner-be'];

export const STUDIO_PROMO_MAX = STUDIO_PROMO_CORNER_SLOTS.length;

/** @param {string[]} usedSlots */
export function pickPromoCornerSlot(usedSlots) {
    const used = new Set(usedSlots);
    return STUDIO_PROMO_CORNER_SLOTS.find((slot) => !used.has(slot)) ?? null;
}

export const STUDIO_TITLE_FONT_SIZE_DEFAULT = 26;
export const STUDIO_BODY_FONT_SIZE_DEFAULT = 18;

export const STUDIO_TEXT_SPACING_DEFAULT = {
    textStackGap: 6,
    textPaddingTop: 0,
    textPaddingBottom: 0,
};

/** Fixed effect values — toggles in the studio apply these (no sliders). */
export const STUDIO_FX_DEFAULTS = {
    textShadow: true,
    shadowDepth: 55,
    shadowBlur: 14,
    shadowOffsetX: 0,
    shadowOffsetY: 4,
    shadowColor: '#000000',
    glowIntensity: 28,
    glowColor: STUDIO_NEON_GLOW,
    textStroke: false,
    strokeWidth: 1,
    strokeColor: '#000000',
};

/** Shared palette for shadow, stroke, and glow in the effects toolbar. */
export const STUDIO_FX_COLORS = [
    '#000000',
    '#ffffff',
    '#1e293b',
    STUDIO_NEON_PRIMARY,
    STUDIO_NEON_GLOW,
    '#3b82f6',
    '#ff2d95',
    '#22c55e',
];

const baseTextStyle = {
    fontFamily: '"Cairo", "Tajawal", sans-serif',
    fontSize: STUDIO_TITLE_FONT_SIZE_DEFAULT,
    titleFontSize: STUDIO_TITLE_FONT_SIZE_DEFAULT,
    bodyFontSize: STUDIO_BODY_FONT_SIZE_DEFAULT,
    fontWeight: 700,
    fontStyle: 'normal',
    textAlign: 'center',
    textVerticalAlign: 'center',
    textColor: '#ffffff',
    subtitleColor: STUDIO_NEON_GLOW,
    backgroundColor: 'transparent',
    overlayTintColor: '#000000',
    overlayOpacity: 35,
    opacity: 100,
    glowIntensity: 28,
    textShadow: true,
    shadowDepth: 55,
    shadowBlur: 14,
    shadowOffsetX: 0,
    shadowOffsetY: 4,
    shadowColor: '#000000',
    textStroke: false,
    strokeWidth: 1,
    strokeColor: '#000000',
    titleColorMode: 'solid',
    bodyColorMode: 'solid',
    rainbowPreset: 'kids',
    letterSpacing: 0,
    lineHeight: 1.25,
    ...STUDIO_TEXT_SPACING_DEFAULT,
};

/** @type {Record<string, object>} */
export const STUDIO_STYLE_PRESETS = {
    cairo: { ...baseTextStyle },
    modern: { ...baseTextStyle },
    bold: {
        ...baseTextStyle,
        fontFamily: '"Cairo", sans-serif',
        titleFontSize: 30,
        bodyFontSize: 20,
        fontSize: 30,
        fontWeight: 800,
    },
    classic: {
        ...baseTextStyle,
        fontFamily: '"Cairo", "Georgia", serif',
        titleFontSize: 24,
        bodyFontSize: 17,
        fontSize: 24,
        fontWeight: 600,
        textAlign: 'center',
        backgroundColor: 'rgba(0,0,0,0.55)',
        overlayOpacity: 45,
        opacity: 92,
        glowIntensity: 18,
        lineHeight: 1.35,
    },
};

/** @typedef {{ id: string; label: string; family: string; sample?: string }} StudioFontOption */

/** @type {StudioFontOption[]} */
export const STUDIO_ARABIC_FONTS = [
    { id: 'cairo', label: 'Cairo', family: '"Cairo", sans-serif', sample: 'أبجد' },
    { id: 'tajawal', label: 'Tajawal', family: '"Tajawal", sans-serif', sample: 'أبجد' },
    { id: 'readex', label: 'Readex Pro', family: '"Readex Pro", sans-serif', sample: 'أبجد' },
    { id: 'outfit', label: 'Outfit', family: '"Outfit", sans-serif', sample: 'أبجد' },
    { id: 'playfair', label: 'Playfair', family: '"Playfair Display", serif', sample: 'أبجد' },
    { id: 'montserrat', label: 'Montserrat', family: '"Montserrat", sans-serif', sample: 'أبجد' },
];

/** @type {StudioFontOption[]} */
export const STUDIO_LATIN_FONTS = [
    { id: 'inter', label: 'Inter', family: '"Inter", sans-serif', sample: 'Ag' },
    { id: 'montserrat', label: 'Montserrat', family: '"Montserrat", sans-serif', sample: 'Ag' },
    { id: 'poppins', label: 'Poppins', family: '"Poppins", sans-serif', sample: 'Ag' },
    { id: 'lato', label: 'Lato', family: '"Lato", sans-serif', sample: 'Ag' },
    { id: 'bebas', label: 'Bebas Neue', family: '"Bebas Neue", sans-serif', sample: 'Ag' },
    { id: 'playfair', label: 'Playfair', family: '"Playfair Display", serif', sample: 'Ag' },
];

/** @param {string} [language] */
export function studioFontsForLanguage(language) {
    const isArabic = language === 'ar' || String(language || '').startsWith('ar');
    return isArabic ? STUDIO_ARABIC_FONTS : STUDIO_LATIN_FONTS;
}

/** Rich palette for title & body (horizontal scroll) */
export const STUDIO_TEXT_SWATCHES = [
    '#ffffff',
    '#f8fafc',
    '#e2e8f0',
    '#94a3b8',
    '#000000',
    '#1e293b',
    STUDIO_NEON_PRIMARY,
    STUDIO_NEON_GLOW,
    '#ff5722',
    '#f59e0b',
    '#fde047',
    '#22c55e',
    '#14b8a6',
    '#3b82f6',
    '#6366f1',
    '#8b5cf6',
    '#ec4899',
    '#ef4444',
];

/** Full-width scroll palette for shadow / stroke / glow (effects panel). */
export const STUDIO_FX_COLOR_SWATCHES = [
    ...new Set([...STUDIO_FX_COLORS, ...STUDIO_TEXT_SWATCHES]),
];

/** Backdrop swatches — gradients (shared with featured editor) + transparent */
export const STUDIO_BACKDROP_SWATCHES = ['transparent', ...POST_BACKGROUND_GRADIENT_VALUES];

/** Tint for translucent overlay on top of photo (transparency tool) */
export const STUDIO_OVERLAY_TINTS = [
    'transparent',
    '#000000',
    '#3f4f2e',
    '#4a1942',
    '#0f2744',
    '#ffffff',
    STUDIO_NEON_PRIMARY,
];

/** @param {string} hex @returns {{ r: number, g: number, b: number } | null} */
function parseHexRgb(hex) {
    const raw = String(hex || '').trim().replace(/^#/, '');
    if (!/^[0-9a-f]{3}$|^[0-9a-f]{6}$/i.test(raw)) return null;
    const full =
        raw.length === 3
            ? raw
                  .split('')
                  .map((c) => c + c)
                  .join('')
            : raw;
    const n = parseInt(full, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

/** @param {string} color @param {number} alpha01 0–1 */
export function studioOverlayFill(color, alpha01) {
    if (!color || color === 'transparent' || alpha01 <= 0) return 'transparent';
    const a = Math.min(1, Math.max(0, alpha01));
    const rgb = parseHexRgb(color);
    if (rgb) return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${a})`;
    const pct = Math.round(a * 100);
    return `color-mix(in srgb, ${color} ${pct}%, transparent)`;
}

export const STUDIO_TEXT_VERTICAL_ALIGNS = [
    { id: 'top', labelKey: 'studio_v_align_top', label: 'Top' },
    { id: 'center', labelKey: 'studio_v_align_center', label: 'Center' },
    { id: 'bottom', labelKey: 'studio_v_align_bottom', label: 'Bottom' },
];

/** @param {{ labelKey?: string, display: string }} item @param {(key: string, fallback?: string) => string} t */
export function studioPromoStickerLabel(item, t) {
    if (item.labelKey && typeof t === 'function') {
        return t(item.labelKey, item.display);
    }
    return item.display;
}

export const STUDIO_QUICK_STYLES = [
    {
        id: 'neon-white',
        labelKey: 'studio_quick_neon_white',
        label: 'White',
        patch: { textColor: '#ffffff', subtitleColor: STUDIO_NEON_GLOW, glowIntensity: 35, textShadow: true },
    },
    {
        id: 'neon-orange',
        labelKey: 'studio_quick_neon_orange',
        label: 'Orange',
        patch: { textColor: STUDIO_NEON_PRIMARY, subtitleColor: '#fff', glowIntensity: 45, textShadow: true },
    },
    {
        id: 'glow-amber',
        labelKey: 'studio_quick_glow_amber',
        label: 'Amber',
        patch: { textColor: STUDIO_NEON_GLOW, subtitleColor: '#fff', glowIntensity: 50, textShadow: true },
    },
    {
        id: 'electric-cyan',
        labelKey: 'studio_quick_electric_cyan',
        label: 'Cyan',
        patch: { textColor: '#00f5ff', subtitleColor: '#7df9ff', glowIntensity: 48, textShadow: true },
    },
    {
        id: 'hot-pink',
        labelKey: 'studio_quick_hot_pink',
        label: 'Pink',
        patch: { textColor: '#ff2d95', subtitleColor: '#ffc0eb', glowIntensity: 50, textShadow: true },
    },
    {
        id: 'lime-pop',
        labelKey: 'studio_quick_lime_pop',
        label: 'Lime',
        patch: { textColor: '#ccff00', subtitleColor: '#e8ffc4', glowIntensity: 45, textShadow: true },
    },
    {
        id: 'violet-neon',
        labelKey: 'studio_quick_violet_neon',
        label: 'Violet',
        patch: { textColor: '#b026ff', subtitleColor: '#e0b0ff', glowIntensity: 48, textShadow: true },
    },
    {
        id: 'gold-flash',
        labelKey: 'studio_quick_gold_flash',
        label: 'Gold',
        patch: { textColor: '#ffd700', subtitleColor: '#fff8dc', glowIntensity: 42, textShadow: true },
    },
    {
        id: 'coral-burst',
        labelKey: 'studio_quick_coral_burst',
        label: 'Coral',
        patch: { textColor: '#ff6b6b', subtitleColor: '#ffe0e0', glowIntensity: 44, textShadow: true },
    },
    {
        id: 'mint-glow',
        labelKey: 'studio_quick_mint_glow',
        label: 'Mint',
        patch: { textColor: '#00ff9f', subtitleColor: '#b8ffe8', glowIntensity: 46, textShadow: true },
    },
    {
        id: 'sky-blue',
        labelKey: 'studio_quick_sky_blue',
        label: 'Blue',
        patch: { textColor: '#3b82f6', subtitleColor: '#93c5fd', glowIntensity: 40, textShadow: true },
    },
    {
        id: 'magenta',
        labelKey: 'studio_quick_magenta',
        label: 'Magenta',
        patch: { textColor: '#d946ef', subtitleColor: '#f5d0fe', glowIntensity: 50, textShadow: true },
    },
    {
        id: 'sunset',
        labelKey: 'studio_quick_sunset',
        label: 'Sunset',
        patch: { textColor: '#ff5e3a', subtitleColor: '#ffb347', glowIntensity: 48, textShadow: true },
    },
    {
        id: 'aqua-white',
        labelKey: 'studio_quick_aqua_white',
        label: 'Aqua',
        patch: { textColor: '#ffffff', subtitleColor: '#00e5cc', glowIntensity: 38, textShadow: true },
    },
    {
        id: 'yellow-pop',
        labelKey: 'studio_quick_yellow_pop',
        label: 'Yellow',
        patch: { textColor: '#ffff00', subtitleColor: STUDIO_NEON_PRIMARY, glowIntensity: 52, textShadow: true },
    },
    {
        id: 'neon-mix',
        labelKey: 'studio_quick_neon_mix',
        label: 'Neon',
        patch: { textColor: '#ff00ff', subtitleColor: '#00ffff', glowIntensity: 55, textShadow: true },
    },
    {
        id: 'ruby',
        labelKey: 'studio_quick_ruby',
        label: 'Ruby',
        patch: { textColor: '#e11d48', subtitleColor: '#fda4af', glowIntensity: 45, textShadow: true },
    },
    {
        id: 'contrast',
        labelKey: 'studio_quick_contrast',
        label: 'Contrast',
        patch: { textColor: '#000', subtitleColor: STUDIO_NEON_PRIMARY, backgroundColor: '#fff', glowIntensity: 12 },
    },
    {
        id: 'dark-glass',
        labelKey: 'studio_quick_dark_glass',
        label: 'Glass',
        patch: {
            textColor: '#fff',
            subtitleColor: STUDIO_NEON_GLOW,
            backgroundColor: 'rgba(0,0,0,0.55)',
            glowIntensity: 22,
        },
    },
];

/** @param {StudioLayoutModel} layout */
export function layoutToMotionUi(layout) {
    if (layout === 'story') {
        return {
            postSize: 'vertical',
            aspectRatio: '9:16',
            postTemplateId: 'free_hero_center',
        };
    }
    if (layout === 'header_card') {
        return {
            postSize: 'square',
            aspectRatio: '1:1',
            postTemplateId: 'header_card',
        };
    }
    return {
        postSize: 'square',
        aspectRatio: '1:1',
        postTemplateId: 'free_hero_center',
    };
}

/** @param {StudioLayoutModel} layout */
export function layoutToPreviewAspect(layout) {
    if (layout === 'story') return 'vertical';
    if (layout === 'header_card') return 'header';
    return 'square';
}
