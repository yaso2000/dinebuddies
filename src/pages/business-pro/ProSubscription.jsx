import React, { useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { PayPalScriptProvider } from '@paypal/react-paypal-js';
import app from '../../firebase/config';
import { FaCheck, FaExternalLinkAlt } from 'react-icons/fa';
import { BUSINESS_PAID_PLAN_DISPLAY, STRIPE_PUBLISHABLE_CONFIGURED } from '../../config/stripeCommerce';
import {
  PAYPAL_CLIENT_CONFIGURED,
  PAYPAL_CLIENT_ID,
  PAYPAL_CURRENCY,
  PAYPAL_TEST_MODE,
} from '../../config/paypalCommerce';
import PayPalScriptStatus from '../../components/PayPalScriptGate';
import PayPalBusinessPlanButton from '../../components/PayPalBusinessPlanButton';
import {
  BUSINESS_FREE_PLAN_FEATURE_KEYS,
  BUSINESS_PAID_PLAN_FEATURE_KEYS,
  normalizeBusinessTier } from
'../../utils/businessSubscription';
import { useToast } from '../../context/ToastContext';
import StripeTestModeBanner from '../../components/StripeTestModeBanner';
import { isAppleStoreCommerce, isGooglePlayCommerce } from '../../utils/commercePlatform';
import {
  purchaseBusinessSubscriptionViaAppleStore,
  restoreBusinessSubscriptionViaAppleStore,
} from '../../utils/appStoreBillingClient';
import { AppText } from "../../components/base";

const IS_APPLE_STORE = isAppleStoreCommerce();
// On native Android, digital subscriptions must go through Google Play billing
// (not Stripe/PayPal) — that flow isn't built yet, so hide external payment here
// to stay Play-policy compliant. Business accounts subscribe via iOS or web meanwhile.
const IS_GOOGLE_PLAY = isGooglePlayCommerce();

const ProSubscription = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { userProfile } = useAuth();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState(() => {
    if (STRIPE_PUBLISHABLE_CONFIGURED) return 'stripe';
    if (PAYPAL_CLIENT_CONFIGURED) return 'paypal';
    return 'stripe';
  });
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
  const upgradePaymentMethods = useMemo(() => {
    const methods = [];
    if (STRIPE_PUBLISHABLE_CONFIGURED) methods.push('stripe');
    if (PAYPAL_CLIENT_CONFIGURED) methods.push('paypal');
    return methods;
  }, []);

  const normalized = normalizeBusinessTier(userProfile?.subscriptionTier);
  const isPaid = normalized === 'paid';
  const isFree = normalized === 'free';

  const billingReturnUrl = `${window.location.origin}${location.pathname || '/settings/subscription'}`;

  const handleUpgrade = async () => {
    setLoading('paid');
    try {
      const functions = getFunctions(app, 'us-central1');
      const createBusinessCheckout = httpsCallable(functions, 'createBusinessSubscriptionCheckout');
      const result = await createBusinessCheckout({
        planName: t('biz_plan_paid_name', BUSINESS_PAID_PLAN_DISPLAY.name),
        successUrl: `${window.location.origin}/payment-success`,
        cancelUrl: billingReturnUrl
      });
      if (result.data?.url) window.location.href = result.data.url;
    } catch (e) {
      console.error('Checkout error:', e);
      showToast(
        t('biz_plan_checkout_error', 'Could not start checkout: ') + (e.message || String(e)),
        'error'
      );
    } finally {
      setLoading(null);
    }
  };

  const handleAppleUpgrade = async () => {
    setLoading('paid');
    try {
      await purchaseBusinessSubscriptionViaAppleStore();
      window.location.reload();
    } catch (e) {
      console.error('Apple subscription error:', e);
      showToast(
        t('biz_plan_checkout_error', 'Could not start checkout: ') + (e.message || String(e)),
        'error'
      );
    } finally {
      setLoading(null);
    }
  };

  const handleAppleRestore = async () => {
    setRestoring(true);
    try {
      const result = await restoreBusinessSubscriptionViaAppleStore();
      if (result.restored) {
        showToast(t('biz_plan_restore_success', 'Subscription restored.'), 'success');
        window.location.reload();
      } else {
        showToast(t('biz_plan_restore_none_found', 'No active subscription found for this Apple ID.'), 'info');
      }
    } catch (e) {
      console.error('Apple restore error:', e);
      showToast(
        t('biz_plan_restore_error', 'Could not restore purchases: ') + (e.message || String(e)),
        'error'
      );
    } finally {
      setRestoring(false);
    }
  };

  const handleManageBilling = async () => {
    setPortalLoading(true);
    try {
      const functions = getFunctions(app, 'us-central1');
      const createPortalSession = httpsCallable(functions, 'createPortalSession');
      const result = await createPortalSession({ returnUrl: billingReturnUrl });
      if (result.data?.url) window.location.href = result.data.url;else
      showToast(t('biz_plan_portal_no_url', 'Could not open billing portal.'), 'error');
    } catch (e) {
      console.error('Portal error:', e);
      showToast(t('biz_plan_portal_error', 'Could not open billing: ') + (e.message || String(e)), 'error');
    } finally {
      setPortalLoading(false);
    }
  };

  const paidPriceLabel = `${BUSINESS_PAID_PLAN_DISPLAY.priceLabel}${BUSINESS_PAID_PLAN_DISPLAY.periodLabel}`;

  const bannerBorder = isPaid ? 'color-mix(in srgb, var(--primary) 45%, transparent)' : 'var(--border-color)';
  const bannerBg = isPaid ?
  'linear-gradient(135deg, color-mix(in srgb, var(--primary) 16%, transparent), color-mix(in srgb, var(--primary) 8%, transparent))' :
  'var(--hover-overlay)';

  const planCard = (key, { titleKey, titleDefault, priceLabel, features, tierKey }) => {
    const current = tierKey === 'free' ? isFree : isPaid;
    const isPaidCard = tierKey === 'paid';
    const showUpgradeOnPaidCard = isFree && isPaidCard;

    return (
      <div
        key={key}
        style={{
          background: current ? 'color-mix(in srgb, var(--primary) 10%, var(--bg-card))' : 'var(--bg-card)',
          border: `2px solid ${current ? 'var(--primary)' : 'var(--border-color)'}`,
          borderRadius: 16,
          padding: '24px',
          display: 'flex',
          flexDirection: 'column'
        }}>

                <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: 4 }}>
                        {t(titleKey, titleDefault)}
                    </div>
                </div>

                <div style={{ marginBottom: 20 }}>
                    <AppText as="span" style={{ fontSize: '2.2rem', fontWeight: 900, color: current ? 'var(--primary)' : 'var(--text-main)' }}>
                        {priceLabel}
                    </AppText>
                    {isPaidCard &&
          <AppText as="span" style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginInlineStart: 6 }}>
                            / {t('month', 'month')}
                        </AppText>
          }
                </div>

                <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 20px 0', flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {features.map(([fk, def]) =>
          <li key={fk} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                            <FaCheck style={{ color: 'var(--color-success)', flexShrink: 0, marginTop: 2 }} />
                            {t(fk, def)}
                        </li>
          )}
                </ul>

                {current ?
        <button
          type="button"
          className="ui-btn"
          disabled
          style={{
            padding: '12px',
            fontSize: '0.875rem',
            cursor: 'default',
            background: isPaidCard ? 'linear-gradient(135deg, var(--primary), #ea580c)' : 'var(--bg-muted, #1e293b)',
            color: isPaidCard ? '#fff' : 'var(--text-muted)',
            border: 'none',
            fontWeight: 800,
            opacity: isPaidCard ? 1 : 0.95
          }}>

                        {t('biz_plan_btn_current', 'Current Plan')}
                    </button> :
        showUpgradeOnPaidCard ?
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {IS_APPLE_STORE ? (
            <button
              type="button"
              onClick={handleAppleUpgrade}
              disabled={loading === 'paid'}
              className="ui-btn ui-btn--primary"
              style={{
                padding: '12px',
                fontSize: '0.875rem',
                fontWeight: 800,
                opacity: loading === 'paid' ? 0.65 : 1,
              }}>
              {loading === 'paid' ? t('loading', 'Loading...') : `${t('biz_plan_upgrade_cta', 'Upgrade to Paid')} →`}
            </button>
          ) : IS_GOOGLE_PLAY ? (
            <div style={{ padding: '12px 14px', borderRadius: 12, border: '1px solid var(--border-color)', background: 'var(--hover-overlay)', color: 'var(--text-secondary)', fontSize: '0.85rem', textAlign: 'center', lineHeight: 1.5 }}>
              {t('biz_plan_android_unavailable', 'The paid plan isn’t available to purchase in the Android app yet.')}
            </div>
          ) : (
          <>
          {upgradePaymentMethods.length > 1 ?
          <div
            style={{
              display: 'flex',
              gap: 8,
              padding: 4,
              borderRadius: 12,
              background: 'var(--hover-overlay)',
            }}>
            {upgradePaymentMethods.includes('stripe') ?
            <button
              type="button"
              onClick={() => setPaymentMethod('stripe')}
              style={{
                flex: 1,
                border: 'none',
                borderRadius: 10,
                padding: '8px 10px',
                fontWeight: 800,
                cursor: 'pointer',
                background:
                  paymentMethod === 'stripe' ?
                  'linear-gradient(135deg, var(--primary), var(--primary-hover))' :
                  'transparent',
                color: paymentMethod === 'stripe' ? '#fff' : 'var(--text-main)',
              }}>
              {t('payment_method_card', 'Card')}
            </button> :
            null}
            {upgradePaymentMethods.includes('paypal') ?
            <button
              type="button"
              onClick={() => setPaymentMethod('paypal')}
              style={{
                flex: 1,
                border: 'none',
                borderRadius: 10,
                padding: '8px 10px',
                fontWeight: 800,
                cursor: 'pointer',
                background:
                  paymentMethod === 'paypal' ?
                  'linear-gradient(135deg, #0070ba, #003087)' :
                  'transparent',
                color: paymentMethod === 'paypal' ? '#fff' : 'var(--text-main)',
              }}>
              PayPal
            </button> :
            null}
          </div> :
          null}
          {paymentMethod === 'paypal' && PAYPAL_CLIENT_CONFIGURED ?
          <PayPalScriptProvider options={payPalScriptOptions}>
            <PayPalScriptStatus />
            <PayPalBusinessPlanButton
              disabled={loading === 'paid'}
              onSuccess={() => window.location.reload()}
            />
          </PayPalScriptProvider> :
          <button
            type="button"
            onClick={handleUpgrade}
            disabled={loading === 'paid'}
            className="ui-btn ui-btn--primary"
            style={{
              padding: '12px',
              fontSize: '0.875rem',
              fontWeight: 800,
              opacity: loading === 'paid' ? 0.65 : 1,
            }}>
            {loading === 'paid' ? t('loading', 'Loading...') : `${t('biz_plan_upgrade_cta', 'Upgrade to Paid')} →`}
          </button>
          }
          {paymentMethod === 'paypal' && PAYPAL_TEST_MODE ?
          <AppText as="p" style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            {t('biz_plan_paypal_monthly_note', 'PayPal pays for one month. Renew manually each month or use Card for auto-billing.')}
          </AppText> :
          null}
          </>
          )}
        </div> :

        <button
          type="button"
          className="ui-btn ui-btn--secondary"
          disabled
          style={{ padding: '12px', fontSize: '0.875rem', cursor: 'default', opacity: 0.85 }}>

                        {t('biz_plan_btn_not_current', 'Not current')}
                    </button>
        }
            </div>);

  };

  return (
    <div>
            <StripeTestModeBanner />
            <div
        style={{
          background: bannerBg,
          border: `1px solid ${bannerBorder}`,
          borderRadius: 16,
          padding: '24px 28px',
          marginBottom: 28,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 16
        }}>

                <div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 6, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                        {t('biz_plan_current_label', 'Current Plan')}
                    </div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: isPaid ? 'var(--primary)' : 'var(--text-muted)' }}>
                        {isPaid ? t('biz_plan_paid_name', 'Paid Business') : t('biz_plan_free_name', 'Free Business')}
                    </div>
                    <div style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginTop: 8, maxWidth: 420, lineHeight: 1.45 }}>
                        {isPaid ?
            <>
                                {paidPriceLabel}
                                {t(
                'biz_plan_paid_banner_suffix',
                '/month — full manual feature set. Buy Dine Credits for AI.'
              )}
                            </> :

            t(
              'biz_plan_free_banner_desc',
              'Core profile and community. Motion limits apply; AI uses Dine Credits.'
            )
            }
                    </div>
                </div>
                {isPaid &&
        <button
          type="button"
          className="ui-btn ui-btn--secondary"
          onClick={handleManageBilling}
          disabled={portalLoading}
          style={{ padding: '10px 18px', gap: 8, fontSize: '0.875rem' }}>

                        <FaExternalLinkAlt size={12} /> {portalLoading ? t('loading', 'Loading...') : t('biz_plan_manage_billing', 'Manage billing')}
                    </button>
        }
            </div>

            <AppText as="h3"
      style={{
        fontSize: '0.85rem',
        fontWeight: 700,
        color: 'var(--text-muted)',
        marginBottom: 16,
        letterSpacing: '0.08em',
        textTransform: 'uppercase'
      }}>

                {t('biz_plan_compare_heading', 'Plans')}
            </AppText>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20 }}>
                {planCard('free', {
          titleKey: 'biz_plan_free_name',
          titleDefault: 'Free Business',
          priceLabel: '$0',
          features: BUSINESS_FREE_PLAN_FEATURE_KEYS,
          tierKey: 'free'
        })}
                {planCard('paid', {
          titleKey: 'biz_plan_paid_name',
          titleDefault: 'Paid Business',
          priceLabel: paidPriceLabel,
          features: BUSINESS_PAID_PLAN_FEATURE_KEYS,
          tierKey: 'paid'
        })}
            </div>

            {IS_APPLE_STORE ? (
              <div style={{ textAlign: 'center', marginTop: 16 }}>
                <button
                  type="button"
                  onClick={handleAppleRestore}
                  disabled={restoring}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    color: 'var(--text-secondary)',
                    fontWeight: 700,
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    font: 'inherit',
                    opacity: restoring ? 0.6 : 1,
                  }}>
                  {restoring
                    ? t('biz_plan_restore_working', 'Restoring…')
                    : t('biz_plan_restore_cta', 'Restore purchases')}
                </button>
              </div>
            ) : null}

            <AppText as="p" style={{ marginTop: 24, fontSize: '0.9rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
                {t('biz_plan_credits_lead', 'Need AI?')}{' '}
                <button
          type="button"
          onClick={() => navigate('/settings/credits')}
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            color: 'var(--primary)',
            fontWeight: 800,
            cursor: 'pointer',
            textDecoration: 'underline',
            font: 'inherit'
          }}>

                    {t('biz_plan_credits_link', 'Open Dine Credits wallet')}
                </button>
            </AppText>
        </div>);

};

export default ProSubscription;