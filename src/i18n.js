import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import en from './locales/en.json';
import ar from './locales/ar.json';
import fr from './locales/fr.json';
import es from './locales/es.json';
import ur from './locales/ur.json';
import hi from './locales/hi.json';

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
        fallbackLng: 'en',
        debug: false,
        interpolation: {
            escapeValue: false,
        }
    });

export default i18n;
