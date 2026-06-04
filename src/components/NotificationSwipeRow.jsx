import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

const ACTION_WIDTH = 80;
const ACTION_COUNT = 3;
const OPEN_SNAP_RATIO = 0.28;
const AXIS_LOCK_PX = 8;

/**
 * TikTok-style row: opaque card covers the row; actions are pinned to the physical
 * right edge. Swipe left slides the card off to reveal Delete / Report / Mute.
 * `direction: ltr` on the row keeps geometry correct in Arabic (RTL) UI.
 */
export default function NotificationSwipeRow({
    rowId,
    isOpen,
    onOpenChange,
    onDelete,
    onReport,
    onMute,
    children,
    className = '',
}) {
    const { t } = useTranslation();
    const slideRef = useRef(null);
    const offsetRef = useRef(0);
    const dragRef = useRef({
        active: false,
        startX: 0,
        startY: 0,
        startOffset: 0,
        axis: null,
        moved: false,
    });

    const maxOffset = ACTION_WIDTH * ACTION_COUNT;
    const [offset, setOffset] = useState(0);
    const [dragging, setDragging] = useState(false);

    const syncOffset = useCallback(
        (value) => {
            const next = Math.max(0, Math.min(maxOffset, value));
            offsetRef.current = next;
            setOffset(next);
        },
        [maxOffset]
    );

    useEffect(() => {
        syncOffset(isOpen ? maxOffset : 0);
    }, [isOpen, maxOffset, syncOffset]);

    /** Finger moves left (negative Δx) → slide card left, reveal actions on the right. */
    const revealFromDelta = useCallback((deltaX) => {
        return dragRef.current.startOffset - deltaX;
    }, []);

    const finishDrag = useCallback(() => {
        const current = offsetRef.current;
        const shouldOpen = current > maxOffset * OPEN_SNAP_RATIO;
        const next = shouldOpen ? maxOffset : 0;
        syncOffset(next);
        onOpenChange?.(shouldOpen);
        dragRef.current.active = false;
        dragRef.current.axis = null;
        setDragging(false);
    }, [maxOffset, onOpenChange, syncOffset]);

    const beginDrag = useCallback((clientX, clientY) => {
        dragRef.current = {
            active: true,
            startX: clientX,
            startY: clientY,
            startOffset: offsetRef.current,
            axis: null,
            moved: false,
        };
        setDragging(true);
    }, []);

    const moveDrag = useCallback(
        (clientX, clientY, preventScroll) => {
            if (!dragRef.current.active) return;
            const dx = clientX - dragRef.current.startX;
            const dy = clientY - dragRef.current.startY;

            if (!dragRef.current.axis) {
                if (Math.abs(dx) < AXIS_LOCK_PX && Math.abs(dy) < AXIS_LOCK_PX) return;
                dragRef.current.axis = Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y';
                if (dragRef.current.axis === 'y') {
                    dragRef.current.active = false;
                    setDragging(false);
                    return;
                }
            }

            if (dragRef.current.axis !== 'x') return;

            if (Math.abs(dx) > AXIS_LOCK_PX) dragRef.current.moved = true;
            preventScroll?.();
            syncOffset(revealFromDelta(dx));
        },
        [revealFromDelta, syncOffset]
    );

    const endDrag = useCallback(() => {
        if (!dragRef.current.active) return;
        finishDrag();
    }, [finishDrag]);

    useEffect(() => {
        const el = slideRef.current;
        if (!el) return undefined;

        const onTouchMove = (e) => {
            if (dragRef.current.axis === 'x') e.preventDefault();
            moveDrag(e.touches[0].clientX, e.touches[0].clientY, () => e.preventDefault());
        };

        el.addEventListener('touchmove', onTouchMove, { passive: false });
        return () => el.removeEventListener('touchmove', onTouchMove);
    }, [moveDrag]);

    const onPointerDown = (e) => {
        if (e.button !== undefined && e.button !== 0) return;
        beginDrag(e.clientX, e.clientY);
        slideRef.current?.setPointerCapture?.(e.pointerId);
    };

    const onPointerMove = (e) => {
        if (!dragRef.current.active) return;
        moveDrag(e.clientX, e.clientY);
    };

    const onPointerUp = (e) => {
        if (!dragRef.current.active) return;
        slideRef.current?.releasePointerCapture?.(e.pointerId);
        endDrag();
    };

    const onPointerCancel = () => {
        endDrag();
    };

    const handleAction = (action) => (e) => {
        e.stopPropagation();
        e.preventDefault();
        syncOffset(0);
        onOpenChange?.(false);
        action?.();
    };

    const handleFrontClick = (e) => {
        if (dragRef.current.moved) {
            dragRef.current.moved = false;
            e.stopPropagation();
            e.preventDefault();
        }
    };

    const actionsVisible = offset > 0;
    const slideTransform = `translate3d(-${offset}px, 0, 0)`;

    return (
        <div
            className={`notification-swipe${isOpen ? ' notification-swipe--open' : ''}${
                dragging ? ' notification-swipe--dragging' : ''
            }`}
            data-notif-id={rowId}
            style={{ '--swipe-actions-width': `${maxOffset}px` }}
        >
            <div
                className="notification-swipe__actions"
                aria-hidden={!actionsVisible}
            >
                <button
                    type="button"
                    className="notification-swipe__action notification-swipe__action--delete"
                    tabIndex={actionsVisible ? 0 : -1}
                    onClick={handleAction(onDelete)}
                >
                    {t('delete', 'Delete')}
                </button>
                <button
                    type="button"
                    className="notification-swipe__action notification-swipe__action--report"
                    tabIndex={actionsVisible ? 0 : -1}
                    onClick={handleAction(onReport)}
                >
                    {t('profile_action_report', 'Report')}
                </button>
                <button
                    type="button"
                    className="notification-swipe__action notification-swipe__action--mute"
                    tabIndex={actionsVisible ? 0 : -1}
                    onClick={handleAction(onMute)}
                >
                    {t('mute_user', 'Mute')}
                </button>
            </div>
            <div
                ref={slideRef}
                className="notification-swipe__slide"
                style={{ transform: slideTransform }}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerCancel}
            >
                <div
                    className={`notification-swipe__front ui-card ${className}`.trim()}
                    onClick={handleFrontClick}
                >
                    {children}
                </div>
            </div>
        </div>
    );
}
