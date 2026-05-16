import React, { useEffect, useLayoutEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FaUser } from 'react-icons/fa';
import { HiBuildingStorefront } from 'react-icons/hi2';
import { useToast } from '../../context/ToastContext';
import { consumeAuthGateNotice } from '../../utils/authGateNotice';
import { sanitizeNextPath } from '../../utils/safeInternalPath';
import { syncPendingReferralFromQueryString } from '../../utils/pendingReferral';
import { isMobileRestrictedShell } from '../../utils/mobileAppShell';
import { getAffiliateEmailSignInHref } from '../../utils/affiliateAuthRoutes';
import PersonalAuthPanel from './PersonalAuthPanel';
import BusinessLoginPanel from './BusinessLoginPanel';
import AuthShellThemeToggle from './AuthShellThemeToggle';
import { useTheme } from '../../context/ThemeContext';
import { appLogoForChrome } from '../../config/appLogo';

function readLoginTabFromLocation(location) {
    const q = new URLSearchParams(location.search || '');
    const businessFromQuery = q.get('tab') === 'business';
    const businessFromPath = location.pathname.startsWith('/business/login');
    return businessFromQuery || businessFromPath ? 'business' : 'personal';
}

/** Login hub — personal (default) with a corner toggle to business. */
export default function LoginHub() {
    const { t } = useTranslation();
    const { themeMode } = useTheme();
    const { showToast } = useToast();
    const location = useLocation();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [tab, setTab] = useState(() => readLoginTabFromLocation(location));

    useLayoutEffect(() => {
        syncPendingReferralFromQueryString(location.search);
    }, [location.search]);

    useEffect(() => {
        const next = sanitizeNextPath(searchParams.get('next'));
        if (!next || !next.startsWith('/affiliate')) return;
        if (typeof window === 'undefined') return;
        if (isMobileRestrictedShell()) {
            const q = new URLSearchParams(searchParams);
            if (q.get('tab') !== 'business') {
                q.set('tab', 'business');
                navigate(`/login?${q.toString()}`, { replace: true });
            }
            return;
        }
        const q = searchParams.toString();
        navigate(q ? `/affiliate/login?${q}` : '/affiliate/login', { replace: true });
    }, [searchParams, navigate]);

    useEffect(() => {
        const notice = consumeAuthGateNotice();
        if (!notice) return;
        const text = notice.i18nKey
            ? t(notice.i18nKey, notice.message || '')
            : notice.message || t('auth_affiliate_web_only', 'Create your affiliate account from a computer; sign in on mobile with email and password.');
        showToast(text, notice.variant === 'info' ? 'info' : 'error');
    }, [showToast, t]);

    useEffect(() => {
        setTab(readLoginTabFromLocation(location));
    }, [location.pathname, location.search]);

    const panelIdPersonal = 'login-hub-panel-personal';
    const panelIdBusiness = 'business-login-section';

    const goPersonal = () => {
        setTab('personal');
        const q = new URLSearchParams(location.search || '');
        q.delete('tab');
        const s = q.toString();
        navigate(s ? `/login?${s}` : '/login', { replace: true });
    };

    const goBusiness = () => {
        setTab('business');
        const q = new URLSearchParams(location.search || '');
        q.set('tab', 'business');
        navigate(`/login?${q.toString()}`, { replace: true });
    };

    return (
        <div className="auth-route-scroll login-hub login-hub-page">
            <div className="login-hub-wrap">
                <div className="login-hub-toolbar">
                    <AuthShellThemeToggle />
                    <button
                        type="button"
                        className="login-hub-account-toggle"
                        onClick={() => (tab === 'personal' ? goBusiness() : goPersonal())}
                        aria-label={
                            tab === 'personal'
                                ? t('login_toggle_open_business_a11y', 'Switch to business account sign-in')
                                : t('login_toggle_open_personal_a11y', 'Switch to personal account sign-in')
                        }
                    >
                        {tab === 'personal' ? (
                            <>
                                <HiBuildingStorefront aria-hidden />
                                <span>{t('login_toggle_business', 'Business')}</span>
                            </>
                        ) : (
                            <>
                                <FaUser aria-hidden />
                                <span>{t('login_toggle_personal', 'Personal')}</span>
                            </>
                        )}
                    </button>
                </div>

                <header className="login-hub-header">
                    <div className="login-hub-brand-row">
                        <img src={appLogoForChrome(themeMode)} alt="" className="login-hub-logo" width={56} height={56} />
                        <h1 className="login-hub-brand">{t('app_title', 'DineBuddies')}</h1>
                    </div>
                    <span className={`login-hub-mode-pill login-hub-mode-pill--${tab}`}>
                        {tab === 'business'
                            ? t('business_login', 'Business')
                            : t('account_type_personal_title', 'Personal account')}
                    </span>
                    {tab === 'business' && (
                        <p style={{ margin: '0.5rem 0 0', textAlign: 'center' }}>
                            <Link
                                to={getAffiliateEmailSignInHref('/affiliate/dashboard')}
                                style={{ color: 'var(--primary)', fontWeight: 600, fontSize: '0.88rem' }}
                            >
                                {t('login_hub_affiliate_portal_link', 'Affiliate sign-in')}
                            </Link>
                        </p>
                    )}
                </header>

                <div className={`login-hub-card login-hub-card--${tab}`}>
                    <div
                        id={panelIdPersonal}
                        hidden={tab !== 'personal'}
                        className="login-hub-tabpanel login-hub-tabpanel--solo"
                    >
                        <PersonalAuthPanel singleCardShell />
                    </div>

                    <div
                        id={panelIdBusiness}
                        hidden={tab !== 'business'}
                        className="login-hub-tabpanel login-hub-tabpanel--solo"
                    >
                        <BusinessLoginPanel embedInHub embeddedInSingleCard />
                    </div>
                </div>
            </div>
        </div>
    );
}
