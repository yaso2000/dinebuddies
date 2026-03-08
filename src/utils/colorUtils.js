/**
 * colorUtils.js
 * Smart color contrast utilities for Brand Kit
 */

/**
 * Calculate the WCAG relative luminance of a hex color.
 * Returns a value between 0 (black) and 1 (white).
 */
function getLuminance(hex) {
    // Strip # and handle short hex (#fff → #ffffff)
    const clean = hex.replace('#', '');
    const full = clean.length === 3
        ? clean.split('').map(c => c + c).join('')
        : clean;

    const r = parseInt(full.slice(0, 2), 16) / 255;
    const g = parseInt(full.slice(2, 4), 16) / 255;
    const b = parseInt(full.slice(4, 6), 16) / 255;

    // WCAG sRGB linearization
    const toLinear = c => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

/**
 * Returns the best readable text color ('#ffffff' or '#1a1a1a')
 * for a given background hex color, based on WCAG contrast ratio.
 *
 * @param {string} hex - Background color in hex format (e.g. '#a78bfa')
 * @returns {string} '#ffffff' or '#1a1a1a'
 */
export function getContrastText(hex) {
    if (!hex || !hex.startsWith('#')) return '#ffffff';
    try {
        const lum = getLuminance(hex);
        // WCAG threshold: white text on dark bg, dark text on light bg
        return lum > 0.35 ? '#1a1a1a' : '#ffffff';
    } catch {
        return '#ffffff';
    }
}

/**
 * Returns a readable text color for use ON TOP OF a semi-transparent
 * overlay of `hex` color (e.g. badgeBg = hex + '22').
 * Since the overlay is faint, we test against the base color instead.
 */
export function getContrastTextForBadge(hex) {
    return getContrastText(hex);
}
