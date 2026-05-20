import React, { useState, useEffect, useLayoutEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FaApple, FaFacebook, FaUser } from 'react-icons/fa';
import { FcGoogle } from 'react-icons/fc';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { getAuthErrorMessage } from '../../utils/errorMessages';
import { needsEmailPasswordVerification } from '../../utils/emailVerification';
import { isAffiliateAgent, isBusinessUser } from '../../utils/accountRole';
import { sanitizeNextPath } from '../../utils/safeInternalPath';
import { shouldLandOnAdminDashboard } from '../../utils/adminAccess';
import { canConsumerEnterApp } from '../../utils/consumerProfileComplete';

/**
 * Consumer (personal) account only: Google, Facebook, and Apple — no email/password on this page.
 * Business → BusinessLoginPanel; affiliates → /affiliate/login.
 * @param {{ singleCardShell?: boolean }} props
 */
export default function PersonalAuthPanel({ singleCardShell = false }) {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const location = useLocation();
    const { showToast } = useToast();
    const {
        signInWithGoogle,
        signInWithFacebook,
        signInWithApple,
        continueAsGuest,
        signOut,
        userProfile,
        currentUser,
        isGuest,
        loading: authLoading,
        profileServerSynced,
        consumerEntryStatus,
    } = useAuth();

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [justLoggedIn, setJustLoggedIn] = useState(false);

    const nextPath = sanitizeNextPath(new URLSearchParams(location.search).get('next'));

    const guestLike =
        isGuest ||
        userProfile?.isGuest === true ||
        userProfile?.role === 'guest' ||
        userProfile?.uid === 'guest';
    const showAlreadySignedIn =
        !authLoading && currentUser && userProfile && !guestLike;

    const isComplete = canConsumerEnterApp(userProfile);

    let continueHref = '/posts-feed';
    if (showAlreadySignedIn) {
        if (shouldLandOnAdminDashboard(currentUser, userProfile)) continueHref = '/admin/users';
        else if (isAffiliateAgent(userProfile)) continueHref = '/affiliate/dashboard';
        else if (isBusinessUser(userProfile)) continueHref = '/business-dashboard';
        else if (needsEmailPasswordVerification(currentUser, userProfile)) continueHref = '/verify-email';
        else if (!canConsumerEnterApp(userProfile)) continueHref = '/complete-profile';
        else continueHref = '/posts-feed';
    }

    const rejectWrongAccountType = async () => {
        setJustLoggedIn(false);
        try {
            await signOut();
        } catch {
            /* ignore */
        }
    };

    useEffect(() => {
        if (!justLoggedIn || !currentUser) return;
        if (userProfile && !profileServerSynced) return;

        if (userProfile) {
            if (shouldLandOnAdminDashboard(currentUser, userProfile)) {
                navigate('/admin/users', { replace: true });
                return;
            }
            if (isAffiliateAgent(userProfile)) {
                setError(
                    t(
                        'auth_affiliate_portal_only',
                        'This account is an affiliate partner. Sign in from the affiliate portal only.'
                    )
                );
                rejectWrongAccountType();
                return;
            }
            if (isBusinessUser(userProfile)) {
                setError(
                    t(
                        'auth_business_portal_only',
                        'This account is a business account. Use Business sign-in (email and password).'
                    )
                );
                rejectWrongAccountType();
                return;
            }
            if (needsEmailPasswordVerification(currentUser, userProfile)) {
                navigate('/verify-email', { replace: true });
                return;
            }
            if (!profileServerSynced || consumerEntryStatus === 'pending') return;
            if (consumerEntryStatus === 'blocked' || !canConsumerEnterApp(userProfile)) {
                navigate('/complete-profile', { replace: true });
            } else {
                navigate(nextPath || '/posts-feed', { replace: true });
            }
            return;
        }

        const tmr = setTimeout(() => {
            if (shouldLandOnAdminDashboard(currentUser, null)) {
                navigate('/admin/users', { replace: true });
            } else {
                navigate('/', { replace: true });
            }
        }, 1500);
        return () => clearTimeout(tmr);
    }, [justLoggedIn, currentUser, userProfile, profileServerSynced, consumerEntryStatus, navigate, nextPath, t]);

    useEffect(() => {
        try {
            if (sessionStorage.getItem('dineb_password_reset_toast_shown') === '1') return;
        } catch {
            /* ignore */
        }

        let fromStorage = false;
        try {
            if (sessionStorage.getItem('dineb_password_reset_ok') === '1') {
                sessionStorage.removeItem('dineb_password_reset_ok');
                fromStorage = true;
            }
        } catch {
            /* ignore */
        }

        const fromQuery = new URLSearchParams(location.search).get('passwordReset') === '1';

        if (!location.state?.passwordResetSuccess && !fromStorage && !fromQuery) return;

        try {
            sessionStorage.setItem('dineb_password_reset_toast_shown', '1');
        } catch {
            /* ignore */
        }

        showToast(
            t(
                'password_reset_done_sign_in_social',
                'Password updated. Sign in with Google, Facebook, or Apple for your personal account.'
            ),
            'success'
        );

        if (location.state?.passwordResetSuccess) {
            navigate(location.pathname, { replace: true, state: {} });
        }
    }, [location.state?.passwordResetSuccess, location.search, showToast, t, navigate, location.pathname]);

    useLayoutEffect(() => {
        try {
            window.scrollTo(0, 0);
            const el = document.scrollingElement;
            if (el) el.scrollTop = 0;
            document.body.scrollTop = 0;
        } catch {
            /* ignore */
        }
    }, []);

    const handleOAuth = async (provider) => {
        setLoading(true);
        setError('');
        try {
            if (provider === 'google') {
                await signInWithGoogle();
            } else if (provider === 'apple') {
                const appleRes = await signInWithApple();
                if (appleRes && appleRes.__oauthRedirect) return;
            } else {
                const fbRes = await signInWithFacebook();
                if (fbRes && fbRes.__oauthRedirect) return;
            }
            setJustLoggedIn(true);
        } catch (err) {
            if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') {
                /* ignore */
            } else if (err.code === 'auth/in-app-browser') {
                setError(
                    t('auth_in_app_browser_hint', 'Open this site in Safari or Chrome to sign in.')
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

    const cardShell = {
        width: '100%',
        background: '#ffffff',
        border: '1px solid #e5e7eb',
        borderRadius: '16px',
        boxShadow: '0 10px 30px rgba(0,0,0,0.08)',
        padding: '18px',
    };

    const body = (
        <div className="personal-auth-panel">
            <div className="auth-luxury-ribbon auth-luxury-ribbon--personal">
                <FaUser aria-hidden />
                <span>{t('account_type_personal_title', 'Personal account')}</span>
            </div>
            <p
                style={{
                    color: '#4b5563',
                    fontSize: '0.88rem',
                    margin: '0 0 1rem',
                    lineHeight: 1.45,
                    textAlign: 'center',
                }}
            >
                {t(
                    'auth_personal_step1_subtitle',
                    'Sign in or create a personal account with Google, Facebook, or Apple only.'
                )}
            </p>

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

            <section style={{ padding: '0.2rem 0' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                    <button
                        type="button"
                        onClick={() => handleOAuth('google')}
                        disabled={loading}
                        className="btn-auth-social btn-google personal-auth-social"
                        style={{ ...btn, opacity: loading ? 0.65 : 1 }}
                    >
                        <FcGoogle size={22} /> {t('continue_with_google', 'Continue with Google')}
                    </button>
                    <button
                        type="button"
                        onClick={() => handleOAuth('facebook')}
                        disabled={loading}
                        className="btn-auth-social btn-facebook personal-auth-social"
                        style={{ ...btn, opacity: loading ? 0.65 : 1 }}
                    >
                        <FaFacebook size={22} color="#1877F2" /> {t('continue_with_facebook', 'Continue with Facebook')}
                    </button>
                    <button
                        type="button"
                        onClick={() => handleOAuth('apple')}
                        disabled={loading}
                        className="btn-auth-social btn-apple personal-auth-social"
                        style={{
                            ...btn,
                            background: '#000000',
                            color: '#ffffff',
                            border: '1px solid #000000',
                            opacity: loading ? 0.65 : 1,
                        }}
                    >
                        <FaApple size={22} aria-hidden /> {t('continue_with_apple', 'Continue with Apple')}
                    </button>
                </div>

                <button
                    type="button"
                    onClick={async () => {
                        await continueAsGuest();
                        navigate('/posts-feed', { replace: true });
                    }}
                    disabled={loading}
                    className="personal-auth-guest-link"
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
    );

    return (
        <div id="personal-login-panel" style={{ width: '100%', minWidth: 0 }}>
            {singleCardShell ? body : <div style={cardShell}>{body}</div>}
        </div>
    );
}
