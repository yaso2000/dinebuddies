import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { useTranslation } from 'react-i18next';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { AppText } from '../base';
import './CommunityMemberCard.css';

/**
 * Member loyalty card for a business community: shows the member's stable number
 * (#0042) and a QR the business scans to verify membership before applying an
 * offer. Membership records live at community_memberships/{partnerId}__{uid} and
 * are created by the setCommunityMembership Cloud Function on join.
 *
 * QR payload: `DBM1:<partnerId>:<qrToken>` — a namespaced bearer token the verify
 * screen parses and checks server-side.
 */
export default function CommunityMemberCard({ partnerId, currentUser, businessName }) {
  const { t } = useTranslation();
  const [membership, setMembership] = useState(null);
  const [qrDataUrl, setQrDataUrl] = useState('');

  const uid = currentUser?.uid;

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
    const payload = `DBM1:${partnerId}:${qrToken}`;
    void QRCode.toDataURL(payload, {
      width: 240,
      margin: 1,
      color: { dark: '#0f172a', light: '#ffffff' },
    })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl('');
      });
    return () => {
      cancelled = true;
    };
  }, [isActive, qrToken, partnerId]);

  if (!isActive) return null;

  const formattedNumber = `#${String(membership.memberNumber).padStart(4, '0')}`;

  return (
    <div className="community-member-card">
      <div className="community-member-card__head">
        <AppText as="span" className="community-member-card__label">
          {t('community_member_card_title', 'Community member card')}
        </AppText>
        {businessName ? (
          <AppText as="span" className="community-member-card__business">
            {businessName}
          </AppText>
        ) : null}
      </div>

      <div className="community-member-card__body">
        <div className="community-member-card__number-block">
          <AppText as="span" className="community-member-card__number-label">
            {t('community_member_number', 'Member No.')}
          </AppText>
          <AppText as="span" className="community-member-card__number">
            {formattedNumber}
          </AppText>
        </div>
        {qrDataUrl ? (
          <div className="community-member-card__qr">
            <img src={qrDataUrl} alt={t('community_member_qr_alt', 'Membership QR code')} />
          </div>
        ) : null}
      </div>

      <AppText as="p" className="community-member-card__hint">
        {t('community_member_card_hint', 'Show this to the venue to verify your membership and claim member offers.')}
      </AppText>
    </div>
  );
}
