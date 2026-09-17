/**
 * Age categories (single source of truth). Members choose one at profile completion;
 * it is never shown publicly. `16-17` marks a minor — see `isMinorAgeCategory`.
 */
export const AGE_CATEGORY_IDS = ['16-17', '18-24', '25-34', '35-44', '45-54', '55+'];

export const AGE_CATEGORY_OPTIONS = AGE_CATEGORY_IDS.map((id) => ({ value: id, label: id, id }));

export const MINOR_AGE_CATEGORY = '16-17';

/** @param {unknown} ageCategory */
export function isMinorAgeCategory(ageCategory) {
    return String(ageCategory || '').trim() === MINOR_AGE_CATEGORY;
}

/** @param {{ ageCategory?: unknown, age_category?: unknown } | null | undefined} user */
export function isMinorUser(user) {
    if (!user) return false;
    return isMinorAgeCategory(user.ageCategory ?? user.age_category);
}

/** Legacy numeric age derived from a category (lower bound). */
export function ageFromCategory(ageCategory) {
    const first = String(ageCategory || '').split('-')[0].replace(/\D/g, '');
    return parseInt(first, 10) || 18;
}

/** Numeric age → category id. */
export function categoryFromAge(n) {
    if (!Number.isFinite(n)) return '';
    if (n < 18) return '16-17';
    if (n < 25) return '18-24';
    if (n < 35) return '25-34';
    if (n < 45) return '35-44';
    if (n < 55) return '45-54';
    return '55+';
}
