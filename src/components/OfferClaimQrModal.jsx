import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import QRCode from 'qrcode';
import { useTranslation } from 'react-i18next';
import { FaTimes, FaCheckCircle, FaDownload } from 'react-icons/fa';
import { AppText } from './base';
import { offerClaimQrPayload } from '../services/communityMemberApi';
import { saveImageDataUrl } from '../utils/saveImageDataUrl';
import './OfferClaimQrModal.css';

/** Draw a shareable card (business + offer title + QR + hint) as a PNG data URL. */
async function composeOfferCardPng({ payload, title, hint, businessName }) {
  const scale = 2;
  const W = 360;
  const H = 460;
  const canvas = document.createElement('canvas');
  canvas.width = W * scale;
  canvas.height = H * scale;
  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);

  // Card background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  // Business (venue) name
  ctx.textAlign = 'center';
  ctx.fillStyle = '#f97316';
  ctx.font = '800 16px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
  ctx.fillText(String(businessName || 'DineBuddies').slice(0, 40), W / 2, 40);

  // Offer title (wrapped, up to 2 lines)
  ctx.fillStyle = '#0f172a';
  ctx.font = '800 22px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
  const words = String(title || '').split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > W - 56 && line) {
      lines.push(line);
      line = w;
      if (lines.length === 2) break;
    } else {
      line = test;
    }
  }
  if (line && lines.length < 2) lines.push(line);
  let ty = 78;
  for (const l of lines.slice(0, 2)) {
    ctx.fillText(l, W / 2, ty);
    ty += 28;
  }

  // QR
  const qrUrl = await QRCode.toDataURL(payload, {
    width: 640,
    margin: 1,
    color: { dark: '#0f172a', light: '#ffffff' },
  });
  const qrImg = new Image();
  await new Promise((res, rej) => {
    qrImg.onload = res;
    qrImg.onerror = rej;
    qrImg.src = qrUrl;
  });
  const qrSize = 220;
  const qrY = ty + 10;
  ctx.drawImage(qrImg, (W - qrSize) / 2, qrY, qrSize, qrSize);

  // Hint
  ctx.fillStyle = '#6b7280';
  ctx.font = '400 14px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
  const hintY = qrY + qrSize + 34;
  const hintWords = String(hint || '').split(/\s+/).filter(Boolean);
  let hl = '';
  let hy = hintY;
  for (const w of hintWords) {
    const test = hl ? `${hl} ${w}` : w;
    if (ctx.measureText(test).width > W - 48 && hl) {
      ctx.fillText(hl, W / 2, hy);
      hl = w;
      hy += 20;
    } else {
      hl = test;
    }
  }
  if (hl) ctx.fillText(hl, W / 2, hy);

  return canvas.toDataURL('image/png');
}

/**
 * Shown after a member takes ("خُذه") a specific offer. Renders the per-offer claim
 * QR (DBO1:<offerId>:<claimToken>) the member shows at the venue, and lets them save
 * it as an image (there can be a long gap between claiming and redeeming). If the
 * claim is already redeemed, we say so.
 */
export default function OfferClaimQrModal({ claim, onClose }) {
  const { t } = useTranslation();
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');

  const offerId = claim?.offerId || '';
  const claimToken = claim?.claimToken || '';
  const redeemed = claim?.status === 'redeemed';
  const offerTitle = claim?.offerTitle || '';
  const businessName = claim?.businessName || '';
  const hint = t('offer_claim_qr_hint', 'Show this code at the venue to redeem this offer.');

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

  const handleSave = useCallback(async () => {
    if (saving || !offerId || !claimToken) return;
    setSaving(true);
    setSavedMsg('');
    try {
      const png = await composeOfferCardPng({
        payload: offerClaimQrPayload(offerId, claimToken),
        title: offerTitle,
        hint,
        businessName,
      });
      const safeName = (offerTitle || 'offer').replace(/[^\p{L}\p{N}]+/gu, '-').slice(0, 40);
      const res = await saveImageDataUrl(png, `dinebuddies-${safeName}.png`);
      if (res !== 'cancelled') {
        setSavedMsg(t('offer_claim_saved', 'Saved ✓'));
      }
    } catch {
      setSavedMsg(t('offer_claim_save_failed', 'Could not save. Please screenshot instead.'));
    } finally {
      setSaving(false);
    }
  }, [saving, offerId, claimToken, offerTitle, hint, t]);

  if (!claim) return null;

  // Portal to <body>: the feed wrapper uses `will-change: transform`, which makes
  // it the containing block for position:fixed, trapping the modal off-screen.
  return createPortal(
    <div className="offer-claim-qr-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="offer-claim-qr" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="offer-claim-qr__close"
          onClick={onClose}
          aria-label={t('close', 'Close')}>
          <FaTimes />
        </button>

        {businessName ? (
          <AppText as="p" className="offer-claim-qr__business">{businessName}</AppText>
        ) : null}
        {offerTitle ? (
          <AppText as="h3" className="offer-claim-qr__title">{offerTitle}</AppText>
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
            <AppText as="p" className="offer-claim-qr__hint">{hint}</AppText>

            <button
              type="button"
              className="offer-claim-qr__save"
              onClick={handleSave}
              disabled={saving || !qrDataUrl}>
              <FaDownload aria-hidden style={{ marginInlineEnd: 8 }} />
              {saving ? t('offer_claim_saving', 'Saving…') : t('offer_claim_save', 'Save as image')}
            </button>
            {savedMsg ? (
              <AppText as="p" className="offer-claim-qr__saved">{savedMsg}</AppText>
            ) : null}
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
