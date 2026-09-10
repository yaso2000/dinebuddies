import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { useTranslation } from 'react-i18next';
import { FaTimes, FaCheckCircle } from 'react-icons/fa';
import { AppText } from './base';
import { offerClaimQrPayload } from '../services/communityMemberApi';
import './OfferClaimQrModal.css';

/**
 * Shown after a member takes ("خُذه") a specific offer. Renders the per-offer claim
 * QR (DBO1:<offerId>:<claimToken>) the member shows at the venue. The business scans
 * it and redeems that offer only. If the claim is already redeemed, we say so.
 */
export default function OfferClaimQrModal({ claim, onClose }) {
  const { t } = useTranslation();
  const [qrDataUrl, setQrDataUrl] = useState('');

  const offerId = claim?.offerId || '';
  const claimToken = claim?.claimToken || '';
  const redeemed = claim?.status === 'redeemed';

  useEffect(() => {
    if (!offerId || !claimToken || redeemed) {
      setQrDataUrl('');
      return undefined;
    }
    let cancelled = false;
    void QRCode.toDataURL(offerClaimQrPayload(offerId, claimToken), {
      width: 260,
      margin: 1,
      color: { dark: '#0f172a', light: '#ffffff' },
    })
      .then((url) => !cancelled && setQrDataUrl(url))
      .catch(() => !cancelled && setQrDataUrl(''));
    return () => {
      cancelled = true;
    };
  }, [offerId, claimToken, redeemed]);

  if (!claim) return null;

  return (
    <div className="offer-claim-qr-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="offer-claim-qr" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="offer-claim-qr__close"
          onClick={onClose}
          aria-label={t('close', 'Close')}>
          <FaTimes />
        </button>

        {claim.offerTitle ? (
          <AppText as="h3" className="offer-claim-qr__title">{claim.offerTitle}</AppText>
        ) : null}

        {redeemed ? (
          <div className="offer-claim-qr__redeemed">
            <FaCheckCircle className="offer-claim-qr__redeemed-icon" aria-hidden />
            <AppText as="p">{t('offer_claim_already_redeemed', 'You already redeemed this offer.')}</AppText>
          </div>
        ) : (
          <>
            {qrDataUrl ? (
              <div className="offer-claim-qr__code">
                <img src={qrDataUrl} alt={t('offer_claim_qr_alt', 'Offer QR code')} />
              </div>
            ) : (
              <div className="offer-claim-qr__code offer-claim-qr__code--loading">
                {t('loading', 'Loading…')}
              </div>
            )}
            <AppText as="p" className="offer-claim-qr__hint">
              {t('offer_claim_qr_hint', 'Show this code at the venue to redeem this offer.')}
            </AppText>
          </>
        )}
      </div>
    </div>
  );
}
