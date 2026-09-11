import React, { useMemo } from 'react';
import { createPortal } from 'react-dom';
import { FaTimes } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';
import { useInvitations } from '../context/InvitationContext';
import {
  resolveHostInvitationNavigationState,
} from '../utils/hostInvitationFromBusiness';
import InviteCreateTypePicker, { inviteCreateTypeSubtitle } from './InviteCreateTypePicker';
import './CreateInvitationSelector.css';
import { AppText } from './base';

const CreateInvitationSelector = ({ isOpen, onClose, navigationState }) => {
  const { t } = useTranslation();
  const { restaurants } = useInvitations();

  const resolvedState = useMemo(
    () =>
      resolveHostInvitationNavigationState({
        locationState: navigationState,
        businessId: navigationState?.businessId || navigationState?.restaurantData?.id,
        restaurants,
      }),
    [navigationState, restaurants]
  );

  if (!isOpen) return null;

  // Portal to <body>: rendered from within the directory/card list (which uses
  // transforms), a fixed overlay would otherwise be trapped off-screen (blur only).
  return createPortal(
    <div className="selector-overlay" onClick={onClose}>
      <div className="selector-content" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="close-btn" onClick={onClose}>
          <FaTimes />
        </button>

        <AppText as="h3" className="selector-title">
          {t('invite_create_title')}
        </AppText>
        <AppText as="p" className="selector-subtitle">
          {inviteCreateTypeSubtitle(t, resolvedState?.restaurantData?.name)}
        </AppText>

        <InviteCreateTypePicker
          variant="selector"
          navigationState={navigationState}
          onAfterNavigate={onClose}
          invitationsOnly
        />
      </div>
    </div>,
    document.body
  );
};

export default CreateInvitationSelector;
