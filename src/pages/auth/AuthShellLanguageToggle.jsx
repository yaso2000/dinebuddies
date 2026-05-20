import React from 'react';
import { useTranslation } from 'react-i18next';
import { applyHtmlLanguage } from '../../utils/authGeoLanguage';

/** Compact EN / AR switch for auth shells (persists user override). */
export default function AuthShellLanguageToggle({ className = '' }) {
    const { i18n, t } = useTranslation();
    const current = i18n.language?.startsWith('ar') ? 'ar' : 'en';

    const setLang = async (code) => {
        if (current === code) return;
        try {
            localStorage.setItem('language', code);
        } catch {
            /* ignore */
        }
        await i18n.changeLanguage(code);
        applyHtmlLanguage(code);
    };

    return (
        <div
            className={`auth-shell-lang-toggle ${className}`.trim()}
            role="group"
            aria-label={t('auth_language_toggle_a11y', 'Language')}
        >
            <button
                type="button"
                className={`auth-shell-lang-toggle__btn${current === 'en' ? ' auth-shell-lang-toggle__btn--active' : ''}`}
                onClick={() => setLang('en')}
                aria-pressed={current === 'en'}
            >
                EN
            </button>
            <button
                type="button"
                className={`auth-shell-lang-toggle__btn${current === 'ar' ? ' auth-shell-lang-toggle__btn--active' : ''}`}
                onClick={() => setLang('ar')}
                aria-pressed={current === 'ar'}
            >
                عربي
            </button>
        </div>
    );
}
