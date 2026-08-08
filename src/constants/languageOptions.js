/** Supported app UI languages — shared by Settings + LanguageSettings. */
export const LANGUAGE_OPTIONS = [
    {
        code: 'en',
        nameKey: 'language_name_english',
        nativeKey: 'language_native_english',
        flag: '🇬🇧',
    },
    {
        code: 'es',
        nameKey: 'language_name_spanish',
        nativeKey: 'language_native_spanish',
        flag: '🇪🇸',
    },
    {
        code: 'fr',
        nameKey: 'language_name_french',
        nativeKey: 'language_native_french',
        flag: '🇫🇷',
    },
    {
        code: 'it',
        nameKey: 'language_name_italian',
        nativeKey: 'language_native_italian',
        flag: '🇮🇹',
    },
    {
        code: 'de',
        nameKey: 'language_name_german',
        nativeKey: 'language_native_german',
        flag: '🇩🇪',
    },
    {
        code: 'pt',
        nameKey: 'language_name_portuguese',
        nativeKey: 'language_native_portuguese',
        flag: '🇧🇷',
    },
    {
        code: 'tr',
        nameKey: 'language_name_turkish',
        nativeKey: 'language_native_turkish',
        flag: '🇹🇷',
    },
    {
        code: 'ar',
        nameKey: 'language_name_arabic',
        nativeKey: 'language_native_arabic',
        flag: '🇸🇦',
    },
];

/** @param {string | undefined | null} i18nLanguage */
export function resolveLanguageCode(i18nLanguage) {
    const base = String(i18nLanguage || 'en').split('-')[0];
    return LANGUAGE_OPTIONS.some((l) => l.code === base) ? base : 'en';
}

/** @param {string | undefined | null} code */
export function getLanguageOption(code) {
    const resolved = resolveLanguageCode(code);
    return LANGUAGE_OPTIONS.find((l) => l.code === resolved) || LANGUAGE_OPTIONS[0];
}

/** @param {string | undefined | null} code */
export function getLanguageFlag(code) {
    return getLanguageOption(code).flag;
}

/** @param {string | undefined | null} code @param {(key: string, fallback?: string) => string} t */
export function getLanguageNativeLabel(code, t) {
    const opt = getLanguageOption(code);
    const fallbacks = {
        en: 'English',
        es: 'Español',
        fr: 'Français',
        it: 'Italiano',
        de: 'Deutsch',
        pt: 'Português',
        tr: 'Türkçe',
        ar: 'العربية',
    };
    return t(opt.nativeKey, fallbacks[opt.code] || opt.code);
}
