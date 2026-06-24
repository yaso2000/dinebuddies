import { useCallback, useRef } from 'react';

const DEFAULT_DELAY_MS = 500;
const MOVE_THRESHOLD_PX = 10;

/**
 * Fires callback after sustained press; cancelled on move or release.
 */
export function useLongPress(onLongPress, { delay = DEFAULT_DELAY_MS, disabled = false } = {}) {
    const timerRef = useRef(null);
    const startRef = useRef({ x: 0, y: 0 });
    const movedRef = useRef(false);

    const clearTimer = useCallback(() => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
    }, []);

    const onPointerDown = useCallback(
        (event) => {
            if (disabled) return;
            movedRef.current = false;
            startRef.current = { x: event.clientX, y: event.clientY };
            clearTimer();
            timerRef.current = setTimeout(() => {
                if (!movedRef.current) {
                    onLongPress?.(event);
                }
            }, delay);
        },
        [clearTimer, delay, disabled, onLongPress]
    );

    const onPointerMove = useCallback(
        (event) => {
            if (!timerRef.current) return;
            const dx = event.clientX - startRef.current.x;
            const dy = event.clientY - startRef.current.y;
            if (Math.hypot(dx, dy) > MOVE_THRESHOLD_PX) {
                movedRef.current = true;
                clearTimer();
            }
        },
        [clearTimer]
    );

    const onPointerUp = useCallback(() => {
        clearTimer();
    }, [clearTimer]);

    return {
        onPointerDown,
        onPointerMove,
        onPointerUp,
        onPointerCancel: onPointerUp,
    };
}
