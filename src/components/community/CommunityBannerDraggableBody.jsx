import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaTrash } from 'react-icons/fa';
import { AppText } from '../base';
import {
  DEFAULT_BANNER_TEXT_POS,
  clampBannerDraggablePosition,
  isBannerBodyLinkSlot,
  resolveBannerBodyInlineStyle,
  sanitizeBannerTextMaxWidth,
} from '../../utils/communityChatBanner';

const DRAG_THRESHOLD_PX = 8;
const KEYBOARD_NUDGE_PERCENT = 1;

/** Draggable banner body text — host can drag within the body zone. */
export default function CommunityBannerDraggableBody({
  text,
  slotStyle,
  x,
  y,
  editable,
  hasTitleZone = true,
  onPositionChange,
  onDelete,
}) {
  const { t } = useTranslation();
  const rootRef = useRef(null);
  const bannerRef = useRef(null);
  const posRef = useRef({
    x: x ?? DEFAULT_BANNER_TEXT_POS.x,
    y: y ?? DEFAULT_BANNER_TEXT_POS.y,
  });
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
  const [selected, setSelected] = useState(false);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    const next = {
      x: x ?? DEFAULT_BANNER_TEXT_POS.x,
      y: y ?? DEFAULT_BANNER_TEXT_POS.y,
    };
    posRef.current = next;
    setLocalPos(next);
  }, [x, y]);

  const measureContext = useCallback(() => {
    const bannerEl =
      bannerRef.current || rootRef.current?.closest('.community-main-chat__banner-wrap');
    const elementEl = rootRef.current;
    if (!bannerEl || !elementEl) return null;

    bannerRef.current = bannerEl;
    return {
      bannerRect: bannerEl.getBoundingClientRect(),
      elementRect: elementEl.getBoundingClientRect(),
    };
  }, []);

  const dragZone = hasTitleZone ? 'text' : 'full';

  const applyClampedPosition = useCallback((nextX, nextY) => {
    const ctx = measureContext();
    const next = clampBannerDraggablePosition({
      zone: dragZone,
      x: nextX,
      y: nextY,
      bannerRect: ctx?.bannerRect,
      elementRect: ctx?.elementRect,
    });
    posRef.current = next;
    setLocalPos(next);
    return next;
  }, [dragZone, measureContext]);

  useLayoutEffect(() => {
    if (!text) return;
    applyClampedPosition(posRef.current.x, posRef.current.y);
  }, [text, applyClampedPosition]);

  useEffect(() => {
    const el = rootRef.current;
    if (!el || !text) return undefined;

    const ro = new ResizeObserver(() => {
      applyClampedPosition(posRef.current.x, posRef.current.y);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [text, applyClampedPosition]);

  useEffect(() => {
    if (!text) return undefined;
    const onResize = () => {
      applyClampedPosition(posRef.current.x, posRef.current.y);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [text, applyClampedPosition]);

  useEffect(() => {
    if (!editable || !selected) return undefined;
    const onOutside = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setSelected(false);
      }
    };
    document.addEventListener('pointerdown', onOutside);
    return () => document.removeEventListener('pointerdown', onOutside);
  }, [editable, selected]);

  const handlePointerDown = useCallback(
    (event) => {
      if (!editable) return;
      const bannerEl = rootRef.current?.closest('.community-main-chat__banner-wrap');
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
    [editable]
  );

  const handlePointerMove = useCallback(
    (event) => {
      const drag = dragRef.current;
      if (!drag.active || drag.pointerId !== event.pointerId) return;

      const dx = event.clientX - drag.startX;
      const dy = event.clientY - drag.startY;
      if (!drag.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;

      drag.moved = true;
      setSelected(false);
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
        void onPositionChange?.(posRef.current.x, posRef.current.y);
        return;
      }

      if (editable) {
        setSelected((prev) => !prev);
      }
    },
    [editable, onPositionChange]
  );

  const handleDelete = (event) => {
    event.stopPropagation();
    setSelected(false);
    void onDelete?.();
  };

  const handleKeyDown = useCallback(
    (event) => {
      if (!editable) return;
      switch (event.key) {
        case 'ArrowUp':
        case 'ArrowDown':
        case 'ArrowLeft':
        case 'ArrowRight': {
          event.preventDefault();
          const dx = event.key === 'ArrowLeft' ? -KEYBOARD_NUDGE_PERCENT : event.key === 'ArrowRight' ? KEYBOARD_NUDGE_PERCENT : 0;
          const dy = event.key === 'ArrowUp' ? -KEYBOARD_NUDGE_PERCENT : event.key === 'ArrowDown' ? KEYBOARD_NUDGE_PERCENT : 0;
          const next = applyClampedPosition(posRef.current.x + dx, posRef.current.y + dy);
          void onPositionChange?.(next.x, next.y);
          break;
        }
        case 'Enter':
        case ' ':
          event.preventDefault();
          setSelected((prev) => !prev);
          break;
        case 'Delete':
        case 'Backspace':
          event.preventDefault();
          setSelected(false);
          void onDelete?.();
          break;
        default:
          break;
      }
    },
    [editable, applyClampedPosition, onPositionChange, onDelete]
  );

  if (!text) return null;
  // External link CTA buttons are disabled — never render them.
  if (isBannerBodyLinkSlot(slotStyle)) return null;

  const maxWidthPct = sanitizeBannerTextMaxWidth(slotStyle?.maxWidth);
  const labelStyle = resolveBannerBodyInlineStyle(slotStyle);

  return (
    <div
      ref={rootRef}
      className={`community-banner-draggable-body${editable ? ' community-banner-draggable-body--editable' : ''}${selected ? ' community-banner-draggable-body--selected' : ''}${dragging ? ' community-banner-draggable-body--dragging' : ''}`}
      style={{
        left: `${localPos.x}%`,
        top: `${localPos.y}%`,
        maxWidth: `${maxWidthPct}%`,
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onKeyDown={handleKeyDown}
      role={editable ? 'button' : undefined}
      tabIndex={editable ? 0 : undefined}
      aria-label={t('community_banner_body_tool', 'Banner text')}
    >
      <AppText as="p" className="community-banner-draggable-body__text" style={labelStyle}>
        {text}
      </AppText>
      {editable && selected ? (
        <button
          type="button"
          className="community-banner-draggable-body__delete"
          aria-label={t('community_banner_delete_body', 'Delete text')}
          title={t('community_banner_delete_body', 'Delete text')}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={handleDelete}
        >
          <FaTrash size={14} />
        </button>
      ) : null}
    </div>
  );
}
