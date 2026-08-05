import { useCallback, useEffect, useRef, useState } from 'react';

const DRAG_THRESHOLD_PX = 5;
const SCROLL_SETTLE_MS = 90;

/** Vertical drag-to-scroll + wheel for column rails (mouse + touch). */
export function useVerticalDragScrollRail({ onScrollSettle, enabled = true } = {}) {
    const railRef = useRef(null);
    const dragRef = useRef({
        active: false,
        pending: false,
        startY: 0,
        scrollTop: 0,
        moved: false,
    });
    const suppressClickRef = useRef(false);
    const [isDragging, setIsDragging] = useState(false);

    const onPointerDown = useCallback((e) => {
        const el = railRef.current;
        if (!el || e.button > 0) return;

        const onChip = Boolean(e.target.closest('button, [role="radio"], [role="option"]'));

        dragRef.current = {
            active: !onChip,
            pending: onChip,
            startY: e.clientY,
            scrollTop: el.scrollTop,
            moved: false,
        };

        if (dragRef.current.active) {
            setIsDragging(true);
            el.setPointerCapture?.(e.pointerId);
        }
    }, []);

    const onPointerMove = useCallback((e) => {
        const el = railRef.current;
        if (!el) return;
        const state = dragRef.current;

        if (state.pending) {
            const dy = e.clientY - state.startY;
            if (Math.abs(dy) <= DRAG_THRESHOLD_PX) return;
            state.pending = false;
            state.active = true;
            setIsDragging(true);
            el.setPointerCapture?.(e.pointerId);
        }

        if (!state.active) return;

        const dy = e.clientY - state.startY;
        if (Math.abs(dy) > DRAG_THRESHOLD_PX) state.moved = true;
        el.scrollTop = state.scrollTop - dy;
    }, []);

    const endDrag = useCallback((e) => {
        const state = dragRef.current;
        if (!state.active && !state.pending) return false;
        const didMove = state.moved;
        suppressClickRef.current = didMove;
        state.active = false;
        state.pending = false;
        state.moved = false;
        setIsDragging(false);
        railRef.current?.releasePointerCapture?.(e.pointerId);
        return didMove;
    }, []);

    const onPointerUp = useCallback(
        (e) => {
            const moved = endDrag(e);
            if (moved && onScrollSettle && railRef.current) {
                setTimeout(() => onScrollSettle(railRef.current), SCROLL_SETTLE_MS);
            }
        },
        [endDrag, onScrollSettle]
    );

    const onPointerCancel = useCallback(
        (e) => {
            endDrag(e);
        },
        [endDrag]
    );

    const wasDragged = useCallback(() => {
        if (!suppressClickRef.current) return false;
        suppressClickRef.current = false;
        return true;
    }, []);

    const onWheel = useCallback((e) => {
        const el = railRef.current;
        if (!el || el.scrollHeight <= el.clientHeight + 2) return;
        const delta = Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
        if (!delta) return;
        el.scrollTop += delta;
    }, []);

    useEffect(() => {
        const el = railRef.current;
        if (!el || !enabled || !onScrollSettle) return undefined;

        let timer;
        const scheduleSettle = () => {
            clearTimeout(timer);
            timer = setTimeout(() => onScrollSettle(el), SCROLL_SETTLE_MS);
        };

        el.addEventListener('scroll', scheduleSettle, { passive: true });
        if ('onscrollend' in el) {
            el.addEventListener('scrollend', () => onScrollSettle(el), { passive: true });
        }

        return () => {
            clearTimeout(timer);
            el.removeEventListener('scroll', scheduleSettle);
        };
    }, [enabled, onScrollSettle]);

    return {
        railRef,
        isDragging,
        onPointerDown,
        onPointerMove,
        onPointerUp,
        onPointerCancel,
        onWheel,
        wasDragged,
    };
}
