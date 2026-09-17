import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import DiscoveryFeed from '../components/discovery/DiscoveryFeed';
import UserDirectoryFilters from '../components/UserDirectory/UserDirectoryFilters';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useDiscoveryProfiles } from '../hooks/useDiscoveryProfiles';
import { useProfileGiftPicker } from '../hooks/useProfileGiftPicker';
import { likeDiscoveryProfile, sendDiscoveryGreeting } from '../utils/discoveryProfile';
import { showLikeCooldownWarning } from '../utils/connectionActionCooldown';
import { goToLogin } from '../utils/goToLogin';
import '../components/discovery/discovery.css';
import { AppText } from '../components/base';

/**
 * Connect — immersive magnetic swipe cards (default /search).
 * List browse remains available at /search/list.
 */
export default function DiscoveryPage() {
  const { t, i18n } = useTranslation();
  const { showToast, showPersistentWarning } = useToast();
  const { currentUser, userProfile, isGuest, isBusiness } = useAuth();

  const viewerUid = currentUser?.uid || currentUser?.id;
  const [genderFilter, setGenderFilter] = useState('all');
  const [ageCategoryFilter, setAgeCategoryFilter] = useState('all');
  const [photoFilter, setPhotoFilter] = useState('with_photo');
  const [onlineOnly, setOnlineOnly] = useState(false);
  const { profiles, loading, loadingMore, hasMore, loadMore, refresh, canLoad } = useDiscoveryProfiles({
    genderFilter,
    ageCategoryFilter,
    photoFilter,
    onlineOnly,
  });
  const { openGiftPicker, giftModal } = useProfileGiftPicker();

  useEffect(() => {
    if (isGuest || userProfile?.role === 'guest') {
      goToLogin({ returnPath: '/search' });
    }
  }, [isGuest, userProfile?.role]);

  const handleLike = useCallback(
    async (profile) => {
      if (!viewerUid) {
        goToLogin({ returnPath: '/search' });
        return false;
      }

      try {
        const result = await likeDiscoveryProfile(viewerUid, profile.user, userProfile || currentUser);
        if (result?.reason === 'already_liked') {
          showToast(t('discovery_like_already', 'You already liked this profile.'), 'info');
          return { ok: false, limited: true };
        }
        if (result?.reason === 'cooldown') {
          showLikeCooldownWarning(showPersistentWarning, i18n, result.cancelledAtMs, result.retryAtMs);
          return { ok: false, limited: true };
        }
        if (!result?.ok) {
          showToast(t('discovery_like_failed', 'Could not like. Try again.'), 'error');
          return { ok: false };
        }
        return { ok: true, mutual: result.mutual === true || result.match === true };
      } catch (err) {
        console.error('[Discovery] like', err);
        showToast(t('discovery_like_failed', 'Could not like. Try again.'), 'error');
        return { ok: false };
      }
    },
    [currentUser, i18n, showPersistentWarning, showToast, t, userProfile, viewerUid]
  );

  const handleGreeting = useCallback(
    async (profile) => {
      if (!viewerUid) {
        goToLogin({ returnPath: '/search' });
        return false;
      }

      try {
        const result = await sendDiscoveryGreeting(viewerUid, profile.user, userProfile || currentUser);
        if (result?.reason === 'daily_limit') {
          showToast(
            t('discovery_greeting_daily_limit', 'You can wave once per day to this member.'),
            'info'
          );
          return { ok: false, limited: true };
        }
        if (!result?.ok) {
          showToast(t('discovery_greeting_failed', 'Could not send greeting. Try again.'), 'error');
          return { ok: false };
        }
        return { ok: true };
      } catch (err) {
        console.error('[Discovery] greeting', err);
        showToast(t('discovery_greeting_failed', 'Could not send greeting. Try again.'), 'error');
        return { ok: false };
      }
    },
    [currentUser, showToast, t, userProfile, viewerUid]
  );

  const handleGift = useCallback(
    (profile) => {
      if (!viewerUid) {
        goToLogin({ returnPath: '/search' });
        return;
      }
      openGiftPicker(profile);
    },
    [openGiftPicker, viewerUid]
  );

  const handleNearEnd = useCallback(() => {
    if (hasMore && !loadingMore) loadMore();
  }, [hasMore, loadMore, loadingMore]);

  const handleRefresh = useCallback(() => {
    showToast(t('refreshing', 'Refreshing…'), 'info');
    refresh?.();
  }, [refresh, showToast, t]);

  const feedHandlers = useMemo(
    () => ({
      onLike: handleLike,
      onGreeting: handleGreeting,
      onSendGift: handleGift,
      onNearEnd: handleNearEnd,
      onRefresh: handleRefresh,
    }),
    [handleGift, handleGreeting, handleLike, handleNearEnd, handleRefresh]
  );

  // Businesses may not discover / like / contact regular users.
  if (isBusiness) return <Navigate to="/business-dashboard" replace />;

  return (
    <div className="discovery-shell discovery-shell--in-layout discovery-shell--connect">
      {/* Filter toolbar replaces the app top bar in the swipe view */}
      <div
        className="discovery-filters-topbar"
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 8,
          /* .app-layout already reserves env(safe-area-inset-top) on mobile — don't
             add it again here or the notch inset is double-counted (empty band). */
          padding: '8px 10px',
          position: 'sticky',
          top: 0,
          zIndex: 6,
        }}>
        <UserDirectoryFilters
          id="discovery-swipe-filters"
          genderFilter={genderFilter}
          onGenderFilterChange={setGenderFilter}
          ageCategoryFilter={ageCategoryFilter}
          onAgeCategoryFilterChange={setAgeCategoryFilter}
          photoFilter={photoFilter}
          onPhotoFilterChange={setPhotoFilter}
          onlineOnly={onlineOnly}
          onOnlineOnlyChange={setOnlineOnly}
        />
        <Link
          to="/search/list"
          className="discovery-feed__replay-btn"
          style={{
            margin: 0, // override .discovery-feed__replay-btn margin-top that dropped it below the row
            height: 32,
            padding: '0 14px',
            fontSize: '0.8rem',
            fontWeight: 700,
            textDecoration: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxSizing: 'border-box',
            lineHeight: 1,
          }}>
          {t('list_view', 'List')}
        </Link>
      </div>

      {!canLoad ? (
        <div className="discovery-feed discovery-feed__empty">
          <AppText as="p">{t('user_directory_login_required', 'Sign in to browse members.')}</AppText>
          <Link to="/search/list" className="discovery-feed__replay-btn" style={{ marginTop: 12 }}>
            {t('list_view', 'List')}
          </Link>
        </div>
      ) : loading && profiles.length === 0 ? (
        <div className="discovery-feed discovery-feed__empty">
          <AppText as="p">{t('loading', 'Loading…')}</AppText>
          <Link to="/search/list" className="discovery-feed__replay-btn" style={{ marginTop: 12 }}>
            {t('list_view', 'List')}
          </Link>
        </div>
      ) : (
        <DiscoveryFeed profiles={profiles} listPath="/search/list" {...feedHandlers} />
      )}

      {loadingMore ? (
        <div className="discovery-feed__feedback" style={{ opacity: 0.85 }}>
          {t('user_directory_load_more', 'Load more')}
        </div>
      ) : null}

      {giftModal}
    </div>
  );
}
