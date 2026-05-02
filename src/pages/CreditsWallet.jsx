import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { getFunctions, httpsCallable } from 'firebase/functions';
import app from '../firebase/config';
import { FaArrowLeft } from 'react-icons/fa';
import './SettingsPages.css';

const FUNCTIONS_REGION = 'us-central1';

const PACKS = [
    { id: 'credits_200', label: '200 Credits', price: '$2', sub: '' },
    { id: 'credits_500', label: '500 Credits', price: '$5', sub: '' },
    { id: 'credits_1000', label: '1000 Credits', price: '$10', sub: '' },
    { id: 'credits_3000', label: '3000 Credits', price: '$25', sub: 'Best value', highlight: true },
];

/**
 * Dine Credits wallet — one-time Stripe checkouts (server maps package → price).
 */
export default function CreditsWallet() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { userProfile } = useAuth();
    const [loadingId, setLoadingId] = useState(null);

    const free = Math.max(0, Number(userProfile?.freeCredits) || 0);
    const paid = Math.max(0, Number(userProfile?.paidCredits) || 0);
    const total = free + paid;
    const purchased = Math.max(0, Number(userProfile?.totalCreditsPurchased) || 0);
    const spent = Math.max(0, Number(userProfile?.totalCreditsSpent) || 0);

    const buyPack = async (pack) => {
        setLoadingId(pack.id);
        try {
            const fn = httpsCallable(getFunctions(app, FUNCTIONS_REGION), 'createCreditsCheckoutSession');
            const origin = window.location.origin;
            const result = await fn({
                packageId: pack.id,
                successUrl: `${origin}/settings/credits?purchase=success`,
                cancelUrl: `${origin}/settings/credits`,
            });
            const url = result.data?.url;
            if (url) window.location.href = url;
        } catch (e) {
            console.error(e);
            alert(e?.message || 'Could not start checkout.');
        } finally {
            setLoadingId(null);
        }
    };

    return (
        <div className="settings-page">
            <div className="settings-header">
                <button type="button" onClick={() => navigate('/settings')} className="back-btn">
                    <FaArrowLeft />
                </button>
                <h1>{t('dine_credits', 'Dine Credits')}</h1>
                <div style={{ width: 40 }} />
            </div>

            <div className="settings-content">
                <div className="settings-card">
                    <h2>{t('your_balance', 'Your balance')}</h2>
                    <p className="settings-description">
                        {t('credit_value_note', '1 credit = $0.01 USD. Free credits are capped at 20 and refresh monthly (10/mo). Paid credits never expire.')}
                    </p>
                    <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
                        <div style={{ fontSize: '1.1rem', fontWeight: 800 }}>
                            {t('free_credits', 'Free credits')}: <span style={{ color: 'var(--primary)' }}>{free}</span>
                        </div>
                        <div style={{ fontSize: '1.1rem', fontWeight: 800 }}>
                            {t('paid_credits', 'Paid credits')}: <span style={{ color: 'var(--primary)' }}>{paid}</span>
                        </div>
                        <div style={{ fontSize: '1.35rem', fontWeight: 900 }}>
                            {t('total_credits', 'Total')}: {total}
                        </div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                            {t('lifetime_stats', 'Lifetime purchased')}: {purchased} · {t('lifetime_spent', 'spent')}: {spent}
                        </div>
                    </div>
                </div>

                <h3 style={{ marginTop: 24, marginBottom: 12, fontSize: '1.05rem' }}>{t('buy_credits', 'Buy credits')}</h3>
                <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
                    {PACKS.map((pack) => (
                        <div
                            key={pack.id}
                            className="settings-card"
                            style={{
                                border: pack.highlight ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                                position: 'relative',
                            }}
                        >
                            {pack.highlight ? (
                                <span
                                    style={{
                                        position: 'absolute',
                                        top: -10,
                                        right: 12,
                                        background: 'var(--primary)',
                                        color: '#fff',
                                        fontSize: '0.7rem',
                                        fontWeight: 800,
                                        padding: '4px 10px',
                                        borderRadius: 8,
                                    }}
                                >
                                    {t('best_value', 'Best value')}
                                </span>
                            ) : null}
                            <div style={{ fontWeight: 800, fontSize: '1.1rem' }}>{pack.label}</div>
                            <div style={{ fontSize: '1.6rem', fontWeight: 900, marginTop: 8 }}>{pack.price}</div>
                            {pack.sub ? <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{pack.sub}</div> : null}
                            <button
                                type="button"
                                className="my-community-btn my-community-btn--post"
                                style={{ marginTop: 14, width: '100%' }}
                                disabled={loadingId !== null}
                                onClick={() => buyPack(pack)}
                            >
                                {loadingId === pack.id ? t('loading', 'Loading…') : t('buy_now', 'Buy now')}
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
