import React from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FaUser, FaStore, FaGlobe } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import AppRouteLoading from '../components/AppRouteLoading';
import AuthShellThemeToggle from './auth/AuthShellThemeToggle';
import { useTheme } from '../context/ThemeContext';
import { appLogoForChrome } from '../config/appLogo';
import { isAffiliateAgent, isBusinessUser } from '../utils/accountRole';

const MOBILE_HOME_MQ = '(max-width: 1023px)';

/**
 * Signed-out mobile entry: choose personal vs business account (affiliate stays on desktop portal).
 */
export default function MobileWelcomeEntry() {
    const { t } = useTranslation();
    const { themeMode } = useTheme();
    const navigate = useNavigate();
    const { currentUser, userProfile, loading } = useAuth();

    if (typeof window !== 'undefined' && !window.matchMedia(MOBILE_HOME_MQ).matches) {
        return <Navigate to="/" replace />;
    }

    if (loading || (currentUser && !userProfile)) {
        return <AppRouteLoading variant="session" fullViewport />;
    }

    const guestModeActive =
        typeof localStorage !== 'undefined' && localStorage.getItem('guestMode') === 'true';
    const profileGuest =
        userProfile &&
        (userProfile.isGuest === true || String(userProfile.role || '').toLowerCase() === 'guest');
    if (!currentUser && (guestModeActive || profileGuest)) {
        return <Navigate to="/posts-feed" replace />;
    }

    if (currentUser && userProfile) {
        if (isBusinessUser(userProfile)) {
            return <Navigate to="/business-dashboard" replace />;
        }
        if (isAffiliateAgent(userProfile)) {
            return <Navigate to="/affiliate/dashboard" replace />;
        }
        return <Navigate to="/posts-feed" replace />;
    }

    const cardBtn = {
        width: '100%',
        padding: '1rem 1.25rem',
        borderRadius: '14px',
        border: '1px solid var(--border-color)',
        fontWeight: 700,
        fontSize: '1rem',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.65rem',
        textAlign: 'center',
        boxSizing: 'border-box',
    };

    return (
        <div className="auth-route-scroll login-hub login-hub-page">
            <AuthShellThemeToggle />
            <div className="login-hub-wrap" style={{ maxWidth: 420, margin: '0 auto' }}>
                <header className="login-hub-header">
                    <div className="login-hub-brand-row">
                        <img src={appLogoForChrome(themeMode)} alt="" className="login-hub-logo" width={56} height={56} />
                        <h1 className="login-hub-brand">{t('app_title', 'DineBuddies')}</h1>
                    </div>
                </header>

                <div className="login-hub-card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <button
                        type="button"
                        className="affiliate-btn affiliate-btn--primary"
                        style={{ ...cardBtn, border: 'none', background: 'linear-gradient(135deg, var(--primary), #a78bfa)', color: '#fff' }}
                        onClick={() => navigate('/login')}
                    >
                        <FaUser aria-hidden />
                        {t('mobile_welcome_personal_cta', 'Personal account — dining & social')}
                    </button>

                    <button
                        type="button"
                        className="affiliate-btn affiliate-btn--secondary"
                        style={{ ...cardBtn, marginTop: 8 }}
                        onClick={() => navigate('/signup/business')}
                    >
                        <FaStore aria-hidden />
                        {t('mobile_welcome_business_cta', 'Business / venue account')}
                    </button>

                    <button
                        type="button"
                        className="affiliate-btn affiliate-btn--ghost"
                        style={{ ...cardBtn, marginTop: 8 }}
                        onClick={() => navigate('/posts-feed')}
                    >
                        <FaGlobe aria-hidden style={{ fontSize: '1.1rem' }} />
                        {t('mobile_welcome_browse_cta', 'Browse the public feed')}
                    </button>

                    <p style={{ textAlign: 'center', margin: '12px 0 0', fontSize: '0.92rem' }}>
                        <Link to="/login" style={{ color: 'var(--primary)', fontWeight: 600 }}>
                            {t('mobile_welcome_have_account', 'Already have an account? Sign in')}
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
