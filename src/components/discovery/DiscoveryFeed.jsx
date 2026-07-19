import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LuSparkles } from 'react-icons/lu';
import DiscoveryCard from './DiscoveryCard';
import './discovery.css';
import { AppText } from '../base';

/** Immersive discovery feed — profile photo background + like / wave / gift. */
export default function DiscoveryFeed({
  profiles = [],
  onSkip,
  onLike,
  onSendGift,
  onGreeting,
  onDeckEmpty,
  onNearEnd,
}) {
  const { t } = useTranslation();
  const [index, setIndex] = useState(0);
  const activeIdRef = useRef(null);
  const hasStartedRef = useRef(false);

  // Keep the current card when the deck re-sorts (e.g. geo arrives); only clamp / start fresh.
  useEffect(() => {
    if (profiles.length === 0) {
      setIndex(0);
      activeIdRef.current = null;
      hasStartedRef.current = false;
      return;
    }

    const currentId = activeIdRef.current;
    if (currentId) {
      const nextIndex = profiles.findIndex((p) => p.id === currentId);
      if (nextIndex >= 0) {
        setIndex(nextIndex);
        return;
      }
    }

    if (!hasStartedRef.current) {
      setIndex(0);
      activeIdRef.current = profiles[0]?.id ?? null;
      return;
    }

    setIndex((prev) => Math.min(prev, profiles.length - 1));
  }, [profiles]);

  const activeProfile = profiles[index] ?? null;
  const nextProfile = profiles[index + 1] ?? null;
  const deckFinished = profiles.length > 0 && index >= profiles.length;
  const isEmpty = !activeProfile;

  useEffect(() => {
    if (activeProfile?.id) {
      activeIdRef.current = activeProfile.id;
      hasStartedRef.current = true;
    }
  }, [activeProfile?.id]);

  const advance = useCallback(() => {
    setIndex((prev) => {
      const next = prev + 1;
      if (next >= profiles.length) onDeckEmpty?.();
      return next;
    });
  }, [profiles.length, onDeckEmpty]);

  const handleReplay = useCallback(() => {
    hasStartedRef.current = false;
    activeIdRef.current = profiles[0]?.id ?? null;
    setIndex(0);
  }, [profiles]);

  useEffect(() => {
    if (!onNearEnd || profiles.length === 0) return;
    if (index >= profiles.length - 2) onNearEnd();
  }, [index, onNearEnd, profiles.length]);

  const handleSkip = useCallback(
    (profile) => {
      onSkip?.(profile);
      advance();
    },
    [advance, onSkip]
  );

  const handlers = useMemo(
    () => ({
      onSkip: handleSkip,
      onLike,
      onSendGift: (p) => onSendGift?.(p),
      onGreeting,
    }),
    [handleSkip, onGreeting, onLike, onSendGift]
  );

  if (isEmpty) {
    return (
      <div className="discovery-feed discovery-feed__empty">
        <LuSparkles color="#E86E2E" size={40} aria-hidden />
        <AppText as="h2" className="discovery-feed__empty-title">
          {deckFinished
            ? t('discovery_deck_empty_title', "You're all caught up")
            : t('user_directory_empty', 'No members to show yet.')}
        </AppText>
        <AppText as="p" className="discovery-feed__empty-sub">
          {deckFinished
            ? t('discovery_deck_empty_sub', 'Check back later for new members to discover.')
            : t('discovery_deck_no_members_sub', 'Try adjusting your filters or come back later.')}
        </AppText>
        {deckFinished ? (
          <button type="button" className="discovery-feed__replay-btn" onClick={handleReplay}>
            {t('discovery_deck_replay', 'Browse again')}
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="discovery-feed">
      {nextProfile ? (
        <div className="discovery-feed__next-bg" aria-hidden>
          <img src={nextProfile.profilePhoto} alt="" decoding="async" />
        </div>
      ) : null}

      <DiscoveryCard key={activeProfile.id} profile={activeProfile} isTop {...handlers} />
    </div>
  );
}
