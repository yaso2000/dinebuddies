import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { useTranslation } from 'react-i18next';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import StoryViewer from '../components/StoryViewer';
import { buildLoginUrlWithNext } from '../utils/privateInvitationShare';
import { AppText } from '../components/base';
import './SocialInvitation.css';

function isStoryExpired(story) {
  const expiresAt = story?.expiresAt;
  if (!expiresAt) return false;
  const ms = typeof expiresAt.toDate === 'function' ? expiresAt.toDate().getTime() : new Date(expiresAt).getTime();
  if (Number.isNaN(ms)) return false;
  return ms <= Date.now();
}

/** /story/:id — a shared story link. Logged-in users get the real in-app viewer;
 * guests get a lightweight preview card with a sign-in CTA (stories aren't public
 * content the way a business/invitation page is, so no full guest experience). */
export default function PublicStoryView() {
  const { id } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { currentUser, userProfile, loading: authLoading } = useAuth();

  const [story, setStory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    let cancelled = false;
    getDoc(doc(db, 'stories', id)).
    then((snap) => {
      if (cancelled) return;
      if (!snap.exists() || isStoryExpired(snap.data())) {
        setNotFound(true);
      } else {
        setStory({ id: snap.id, ...snap.data() });
      }
    }).
    catch(() => {
      if (!cancelled) setNotFound(true);
    }).
    finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const isGuest = !currentUser || userProfile?.role === 'guest' || userProfile?.isGuest;

  const viewerData = useMemo(() => {
    if (!story) return null;
    return {
      allUserStories: [{
        userId: story.userId,
        partnerName: story.userName || 'User',
        partnerLogo: story.userPhoto || '',
        stories: [story]
      }],
      initialUserIndex: 0
    };
  }, [story]);

  if (loading || authLoading) {
    return <div className="loading-container" />;
  }

  if (notFound) {
    return (
      <div className="page-container public-social-invite-join" style={{ textAlign: 'center' }}>
        <AppText as="p" style={{ color: 'var(--text-muted)', marginBottom: 16 }}>
          {t('story_link_expired', 'This story has expired or no longer exists.')}
        </AppText>
        <button type="button" className="vip-btn vip-btn-primary" onClick={() => navigate('/')}>
          {t('back_home', 'Back home')}
        </button>
      </div>);

  }

  if (!isGuest && viewerData) {
    return (
      <StoryViewer
        partnerStories={viewerData}
        onClose={() => navigate('/', { replace: true })} />);

  }

  return (
    <div className="public-social-invite-join page-container">
      <div className="public-social-invite-join__hero">
        <AppText as="h1" className="public-social-invite-join__headline">
          {t('story_landing_headline_named', {
            defaultValue: '{{host}} posted a story',
            host: story?.userName || 'Someone'
          })}
        </AppText>
        {story?.text ?
        <AppText as="p" className="public-social-invite-join__event-title">{story.text}</AppText> :
        null}
      </div>

      {story?.posterUrl || (story?.url && story?.type !== 'video') ?
      <div className="public-social-invite-join__card-wrap">
        <img
          src={story.posterUrl || story.url}
          alt=""
          style={{ width: '100%', borderRadius: 16, display: 'block' }} />

      </div> :
      null}

      <div className="public-social-invite-join__cta public-social-invite-join__cta--landing">
        <AppText as="p" className="public-social-invite-join__subtitle">
          {t('story_landing_subtitle', 'Sign in to DineBuddies to watch this story before it disappears.')}
        </AppText>
        <button
          type="button"
          className="vip-btn vip-btn-primary"
          onClick={() => navigate(buildLoginUrlWithNext(`/story/${id}`))}>

          {t('story_landing_cta', 'Open in DineBuddies')}
        </button>
      </div>
    </div>);

}
