import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { LuSparkles } from 'react-icons/lu';
import DiscoveryCard from './DiscoveryCard';
import './discovery.css';
import { AppText } from "../base";

/** Immersive discovery feed — profile photo background + like / wave / gift. */
export default function DiscoveryFeed({
  profiles = [],
  onSkip,
  onLike,
  onSendGift,
  onGreeting,
  onDeckEmpty,
  onNearEnd
}) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
  }, [profiles]);

  const activeProfile = profiles[index] ?? null;
  const nextProfile = profiles[index + 1] ?? null;
  const isEmpty = !activeProfile;

  const advance = useCallback(() => {
    setIndex((prev) => {
      const next = prev + 1;
      if (next >= profiles.length) onDeckEmpty?.();
      return next;
    });
  }, [profiles.length, onDeckEmpty]);

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
      onGreeting
    }),
    [handleSkip, onGreeting, onLike, onSendGift]
  );

  if (isEmpty) {
    return (
      <div className="discovery-feed discovery-feed__empty">
        <LuSparkles color="#E86E2E" size={40} />
        <AppText as="h2" style={{ marginTop: '1rem', fontSize: '1.25rem', fontWeight: 800 }}>
          لا مزيد من الملفات الآن
        </AppText>
        <AppText as="p" style={{ marginTop: '0.5rem', fontSize: '0.875rem', opacity: 0.65 }}>
          عد لاحقاً لاكتشاف أعضاء جدد.
        </AppText>
      </div>);
  }

  return (
    <div className="discovery-feed">
      {nextProfile ?
      <div className="discovery-feed__next-bg" aria-hidden>
        <img src={nextProfile.profilePhoto} alt="" />
      </div> :
      null}

      <DiscoveryCard key={activeProfile.id} profile={activeProfile} isTop {...handlers} />
    </div>);
}
