import { useCallback, useRef, useState } from 'react';

const DRAG_THRESHOLD_PX = 5;

/** Horizontal drag-to-scroll + wheel for carousel rails (touch + desktop mouse). */
export function useDragScrollRail() {
    const railRef = useRef(null);
    const dragRef = useRef({
        active: false,
        pending: false,
        startX: 0,
        scrollLeft: 0,
        moved: false,
    });
    const suppressClickRef = useRef(false);
    const [isDragging, setIsDragging] = useState(false);

    const onPointerDown = useCallback((e) => {
        const el = railRef.current;
        if (!el || e.button > 0) return;

        /* Touch: rely on native overflow scrolling so vertical page scroll is not blocked. */
        if (e.pointerType !== 'mouse') return;

        const onChip = Boolean(e.target.closest('button, [role="option"]'));

        dragRef.current = {
            active: !onChip,
            pending: onChip,
            startX: e.clientX,
            scrollLeft: el.scrollLeft,
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
            const dx = e.clientX - state.startX;
            if (Math.abs(dx) <= DRAG_THRESHOLD_PX) return;
            state.pending = false;
            state.active = true;
            setIsDragging(true);
            el.setPointerCapture?.(e.pointerId);
        }

        if (!state.active) return;

        const dx = e.clientX - state.startX;
        if (Math.abs(dx) > DRAG_THRESHOLD_PX) state.moved = true;
        el.scrollLeft = state.scrollLeft - dx;
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
            endDrag(e);
        },
        [endDrag]
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
        if (!el || el.scrollWidth <= el.clientWidth + 2) return;
        const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
        if (!delta) return;
        el.scrollLeft += delta;
    }, []);

    const scrollItemIntoView = useCallback((node) => {
        const rail = railRef.current;
        if (!rail || !node) return;
        const railRect = rail.getBoundingClientRect();
        const nodeRect = node.getBoundingClientRect();
        if (nodeRect.left < railRect.left) {
            rail.scrollLeft -= railRect.left - nodeRect.left + 12;
        } else if (nodeRect.right > railRect.right) {
            rail.scrollLeft += nodeRect.right - railRect.right + 12;
        }
    }, []);

    return {
        railRef,
        isDragging,
        onPointerDown,
        onPointerMove,
        onPointerUp,
        onPointerCancel,
        onWheel,
        wasDragged,
        scrollItemIntoView,
    };
}
