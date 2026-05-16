import React from 'react';
import { useTranslation } from 'react-i18next';
import { FaSun, FaMoon } from 'react-icons/fa';
import { useTheme } from '../../context/ThemeContext';

/** Fixed corner control on login / welcome / business auth shells — same pattern as {@link ProfilePersonalToolbar}. */
export default function AuthShellThemeToggle() {
    const { t } = useTranslation();
    const { isDark, toggleTheme } = useTheme();

    return (
        <button
            type="button"
            onClick={toggleTheme}
            className="profile-theme-toggle login-hub-theme-toggle"
            style={{ color: isDark ? 'var(--luxury-gold)' : 'var(--primary)' }}
            title={isDark ? t('light_mode') : t('dark_mode')}
            aria-label={isDark ? t('light_mode') : t('dark_mode')}
        >
            {isDark ? <FaSun size={18} /> : <FaMoon size={18} />}
        </button>
    );
}
