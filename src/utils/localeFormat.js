/**
 * Locale-aware dates, times, and numbers — RTL UI with LTR digits/dates where needed.
 */

/**
 * @param {string | undefined} language i18n language code
 * @returns {string | undefined} BCP 47 locale for Intl
 */
export function getIntlLocale(language) {
    const lang = String(language || 'en').toLowerCase();
    if (lang.startsWith('ar')) return 'ar-u-nu-latn';
    if (lang.startsWith('es')) return 'es';
    if (lang.startsWith('it')) return 'it';
    if (lang.startsWith('de')) return 'de';
    if (lang.startsWith('pt')) return 'pt';
    if (lang.startsWith('tr')) return 'tr';
    if (lang.startsWith('fr')) return 'fr';
    if (lang.startsWith('en')) return 'en';
    return lang.split('-')[0] || 'en';
}

/**
 * @param {Date | string | number | undefined} value
 * @param {string | undefined} language
 * @param {Intl.DateTimeFormatOptions} [options]
 */
export function formatAppDate(value, language, options = {}) {
    if (value == null || value === '') return '';
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString(getIntlLocale(language), {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        ...options,
    });
}

/**
 * @param {Date | string | number | undefined} value
 * @param {string | undefined} language
 * @param {Intl.DateTimeFormatOptions} [options]
 */
export function formatAppTime(value, language, options = {}) {
    if (value == null || value === '') return '';
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleTimeString(getIntlLocale(language), {
        hour: '2-digit',
        minute: '2-digit',
        ...options,
    });
}

/**
 * @param {number | string | undefined} value
 * @param {string | undefined} language
 * @param {Intl.NumberFormatOptions} [options]
 */
export function formatAppNumber(value, language, options = {}) {
    const n = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(n)) return '';
    return new Intl.NumberFormat(getIntlLocale(language), options).format(n);
}

/** Props for spans showing dates, times, phone numbers, codes (always LTR). */
export const LTR_ISOLATE_PROPS = {
    dir: 'ltr',
    style: { unicodeBidi: 'isolate' },
};
