import React from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FaEnvelopeOpenText } from 'react-icons/fa';
import './UnhandledInvitationsReminder.css';

/**
 * Centered floating reminder for pending private/private invites.
 */import { AppText } from "../base";
export default function UnhandledInvitationsReminder({ visible, counts, onDismiss }) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  if (!visible || !counts?.total) return null;

  const handleView = () => {
    onDismiss?.();
    navigate('/invite/received');
  };

  return createPortal(
    <div
      className="unhandled-invitations-reminder"
      role="dialog"
      aria-modal="true"
      aria-labelledby="unhandled-invitations-reminder-title"
      onClick={onDismiss}>
      
            <div
        className="unhandled-invitations-reminder__card"
        onClick={(e) => e.stopPropagation()}>
        
                <div className="unhandled-invitations-reminder__icon" aria-hidden>
                    <FaEnvelopeOpenText />
                </div>

                <AppText as="h2" id="unhandled-invitations-reminder-title" className="unhandled-invitations-reminder__title">
                    {t(
            'unhandled_invitations_reminder_title',
            'You have invitations waiting for your response'
          )}
                </AppText>

                <AppText as="p" className="unhandled-invitations-reminder__body">
                    {t(
            'unhandled_invitations_reminder_body',
            'Private and private invites are still pending. Review them and accept or decline.'
          )}
                </AppText>

                <div className="unhandled-invitations-reminder__counts">
                    {counts.private > 0 &&
          <div className="unhandled-invitations-reminder__count-row">
                            <AppText as="span">
                                {t('unhandled_invitations_reminder_private_label', 'Private invitations')}
                            </AppText>
                            <AppText as="span" className="unhandled-invitations-reminder__count-badge">{counts.private}</AppText>
                        </div>
          }
                    {counts.dating > 0 &&
          <div className="unhandled-invitations-reminder__count-row">
                            <AppText as="span">
                                {t('unhandled_invitations_reminder_private_label', 'Private Invites')}
                            </AppText>
                            <AppText as="span" className="unhandled-invitations-reminder__count-badge">{counts.dating}</AppText>
                        </div>
          }
                </div>

                <div className="unhandled-invitations-reminder__actions">
                    <button
            type="button"
            className="unhandled-invitations-reminder__btn unhandled-invitations-reminder__btn--primary"
            onClick={handleView}>
            
                        {t('unhandled_invitations_reminder_view_cta', 'View invitations')}
                    </button>
                    <button
            type="button"
            className="unhandled-invitations-reminder__btn unhandled-invitations-reminder__btn--ghost"
            onClick={onDismiss}>
            
                        {t('later', 'Later')}
                    </button>
                </div>
            </div>
        </div>,
    document.body
  );
}