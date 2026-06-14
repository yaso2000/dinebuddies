import React from 'react';
import { useTranslation } from 'react-i18next';
import { FaGlobe } from 'react-icons/fa';
import { applyHtmlLanguage } from '../../utils/authGeoLanguage';
import {
    LANGUAGE_OPTIONS,
    resolveLanguageCode,
    getLanguageNativeLabel,
} from '../../constants/languageOptions';

/** Language picker for auth shells — compact dropdown (all supported locales). */
export default function AuthShellLanguageToggle({ className = '' }) {
    const { i18n, t } = useTranslation();
    const current = resolveLanguageCode(i18n.language);

    const onChange = async (event) => {
        const code = event.target.value;
        if (!code || code === current) return;
        try {
            localStorage.setItem('language', code);
        } catch {
            /* ignore */
        }
        await i18n.changeLanguage(code);
        applyHtmlLanguage(code);
    };

    return (
        <label className={`auth-shell-lang-select ${className}`.trim()}>
            <FaGlobe className="auth-shell-lang-select__icon" aria-hidden />
            <select
                className="auth-shell-lang-select__field"
                value={current}
                onChange={onChange}
                aria-label={t('auth_language_toggle_a11y', 'Language')}
            >
                {LANGUAGE_OPTIONS.map((lang) => (
                    <option key={lang.code} value={lang.code}>
                        {`${lang.flag} ${getLanguageNativeLabel(lang.code, t)}`}
                    </option>
                ))}
            </select>
        </label>
    );
}
