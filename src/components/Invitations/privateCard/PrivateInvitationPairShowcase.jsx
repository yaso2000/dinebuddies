import React, { useMemo } from 'react';
import UserAvatar from '../../UserAvatar';
import { normalizePersonalInviteCategory } from '../../../constants/personalInviteCategories';
import './PrivateInvitationPairShowcase.css';
import { AppText } from "../../base";

function displayName(user, fallback = '') {
  return (
    user?.display_name ||
    user?.displayName ||
    user?.name ||
    fallback);
}

// One variant per real personal-invite category (social, friendship, family,
// work, acquaintance). No dating/romantic category exists — every icon is neutral.
const CATEGORY_VARIANT = {
  social: {
    connector: '✨',
    headingKey: 'private_pair_heading_social',
    headingDefault: 'Social hangout',
    ariaKey: 'private_pair_aria_social',
    ariaDefault: 'Social pairing',
    acceptedKey: 'private_pair_accepted_social',
    acceptedDefault: 'Hangout confirmed',
  },
  friendship: {
    connector: '🤝',
    headingKey: 'private_pair_heading_friendship',
    headingDefault: 'Friendship meetup',
    ariaKey: 'private_pair_aria_friendship',
    ariaDefault: 'Friendship pairing',
    acceptedKey: 'private_pair_accepted_friendship',
    acceptedDefault: 'Meetup confirmed',
  },
  family: {
    connector: '👨‍👩‍👧',
    headingKey: 'private_pair_heading_family',
    headingDefault: 'Family gathering',
    ariaKey: 'private_pair_aria_family',
    ariaDefault: 'Family pairing',
    acceptedKey: 'private_pair_accepted_family',
    acceptedDefault: 'Gathering confirmed',
  },
  work: {
    connector: '💼',
    headingKey: 'private_pair_heading_work',
    headingDefault: 'Work meetup',
    ariaKey: 'private_pair_aria_work',
    ariaDefault: 'Work pairing',
    acceptedKey: 'private_pair_accepted_work',
    acceptedDefault: 'Meetup confirmed',
  },
  acquaintance: {
    connector: '👋',
    headingKey: 'private_pair_heading_acquaintance',
    headingDefault: 'Getting acquainted',
    ariaKey: 'private_pair_aria_acquaintance',
    ariaDefault: 'Acquaintance pairing',
    acceptedKey: 'private_pair_accepted_acquaintance',
    acceptedDefault: 'Meetup confirmed',
  },
};

/**
 * Private Invite: host + guest portrait pairing (single invitee), styled by purpose.
 */
export default function PrivateInvitationPairShowcase({
  host,
  guest,
  guestRsvpStatus = 'pending',
  personalInviteCategory = 'friendship',
  t,
  className = ''
}) {
  const categoryId = normalizePersonalInviteCategory(personalInviteCategory);
  const variant = CATEGORY_VARIANT[categoryId] || CATEGORY_VARIANT.friendship;

  const hostName = displayName(host, t('host', 'Host'));
  const guestName = displayName(guest, t('guest', 'Guest'));

  const statusMeta = useMemo(() => {
    if (guestRsvpStatus === 'accepted') {
      return {
        className: 'private-invite-pair__status--accepted',
        // Use the category's own neutral icon — never a romantic heart.
        icon: variant.connector,
        label: t(variant.acceptedKey, { defaultValue: variant.acceptedDefault })
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
  }, [guestRsvpStatus, t, variant.acceptedKey, variant.acceptedDefault, variant.connector]);

  if (!host && !guest) return null;

  return (
    <section
      className={`private-invite-pair private-invite-pair--${categoryId} reveal-text reveal-delay-4 ${className}`.trim()}
      aria-label={t(variant.ariaKey, { defaultValue: variant.ariaDefault })}>
      
            <AppText as="h3" className="private-invite-pair__title">
                {t(variant.headingKey, { defaultValue: variant.headingDefault })}
            </AppText>

            <div className="private-invite-pair__stage">
                <div className="private-invite-pair__glow" aria-hidden />
                <div className="private-invite-pair__avatars">
                    <div className="private-invite-pair__avatar-wrap private-invite-pair__avatar-wrap--host">
                        <UserAvatar
              className="private-invite-pair__avatar"
              user={host || {}}
              alt={hostName}
              style={{ width: '100%', height: '100%' }} />
            
                    </div>
                    <AppText as="span" className="private-invite-pair__connector" aria-hidden>
                        {variant.connector}
                    </AppText>
                    <div className="private-invite-pair__avatar-wrap private-invite-pair__avatar-wrap--guest">
                        <UserAvatar
              className="private-invite-pair__avatar"
              user={guest || {}}
              alt={guestName}
              style={{ width: '100%', height: '100%' }} />
            
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
