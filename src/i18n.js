import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import en from './locales/en.json';
import ar from './locales/ar.json';
import fr from './locales/fr.json';
import es from './locales/es.json';
import ur from './locales/ur.json';
import hi from './locales/hi.json';
import { applyHtmlLanguage } from './utils/authGeoLanguage';

i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
        resources: {
            en: { translation: en },
            ar: { translation: ar },
            fr: { translation: fr },
            es: { translation: es },
            ur: { translation: ur },
            hi: { translation: hi }
        },
        supportedLngs: ['en', 'ar', 'fr', 'es', 'ur', 'hi'],
        fallbackLng: 'en',
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
    applyHtmlLanguage(i18n.language || 'en');
});
i18n.on('languageChanged', (lng) => {
    applyHtmlLanguage(lng);
});

export default i18n;
