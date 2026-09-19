import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { doc, getDoc } from 'firebase/firestore';
import { FaComments, FaGift, FaMapMarkerAlt, FaUserCheck, FaUserPlus } from 'react-icons/fa';
import { db } from '../../firebase/config';
import { getSafeAvatar, mergeAvatarStyleWithGenderRing, hasRealProfilePhoto, normalizeUserGender } from '../../utils/avatarUtils';
import TasteScopeBadge from '../../features/tastescope/TasteScopeBadge';
import { getPrivateInviteeDisplayName } from '../../utils/privateInviteAvailability';
import { goToLogin } from '../../utils/goToLogin';
import { useConfirm } from '../../context/ConfirmContext';
import { followCancelConfirmOptions } from '../../utils/connectionCancelConfirm';
import { sendDiscoveryGreeting } from '../../utils/discoveryProfile';
import { isFollowing as checkIsFollowing } from '../../utils/followHelpers';
import { checkCanMessage } from '../../utils/chatHelpers';
import { connectionKindToCelebrationType } from '../../utils/connectConnection';
import { useAuth } from '../../context/AuthContext';
import { useInvitations } from '../../context/InvitationContext';
import { useTheme } from '../../context/ThemeContext';
import { useToast } from '../../context/ToastContext';
import { useDiscoveryActionStatus } from '../../hooks/useDiscoveryActionStatus';
import { useCanMessageMember } from '../../hooks/useCanMessageMember';
import { useMatchCelebration } from '../../context/MatchCelebrationContext';
import OnlineStatusBadge from '../profile/OnlineStatusBadge';
import PrivateInviteProfileBadge from '../PrivateInviteProfileBadge';
import { useUserPresence } from '../../hooks/usePresence';
import './UserDirectoryCard.css';
import { AppText } from '../base';

function resolveAgeLabel(user) {
  if (typeof user?.age === 'number' && user.age > 0) return String(user.age);
  const category = String(user?.ageCategory || user?.age_category || user?.ageRange || '').trim();
  if (/^\d{1,3}$/.test(category)) return category;
  return null;
}

/** Connect list card — profile photo + intro + action tools. */
function UserDirectoryCard({ user, currentUser, onGift }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const confirm = useConfirm();
  const { isDark } = useTheme();
  const { userProfile, isGuest } = useAuth();
  const { toggleFollow, currentUser: invitationUser } = useInvitations();
  const { celebrateMatch } = useMatchCelebration();

  const viewerUid = invitationUser?.uid || invitationUser?.id || currentUser?.uid || currentUser?.id;
  const profileUid = user?.id || user?.uid;
  // List view: avoid N RTDB listeners — use batch-hydrated isOnline only.
  const isOnline = useUserPresence(profileUid, {
    fallback: Boolean(user?.isOnline),
    live: false,
  });
  const profilePath = profileUid ? `/profile/${profileUid}` : null;
  const { greetedToday } = useDiscoveryActionStatus(viewerUid, profileUid);

  const [greetingBusy, setGreetingBusy] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);

  const viewerFollowing = useMemo(
    () => invitationUser?.following || [],
    [invitationUser?.following]
  );
  const isFollowingUser = checkIsFollowing(viewerFollowing, profileUid);
  // Defer chat permission reads until there is a reason to expect a connection.
  const shouldProbeChat = isFollowingUser;
  const canMessageFromServer = useCanMessageMember(viewerUid, profileUid, viewerFollowing, {
    enabled: shouldProbeChat,
    viewerProfile: userProfile || invitationUser || currentUser,
    targetProfile: user,
  });
  const [canChat, setCanChat] = useState(false);

  useEffect(() => {
    setCanChat(canMessageFromServer);
  }, [canMessageFromServer]);

  const refreshCanChat = useCallback(async () => {
    if (!viewerUid || !profileUid) return;
    try {
      // "Does this member follow me?" — from the viewer's own followers[] reverse
      // index, not a read of the member's users doc.
      const viewerFollowers = Array.isArray(userProfile?.followers) ? userProfile.followers : [];
      const allowed = await checkCanMessage(
        viewerUid,
        profileUid,
        viewerFollowing,
        [],
        {
          currentUserProfile: userProfile || invitationUser || currentUser,
          targetUserProfile: user,
          viewerFollowers,
        }
      );
      setCanChat(allowed);
    } catch {
      setCanChat(false);
    }
  }, [profileUid, viewerFollowing, viewerUid, userProfile, invitationUser, currentUser, user]);

  const displayName = getPrivateInviteeDisplayName(user) || t('user', 'User');
  const ageLabel = resolveAgeLabel(user);
  const avatarUrl = getSafeAvatar(user);
  const bioText = String(user?.bio || user?.shortBio || '').trim();
  const cityLabel = String(user?.city || '').trim() || null;
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

  // Profile-photo soft gate (target-side): follow / greet / gift show only when
  // the TARGET has a real uploaded photo. The viewer's own photo does not matter.
  const canContact = hasRealProfilePhoto(user);

  const handleFollow = useCallback(
    async (e) => {
      e.preventDefault();
      e.stopPropagation();

      if (!viewerUid || isGuest || currentUser?.isGuest || currentUser?.id === 'guest') {
        goToLogin({ returnPath: `/profile/${user.id}` });
        return;
      }
      if (isSelf || followBusy) return;
      if (isFollowingUser && !(await confirm(followCancelConfirmOptions(t)))) return;

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
    [confirm, 
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

  const photo = (
    <div className="user-directory-card__photo">
      {profilePath ? (
        <Link
          to={profilePath}
          className="user-directory-card__photo-link"
          aria-label={displayName}
          draggable={false}
        >
          <img
            src={avatarUrl}
            alt=""
            className="user-directory-card__avatar"
            loading="lazy"
            draggable={false}
            style={mergeAvatarStyleWithGenderRing(user, { borderRadius: 14 }, { ringWidth: 3 })}
          />
        </Link>
      ) : (
        <img
          src={avatarUrl}
          alt=""
          className="user-directory-card__avatar"
          loading="lazy"
          draggable={false}
          style={mergeAvatarStyleWithGenderRing(user, { borderRadius: 14 }, { ringWidth: 3 })}
        />
      )}
      <OnlineStatusBadge
        isOnline={isOnline}
        className="user-directory-card__online-badge"
        size="sm"
        showLabel={false}
      />
    </div>
  );

  const cardThemeVars = user?.cardTheme?.primaryColor
    ? {
        '--personal-accent-1': user.cardTheme.primaryColor,
        '--personal-accent-2': user.cardTheme.secondaryColor || user.cardTheme.primaryColor,
      }
    : undefined;

  return (
    <article className="user-directory-card" aria-label={displayName} style={cardThemeVars}>
      {photo}

      <div className="user-directory-card__body">
        <div className="user-directory-card__header">
          {profilePath ? (
            <Link to={profilePath} className="user-directory-card__name-link" draggable={false}>
              <AppText as="span" className="user-directory-card__name">
                {displayName}
              </AppText>
            </Link>
          ) : (
            <AppText as="span" className="user-directory-card__name">
              {displayName}
            </AppText>
          )}
          {user?.tasteTitleId && (user.tasteVisibility || 'public') === 'public' ? (
            <TasteScopeBadge variant="icon" size={44} titleId={user.tasteTitleId} gender={normalizeUserGender(user)} />
          ) : null}

          {cityLabel ? (
            <AppText as="span" className="user-directory-card__city">
              <FaMapMarkerAlt className="user-directory-card__city-icon" aria-hidden />
              {cityLabel}
            </AppText>
          ) : null}
        </div>

        {bioText ? (
          <AppText as="p" className="user-directory-card__bio">
            {bioText}
          </AppText>
        ) : null}

        {!isSelf ? (
          <div className="user-directory-card__actions">
            {canContact ? (
              <>
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
                <button
                  type="button"
                  className={`user-directory-card__action user-directory-card__action--greeting${greetedToday ? ' user-directory-card__action--greeted' : ''}`}
                  onClick={handleGreeting}
                  disabled={greetingBusy || greetedToday}
                  title={t('user_directory_greeting', 'Wave hi')}
                  aria-label={t('user_directory_greeting', 'Wave hi')}
                >
                  <AppText as="span" className="user-directory-card__wave" aria-hidden>
                    👋
                  </AppText>
                </button>
                <button
                  type="button"
                  className="user-directory-card__action user-directory-card__action--gift"
                  onClick={handleGift}
                  title={t('user_directory_send_gift', 'Send gift')}
                  aria-label={t('user_directory_send_gift', 'Send gift')}
                >
                  <FaGift className="user-directory-card__action-icon" aria-hidden />
                </button>
              </>
            ) : null}
            {showPrivateInviteBadge ? (
              <PrivateInviteProfileBadge
                user={user}
                currentUser={viewerProfile}
                logoSrc={isDark ? '/db-logo-white.svg' : '/db-logo.svg'}
                className="user-directory-card__action user-directory-card__action--private-invite user-directory-card__private-invite"
              />
            ) : null}
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
    </article>
  );
}

export default React.memo(UserDirectoryCard);
