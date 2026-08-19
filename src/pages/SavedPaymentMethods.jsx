import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import AppBackButton from '../components/AppBackButton';
import { useToast } from '../context/ToastContext';
import { useStripeContext } from '../context/StripeContext';
import { usePaymentMethods } from '../hooks/usePaymentMethods';
import { FaCcVisa, FaCcMastercard, FaCcAmex, FaCreditCard, FaStar, FaRegStar, FaTrash } from 'react-icons/fa';
import './SettingsPages.css';
import { AppText } from '../components/base';

const BRAND_ICONS = {
  visa: FaCcVisa,
  mastercard: FaCcMastercard,
  amex: FaCcAmex,
};

const cardElementOptions = {
  style: {
    base: {
      fontSize: '16px',
      color: 'var(--text-main, #1a1a1a)',
      '::placeholder': { color: '#9ca3af' },
    },
    invalid: { color: '#ef4444' },
  },
};

function AddCardForm({ onSaved, onCancel }) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const stripe = useStripe();
  const elements = useElements();
  const { createSetupIntent } = usePaymentMethods();
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!stripe || !elements || submitting) return;
    setSubmitting(true);
    try {
      const clientSecret = await createSetupIntent();
      if (!clientSecret) {
        showToast(t('payment_methods_setup_failed', 'Could not start card setup.'), 'error');
        return;
      }
      const cardElement = elements.getElement(CardElement);
      const result = await stripe.confirmCardSetup(clientSecret, {
        payment_method: { card: cardElement },
      });
      if (result.error) {
        showToast(result.error.message || t('payment_methods_save_failed', 'Could not save card.'), 'error');
        return;
      }
      showToast(t('payment_methods_card_saved', 'Card saved.'), 'success');
      onSaved();
    } catch (err) {
      console.error('[AddCardForm]', err);
      showToast(err?.message || t('payment_methods_save_failed', 'Could not save card.'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ marginTop: '1rem' }}>
      <div
        style={{
          padding: '14px 16px',
          borderRadius: 12,
          border: '1px solid var(--border-color)',
          background: 'var(--bg-input)',
        }}
      >
        <CardElement options={cardElementOptions} />
      </div>
      <div style={{ display: 'flex', gap: '0.6rem', marginTop: '0.85rem' }}>
        <button type="submit" className="ui-btn ui-btn--primary" disabled={!stripe || submitting} style={{ flex: 1 }}>
          {submitting ? t('saving', 'Saving…') : t('payment_methods_save_card', 'Save card')}
        </button>
        <button type="button" className="ui-btn ui-btn--secondary" onClick={onCancel} disabled={submitting}>
          {t('cancel', 'Cancel')}
        </button>
      </div>
    </form>
  );
}

const SavedPaymentMethods = () => {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { stripePromise, stripeConfigured } = useStripeContext() || {};
  const { methods, loading, mutatingId, refresh, setDefault, removeMethod } = usePaymentMethods();
  const [addingCard, setAddingCard] = useState(false);

  const handleSetDefault = async (pmId) => {
    try {
      await setDefault(pmId);
    } catch (e) {
      console.error(e);
      showToast(t('payment_methods_action_failed', 'Action failed. Try again.'), 'error');
    }
  };

  const handleRemove = async (pmId) => {
    try {
      await removeMethod(pmId);
      showToast(t('payment_methods_card_removed', 'Card removed.'), 'success');
    } catch (e) {
      console.error(e);
      showToast(t('payment_methods_action_failed', 'Action failed. Try again.'), 'error');
    }
  };

  return (
    <div className="settings-page">
      <div className="settings-header">
        <AppBackButton fallback="/settings" />
        <AppText as="h1">{t('payment_methods', 'Payment Methods')}</AppText>
        <div style={{ width: '40px' }} />
      </div>

      <div className="settings-content">
        <div className="settings-card ui-card">
          <div className="settings-icon-wrapper" style={{ background: 'rgba(139, 92, 246, 0.1)' }}>
            <FaCreditCard style={{ color: '#8b5cf6', fontSize: '1.5rem' }} />
          </div>
          <AppText as="h2">{t('payment_methods_saved_cards_title', 'Saved cards')}</AppText>
          <AppText as="p" className="settings-description" style={{ marginBottom: '1.25rem' }}>
            {t(
              'payment_methods_saved_cards_desc',
              'Save a card for faster checkout on Dine Credits and Business subscription purchases.'
            )}
          </AppText>

          {!stripeConfigured ? (
            <div
              style={{
                textAlign: 'center',
                padding: '2rem 1rem',
                color: 'var(--text-muted)',
                border: '1px dashed var(--border-color)',
                borderRadius: '16px',
                background: 'var(--bg-input)',
              }}
            >
              {t('payment_methods_stripe_unavailable', 'Card saving is not available right now.')}
            </div>
          ) : (
            <>
              {loading ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                  {t('loading', 'Loading...')}
                </div>
              ) : methods.length === 0 && !addingCard ? (
                <div
                  style={{
                    textAlign: 'center',
                    padding: '2rem 1rem',
                    color: 'var(--text-muted)',
                    border: '1px dashed var(--border-color)',
                    borderRadius: '16px',
                    background: 'var(--bg-input)',
                  }}
                >
                  {t('payment_methods_empty', 'No saved cards yet.')}
                </div>
              ) : (
                <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {methods.map((m) => {
                    const BrandIcon = BRAND_ICONS[m.brand] || FaCreditCard;
                    const busy = mutatingId === m.id;
                    return (
                      <li
                        key={m.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          padding: '12px 14px',
                          borderRadius: '14px',
                          border: '1px solid var(--border-color)',
                          background: 'var(--bg-card)',
                        }}
                      >
                        <BrandIcon style={{ fontSize: '1.6rem', flexShrink: 0, color: 'var(--text-secondary)' }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                            •••• {m.last4}
                            {m.isDefault ? (
                              <span
                                style={{
                                  marginInlineStart: 8,
                                  fontSize: '0.72rem',
                                  fontWeight: 700,
                                  color: '#22c55e',
                                }}
                              >
                                {t('payment_methods_default_badge', 'Default')}
                              </span>
                            ) : null}
                          </div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            {String(m.expMonth).padStart(2, '0')}/{m.expYear}
                          </div>
                        </div>
                        {!m.isDefault ? (
                          <button
                            type="button"
                            aria-label={t('payment_methods_set_default', 'Set as default')}
                            onClick={() => handleSetDefault(m.id)}
                            disabled={busy}
                            className="ui-btn ui-btn--secondary"
                            style={{ padding: '8px 10px', borderRadius: 10, flexShrink: 0 }}
                          >
                            <FaRegStar />
                          </button>
                        ) : (
                          <FaStar style={{ color: '#eab308', flexShrink: 0 }} />
                        )}
                        <button
                          type="button"
                          aria-label={t('payment_methods_remove', 'Remove')}
                          onClick={() => handleRemove(m.id)}
                          disabled={busy}
                          className="ui-btn ui-btn--secondary"
                          style={{ padding: '8px 10px', borderRadius: 10, flexShrink: 0, color: '#ef4444' }}
                        >
                          <FaTrash />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}

              {addingCard ? (
                <Elements stripe={stripePromise}>
                  <AddCardForm
                    onSaved={() => {
                      setAddingCard(false);
                      refresh();
                    }}
                    onCancel={() => setAddingCard(false)}
                  />
                </Elements>
              ) : (
                <button
                  type="button"
                  className="ui-btn ui-btn--primary"
                  onClick={() => setAddingCard(true)}
                  style={{ marginTop: '1.25rem', width: '100%' }}
                >
                  {t('payment_methods_add_card', 'Add card')}
                </button>
              )}
            </>
          )}

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

export default SavedPaymentMethods;
