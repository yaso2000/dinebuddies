import React from 'react';
import { useTranslation } from 'react-i18next';
import { AppText } from '../base';
import UserAvatar from '../UserAvatar';

export default function CommunityParticipantsView({ participants, loading, partnerId }) {
  const { t } = useTranslation();

  if (loading) {
    return (
      <div className="community-participants">
        <AppText as="p" className="community-participants__status">
          {t('inbox_loading', 'Loading…')}
        </AppText>
      </div>
    );
  }

  if (participants.length === 0) {
    return (
      <div className="community-participants">
        <AppText as="p" className="community-participants__status">
          {t('community_participants_empty', 'No members yet.')}
        </AppText>
      </div>
    );
  }

  return (
    <div className="community-participants">
      <AppText as="h2" className="community-participants__title">
        {t('community_participants_title', 'Online Participants')}
      </AppText>
      <ul className="community-participants__list">
        {participants.map((member) => (
          <li key={member.id} className="community-participants__row">
            <div className="community-participants__avatar-wrap">
              <UserAvatar
                user={member}
                src={member.avatar}
                alt=""
                className="community-participants__avatar"
              />
              {member.isOnline ? (
                <span className="community-participants__online-dot" aria-label={t('online', 'Online')} />
              ) : null}
            </div>
            <div className="community-participants__meta">
              <AppText as="span" className="community-participants__name">
                {member.displayName}
              </AppText>
              {member.id === partnerId ? (
                <AppText as="span" className="community-participants__badge">
                  {t('host', 'Host')}
                </AppText>
              ) : member.isOnline ? (
                <AppText as="span" className="community-participants__status-line">
                  {t('online', 'Online')}
                </AppText>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
