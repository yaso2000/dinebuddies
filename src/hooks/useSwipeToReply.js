import { useCallback, useRef, useState } from 'react';

const REPLY_THRESHOLD_PX = 48;
const MAX_DRAG_PX = 72;
/** Horizontal travel before we claim the gesture — below this a drag is still
 *  a candidate for the vertical scroll the list actually wants. */
const INTENT_PX = 8;
const VERTICAL_CANCEL_PX = 12;

/**
 * Drag a bubble horizontally, away from the edge it's docked to, to reply.
 * `alignRight` tells us which edge is "outward" so "inward" is computed
 * correctly regardless of RTL/LTR — the physical side never changes.
 *
 * Once the drag passes INTENT_PX the pointer is captured, so the rest of the
 * gesture (and crucially the pointerup that commits the reply) still lands on
 * this element even when the finger slides off the bubble mid-swipe.
 *
 * @param {{ onReply: () => void, disabled?: boolean, alignRight: boolean }} args
 */
export function useSwipeToReply({ onReply, disabled = false, alignRight }) {
    const [dragX, setDragX] = useState(0);
    const [armed, setArmed] = useState(false);
    const startRef = useRef({ x: 0, y: 0 });
    const draggingRef = useRef(false);
    const cancelledRef = useRef(false);
    const armedRef = useRef(false);
    const captureRef = useRef(null);

    const releaseCapture = useCallback(() => {
        const capture = captureRef.current;
        captureRef.current = null;
        if (!capture) return;
        try {
            if (capture.el.hasPointerCapture?.(capture.pointerId)) {
                capture.el.releasePointerCapture(capture.pointerId);
            }
        } catch {
            /* pointer already gone — nothing to release */
        }
    }, []);

    const reset = useCallback(() => {
        draggingRef.current = false;
        cancelledRef.current = false;
        armedRef.current = false;
        releaseCapture();
        setDragX(0);
        setArmed(false);
    }, [releaseCapture]);

    const onPointerDown = useCallback(
        (event) => {
            if (disabled) return;
            startRef.current = { x: event.clientX, y: event.clientY };
            draggingRef.current = true;
            cancelledRef.current = false;
            armedRef.current = false;
        },
        [disabled]
    );

    const onPointerMove = useCallback(
        (event) => {
            if (!draggingRef.current || cancelledRef.current) return;
            const dx = event.clientX - startRef.current.x;
            const dy = event.clientY - startRef.current.y;

            // Vertical intent wins — that is the list scrolling, not a reply.
            if (Math.abs(dy) > VERTICAL_CANCEL_PX && Math.abs(dy) > Math.abs(dx)) {
                cancelledRef.current = true;
                reset();
                return;
            }

            // Inward = away from the edge the bubble is docked to.
            const inward = alignRight ? -dx : dx;
            if (inward <= INTENT_PX) {
                armedRef.current = false;
                setDragX(0);
                setArmed(false);
                return;
            }

            if (!captureRef.current) {
                const el = event.currentTarget;
                try {
                    el.setPointerCapture?.(event.pointerId);
                    captureRef.current = { el, pointerId: event.pointerId };
                } catch {
                    /* capture unsupported — the gesture still works inside the bubble */
                }
            }

            const travel = Math.min(inward - INTENT_PX, MAX_DRAG_PX);
            const nextArmed = travel >= REPLY_THRESHOLD_PX;
            if (nextArmed && !armedRef.current) {
                try {
                    navigator.vibrate?.(10);
                } catch {
                    /* haptics are a nicety, never a requirement */
                }
            }
            armedRef.current = nextArmed;
            setDragX(alignRight ? -travel : travel);
            setArmed(nextArmed);
        },
        [alignRight, reset]
    );

    const onPointerUp = useCallback(() => {
        const shouldReply = draggingRef.current && !cancelledRef.current && armedRef.current;
        reset();
        if (shouldReply) onReply?.();
    }, [onReply, reset]);

    return {
        dragX,
        armed,
        /** 0 → 1 as the drag approaches the commit threshold. */
        progress: Math.min(1, Math.abs(dragX) / REPLY_THRESHOLD_PX),
        handlers: {
            onPointerDown,
            onPointerMove,
            onPointerUp,
            onPointerCancel: reset,
        },
    };
}
