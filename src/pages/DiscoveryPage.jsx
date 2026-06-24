import React, { useCallback, useEffect, useMemo } from 'react';

import { Link, useNavigate } from 'react-router-dom';

import { useTranslation } from 'react-i18next';

import { LuInbox, LuLayoutGrid } from 'react-icons/lu';

import { FaArrowLeft } from 'react-icons/fa';

import DiscoveryFeed from '../components/discovery/DiscoveryFeed';

import { useAuth } from '../context/AuthContext';

import { useToast } from '../context/ToastContext';

import { useDiscoveryProfiles } from '../hooks/useDiscoveryProfiles';

import { likeDiscoveryProfile, sendDiscoveryGreeting } from '../utils/discoveryProfile';

import { goToLogin } from '../utils/goToLogin';

import '../components/discovery/discovery.css';

import { AppText } from "../components/base";



export default function DiscoveryPage() {

  const { t } = useTranslation();

  const navigate = useNavigate();

  const { showToast } = useToast();

  const { currentUser, userProfile, isGuest } = useAuth();



  const viewerUid = currentUser?.uid || currentUser?.id;

  const { profiles, loading, loadingMore, hasMore, loadMore, canLoad } = useDiscoveryProfiles();



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
        if (!result?.ok) {
          showToast(t('discovery_like_failed', 'Could not like. Try again.'), 'error');
          return { ok: false };
        }
        return { ok: true };
      } catch (err) {
        console.error('[Discovery] like', err);
        showToast(t('discovery_like_failed', 'Could not like. Try again.'), 'error');
        return { ok: false };
      }

    },

    [currentUser, showToast, t, userProfile, viewerUid]

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



  const handleGift = useCallback(() => {

    showToast(

      t(

        'user_directory_gift_coming_soon',

        'Gifts are coming soon — we will add them in a future update.'

      ),

      'info'

    );

  }, [showToast, t]);



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

        <button

          type="button"

          className="discovery-icon-btn"

          onClick={() => navigate('/posts-feed')}

          aria-label="Back to feed">

          <FaArrowLeft style={{ transform: 'scaleX(-1)' }} />

        </button>

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

          className="discovery-icon-btn"

          aria-label="List view"

          title={t('user_directory_list_view', 'Card view')}>

          <LuLayoutGrid size={20} />

        </Link>

        <Link

          to="/search/inbox"

          className="discovery-icon-btn"

          aria-label="Inbox"

          title="Inbox">

          <LuInbox size={20} />

        </Link>

      </div>

    </div>);

}


