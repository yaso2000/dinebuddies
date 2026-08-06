import React, { useMemo, useState, useCallback } from 'react';
import AppBackButton from '../components/AppBackButton';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { PayPalScriptProvider } from '@paypal/react-paypal-js';
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
import {
  DINE_CREDIT_PACKS,
  STRIPE_PUBLISHABLE_CONFIGURED
} from '../config/stripeCommerce';
import {
  PAYPAL_CLIENT_CONFIGURED,
  PAYPAL_CLIENT_ID,
  PAYPAL_CURRENCY,
  PAYPAL_TEST_MODE
} from '../config/paypalCommerce';
import StripeTestModeBanner from '../components/StripeTestModeBanner';
import GooglePlayCommerceBanner from '../components/GooglePlayCommerceBanner';
import PayPalCreditsButton from '../components/PayPalCreditsButton';
import { useCreditsPurchase } from '../hooks/useCreditsPurchase';
import { getFunctions, httpsCallable } from 'firebase/functions';
import app from '../firebase/config';
import { useToast } from '../context/ToastContext';
import {
  AI_IMAGE_GENERATION_CREDITS,
  AI_INVITATION_BUNDLE_CREDITS,
  AI_TEXT_GENERATION_CREDITS
} from '../utils/aiCreditCosts';
import { getPurchaseCredits, getSavedCredits, GIFT_RECIPIENT_VALUE_RATE } from '../utils/walletCredits';
import { isCashoutFeatureEnabled } from '../config/cashoutFeature';
import ShieldCashoutSection from '../components/cashout/ShieldCashoutSection';
import './SettingsPages.css';
import { AppText } from "../components/base";

const CASHOUT_UI_ENABLED = isCashoutFeatureEnabled();

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
  const { showToast } = useToast();
  const [restoringPayPal, setRestoringPayPal] = useState(false);
  const showStripeOnWeb = !isGooglePlay && STRIPE_PUBLISHABLE_CONFIGURED;
  const showPayPalOnWeb = !isGooglePlay && PAYPAL_CLIENT_CONFIGURED;

  const purchaseBalance = getPurchaseCredits(userProfile);
  const savedBalance = getSavedCredits(userProfile);
  const purchased = Math.max(0, Number(userProfile?.totalCreditsPurchased) || 0);
  const spent = Math.max(0, Number(userProfile?.totalCreditsSpent) || 0);
  const savedLifetime = Math.max(0, Number(userProfile?.totalSavedCreditsEarned) || 0);
  const pendingCashoutRequestId = userProfile?.pendingCashoutRequestId || null;
  const giftPercent = Math.round(GIFT_RECIPIENT_VALUE_RATE * 100);
  const payPalScriptOptions = useMemo(
    () => ({
      clientId: PAYPAL_CLIENT_ID,
      currency: PAYPAL_CURRENCY,
      intent: 'capture',
      components: 'buttons'
    }),
    []
  );

  const restorePayPalCredits = useCallback(async () => {
    const orderId = window.prompt(
      t(
        'paypal_restore_prompt',
        'Paste your PayPal order ID from the PayPal receipt email (starts with letters/numbers).'
      )
    );
    if (!orderId?.trim()) return;
    setRestoringPayPal(true);
    try {
      const fn = httpsCallable(
        getFunctions(app, 'us-central1'),
        'reconcilePayPalCreditsOrder'
      );
      const result = await fn({ orderId: orderId.trim() });
      const credits = Number(result.data?.credits || 0);
      showToast(
        t('paypal_credits_added', '{{count}} credits added to your wallet.', { count: credits }),
        'success'
      );
    } catch (error) {
      console.error('[CreditsWallet/restorePayPal]', error);
      showToast(
        error?.message ||
          t('paypal_restore_failed', 'Could not restore credits for that PayPal order.'),
        'error'
      );
    } finally {
      setRestoringPayPal(false);
    }
  }, [showToast, t]);
  const packGrid = (
    <div className="credits-wallet__pack-grid">
      {PACKS.map((pack) => {
        const Icon = pack.icon;
        return (
          <div
            key={pack.id}
            className={`settings-card credits-wallet__pack${pack.highlight ? ' credits-wallet__pack--highlight' : ''}`}>
            {pack.highlight ? (
              <AppText as="span" className="credits-wallet__badge">
                {t('best_value', 'Best value')}
              </AppText>
            ) : null}
            <div className="credits-wallet__pack-main">
              <div className={`credits-wallet__pack-icon-wrap ${pack.accent}`}>
                <Icon className="credits-wallet__pack-icon" aria-hidden />
              </div>
              <div className="credits-wallet__pack-copy">
                <div className="credits-wallet__pack-amount">
                  {pack.credits.toLocaleString()}{' '}
                  <AppText as="span" className="credits-wallet__pack-amount-unit">
                    {t('credits_unit', 'credits')}
                  </AppText>
                </div>
                <div className="credits-wallet__pack-price">{pack.price}</div>
                {pack.sub ? (
                  <div className="credits-wallet__pack-sub">{t('best_value', pack.sub)}</div>
                ) : null}
              </div>
            </div>
            <div className="credits-wallet__pack-actions">
              {isGooglePlay || showStripeOnWeb ? (
                <button
                  type="button"
                  className="credits-wallet__buy-btn"
                  disabled={loadingId !== null}
                  onClick={() => buyPack(pack)}>
                  {loadingId === pack.id
                    ? t('loading', 'Loading…')
                    : isGooglePlay
                      ? t('buy_with_google_play', 'Buy with Google Play')
                      : t('buy_with_card', 'Buy with card')}
                </button>
              ) : null}
              {showPayPalOnWeb ? (
                <PayPalCreditsButton pack={pack} disabled={loadingId !== null} />
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="settings-page credits-wallet-page">
            <div className="settings-header credits-wallet__header">
                <AppBackButton fallback="/settings" />
                <div className="credits-wallet__title-block">
                    <AppText as="h1">{t('dine_credits', 'Dine Credits')}</AppText>
                    <AppText as="p" className="credits-wallet__title-sub">
                        {t(
              'credits_wallet_subtitle_dual',
              'Purchase + savings for invites, AI, and gifts · paid first, then saved'
            )}
                    </AppText>
                </div>
                <div className="credits-wallet__header-spacer" aria-hidden />
            </div>

            <div className="settings-content credits-wallet__content">
                {isGooglePlay ? <GooglePlayCommerceBanner /> : null}
                {showStripeOnWeb ? <StripeTestModeBanner /> : null}
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
                    'Buy credits here. Used first for invites, AI, and gifts (then savings if needed).'
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
                    'Gifts you receive are saved here at {{percent}}% of the amount sent. Spendable on invites, AI, and gifts after purchase credits.',
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
                    'You can spend savings on private/social invites, AI, and gifts. Purchase is used first, then savings.'
                  )}
                                </li>
                            </ul>
                        </div>
                    </section>

                    {CASHOUT_UI_ENABLED ? (
                      <ShieldCashoutSection
                        savedBalance={savedBalance}
                        pendingRequestId={pendingCashoutRequestId}
                      />
                    ) : null}

                    <section className="settings-card credits-wallet__ai-pricing">
                        <div className="credits-wallet__hints-title">
                            <FaMagic aria-hidden />
                            {t('credits_ai_pricing_title', 'AI credit costs')}
                        </div>
                        <AppText as="p" className="credits-wallet__buy-lead" style={{ marginTop: '0.5rem', marginBottom: '0.75rem' }}>
                            {t(
                'credits_ai_pricing_lead',
                'Each AI action deducts from your spendable balance (purchase first, then savings).'
              )}
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
                              : showStripeOnWeb && showPayPalOnWeb
                                ? t(
                                    'buy_credits_lead_card_or_paypal',
                                    'Pay once with card or PayPal — credits go to your purchase wallet.'
                                  )
                                : showPayPalOnWeb
                                  ? t(
                                      'buy_credits_lead_paypal',
                                      'Pay once with PayPal — credits go to your purchase wallet.'
                                    )
                                  : t(
                                      'buy_credits_lead',
                                      'Pay once — no subscription. Credits go to your purchase wallet.'
                                    )}
                        </AppText>
                        {showPayPalOnWeb && PAYPAL_TEST_MODE ? (
                          <div
                            style={{
                              marginBottom: 14,
                              padding: '12px 14px',
                              borderRadius: 14,
                              border: '1px solid rgba(0, 112, 186, 0.22)',
                              background: 'rgba(0, 112, 186, 0.08)',
                              color: 'var(--text-secondary)',
                              fontSize: '0.92rem',
                              fontWeight: 600,
                            }}>
                            {t('paypal_test_mode_note', 'PayPal sandbox mode is active on this build.')}
                          </div>
                        ) : null}
                        {showPayPalOnWeb ? (
                          <PayPalScriptProvider options={payPalScriptOptions}>
                            {packGrid}
                            <button
                              type="button"
                              className="ui-btn ui-btn--ghost credits-wallet__restore-paypal"
                              onClick={restorePayPalCredits}
                              disabled={restoringPayPal}
                              style={{ marginTop: 12, width: '100%' }}>
                              {restoringPayPal
                                ? t('paypal_restore_working', 'Restoring credits…')
                                : t(
                                    'paypal_restore_cta',
                                    'Paid with PayPal but credits missing? Restore purchase'
                                  )}
                            </button>
                          </PayPalScriptProvider>
                        ) : (
                          packGrid
                        )}
                    </section>
                </div>
            </div>
        </div>);

}
