import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import html2canvas from 'html2canvas';
import { useTranslation } from 'react-i18next';
import { doc, onSnapshot } from 'firebase/firestore';
import { FaDownload } from 'react-icons/fa';
import { db } from '../../firebase/config';
import { AppText } from '../base';
import { useAuth } from '../../context/AuthContext';
import { saveImageDataUrl } from '../../utils/saveImageDataUrl';
import './CommunityMemberCard.css';

/**
 * Member loyalty card — credit-card proportions, the member's name + the business
 * name, a faint DineBuddies logo watermark, the membership QR, and the serial
 * number (no hash). Downloadable to the device.
 *
 * QR payload: `DBM1:<partnerId>:<qrToken>`.
 */
export default function CommunityMemberCard({ partnerId, currentUser, businessName }) {
  const { t } = useTranslation();
  const { userProfile } = useAuth();
  const [membership, setMembership] = useState(null);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const cardRef = useRef(null);

  const uid = currentUser?.uid;
  const memberName =
    userProfile?.display_name || userProfile?.displayName || currentUser?.displayName || t('member', 'Member');

  useEffect(() => {
    if (!partnerId || !uid) {
      setMembership(null);
      return undefined;
    }
    const ref = doc(db, 'community_memberships', `${partnerId}__${uid}`);
    const unsub = onSnapshot(
      ref,
      (snap) => setMembership(snap.exists() ? snap.data() : null),
      () => setMembership(null)
    );
    return () => unsub();
  }, [partnerId, uid]);

  const isActive = membership?.status === 'active' && membership?.memberNumber;
  const qrToken = membership?.qrToken || '';

  useEffect(() => {
    if (!isActive || !qrToken) {
      setQrDataUrl('');
      return undefined;
    }
    let cancelled = false;
    void QRCode.toDataURL(`DBM1:${partnerId}:${qrToken}`, {
      width: 220,
      margin: 1,
      color: { dark: '#0f172a', light: '#ffffff' },
    })
      .then((url) => !cancelled && setQrDataUrl(url))
      .catch(() => !cancelled && setQrDataUrl(''));
    return () => {
      cancelled = true;
    };
  }, [isActive, qrToken, partnerId]);

  if (!isActive) return null;

  const serial = String(membership.memberNumber).padStart(4, '0');

  const handleDownload = async () => {
    if (saving || !cardRef.current) return;
    setSaving(true);
    try {
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: null,
        scale: 2,
        useCORS: true,
        logging: false,
      });
      await saveImageDataUrl(canvas.toDataURL('image/png'), `dinebuddies-member-${serial}.png`);
    } catch {
      /* best-effort */
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mcard-wrap">
      <div className="mcard" ref={cardRef}>
        <img className="mcard__wm" src="/db-logo-white.svg" alt="" aria-hidden />
        <div className="mcard__top">
          <AppText as="span" className="mcard__brand">{businessName || t('business', 'Business')}</AppText>
          <AppText as="span" className="mcard__label">{t('community_member_card_title', 'Community member card')}</AppText>
        </div>
        <div className="mcard__body">
          <div className="mcard__info">
            <AppText as="span" className="mcard__name" dir="auto">{memberName}</AppText>
            <AppText as="span" className="mcard__num-label">{t('community_member_number', 'Member No.')}</AppText>
            <AppText as="span" className="mcard__num">{serial}</AppText>
          </div>
          {qrDataUrl ? (
            <div className="mcard__qr">
              <img src={qrDataUrl} alt={t('community_member_qr_alt', 'Membership QR code')} />
            </div>
          ) : null}
        </div>
      </div>

      <button type="button" className="mcard-download" onClick={handleDownload} disabled={saving}>
        <FaDownload aria-hidden style={{ marginInlineEnd: 8 }} />
        {saving ? t('offer_claim_saving', 'Saving…') : t('member_card_download', 'Download card')}
      </button>
      <AppText as="p" className="mcard-hint">
        {t('community_member_card_hint', 'Show this to the venue to verify your membership and claim member offers.')}
      </AppText>
    </div>
  );
}
