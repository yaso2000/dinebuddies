import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { doc, getDoc } from 'firebase/firestore';
import { FaComments, FaGift, FaHeart, FaUserCheck, FaUserPlus } from 'react-icons/fa';
import { db } from '../../firebase/config';
import { getSafeAvatar, pickSafeDisplayImageUrl } from '../../utils/avatarUtils';
import { getPrivateInviteeDisplayName } from '../../utils/privateInviteAvailability';
import { goToLogin } from '../../utils/goToLogin';
import { USER_DIRECTORY_DEFAULT_COVER } from '../../utils/userDirectory';
import {
  resolveDirectoryCoverUrl,
  resolveProfileCoverUrl,
} from '../../utils/profileGallery';
import {
  likeDiscoveryProfile,
  unlikeDiscoveryProfile,
  sendDiscoveryGreeting,
} from '../../utils/discoveryProfile';
import { showLikeCooldownWarning } from '../../utils/connectionActionCooldown';
import { isFollowing as checkIsFollowing } from '../../utils/followHelpers';
import { checkCanMessage } from '../../utils/chatHelpers';
import {
  profileShowsLikeButton,
  connectionKindToCelebrationType,
  tryCelebrateConnectionComplete,
} from '../../utils/connectConnection';
import { useAuth } from '../../context/AuthContext';
import { useInvitations } from '../../context/InvitationContext';
import { useToast } from '../../context/ToastContext';
import { useDiscoveryActionStatus } from '../../hooks/useDiscoveryActionStatus';
import { useCanMessageMember } from '../../hooks/useCanMessageMember';
import { useMatchCelebration } from '../../context/MatchCelebrationContext';
import OnlineStatusBadge from '../profile/OnlineStatusBadge';
import PrivateInviteProfileBadge from '../PrivateInviteProfileBadge';
import { useUserPresence } from '../../hooks/usePresence';
import './UserDirectoryCard.css';
import { AppText } from '../base';

/** Directory card — name + age, cover, avatar, quick actions. */
export default function UserDirectoryCard({ user, currentUser, onGift }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { showToast, showPersistentWarning } = useToast();
  const { userProfile, isGuest } = useAuth();
  const { toggleFollow, currentUser: invitationUser } = useInvitations();
  const { celebrateMatch } = useMatchCelebration();

  const viewerUid = invitationUser?.uid || invitationUser?.id || currentUser?.uid || currentUser?.id;
  const profileUid = user?.id || user?.uid;
  const isOnline = useUserPresence(profileUid, { fallback: Boolean(user?.isOnline) });
  const profilePath = profileUid ? `/profile/${profileUid}` : null;
  const useDatingLike = profileShowsLikeButton(user);
  const { liked, greetedToday } = useDiscoveryActionStatus(viewerUid, profileUid);

  const [likeBusy, setLikeBusy] = useState(false);
  const [greetingBusy, setGreetingBusy] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);

  const viewerFollowing = useMemo(
    () => invitationUser?.following || [],
    [invitationUser?.following]
  );
  const isFollowingUser = checkIsFollowing(viewerFollowing, profileUid);
  const canMessageFromServer = useCanMessageMember(viewerUid, profileUid, viewerFollowing);
  const [canChat, setCanChat] = useState(false);

  useEffect(() => {
    setCanChat(canMessageFromServer);
  }, [canMessageFromServer]);

  const refreshCanChat = useCallback(async () => {
    if (!viewerUid || !profileUid) return;
    try {
      const snap = await getDoc(doc(db, 'users', profileUid));
      const targetFollowing = snap.exists() ? snap.data()?.following || [] : [];
      const allowed = await checkCanMessage(viewerUid, profileUid, viewerFollowing, targetFollowing);
      setCanChat(allowed);
    } catch {
      setCanChat(false);
    }
  }, [profileUid, viewerFollowing, viewerUid]);

  const displayName = getPrivateInviteeDisplayName(user) || t('user', 'User');
  const avatarUrl = getSafeAvatar(user);
  const coverUrl =
    pickSafeDisplayImageUrl(
      resolveDirectoryCoverUrl(user),
      resolveProfileCoverUrl(user),
      user?.coverPhotoUrl
    ) || USER_DIRECTORY_DEFAULT_COVER;
  const headline = user?.ageRange ? `${displayName}, ${user.ageRange}` : displayName;
  const isSelf =
    profileUid &&
    (currentUser?.uid === profileUid || currentUser?.id === profileUid);

  const viewerProfile = useMemo(
    () => ({
      ...(userProfile || invitationUser || currentUser || {}),
      following: viewerFollowing,
    }),
    [currentUser, invitationUser, userProfile, viewerFollowing]
  );
  const showPrivateInviteBadge = !isSelf && isFollowingUser;

  const showUnlikeError = useCallback(
    (reason) => {
      if (reason === 'permission_denied') {
        showToast(
          t(
            'discovery_unlike_rules_pending',
            'Could not remove like yet — app rules may need updating. Try again shortly.'
          ),
          'error'
        );
        return;
      }
      showToast(t('discovery_unlike_failed', 'Could not remove like. Try again.'), 'error');
    },
    [showToast, t]
  );

  const handleToggleLike = useCallback(
    async (e) => {
      e.preventDefault();
      e.stopPropagation();

      if (!viewerUid || isGuest || currentUser?.isGuest || currentUser?.id === 'guest') {
        goToLogin({ returnPath: `/profile/${user.id}` });
        return;
      }
      if (isSelf || likeBusy) return;

      setLikeBusy(true);
      try {
        if (liked) {
          const result = await unlikeDiscoveryProfile(viewerUid, user);
          if (result?.ok) {
            if (result.wasMutual) await refreshCanChat();
          } else {
            showUnlikeError(result?.reason);
          }
          return;
        }

        const result = await likeDiscoveryProfile(viewerUid, user, userProfile || currentUser);
        if (result?.reason === 'already_liked') return;
        if (result?.reason === 'cooldown') {
          showLikeCooldownWarning(showPersistentWarning, i18n, result.cancelledAtMs, result.retryAtMs);
          return;
        }
        if (!result?.ok) {
          showToast(t('discovery_like_failed', 'Could not like. Try again.'), 'error');
          return;
        }
        if (result.mutual || result.match) {
          setCanChat(true);
          await tryCelebrateConnectionComplete({
            viewerUid,
            targetUser: user,
            viewerProfile,
            viewerFollowing,
            celebrateMatch,
            displayName,
          });
        }
      } catch (err) {
        console.error('[UserDirectoryCard] like', err);
        showToast(t('discovery_like_failed', 'Could not like. Try again.'), 'error');
      } finally {
        setLikeBusy(false);
      }
    },
    [
      celebrateMatch,
      currentUser,
      displayName,
      isGuest,
      isSelf,
      likeBusy,
      liked,
      refreshCanChat,
      i18n,
      showPersistentWarning,
      showToast,
      showUnlikeError,
      t,
      user,
      userProfile,
      viewerFollowing,
      viewerProfile,
      viewerUid,
    ]
  );

  const handleFollow = useCallback(
    async (e) => {
      e.preventDefault();
      e.stopPropagation();

      if (!viewerUid || isGuest || currentUser?.isGuest || currentUser?.id === 'guest') {
        goToLogin({ returnPath: `/profile/${user.id}` });
        return;
      }
      if (isSelf || followBusy) return;

      setFollowBusy(true);
      try {
        const wasFollowing = isFollowingUser;
        const result = await toggleFollow(user.id);
        if (!result?.ok) {
          if (result?.reason !== 'cooldown') {
            showToast(t('discovery_follow_failed', 'Could not follow. Try again.'), 'error');
          }
          return;
        }
        if (result.connectionComplete && result.connectionKind) {
          setCanChat(true);
          celebrateMatch({
            type: connectionKindToCelebrationType(result.connectionKind),
            otherUser: user,
            otherId: user.id,
            otherName: displayName,
          });
        } else if (wasFollowing) {
          await refreshCanChat();
        }
      } catch (err) {
        console.error('[UserDirectoryCard] follow', err);
        showToast(t('discovery_follow_failed', 'Could not follow. Try again.'), 'error');
      } finally {
        setFollowBusy(false);
      }
    },
    [
      celebrateMatch,
      currentUser,
      displayName,
      followBusy,
      isFollowingUser,
      isGuest,
      isSelf,
      refreshCanChat,
      showToast,
      t,
      toggleFollow,
      user,
      viewerUid,
    ]
  );

  const handleGreeting = useCallback(
    async (e) => {
      e.preventDefault();
      e.stopPropagation();

      if (!viewerUid || isGuest || currentUser?.isGuest || currentUser?.id === 'guest') {
        goToLogin({ returnPath: `/profile/${user.id}` });
        return;
      }
      if (isSelf || greetingBusy || greetedToday) return;

      setGreetingBusy(true);
      try {
        const result = await sendDiscoveryGreeting(viewerUid, user, userProfile || currentUser);
        if (result?.reason === 'daily_limit') {
          showToast(
            t('discovery_greeting_daily_limit', 'You can wave once per day to this member.'),
            'info'
          );
          return;
        }
        if (result?.ok) showToast('👋', 'success');
      } catch (err) {
        console.error('[UserDirectoryCard] greeting', err);
        showToast(t('discovery_greeting_failed', 'Could not send greeting. Try again.'), 'error');
      } finally {
        setGreetingBusy(false);
      }
    },
    [currentUser, greetedToday, greetingBusy, isGuest, isSelf, showToast, t, user, userProfile, viewerUid]
  );

  const handleGift = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!currentUser || isGuest || currentUser.isGuest || currentUser.id === 'guest') {
        goToLogin({ returnPath: `/profile/${user.id}` });
        return;
      }
      if (isSelf) return;
      if (onGift) {
        onGift(user);
        return;
      }
      showToast(
        t('user_directory_gift_coming_soon', 'Gifts are coming soon — we will add them in a future update.'),
        'info'
      );
    },
    [currentUser, isGuest, isSelf, onGift, showToast, t, user]
  );

  const handleOpenChat = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      navigate(`/chat/${profileUid}`);
    },
    [navigate, profileUid]
  );

  const profileInfo = (
    <AppText as="span" className="user-directory-card__name">{headline}</AppText>
  );

  const nameChip = profilePath ? (
    <Link to={profilePath} className="user-directory-card__name-chip" draggable={false}>
      {profileInfo}
    </Link>
  ) : (
    <div className="user-directory-card__name-chip">{profileInfo}</div>
  );

  return (
    <article className="user-directory-card" aria-label={displayName}>
      <div className="user-directory-card__media">
        <div className="user-directory-card__cover-bg" aria-hidden>
          {profilePath ? (
            <Link to={profilePath} className="user-directory-card__cover-link" draggable={false}>
              <img
                src={coverUrl}
                alt=""
                className="user-directory-card__cover-img"
                loading="lazy"
                draggable={false}
                onError={(e) => {
                  e.currentTarget.src = USER_DIRECTORY_DEFAULT_COVER;
                }}
              />
            </Link>
          ) : (
            <img
              src={coverUrl}
              alt=""
              className="user-directory-card__cover-img"
              loading="lazy"
              draggable={false}
              onError={(e) => {
                e.currentTarget.src = USER_DIRECTORY_DEFAULT_COVER;
              }}
            />
          )}
          <div className="user-directory-card__cover-scrim" />
        </div>

        <div className="user-directory-card__profile-column">
          {nameChip}
          <div className="user-directory-card__avatar-wrap">
            {profilePath ? (
              <Link
                to={profilePath}
                className="user-directory-card__avatar-link"
                aria-label={displayName}
                draggable={false}
              >
                <img
                  src={avatarUrl}
                  alt=""
                  className="user-directory-card__avatar"
                  loading="lazy"
                  draggable={false}
                />
              </Link>
            ) : (
              <img
                src={avatarUrl}
                alt=""
                className="user-directory-card__avatar"
                loading="lazy"
                draggable={false}
              />
            )}
            {showPrivateInviteBadge ? (
              <PrivateInviteProfileBadge
                user={user}
                currentUser={viewerProfile}
                logoSrc="/db-logo-white.svg"
                className="user-directory-card__private-invite"
              />
            ) : null}
          </div>
        </div>

        <div className="user-directory-card__overlay">
          <OnlineStatusBadge isOnline={isOnline} className="user-directory-card__online-badge" size="sm" />
          {!isSelf ? (
            <div className="user-directory-card__actions">
              <button
                type="button"
                className="user-directory-card__action user-directory-card__action--gift"
                onClick={handleGift}
                title={t('user_directory_send_gift', 'Send gift')}
                aria-label={t('user_directory_send_gift', 'Send gift')}
              >
                <FaGift className="user-directory-card__action-icon" aria-hidden />
              </button>
              <button
                type="button"
                className={`user-directory-card__action user-directory-card__action--greeting${greetedToday ? ' user-directory-card__action--greeted' : ''}`}
                onClick={handleGreeting}
                disabled={greetingBusy || greetedToday}
                title={t('user_directory_greeting', 'Wave hi')}
                aria-label={t('user_directory_greeting', 'Wave hi')}
              >
                <AppText as="span" className="user-directory-card__wave" aria-hidden>👋</AppText>
              </button>
              {useDatingLike ? (
                <button
                  type="button"
                  className={`user-directory-card__action user-directory-card__action--like${liked ? ' user-directory-card__action--liked' : ' user-directory-card__action--like-idle'}`}
                  onClick={handleToggleLike}
                  disabled={likeBusy}
                  title={liked ? t('unlike', 'Unlike') : t('user_directory_like', 'Like profile')}
                  aria-label={liked ? t('unlike', 'Unlike') : t('user_directory_like', 'Like profile')}
                  aria-pressed={liked}
                >
                  <FaHeart className="user-directory-card__action-icon" aria-hidden />
                </button>
              ) : (
                <button
                  type="button"
                  className={`user-directory-card__action user-directory-card__action--follow${isFollowingUser ? ' user-directory-card__action--following' : ''}`}
                  onClick={handleFollow}
                  disabled={followBusy}
                  title={isFollowingUser ? t('following', 'Following') : t('follow', 'Follow')}
                  aria-label={isFollowingUser ? t('following', 'Following') : t('follow', 'Follow')}
                  aria-pressed={isFollowingUser}
                >
                  {isFollowingUser ? (
                    <FaUserCheck className="user-directory-card__action-icon" aria-hidden />
                  ) : (
                    <FaUserPlus className="user-directory-card__action-icon" aria-hidden />
                  )}
                </button>
              )}
              {canChat ? (
                <button
                  type="button"
                  className="user-directory-card__action user-directory-card__action--chat"
                  onClick={handleOpenChat}
                  title={t('chat', 'Chat')}
                  aria-label={t('chat', 'Chat')}
                >
                  <FaComments className="user-directory-card__action-icon" aria-hidden />
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}
