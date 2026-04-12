import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FaStore, FaArrowLeft } from 'react-icons/fa';
import { loginHubCardShell } from '../../theme/businessAuthUi';
import { goToLogin } from '../../utils/goToLogin';

/**
 * Step 2 (next) — Business email login will be built here. Placeholder only.
 */
export default function BusinessAuthPlaceholder() {
    const { t } = useTranslation();

    return (
        <div
            className="auth-route-scroll"
            style={{
                background: 'var(--bg-body)',
                minHeight: '100vh',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'flex-start',
                padding: 'clamp(1rem, 4vh, 2rem) 1rem',
                fontFamily: 'var(--font-body)',
            }}
        >
            <div className="glass-card" style={{ ...loginHubCardShell, maxWidth: 420, width: '100%' }}>
                <button
                    type="button"
                    onClick={() => goToLogin()}
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 8,
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        fontSize: '0.88rem',
                        marginBottom: '1rem',
                        padding: 0,
                    }}
                >
                    <FaArrowLeft /> {t('back', 'Back')}
                </button>

                <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
                    <FaStore style={{ fontSize: '2.5rem', color: '#fbbf24', marginBottom: '0.5rem' }} aria-hidden />
                    <h1 style={{ fontSize: '1.4rem', fontWeight: 900, margin: 0, color: 'var(--primary)' }}>
                        {t('business_login', 'Business login')}
                    </h1>
                </div>

                <p
                    style={{
                        color: 'var(--text-muted)',
                        fontSize: '0.92rem',
                        lineHeight: 1.55,
                        textAlign: 'center',
                        margin: '0 0 1.25rem',
                    }}
                >
                    {t(
                        'auth_business_placeholder_body',
                        'Business sign-in (email and password) will be added in the next step. For now, use a personal account with Google or Facebook.'
                    )}
                </p>

                <Link
                    to="/login"
                    style={{
                        display: 'block',
                        textAlign: 'center',
                        padding: '12px 16px',
                        borderRadius: '14px',
                        background: 'linear-gradient(135deg, var(--primary), #ea580c)',
                        color: '#fff',
                        fontWeight: 800,
                        fontSize: '0.95rem',
                        textDecoration: 'none',
                    }}
                >
                    {t('auth_go_personal_login', 'Go to personal login')}
                </Link>
            </div>
        </div>
    );
}
