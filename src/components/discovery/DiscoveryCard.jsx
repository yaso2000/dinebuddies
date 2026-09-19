import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { animate, motion, useMotionValue } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { FaComments, FaGift, FaMapMarkerAlt, FaUserCheck, FaUserPlus } from 'react-icons/fa';
import { LuX } from 'react-icons/lu';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../context/AuthContext';
import { useInvitations } from '../../context/InvitationContext';
import { normalizeUserGender } from '../../utils/avatarUtils';
import TasteScopeBadge from '../../features/tastescope/TasteScopeBadge';
import TasteCompatRing from '../../features/tastescope/TasteCompatRing';
import { computeCompatibility } from '../../features/tastescope/computeCompatibility';
import { useToast } from '../../context/ToastContext';
import { followCancelConfirmOptions } from '../../utils/connectionCancelConfirm';
import { useConfirm } from '../../context/ConfirmContext';
import { isFollowing as checkIsFollowing } from '../../utils/followHelpers';
import { checkCanMessage } from '../../utils/chatHelpers';
import { useDiscoveryActionStatus } from '../../hooks/useDiscoveryActionStatus';
import { useCanMessageMember } from '../../hooks/useCanMessageMember';
import { useMatchCelebration } from '../../context/MatchCelebrationContext';
import { useUserPresence } from '../../hooks/usePresence';
import { getDefaultAvatar, hasRealProfilePhoto } from '../../utils/avatarUtils';
import PrivateInviteProfileBadge from '../PrivateInviteProfileBadge';
import InboxHubLink from './InboxHubLink';
import './discovery.css';
import './inbox.css';
import { AppText } from '../base';

const SWIPE_THRESHOLD = 90;
const SWIPE_VELOCITY = 420;

function formatAgeLabel(profile) {
  const raw =
    profile?.ageCategory ||
    profile?.user?.ageRange ||
    profile?.user?.ageCategory ||
    profile?.user?.age ||
    '';
  const text = String(raw || '').trim();
  if (!text) return '';
  // Prefer a leading number when present ("35", "35-44" → "35")
  const match = text.match(/\d{1,3}/);
  return match ? match[0] : text;
}

export default function DiscoveryCard({
  profile,
  onSkip,
  onSendGift,
  onGreeting,
  onBack = null,
  onRefresh = null,
  isTop = true,
  listPath = '/search/list',
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const confirm = useConfirm();
  const { currentUser, userProfile } = useAuth();
  const { toggleFollow, currentUser: invitationUser } = useInvitations();
  const { celebrateMatch } = useMatchCelebration();
  const targetUser = profile?.user || profile;
  const isOnline = useUserPresence(profile?.id, { fallback: Boolean(targetUser?.isOnline) });
  const viewerProfile = userProfile || currentUser || invitationUser;
  const viewerUid = currentUser?.uid || currentUser?.id;
  const viewerFollowing = useMemo(
    () => invitationUser?.following || [],
    [invitationUser?.following]
  );
  const canMessageFromServer = useCanMessageMember(viewerUid, profile?.id, viewerFollowing, {
    enabled: Boolean(isTop),
    viewerProfile: viewerProfile,
    targetProfile: targetUser,
  });
  const { greetedToday } = useDiscoveryActionStatus(viewerUid, profile?.id);

  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const exitHandledRef = useRef(false);
  const draggingRef = useRef(false);

  const [canChat, setCanChat] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [greetingBusy, setGreetingBusy] = useState(false);
  const [photoFailed, setPhotoFailed] = useState(false);

  useEffect(() => {
    setPhotoFailed(false);
  }, [profile?.profilePhoto]);

  // A card instance is kept by key as it moves between the top slot and the
  // beneath (next) slot. When it drops to the beneath slot, reset its transient
  // swipe state — position and the one-shot exit guard — so it is clean and
  // responsive when it returns to the top (fixes the freeze when going back).
  useEffect(() => {
    if (!isTop) {
      exitHandledRef.current = false;
      x.set(0);
      y.set(0);
    }
  }, [isTop, x, y]);
  const isFollowingUser = checkIsFollowing(viewerFollowing, profile?.id);
  const showPrivateInviteBadge = Boolean(profile?.id && profile.id !== viewerUid && isFollowingUser);
  const locationLabel = [profile?.city, profile?.country].filter(Boolean).join(', ') || profile?.city || '';

  const refreshCanChat = useCallback(async () => {
    if (!viewerUid || !profile?.id) return;
    try {
      // "Does this member follow me?" — from the viewer's own followers[] reverse
      // index, not a read of the member's users doc.
      const viewerFollowers = Array.isArray(viewerProfile?.followers) ? viewerProfile.followers : [];
      const allowed = await checkCanMessage(
        viewerUid,
        profile.id,
        viewerFollowing,
        [],
        {
          currentUserProfile: viewerProfile,
          targetUserProfile: targetUser,
          viewerFollowers,
        }
      );
      setCanChat(allowed);
    } catch {
      setCanChat(false);
    }
  }, [profile?.id, viewerFollowing, viewerUid, viewerProfile, targetUser]);

  useEffect(() => {
    setCanChat(canMessageFromServer);
  }, [canMessageFromServer]);


  const resetPosition = useCallback(() => {
    animate(x, 0, { type: 'spring', stiffness: 520, damping: 28 });
    animate(y, 0, { type: 'spring', stiffness: 520, damping: 28 });
  }, [x, y]);

  // Next card = swipe RIGHT→LEFT (card exits to the left).
  const triggerNext = useCallback(() => {
    if (exitHandledRef.current) return;
    exitHandledRef.current = true;
    animate(x, -560, { duration: 0.22, ease: 'easeIn' }).then(() => {
      onSkip?.(profile);
    });
  }, [onSkip, profile, x]);

  // Previous card = swipe LEFT→RIGHT. The card slides right and the deck steps
  // back to the previously-shown profile (sequential history).
  const triggerBack = useCallback(() => {
    if (exitHandledRef.current) return;
    if (typeof onBack !== 'function') { resetPosition(); return; }
    exitHandledRef.current = true;
    animate(x, 560, { duration: 0.22, ease: 'easeIn' }).then(() => {
      onBack(profile);
    });
  }, [onBack, profile, resetPosition, x]);

  // Double-tap → open this person's full profile (no exit animation — it's a tap).
  const openProfile = useCallback(() => {
    if (exitHandledRef.current || !profile?.id) return;
    navigate(`/profile/${profile.id}`);
  }, [navigate, profile?.id]);

  const handleDragStart = () => {
    draggingRef.current = true;
  };

  const handleDragEnd = (_, info) => {
    window.setTimeout(() => {
      draggingRef.current = false;
    }, 50);

    if (!isTop) return;
    const { offset, velocity } = info;
    const horizontal = Math.abs(offset.x) >= Math.abs(offset.y);

    if (horizontal) {
      // Swipe LEFT → next profile.
      if (offset.x < -SWIPE_THRESHOLD || velocity.x < -SWIPE_VELOCITY) {
        triggerNext();
        return;
      }
      // Swipe RIGHT → previous profile.
      if (offset.x > SWIPE_THRESHOLD || velocity.x > SWIPE_VELOCITY) {
        triggerBack();
        return;
      }
    } else if (
      // Swipe UP or DOWN → refresh the deck.
      Math.abs(offset.y) > SWIPE_THRESHOLD || Math.abs(velocity.y) > SWIPE_VELOCITY
    ) {
      resetPosition();
      onRefresh?.();
      return;
    }
    // Magnetic snap back into place
    resetPosition();
  };

  // Tap detection: a control tap (buttons/links) is ignored; a double-tap on the
  // photo opens the profile. A drag is not a tap.
  const isInteractiveTarget = useCallback((target) => {
    if (!target?.closest) return false;
    return Boolean(
      target.closest('.discovery-card__actions, .discovery-card__inbox, .discovery-card__close, .discovery-card__taste-corner, button, a')
    );
  }, []);
  const lastTapRef = useRef(0);
  const handlePointerUp = useCallback((e) => {
    if (!isTop || draggingRef.current) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (Math.abs(x.get()) > 10 || Math.abs(y.get()) > 10) return; // was a drag
    if (isInteractiveTarget(e.target)) return;
    const now = Date.now();
    if (now - lastTapRef.current <= 300) {
      lastTapRef.current = 0;
      openProfile();
    } else {
      lastTapRef.current = now;
    }
  }, [isInteractiveTarget, isTop, openProfile, x, y]);

  const handleFollow = async (e) => {
    e.stopPropagation();
    if (!isTop || followBusy) return;
    if (isFollowingUser && !(await confirm(followCancelConfirmOptions(t)))) return;

    setFollowBusy(true);
    try {
      const wasFollowing = isFollowingUser;
      const result = await toggleFollow(profile.id);
      if (!result?.ok) {
        if (result?.reason !== 'cooldown') {
          showToast(t('discovery_follow_failed', 'Could not follow. Try again.'), 'error');
        }
        return;
      }
      if (result.connectionComplete && result.connectionKind) {
        setCanChat(true);
        celebrateMatch({
          type: 'friendship',
          otherUser: targetUser,
          otherId: profile.id,
          otherName: profile.name,
        });
      } else if (wasFollowing) {
        await refreshCanChat();
      }
    } catch (err) {
      console.error('[DiscoveryCard] follow', err);
      showToast(t('discovery_follow_failed', 'Could not follow. Try again.'), 'error');
    } finally {
      setFollowBusy(false);
    }
  };

  const handleGift = (e) => {
    e.stopPropagation();
    if (!isTop) return;
    onSendGift?.(profile);
  };

  const handleWave = async (e) => {
    e.stopPropagation();
    if (!isTop || greetingBusy || greetedToday) return;
    setGreetingBusy(true);
    try {
      const result = await onGreeting?.(profile);
      if (result?.ok) showToast('👋', 'success');
    } finally {
      setGreetingBusy(false);
    }
  };

  const handleOpenChat = (e) => {
    e.stopPropagation();
    if (!profile?.id) return;
    if (!canChat) {
      showToast(
        t('discovery_chat_locked', 'Follow each other to unlock chat.'),
        'info'
      );
      return;
    }
    navigate(`/chat/${profile.id}`);
  };

  const handleClose = (e) => {
    e.stopPropagation();
    if (listPath) navigate(listPath, { replace: true });
  };

  // TasteScope: show the other person's title (public only) and, when the viewer
  // also has a title, the compatibility ring. Reuses already-loaded data.
  const tasteVisible = Boolean(profile?.tasteTitleId && (profile?.tasteVisibility || 'public') === 'public');
  const tasteGender = normalizeUserGender(targetUser);
  const compat = useMemo(() => {
    const mine = userProfile?.tasteScope;
    if (!tasteVisible || !mine?.answers || !profile?.tasteAnswers) return null;
    return computeCompatibility(mine.answers, profile.tasteAnswers, mine.titleId, profile.tasteTitleId);
  }, [tasteVisible, userProfile?.tasteScope, profile?.tasteAnswers, profile?.tasteTitleId]);

  const cardThemeVars = targetUser?.cardTheme?.primaryColor
    ? {
        '--personal-accent-1': targetUser.cardTheme.primaryColor,
        '--personal-accent-2': targetUser.cardTheme.secondaryColor || targetUser.cardTheme.primaryColor,
      }
    : undefined;

  return (
    <motion.article
      className="discovery-card discovery-card--magnetic discovery-card--connect"
      style={{ ...cardThemeVars, x, y, zIndex: isTop ? 2 : 1, touchAction: 'none', pointerEvents: isTop ? 'auto' : 'none' }}
      drag={isTop ? true : false}
      dragConstraints={{ top: 0, bottom: 0, left: 0, right: 0 }}
      dragElastic={0.6}
      dragMomentum={false}
      initial={false}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onPointerUp={handlePointerUp}
      title={isTop ? t('discovery_swipe_hint_person', 'Swipe left for next · right for previous · double-tap to open profile · swipe up or down to refresh') : undefined}
      aria-label={
        isTop
          ? t('discovery_swipe_hint_person', 'Swipe left for next · right for previous · double-tap to open profile · swipe up or down to refresh')
          : undefined
      }
    >
      <div className="discovery-card__glow" aria-hidden />

      <div className="discovery-card__frame">
        <img
          src={photoFailed ? getDefaultAvatar(profile.name) : profile.profilePhoto}
          alt=""
          className="discovery-card__photo discovery-card__photo--profile"
          draggable={false}
          onError={() => setPhotoFailed(true)}
        />

        <div className="discovery-card__gradient" aria-hidden />

        {/* Top corner (where close/inbox used to be): taste ring + title badge. */}
        <div className="discovery-card__top-row">
          {tasteVisible ? (
            <div
              className="discovery-card__taste-corner"
              style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 8, marginInlineStart: 'auto', flexWrap: 'wrap', justifyContent: 'flex-end' }}
              onPointerDown={(e) => e.stopPropagation()}
            >
              {/* Title chip — tap shows the quick tagline (its description). */}
              <TasteScopeBadge variant="full" titleId={profile.tasteTitleId} gender={tasteGender} />
              {/* Compatibility ring — only when the viewer also has a title. */}
              {compat ? <TasteCompatRing percent={compat.percent} size={54} /> : null}
            </div>
          ) : null}
        </div>

        <div className="discovery-card__identity" style={{ bottom: 'calc(1.35rem + env(safe-area-inset-bottom, 0px))' }}>
          <AppText as="h2" className="discovery-card__name-line">
            {profile.name}
          </AppText>
          {profile.bio ? (
            <AppText as="p" className="discovery-card__bio">
              {profile.bio}
            </AppText>
          ) : null}
          {locationLabel ? (
            <div className="discovery-card__location-bar" style={{ marginTop: 8, maxWidth: '100%', width: 'max-content' }}>
              <FaMapMarkerAlt className="discovery-card__location-pin" aria-hidden />
              <AppText as="span" className="discovery-card__location-text">
                {locationLabel}
              </AppText>
              {isOnline ? (
                <AppText
                  as="span"
                  className="discovery-card__online-dot"
                  aria-label={t('online', 'Online')}
                />
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="discovery-card__actions discovery-card__actions--rail">
          <button
            type="button"
            className={`discovery-card__action discovery-card__action--glass discovery-card__action--chat${
              canChat ? '' : ' discovery-card__action--locked'
            }`}
            aria-label={t('chat', 'Chat')}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={handleOpenChat}
          >
            <FaComments size={22} />
          </button>

          <button
            type="button"
            className="discovery-card__action discovery-card__action--glass discovery-card__action--gift"
            aria-label={t('user_directory_send_gift', 'Send gift')}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={handleGift}
          >
            <FaGift size={22} />
          </button>

          {showPrivateInviteBadge ? (
            <PrivateInviteProfileBadge
              user={targetUser}
              currentUser={viewerProfile}
              logoSrc="/db-logo-white.svg"
              className="discovery-card__action discovery-card__action--glass discovery-card__action--private-invite"
            />
          ) : null}

          <button
            type="button"
            className={`discovery-card__action discovery-card__action--glass discovery-card__action--wave${
              greetedToday ? ' discovery-card__action--greeted' : ''
            }`}
            disabled={greetingBusy || greetedToday}
            aria-label={t('user_directory_greeting', 'Wave hi')}
            title={t('user_directory_greeting', 'Wave hi')}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={handleWave}
          >
            <AppText as="span" className="discovery-card__wave-emoji" aria-hidden>
              👋
            </AppText>
          </button>

          <button
            type="button"
            className={`discovery-card__action discovery-card__action--glass discovery-card__action--follow${
              isFollowingUser ? ' discovery-card__action--following' : ''
            }`}
            disabled={followBusy}
            aria-label={isFollowingUser ? t('following', 'Following') : t('follow', 'Follow')}
            aria-pressed={isFollowingUser}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={handleFollow}
          >
            {isFollowingUser ? <FaUserCheck size={22} /> : <FaUserPlus size={22} />}
          </button>
        </div>
      </div>

    </motion.article>
  );
}
