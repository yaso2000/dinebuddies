import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LuSparkles } from 'react-icons/lu';
import './discovery.css';
import { AppText } from '../base';

/**
 * Immersive one-at-a-time magnetic deck (Connect / invitations / partners).
 * `items` must include stable `id` and `coverImage` for the next-card preview.
 */
export default function MagneticDeck({
  items = [],
  renderCard,
  emptyTitle,
  emptySub,
  finishedTitle,
  finishedSub,
  listPath,
  onNearEnd,
  onDeckEmpty,
}) {
  const { t } = useTranslation();
  const [index, setIndex] = useState(0);
  const activeIdRef = useRef(null);
  const hasStartedRef = useRef(false);

  useEffect(() => {
    if (items.length === 0) {
      setIndex(0);
      activeIdRef.current = null;
      hasStartedRef.current = false;
      return;
    }

    const currentId = activeIdRef.current;
    if (currentId) {
      const nextIndex = items.findIndex((p) => p.id === currentId);
      if (nextIndex >= 0) {
        setIndex(nextIndex);
        return;
      }
    }

    if (!hasStartedRef.current) {
      setIndex(0);
      activeIdRef.current = items[0]?.id ?? null;
      return;
    }

    setIndex((prev) => Math.min(prev, items.length - 1));
  }, [items]);

  const activeItem = items[index] ?? null;
  const nextItem = items[index + 1] ?? null;
  const deckFinished = items.length > 0 && index >= items.length;
  const isEmpty = !activeItem;

  useEffect(() => {
    if (activeItem?.id) {
      activeIdRef.current = activeItem.id;
      hasStartedRef.current = true;
    }
  }, [activeItem?.id]);

  const advance = useCallback(() => {
    setIndex((prev) => {
      const next = prev + 1;
      if (next >= items.length) onDeckEmpty?.();
      return next;
    });
  }, [items.length, onDeckEmpty]);

  const handleReplay = useCallback(() => {
    hasStartedRef.current = false;
    activeIdRef.current = items[0]?.id ?? null;
    setIndex(0);
  }, [items]);

  useEffect(() => {
    if (!onNearEnd || items.length === 0) return;
    if (index >= items.length - 2) onNearEnd();
  }, [index, onNearEnd, items.length]);

  const handleSkip = useCallback(() => {
    advance();
  }, [advance]);

  if (isEmpty) {
    return (
      <div className="discovery-feed discovery-feed__empty">
        <LuSparkles color="#E86E2E" size={40} aria-hidden />
        <AppText as="h2" className="discovery-feed__empty-title">
          {deckFinished
            ? finishedTitle || t('discovery_deck_empty_title', "You're all caught up")
            : emptyTitle || t('user_directory_empty', 'No members to show yet.')}
        </AppText>
        <AppText as="p" className="discovery-feed__empty-sub">
          {deckFinished
            ? finishedSub || t('discovery_deck_empty_sub', 'Check back later for new members to discover.')
            : emptySub || t('discovery_deck_no_members_sub', 'Try adjusting your filters or come back later.')}
        </AppText>
        {deckFinished ? (
          <button type="button" className="discovery-feed__replay-btn" onClick={handleReplay}>
            {t('discovery_deck_replay', 'Browse again')}
          </button>
        ) : null}
        {listPath ? (
          <Link to={listPath} className="discovery-feed__replay-btn" style={{ marginTop: deckFinished ? 10 : 20 }}>
            {t('list_view', 'List')}
          </Link>
        ) : null}
      </div>
    );
  }

  return (
    <div className="discovery-feed">
      {nextItem?.coverImage ? (
        <div className="discovery-feed__next-bg" aria-hidden>
          <img src={nextItem.coverImage} alt="" decoding="async" />
        </div>
      ) : null}

      {renderCard({ item: activeItem, isTop: true, onSkip: handleSkip })}
    </div>
  );
}
