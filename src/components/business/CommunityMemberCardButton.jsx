import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { FaIdCard, FaTimes } from 'react-icons/fa';
import { AppText } from '../base';
import CommunityMemberCard from './CommunityMemberCard';
import './CommunityMemberCardButton.css';

/**
 * Compact entry point for the member loyalty card: a small chip on the profile
 * that opens the full card (number + QR) in a floating modal — keeps the hero
 * uncluttered instead of showing the large card up front.
 */
export default function CommunityMemberCardButton({ partnerId, currentUser, businessName }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" className="member-card-chip" onClick={() => setOpen(true)}>
        <FaIdCard aria-hidden />
        <AppText as="span">{t('community_member_card_title', 'Community member card')}</AppText>
      </button>

      {open &&
        createPortal(
          <div className="member-card-modal-overlay" role="dialog" aria-modal="true" onClick={() => setOpen(false)}>
            <div className="member-card-modal" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                className="member-card-modal__close"
                onClick={() => setOpen(false)}
                aria-label={t('close', 'Close')}>
                <FaTimes />
              </button>
              <CommunityMemberCard partnerId={partnerId} currentUser={currentUser} businessName={businessName} />
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
