/** Shared app + i18n language metadata (matches src/i18n.js supportedLngs). */
export const APP_LANGUAGES = [
    { code: 'en', name: 'English', nativeName: 'English', flag: '🇬🇧', rtl: false },
    { code: 'ar', name: 'Arabic', nativeName: 'العربية', flag: '🇸🇦', rtl: true },
    { code: 'fr', name: 'French', nativeName: 'Français', flag: '🇫🇷', rtl: false },
    { code: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸', rtl: false },
    { code: 'ur', name: 'Urdu', nativeName: 'اردو', flag: '🇵🇰', rtl: true },
    { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', flag: '🇮🇳', rtl: false },
];

export const SUPPORTED_APP_LANGUAGE_CODES = APP_LANGUAGES.map((l) => l.code);

/**
 * @param {string} [lang]
 * @returns {'en' | 'ar' | 'fr' | 'es' | 'ur' | 'hi'}
 */
export function normalizeAppLanguage(lang) {
    const raw = String(lang || 'en')
        .trim()
        .toLowerCase()
        .split('-')[0];
    if (SUPPORTED_APP_LANGUAGE_CODES.includes(raw)) {
        return /** @type {'en' | 'ar' | 'fr' | 'es' | 'ur' | 'hi'} */ (raw);
    }
    return 'en';
}

/** @param {string} [lang] */
export function isRtlLanguage(lang) {
    const code = normalizeAppLanguage(lang);
    return code === 'ar' || code === 'ur';
}

/** @param {string} [lang] */
export function languageDisplayLabel(lang) {
    const code = normalizeAppLanguage(lang);
    const row = APP_LANGUAGES.find((l) => l.code === code);
    return row?.nativeName || row?.name || 'English';
}
