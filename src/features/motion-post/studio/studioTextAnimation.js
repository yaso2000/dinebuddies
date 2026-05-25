/** @typedef {'fade' | 'slide' | 'pop' | 'stagger' | 'zoom'} StudioTextAnimationId */

/** Strong entrance presets for Smart Post Studio (also used on publish). */
export const STUDIO_TEXT_ANIMATIONS = [
    { id: 'fade', labelKey: 'studio_anim_fade', label: 'ظهور' },
    { id: 'slide', labelKey: 'studio_anim_slide', label: 'انزلاق' },
    { id: 'pop', labelKey: 'studio_anim_pop', label: 'قفزة' },
    { id: 'stagger', labelKey: 'studio_anim_stagger', label: 'متتابع' },
    { id: 'zoom', labelKey: 'studio_anim_zoom', label: 'تكبير' },
];

export const STUDIO_ANIM_DURATION_MS = 1500;
export const STUDIO_ANIM_SLIDE_PX = 36;
export const STUDIO_ANIM_BODY_DELAY_MS = 260;

/** @param {string} id @returns {StudioTextAnimationId} */
export function normalizeStudioTextAnimation(id) {
    const v = String(id || '').trim();
    return STUDIO_TEXT_ANIMATIONS.some((a) => a.id === v) ? /** @type {StudioTextAnimationId} */ (v) : 'slide';
}

/**
 * Inline styles for live preview text entrance (strong motion).
 * @param {StudioTextAnimationId} animation
 * @param {number} delayMs
 * @returns {import('react').CSSProperties}
 */
export function studioTextAnimStyle(animation, delayMs = 0) {
    const durationMs = STUDIO_ANIM_DURATION_MS;
    const slidePx = STUDIO_ANIM_SLIDE_PX;
    const base = `${durationMs}ms cubic-bezier(0.22, 1, 0.36, 1) forwards`;
    const delayed = { animationDelay: `${delayMs}ms` };
    const y = Math.max(8, slidePx);

    if (animation === 'fade') {
        return { opacity: 0, animation: `spsAnimFadeIn ${base}`, ...delayed };
    }
    if (animation === 'slide') {
        return {
            opacity: 0,
            transform: `translateY(${y}px)`,
            animation: `spsAnimSlideUp ${base}`,
            ...delayed,
        };
    }
    if (animation === 'pop') {
        return {
            opacity: 0,
            transform: 'scale(0.72)',
            animation: `spsAnimPopIn ${base}`,
            ...delayed,
        };
    }
    if (animation === 'zoom') {
        return {
            opacity: 0,
            transform: 'scale(0.5)',
            animation: `spsAnimZoomIn ${base}`,
            ...delayed,
        };
    }
    return {
        opacity: 0,
        transform: `translateY(${Math.round(y * 0.7)}px)`,
        animation: `spsAnimSlideUp ${base}`,
        ...delayed,
    };
}
