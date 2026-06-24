import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, animate, motion, useMotionValue } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { FaGift, FaHeart } from 'react-icons/fa';
import { useAuth } from '../../context/AuthContext';
import { useDiscoveryActionStatus } from '../../hooks/useDiscoveryActionStatus';
import { getJoinReasonLabel } from '../../constants/privateProfileOptions';
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
  const { t } = useTranslation();
  const { currentUser } = useAuth();
  const viewerUid = currentUser?.uid || currentUser?.id;
  const { liked: likedAlready, greetedToday } =
    useDiscoveryActionStatus(viewerUid, profile?.id);

  const x = useMotionValue(0);
  const exitHandledRef = useRef(false);
  const draggingRef = useRef(false);
  const burstTimerRef = useRef(null);

  const [liked, setLiked] = useState(false);
  const [greeted, setGreeted] = useState(false);
  const [likeBusy, setLikeBusy] = useState(false);
  const [greetingBusy, setGreetingBusy] = useState(false);
  const [likeBurst, setLikeBurst] = useState(false);
  const [waveBurst, setWaveBurst] = useState(false);

  useEffect(() => {
    setLiked(likedAlready);
  }, [likedAlready]);

  useEffect(() => {
    setGreeted(greetedToday);
  }, [greetedToday]);

  const joinReasonLabels = (profile.joinReasons || [])
    .map((id) => getJoinReasonLabel(id, t))
    .filter(Boolean);
  const interestTags = profile.interests || [];

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

  const handleLike = async (e) => {
    e.stopPropagation();
    if (!isTop || likeBusy || liked) return;
    setLikeBusy(true);
    setLiked(true);
    triggerBurst(setLikeBurst);
    try {
      const result = await onLike?.(profile);
      if (result?.ok === false && !result?.limited) {
        setLiked(false);
      }
    } finally {
      setLikeBusy(false);
    }
  };

  const handleGreeting = async (e) => {
    e.stopPropagation();
    if (!isTop || greetingBusy || greeted) return;
    setGreetingBusy(true);
    setGreeted(true);
    triggerBurst(setWaveBurst);
    try {
      const result = await onGreeting?.(profile);
      if (result?.ok === false && !result?.limited) {
        setGreeted(false);
      }
    } finally {
      setGreetingBusy(false);
    }
  };

  const handleGift = (e) => {
    e.stopPropagation();
    if (!isTop) return;
    onSendGift?.(profile);
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

      <div className="discovery-card__info discovery-card__info--profile">
        <div className="discovery-card__headline">
          <AppText as="h2" className="discovery-card__name">{profile.name}</AppText>
          {profile.ageCategory ?
          <AppText as="span" className="discovery-card__age-badge">{profile.ageCategory}</AppText> :
          null}
        </div>

        {joinReasonLabels.length > 0 ?
        <div className="discovery-card__section">
          <AppText as="p" className="discovery-card__section-label">
            {t('join_reason_title', 'Reason for joining')}
          </AppText>
          <div className="discovery-card__chips">
            {joinReasonLabels.map((label) =>
            <AppText as="span" key={label} className="discovery-card__chip discovery-card__chip--reason">
              {label}
            </AppText>
            )}
          </div>
        </div> :
        null}

        {interestTags.length > 0 ?
        <div className="discovery-card__section">
          <AppText as="p" className="discovery-card__section-label">
            {t('interests', 'Interests')}
          </AppText>
          <div className="discovery-card__chips">
            {interestTags.map((tag) =>
            <AppText as="span" key={tag} className="discovery-card__chip discovery-card__chip--interest">
              {tag}
            </AppText>
            )}
          </div>
        </div> :
        null}
      </div>

      <div className="discovery-card__actions discovery-card__actions--ghost">
        <button
          type="button"
          className={`discovery-card__action discovery-card__action--ghost discovery-card__action--like${liked ? ' discovery-card__action--liked' : ''}`}
          disabled={likeBusy || liked}
          aria-label={t('user_directory_like', 'Like profile')}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={handleLike}>
          <FaHeart size={26} />
        </button>
        <button
          type="button"
          className={`discovery-card__action discovery-card__action--ghost discovery-card__action--greeting${greeted ? ' discovery-card__action--greeted' : ''}`}
          disabled={greetingBusy || greeted}
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
