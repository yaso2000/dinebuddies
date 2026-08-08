/** Vertical position: steps × step = % translateY on the text stack. */
export const DEFAULT_CARD_COPY_OFFSET_Y = 0;
export const CARD_COPY_OFFSET_STEP = 1;
/** Extra upward travel vs original −10% cap (~20 more steps). */
export const CARD_COPY_OFFSET_MIN = -30;
export const CARD_COPY_OFFSET_MAX = 10;

/** Copy column width as % of card width. */
export const DEFAULT_CARD_COPY_WIDTH_PCT = 78;
export const CARD_COPY_WIDTH_STEP = 4;
export const CARD_COPY_WIDTH_MIN = 52;
export const CARD_COPY_WIDTH_MAX = 94;

export function clampCardCopyOffsetY(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return DEFAULT_CARD_COPY_OFFSET_Y;
    return Math.min(CARD_COPY_OFFSET_MAX, Math.max(CARD_COPY_OFFSET_MIN, Math.round(n)));
}

export function clampCardCopyWidthPct(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return DEFAULT_CARD_COPY_WIDTH_PCT;
    return Math.min(CARD_COPY_WIDTH_MAX, Math.max(CARD_COPY_WIDTH_MIN, Math.round(n)));
}

/** @param {number} steps */
export function cardCopyOffsetToCssPercent(steps) {
    return `${clampCardCopyOffsetY(steps) * CARD_COPY_OFFSET_STEP}%`;
}

/** Font scale steps — multiplier on title + message (1 step ≈ 4% size). */
export const DEFAULT_CARD_COPY_FONT_SCALE = 0;
export const CARD_COPY_FONT_SCALE_STEP = 0.04;
export const CARD_COPY_FONT_SCALE_MIN = -8;
export const CARD_COPY_FONT_SCALE_MAX = 12;

export function clampCardCopyFontScale(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return DEFAULT_CARD_COPY_FONT_SCALE;
    return Math.min(CARD_COPY_FONT_SCALE_MAX, Math.max(CARD_COPY_FONT_SCALE_MIN, Math.round(n)));
}

/** @param {number} steps */
export function cardCopyFontScaleToMultiplier(steps) {
    const clamped = clampCardCopyFontScale(steps);
    return 1 + clamped * CARD_COPY_FONT_SCALE_STEP;
}
