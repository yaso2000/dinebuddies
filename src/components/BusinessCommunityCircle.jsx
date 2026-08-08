import React from 'react';
import { FaStore } from 'react-icons/fa';
import UserAvatar from './UserAvatar';
import { AppText } from './base';
import { shouldBlockDirectImageLoad } from '../utils/avatarUtils';
import './BusinessCommunityCircle.css';

function usableAvatarUrl(url) {
  const u = typeof url === 'string' ? url.trim() : '';
  if (!u || u.length < 10) return '';
  if (!(u.startsWith('http') || u.startsWith('data:image'))) return '';
  if (shouldBlockDirectImageLoad(u)) return '';
  return u;
}

/**
 * Business Stage circle for the stories rail (24h ephemeral rooms).
 */
export default function BusinessCommunityCircle({ community, live = false, onClick }) {
  const name = community?.name || 'Business';
  const photo = usableAvatarUrl(community?.logo);
  const avatarUser = {
    id: community?.id,
    display_name: name,
    photo_url: photo || undefined,
    photoURL: photo || undefined,
    avatar: photo || undefined,
    logo: photo || undefined,
    role: 'business',
    isBusiness: true,
  };

  return (
    <button type="button" className="biz-community-circle" onClick={onClick}>
      <div className="biz-community-circle__ring">
        <UserAvatar
          user={avatarUser}
          src={photo || undefined}
          alt={name}
          noGenderRing
          className="biz-community-circle__avatar"
          style={{ width: 64, height: 64 }}
        />
        <AppText as="span" className="biz-community-circle__badge" aria-hidden format={false}>
          <FaStore className="biz-community-circle__badge-icon" />
        </AppText>
        {live ? (
          <AppText as="span" className="biz-community-circle__live-tag" format={false}>
            LIVE
          </AppText>
        ) : null}
      </div>
      <AppText as="span" className="biz-community-circle__label">
        {name}
      </AppText>
    </button>
  );
}
