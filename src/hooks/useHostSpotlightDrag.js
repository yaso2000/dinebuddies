import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
    clampHostSpotlightPercent,
    resolveHostSpotlightPosition,
} from '../utils/communityHostSpotlightPosition';

const DRAG_THRESHOLD_PX = 8;

/**
 * Drag host spotlight bubble within banner safe margins and below title when present.
 */
export function useHostSpotlightDrag({
    message,
    hasTitle,
    editable,
    onPositionChange,
    selected = false,
    onSelectChange,
}) {
    const anchorRef = useRef(null);
    const bannerRef = useRef(null);
    const posRef = useRef(resolveHostSpotlightPosition(message, hasTitle));
    const dragRef = useRef({
        active: false,
        moved: false,
        pointerId: null,
        startX: 0,
        startY: 0,
        originX: 0,
        originY: 0,
    });

    const [localPos, setLocalPos] = useState(posRef.current);
    const [dragging, setDragging] = useState(false);

    useEffect(() => {
        const next = resolveHostSpotlightPosition(message, hasTitle);
        posRef.current = next;
        setLocalPos(next);
    }, [message?.id, message?.spotlightX, message?.spotlightY, hasTitle]);

    const measureContext = useCallback(() => {
        const bannerEl =
            bannerRef.current || anchorRef.current?.closest('.community-main-chat__banner-wrap');
        const bubbleEl = anchorRef.current;
        if (!bannerEl || !bubbleEl) return null;

        bannerRef.current = bannerEl;
        const bannerRect = bannerEl.getBoundingClientRect();
        const bubbleRect = bubbleEl.getBoundingClientRect();
        const titleEl = bannerEl.querySelector('.community-banner-draggable-title');
        const titleRect = titleEl?.getBoundingClientRect?.() || null;

        return { bannerRect, bubbleRect, titleRect };
    }, []);

    const applyClampedPosition = useCallback(
        (x, y) => {
            const ctx = measureContext();
            if (!ctx) {
                const next = { x, y };
                posRef.current = next;
                setLocalPos(next);
                return next;
            }

            const next = clampHostSpotlightPercent(
                x,
                y,
                ctx.bannerRect,
                ctx.bubbleRect,
                ctx.titleRect,
                editable,
                hasTitle
            );
            posRef.current = next;
            setLocalPos(next);
            return next;
        },
        [editable, measureContext]
    );

    useLayoutEffect(() => {
        if (!message?.id) return;
        applyClampedPosition(posRef.current.x, posRef.current.y);
    }, [message?.id, hasTitle, editable, applyClampedPosition]);

    useEffect(() => {
        const el = anchorRef.current;
        if (!el || !message?.id) return undefined;

        const ro = new ResizeObserver(() => {
            applyClampedPosition(posRef.current.x, posRef.current.y);
        });
        ro.observe(el);
        return () => ro.disconnect();
    }, [message?.id, applyClampedPosition]);

    useEffect(() => {
        if (!message?.id) return undefined;
        const onResize = () => {
            applyClampedPosition(posRef.current.x, posRef.current.y);
        };
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, [message?.id, applyClampedPosition]);

    const handlePointerDown = useCallback(
        (event) => {
            if (!editable || !message?.id) return;
            if (event.target.closest('.community-host-banner-messages__actions, audio, button, input, a, textarea')) return;

            const bannerEl = anchorRef.current?.closest('.community-main-chat__banner-wrap');
            if (!bannerEl) return;

            bannerRef.current = bannerEl;
            dragRef.current = {
                active: true,
                moved: false,
                pointerId: event.pointerId,
                startX: event.clientX,
                startY: event.clientY,
                originX: posRef.current.x,
                originY: posRef.current.y,
            };
            event.currentTarget.setPointerCapture(event.pointerId);
        },
        [editable, message?.id]
    );

    const handlePointerMove = useCallback(
        (event) => {
            const drag = dragRef.current;
            if (!drag.active || drag.pointerId !== event.pointerId) return;

            const dx = event.clientX - drag.startX;
            const dy = event.clientY - drag.startY;
            if (!drag.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;

            drag.moved = true;
            onSelectChange?.('clear');
            setDragging(true);

            const ctx = measureContext();
            if (!ctx?.bannerRect?.width) return;

            const nextX = drag.originX + (dx / ctx.bannerRect.width) * 100;
            const nextY = drag.originY + (dy / ctx.bannerRect.height) * 100;
            applyClampedPosition(nextX, nextY);
        },
        [applyClampedPosition, measureContext]
    );

    const handlePointerUp = useCallback(
        (event) => {
            const drag = dragRef.current;
            if (!drag.active || drag.pointerId !== event.pointerId) return;

            drag.active = false;
            event.currentTarget.releasePointerCapture(event.pointerId);

            if (drag.moved) {
                drag.moved = false;
                setDragging(false);
                void onPositionChange?.(message.id, posRef.current.x, posRef.current.y);
                return;
            }

            if (editable) {
                onSelectChange?.('toggle');
            }
        },
        [editable, message?.id, onPositionChange, onSelectChange]
    );

    return {
        anchorRef,
        localPos,
        selected,
        dragging,
        handlePointerDown,
        handlePointerMove,
        handlePointerUp,
    };
}
