import { useCallback, useRef } from 'react';
import { animate, useMotionValue } from 'framer-motion';

const SWIPE_X_SKIP_THRESHOLD = 100;
const DOUBLE_ACTIVATE_MS = 320;
const DOUBLE_ACTIVATE_PX = 22;

/** Shared magnetic drag / double-tap-to-skip behavior for swipe cards. */
export function useMagneticCardDrag({ isTop, onSkip, item }) {
  const x = useMotionValue(0);
  const exitHandledRef = useRef(false);
  const draggingRef = useRef(false);
  const lastActivateRef = useRef({ at: 0, x: 0, y: 0 });

  const resetPosition = useCallback(() => {
    animate(x, 0, { type: 'spring', stiffness: 520, damping: 28 });
  }, [x]);

  const triggerSkip = useCallback(() => {
    if (exitHandledRef.current) return;
    exitHandledRef.current = true;
    animate(x, -560, { duration: 0.22, ease: 'easeIn' }).then(() => {
      onSkip?.(item);
    });
  }, [item, onSkip, x]);

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

  const isInteractiveTarget = useCallback((target) => {
    if (!target?.closest) return false;
    return Boolean(
      target.closest(
        '.discovery-card__actions, .discovery-card__close, .discovery-card__cta, button, a'
      )
    );
  }, []);

  const handleNavigateActivate = useCallback(
    (clientX, clientY) => {
      if (!isTop || exitHandledRef.current || draggingRef.current) return;
      const now = Date.now();
      const prev = lastActivateRef.current;
      const dt = now - prev.at;
      const dist = Math.hypot(clientX - prev.x, clientY - prev.y);
      if (prev.at && dt <= DOUBLE_ACTIVATE_MS && dist <= DOUBLE_ACTIVATE_PX) {
        lastActivateRef.current = { at: 0, x: 0, y: 0 };
        triggerSkip();
        return;
      }
      lastActivateRef.current = { at: now, x: clientX, y: clientY };
    },
    [isTop, triggerSkip]
  );

  const handleCardPointerUp = useCallback(
    (e) => {
      if (!isTop) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (isInteractiveTarget(e.target)) return;
      handleNavigateActivate(e.clientX, e.clientY);
    },
    [handleNavigateActivate, isInteractiveTarget, isTop]
  );

  return {
    x,
    handleDragStart,
    handleDragEnd,
    handleCardPointerUp,
  };
}
