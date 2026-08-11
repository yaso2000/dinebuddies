import { POST_BACKGROUND_GRADIENT_VALUES } from '../../../constants/postBackgroundGradients';

/** @typedef {'square' | 'story' | 'header_card'} StudioLayoutModel */

export const STUDIO_NEON_PRIMARY = '#ff7a00';
export const STUDIO_NEON_GLOW = '#ff9d2e';
export const STUDIO_NEON_BG = '#0f1115';

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

export const STUDIO_TITLE_FONT_SIZE_DEFAULT = 26;
export const STUDIO_BODY_FONT_SIZE_DEFAULT = 18;

export const STUDIO_TEXT_SPACING_DEFAULT = {
    textStackGap: 6,
    textPaddingTop: 0,
    textPaddingBottom: 0,
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

/** Backdrop swatches — gradients (shared with featured editor) + transparent */
export const STUDIO_BACKDROP_SWATCHES = ['transparent', ...POST_BACKGROUND_GRADIENT_VALUES];

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

/** @param {{ labelKey?: string, display: string }} item @param {(key: string, fallback?: string) => string} t */
export function studioPromoStickerLabel(item, t) {
    if (item.labelKey && typeof t === 'function') {
        return t(item.labelKey, item.display);
    }
    return item.display;
}

/** @param {StudioLayoutModel} layout */
export function layoutToPreviewAspect(layout) {
    if (layout === 'story') return 'vertical';
    if (layout === 'header_card') return 'header';
    return 'square';
}
