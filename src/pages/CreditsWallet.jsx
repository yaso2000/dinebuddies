import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { DINE_CREDIT_PACKS } from '../config/stripeCommerce';
import StripeTestModeBanner from '../components/StripeTestModeBanner';
import {
    AI_IMAGE_GENERATION_CREDITS,
    AI_INVITATION_BUNDLE_CREDITS,
    AI_TEXT_GENERATION_CREDITS,
} from '../utils/aiCreditCosts';
import './SettingsPages.css';

const FUNCTIONS_REGION = 'us-central1';

const PACK_META = {
    credits_200: { icon: FaBolt, accent: 'credits-wallet__pack-icon--sm' },
    credits_500: { icon: FaCoins, accent: 'credits-wallet__pack-icon--md' },
    credits_1000: { icon: FaGem, accent: 'credits-wallet__pack-icon--lg' },
    credits_3000: { icon: FaCrown, accent: 'credits-wallet__pack-icon--xl' },
};

const PACKS = DINE_CREDIT_PACKS.map((p) => ({
    ...p,
    price: p.priceLabel,
    ...PACK_META[p.id],
}));

/**
 * Dine Credits wallet — one-time Stripe checkouts (server maps package → price).
 */
export default function CreditsWallet() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { userProfile } = useAuth();
    const { showToast } = useToast();
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
            const msg =
                e?.message ||
                e?.details ||
                t('checkout_start_failed', 'Could not start checkout. Check Stripe functions config.');
            showToast(msg, 'error');
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
                        {t('credits_wallet_subtitle', 'One balance for invites, dates & AI')}
                    </p>
                </div>
                <div className="credits-wallet__header-spacer" aria-hidden />
            </div>

            <div className="settings-content credits-wallet__content">
                <StripeTestModeBanner />
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
                                    {t('credit_hint_uses', 'Same balance for private invites, dates & AI.')}
                                </li>
                            </ul>
                        </div>
                    </section>

                    <section className="settings-card credits-wallet__ai-pricing">
                        <div className="credits-wallet__hints-title">
                            <FaMagic aria-hidden />
                            {t('credits_ai_pricing_title', 'AI credit costs')}
                        </div>
                        <p className="credits-wallet__buy-lead" style={{ marginTop: '0.5rem', marginBottom: '0.75rem' }}>
                            {t('credits_ai_pricing_lead', 'Each AI action deducts credits from your Dine balance.')}
                        </p>
                        <ul className="credits-wallet__hints-list">
                            <li>
                                <FaBolt className="credits-wallet__hint-ico" aria-hidden />
                                {t('credits_ai_text_generation', 'Text generation — {{cost}} credits', {
                                    cost: AI_TEXT_GENERATION_CREDITS,
                                })}
                            </li>
                            <li>
                                <FaMagic className="credits-wallet__hint-ico" aria-hidden />
                                {t('credits_ai_image_generation', 'Image generation — {{cost}} credits', {
                                    cost: AI_IMAGE_GENERATION_CREDITS,
                                })}
                            </li>
                            <li>
                                <FaHeart className="credits-wallet__hint-ico" aria-hidden />
                                {t('credits_ai_invitation_bundle', 'Invitation text + image — {{cost}} credits', {
                                    cost: AI_INVITATION_BUNDLE_CREDITS,
                                })}
                            </li>
                        </ul>
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
