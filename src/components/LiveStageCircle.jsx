import React from 'react';
import { FaSignal } from 'react-icons/fa';
import UserAvatar from './UserAvatar';
import { AppText } from './base';
import { shouldBlockDirectImageLoad } from '../utils/avatarUtils';
import './LiveStageCircle.css';

function usableAvatarUrl(url) {
  const u = typeof url === 'string' ? url.trim() : '';
  if (!u || u.length < 10) return '';
  if (!(u.startsWith('http') || u.startsWith('data:image'))) return '';
  if (shouldBlockDirectImageLoad(u)) return '';
  return u;
}

/**
 * TikTok-style live room circle for the stories rail.
 */
export default function LiveStageCircle({ stage, onClick }) {
  const name = stage?.title || stage?.hostName || 'Stage';
  const photo = usableAvatarUrl(stage?.hostAvatar);
  const avatarUser = {
    id: stage?.hostId,
    display_name: stage?.hostName || name,
    photo_url: photo || undefined,
    photoURL: photo || undefined,
    avatar: photo || undefined,
  };

  return (
    <button type="button" className="live-stage-circle" onClick={onClick}>
      <div className="live-stage-circle__ring">
        <UserAvatar
          user={avatarUser}
          src={photo || undefined}
          alt={name}
          noGenderRing
          className="live-stage-circle__avatar"
          style={{ width: 64, height: 64 }}
        />
        <AppText as="span" className="live-stage-circle__badge" aria-hidden format={false}>
          <FaSignal className="live-stage-circle__badge-icon" />
        </AppText>
        <AppText as="span" className="live-stage-circle__live-tag" format={false}>
          LIVE
        </AppText>
      </div>
      <AppText as="span" className="live-stage-circle__label">
        {name}
      </AppText>
    </button>
  );
}
