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
 */import { AppText } from "../../components/base";
export default function AuthPageChrome({
  accountTab = null,
  onSwitchToBusiness,
  onSwitchToPersonal,
  showAffiliateLink = false
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
          height={40} />

                <AppText as="span" className="auth-page-chrome__title">DineBuddies</AppText>
            </div>

            <div className="auth-page-chrome__toolbar">
                <div className="auth-page-chrome__toolbar-actions">
                    {showAccountSwitch && accountTab === 'personal' && onSwitchToBusiness ?
          <button
            type="button"
            className="login-hub-shell-btn auth-page-chrome__account-btn"
            onClick={onSwitchToBusiness}
            aria-label={t('login_toggle_open_business_a11y', 'Switch to business account sign-in')}>

                            <HiBuildingStorefront aria-hidden />
                            <AppText as="span" className="auth-page-chrome__account-label">
                                {t('login_toggle_business', 'Business')}
                            </AppText>
                        </button> :
          null}
                    {showAccountSwitch && accountTab === 'business' && onSwitchToPersonal ?
          <button
            type="button"
            className="login-hub-shell-btn auth-page-chrome__account-btn"
            onClick={onSwitchToPersonal}
            aria-label={t('login_toggle_open_personal_a11y', 'Switch to personal account sign-in')}>

                            <FaUser aria-hidden />
                            <AppText as="span" className="auth-page-chrome__account-label">
                                {t('login_toggle_personal', 'Personal')}
                            </AppText>
                        </button> :
          null}
                    {showAffiliateLink ?
          <Link
            to="/affiliate/login?next=/affiliate/dashboard"
            className="login-hub-corner-btn login-hub-corner-btn--affiliate auth-page-chrome__icon-btn"
            aria-label={t('login_affiliate_corner_a11y', 'Affiliate partner sign-in')}
            title={t('login_affiliate_corner_a11y', 'Affiliate partner sign-in')}>

                            <FaHandshake aria-hidden />
                        </Link> :
          null}
                    <AuthShellLanguageToggle variant="compact" className="auth-page-chrome__lang" />
                    <AuthShellThemeToggle variant="corner" />
                </div>
            </div>
        </header>);

}