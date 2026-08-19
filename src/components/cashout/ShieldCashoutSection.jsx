import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaMinus, FaPlus, FaShieldAlt, FaTimes } from 'react-icons/fa';
import { AppText } from '../base';
import { CASHOUT_SHIELD_TIERS, computeJarBreakdown } from '../../utils/cashoutShieldTiers';
import {
  getGiftShieldVisualTheme,
  getGiftJarImageSrc,
} from '../../constants/giftShieldVisualThemes';
import { requestCashout } from '../../utils/requestCashout';
import { useToast } from '../../context/ToastContext';
import './ShieldCashoutSection.css';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Jar-package cash-out picker (savings balance only; no free-form amount).
 * Lets the user pick several Jars across sizes and submit one combined request.
 */
export default function ShieldCashoutSection({
  savedBalance = 0,
  pendingRequestId = null,
  disabled = false,
}) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [selection, setSelection] = useState({});
  const [modalOpen, setModalOpen] = useState(false);
  const [paypalEmail, setPaypalEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const hasPending = Boolean(pendingRequestId);
  const blocked = disabled || hasPending || submitting;

  // Default selection = the natural largest-first breakdown of the current balance.
  useEffect(() => {
    if (blocked) return;
    const breakdown = computeJarBreakdown(savedBalance);
    const next = {};
    for (const item of breakdown.items) next[item.id] = item.count;
    setSelection(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedBalance]);

  const selectedItems = useMemo(
    () =>
      CASHOUT_SHIELD_TIERS.map((tier) => ({ tier, count: selection[tier.id] || 0 })).filter(
        (x) => x.count > 0
      ),
    [selection]
  );

  const totalCredits = selectedItems.reduce((sum, x) => sum + x.tier.amountCredits * x.count, 0);
  const totalFiat = selectedItems.reduce((sum, x) => sum + x.tier.amountFiatUsd * x.count, 0);
  const remaining = Math.max(0, savedBalance - totalCredits);

  const adjust = (tierId, delta) => {
    if (blocked) return;
    setSelection((prev) => {
      const tier = CASHOUT_SHIELD_TIERS.find((t) => t.id === tierId);
      const current = prev[tierId] || 0;
      if (delta > 0 && remaining < tier.amountCredits) return prev;
      const next = Math.max(0, current + delta);
      return { ...prev, [tierId]: next };
    });
  };

  const closeModal = () => {
    if (submitting) return;
    setModalOpen(false);
    setPaypalEmail('');
  };

  const onConfirm = async () => {
    if (submitting || !selectedItems.length) return;
    const email = paypalEmail.trim().toLowerCase();
    if (!EMAIL_RE.test(email)) {
      showToast(t('cashout_invalid_paypal', 'Enter a valid PayPal email.'), 'error');
      return;
    }
    setSubmitting(true);
    try {
      await requestCashout({
        items: selectedItems.map((x) => ({ shieldType: x.tier.id, count: x.count })),
        paypalEmail: email,
      });
      showToast(
        t(
          'cashout_request_submitted',
          'Cash-out request submitted. We will review it within 7–14 business days.'
        ),
        'success'
      );
      setModalOpen(false);
      setPaypalEmail('');
      setSelection({});
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
        {t('cashout_jars_title', 'Cash out Jars')}
      </div>
      <AppText as="p" className="shield-cashout__lead">
        {t(
          'cashout_jars_lead',
          'Redeem Jars from your Cherry balance — not an arbitrary amount. Purchase credits cannot be cashed out. Lifetime shield progress stays intact.'
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
          const count = selection[tier.id] || 0;
          const canIncrement = !blocked && remaining >= tier.amountCredits;
          const img = getGiftJarImageSrc(getGiftShieldVisualTheme(tier.id));
          return (
            <div key={tier.id} className="shield-cashout__card">
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
                {tier.amountCredits.toLocaleString()} {t('cherries_unit', 'cherries')}
              </AppText>
              <div className="shield-cashout__stepper">
                <button
                  type="button"
                  className="shield-cashout__stepper-btn"
                  onClick={() => adjust(tier.id, -1)}
                  disabled={blocked || count === 0}
                  aria-label={t('decrease', 'Decrease')}
                >
                  <FaMinus aria-hidden />
                </button>
                <AppText as="span" className="shield-cashout__stepper-count">
                  {count}
                </AppText>
                <button
                  type="button"
                  className="shield-cashout__stepper-btn"
                  onClick={() => adjust(tier.id, 1)}
                  disabled={!canIncrement}
                  aria-label={t('increase', 'Increase')}
                >
                  <FaPlus aria-hidden />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {selectedItems.length ? (
        <div className="shield-cashout__summary">
          <AppText as="span">
            {t('cashout_selection_total', 'Total: {{credits}} cherries · ${{amount}} USD', {
              credits: totalCredits.toLocaleString(),
              amount: totalFiat.toLocaleString(),
            })}
          </AppText>
          <button
            type="button"
            className="shield-cashout__btn shield-cashout__btn--primary"
            onClick={() => setModalOpen(true)}
            disabled={blocked}
          >
            {t('cashout_submit', 'Request cash-out')}
          </button>
        </div>
      ) : null}

      {modalOpen ? (
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
              {t('cashout_confirm_title_multi', 'Confirm your cash-out')}
            </AppText>
            <ul className="shield-cashout__modal-items">
              {selectedItems.map((x) => (
                <li key={x.tier.id}>
                  {x.count}× {t(x.tier.labelKey, x.tier.defaultLabel)} — $
                  {(x.tier.amountFiatUsd * x.count).toLocaleString()}
                </li>
              ))}
            </ul>
            <AppText as="p" className="shield-cashout__modal-body">
              {t(
                'cashout_confirm_body_multi',
                'This will deduct {{credits}} cherries from your savings balance (${{amount}} USD total). Lifetime shield progress will not decrease. Enter your PayPal email to continue.',
                { credits: totalCredits.toLocaleString(), amount: totalFiat.toLocaleString() }
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
