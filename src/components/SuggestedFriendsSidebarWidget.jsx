import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FaUserFriends } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import { useSuggestedFriends } from '../hooks/useSuggestedFriends';
import { getSafeAvatar } from '../utils/avatarUtils';
import { resolveProfileAvatarUrl } from '../utils/profileGallery';
import { AppText } from './base';

function sidebarAvatarSrc(user) {
  return resolveProfileAvatarUrl(user) || user?.photoURL || user?.photo_url || user?.avatar || getSafeAvatar(user);
}

export default function SuggestedFriendsSidebarWidget() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { currentUser, userProfile, isGuest } = useAuth();

  const enabled = Boolean(currentUser?.uid && !isGuest);
  const { loading, suggested } = useSuggestedFriends({
    userProfile,
    currentUser,
    enabled,
  });

  if (!enabled) return null;
  if (loading && suggested.length === 0) {
    return (
      <div className="ds-widget-card" aria-busy="true">
        <div className="ds-widget-header">
          <FaUserFriends size={14} style={{ color: 'var(--primary)' }} />
          <AppText as="span">{t('suggested_friends', 'Suggested Friends')}</AppText>
        </div>
        <div className="ds-widget-skeleton-row" />
        <div className="ds-widget-skeleton-row" />
      </div>
    );
  }
  if (!suggested.length) return null;

  return (
    <div className="ds-widget-card">
      <div className="ds-widget-header">
        <FaUserFriends size={14} style={{ color: 'var(--primary)' }} />
        <AppText as="span">{t('suggested_friends', 'Suggested Friends')}</AppText>
        <Link to="/search/list" className="ds-widget-see-all">{t('see_all', 'See all')}</Link>
      </div>
      {suggested.map((user) => (
        <div
          key={user.id}
          className="ds-widget-row"
          onClick={() => navigate(`/profile/${user.id}`)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') navigate(`/profile/${user.id}`);
          }}
        >
          <img
            src={sidebarAvatarSrc(user)}
            alt={user.displayName || user.display_name || t('user', 'User')}
            className="ds-widget-img-round"
            loading="lazy"
            onError={(e) => {
              e.currentTarget.onerror = null;
              e.currentTarget.src = getSafeAvatar(null);
            }}
          />
          <div className="ds-widget-info">
            <div className="ds-widget-title">{user.displayName || user.display_name || t('user', 'User')}</div>
            <div className="ds-widget-sub">
              {[user.city, user.ageRange || user.ageCategory].filter(Boolean).join(' · ') || t('profile_match', 'Profile match')}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
