import React, { useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { consumeAuthGateNotice } from '../../utils/authGateNotice';
import { sanitizeNextPath } from '../../utils/safeInternalPath';
import PersonalAuthPanel from './PersonalAuthPanel';
import BusinessLoginPanel from './BusinessLoginPanel';
import AuthPageChrome from './AuthPageChrome';
import LocalDevOAuthNotice from '../../components/LocalDevOAuthNotice';
import { isEmbeddedPreviewBrowser, peekPostLogoutRedirect, clearPostLogoutRedirect, hasFirebaseAuthReturnInUrl, peekOAuthRedirectPending, peekOAuthRedirectProvider } from '../../utils/localDevAuth';
import { resolveSignedInHomePath } from '../../utils/accountKind';
import { resolveBusinessPostLoginPath } from '../../utils/postAuthRedirect';
import { isAffiliateAgent, isBusinessUser, hasBusinessSessionHint } from '../../utils/accountRole';
import { shouldLandOnAdminDashboard } from '../../utils/adminAccess';
import { AppText } from '../../components/base';

function readLoginTabFromLocation(location) {
    const q = new URLSearchParams(location.search || '');
    const businessFromQuery = q.get('tab') === 'business';
    const businessFromPath = location.pathname.startsWith('/business/login');
    return businessFromQuery || businessFromPath ? 'business' : 'personal';
}

/** Login hub — never full-screen block; show buttons while OAuth finishes in the background. */
export default function LoginHub() {
    const { t } = useTranslation();
    const { showToast } = useToast();
    const location = useLocation();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [tab, setTab] = useState(() => readLoginTabFromLocation(location));
    const { currentUser, userProfile, profileServerSynced, isGuest } = useAuth();

    const postLogout = peekPostLogoutRedirect();

    const signedInConsumerReady =
        Boolean(currentUser) &&
        !isGuest &&
        !postLogout &&
        profileServerSynced &&
        Boolean(userProfile) &&
        !shouldLandOnAdminDashboard(currentUser, userProfile) &&
        !isAffiliateAgent(userProfile) &&
        !isBusinessUser(userProfile);

    const signedInBusinessReady =
        Boolean(currentUser) &&
        !isGuest &&
        !postLogout &&
        profileServerSynced &&
        Boolean(userProfile) &&
        (isBusinessUser(userProfile) || hasBusinessSessionHint(currentUser.uid));

    useEffect(() => {
        if (!currentUser) {
            clearPostLogoutRedirect();
        }
    }, [currentUser]);

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
            : notice.message || t('auth_affiliate_web_only');
        showToast(text, notice.variant === 'info' ? 'info' : 'error');
    }, [showToast, t]);

    useEffect(() => {
        setTab(readLoginTabFromLocation(location));
    }, [location.pathname, location.search]);

    const finishingOAuth =
        Boolean(currentUser) &&
        !isGuest &&
        !profileServerSynced &&
        (hasFirebaseAuthReturnInUrl() || peekOAuthRedirectPending() || peekOAuthRedirectProvider());

    if (signedInBusinessReady && tab === 'business') {
        return <Navigate to={resolveBusinessPostLoginPath(location.search)} replace />;
    }

    if (signedInConsumerReady) {
        return (
            <Navigate
                to={resolveSignedInHomePath(currentUser, userProfile, { isGuest })}
                replace
            />
        );
    }

    if (
        currentUser &&
        !isGuest &&
        profileServerSynced &&
        userProfile &&
        shouldLandOnAdminDashboard(currentUser, userProfile)
    ) {
        return <Navigate to="/admin/users" replace />;
    }

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
                <AuthPageChrome
                    accountTab={tab}
                    onSwitchToBusiness={goBusiness}
                    onSwitchToPersonal={goPersonal}
                    showAffiliateLink={false}
                />
                <LocalDevOAuthNotice />
                {finishingOAuth ? (
                    <AppText
                        as="p"
                        style={{
                            margin: '0 0 1rem',
                            textAlign: 'center',
                            color: 'var(--text-muted)',
                            fontSize: '0.9rem',
                        }}
                    >
                        {t('auth_finishing_sign_in', 'Finishing sign-in…')}
                    </AppText>
                ) : null}
                {import.meta.env.DEV && isEmbeddedPreviewBrowser() ? (
                    <div
                        className="local-dev-oauth-notice local-dev-oauth-notice--blocked"
                        style={{
                            marginBottom: '1rem',
                            padding: '0.75rem 0.9rem',
                            borderRadius: '12px',
                            fontSize: '0.78rem',
                            lineHeight: 1.55,
                            color: 'var(--text-main)',
                            background: 'rgba(239, 68, 68, 0.12)',
                            border: '1px solid rgba(239, 68, 68, 0.45)',
                        }}
                    >
                        <AppText as="p" style={{ margin: 0, fontWeight: 800, color: '#fca5a5' }}>
                            {t(
                                'local_dev_embedded_preview_blocked',
                                'Sign-in does not work inside Cursor / VS Code preview.'
                            )}
                        </AppText>
                        <AppText as="p" style={{ margin: '0.5rem 0 0', color: 'var(--text-muted)' }}>
                            {t(
                                'local_dev_embedded_preview_hint',
                                'Open Chrome or Edge at http://localhost:5176/login?tab=business (copy from the terminal after npm run dev:fresh).'
                            )}
                        </AppText>
                    </div>
                ) : null}
                <div className={`login-hub-card login-hub-card--${tab}`}>
                    {tab === 'personal' ? (
                        <div
                            id={panelIdPersonal}
                            className="login-hub-tabpanel login-hub-tabpanel--solo"
                        >
                            <PersonalAuthPanel singleCardShell />
                        </div>
                    ) : (
                        <div
                            id={panelIdBusiness}
                            className="login-hub-tabpanel login-hub-tabpanel--solo"
                        >
                            <BusinessLoginPanel embedInHub embeddedInSingleCard />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
