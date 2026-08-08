/** ISO country codes where Arabic is the default UI language on auth pages. */
const ARABIC_COUNTRY_CODES = new Set([
    'SA', 'AE', 'KW', 'QA', 'BH', 'OM', 'YE', 'IQ', 'SY', 'JO', 'LB', 'PS', 'EG', 'LY', 'TN', 'DZ', 'MA',
    'SD', 'MR', 'SO', 'DJ', 'KM', 'TD', 'ER', 'EH', 'SS',
]);

/** ISO country codes where French is the default UI language on auth pages. */
const FRENCH_COUNTRY_CODES = new Set([
    'FR', 'BE', 'CH', 'LU', 'MC', 'SN', 'CI', 'ML', 'BF', 'NE', 'TG', 'BJ', 'GA', 'CG', 'CD', 'CM', 'MG',
    'HT', 'RW', 'BI', 'TD', 'CF', 'GN', 'MR', 'DJ', 'KM', 'SC', 'VU', 'NC', 'PF', 'RE', 'GP', 'MQ', 'GF',
]);

/** ISO country codes where Spanish is the default UI language on auth pages. */
const SPANISH_COUNTRY_CODES = new Set([
    'ES', 'MX', 'AR', 'CO', 'CL', 'PE', 'VE', 'EC', 'GT', 'CU', 'BO', 'DO', 'HN', 'PY', 'SV', 'NI', 'CR', 'PA',
    'UY', 'PR', 'GQ', 'US',
]);

/** ISO country codes where Italian is the default UI language on auth pages. */
const ITALIAN_COUNTRY_CODES = new Set(['IT', 'SM', 'VA']);

/** ISO country codes where German is the default UI language on auth pages. */
const GERMAN_COUNTRY_CODES = new Set(['DE', 'AT', 'LI']);

/** ISO country codes where Portuguese is the default UI language on auth pages. */
const PORTUGUESE_COUNTRY_CODES = new Set(['BR', 'PT', 'AO', 'MZ', 'CV', 'GW', 'ST', 'TL']);

/** ISO country codes where Turkish is the default UI language on auth pages. */
const TURKISH_COUNTRY_CODES = new Set(['TR']);

export function languageForCountryCode(countryCode) {
    const cc = String(countryCode || '')
        .trim()
        .toUpperCase()
        .slice(0, 2);
    if (ARABIC_COUNTRY_CODES.has(cc)) return 'ar';
    if (FRENCH_COUNTRY_CODES.has(cc)) return 'fr';
    if (SPANISH_COUNTRY_CODES.has(cc)) return 'es';
    if (ITALIAN_COUNTRY_CODES.has(cc)) return 'it';
    if (GERMAN_COUNTRY_CODES.has(cc)) return 'de';
    if (PORTUGUESE_COUNTRY_CODES.has(cc)) return 'pt';
    if (TURKISH_COUNTRY_CODES.has(cc)) return 'tr';
    if (cc === 'CH') return 'de';
    return 'en';
}

export function resolveUiLanguageCode(lang) {
    const raw = String(lang || 'en').toLowerCase();
    if (raw.startsWith('ar')) return 'ar';
    if (raw.startsWith('fr')) return 'fr';
    if (raw.startsWith('es')) return 'es';
    if (raw.startsWith('it')) return 'it';
    if (raw.startsWith('de')) return 'de';
    if (raw.startsWith('pt')) return 'pt';
    if (raw.startsWith('tr')) return 'tr';
    return 'en';
}

export function applyHtmlLanguage(lang) {
    const lc = resolveUiLanguageCode(lang);
    document.documentElement.dir = lc === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = lc;
}

/**
 * Best-effort country for language default (IP → browser locale).
 * @returns {Promise<string>} ISO-3166 alpha-2 or ''
 */
export async function detectCountryCodeForLanguage() {
    try {
        const { fetchIpLocation } = await import('./locationUtils');
        const ip = await fetchIpLocation();
        const cc = String(ip?.country_code || '').trim().toUpperCase().slice(0, 2);
        if (cc.length === 2) return cc;
    } catch {
        /* ignore */
    }
    return '';
}

/**
 * On auth pages: pick ar/en from geography unless the user already chose a language in settings.
 * @param {import('i18next').i18n} i18n
 */
export async function applyAuthGeoLanguage(i18n) {
    try {
        if (localStorage.getItem('language')) return;
    } catch {
        /* ignore */
    }

    const cc = await detectCountryCodeForLanguage();
    let lang = languageForCountryCode(cc);
    const nav = String(navigator?.language || '').toLowerCase();
    if (!cc && nav.startsWith('ar')) lang = 'ar';
    else if (!cc && nav.startsWith('fr')) lang = 'fr';
    else if (!cc && nav.startsWith('es')) lang = 'es';
    else if (!cc && nav.startsWith('it')) lang = 'it';
    else if (!cc && nav.startsWith('de')) lang = 'de';
    else if (!cc && nav.startsWith('pt')) lang = 'pt';
    else if (!cc && nav.startsWith('tr')) lang = 'tr';

    if (i18n.language === lang) {
        applyHtmlLanguage(lang);
        return;
    }
    await i18n.changeLanguage(lang);
    applyHtmlLanguage(lang);
}
