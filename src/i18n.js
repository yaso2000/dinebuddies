import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import en from './locales/en.json';
import { applyHtmlLanguage } from './utils/authGeoLanguage';

const SUPPORTED_LNGS = ['en', 'ar', 'fr', 'es', 'it', 'de', 'pt', 'tr', 'ur', 'hi'];

/**
 * Only the active language JSON is fetched on demand, so the main bundle ships
 * English (the fallback) only instead of all 10 locale files.
 */
const localeLoaders = {
    ar: () => import('./locales/ar.json'),
    fr: () => import('./locales/fr.json'),
    es: () => import('./locales/es.json'),
    it: () => import('./locales/it.json'),
    de: () => import('./locales/de.json'),
    pt: () => import('./locales/pt.json'),
    tr: () => import('./locales/tr.json'),
    ur: () => import('./locales/ur.json'),
    hi: () => import('./locales/hi.json'),
};

const loadedLngs = new Set(['en']);

function baseLng(lng) {
    return String(lng || '').toLowerCase().split('-')[0];
}

async function ensureLanguageLoaded(lng) {
    const code = baseLng(lng);
    if (!code || loadedLngs.has(code)) return;
    const loader = localeLoaders[code];
    if (!loader) return;
    try {
        const mod = await loader();
        i18n.addResourceBundle(code, 'translation', mod.default || mod, true, true);
        loadedLngs.add(code);
        // Re-apply so components re-render with the freshly loaded bundle.
        if (baseLng(i18n.language) === code) {
            i18n.changeLanguage(code);
        }
    } catch (err) {
        console.warn('[i18n] failed to load locale', code, err);
    }
}

i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
        resources: {
            en: { translation: en },
        },
        supportedLngs: SUPPORTED_LNGS,
        fallbackLng: 'en',
        load: 'languageOnly',
        detection: {
            order: ['localStorage', 'navigator', 'htmlTag', 'path', 'subdomain'],
            caches: ['localStorage'],
        },
        debug: false,
        interpolation: {
            escapeValue: false,
        },
        react: {
            // Avoid suspending route content until i18n resolves (can interact badly with Router + Suspense).
            useSuspense: false,
        },
    });

i18n.on('initialized', () => {
    const lng = i18n.language || 'en';
    applyHtmlLanguage(lng);
    ensureLanguageLoaded(lng);
});
i18n.on('languageChanged', (lng) => {
    applyHtmlLanguage(lng);
    ensureLanguageLoaded(lng);
});

export default i18n;
