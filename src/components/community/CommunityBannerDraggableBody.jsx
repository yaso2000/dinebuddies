import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaTrash } from 'react-icons/fa';
import { AppText } from '../base';
import {
  DEFAULT_BANNER_TEXT_POS,
  clampBannerDraggablePosition,
  isBannerBodyLinkSlot,
  resolveBannerBodyInlineStyle,
  resolveBannerButtonInlineStyle,
  sanitizeBannerLinkUrl,
  sanitizeBannerTextMaxWidth,
} from '../../utils/communityChatBanner';
import { useExternalLinkGuard } from '../../context/ExternalLinkGuardContext';
import { classifyChatLink } from '../../utils/chatLinkSafety';

const DRAG_THRESHOLD_PX = 8;

/** Absolute href for native fallback / accessibility. */
function toAbsoluteHref(url) {
  if (!url || typeof window === 'undefined') return url;
  try {
    return new URL(url, window.location.origin).href;
  } catch {
    return url;
  }
}

/** Draggable banner body text or link-button — host can drag within the body zone. */
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
  const { requestOpenLink } = useExternalLinkGuard();
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

  const rawLinkUrl = isBannerBodyLinkSlot(slotStyle) ? sanitizeBannerLinkUrl(slotStyle?.url) : '';
  const linkInfo = rawLinkUrl ? classifyChatLink(rawLinkUrl) : null;
  const linkUrl = linkInfo && linkInfo.kind !== 'blocked' ? rawLinkUrl : '';
  const isLink = Boolean(linkUrl);
  const absoluteHref = isLink ? toAbsoluteHref(linkUrl) : '';

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

  const openLink = useCallback(() => {
    if (!linkUrl) return;
    requestOpenLink(linkUrl);
  }, [linkUrl, requestOpenLink]);

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

      // Host tap opens in a new tab (drag still repositions).
      if (isLink) {
        openLink();
        return;
      }

      if (editable) {
        setSelected((prev) => !prev);
      }
    },
    [editable, isLink, onPositionChange, openLink]
  );

  const handleLinkClick = (event) => {
    event.preventDefault();
    // Host already opens via pointerup — avoid a second navigation.
    if (editable) return;
    openLink();
  };

  const handleDelete = (event) => {
    event.stopPropagation();
    setSelected(false);
    void onDelete?.();
  };

  if (!text) return null;
  if (isBannerBodyLinkSlot(slotStyle) && !linkUrl) return null;

  const maxWidthPct = sanitizeBannerTextMaxWidth(slotStyle?.maxWidth);
  const labelStyle = isLink
    ? resolveBannerButtonInlineStyle(slotStyle)
    : resolveBannerBodyInlineStyle(slotStyle);

  return (
    <div
      ref={rootRef}
      className={`community-banner-draggable-body${editable ? ' community-banner-draggable-body--editable' : ''}${selected ? ' community-banner-draggable-body--selected' : ''}${dragging ? ' community-banner-draggable-body--dragging' : ''}${isLink ? ' community-banner-draggable-body--link' : ''}`}
      style={{
        left: `${localPos.x}%`,
        top: `${localPos.y}%`,
        maxWidth: `${maxWidthPct}%`,
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      role={editable && !isLink ? 'button' : undefined}
      tabIndex={editable && !isLink ? 0 : undefined}
      aria-label={isLink ? undefined : t('community_banner_body_tool', 'Banner text')}
    >
      {isLink ? (
        <a
          className="community-banner-draggable-body__link-btn"
          href={absoluteHref}
          target="_blank"
          rel="noopener noreferrer"
          style={labelStyle}
          onClick={handleLinkClick}
          aria-label={t('community_banner_body_link_open', 'Open link: {{label}}', { label: text })}
        >
          {text}
        </a>
      ) : (
        <AppText as="p" className="community-banner-draggable-body__text" style={labelStyle}>
          {text}
        </AppText>
      )}
      {editable && selected && !isLink ? (
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
