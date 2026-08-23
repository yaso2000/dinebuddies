import { useCallback, useRef, useState } from 'react';

const REPLY_THRESHOLD_PX = 64;
const MAX_DRAG_PX = 80;
const VERTICAL_CANCEL_PX = 24;

/**
 * Drag a bubble horizontally, away from the edge it's docked to, to reply.
 * `alignRight` tells us which edge is "outward" so "inward" is computed
 * correctly regardless of RTL/LTR — the physical side never changes.
 *
 * @param {{ onReply: () => void, disabled?: boolean, alignRight: boolean }} args
 */
export function useSwipeToReply({ onReply, disabled = false, alignRight }) {
    const [dragX, setDragX] = useState(0);
    const [armed, setArmed] = useState(false);
    const startRef = useRef({ x: 0, y: 0 });
    const draggingRef = useRef(false);
    const cancelledRef = useRef(false);

    const reset = useCallback(() => {
        draggingRef.current = false;
        cancelledRef.current = false;
        setDragX(0);
        setArmed(false);
    }, []);

    const onPointerDown = useCallback(
        (event) => {
            if (disabled) return;
            startRef.current = { x: event.clientX, y: event.clientY };
            draggingRef.current = true;
            cancelledRef.current = false;
        },
        [disabled]
    );

    const onPointerMove = useCallback(
        (event) => {
            if (!draggingRef.current || cancelledRef.current) return;
            const dx = event.clientX - startRef.current.x;
            const dy = event.clientY - startRef.current.y;

            if (Math.abs(dy) > VERTICAL_CANCEL_PX && Math.abs(dy) > Math.abs(dx)) {
                cancelledRef.current = true;
                reset();
                return;
            }

            // Inward = away from the edge the bubble is docked to.
            const inward = alignRight ? -dx : dx;
            if (inward <= 0) {
                setDragX(0);
                setArmed(false);
                return;
            }
            const clamped = Math.min(inward, MAX_DRAG_PX);
            setDragX(alignRight ? -clamped : clamped);
            setArmed(clamped >= REPLY_THRESHOLD_PX);
        },
        [alignRight, reset]
    );

    const onPointerUp = useCallback(() => {
        if (draggingRef.current && !cancelledRef.current && armed) {
            onReply?.();
        }
        reset();
    }, [armed, onReply, reset]);

    return {
        dragX,
        armed,
        handlers: {
            onPointerDown,
            onPointerMove,
            onPointerUp,
            onPointerCancel: reset,
        },
    };
}
