import { useCallback, useEffect, useRef, useState } from 'react';

function getScrollRoot() {
  return document.querySelector('.app-main') || document.scrollingElement || document.documentElement;
}

function getScrollTop(root) {
  return root?.scrollTop ?? window.scrollY ?? 0;
}

/**
 * Touch pull-to-refresh without native rubber-band overscroll.
 * Pulls the page content via translateY; calls onRefresh when threshold is met.
 */
export function usePullToRefresh({
  onRefresh,
  disabled = false,
  threshold = 68,
  maxPull = 88,
} = {}) {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const pullRef = useRef(0);
  const pullingRef = useRef(false);
  const startYRef = useRef(0);
  const refreshingRef = useRef(false);
  const onRefreshRef = useRef(onRefresh);
  const pageRef = useRef(null);

  useEffect(() => {
    refreshingRef.current = refreshing;
  }, [refreshing]);

  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  const resetPull = useCallback(() => {
    pullRef.current = 0;
    setPull(0);
  }, []);

  useEffect(() => {
    if (disabled) return undefined;

    const pageEl = pageRef.current;
    if (!pageEl) return undefined;

    const onTouchStart = (e) => {
      if (refreshingRef.current) return;
      if (!pageEl.contains(e.target)) return;
      const root = getScrollRoot();
      if (getScrollTop(root) > 4) return;
      pullingRef.current = true;
      startYRef.current = e.touches[0].clientY;
    };

    const onTouchMove = (e) => {
      if (!pullingRef.current || refreshingRef.current) return;
      const dy = e.touches[0].clientY - startYRef.current;
      if (dy <= 0) {
        resetPull();
        return;
      }
      e.preventDefault();
      const next = Math.min(maxPull, dy * 0.42);
      pullRef.current = next;
      setPull(next);
    };

    const finish = async () => {
      if (!pullingRef.current) return;
      pullingRef.current = false;
      const distance = pullRef.current;
      if (distance >= threshold && onRefreshRef.current && !refreshingRef.current) {
        setRefreshing(true);
        pullRef.current = 44;
        setPull(44);
        try {
          await onRefreshRef.current();
        } finally {
          setRefreshing(false);
          resetPull();
        }
        return;
      }
      resetPull();
    };

    const onTouchEnd = () => {
      void finish();
    };

    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchmove', onTouchMove, { passive: false });
    document.addEventListener('touchend', onTouchEnd, { passive: true });
    document.addEventListener('touchcancel', onTouchEnd, { passive: true });

    return () => {
      document.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onTouchEnd);
      document.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [disabled, maxPull, resetPull, threshold]);

  const offset = refreshing ? 44 : pull;
  const progress = Math.min(1, pull / threshold);

  return {
    pageRef,
    pull: offset,
    progress,
    refreshing,
  };
}
