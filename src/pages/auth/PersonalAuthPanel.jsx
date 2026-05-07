import React, { useState, useEffect, useLayoutEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FaFacebook, FaUser, FaEnvelope, FaLock } from 'react-icons/fa';
import { FcGoogle } from 'react-icons/fc';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { getAuthErrorMessage } from '../../utils/errorMessages';
import { needsEmailPasswordVerification } from '../../utils/emailVerification';
import { isBusinessUser } from '../../utils/accountRole';
import { shouldLandOnAdminDashboard } from '../../utils/adminAccess';

/**
 * Consumer (personal) account only: Google, Facebook, email/password, guest.
 * Business accounts use {@link BusinessLoginPanel} / `/business/login` — not handled here.
 * @param {{ singleCardShell?: boolean }} props — when true, no outer card (used inside LoginHub single panel).
 */
export default function PersonalAuthPanel({ singleCardShell = false }) {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const location = useLocation();
    const { showToast } = useToast();
    const {
        signInWithGoogle,
        signInWithFacebook,
        signInWithEmail,
        registerWithEmail,
        sendPasswordResetToEmail,
        continueAsGuest,
        userProfile,
        currentUser,
        isGuest,
        loading: authLoading,
        profileServerSynced,
    } = useAuth();

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [justLoggedIn, setJustLoggedIn] = useState(false);

    const [emailPanelOpen, setEmailPanelOpen] = useState(false);
    const [emailTab, setEmailTab] = useState('signin');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const guestLike =
        isGuest ||
        userProfile?.isGuest === true ||
        userProfile?.role === 'guest' ||
        userProfile?.uid === 'guest';
    const showAlreadySignedIn =
        !authLoading && currentUser && userProfile && !guestLike;

    const isComplete = userProfile?.isProfileComplete || (
        (userProfile?.displayName || userProfile?.display_name || userProfile?.nickname) &&
        userProfile?.gender &&
        (userProfile?.ageCategory || userProfile?.age)
    );

    let continueHref = '/posts-feed';
    if (showAlreadySignedIn) {
        if (needsEmailPasswordVerification(currentUser, userProfile)) continueHref = '/verify-email';
        else if (shouldLandOnAdminDashboard(currentUser, userProfile)) continueHref = '/admin/dashboard';
        else if (isBusinessUser(userProfile)) {
            continueHref = '/business-dashboard';
        } else if (!isComplete) {
            continueHref = '/complete-profile';
        } else {
            continueHref = '/posts-feed';
        }
    }

    useEffect(() => {
        if (!justLoggedIn || !currentUser) return;
        if (userProfile && !profileServerSynced) return;

        // If userProfile is loaded, make a smart decision
        if (userProfile) {
            if (needsEmailPasswordVerification(currentUser, userProfile)) {
                navigate('/verify-email', { replace: true });
                return;
            }
            if (shouldLandOnAdminDashboard(currentUser, userProfile)) {
                navigate('/admin/dashboard', { replace: true });
                return;
            }
            if (isBusinessUser(userProfile)) {
                navigate('/business-dashboard', { replace: true });
                return;
            }
            const isCompleteAfterVerify = userProfile.isProfileComplete || (
                (userProfile.displayName || userProfile.display_name || userProfile.nickname) &&
                userProfile.gender &&
                (userProfile.ageCategory || userProfile.age)
            );
            if (!isCompleteAfterVerify) {
                navigate('/complete-profile', { replace: true });
            } else {
                navigate('/posts-feed', { replace: true });
            }
            return;
        }

        // Fail-safe: if profile doesn't load quickly, avoid sending known admins through `/` + HomeRouter churn.
        const tmr = setTimeout(() => {
            if (shouldLandOnAdminDashboard(currentUser, null)) {
                navigate('/admin/dashboard', { replace: true });
            } else {
                navigate('/', { replace: true });
            }
        }, 1500);
        return () => clearTimeout(tmr);
    }, [justLoggedIn, currentUser, userProfile, profileServerSynced, navigate]);

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
                'password_reset_done_sign_in',
                'Password updated. You can sign in with email or social login if you linked those accounts.'
            ),
            'success'
        );

        // Only clear React Router state (SPA flows). Do not navigate to strip ?passwordReset=1 — that
        // sync issue caused login regressions; the query param is harmless in the URL.
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

    const handleEmailSubmit = async (e) => {
        e.preventDefault();
        setError('');
        const em = email.trim().toLowerCase();
        if (!em || !password) {
            setError(t('auth_email_password_required', 'Enter your email and password.'));
            return;
        }
        if (password.length < 6) {
            setError(t('password_min_6_chars', 'Password must be at least 6 characters'));
            return;
        }
        setLoading(true);
        try {
            if (emailTab === 'signup') {
                await registerWithEmail(em, password);
            } else {
                await signInWithEmail(em, password);
            }
            setJustLoggedIn(true);
        } catch (err) {
            if (err.code === 'auth/business-email-in-use') {
                setError(
                    t(
                        'auth_business_email_conflict',
                        'This email is registered as a business. Use Business sign-in.'
                    )
                );
            } else {
                setError(getAuthErrorMessage(err) || err.message);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleForgotPassword = async () => {
        const em = email.trim().toLowerCase();
        if (!em) {
            setError(t('auth_enter_email_reset', 'Enter your email in the field above, then tap again to send the reset link.'));
            return;
        }
        setLoading(true);
        setError('');
        try {
            await sendPasswordResetToEmail(em);
            showToast(t('auth_reset_email_sent', 'Check your inbox for a password reset link.'), 'success');
        } catch (err) {
            setError(getAuthErrorMessage(err) || err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleOAuth = async (provider) => {
        setLoading(true);
        setError('');
        try {
            if (provider === 'google') {
                await signInWithGoogle();
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
                        'Sign in or create a personal account with Google, Facebook, or email.'
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
                    </div>

                    <div
                        style={{
                            marginTop: '1rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                        }}
                    >
                        <div style={{ flex: 1, height: 1, background: '#e5e7eb' }} />
                        <span style={{ fontSize: '0.8rem', color: '#6b7280', fontWeight: 600 }}>
                            {t('login_divider_or', 'or')}
                        </span>
                        <div style={{ flex: 1, height: 1, background: '#e5e7eb' }} />
                    </div>

                    <button
                        type="button"
                        onClick={() => {
                            setEmailPanelOpen((o) => !o);
                            setError('');
                        }}
                        disabled={loading}
                        className="personal-auth-email-toggle"
                        style={{
                            ...btn,
                            marginTop: '0.85rem',
                            opacity: loading ? 0.65 : 1,
                            fontWeight: 800,
                        }}
                    >
                        <FaEnvelope size={18} color="#111827" aria-hidden />
                        {emailPanelOpen
                            ? t('auth_personal_hide_email', 'Hide email form')
                            : t('auth_personal_show_email', 'Sign in with email')}
                    </button>

                    {emailPanelOpen && (
                        <form
                            className="personal-auth-email-form"
                            onSubmit={handleEmailSubmit}
                            style={{
                                marginTop: '0.85rem',
                                padding: '0.85rem',
                                borderRadius: '12px',
                                border: '1px solid #e5e7eb',
                                background: '#f9fafb',
                            }}
                        >
                            <div
                                role="tablist"
                                aria-label={t('login_tablist_label', 'Account type')}
                                style={{ display: 'flex', gap: 8, marginBottom: '0.75rem' }}
                            >
                                <button
                                    type="button"
                                    role="tab"
                                    aria-selected={emailTab === 'signin'}
                                    onClick={() => {
                                        setEmailTab('signin');
                                        setError('');
                                    }}
                                    style={{
                                        flex: 1,
                                        padding: '8px 10px',
                                        borderRadius: '8px',
                                        border:
                                            emailTab === 'signin'
                                                ? '2px solid #2563eb'
                                                : '1px solid #d1d5db',
                                        background: emailTab === 'signin' ? '#eff6ff' : '#fff',
                                        fontWeight: 800,
                                        fontSize: '0.85rem',
                                        cursor: 'pointer',
                                        color: '#111827',
                                    }}
                                >
                                    {t('user_login_title', 'Sign in')}
                                </button>
                                <button
                                    type="button"
                                    role="tab"
                                    aria-selected={emailTab === 'signup'}
                                    onClick={() => {
                                        setEmailTab('signup');
                                        setError('');
                                    }}
                                    style={{
                                        flex: 1,
                                        padding: '8px 10px',
                                        borderRadius: '8px',
                                        border:
                                            emailTab === 'signup'
                                                ? '2px solid #2563eb'
                                                : '1px solid #d1d5db',
                                        background: emailTab === 'signup' ? '#eff6ff' : '#fff',
                                        fontWeight: 800,
                                        fontSize: '0.85rem',
                                        cursor: 'pointer',
                                        color: '#111827',
                                    }}
                                >
                                    {t('create_account', 'Create account')}
                                </button>
                            </div>

                            <label
                                htmlFor="personal-auth-email"
                                style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#374151', marginBottom: 4 }}
                            >
                                {t('email', 'Email')}
                            </label>
                            <div style={{ position: 'relative', marginBottom: '0.65rem' }}>
                                <FaEnvelope
                                    style={{
                                        position: 'absolute',
                                        left: 12,
                                        top: '50%',
                                        transform: 'translateY(-50%)',
                                        color: '#9ca3af',
                                        pointerEvents: 'none',
                                    }}
                                    size={14}
                                    aria-hidden
                                />
                                <input
                                    id="personal-auth-email"
                                    type="email"
                                    autoComplete="email"
                                    value={email}
                                    onChange={(ev) => setEmail(ev.target.value)}
                                    placeholder={t('email_placeholder', 'Email')}
                                    style={{
                                        width: '100%',
                                        padding: '10px 12px 10px 36px',
                                        borderRadius: '10px',
                                        border: '1px solid #d1d5db',
                                        fontSize: '0.95rem',
                                        boxSizing: 'border-box',
                                        background: '#fff',
                                    }}
                                />
                            </div>

                            <label
                                htmlFor="personal-auth-password"
                                style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#374151', marginBottom: 4 }}
                            >
                                {t('password', 'Password')}
                            </label>
                            <div style={{ position: 'relative', marginBottom: '0.65rem' }}>
                                <FaLock
                                    style={{
                                        position: 'absolute',
                                        left: 12,
                                        top: '50%',
                                        transform: 'translateY(-50%)',
                                        color: '#9ca3af',
                                        pointerEvents: 'none',
                                    }}
                                    size={14}
                                    aria-hidden
                                />
                                <input
                                    id="personal-auth-password"
                                    type="password"
                                    autoComplete={emailTab === 'signup' ? 'new-password' : 'current-password'}
                                    value={password}
                                    onChange={(ev) => setPassword(ev.target.value)}
                                    placeholder={t('password_placeholder', 'Password (at least 6 characters)')}
                                    style={{
                                        width: '100%',
                                        padding: '10px 12px 10px 36px',
                                        borderRadius: '10px',
                                        border: '1px solid #d1d5db',
                                        fontSize: '0.95rem',
                                        boxSizing: 'border-box',
                                        background: '#fff',
                                    }}
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="personal-auth-primary-submit"
                                style={{
                                    width: '100%',
                                    marginTop: '0.25rem',
                                    padding: '12px',
                                    borderRadius: '10px',
                                    border: 'none',
                                    background: '#2563eb',
                                    color: '#fff',
                                    fontWeight: 800,
                                    fontSize: '0.95rem',
                                    cursor: loading ? 'not-allowed' : 'pointer',
                                    opacity: loading ? 0.65 : 1,
                                }}
                            >
                                {emailTab === 'signin'
                                    ? t('login_btn', 'Login')
                                    : t('create_account_btn', 'Create Account')}
                            </button>

                            {emailTab === 'signin' && (
                                <button
                                    type="button"
                                    onClick={handleForgotPassword}
                                    disabled={loading}
                                    style={{
                                        background: 'none',
                                        border: 'none',
                                        color: '#2563eb',
                                        fontSize: '0.82rem',
                                        fontWeight: 700,
                                        cursor: loading ? 'not-allowed' : 'pointer',
                                        marginTop: '0.65rem',
                                        width: '100%',
                                        textDecoration: 'underline',
                                    }}
                                >
                                    {t('forgot_password', 'Forgot password?')}
                                </button>
                            )}
                        </form>
                    )}

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
