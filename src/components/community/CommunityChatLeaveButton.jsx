import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaSignOutAlt } from 'react-icons/fa';
import { useInvitations } from '../../context/InvitationContext';
import { AppText } from '../base';

/** Direct leave / unjoin button for regular community members (desktop + mobile header). */
export default function CommunityChatLeaveButton({ partnerId, partnerName, onLeft }) {
  const { t } = useTranslation();
  const { leaveCommunity } = useInvitations();
  const [leaving, setLeaving] = useState(false);

  const handleLeave = async () => {
    const name = partnerName || t('community_chat', 'Community Chat');
    if (
      !window.confirm(
        `${t('Are you sure you want to leave', 'Are you sure you want to leave')} ${name}?`
      )
    ) {
      return;
    }

    setLeaving(true);
    try {
      const success = await leaveCommunity(partnerId);
      if (success) onLeft?.();
    } catch (error) {
      console.error('Error leaving community:', error);
    } finally {
      setLeaving(false);
    }
  };

  const label = t('Leave Community', 'Leave Community');

  return (
    <button
      type="button"
      className="community-chat-leave-btn"
      onClick={() => void handleLeave()}
      disabled={leaving}
      aria-label={label}
      title={label}
    >
      <FaSignOutAlt size={15} aria-hidden />
      <AppText as="span" className="community-chat-leave-btn__label">
        {t('leave_community', 'Leave')}
      </AppText>
    </button>
  );
}
