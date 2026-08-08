/** @typedef {'solid' | 'rainbow'} StudioTextColorMode */
/** @typedef {'kids' | 'candy' | 'neon'} StudioRainbowPreset */

export const STUDIO_RAINBOW_PRESETS = {
    kids: ['#ff3131', '#ff9f1a', '#ffe600', '#2ee85b', '#00b4ff', '#7c3aed', '#ff2d95', '#00e5a0'],
    candy: ['#f43f5e', '#fb923c', '#facc15', '#4ade80', '#38bdf8', '#a78bfa', '#f472b6', '#34d399'],
    neon: ['#ff0055', '#ff7a00', '#ffee00', '#00ff88', '#00f0ff', '#8b5cf6', '#ff00ff', '#39ff14'],
};

const ARABIC_SCRIPT_RE =
    /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;

/** True when text uses Arabic script (connected letters). */
export function containsArabicScript(text) {
    return ARABIC_SCRIPT_RE.test(String(text || ''));
}

/** Split into user-perceived characters (Latin emoji etc.). */
export function splitGraphemes(text) {
    const s = String(text || '');
    if (typeof Intl !== 'undefined' && Intl.Segmenter) {
        try {
            const seg = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
            return [...seg.segment(s)].map((x) => x.segment);
        } catch {
            /* fall through */
        }
    }
    return [...s];
}

/**
 * Rainbow segments: whole words for Arabic (keeps joining + one outline per word),
 * per-grapheme for other scripts.
 * @returns {{ segment: string; isSpace: boolean }[]}
 */
export function splitRainbowSegments(text) {
    const s = String(text || '');
    if (!s) return [];

    if (containsArabicScript(s)) {
        return s.split(/(\s+)/).filter((part) => part.length > 0).map((segment) => ({
            segment,
            isSpace: /^\s+$/.test(segment),
        }));
    }

    return splitGraphemes(s).map((segment) => ({
        segment,
        isSpace: segment === ' ' || segment === '\u00a0',
    }));
}

/** Light word outline (8 directions — readable on similar bg/text colors). */
function strokeOutlineShadows(w, color) {
    const width = Math.min(2, Math.max(1, Math.round(w)));
    const dirs =
        width <= 1
            ? [
                  [-1, 0],
                  [1, 0],
                  [0, -1],
                  [0, 1],
                  [-1, -1],
                  [-1, 1],
                  [1, -1],
                  [1, 1],
              ]
            : [
                  [-2, 0],
                  [2, 0],
                  [0, -2],
                  [0, 2],
                  [-1, -1],
                  [-1, 1],
                  [1, -1],
                  [1, 1],
                  [-2, -1],
                  [-2, 1],
                  [2, -1],
                  [2, 1],
              ];
    return dirs.map(([dx, dy]) => `${dx}px ${dy}px 0 ${color}`);
}

/** @param {number} index @param {StudioRainbowPreset} [preset] */
export function rainbowColorAt(index, preset = 'kids') {
    const palette = STUDIO_RAINBOW_PRESETS[preset] || STUDIO_RAINBOW_PRESETS.kids;
    return palette[((index % palette.length) + palette.length) % palette.length];
}

/**
 * @param {Record<string, unknown>} style
 * @param {string} [accentColor]
 */
function hexToRgba(hex, alpha) {
    const h = String(hex || '#000000').replace('#', '');
    const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h.slice(0, 6);
    const n = parseInt(full, 16);
    if (Number.isNaN(n)) return `rgba(0,0,0,${alpha})`;
    const r = (n >> 16) & 255;
    const g = (n >> 8) & 255;
    const b = n & 255;
    return `rgba(${r},${g},${b},${alpha})`;
}

/**
 * Shadow, glow, and word-level stroke outline (merged text-shadow — Arabic-safe).
 * @param {Record<string, unknown>} style
 * @param {string} [accentColor]
 */
export function studioBuildTextShadow(style, accentColor) {
    const parts = [];

    if (style.textStroke) {
        const w = Number(style.strokeWidth ?? 2);
        const color = String(style.strokeColor || '#000000');
        parts.push(...strokeOutlineShadows(w, color));
    }

    if (style.textShadow !== false) {
        const blur = Number(style.shadowBlur ?? 14);
        const offX = Number(style.shadowOffsetX ?? 0);
        const offY = Number(style.shadowOffsetY ?? 4);
        const alpha = Math.min(1, Math.max(0, Number(style.shadowDepth ?? 55) / 100));
        const raw = String(style.shadowColor || '#000000');
        const shadowCol = raw.startsWith('#') ? hexToRgba(raw, alpha) : raw;
        parts.push(`${offX}px ${offY}px ${blur}px ${shadowCol}`);
    }
    const glow = Number(style.glowIntensity ?? 0);
    const glowCol = String(style.glowColor || accentColor || '');
    if (glow > 0 && glowCol) {
        const px = Math.round(glow * 0.45);
        parts.push(`0 0 ${px}px ${glowCol}`, `0 0 ${Math.round(px * 1.6)}px ${glowCol}88`);
    }
    return parts.length ? parts.join(', ') : undefined;
}

/** @deprecated Use studioBuildTextShadow — stroke is merged there for whole-word outline. */
export function studioBuildTextStroke(style) {
    if (!style.textStroke) return {};
    return { textShadow: studioBuildTextShadow({ ...style, textShadow: false }, undefined) };
}

/**
 * @param {Record<string, unknown>} style
 * @param {'title' | 'body'} layer
 */
export function studioLayerColorMode(style, layer) {
    if (layer === 'title') {
        return style.titleColorMode === 'rainbow' ? 'rainbow' : 'solid';
    }
    return style.bodyColorMode === 'rainbow' ? 'rainbow' : 'solid';
}

/** @param {Record<string, unknown>} style */
export function studioRainbowPresetId(style) {
    const p = String(style.rainbowPreset || 'kids');
    return p === 'candy' || p === 'neon' ? p : 'kids';
}
