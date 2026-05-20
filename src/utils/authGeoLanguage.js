/** ISO country codes where Arabic is the default UI language on auth pages. */
const ARABIC_COUNTRY_CODES = new Set([
    'SA', 'AE', 'KW', 'QA', 'BH', 'OM', 'YE', 'IQ', 'SY', 'JO', 'LB', 'PS', 'EG', 'LY', 'TN', 'DZ', 'MA',
    'SD', 'MR', 'SO', 'DJ', 'KM', 'TD', 'ER', 'EH', 'SS',
]);

export function languageForCountryCode(countryCode) {
    const cc = String(countryCode || '')
        .trim()
        .toUpperCase()
        .slice(0, 2);
    if (ARABIC_COUNTRY_CODES.has(cc)) return 'ar';
    return 'en';
}

export function applyHtmlLanguage(lang) {
    const lc = lang === 'ar' ? 'ar' : 'en';
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

    if (i18n.language === lang) {
        applyHtmlLanguage(lang);
        return;
    }
    await i18n.changeLanguage(lang);
    applyHtmlLanguage(lang);
}
