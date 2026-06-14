import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';

/**
 * Consumer pricing — Dine Credits only (shared with business accounts).
 * Business subscriptions: /settings/subscription (Free vs Paid $29).
 */
const PricingPage = () => {
    const navigate = useNavigate();
    const { userProfile } = useAuth();
    const { t } = useTranslation();

    useEffect(() => {
        if (userProfile?.role === 'business' || userProfile?.isBusiness) {
            navigate('/settings/subscription', { replace: true });
        }
    }, [userProfile, navigate]);

    return (
        <div
            style={{
                minHeight: '100vh',
                background: 'var(--bg-body)',
                padding: '2rem 1rem 4rem',
                fontFamily: 'var(--font-body)',
            }}
        >
            <div style={{ maxWidth: '560px', margin: '0 auto' }}>
                <div style={{ textAlign: 'center', marginBottom: '1.5rem', color: 'var(--text-main)' }}>
                    <h1 style={{ fontSize: '2.5rem', fontWeight: '900', marginBottom: '0.5rem' }}>
                        {t('credits_pricing_page_title', 'Credits & add-ons')}
                    </h1>
                    <p style={{ fontSize: '1.1rem', color: 'var(--text-muted)', lineHeight: 1.55 }}>
                        {t(
                            'credits_pricing_page_subtitle',
                            'Dine Credits are shared by all accounts: private invites, date invites, AI, and more. Buy packs in your wallet — final per-use pricing may be announced later.'
                        )}
                    </p>
                </div>

                <div
                    className="glass-card"
                    style={{
                        padding: '2rem',
                        textAlign: 'center',
                        border: '1px solid var(--border-color)',
                    }}
                >
                    <h2 style={{ color: 'var(--text-main)', fontSize: '1.5rem', fontWeight: '900', marginBottom: '0.75rem' }}>
                        {t('dine_credits_wallet_card_title', 'Dine Credits wallet')}
                    </h2>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: 1.55, marginBottom: '1.25rem' }}>
                        {t(
                            'dine_credits_wallet_card_body',
                            'Buy credit packs in one place. The same balance covers private invitations, date invitations, AI tools, and other in-app features.'
                        )}
                    </p>
                    <button
                        type="button"
                        onClick={() => navigate('/settings/credits')}
                        style={{
                            padding: '0.85rem 1.75rem',
                            borderRadius: '14px',
                            border: 'none',
                            background: 'linear-gradient(135deg, var(--primary), var(--accent))',
                            color: '#fff',
                            fontWeight: '800',
                            fontSize: '1rem',
                            cursor: 'pointer',
                            boxShadow: '0 8px 24px rgba(139,92,246,0.35)',
                        }}
                    >
                        {t('open_dine_credits_wallet', 'Open Dine Credits wallet')}
                    </button>
                </div>

                <div
                    style={{
                        textAlign: 'center',
                        marginTop: '2rem',
                        color: 'var(--text-muted)',
                        fontSize: '0.9rem',
                    }}
                >
                    <p>{t('Secure payment processed by Stripe', 'Secure payment processed by Stripe')}</p>
                </div>
            </div>
        </div>
    );
};

export default PricingPage;
