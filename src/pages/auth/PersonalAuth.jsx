import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FaFacebook, FaUser } from 'react-icons/fa';
import { FcGoogle } from 'react-icons/fc';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { getAuthErrorMessage } from '../../utils/errorMessages';
import { needsConsumerEmailVerification } from '../../utils/emailVerification';
import { isBusinessUser } from '../../utils/accountRole';
import { goToLogin } from '../../utils/goToLogin';

/**
 * Step 1 — Personal account: Google and Facebook only (no email/password on this screen).
 */
export default function PersonalAuth() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const location = useLocation();
    const { showToast } = useToast();
    const {
        signInWithGoogle,
        signInWithFacebook,
        continueAsGuest,
        userProfile,
        currentUser,
        isGuest,
        loading: authLoading,
    } = useAuth();

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [justLoggedIn, setJustLoggedIn] = useState(false);

    const guestLike =
        isGuest ||
        userProfile?.isGuest === true ||
        userProfile?.role === 'guest' ||
        userProfile?.uid === 'guest';
    const showAlreadySignedIn =
        !authLoading && currentUser && userProfile && !guestLike;

    let continueHref = '/';
    if (showAlreadySignedIn) {
        if (needsConsumerEmailVerification(currentUser, userProfile)) continueHref = '/verify-email';
        else if (isBusinessUser(userProfile)) {
            continueHref =
                typeof window !== 'undefined' && window.innerWidth >= 1024 ? '/business-pro' : '/business-dashboard';
        } else continueHref = '/posts-feed';
    }

    useEffect(() => {
        if (!justLoggedIn || !currentUser) return;
        if (userProfile) {
            if (isBusinessUser(userProfile)) {
                navigate(window.innerWidth >= 1024 ? '/business-pro' : '/business-dashboard', { replace: true });
            } else {
                navigate('/', { replace: true });
            }
            return;
        }
        const tmr = setTimeout(() => navigate('/', { replace: true }), 1500);
        return () => clearTimeout(tmr);
    }, [justLoggedIn, currentUser, userProfile, navigate]);

    useEffect(() => {
        let fromStorage = false;
        try {
            if (sessionStorage.getItem('dineb_password_reset_ok') === '1') {
                sessionStorage.removeItem('dineb_password_reset_ok');
                fromStorage = true;
            }
        } catch {
            /* ignore */
        }
        if (!location.state?.passwordResetSuccess && !fromStorage) return;
        showToast(
            t('password_reset_done_sign_in', 'Password updated. You can continue with Google or Facebook if you linked those accounts.'),
            'success'
        );
        if (location.state?.passwordResetSuccess) {
            window.history.replaceState({}, '', `${window.location.pathname}${window.location.search}`);
        }
    }, [location.state?.passwordResetSuccess, showToast, t]);

    const handleOAuth = async (provider) => {
        setLoading(true);
        setError('');
        try {
            if (provider === 'google') await signInWithGoogle();
            else await signInWithFacebook();
            setJustLoggedIn(true);
        } catch (err) {
            if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') {
                /* ignore */
            } else if (err.code === 'auth/in-app-browser') {
                setError(
                    t('auth_in_app_browser_hint', 'Open this site in Safari or Chrome to sign in.')
                );
            } else if (err.code === 'auth/business-email-in-use') {
                setError(
                    t(
                        'auth_business_email_conflict',
                        'This email is registered as a business. Use Business login when it is available.'
                    )
                );
            } else {
                setError(getAuthErrorMessage(err) || err.message);
            }
        } finally {
            setLoading(false);
        }
    };

    const btn = {
        width: '100%',
        padding: '12px',
        borderRadius: '10px',
        border: '1px solid #d1d5db',
        background: '#ffffff',
        color: '#111827',
        fontWeight: '700',
        fontSize: '0.95rem',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
    };

    return (
        <div
            style={{
                background: '#f8fafc',
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '16px',
            }}
        >
            <div style={{
                width: '100%',
                maxWidth: '420px',
                background: '#ffffff',
                border: '1px solid #e5e7eb',
                borderRadius: '16px',
                boxShadow: '0 10px 30px rgba(0,0,0,0.08)',
                padding: '18px'
            }}>
                <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
                    <h1 style={{ fontSize: '1.3rem', fontWeight: 900, margin: 0, color: '#111827' }}>DineBuddies</h1>
                    <p
                        style={{
                            color: '#4b5563',
                            fontSize: '0.9rem',
                            marginTop: '8px',
                            lineHeight: 1.45,
                        }}
                    >
                        {t('auth_personal_step1_subtitle', 'Sign in or create a personal account with Google or Facebook.')}
                    </p>
                </div>

                {showAlreadySignedIn && (
                    <div
                        style={{
                            marginBottom: '1rem',
                            padding: '0.85rem',
                            borderRadius: '10px',
                            background: 'rgba(34, 197, 94, 0.1)',
                            border: '1px solid rgba(34, 197, 94, 0.35)',
                            textAlign: 'center',
                        }}
                    >
                        <p style={{ margin: '0 0 0.5rem', fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-main)' }}>
                            {t('login_already_signed_in', 'You are already signed in.')}
                        </p>
                        <button
                            type="button"
                            onClick={() => navigate(continueHref)}
                            style={{ border: 'none', background: 'transparent', fontWeight: 800, color: '#2563eb', fontSize: '0.92rem', cursor: 'pointer' }}
                        >
                            {t('continue_to_app', 'Continue to the app →')}
                        </button>
                    </div>
                )}

                {error && (
                    <div
                        style={{
                            background: 'rgba(239,68,68,0.12)',
                            color: '#f87171',
                            padding: '0.75rem',
                            borderRadius: '12px',
                            marginBottom: '1rem',
                            fontSize: '0.85rem',
                            textAlign: 'center',
                            border: '1px solid rgba(239,68,68,0.2)',
                        }}
                    >
                        {error}
                    </div>
                )}

                <section
                    style={{
                        padding: '0.2rem 0',
                    }}
                >
                    <h2
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            fontSize: '0.95rem',
                            fontWeight: 800,
                            color: '#111827',
                            margin: '0 0 1rem',
                        }}
                    >
                        <FaUser style={{ color: '#60a5fa', flexShrink: 0 }} aria-hidden />
                        {t('account_type_personal_title', 'Personal account')}
                    </h2>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                        <button
                            type="button"
                            onClick={() => handleOAuth('google')}
                            disabled={loading}
                            className="btn-auth-social btn-google"
                            style={{ ...btn, opacity: loading ? 0.65 : 1 }}
                        >
                            <FcGoogle size={22} /> {t('continue_with_google', 'Continue with Google')}
                        </button>
                        <button
                            type="button"
                            onClick={() => handleOAuth('facebook')}
                            disabled={loading}
                            className="btn-auth-social btn-facebook"
                            style={{ ...btn, opacity: loading ? 0.65 : 1 }}
                        >
                            <FaFacebook size={22} color="#1877F2" /> {t('continue_with_facebook', 'Continue with Facebook')}
                        </button>
                    </div>

                    <button
                        type="button"
                        onClick={async () => {
                            await continueAsGuest();
                            navigate('/');
                        }}
                        disabled={loading}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: '#4b5563',
                            fontSize: '0.82rem',
                            cursor: loading ? 'not-allowed' : 'pointer',
                            textDecoration: 'underline',
                            marginTop: '1rem',
                            width: '100%',
                        }}
                    >
                        {t('continue_as_guest', 'Continue as guest')}
                    </button>
                </section>
            </div>
        </div>
    );
}
