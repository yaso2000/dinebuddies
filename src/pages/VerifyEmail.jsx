import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { reload } from 'firebase/auth';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { auth } from '../firebase/config';
import { needsEmailPasswordVerification } from '../utils/emailVerification';
import { sendVerificationEmailResend, verificationEmailErrorMessage } from '../services/verificationEmailService';
import { FaEnvelope, FaCheckCircle, FaSignOutAlt, FaRedo } from 'react-icons/fa';
import { goToLogin } from '../utils/goToLogin';

const VerifyEmail = () => {
    const { t } = useTranslation();
    const { showToast } = useToast();
    const navigate = useNavigate();
    const { currentUser, userProfile, loading, signOut } = useAuth();
    const [resending, setResending] = useState(false);
    const [checking, setChecking] = useState(false);

    const goNext = useCallback(() => {
        if (userProfile?.isBusiness) {
            const uid = userProfile.uid || currentUser?.uid;
            if (uid) {
                navigate(`/business/${uid}`, {
                    replace: true,
                    state: { businessProfileSetupReminder: true },
                });
                return;
            }
        }
        navigate('/', { replace: true });
    }, [navigate, userProfile?.isBusiness, userProfile?.uid, currentUser?.uid]);

    useEffect(() => {
        if (loading) return;
        if (!currentUser) {
            goToLogin({ replace: true });
            return;
        }
        if (needsEmailPasswordVerification(currentUser, userProfile)) {
            return;
        }
        if (!userProfile) {
            return;
        }
        goNext();
    }, [loading, currentUser, userProfile, navigate, goNext]);

    const handleResend = async () => {
        setResending(true);
        try {
            await sendVerificationEmailResend('home');
            showToast(t('verify_email_resent', 'Verification email sent. Check your inbox.'), 'success');
        } catch (err) {
            showToast(
                verificationEmailErrorMessage(err, t('auth_reset_failed', 'Could not send verification email.')),
                'error'
            );
        } finally {
            setResending(false);
        }
    };

    const handleCheckVerified = async () => {
        setChecking(true);
        try {
            const u = auth.currentUser;
            if (!u) return;
            await reload(u);
            if (auth.currentUser?.emailVerified) {
                showToast(t('verify_email_confirmed', 'Email verified. Welcome!'), 'success');
                setTimeout(() => goNext(), 0);
            } else {
                showToast(t('verify_email_still_pending', 'Not verified yet. Open the link in the email we sent.'), 'info');
            }
        } catch (e) {
            showToast(t('verify_email_check_failed', 'Could not refresh status. Try again.'), 'error');
        } finally {
            setChecking(false);
        }
    };

    const handleSignOut = async () => {
        try {
            await signOut('/login');
        } catch {
            showToast(t('verify_email_logout_error', 'Could not sign out.'), 'error');
        }
    };

    if (loading || !currentUser) {
        return (
            <div style={{ 
                minHeight: '100dvh', 
                width: '100%',
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                background: 'linear-gradient(160deg, #0f0817 0%, #090c1a 60%, #0d0812 100%)' 
            }}>
                <div style={{ width: 44, height: 44, border: '4px solid rgba(148, 163, 184, 0.15)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 0.9s linear infinite' }} />
            </div>
        );
    }

    const email = currentUser.email || '';

    return (
        <div
            className="auth-route-scroll"
            style={{
                minHeight: '100dvh',
                width: '100%',
                background: 'linear-gradient(160deg, #0f0817 0%, #090c1a 60%, #0d0812 100%)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '1.5rem',
                fontFamily: 'var(--font-body)',
            }}
        >
            <div style={{
                width: '100%',
                maxWidth: 440,
                background: 'var(--bg-card)',
                borderRadius: 24,
                padding: '1.75rem',
                border: '1px solid var(--border-color)',
                boxShadow: '0 16px 40px rgba(0,0,0,0.25)',
            }}>
                <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
                    <img src="/db-logo.svg" alt="" style={{ width: 56, height: 56, objectFit: 'contain', marginBottom: 12 }} />
                    <h1 style={{ fontSize: '1.35rem', fontWeight: 900, color: 'var(--text-main)', margin: '0 0 0.35rem' }}>
                        {t('verify_email_title', 'Activate your account')}
                    </h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0, lineHeight: 1.5 }}>
                        {t('verify_email_subtitle', 'We sent a verification link to:')}
                    </p>
                    <p style={{ color: 'var(--primary)', fontWeight: 700, fontSize: '0.95rem', marginTop: 8, wordBreak: 'break-all' }}>
                        {email}
                    </p>
                </div>

                <div style={{
                    background: 'rgba(99, 102, 241, 0.08)',
                    border: '1px solid rgba(99, 102, 241, 0.25)',
                    borderRadius: 14,
                    padding: '1rem',
                    marginBottom: '1.25rem',
                    fontSize: '0.88rem',
                    color: 'var(--text-secondary)',
                    lineHeight: 1.55,
                }}>
                    <FaEnvelope style={{ verticalAlign: 'middle', marginInlineEnd: 8 }} />
                    {t('verify_email_hint', 'Open the email and tap “Verify Account”. Then return here and tap “I’ve verified”.')}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <button
                        type="button"
                        onClick={handleCheckVerified}
                        disabled={checking}
                        style={{
                            width: '100%',
                            padding: '0.9rem',
                            borderRadius: 14,
                            border: 'none',
                            background: 'linear-gradient(135deg, var(--primary), #d85a20)',
                            color: '#fff',
                            fontWeight: 800,
                            fontSize: '0.95rem',
                            cursor: checking ? 'wait' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 8,
                        }}
                    >
                        <FaCheckCircle /> {checking ? t('verify_email_checking', 'Checking…') : t('verify_email_cta_done', 'I’ve verified — continue')}
                    </button>

                    <button
                        type="button"
                        onClick={handleResend}
                        disabled={resending}
                        style={{
                            width: '100%',
                            padding: '0.85rem',
                            borderRadius: 14,
                            border: '1px solid var(--border-color)',
                            background: 'var(--bg-input)',
                            color: 'var(--text-main)',
                            fontWeight: 700,
                            fontSize: '0.9rem',
                            cursor: resending ? 'wait' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 8,
                        }}
                    >
                        <FaRedo /> {resending ? t('sending', 'Sending…') : t('verify_email_resend', 'Resend email')}
                    </button>

                    <button
                        type="button"
                        onClick={handleSignOut}
                        style={{
                            width: '100%',
                            padding: '0.75rem',
                            borderRadius: 14,
                            border: 'none',
                            background: 'transparent',
                            color: 'var(--text-muted)',
                            fontWeight: 600,
                            fontSize: '0.85rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 8,
                        }}
                    >
                        <FaSignOutAlt /> {t('verify_email_wrong_account', 'Sign out and use another email')}
                    </button>
                </div>

            </div>
        </div>
    );
};

export default VerifyEmail;
