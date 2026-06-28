import React, { useCallback, useEffect, useMemo } from 'react';

import { Link, useNavigate } from 'react-router-dom';

import { useTranslation } from 'react-i18next';

import { LuLayoutGrid } from 'react-icons/lu';

import AppBackButton from '../components/AppBackButton';
import { APP_HOME_PATH } from '../utils/appRouteShell';

import DiscoveryFeed from '../components/discovery/DiscoveryFeed';
import InboxHubLink from '../components/discovery/InboxHubLink';

import { useAuth } from '../context/AuthContext';

import { useToast } from '../context/ToastContext';

import { useDiscoveryProfiles } from '../hooks/useDiscoveryProfiles';
import { useProfileGiftPicker } from '../hooks/useProfileGiftPicker';

import { likeDiscoveryProfile, sendDiscoveryGreeting } from '../utils/discoveryProfile';
import { showLikeCooldownWarning } from '../utils/connectionActionCooldown';

import { goToLogin } from '../utils/goToLogin';

import '../components/discovery/discovery.css';

import { AppText } from "../components/base";



export default function DiscoveryPage() {

  const { t, i18n } = useTranslation();

  const navigate = useNavigate();

  const { showToast, showPersistentWarning } = useToast();

  const { currentUser, userProfile, isGuest } = useAuth();



  const viewerUid = currentUser?.uid || currentUser?.id;

  const { profiles, loading, loadingMore, hasMore, loadMore, canLoad } = useDiscoveryProfiles();
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
          showToast(
            t('discovery_like_already', 'You already liked this profile.'),
            'info'
          );
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



  const feedHandlers = useMemo(

    () => ({

      onLike: handleLike,

      onGreeting: handleGreeting,

      onSendGift: handleGift,

      onNearEnd: handleNearEnd

    }),

    [handleGift, handleGreeting, handleLike, handleNearEnd]

  );



  return (

    <div className="discovery-shell">

      <div className="discovery-shell__chrome discovery-shell__chrome--start">

        <AppBackButton
          className="discovery-icon-btn"
          fallback={APP_HOME_PATH}
          iconStyle={{ transform: 'scaleX(-1)' }}
          ariaLabel="Back to feed"
        />

      </div>



      {!canLoad ?

      <div className="discovery-feed discovery-feed__empty">

        <AppText as="p">{t('user_directory_login_required', 'Sign in to browse members.')}</AppText>

      </div> :

      loading && profiles.length === 0 ?

      <div className="discovery-feed discovery-feed__empty">

        <AppText as="p">{t('loading', 'Loading…')}</AppText>

      </div> :

      <DiscoveryFeed profiles={profiles} {...feedHandlers} />

      }



      {loadingMore ?

      <div className="discovery-feed__feedback" style={{ opacity: 0.85 }}>

        {t('user_directory_load_more', 'Load more')}

      </div> :

      null}



      <div className="discovery-shell__chrome discovery-shell__chrome--end">

        <Link
          to="/search/list"
          className="discovery-icon-btn discovery-icon-btn--cards"
          aria-label="List view"
          title={t('user_directory_list_view', 'Card view')}>
          <LuLayoutGrid aria-hidden />
        </Link>

        <InboxHubLink className="discovery-icon-btn" tab="activity" />

      </div>

      {giftModal}

    </div>);

}


