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
        <div className="settings-page credits-wallet-page">
            <div className="settings-header credits-wallet__header">
                <button type="button" onClick={() => navigate('/settings')} className="back-btn">
                    <FaArrowLeft />
                </button>
                <h1>{t('dine_credits', 'Dine Credits')}</h1>
                <div style={{ width: 40 }} />
            </div>

            <div className="settings-content credits-wallet__content">
                <div className="credits-wallet__column">
                    <div className="settings-card credits-wallet__balance">
                        <h2>{t('your_balance', 'Your balance')}</h2>
                        <p className="settings-description credits-wallet__note">
                            {t('credit_value_note', '1 credit = $0.01 USD. Free credits are capped at 20 and refresh monthly (10/mo). Paid credits never expire.')}
                        </p>
                        <div className="credits-wallet__stats">
                            <div className="credits-wallet__stat-row">
                                <span>{t('free_credits', 'Free credits')}</span>
                                <strong>{free}</strong>
                            </div>
                            <div className="credits-wallet__stat-row">
                                <span>{t('paid_credits', 'Paid credits')}</span>
                                <strong>{paid}</strong>
                            </div>
                            <div className="credits-wallet__stat-row credits-wallet__stat-row--total">
                                <span>{t('total_credits', 'Total')}</span>
                                <strong>{total}</strong>
                            </div>
                            <div className="credits-wallet__stat-meta">
                                {t('lifetime_stats', 'Lifetime purchased')}: {purchased} · {t('lifetime_spent', 'spent')}: {spent}
                            </div>
                        </div>
                    </div>

                    <h3 className="credits-wallet__buy-heading">{t('buy_credits', 'Buy credits')}</h3>
                    <div className="credits-wallet__pack-grid">
                        {PACKS.map((pack) => (
                            <div
                                key={pack.id}
                                className={`settings-card credits-wallet__pack${pack.highlight ? ' credits-wallet__pack--highlight' : ''}`}
                            >
                                {pack.highlight ? (
                                    <span className="credits-wallet__badge">{t('best_value', 'Best value')}</span>
                                ) : null}
                                <div className="credits-wallet__pack-label">{pack.label}</div>
                                <div className="credits-wallet__pack-price">{pack.price}</div>
                                {pack.sub ? <div className="credits-wallet__pack-sub">{pack.sub}</div> : null}
                                <button
                                    type="button"
                                    className="credits-wallet__buy-btn"
                                    disabled={loadingId !== null}
                                    onClick={() => buyPack(pack)}
                                >
                                    {loadingId === pack.id ? t('loading', 'Loading…') : t('buy_now_short', 'Buy')}
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
