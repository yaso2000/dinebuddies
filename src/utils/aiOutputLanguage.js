/**
 * Supported AI output languages — keep in sync with i18n supportedLngs.
 * @typedef {'ar' | 'en' | 'fr' | 'es' | 'it' | 'de' | 'pt' | 'tr' | 'ur' | 'hi'} AiOutputLanguageCode
 */

/** @type {readonly AiOutputLanguageCode[]} */
export const AI_OUTPUT_LANGUAGE_CODES = Object.freeze([
    'ar',
    'en',
    'fr',
    'es',
    'it',
    'de',
    'pt',
    'tr',
    'ur',
    'hi',
]);

/** English labels for Gemini system prompts. */
export const AI_OUTPUT_LANGUAGE_LABELS = Object.freeze({
    ar: 'Arabic',
    en: 'English',
    fr: 'French',
    es: 'Spanish',
    it: 'Italian',
    de: 'German',
    pt: 'Portuguese',
    tr: 'Turkish',
    ur: 'Urdu',
    hi: 'Hindi',
});

/** Example private-card greetings per locale (for system instructions). */
export const AI_DATING_GREETING_EXAMPLES = Object.freeze({
    ar: 'مرحباً [الاسم]، or أهلاً [الاسم]،',
    ur: 'سلام [نام]،',
    hi: 'नमस्ते [नाम],',
    fr: 'Bonjour [Name],',
    es: 'Hola [Name],',
    it: 'Ciao [Name],',
    de: 'Hallo [Name],',
    pt: 'Olá [Name],',
    tr: 'Merhaba [Name],',
    en: 'Hi [Name],',
});

/**
 * Normalize app i18n language to AI output language code.
 * @param {string | undefined} language
 * @returns {AiOutputLanguageCode}
 */
export function normalizeAiOutputLanguage(language) {
    const lang = String(language || 'en').toLowerCase();
    if (lang.startsWith('ar')) return 'ar';
    if (lang.startsWith('fr')) return 'fr';
    if (lang.startsWith('es')) return 'es';
    if (lang.startsWith('it')) return 'it';
    if (lang.startsWith('de')) return 'de';
    if (lang.startsWith('pt')) return 'pt';
    if (lang.startsWith('tr')) return 'tr';
    if (lang.startsWith('ur')) return 'ur';
    if (lang.startsWith('hi')) return 'hi';
    return 'en';
}

/**
 * @param {string | undefined} code
 * @returns {string}
 */
export function getAiOutputLanguageLabel(code) {
    const normalized = normalizeAiOutputLanguage(code);
    return AI_OUTPUT_LANGUAGE_LABELS[normalized] || AI_OUTPUT_LANGUAGE_LABELS.en;
}

/**
 * @param {string | undefined} code
 * @returns {string}
 */
export function getAiDatingGreetingExample(code) {
    const normalized = normalizeAiOutputLanguage(code);
    return AI_DATING_GREETING_EXAMPLES[normalized] || AI_DATING_GREETING_EXAMPLES.en;
}

/** @param {string | undefined} language */
export function isArabicAiOutput(language) {
    return normalizeAiOutputLanguage(language) === 'ar';
}

/** @param {string | undefined} language */
export function isRtlAiOutput(language) {
    const code = normalizeAiOutputLanguage(language);
    return code === 'ar' || code === 'ur';
}

/**
 * @param {unknown} value
 * @returns {AiOutputLanguageCode}
 */
export function pickAiOutputLanguage(value) {
    const normalized = normalizeAiOutputLanguage(typeof value === 'string' ? value : '');
    return AI_OUTPUT_LANGUAGE_CODES.includes(normalized) ? normalized : 'en';
}
