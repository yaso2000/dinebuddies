import { useCallback, useEffect, useRef, useState } from 'react';

function getScrollRoot() {
  return document.querySelector('.app-main') || document.scrollingElement || document.documentElement;
}

function getScrollTop(root) {
  return root?.scrollTop ?? window.scrollY ?? 0;
}

/**
 * True when the touch started inside an element that scrolls horizontally
 * (filter chips, category rows, carousels). Dragging those sideways must never
 * be read as a pull-down — on iOS the sideways fling drifts a few px vertically,
 * which used to trigger a full refresh once the row hit its end.
 */
function startsInHorizontalScroller(target, boundary) {
  let el = target instanceof Element ? target : null;
  while (el && el !== boundary && el !== document.body) {
    if (el.scrollWidth > el.clientWidth + 1) {
      const ox = getComputedStyle(el).overflowX;
      if (ox === 'auto' || ox === 'scroll') return true;
    }
    el = el.parentElement;
  }
  return false;
}

/** Gesture direction lock: undecided → 'vertical' | 'horizontal'. */
const DIRECTION_LOCK_PX = 8;

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
  const startXRef = useRef(0);
  const directionRef = useRef(null);
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
      if (startsInHorizontalScroller(e.target, pageEl)) return;
      pullingRef.current = true;
      directionRef.current = null;
      startYRef.current = e.touches[0].clientY;
      startXRef.current = e.touches[0].clientX;
    };

    const onTouchMove = (e) => {
      if (!pullingRef.current || refreshingRef.current) return;
      const dy = e.touches[0].clientY - startYRef.current;
      const dx = e.touches[0].clientX - startXRef.current;
      if (directionRef.current === null) {
        if (Math.abs(dx) < DIRECTION_LOCK_PX && Math.abs(dy) < DIRECTION_LOCK_PX) return;
        directionRef.current = Math.abs(dx) > Math.abs(dy) ? 'horizontal' : 'vertical';
      }
      if (directionRef.current === 'horizontal') {
        // Sideways gesture: hand it to the browser, never pull.
        pullingRef.current = false;
        resetPull();
        return;
      }
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
