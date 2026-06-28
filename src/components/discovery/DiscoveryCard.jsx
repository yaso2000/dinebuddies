import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, animate, motion, useMotionValue } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { FaComments, FaGift, FaHeart, FaUserCheck, FaUserPlus } from 'react-icons/fa';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../context/AuthContext';
import { useInvitations } from '../../context/InvitationContext';
import { useToast } from '../../context/ToastContext';
import {
  likeDiscoveryProfile,
  unlikeDiscoveryProfile,
} from '../../utils/discoveryProfile';
import { showLikeCooldownWarning } from '../../utils/connectionActionCooldown';
import { isFollowing as checkIsFollowing } from '../../utils/followHelpers';
import { checkCanMessage } from '../../utils/chatHelpers';
import { profileShowsLikeButton, connectionKindToCelebrationType, tryCelebrateConnectionComplete } from '../../utils/connectConnection';
import { useDiscoveryActionStatus } from '../../hooks/useDiscoveryActionStatus';
import { useCanMessageMember } from '../../hooks/useCanMessageMember';
import { useMatchCelebration } from '../../context/MatchCelebrationContext';
import OnlineStatusBadge from '../profile/OnlineStatusBadge';
import { useUserPresence } from '../../hooks/usePresence';
import './discovery.css';
import { AppText } from "../base";

const SWIPE_X_SKIP_THRESHOLD = 100;
const BURST_MS = 1400;

export default function DiscoveryCard({
  profile,
  onSkip,
  onLike,
  onSendGift,
  onGreeting,
  isTop = true
}) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { showToast, showPersistentWarning } = useToast();
  const { currentUser, userProfile } = useAuth();
  const { toggleFollow, currentUser: invitationUser } = useInvitations();
  const { celebrateMatch } = useMatchCelebration();
  const targetUser = profile?.user || profile;
  const isOnline = useUserPresence(profile?.id, { fallback: Boolean(targetUser?.isOnline) });
  const viewerProfile = userProfile || currentUser || invitationUser;
  const useDatingLike = profileShowsLikeButton(targetUser);
  const viewerUid = currentUser?.uid || currentUser?.id;
  const viewerFollowing = useMemo(
    () => invitationUser?.following || [],
    [invitationUser?.following]
  );
  const canMessageFromServer = useCanMessageMember(viewerUid, profile?.id, viewerFollowing);
  const { liked, greetedToday } = useDiscoveryActionStatus(viewerUid, profile?.id);

  const x = useMotionValue(0);
  const exitHandledRef = useRef(false);
  const draggingRef = useRef(false);
  const burstTimerRef = useRef(null);

  const [likeBusy, setLikeBusy] = useState(false);
  const [greetingBusy, setGreetingBusy] = useState(false);
  const [likeBurst, setLikeBurst] = useState(false);
  const [waveBurst, setWaveBurst] = useState(false);
  const [canChat, setCanChat] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const isFollowingUser = checkIsFollowing(viewerFollowing, profile?.id);

  const refreshCanChat = useCallback(async () => {
    if (!viewerUid || !profile?.id) return;
    try {
      const snap = await getDoc(doc(db, 'users', profile.id));
      const targetFollowing = snap.exists() ? snap.data()?.following || [] : [];
      const allowed = await checkCanMessage(viewerUid, profile.id, viewerFollowing, targetFollowing);
      setCanChat(allowed);
    } catch {
      setCanChat(false);
    }
  }, [profile?.id, viewerFollowing, viewerUid]);

  useEffect(() => {
    setCanChat(canMessageFromServer);
  }, [canMessageFromServer]);

  const triggerBurst = useCallback((setter) => {
    if (burstTimerRef.current) window.clearTimeout(burstTimerRef.current);
    setter(true);
    burstTimerRef.current = window.setTimeout(() => {
      setter(false);
      burstTimerRef.current = null;
    }, BURST_MS);
  }, []);

  const resetPosition = useCallback(() => {
    animate(x, 0, { type: 'spring', stiffness: 420, damping: 32 });
  }, [x]);

  const triggerSkip = useCallback(() => {
    if (exitHandledRef.current) return;
    exitHandledRef.current = true;
    animate(x, -520, { duration: 0.22, ease: 'easeIn' }).then(() => {
      onSkip?.(profile);
    });
  }, [onSkip, profile, x]);

  const handleDragStart = () => {
    draggingRef.current = true;
  };

  const handleDragEnd = (_, info) => {
    window.setTimeout(() => {
      draggingRef.current = false;
    }, 50);

    if (!isTop) return;
    const { offset, velocity } = info;

    if (offset.x < -SWIPE_X_SKIP_THRESHOLD || velocity.x < -450) {
      triggerSkip();
      return;
    }
    resetPosition();
  };

  const handleToggleLike = async (e) => {
    e.stopPropagation();
    if (!isTop || likeBusy) return;

    if (!viewerUid) {
      onLike?.(profile);
      return;
    }

    setLikeBusy(true);
    try {
      if (liked) {
        const result = await unlikeDiscoveryProfile(viewerUid, targetUser);
        if (result?.ok) {
          if (result.wasMutual) await refreshCanChat();
        } else if (result?.reason === 'permission_denied') {
          showToast(
            t(
              'discovery_unlike_rules_pending',
              'Could not remove like yet — app rules may need updating. Try again shortly.'
            ),
            'error'
          );
        } else {
          showToast(t('discovery_unlike_failed', 'Could not remove like. Try again.'), 'error');
        }
        return;
      }

      triggerBurst(setLikeBurst);
      const result = await likeDiscoveryProfile(viewerUid, targetUser, userProfile || currentUser);
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
        celebrateMatch({
          type: connectionKindToCelebrationType(result.connectionKind || 'dating'),
          otherUser: targetUser,
          otherId: profile.id,
          otherName: profile.name,
        });
      }
    } catch (err) {
      console.error('[DiscoveryCard] like', err);
      showToast(t('discovery_like_failed', 'Could not like. Try again.'), 'error');
    } finally {
      setLikeBusy(false);
    }
  };

  const handleFollow = async (e) => {
    e.stopPropagation();
    if (!isTop || followBusy) return;
    setFollowBusy(true);
    try {
      const wasFollowing = isFollowingUser;
      const result = await toggleFollow(profile.id);
      if (result?.ok && result.connectionComplete && result.connectionKind) {
        setCanChat(true);
        celebrateMatch({
          type: connectionKindToCelebrationType(result.connectionKind),
          otherUser: targetUser,
          otherId: profile.id,
          otherName: profile.name,
        });
      } else if (result?.ok && wasFollowing) {
        await refreshCanChat();
      }
    } catch (err) {
      console.error('[DiscoveryCard] follow', err);
      showToast(t('discovery_follow_failed', 'Could not follow. Try again.'), 'error');
    } finally {
      setFollowBusy(false);
    }
  };

  const handleGreeting = async (e) => {
    e.stopPropagation();
    if (!isTop || greetingBusy || greetedToday) return;
    setGreetingBusy(true);
    triggerBurst(setWaveBurst);
    try {
      await onGreeting?.(profile);
    } finally {
      setGreetingBusy(false);
    }
  };

  const handleGift = (e) => {
    e.stopPropagation();
    if (!isTop) return;
    onSendGift?.(profile);
  };

  const handleOpenChat = (e) => {
    e.stopPropagation();
    if (!profile?.id) return;
    navigate(`/chat/${profile.id}`);
  };

  return (
    <motion.article
      className="discovery-card"
      style={{ x, zIndex: isTop ? 2 : 1, touchAction: 'pan-y' }}
      drag={isTop ? 'x' : false}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.9}
      dragMomentum={false}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}>

      <img
        src={profile.profilePhoto}
        alt=""
        className="discovery-card__photo discovery-card__photo--profile"
        draggable={false} />

      <div className="discovery-card__gradient" aria-hidden />

      <OnlineStatusBadge isOnline={isOnline} className="discovery-card__online-badge" size="sm" />

      <div className="discovery-card__info discovery-card__info--profile">
        <div className="discovery-card__headline">
          <AppText as="h2" className="discovery-card__name">{profile.name}</AppText>
          {profile.ageCategory ?
          <AppText as="span" className="discovery-card__age-badge">{profile.ageCategory}</AppText> :
          null}
        </div>
      </div>

      <div className="discovery-card__actions discovery-card__actions--ghost">
        {useDatingLike ?
        <button
          type="button"
          className={`discovery-card__action discovery-card__action--ghost discovery-card__action--like${liked ? ' discovery-card__action--liked' : ' discovery-card__action--like-idle'}`}
          disabled={likeBusy}
          aria-label={liked ? t('unlike', 'Unlike') : t('user_directory_like', 'Like profile')}
          aria-pressed={liked}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={handleToggleLike}>
          <FaHeart size={26} />
        </button> :
        <button
          type="button"
          className={`discovery-card__action discovery-card__action--ghost discovery-card__action--follow${isFollowingUser ? ' discovery-card__action--following' : ''}`}
          disabled={followBusy}
          aria-label={isFollowingUser ? t('following', 'Following') : t('follow', 'Follow')}
          aria-pressed={isFollowingUser}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={handleFollow}>
          {isFollowingUser ? <FaUserCheck size={24} /> : <FaUserPlus size={24} />}
        </button>}
        <button
          type="button"
          className={`discovery-card__action discovery-card__action--ghost discovery-card__action--greeting${greetedToday ? ' discovery-card__action--greeted' : ''}`}
          disabled={greetingBusy || greetedToday}
          aria-label={t('user_directory_greeting', 'Wave hi')}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={handleGreeting}>
          <AppText as="span" className="discovery-card__wave-btn" aria-hidden>👋</AppText>
        </button>
        <button
          type="button"
          className="discovery-card__action discovery-card__action--ghost discovery-card__action--gift"
          aria-label={t('user_directory_send_gift', 'Send gift')}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={handleGift}>
          <FaGift size={24} />
        </button>
        {canChat ?
        <button
          type="button"
          className="discovery-card__action discovery-card__action--ghost discovery-card__action--chat"
          aria-label={t('chat', 'Chat')}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={handleOpenChat}>
          <FaComments size={24} />
        </button> :
        null}
      </div>

      <AnimatePresence>
        {likeBurst ?
        <motion.div
          className="discovery-card__burst discovery-card__burst--heart"
          initial={{ opacity: 0, scale: 0.35 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.08 }}
          transition={{ duration: 0.28, ease: 'easeOut' }}>
          <FaHeart className="discovery-card__heart-3d" aria-hidden />
        </motion.div> :
        null}
      </AnimatePresence>

      <AnimatePresence>
        {waveBurst ?
        <motion.div
          className="discovery-card__burst discovery-card__burst--wave"
          initial={{ opacity: 0, scale: 0.45 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.05 }}
          transition={{ duration: 0.24, ease: 'easeOut' }}>
          <motion.span
            className="discovery-card__wave-3d"
            aria-hidden
            animate={{ rotate: [-18, 18, -14, 14, -8, 8, 0] }}
            transition={{ duration: 0.85, ease: 'easeInOut' }}>
            👋
          </motion.span>
        </motion.div> :
        null}
      </AnimatePresence>
    </motion.article>
  );
}
