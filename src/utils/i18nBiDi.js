import { formatBiDiText } from './formatBiDiText';

/**
 * i18n translate + BiDi punctuation guard (Phase 5).
 * Use when rendering translated strings outside <AppText> (e.g. attributes, canvas).
 *
 * @param {import('i18next').TFunction} t
 * @param {string} key
 * @param {import('i18next').TOptions} [options]
 */
export function tb(t, key, options) {
    return formatBiDiText(t(key, options));
}

export { formatBiDiText, formatBiDiChildren, containsArabicScript, htmlBiDiText, htmlBiDiBlock, escapeHtmlText } from './formatBiDiText';
