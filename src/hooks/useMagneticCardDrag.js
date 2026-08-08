import { useCallback, useRef } from 'react';
import { animate, useMotionValue } from 'framer-motion';

const SWIPE_SKIP_THRESHOLD = 100;
const SWIPE_VELOCITY = 450;
const DOUBLE_ACTIVATE_MS = 320;
const DOUBLE_ACTIVATE_PX = 22;
const DRAG_SLOP_PX = 14;

/**
 * Shared magnetic drag / skip behavior for swipe cards.
 * @param {'x'|'y'} [axis='x'] — users stay horizontal; invitations/partners use vertical.
 * @param {((item: unknown) => void)|null} [onPhotoActivate] — single tap on photo area opens detail.
 */
export function useMagneticCardDrag({
  isTop,
  onSkip,
  item,
  axis = 'x',
  onPhotoActivate = null,
}) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const primary = axis === 'y' ? y : x;
  const exitHandledRef = useRef(false);
  const draggingRef = useRef(false);
  const lastActivateRef = useRef({ at: 0, x: 0, y: 0 });

  const resetPosition = useCallback(() => {
    animate(primary, 0, { type: 'spring', stiffness: 520, damping: 28 });
  }, [primary]);

  const triggerSkip = useCallback(
    (direction = -1) => {
      if (exitHandledRef.current) return;
      exitHandledRef.current = true;
      const distance = axis === 'y' ? 720 : 560;
      const target = direction < 0 ? -distance : distance;
      animate(primary, target, { duration: 0.22, ease: 'easeIn' }).then(() => {
        onSkip?.(item);
      });
    },
    [axis, item, onSkip, primary]
  );

  const handleDragStart = () => {
    draggingRef.current = true;
  };

  const handleDragEnd = (_, info) => {
    window.setTimeout(() => {
      draggingRef.current = false;
    }, 50);

    if (!isTop) return;
    const { offset, velocity } = info;
    if (axis === 'y') {
      if (offset.y < -SWIPE_SKIP_THRESHOLD || velocity.y < -SWIPE_VELOCITY) {
        triggerSkip(-1);
        return;
      }
      if (offset.y > SWIPE_SKIP_THRESHOLD || velocity.y > SWIPE_VELOCITY) {
        triggerSkip(1);
        return;
      }
    } else if (offset.x < -SWIPE_SKIP_THRESHOLD || velocity.x < -SWIPE_VELOCITY) {
      triggerSkip(-1);
      return;
    }
    resetPosition();
  };

  const isInteractiveTarget = useCallback((target) => {
    if (!target?.closest) return false;
    return Boolean(
      target.closest(
        '.discovery-card__actions, .discovery-card__close, .discovery-card__cta, .discovery-card__inbox, button, a'
      )
    );
  }, []);

  const isPhotoAreaTarget = useCallback((target) => {
    if (!target?.closest) return false;
    if (isInteractiveTarget(target)) return false;
    if (target.closest('.discovery-card__body')) return false;
    return Boolean(target.closest('.discovery-card__frame, .discovery-card__photo'));
  }, [isInteractiveTarget]);

  const handleNavigateActivate = useCallback(
    (clientX, clientY) => {
      if (!isTop || exitHandledRef.current || draggingRef.current) return;
      const now = Date.now();
      const prev = lastActivateRef.current;
      const dt = now - prev.at;
      const dist = Math.hypot(clientX - prev.x, clientY - prev.y);
      if (prev.at && dt <= DOUBLE_ACTIVATE_MS && dist <= DOUBLE_ACTIVATE_PX) {
        lastActivateRef.current = { at: 0, x: 0, y: 0 };
        triggerSkip(-1);
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
      if (draggingRef.current) return;
      if (Math.abs(primary.get()) > DRAG_SLOP_PX) return;

      if (typeof onPhotoActivate === 'function' && isPhotoAreaTarget(e.target)) {
        onPhotoActivate(item);
        return;
      }

      handleNavigateActivate(e.clientX, e.clientY);
    },
    [
      handleNavigateActivate,
      isInteractiveTarget,
      isPhotoAreaTarget,
      isTop,
      item,
      onPhotoActivate,
      primary,
    ]
  );

  return {
    x,
    y,
    axis,
    drag: isTop ? axis : false,
    dragConstraints: axis === 'y' ? { top: 0, bottom: 0 } : { left: 0, right: 0 },
    touchAction: axis === 'y' ? 'pan-x' : 'pan-y',
    styleMotion: axis === 'y' ? { y } : { x },
    handleDragStart,
    handleDragEnd,
    handleCardPointerUp,
  };
}
