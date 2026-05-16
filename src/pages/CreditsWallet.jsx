import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { getFunctions, httpsCallable } from 'firebase/functions';
import app from '../firebase/config';
import {
    FaArrowLeft,
    FaWallet,
    FaGift,
    FaCoins,
    FaGem,
    FaCrown,
    FaBolt,
    FaMagic,
    FaLock,
    FaHeart,
    FaInfoCircle,
} from 'react-icons/fa';
import './SettingsPages.css';

const FUNCTIONS_REGION = 'us-central1';

const PACKS = [
    { id: 'credits_200', credits: 200, price: '$2', sub: '', icon: FaBolt, accent: 'credits-wallet__pack-icon--sm' },
    { id: 'credits_500', credits: 500, price: '$5', sub: '', icon: FaCoins, accent: 'credits-wallet__pack-icon--md' },
    { id: 'credits_1000', credits: 1000, price: '$10', sub: '', icon: FaGem, accent: 'credits-wallet__pack-icon--lg' },
    {
        id: 'credits_3000',
        credits: 3000,
        price: '$25',
        sub: 'Best value',
        icon: FaCrown,
        accent: 'credits-wallet__pack-icon--xl',
        highlight: true,
    },
];

/**
 * Dine Credits wallet — one-time Stripe checkouts (server maps package → price).
 */
export default function CreditsWallet() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const { userProfile } = useAuth();
    const { showToast } = useToast();
    const [loadingId, setLoadingId] = useState(null);

    /** After Stripe redirect: grant credits if webhook was not configured (idempotent on server). */
    useEffect(() => {
        const purchase = searchParams.get('purchase');
        const sessionId = searchParams.get('session_id');
        if (purchase !== 'success' || !sessionId) return;

        let cancelled = false;
        (async () => {
            try {
                const fn = httpsCallable(getFunctions(app, FUNCTIONS_REGION), 'fulfillDineCreditsCheckout');
                const res = await fn({ sessionId });
                const credits = res.data?.credits;
                if (!cancelled) {
                    showToast(
                        t('credits_fulfilled_toast', `Added ${credits ?? ''} credits to your wallet.`),
                        'success'
                    );
                    setSearchParams({}, { replace: true });
                }
            } catch (e) {
                console.error(e);
                if (!cancelled) {
                    showToast(
                        e?.message ||
                            t(
                                'credits_fulfill_failed',
                                'Could not confirm credits yet. Refresh the page or contact support if your balance is still wrong.'
                            ),
                        'error'
                    );
                }
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [searchParams, setSearchParams, showToast, t]);

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
            showToast(e?.message || t('checkout_start_failed', 'Could not start checkout.'), 'error');
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
                <div className="credits-wallet__title-block">
                    <h1>{t('dine_credits', 'Dine Credits')}</h1>
                    <p className="credits-wallet__title-sub">
                        {t('credits_wallet_subtitle', 'Private & date invitations — public invites are free')}
                    </p>
                </div>
                <div className="credits-wallet__header-spacer" aria-hidden />
            </div>

            <div className="settings-content credits-wallet__content">
                <div className="credits-wallet__column">
                    <section className="settings-card credits-wallet__balance credits-wallet__balance--elevated">
                        <div className="credits-wallet__balance-top">
                            <div className="credits-wallet__hero-ring" aria-hidden>
                                <FaWallet className="credits-wallet__hero-wallet" />
                            </div>
                            <div className="credits-wallet__hero-copy">
                                <h2 className="credits-wallet__balance-heading">{t('your_balance', 'Your balance')}</h2>
                                <div className="credits-wallet__total-display" aria-live="polite">
                                    <span className="credits-wallet__total-number">{total}</span>
                                    <span className="credits-wallet__total-suffix">
                                        {t('credits_unit', 'credits')}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="credits-wallet__split-stats">
                            <div className="credits-wallet__split-card">
                                <span className="credits-wallet__split-icon credits-wallet__split-icon--free">
                                    <FaGift aria-hidden />
                                </span>
                                <span className="credits-wallet__split-label">{t('free_credits', 'Free')}</span>
                                <span className="credits-wallet__split-value">{free}</span>
                            </div>
                            <div className="credits-wallet__split-card">
                                <span className="credits-wallet__split-icon credits-wallet__split-icon--paid">
                                    <FaCoins aria-hidden />
                                </span>
                                <span className="credits-wallet__split-label">{t('paid_credits', 'Paid')}</span>
                                <span className="credits-wallet__split-value">{paid}</span>
                            </div>
                        </div>

                        <div className="credits-wallet__lifetime">
                            <span className="credits-wallet__lifetime-dot" aria-hidden />
                            {t('lifetime_stats', 'Lifetime purchased')}: <strong>{purchased}</strong>
                            <span className="credits-wallet__lifetime-sep">·</span>
                            {t('lifetime_spent', 'spent')}: <strong>{spent}</strong>
                        </div>

                        <div className="credits-wallet__hints">
                            <div className="credits-wallet__hints-title">
                                <FaInfoCircle aria-hidden />
                                {t('credits_how_title', 'How it works')}
                            </div>
                            <ul className="credits-wallet__hints-list">
                                <li>
                                    <FaBolt className="credits-wallet__hint-ico" aria-hidden />
                                    {t('credit_hint_rate', '1 credit ≈ $0.01 USD when you buy packs.')}
                                </li>
                                <li>
                                    <FaGift className="credits-wallet__hint-ico" aria-hidden />
                                    {t('credit_hint_free', 'Free credits: up to 20, +10 refreshed each month.')}
                                </li>
                                <li>
                                    <FaCoins className="credits-wallet__hint-ico" aria-hidden />
                                    {t('credit_hint_paid', 'Paid credits never expire. Free pool is used first.')}
                                </li>
                                <li>
                                    <span className="credits-wallet__hint-ico credits-wallet__hint-ico--cluster" aria-hidden>
                                        <FaLock /><FaHeart /><FaMagic />
                                    </span>
                                    {t('credit_hint_uses', 'Used when publishing private and date invitations. AI credit use is paused.')}
                                </li>
                            </ul>
                        </div>
                    </section>

                    <section className="credits-wallet__buy-section">
                        <h3 className="credits-wallet__buy-heading">
                            <FaGem className="credits-wallet__buy-heading-icon" aria-hidden />
                            {t('buy_credits', 'Buy credits')}
                        </h3>
                        <p className="credits-wallet__buy-lead">
                            {t('buy_credits_lead', 'Pay once — no subscription. Choose a pack below.')}
                        </p>
                        <div className="credits-wallet__pack-grid">
                            {PACKS.map((pack) => {
                                const Icon = pack.icon;
                                return (
                                    <div
                                        key={pack.id}
                                        className={`settings-card credits-wallet__pack${pack.highlight ? ' credits-wallet__pack--highlight' : ''}`}
                                    >
                                        {pack.highlight ? (
                                            <span className="credits-wallet__badge">{t('best_value', 'Best value')}</span>
                                        ) : null}
                                        <div className={`credits-wallet__pack-icon-wrap ${pack.accent}`}>
                                            <Icon className="credits-wallet__pack-icon" aria-hidden />
                                        </div>
                                        <div className="credits-wallet__pack-amount">
                                            {pack.credits.toLocaleString()}{' '}
                                            <span className="credits-wallet__pack-amount-unit">
                                                {t('credits_unit', 'credits')}
                                            </span>
                                        </div>
                                        <div className="credits-wallet__pack-price">{pack.price}</div>
                                        {pack.sub ? (
                                            <div className="credits-wallet__pack-sub">{t('best_value', pack.sub)}</div>
                                        ) : (
                                            <div className="credits-wallet__pack-sub credits-wallet__pack-sub--placeholder" />
                                        )}
                                        <button
                                            type="button"
                                            className="credits-wallet__buy-btn"
                                            disabled={loadingId !== null}
                                            onClick={() => buyPack(pack)}
                                        >
                                            {loadingId === pack.id ? t('loading', 'Loading…') : t('buy_now_short', 'Buy')}
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
}
