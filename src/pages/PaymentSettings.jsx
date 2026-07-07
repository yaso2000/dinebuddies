import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { FaCreditCard, FaChevronRight, FaWallet, FaCrown, FaExternalLinkAlt } from 'react-icons/fa';
import AppBackButton from '../components/AppBackButton';
import { useTranslation } from 'react-i18next';
import { getFunctions, httpsCallable } from 'firebase/functions';
import app from '../firebase/config';
import {
  PAYPAL_CLIENT_CONFIGURED,
  PAYPAL_TEST_MODE,
} from '../config/paypalCommerce';
import { STRIPE_PUBLISHABLE_CONFIGURED } from '../config/stripeCommerce';
import './SettingsPages.css';
import { AppText } from '../components/base';

const hubRowStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '1rem',
  width: '100%',
  padding: '1rem 1.1rem',
  background: 'var(--bg-secondary)',
  border: '1px solid var(--border-color)',
  borderRadius: '12px',
  cursor: 'pointer',
  textAlign: 'start',
  color: 'inherit',
};

const PaymentSettings = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { userProfile, isBusiness } = useAuth();
  const { showToast } = useToast();
  const [portalLoading, setPortalLoading] = useState(false);

  const openStripePortal = async () => {
    setPortalLoading(true);
    try {
      const functions = getFunctions(app, 'us-central1');
      const createPortalSession = httpsCallable(functions, 'createPortalSession');
      const returnUrl = `${window.location.origin}/settings/payment`;
      const result = await createPortalSession({ returnUrl });
      if (result.data?.url) {
        window.location.href = result.data.url;
      } else {
        showToast(
          t('biz_plan_portal_no_url', 'Could not open billing portal.'),
          'error'
        );
      }
    } catch (e) {
      console.error('[PaymentSettings/portal]', e);
      showToast(
        t('biz_plan_portal_error', 'Could not open billing: ') + (e.message || String(e)),
        'error'
      );
    } finally {
      setPortalLoading(false);
    }
  };

  const paymentOptions = [
    {
      key: 'credits',
      icon: <FaWallet style={{ color: '#0ea5e9', fontSize: '1.35rem' }} />,
      title: t('payment_hub_credits_title', 'Credits wallet'),
      desc: t(
        'payment_hub_credits_desc',
        'Buy Dine Credits with Card or PayPal'
      ),
      onClick: () => navigate('/settings/credits'),
      show: true,
    },
    {
      key: 'subscription',
      icon: <FaCrown style={{ color: '#f59e0b', fontSize: '1.35rem' }} />,
      title: t('payment_hub_subscription_title', 'Business subscription'),
      desc: t(
        'payment_hub_subscription_desc',
        'Upgrade Business plan — Card or PayPal'
      ),
      onClick: () => navigate('/settings/subscription'),
      show: isBusiness,
    },
    {
      key: 'portal',
      icon: <FaExternalLinkAlt style={{ color: '#8b5cf6', fontSize: '1.2rem' }} />,
      title: t('payment_hub_portal_title', 'Billing portal (Stripe)'),
      desc: t(
        'payment_hub_portal_desc',
        'Manage saved cards and invoices in Stripe'
      ),
      onClick: openStripePortal,
      show: isBusiness && STRIPE_PUBLISHABLE_CONFIGURED,
      loading: portalLoading,
    },
  ].filter((row) => row.show);

  return (
    <div className="settings-page">
      <div className="settings-header">
        <AppBackButton fallback="/settings" />
        <AppText as="h1">{t('payment_method', 'Payment Method')}</AppText>
        <div style={{ width: '40px' }} />
      </div>

      <div className="settings-content">
        <div className="settings-card">
          <div className="settings-icon-wrapper" style={{ background: 'rgba(139, 92, 246, 0.1)' }}>
            <FaCreditCard style={{ color: '#8b5cf6', fontSize: '1.5rem' }} />
          </div>

          <AppText as="h2">{t('payment_methods', 'Payment Methods')}</AppText>
          <AppText as="p" className="settings-description">
            {t(
              'payment_manage_description',
              'Manage your payment methods for subscription billing'
            )}
          </AppText>

          <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {paymentOptions.map((row) => (
              <button
                key={row.key}
                type="button"
                onClick={row.onClick}
                disabled={row.loading}
                style={{
                  ...hubRowStyle,
                  opacity: row.loading ? 0.7 : 1,
                }}
              >
                {row.icon}
                <span style={{ flex: 1, minWidth: 0 }}>
                  <AppText
                    as="span"
                    style={{
                      display: 'block',
                      fontWeight: 700,
                      color: 'var(--text-main)',
                      marginBottom: '0.2rem',
                    }}
                  >
                    {row.title}
                  </AppText>
                  <AppText
                    as="span"
                    style={{
                      display: 'block',
                      fontSize: '0.85rem',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    {row.desc}
                  </AppText>
                </span>
                <FaChevronRight style={{ opacity: 0.45, flexShrink: 0 }} />
              </button>
            ))}
          </div>

          {PAYPAL_CLIENT_CONFIGURED ? (
            <div
              style={{
                marginTop: '1rem',
                padding: '12px 14px',
                borderRadius: 14,
                border: '1px solid rgba(0, 112, 186, 0.22)',
                background: 'rgba(0, 112, 186, 0.08)',
                color: 'var(--text-secondary)',
                fontSize: '0.9rem',
              }}
            >
              {PAYPAL_TEST_MODE
                ? t(
                    'paypal_test_mode_note',
                    'PayPal sandbox mode is active on this build.'
                  )
                : t(
                    'payment_paypal_available_note',
                    'PayPal checkout is available on Credits and Business subscription pages.'
                  )}
            </div>
          ) : null}

          {userProfile?.paymentMethod ? (
            <AppText as="p" style={{ marginTop: '1rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              {t('payment_method', 'Payment Method')}: {userProfile.paymentMethod}
            </AppText>
          ) : null}

          <div className="settings-note" style={{ marginTop: '1.5rem' }}>
            <strong>
              {t(
                'payment_secure_stripe_note',
                'Secure payment: All payment information is securely processed by Stripe.'
              )}
            </strong>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentSettings;
