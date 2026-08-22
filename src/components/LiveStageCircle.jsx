import React from 'react';
import { FaSignal } from 'react-icons/fa';
import UserAvatar from './UserAvatar';
import { AppText } from './base';
import { shouldBlockDirectImageLoad, normalizeUserGender } from '../utils/avatarUtils';
import './LiveStageCircle.css';

function usableAvatarUrl(url) {
  const u = typeof url === 'string' ? url.trim() : '';
  if (!u || u.length < 10) return '';
  if (!(u.startsWith('http') || u.startsWith('data:image'))) return '';
  if (shouldBlockDirectImageLoad(u)) return '';
  return u;
}

/** Same gender palette as the avatar ring, styled as a "live" gradient ring. */
function stageRingVarsForGender(gender) {
  if (gender === 'male') {
    return {
      '--stage-ring-gradient': 'conic-gradient(from 210deg, #3b82f6, #60a5fa, #2563eb, #3b82f6)',
      '--stage-accent': '#2563eb'
    };
  }
  if (gender === 'female') {
    return {
      '--stage-ring-gradient': 'conic-gradient(from 210deg, #ec4899, #f472b6, #db2777, #ec4899)',
      '--stage-accent': '#db2777'
    };
  }
  return {
    '--stage-ring-gradient': 'conic-gradient(from 210deg, #a855f7, #c084fc, #9333ea, #a855f7)',
    '--stage-accent': '#9333ea'
  };
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
  const ringVars = stageRingVarsForGender(normalizeUserGender({ gender: stage?.hostGender }));

  return (
    <button type="button" className="live-stage-circle" onClick={onClick} style={ringVars}>
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
