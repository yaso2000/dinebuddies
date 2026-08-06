import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaShieldAlt, FaTimes } from 'react-icons/fa';
import { AppText } from '../base';
import { CASHOUT_SHIELD_TIERS, canCashoutShield } from '../../utils/cashoutShieldTiers';
import {
  getGiftShieldVisualTheme,
  getGiftShieldImageSrc,
} from '../../constants/giftShieldVisualThemes';
import { requestCashout } from '../../utils/requestCashout';
import { useToast } from '../../context/ToastContext';
import './ShieldCashoutSection.css';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Shield-package cash-out grid (savings balance only; no free-form amount).
 */
export default function ShieldCashoutSection({
  savedBalance = 0,
  pendingRequestId = null,
  disabled = false,
}) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [selectedId, setSelectedId] = useState(null);
  const [paypalEmail, setPaypalEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const selected = useMemo(
    () => CASHOUT_SHIELD_TIERS.find((x) => x.id === selectedId) || null,
    [selectedId]
  );

  const hasPending = Boolean(pendingRequestId);
  const blocked = disabled || hasPending || submitting;

  const closeModal = () => {
    if (submitting) return;
    setSelectedId(null);
    setPaypalEmail('');
  };

  const onPick = (tier) => {
    if (blocked) return;
    if (!canCashoutShield(savedBalance, tier.id)) {
      showToast(
        t(
          'cashout_need_more_savings',
          'You need {{credits}} savings credits to cash out this Shield.',
          { credits: tier.amountCredits.toLocaleString() }
        ),
        'error'
      );
      return;
    }
    setSelectedId(tier.id);
  };

  const onConfirm = async () => {
    if (!selected || submitting) return;
    const email = paypalEmail.trim().toLowerCase();
    if (!EMAIL_RE.test(email)) {
      showToast(t('cashout_invalid_paypal', 'Enter a valid PayPal email.'), 'error');
      return;
    }
    setSubmitting(true);
    try {
      await requestCashout({ shieldType: selected.id, paypalEmail: email });
      showToast(
        t(
          'cashout_request_submitted',
          'Cash-out request submitted. We will review it within 7–14 business days.'
        ),
        'success'
      );
      setSelectedId(null);
      setPaypalEmail('');
    } catch (err) {
      const msg =
        err?.message ||
        t('cashout_request_failed', 'Could not submit cash-out request. Try again.');
      showToast(String(msg).replace(/^Firebase:\s*/i, '').replace(/\s*\([^)]*\)\s*$/, ''), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="settings-card shield-cashout">
      <div className="credits-wallet__hints-title">
        <FaShieldAlt aria-hidden />
        {t('cashout_shields_title', 'Cash out Shields')}
      </div>
      <AppText as="p" className="shield-cashout__lead">
        {t(
          'cashout_shields_lead',
          'Redeem a fixed Shield package from your savings wallet — not an arbitrary amount. Purchase credits cannot be cashed out. Lifetime shield progress stays intact.'
        )}
      </AppText>

      {hasPending ? (
        <AppText as="p" className="shield-cashout__pending">
          {t(
            'cashout_pending_notice',
            'You already have a pending cash-out request. Wait for review before requesting another.'
          )}
        </AppText>
      ) : null}

      <div className="shield-cashout__grid">
        {CASHOUT_SHIELD_TIERS.map((tier) => {
          const affordable = canCashoutShield(savedBalance, tier.id);
          const enabled = affordable && !blocked;
          const img = getGiftShieldImageSrc(getGiftShieldVisualTheme(tier.id));
          return (
            <button
              key={tier.id}
              type="button"
              className={`shield-cashout__card${enabled ? '' : ' shield-cashout__card--disabled'}`}
              disabled={!enabled}
              onClick={() => onPick(tier)}
            >
              {img ? (
                <img src={img} alt="" className="shield-cashout__img" />
              ) : (
                <FaShieldAlt className="shield-cashout__img-fallback" aria-hidden />
              )}
              <AppText as="span" className="shield-cashout__name">
                {t(tier.labelKey, tier.defaultLabel)}
              </AppText>
              <AppText as="span" className="shield-cashout__fiat">
                ${tier.amountFiatUsd} USD
              </AppText>
              <AppText as="span" className="shield-cashout__credits">
                {tier.amountCredits.toLocaleString()}{' '}
                {t('credits_unit', 'credits')}
              </AppText>
            </button>
          );
        })}
      </div>

      {selected ? (
        <div className="shield-cashout__modal-backdrop" role="presentation" onClick={closeModal}>
          <div
            className="shield-cashout__modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cashout-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="shield-cashout__modal-close"
              onClick={closeModal}
              aria-label={t('close', 'Close')}
              disabled={submitting}
            >
              <FaTimes aria-hidden />
            </button>
            <AppText as="h3" id="cashout-modal-title" className="shield-cashout__modal-title">
              {t(
                'cashout_confirm_title',
                'You are cashing out your {{shield}} for {{amount}} USD. This will deduct {{credits}} credits from your saved balance.',
                {
                  shield: t(selected.labelKey, selected.defaultLabel),
                  amount: `$${selected.amountFiatUsd}`,
                  credits: selected.amountCredits.toLocaleString(),
                }
              )}
            </AppText>
            <AppText as="p" className="shield-cashout__modal-body">
              {t(
                'cashout_confirm_body',
                'This will deduct {{credits}} credits from your savings balance. Lifetime shield progress will not decrease. Enter your PayPal email to continue.',
                { credits: selected.amountCredits.toLocaleString() }
              )}
            </AppText>
            <label className="shield-cashout__label" htmlFor="cashout-paypal">
              {t('cashout_paypal_label', 'PayPal email')}
            </label>
            <input
              id="cashout-paypal"
              type="email"
              autoComplete="email"
              className="shield-cashout__input"
              value={paypalEmail}
              onChange={(e) => setPaypalEmail(e.target.value)}
              disabled={submitting}
              placeholder="name@example.com"
            />
            <div className="shield-cashout__actions">
              <button
                type="button"
                className="shield-cashout__btn shield-cashout__btn--ghost"
                onClick={closeModal}
                disabled={submitting}
              >
                {t('cancel', 'Cancel')}
              </button>
              <button
                type="button"
                className="shield-cashout__btn shield-cashout__btn--primary"
                onClick={onConfirm}
                disabled={submitting}
              >
                {submitting
                  ? t('loading', 'Loading…')
                  : t('cashout_submit', 'Request cash-out')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
