import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FaUser } from 'react-icons/fa';
import { HiBuildingStorefront } from 'react-icons/hi2';
import { useToast } from '../../context/ToastContext';
import { consumeAuthGateNotice } from '../../utils/authGateNotice';
import { sanitizeNextPath } from '../../utils/safeInternalPath';
import PersonalAuthPanel from './PersonalAuthPanel';
import BusinessLoginPanel from './BusinessLoginPanel';

function readLoginTabFromLocation(location) {
    const q = new URLSearchParams(location.search || '');
    const businessFromQuery = q.get('tab') === 'business';
    const businessFromPath = location.pathname.startsWith('/business/login');
    return businessFromQuery || businessFromPath ? 'business' : 'personal';
}

/** Login hub — personal (default) with a corner toggle to business. */
export default function LoginHub() {
    const { t } = useTranslation();
    const { showToast } = useToast();
    const location = useLocation();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [tab, setTab] = useState(() => readLoginTabFromLocation(location));

    useEffect(() => {
        const next = sanitizeNextPath(searchParams.get('next'));
        if (next && next.startsWith('/affiliate')) {
            const q = searchParams.toString();
            navigate(q ? `/affiliate/login?${q}` : '/affiliate/login', { replace: true });
        }
    }, [searchParams, navigate]);

    useEffect(() => {
        const notice = consumeAuthGateNotice();
        if (!notice) return;
        const text = notice.i18nKey
            ? t(notice.i18nKey, notice.message || '')
            : notice.message || t('auth_affiliate_web_only', 'حسابات الوكلاء تدار عبر موقع الويب فقط.');
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

            <div className="login-hub-wrap">
                <header className="login-hub-header">
                    <h1 className="login-hub-brand">DineBuddies</h1>
                    <span className={`login-hub-mode-pill login-hub-mode-pill--${tab}`}>
                        {tab === 'business'
                            ? t('business_login', 'Business')
                            : t('account_type_personal_title', 'Personal account')}
                    </span>
                    <p className="login-hub-tagline">
                        {tab === 'business'
                            ? t(
                                'login_hub_subtitle_business',
                                'Sign in with your business email and password.'
                            )
                            : t(
                                'login_hub_subtitle_personal',
                                'Sign in with email, Google, or Facebook — or create a personal account.'
                            )}
                    </p>
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
