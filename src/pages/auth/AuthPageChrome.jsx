import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FaHandshake, FaUser } from 'react-icons/fa';
import { HiBuildingStorefront } from 'react-icons/hi2';
import AuthShellThemeToggle from './AuthShellThemeToggle';
import AuthShellLanguageToggle from './AuthShellLanguageToggle';
import { applyAuthGeoLanguage } from '../../utils/authGeoLanguage';

/**
 * Login chrome: brand header + toolbar (language, account mode, affiliate, theme).
 * @param {{
 *   accountTab?: 'personal' | 'business' | null,
 *   onSwitchToBusiness?: () => void,
 *   onSwitchToPersonal?: () => void,
 *   showAffiliateLink?: boolean,
 * }} props
 */
export default function AuthPageChrome({
    accountTab = null,
    onSwitchToBusiness,
    onSwitchToPersonal,
    showAffiliateLink = true,
}) {
    const { t, i18n } = useTranslation();

    useEffect(() => {
        applyAuthGeoLanguage(i18n);
    }, [i18n]);

    const showAccountSwitch = accountTab === 'personal' || accountTab === 'business';

    return (
        <header className="auth-page-chrome" aria-label={t('auth_page_chrome_a11y', 'Sign-in options')}>
            <div className="auth-page-chrome__brand">
                <img
                    src="/db-logo.svg"
                    alt=""
                    className="auth-page-chrome__logo"
                    width={40}
                    height={40}
                />
                <span className="auth-page-chrome__title">DineBuddies</span>
            </div>

            <div className="auth-page-chrome__toolbar">
                <AuthShellLanguageToggle className="auth-page-chrome__lang" />

                <div className="auth-page-chrome__toolbar-actions">
                    {showAccountSwitch && accountTab === 'personal' && onSwitchToBusiness ? (
                        <button
                            type="button"
                            className="login-hub-shell-btn auth-page-chrome__account-btn"
                            onClick={onSwitchToBusiness}
                            aria-label={t('login_toggle_open_business_a11y', 'Switch to business account sign-in')}
                        >
                            <HiBuildingStorefront aria-hidden />
                            <span className="auth-page-chrome__account-label">
                                {t('login_toggle_business', 'Business')}
                            </span>
                        </button>
                    ) : null}
                    {showAccountSwitch && accountTab === 'business' && onSwitchToPersonal ? (
                        <button
                            type="button"
                            className="login-hub-shell-btn auth-page-chrome__account-btn"
                            onClick={onSwitchToPersonal}
                            aria-label={t('login_toggle_open_personal_a11y', 'Switch to personal account sign-in')}
                        >
                            <FaUser aria-hidden />
                            <span className="auth-page-chrome__account-label">
                                {t('login_toggle_personal', 'Personal')}
                            </span>
                        </button>
                    ) : null}
                    {showAffiliateLink ? (
                        <Link
                            to="/affiliate/login?next=/affiliate/dashboard"
                            className="login-hub-corner-btn login-hub-corner-btn--affiliate auth-page-chrome__icon-btn"
                            aria-label={t('login_affiliate_corner_a11y', 'Affiliate partner sign-in')}
                            title={t('login_affiliate_corner_a11y', 'Affiliate partner sign-in')}
                        >
                            <FaHandshake aria-hidden />
                        </Link>
                    ) : null}
                    <AuthShellThemeToggle variant="corner" />
                </div>
            </div>
        </header>
    );
}
