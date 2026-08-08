import React, { useMemo, useState, useCallback, useEffect } from 'react';
import AppBackButton from '../components/AppBackButton';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { PayPalScriptProvider } from '@paypal/react-paypal-js';
import {
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
  FaPiggyBank,
  FaShieldAlt,
  FaCreditCard,
} from 'react-icons/fa';
import {
  DINE_CREDIT_PACKS,
  STRIPE_PUBLISHABLE_CONFIGURED,
} from '../config/stripeCommerce';
import {
  PAYPAL_CLIENT_CONFIGURED,
  PAYPAL_CLIENT_ID,
  PAYPAL_CURRENCY,
  PAYPAL_MODE,
  PAYPAL_TEST_MODE,
} from '../config/paypalCommerce';
import StripeTestModeBanner from '../components/StripeTestModeBanner';
import GooglePlayCommerceBanner from '../components/GooglePlayCommerceBanner';
import PayPalCreditsButton from '../components/PayPalCreditsButton';
import PayPalScriptStatus from '../components/PayPalScriptGate';
import { useCreditsPurchase } from '../hooks/useCreditsPurchase';
import { getFunctions, httpsCallable } from 'firebase/functions';
import app from '../firebase/config';
import { useToast } from '../context/ToastContext';
import {
  AI_IMAGE_GENERATION_CREDITS,
  AI_INVITATION_BUNDLE_CREDITS,
  AI_TEXT_GENERATION_CREDITS,
} from '../utils/aiCreditCosts';
import { getPurchaseCredits, getSavedCredits, GIFT_RECIPIENT_VALUE_RATE } from '../utils/walletCredits';
import { isCashoutFeatureEnabled } from '../config/cashoutFeature';
import ShieldCashoutSection from '../components/cashout/ShieldCashoutSection';
import './SettingsPages.css';
import { AppText } from '../components/base';

const CASHOUT_UI_ENABLED = isCashoutFeatureEnabled();

const PACK_META = {
  credits_200: { icon: FaBolt },
  credits_500: { icon: FaCoins },
  credits_1000: { icon: FaGem },
  credits_3000: { icon: FaCrown },
};

const PACKS = DINE_CREDIT_PACKS.map((p) => ({
  ...p,
  price: p.priceLabel,
  ...PACK_META[p.id],
}));

/**
 * Two wallets: purchase (spend) + savings (gift receipts at 50%).
 * Buy flow: TikTok-style selectable pack grid + sticky checkout bar.
 */
export default function CreditsWallet() {
  const { t } = useTranslation();
  const { userProfile } = useAuth();
  const { buyPack, loadingId, isGooglePlay } = useCreditsPurchase();
  const { showToast } = useToast();
  const [restoringPayPal, setRestoringPayPal] = useState(false);

  const showStripeOnWeb = !isGooglePlay && STRIPE_PUBLISHABLE_CONFIGURED;
  const showPayPalOnWeb = !isGooglePlay && PAYPAL_CLIENT_CONFIGURED;

  const defaultPayMethod = isGooglePlay ? 'play' : showStripeOnWeb ? 'card' : showPayPalOnWeb ? 'paypal' : 'card';
  const [selectedPackId, setSelectedPackId] = useState(
    () => PACKS.find((p) => p.highlight)?.id || PACKS[0]?.id || ''
  );
  const [payMethod, setPayMethod] = useState(defaultPayMethod);

  useEffect(() => {
    setPayMethod(defaultPayMethod);
  }, [defaultPayMethod]);

  const selectedPack = useMemo(
    () => PACKS.find((p) => p.id === selectedPackId) || PACKS[0],
    [selectedPackId]
  );

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
      components: 'buttons',
      disableFunding: 'card,credit,paylater',
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
      const fn = httpsCallable(getFunctions(app, 'us-central1'), 'reconcilePayPalCreditsOrder');
      const result = await fn({ orderId: orderId.trim(), clientMode: PAYPAL_MODE });
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

  const handlePrimaryBuy = () => {
    if (!selectedPack || loadingId) return;
    if (payMethod === 'paypal') return;
    buyPack(selectedPack);
  };

  const rechargeSection = (
    <section className="credits-wallet__recharge" aria-labelledby="credits-recharge-title">
      <div className="credits-wallet__recharge-head">
        <AppText as="h3" id="credits-recharge-title" className="credits-wallet__recharge-title">
          {t('buy_credits', 'Buy credits')}
        </AppText>
        <AppText as="p" className="credits-wallet__recharge-lead">
          {t(
            'credits_recharge_lead',
            'Choose a pack, then pay once — credits go to your purchase wallet.'
          )}
        </AppText>
      </div>

      <div className="credits-wallet__recharge-grid" role="listbox" aria-label={t('buy_credits', 'Buy credits')}>
        {PACKS.map((pack) => {
          const Icon = pack.icon || FaCoins;
          const selected = pack.id === selectedPack?.id;
          return (
            <button
              key={pack.id}
              type="button"
              role="option"
              aria-selected={selected}
              className={`credits-wallet__recharge-card${selected ? ' is-selected' : ''}${
                pack.highlight ? ' is-best' : ''
              }`}
              onClick={() => setSelectedPackId(pack.id)}
            >
              {pack.highlight ? (
                <AppText as="span" className="credits-wallet__recharge-tag">
                  {t('best_value', 'Best value')}
                </AppText>
              ) : null}
              <AppText as="span" className="credits-wallet__recharge-coin" aria-hidden>
                <Icon />
              </AppText>
              <AppText as="span" className="credits-wallet__recharge-amount">
                {pack.credits.toLocaleString()}
              </AppText>
              <AppText as="span" className="credits-wallet__recharge-price">
                {pack.price}
              </AppText>
            </button>
          );
        })}
      </div>

      {(showStripeOnWeb || showPayPalOnWeb || isGooglePlay) && selectedPack ? (
        <div className="credits-wallet__checkout-bar">
          <div className="credits-wallet__pay-methods" role="group" aria-label={t('payment_method', 'Payment method')}>
            {isGooglePlay ? (
              <AppText as="span" className="credits-wallet__pay-chip is-active">
                Google Play
              </AppText>
            ) : null}
            {showStripeOnWeb ? (
              <button
                type="button"
                className={`credits-wallet__pay-chip${payMethod === 'card' ? ' is-active' : ''}`}
                onClick={() => setPayMethod('card')}
              >
                <FaCreditCard aria-hidden />
                <AppText as="span">{t('buy_with_card', 'Card')}</AppText>
              </button>
            ) : null}
            {showPayPalOnWeb ? (
              <button
                type="button"
                className={`credits-wallet__pay-chip${payMethod === 'paypal' ? ' is-active' : ''}`}
                onClick={() => setPayMethod('paypal')}
              >
                <AppText as="span">PayPal</AppText>
              </button>
            ) : null}
            <AppText as="span" className="credits-wallet__secure">
              <FaShieldAlt aria-hidden />
              {t('secure_payment', 'Secure payment')}
            </AppText>
          </div>

          {payMethod === 'paypal' && showPayPalOnWeb ? (
            <div className="credits-wallet__checkout-paypal">
              <PayPalCreditsButton pack={selectedPack} disabled={loadingId !== null} />
            </div>
          ) : (
            <button
              type="button"
              className="credits-wallet__checkout-buy"
              disabled={!selectedPack || loadingId !== null}
              onClick={handlePrimaryBuy}
            >
              {loadingId === selectedPack?.id
                ? t('loading', 'Loading…')
                : t('buy_for_price', 'Buy for {{price}}', { price: selectedPack?.price || '' })}
            </button>
          )}
        </div>
      ) : null}

      {showPayPalOnWeb ? (
        <button
          type="button"
          className="ui-btn ui-btn--ghost credits-wallet__restore-paypal"
          onClick={restorePayPalCredits}
          disabled={restoringPayPal}
        >
          {restoringPayPal
            ? t('paypal_restore_working', 'Restoring credits…')
            : t('paypal_restore_cta', 'Paid with PayPal but credits missing? Restore purchase')}
        </button>
      ) : null}
    </section>
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
          <section className="credits-wallet__balance-strip" aria-live="polite">
            <div className="credits-wallet__balance-strip-main">
              <AppText as="span" className="credits-wallet__balance-strip-icon" aria-hidden>
                <FaCoins />
              </AppText>
              <div>
                <AppText as="p" className="credits-wallet__balance-strip-label">
                  {t('purchase_wallet_title', 'Purchase wallet')}
                </AppText>
                <AppText as="p" className="credits-wallet__balance-strip-value">
                  {purchaseBalance.toLocaleString()}{' '}
                  <AppText as="span">{t('credits_unit', 'credits')}</AppText>
                </AppText>
              </div>
            </div>
            <AppText as="p" className="credits-wallet__balance-strip-meta">
              {t('lifetime_stats', 'Lifetime purchased')}: {purchased} · {t('lifetime_spent', 'spent')}:{' '}
              {spent}
            </AppText>
          </section>

          {showPayPalOnWeb && PAYPAL_TEST_MODE ? (
            <div className="credits-wallet__paypal-banner">
              {t('paypal_test_mode_note', 'PayPal sandbox mode is active on this build.')}
            </div>
          ) : null}

          {showPayPalOnWeb ? (
            <PayPalScriptProvider options={payPalScriptOptions}>
              <PayPalScriptStatus />
              {rechargeSection}
            </PayPalScriptProvider>
          ) : (
            rechargeSection
          )}

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

          <section className="settings-card credits-wallet__hints">
            <div className="credits-wallet__hints-title">
              <FaInfoCircle aria-hidden />
              {t('credits_how_title', 'How it works')}
            </div>
            <ul className="credits-wallet__hints-list">
              <li>
                <FaWallet className="credits-wallet__hint-ico" aria-hidden />
                {t(
                  'purchase_wallet_desc',
                  'Buy credits here. Used first for invites, AI, and gifts (then savings if needed).'
                )}
              </li>
              <li>
                <FaLock className="credits-wallet__hint-ico" aria-hidden />
                {t(
                  'credit_hint_paid_only',
                  'Purchased credits never expire. Free credits are no longer offered.'
                )}
              </li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
