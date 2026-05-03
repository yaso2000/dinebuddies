import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { HiBuildingStorefront } from 'react-icons/hi2';
import { FaEnvelope, FaLock, FaArrowRight, FaEye, FaEyeSlash } from 'react-icons/fa';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { getAuthErrorMessage } from '../../utils/errorMessages';

/**
 * Business email/password sign-in.
 * @param embedInHub — hide "regular user" link when nested in LoginHub.
 * @param embeddedInSingleCard — lighter chrome inside LoginHub’s one shared card.
 */
export default function BusinessLoginPanel({ embedInHub = false, embeddedInSingleCard = false }) {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { showToast } = useToast();
    const { signInWithEmail, sendPasswordResetToEmail, userProfile, signOut, loading: authLoading } = useAuth();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [justLoggedIn, setJustLoggedIn] = useState(false);

    useEffect(() => {
        if (!justLoggedIn || authLoading) return;
        if (!userProfile) return;
        const isBiz = userProfile.isBusiness || userProfile.role === 'business';
        if (isBiz) {
            navigate('/business-dashboard', { replace: true });
        } else {
            setError(t('business_login_only', 'This login is for business accounts only. Use the regular sign-in for personal accounts.'));
            setJustLoggedIn(false);
            signOut().catch(() => {});
        }
    }, [justLoggedIn, userProfile, authLoading, navigate, signOut, t]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            await signInWithEmail(email, password);
            setJustLoggedIn(true);
        } catch (err) {
            setError(getAuthErrorMessage(err) || err.message || t('login_error', 'Sign-in failed'));
        } finally {
            setLoading(false);
        }
    };

    const handleForgotPassword = async () => {
        const em = email.trim().toLowerCase();
        if (!em) {
            setError(
                t(
                    'auth_enter_email_reset',
                    'Enter your email in the field above, then tap again to send the reset link.'
                )
            );
            return;
        }
        setLoading(true);
        setError('');
        try {
            await sendPasswordResetToEmail(em);
            showToast(
                t('auth_reset_email_sent', 'Check your inbox for a password reset link.'),
                'success'
            );
        } catch (err) {
            setError(getAuthErrorMessage(err) || err.message || t('auth_reset_failed', 'Could not send reset email.'));
        } finally {
            setLoading(false);
        }
    };

    const card = embeddedInSingleCard
        ? {
              display: 'flex',
              flexDirection: 'column',
              width: '100%',
              maxWidth: '100%',
              margin: 0,
              padding: '0.85rem',
              borderRadius: '12px',
              border: 'none',
              background: 'color-mix(in srgb, var(--primary) 8%, transparent)',
              backdropFilter: 'none',
              WebkitBackdropFilter: 'none',
              boxShadow: 'none',
              minHeight: 0,
              boxSizing: 'border-box',
          }
        : {
              display: 'flex',
              flexDirection: 'column',
              width: '100%',
              maxWidth: '480px',
              margin: '0 auto',
              padding: 'clamp(1rem, 4.5vw, 1.35rem)',
              borderRadius: '16px',
              border: '1px solid color-mix(in srgb, var(--primary) 18%, var(--border-color))',
              background: 'var(--bg-card)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              boxShadow: '0 24px 56px rgba(0,0,0,0.45), 0 0 0 1px color-mix(in srgb, var(--primary) 12%, transparent)',
              minHeight: 0,
              boxSizing: 'border-box',
          };

    const primaryBtn = {
        width: '100%',
        padding: '14px',
        borderRadius: '14px',
        border: 'none',
        background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-hover) 100%)',
        color: '#fff',
        fontWeight: 800,
        cursor: loading ? 'wait' : 'pointer',
        fontSize: '1rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '10px',
        boxShadow: '0 8px 24px color-mix(in srgb, var(--primary) 35%, transparent)',
    };

    const outlineBtn = {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        width: '100%',
        padding: '12px',
        borderRadius: '12px',
        background: 'color-mix(in srgb, var(--primary) 10%, transparent)',
        border: '1px solid color-mix(in srgb, var(--primary) 35%, transparent)',
        color: 'var(--primary)',
        fontWeight: 700,
        cursor: 'pointer',
        fontSize: '0.9rem',
    };

    const iconBox = embeddedInSingleCard
        ? {
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              margin: '0 auto 0.65rem',
              background: 'linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.35rem',
              boxShadow: '0 4px 16px color-mix(in srgb, var(--primary) 35%, transparent)',
          }
        : {
              width: '56px',
              height: '56px',
              borderRadius: '14px',
              margin: '0 auto 1rem',
              background: 'linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.75rem',
              boxShadow: '0 8px 24px color-mix(in srgb, var(--primary) 40%, transparent)',
          };

    return (
        <div
            id={embeddedInSingleCard ? undefined : 'business-login-panel'}
            className="business-auth-panel"
            style={{ width: '100%', minWidth: 0 }}
        >
            <div
                className={embeddedInSingleCard ? 'business-auth-card business-auth-card--embedded' : 'glass-card business-auth-card'}
                style={card}
            >
                <div className="auth-luxury-ribbon auth-luxury-ribbon--business">
                    <HiBuildingStorefront aria-hidden />
                    <span>{t('business_login', 'Business')}</span>
                </div>
                <div style={{ textAlign: 'center', marginBottom: embeddedInSingleCard ? '0.85rem' : '1.25rem' }}>
                    <div style={iconBox}>
                        <HiBuildingStorefront style={{ color: '#fff' }} />
                    </div>
                    <h2
                        style={{
                            fontSize: embeddedInSingleCard
                                ? 'clamp(1.05rem, 3vw, 1.25rem)'
                                : 'clamp(1.2rem, 3.5vw, 1.5rem)',
                            fontWeight: 900,
                            margin: '0 0 0.35rem',
                            background: 'linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%)',
                            WebkitBackgroundClip: 'text',
                            backgroundClip: 'text',
                            color: 'transparent',
                        }}
                    >
                        {t('business_login_title', 'Business Login')}
                    </h2>
                    <p style={{ color: 'var(--text-muted)', fontSize: embeddedInSingleCard ? '0.85rem' : '0.92rem', margin: 0 }}>
                        {t('business_login_subtitle', 'Sign in to your DineBuddies business account')}
                    </p>
                </div>

                {error && (
                    <div
                        style={{
                            background: 'color-mix(in srgb, var(--color-danger) 15%, transparent)',
                            color: 'var(--color-danger)',
                            padding: '0.75rem',
                            borderRadius: '12px',
                            marginBottom: '1rem',
                            fontSize: '0.85rem',
                            textAlign: 'center',
                            border: '1px solid color-mix(in srgb, var(--color-danger) 25%, transparent)',
                        }}
                    >
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="business-auth-form">
                    <div style={{ marginBottom: '1rem' }}>
                        <div style={{ position: 'relative' }}>
                            <FaEnvelope
                                style={{
                                    position: 'absolute',
                                    left: '1rem',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    color: 'color-mix(in srgb, var(--primary) 55%, var(--text-muted))',
                                    fontSize: '0.9rem',
                                }}
                            />
                            <input
                                type="email"
                                autoComplete="email"
                                placeholder={t('business_email', 'Business email')}
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                style={{
                                    width: '100%',
                                    padding: '12px 1rem 12px 2.75rem',
                                    borderRadius: '12px',
                                    background: 'var(--bg-input)',
                                    border: '1px solid var(--border-color)',
                                    fontSize: '1rem',
                                    boxSizing: 'border-box',
                                }}
                            />
                        </div>
                    </div>
                    <div style={{ marginBottom: '1.25rem' }}>
                        <div style={{ position: 'relative' }}>
                            <FaLock
                                style={{
                                    position: 'absolute',
                                    left: '1rem',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    color: 'color-mix(in srgb, var(--primary) 55%, var(--text-muted))',
                                    fontSize: '0.9rem',
                                }}
                            />
                            <input
                                type={showPassword ? 'text' : 'password'}
                                autoComplete="current-password"
                                placeholder={t('password', 'Password')}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                style={{
                                    width: '100%',
                                    padding: '12px 3rem 12px 2.75rem',
                                    borderRadius: '12px',
                                    background: 'var(--bg-input)',
                                    border: '1px solid var(--border-color)',
                                    fontSize: '1rem',
                                    boxSizing: 'border-box',
                                }}
                            />
                            <button
                                type="button"
                                aria-label={showPassword ? t('hide_password', 'Hide password') : t('show_password', 'Show password')}
                                onClick={() => setShowPassword(!showPassword)}
                                style={{
                                    position: 'absolute',
                                    right: '0.65rem',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    background: 'none',
                                    border: 'none',
                                    color: 'var(--text-muted)',
                                    cursor: 'pointer',
                                    padding: '4px',
                                    display: 'flex',
                                }}
                            >
                                {showPassword ? <FaEyeSlash /> : <FaEye />}
                            </button>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={handleForgotPassword}
                        disabled={loading}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--primary)',
                            fontSize: '0.82rem',
                            fontWeight: 700,
                            cursor: loading ? 'not-allowed' : 'pointer',
                            marginBottom: '0.85rem',
                            width: '100%',
                            textAlign: 'right',
                            textDecoration: 'underline',
                            padding: 0,
                            fontFamily: 'inherit',
                        }}
                    >
                        {t('forgot_password', 'Forgot password?')}
                    </button>
                    <button type="submit" disabled={loading} style={primaryBtn}>
                        {loading ? t('loading', 'Loading...') : t('sign_in', 'Sign In')}
                        {!loading && <FaArrowRight />}
                    </button>
                </form>

                <div
                    style={{
                        marginTop: '1.5rem',
                        paddingTop: '1.25rem',
                        borderTop: '1px solid color-mix(in srgb, var(--primary) 12%, var(--border-color))',
                        textAlign: 'center',
                    }}
                >
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '0.75rem' }}>
                        {t('no_business_account', "Don't have a business account?")}
                    </p>
                    <button type="button" onClick={() => navigate('/business/signup')} style={outlineBtn}>
                        {t('create_business_account', 'Create Business Account')}
                    </button>
                    {!embedInHub && (
                        <p style={{ marginTop: '1.25rem', fontSize: '0.88rem' }}>
                            <Link
                                to="/login"
                                style={{ color: 'var(--primary)', fontWeight: 600, textDecoration: 'underline' }}
                            >
                                {t('regular_user_sign_in', 'Regular user? Sign in here')}
                            </Link>
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}
