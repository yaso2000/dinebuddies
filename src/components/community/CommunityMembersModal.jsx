import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { FaTimes } from 'react-icons/fa';
import { AppText } from '../base';
import CommunityParticipantsView from './CommunityParticipantsView';

/**
 * Floating members panel for mobile Stage/Community chat — replaces the old
 * full-screen swipe page with a compact modal (close button, vertical scroll).
 */
export default function CommunityMembersModal({ open, room, onGift, onClose }) {
  const { t } = useTranslation();
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || !room || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="community-members-modal__backdrop"
      role="presentation"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        className="community-members-modal"
        role="dialog"
        aria-modal="true"
        aria-label={t('community_participants_title', 'Online Participants')}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="community-members-modal__header">
          <AppText as="h2" className="community-members-modal__title">
            {t('community_participants_title', 'Online Participants')}
          </AppText>
          <button
            type="button"
            className="community-members-modal__close"
            onClick={onClose}
            aria-label={t('close', 'Close')}
          >
            <FaTimes aria-hidden />
          </button>
        </div>
        <div className="community-members-modal__body">
          <CommunityParticipantsView
            participants={room.participants}
            loading={room.participantsLoading}
            partnerId={room.partnerId}
            isHost={Boolean(room.isHost)}
            isStageRoom={Boolean(room.isStageRoom)}
            onMuteMember={room.muteMemberInChat}
            onKickMember={room.kickMemberFromStage}
            onBlockMember={room.blockMemberFromStages}
            onGift={onGift}
            hideTitle
          />
        </div>
      </div>
    </div>,
    document.body
  );
}
