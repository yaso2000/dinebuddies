import React from 'react';
import AppBackButton from '../components/AppBackButton';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
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
  FaPiggyBank
} from 'react-icons/fa';
import { DINE_CREDIT_PACKS } from '../config/stripeCommerce';
import StripeTestModeBanner from '../components/StripeTestModeBanner';
import GooglePlayCommerceBanner from '../components/GooglePlayCommerceBanner';
import { useCreditsPurchase } from '../hooks/useCreditsPurchase';
import {
  AI_IMAGE_GENERATION_CREDITS,
  AI_INVITATION_BUNDLE_CREDITS,
  AI_TEXT_GENERATION_CREDITS
} from '../utils/aiCreditCosts';
import { getPurchaseCredits, getSavedCredits, GIFT_RECIPIENT_VALUE_RATE } from '../utils/walletCredits';
import { isGooglePlayCommerce } from '../utils/commercePlatform';
import './SettingsPages.css';
import { AppText } from "../components/base";

const PACK_META = {
  credits_200: { icon: FaBolt, accent: 'credits-wallet__pack-icon--sm' },
  credits_500: { icon: FaCoins, accent: 'credits-wallet__pack-icon--md' },
  credits_1000: { icon: FaGem, accent: 'credits-wallet__pack-icon--lg' },
  credits_3000: { icon: FaCrown, accent: 'credits-wallet__pack-icon--xl' }
};

const PACKS = DINE_CREDIT_PACKS.map((p) => ({
  ...p,
  price: p.priceLabel,
  ...PACK_META[p.id]
}));

/**
 * Two wallets: purchase (spend) + savings (gift receipts at 50%).
 */
export default function CreditsWallet() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const { buyPack, loadingId, isGooglePlay } = useCreditsPurchase();

  const purchaseBalance = getPurchaseCredits(userProfile);
  const savedBalance = getSavedCredits(userProfile);
  const purchased = Math.max(0, Number(userProfile?.totalCreditsPurchased) || 0);
  const spent = Math.max(0, Number(userProfile?.totalCreditsSpent) || 0);
  const savedLifetime = Math.max(0, Number(userProfile?.totalSavedCreditsEarned) || 0);
  const giftPercent = Math.round(GIFT_RECIPIENT_VALUE_RATE * 100);

  return (
    <div className="settings-page credits-wallet-page">
            <div className="settings-header credits-wallet__header">
                <AppBackButton fallback="/settings" />
                <div className="credits-wallet__title-block">
                    <AppText as="h1">{t('dine_credits', 'Dine Credits')}</AppText>
                    <AppText as="p" className="credits-wallet__title-sub">
                        {t('credits_wallet_subtitle_dual', 'Purchase wallet for spending · Savings wallet from gifts')}
                    </AppText>
                </div>
                <div className="credits-wallet__header-spacer" aria-hidden />
            </div>

            <div className="settings-content credits-wallet__content">
                {isGooglePlay ? <GooglePlayCommerceBanner /> : <StripeTestModeBanner />}
                <div className="credits-wallet__column">
                    <section className="settings-card credits-wallet__balance credits-wallet__balance--elevated">
                        <div className="credits-wallet__balance-top">
                            <div className="credits-wallet__hero-ring" aria-hidden>
                                <FaWallet className="credits-wallet__hero-wallet" />
                            </div>
                            <div className="credits-wallet__hero-copy">
                                <AppText as="h2" className="credits-wallet__balance-heading">
                                    {t('purchase_wallet_title', 'Purchase wallet')}
                                </AppText>
                                <div className="credits-wallet__total-display" aria-live="polite">
                                    <AppText as="span" className="credits-wallet__total-number">{purchaseBalance}</AppText>
                                    <AppText as="span" className="credits-wallet__total-suffix">
                                        {t('credits_unit', 'credits')}
                                    </AppText>
                                </div>
                                <AppText as="p" className="credits-wallet__wallet-desc">
                                    {t(
                    'purchase_wallet_desc',
                    'Buy credits here and spend on invites, AI, boosts, and sending gifts.'
                  )}
                                </AppText>
                            </div>
                        </div>

                        <div className="credits-wallet__lifetime">
                            <AppText as="span" className="credits-wallet__lifetime-dot" aria-hidden />
                            {t('lifetime_stats', 'Lifetime purchased')}: <strong>{purchased}</strong>
                            <AppText as="span" className="credits-wallet__lifetime-sep">·</AppText>
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
                                    <FaCoins className="credits-wallet__hint-ico" aria-hidden />
                                    {t('credit_hint_paid_only', 'Purchased credits never expire. Free credits are no longer offered.')}
                                </li>
                                <li>
                                    <AppText as="span" className="credits-wallet__hint-ico credits-wallet__hint-ico--cluster" aria-hidden>
                                        <FaLock /><FaHeart /><FaMagic />
                                    </AppText>
                                    {t('credit_hint_uses', 'Same balance for private invites, dates & AI.')}
                                </li>
                            </ul>
                        </div>
                    </section>

                    <section className="settings-card credits-wallet__balance credits-wallet__balance--savings">
                        <div className="credits-wallet__balance-top">
                            <div className="credits-wallet__hero-ring credits-wallet__hero-ring--savings" aria-hidden>
                                <FaPiggyBank className="credits-wallet__hero-wallet" />
                            </div>
                            <div className="credits-wallet__hero-copy">
                                <AppText as="h2" className="credits-wallet__balance-heading">
                                    {t('savings_wallet_title', 'Savings wallet')}
                                </AppText>
                                <div className="credits-wallet__total-display" aria-live="polite">
                                    <AppText as="span" className="credits-wallet__total-number credits-wallet__total-number--savings">
                                        {savedBalance}
                                    </AppText>
                                    <AppText as="span" className="credits-wallet__total-suffix">
                                        {t('credits_unit', 'credits')}
                                    </AppText>
                                </div>
                                <AppText as="p" className="credits-wallet__wallet-desc">
                                    {t(
                    'savings_wallet_desc',
                    'Gifts you receive are saved here at {{percent}}% of the amount sent — separate from your purchase wallet.',
                    { percent: giftPercent }
                  )}
                                </AppText>
                            </div>
                        </div>

                        <div className="credits-wallet__lifetime">
                            <FaGift aria-hidden style={{ marginInlineEnd: 6, opacity: 0.75 }} />
                            {t('savings_wallet_lifetime', 'Total received from gifts')}: <strong>{savedLifetime}</strong>
                        </div>

                        <div className="credits-wallet__hints">
                            <ul className="credits-wallet__hints-list">
                                <li>
                                    <FaGift className="credits-wallet__hint-ico" aria-hidden />
                                    {t(
                    'savings_wallet_gift_rule',
                    'Example: a gift of 50 credits adds 25 to your savings wallet.'
                  )}
                                </li>
                                <li>
                                    <FaLock className="credits-wallet__hint-ico" aria-hidden />
                                    {t(
                    'savings_wallet_separate',
                    'Savings and purchase wallets never mix — you cannot spend savings on invites or AI.'
                  )}
                                </li>
                            </ul>
                        </div>
                    </section>

                    <section className="settings-card credits-wallet__ai-pricing">
                        <div className="credits-wallet__hints-title">
                            <FaMagic aria-hidden />
                            {t('credits_ai_pricing_title', 'AI credit costs')}
                        </div>
                        <AppText as="p" className="credits-wallet__buy-lead" style={{ marginTop: '0.5rem', marginBottom: '0.75rem' }}>
                            {t('credits_ai_pricing_lead', 'Each AI action deducts credits from your purchase wallet.')}
                        </AppText>
                        <ul className="credits-wallet__hints-list">
                            <li>
                                <FaBolt className="credits-wallet__hint-ico" aria-hidden />
                                {t('credits_ai_text_generation', 'Text generation — {{cost}} credits', {
                  cost: AI_TEXT_GENERATION_CREDITS
                })}
                            </li>
                            <li>
                                <FaMagic className="credits-wallet__hint-ico" aria-hidden />
                                {t('credits_ai_image_generation', 'Image generation — {{cost}} credits', {
                  cost: AI_IMAGE_GENERATION_CREDITS
                })}
                            </li>
                            <li>
                                <FaHeart className="credits-wallet__hint-ico" aria-hidden />
                                {t('credits_ai_invitation_bundle', 'Invitation text + image — {{cost}} credits', {
                  cost: AI_INVITATION_BUNDLE_CREDITS
                })}
                            </li>
                        </ul>
                    </section>

                    <section className="credits-wallet__buy-section">
                        <AppText as="h3" className="credits-wallet__buy-heading">
                            <FaGem className="credits-wallet__buy-heading-icon" aria-hidden />
                            {t('buy_credits', 'Buy credits')}
                        </AppText>
                        <AppText as="p" className="credits-wallet__buy-lead">
                            {isGooglePlay
              ? t(
                  'buy_credits_lead_google_play',
                  'Pay with Google Play — credits go to your purchase wallet.'
                )
              : t('buy_credits_lead', 'Pay once — no subscription. Credits go to your purchase wallet.')}
                        </AppText>
                        <div className="credits-wallet__pack-grid">
                            {PACKS.map((pack) => {
                const Icon = pack.icon;
                return (
                  <div
                    key={pack.id}
                    className={`settings-card credits-wallet__pack${pack.highlight ? ' credits-wallet__pack--highlight' : ''}`}>
                    
                                        {pack.highlight ?
                    <AppText as="span" className="credits-wallet__badge">{t('best_value', 'Best value')}</AppText> :
                    null}
                                        <div className={`credits-wallet__pack-icon-wrap ${pack.accent}`}>
                                            <Icon className="credits-wallet__pack-icon" aria-hidden />
                                        </div>
                                        <div className="credits-wallet__pack-amount">
                                            {pack.credits.toLocaleString()}{' '}
                                            <AppText as="span" className="credits-wallet__pack-amount-unit">
                                                {t('credits_unit', 'credits')}
                                            </AppText>
                                        </div>
                                        <div className="credits-wallet__pack-price">{pack.price}</div>
                                        {pack.sub ?
                    <div className="credits-wallet__pack-sub">{t('best_value', pack.sub)}</div> :

                    <div className="credits-wallet__pack-sub credits-wallet__pack-sub--placeholder" />
                    }
                                        <button
                      type="button"
                      className="credits-wallet__buy-btn"
                      disabled={loadingId !== null}
                      onClick={() => buyPack(pack)}>
                      
                                            {loadingId === pack.id ? t('loading', 'Loading…') : t('buy_now_short', 'Buy')}
                                        </button>
                                    </div>);

              })}
                        </div>
                    </section>
                </div>
            </div>
        </div>);

}
