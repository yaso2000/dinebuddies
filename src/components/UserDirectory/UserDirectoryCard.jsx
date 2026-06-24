import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FaGift, FaHeart } from 'react-icons/fa';
import { getSafeAvatar } from '../../utils/avatarUtils';
import { getPrivateInviteeDisplayName } from '../../utils/privateInviteAvailability';
import { goToLogin } from '../../utils/goToLogin';
import { USER_DIRECTORY_DEFAULT_COVER } from '../../utils/userDirectory';
import { resolveProfileCoverUrl } from '../../utils/profileGallery';
import { likeDiscoveryProfile, sendDiscoveryGreeting, peekDiscoveryActionStatus } from '../../utils/discoveryProfile';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useDiscoveryActionStatus } from '../../hooks/useDiscoveryActionStatus';
import './UserDirectoryCard.css';
import { AppText } from "../base";

/** 16:9 directory card — cover, avatar, name, like / wave / gift only. */
export default function UserDirectoryCard({ user, currentUser, onGift }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { userProfile } = useAuth();

  const viewerUid = currentUser?.uid || currentUser?.id;
  const cachedStatus = peekDiscoveryActionStatus(viewerUid, user?.id);
  const { liked: likedAlready, greetedToday } = useDiscoveryActionStatus(viewerUid, user?.id);

  const [liked, setLiked] = useState(() => cachedStatus?.liked ?? false);
  const [greeted, setGreeted] = useState(() => cachedStatus?.greetedToday ?? false);
  const [likeBusy, setLikeBusy] = useState(false);
  const [greetingBusy, setGreetingBusy] = useState(false);

  useEffect(() => {
    setLiked(likedAlready);
  }, [likedAlready]);

  useEffect(() => {
    setGreeted(greetedToday);
  }, [greetedToday]);

  const displayName = getPrivateInviteeDisplayName(user) || t('user', 'User');
  const avatarUrl = getSafeAvatar(user);
  const coverUrl = resolveProfileCoverUrl(user) || user.coverPhotoUrl || USER_DIRECTORY_DEFAULT_COVER;
  const isSelf = currentUser?.uid === user.id || currentUser?.id === user.id;

  const handleOpenProfile = useCallback(() => {
    navigate(`/profile/${user.id}`);
  }, [navigate, user.id]);

  const handleGift = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();

      if (!currentUser || currentUser.isGuest || currentUser.id === 'guest') {
        goToLogin({ returnPath: `/profile/${user.id}` });
        return;
      }

      if (isSelf) return;

      if (onGift) {
        onGift(user);
        return;
      }

      showToast(
        t(
          'user_directory_gift_coming_soon',
          'Gifts are coming soon — we will add them in a future update.'
        ),
        'info'
      );
    },
    [currentUser, isSelf, onGift, showToast, t, user]
  );

  const handleLike = useCallback(
    async (e) => {
      e.preventDefault();
      e.stopPropagation();

      if (!viewerUid || currentUser?.isGuest || currentUser?.id === 'guest') {
        goToLogin({ returnPath: `/profile/${user.id}` });
        return;
      }

      if (isSelf || likeBusy || liked) return;

      setLikeBusy(true);
      try {
        const result = await likeDiscoveryProfile(viewerUid, user, userProfile || currentUser);
        if (result?.reason === 'already_liked') {
          showToast(t('discovery_like_already', 'You already liked this profile.'), 'info');
          setLiked(true);
          return;
        }
        if (result?.ok) {
          setLiked(true);
        }
      } catch (err) {
        console.error('[UserDirectoryCard] like', err);
        showToast(t('discovery_like_failed', 'Could not like. Try again.'), 'error');
      } finally {
        setLikeBusy(false);
      }
    },
    [currentUser, isSelf, likeBusy, liked, showToast, t, user, userProfile, viewerUid]
  );

  const handleGreeting = useCallback(
    async (e) => {
      e.preventDefault();
      e.stopPropagation();

      if (!viewerUid || currentUser?.isGuest || currentUser?.id === 'guest') {
        goToLogin({ returnPath: `/profile/${user.id}` });
        return;
      }

      if (isSelf || greetingBusy || greeted) return;

      setGreetingBusy(true);
      try {
        const result = await sendDiscoveryGreeting(viewerUid, user, userProfile || currentUser);
        if (result?.reason === 'daily_limit') {
          showToast(
            t('discovery_greeting_daily_limit', 'You can wave once per day to this member.'),
            'info'
          );
          setGreeted(true);
          return;
        }
        if (result?.ok) {
          setGreeted(true);
          showToast('👋', 'success');
        }
      } catch (err) {
        console.error('[UserDirectoryCard] greeting', err);
        showToast(t('discovery_greeting_failed', 'Could not send greeting. Try again.'), 'error');
      } finally {
        setGreetingBusy(false);
      }
    },
    [currentUser, greeted, greetingBusy, isSelf, showToast, t, user, userProfile, viewerUid]
  );

  return (
    <article
      className="user-directory-card"
      onClick={handleOpenProfile}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleOpenProfile();
        }
      }}>

      <div
        className="user-directory-card__cover"
        style={{ backgroundImage: `url(${coverUrl})` }}
        aria-hidden />

      <div className="user-directory-card__gradient" aria-hidden />

      <div className="user-directory-card__body">
        <div className="user-directory-card__profile-row">
          <img
            src={avatarUrl}
            alt={displayName}
            className="user-directory-card__avatar"
            loading="lazy"
            onError={(e) => {
              e.currentTarget.src = getSafeAvatar(null);
            }} />

          <div className="user-directory-card__info">
            <AppText as="h3" className="user-directory-card__name">{displayName}</AppText>
          </div>
        </div>

        {!isSelf ?
        <div
          className="user-directory-card__actions"
          onClick={(e) => e.stopPropagation()}>

          <button
            type="button"
            className={`user-directory-card__action user-directory-card__action--like${liked ? ' user-directory-card__action--liked' : ''}`}
            onClick={handleLike}
            disabled={likeBusy || liked}
            title={t('user_directory_like', 'Like profile')}
            aria-label={t('user_directory_like', 'Like profile')}>
            <FaHeart className="user-directory-card__action-icon" aria-hidden />
          </button>
          <button
            type="button"
            className={`user-directory-card__action user-directory-card__action--greeting${greeted ? ' user-directory-card__action--greeted' : ''}`}
            onClick={handleGreeting}
            disabled={greetingBusy || greeted}
            title={t('user_directory_greeting', 'Wave hi')}
            aria-label={t('user_directory_greeting', 'Wave hi')}>
            <AppText as="span" className="user-directory-card__wave" aria-hidden>👋</AppText>
          </button>
          <button
            type="button"
            className="user-directory-card__action user-directory-card__action--gift"
            onClick={handleGift}
            title={t('user_directory_send_gift', 'Send gift')}
            aria-label={t('user_directory_send_gift', 'Send gift')}>
            <FaGift className="user-directory-card__action-icon" aria-hidden />
          </button>
        </div> :
        null}
      </div>
    </article>);
}
