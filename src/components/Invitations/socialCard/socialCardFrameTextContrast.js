/**
 * Frame palette colors are tuned for light surfaces. On dark template art, the same
 * values read as low-contrast / “washed”. Lift toward light tints while keeping hue.
 */

const RGBA_RE =
    /^rgba?\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)(?:\s*,\s*([0-9.]+))?\s*\)$/i;
const HEX_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

/** sRGB relative luminance (WCAG), 0–1 */
function relativeLuminance(r, g, b) {
    const [R, G, B] = [r, g, b].map((c) => {
        const x = c / 255;
        return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

function clamp01(x) {
    return Math.min(1, Math.max(0, x));
}

/**
 * @param {string} css
 * @returns {{ r: number, g: number, b: number, a: number }}
 */
export function parseCssColorToRgb(css) {
    const s = String(css || '').trim();
    if (!s) return { r: 255, g: 255, b: 255, a: 1 };

    const m = s.match(RGBA_RE);
    if (m) {
        const r = Math.min(255, Math.max(0, Math.round(Number(m[1]))));
        const g = Math.min(255, Math.max(0, Math.round(Number(m[2]))));
        const b = Math.min(255, Math.max(0, Math.round(Number(m[3]))));
        const a = m[4] !== undefined ? clamp01(Number(m[4])) : 1;
        return { r, g, b, a: Number.isFinite(a) ? a : 1 };
    }

    const hm = s.match(HEX_RE);
    if (hm) {
        let h = hm[1];
        if (h.length === 3) {
            h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
        }
        const n = parseInt(h, 16);
        return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: 1 };
    }

    return { r: 255, g: 255, b: 255, a: 1 };
}

function mixTowardWhite(r, g, b, t) {
    const k = clamp01(t);
    return [
        Math.round(r + (255 - r) * k),
        Math.round(g + (255 - g) * k),
        Math.round(b + (255 - b) * k)
    ];
}

/**
 * Target ~WCAG-friendly lightness on dark artwork while keeping the frame’s hue.
 * @param {string} cssColor — hex, rgb, or rgba from frame palette
 * @returns {string} `rgb()` or `rgba()` string
 */
export function adjustFrameTextForDarkTemplate(cssColor) {
    const { r, g, b, a } = parseCssColorToRgb(cssColor);
    const L = relativeLuminance(r, g, b);

    // Already light enough on a dark photo
    if (L >= 0.5) {
        const alpha = Math.min(1, Math.max(a, 0.92));
        if (alpha >= 0.999) return `rgb(${r}, ${g}, ${b})`;
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    // How much we need to pull toward white (very dark colors need stronger lift)
    const deficit = 0.52 - L;
    const t = Math.min(0.92, 0.38 + Math.max(0, deficit) * 1.35);
    const [nr, ng, nb] = mixTowardWhite(r, g, b, t);
    const outA = Math.min(1, Math.max(a, 0.96));
    if (outA >= 0.999) return `rgb(${nr}, ${ng}, ${nb})`;
    return `rgba(${nr}, ${ng}, ${nb}, ${outA})`;
}

/** Soft halation on busy dark imagery */
export const DARK_TEMPLATE_TEXT_SHADOW =
    '0 1px 2px rgba(0, 0, 0, 0.65), 0 0 18px rgba(0, 0, 0, 0.35)';

/** Readable copy on photo / hero backgrounds (templates and user media). */
export const PHOTO_BACKGROUND_TEXT_SHADOW =
    '0 1px 2px rgba(0, 0, 0, 0.62), 0 2px 14px rgba(0, 0, 0, 0.42)';
