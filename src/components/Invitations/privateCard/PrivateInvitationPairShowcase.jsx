import React, { useMemo } from 'react';
import { getSafeAvatar } from '../../../utils/avatarUtils';
import './PrivateInvitationPairShowcase.css';
import { AppText } from "../../base";

function displayName(user, fallback = '') {
  return (
    user?.display_name ||
    user?.displayName ||
    user?.name ||
    fallback);

}

/**
 * Private Invite: intimate host + guest portrait pairing (single invitee).
 */
export default function PrivateInvitationPairShowcase({
  host,
  guest,
  guestRsvpStatus = 'pending',
  t,
  className = ''
}) {
  const hostName = displayName(host, t('host', 'Host'));
  const guestName = displayName(guest, t('guest', 'Guest'));

  const statusMeta = useMemo(() => {
    if (guestRsvpStatus === 'accepted') {
      return {
        className: 'private-invite-pair__status--accepted',
        icon: '💕',
        label: t('private_pair_accepted', { defaultValue: 'Date confirmed' })
      };
    }
    if (guestRsvpStatus === 'declined') {
      return {
        className: 'private-invite-pair__status--declined',
        icon: '🌸',
        label: t('private_pair_declined', { defaultValue: 'Not available' })
      };
    }
    return {
      className: 'private-invite-pair__status--pending',
      icon: '⏳',
      label: t('private_pair_pending', { defaultValue: 'Awaiting response' })
    };
  }, [guestRsvpStatus, t]);

  if (!host && !guest) return null;

  return (
    <section
      className={`private-invite-pair reveal-text reveal-delay-4 ${className}`.trim()}
      aria-label={t('private_pair_aria', { defaultValue: 'Date pairing' })}>
      
            <AppText as="h3" className="private-invite-pair__title">
                {t('private_pair_heading', { defaultValue: 'Your date' })}
            </AppText>

            <div className="private-invite-pair__stage">
                <div className="private-invite-pair__glow" aria-hidden />
                <div className="private-invite-pair__avatars">
                    <div className="private-invite-pair__avatar-wrap private-invite-pair__avatar-wrap--host">
                        <img
              className="private-invite-pair__avatar"
              src={getSafeAvatar(host || {})}
              alt={hostName} />
            
                    </div>
                    <AppText as="span" className="private-invite-pair__heart" aria-hidden>
                        ♥
                    </AppText>
                    <div className="private-invite-pair__avatar-wrap private-invite-pair__avatar-wrap--guest">
                        <img
              className="private-invite-pair__avatar"
              src={getSafeAvatar(guest || {})}
              alt={guestName} />
            
                    </div>
                </div>
            </div>

            <div className="private-invite-pair__names">
                <AppText as="span" className="private-invite-pair__name">{hostName}</AppText>
                <AppText as="span" className="private-invite-pair__ampersand" aria-hidden>
                    &
                </AppText>
                <AppText as="span" className="private-invite-pair__name">{guestName}</AppText>
            </div>

            <AppText as="span" className={`private-invite-pair__status ${statusMeta.className}`}>
                {statusMeta.icon} {statusMeta.label}
            </AppText>
        </section>);

}