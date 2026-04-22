import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FaUser } from 'react-icons/fa';
import { HiBuildingStorefront } from 'react-icons/hi2';
import PersonalAuthPanel from './PersonalAuthPanel';
import BusinessLoginPanel from './BusinessLoginPanel';

/** Login hub with tabs: personal (default) | business */
export default function LoginHub() {
    const { t } = useTranslation();
    const location = useLocation();
    const [tab, setTab] = useState('personal');

    useEffect(() => {
        const q = new URLSearchParams(location.search);
        const businessFromQuery = q.get('tab') === 'business';
        const businessFromPath = location.pathname.startsWith('/business/login');
        if (!businessFromQuery && !businessFromPath) return;
        setTab('business');
        const id = window.setTimeout(() => {
            document.getElementById('business-login-section')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 100);
        return () => window.clearTimeout(id);
    }, [location.pathname, location.search]);

    const tabIdPersonal = 'login-hub-tab-personal';
    const tabIdBusiness = 'login-hub-tab-business';
    const panelIdPersonal = 'login-hub-panel-personal';
    const panelIdBusiness = 'business-login-section';

    return (
        <div className="auth-route-scroll login-hub login-hub-page">
            <div className="login-hub-wrap">
                <header className="login-hub-header">
                    <h1 className="login-hub-brand">DineBuddies</h1>
                    <span className={`login-hub-mode-pill login-hub-mode-pill--${tab}`}>
                        {tab === 'business'
                            ? t('business_login', 'Business')
                            : t('account_type_personal_title', 'Personal account')}
                    </span>
                    <p className="login-hub-tagline">
                        {t('login_hub_subtitle_unified', 'Choose the tab that matches your account, then sign in.')}
                    </p>
                </header>

                <div className={`login-hub-card login-hub-card--${tab}`}>
                    <div
                        className="login-hub-tabs"
                        role="tablist"
                        aria-label={t('login_tablist_label', 'Account type')}
                    >
                        <button
                            type="button"
                            id={tabIdPersonal}
                            role="tab"
                            aria-selected={tab === 'personal'}
                            aria-controls={panelIdPersonal}
                            tabIndex={tab === 'personal' ? 0 : -1}
                            className={`login-hub-tab${tab === 'personal' ? ' login-hub-tab--active' : ''}`}
                            onClick={() => setTab('personal')}
                        >
                            <FaUser aria-hidden />
                            {t('account_type_personal_title', 'Personal account')}
                            <span className="login-hub-tab-subline">
                                {t('personal_auth_tab_hint', 'For individuals and social sign-in')}
                            </span>
                        </button>
                        <button
                            type="button"
                            id={tabIdBusiness}
                            role="tab"
                            aria-selected={tab === 'business'}
                            aria-controls={panelIdBusiness}
                            tabIndex={tab === 'business' ? 0 : -1}
                            className={`login-hub-tab${tab === 'business' ? ' login-hub-tab--active' : ''}`}
                            onClick={() => setTab('business')}
                        >
                            <HiBuildingStorefront aria-hidden />
                            {t('business_login', 'Business')}
                            <span className="login-hub-tab-subline">
                                {t('business_auth_tab_hint', 'For restaurants and brand teams')}
                            </span>
                        </button>
                    </div>

                    <div
                        id={panelIdPersonal}
                        role="tabpanel"
                        aria-labelledby={tabIdPersonal}
                        hidden={tab !== 'personal'}
                        className="login-hub-tabpanel"
                    >
                        <PersonalAuthPanel singleCardShell />
                    </div>

                    <div
                        id={panelIdBusiness}
                        role="tabpanel"
                        aria-labelledby={tabIdBusiness}
                        hidden={tab !== 'business'}
                        className="login-hub-tabpanel"
                    >
                        <BusinessLoginPanel embedInHub embeddedInSingleCard />
                    </div>
                </div>
            </div>
        </div>
    );
}
