import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { reload } from 'firebase/auth';
import { FaEnvelope, FaTimes } from 'react-icons/fa';
import { auth } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { sendVerificationEmailResend, verificationEmailErrorMessage } from '../services/verificationEmailService';

/**
 * Shown for business accounts until Firebase Auth emailVerified is true.
 * Directory visibility is gated in public_profiles (see functions toPublicProfile).
 */
const EmailVerificationBusinessBanner = () => {
    const location = useLocation();
    const { showToast } = useToast();
    const { t } = useTranslation();
    const { currentUser, userProfile, isBusiness } = useAuth();
    const { isDark } = useTheme();
    const opaqueSurface = isDark ? '#1e1e2e' : '#ffffff';
    const [dismissed, setDismissed] = useState(false);
    const [busy, setBusy] = useState(false);

    const pathNorm = (location.pathname || '/').replace(/\/$/, '') || '/';
    if (pathNorm === '/business/onboarding') return null;

    if (!currentUser || !userProfile || !isBusiness) return null;
    if (currentUser.emailVerified) return null;
    if (dismissed) return null;

    const handleResend = async () => {
        setBusy(true);
        try {
            await sendVerificationEmailResend('business_login');
        } catch (e) {
            console.warn(e);
            showToast(
                verificationEmailErrorMessage(e, t('auth_reset_failed', 'Could not send verification email.')),
                'error'
            );
        } finally {
            setBusy(false);
        }
    };

    const handleRecheck = async () => {
        setBusy(true);
        try {
            await reload(auth.currentUser);
        } catch (e) {
            console.warn(e);
        } finally {
            setBusy(false);
        }
    };

    return (
        <div
            style={{
                backgroundColor: opaqueSurface,
                backgroundImage: 'linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(139, 92, 246, 0.12))',
                border: '1px solid rgba(59, 130, 246, 0.45)',
                borderLeft: '4px solid #3b82f6',
                margin: '16px 16px 0 16px',
                padding: '14px 16px',
                borderRadius: '14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                position: 'sticky',
                top: 0,
                zIndex: 100051,
                isolation: 'isolate',
                pointerEvents: 'auto',
                boxShadow: '0 8px 28px rgba(0,0,0,0.35)',
            }}
        >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                    <div
                        style={{
                            background: 'rgba(59, 130, 246, 0.15)',
                            padding: '10px',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        <FaEnvelope style={{ color: '#3b82f6', fontSize: '1.2rem' }} />
                    </div>
                    <div>
                        <div style={{ fontSize: '0.95rem', fontWeight: '800', color: 'var(--text-main)', marginBottom: '4px' }}>
                            {t('business_email_verify_banner_title', 'Verify your email to appear publicly')}
                        </div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                            {t(
                                'business_email_verify_banner_desc',
                                'Your business works in the app, but it stays hidden from the Partners page and public discovery until you verify your email. Changing your email requires verifying the new address.'
                            )}
                        </div>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={() => setDismissed(true)}
                    style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        padding: '6px',
                        borderRadius: '50%',
                    }}
                    title={t('dismiss', 'Dismiss')}
                >
                    <FaTimes size={16} />
                </button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                <button
                    type="button"
                    disabled={busy}
                    onClick={handleResend}
                    style={{
                        padding: '10px 16px',
                        borderRadius: '10px',
                        border: 'none',
                        background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                        color: '#fff',
                        fontWeight: '700',
                        fontSize: '0.85rem',
                        cursor: busy ? 'wait' : 'pointer',
                        opacity: busy ? 0.8 : 1,
                    }}
                >
                    {busy ? '…' : t('business_email_verify_btn_resend', 'Resend activation link')}
                </button>
                <button
                    type="button"
                    disabled={busy}
                    onClick={handleRecheck}
                    style={{
                        padding: '10px 16px',
                        borderRadius: '10px',
                        border: '1px solid var(--border-color)',
                        background: 'var(--bg-input)',
                        color: 'var(--text-main)',
                        fontWeight: '600',
                        fontSize: '0.85rem',
                        cursor: busy ? 'wait' : 'pointer',
                    }}
                >
                    {t('business_email_verify_btn_recheck', "I've activated my email — refresh")}
                </button>
            </div>
        </div>
    );
};

export default EmailVerificationBusinessBanner;
