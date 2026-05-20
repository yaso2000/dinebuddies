import React from 'react';
import { useTranslation } from 'react-i18next';
import { FaSun, FaMoon } from 'react-icons/fa';
import { useTheme } from '../../context/ThemeContext';

/** Day/night toggle for login and other full-page auth shells. */
export default function AuthShellThemeToggle({ className = '', variant = 'default' }) {
    const { t } = useTranslation();
    const { isDark, toggleTheme } = useTheme();
    const label = isDark ? t('light_mode', 'Light Mode') : t('dark_mode', 'Dark Mode');
    const isCorner = variant === 'corner';

    return (
        <button
            type="button"
            className={`${isCorner ? 'login-hub-corner-btn login-hub-corner-btn--theme' : 'login-hub-shell-btn auth-shell-theme-toggle'} ${className}`.trim()}
            onClick={toggleTheme}
            aria-label={label}
            title={label}
        >
            {isDark ? <FaSun aria-hidden /> : <FaMoon aria-hidden />}
            {!isCorner ? <span className="auth-shell-theme-toggle__label">{label}</span> : null}
        </button>
    );
}
