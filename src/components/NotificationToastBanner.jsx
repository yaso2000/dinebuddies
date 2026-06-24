import React, { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaBookmark, FaTimes } from 'react-icons/fa';
import { AppText } from "./base";

const SWIPE_SAVE_PX = 56;
const AXIS_LOCK = 8;

/**
 * Foreground in-app notification banner — swipe left to keep before auto-dismiss.
 */
export default function NotificationToastBanner({ toast, onNavigate, onPin, onDismiss }) {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.dir() === 'rtl';
  const dragRef = useRef({ startX: 0, startY: 0, active: false, axis: null });
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);

  const { message, pinned, onClick } = toast;
  const maxReveal = 72;

  const finishSwipe = useCallback(
    (currentOffset) => {
      const shouldPin =
      !pinned && (
      isRtl ? currentOffset >= SWIPE_SAVE_PX : currentOffset <= -SWIPE_SAVE_PX);

      if (shouldPin) {
        onPin(toast.id);
      }
      setOffset(0);
      setDragging(false);
      dragRef.current.active = false;
      dragRef.current.axis = null;
    },
    [isRtl, onPin, pinned, toast.id]
  );

  const onPointerDown = (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      active: true,
      axis: null
    };
    setDragging(true);
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e) => {
    if (!dragRef.current.active) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;

    if (!dragRef.current.axis) {
      if (Math.abs(dx) < AXIS_LOCK && Math.abs(dy) < AXIS_LOCK) return;
      dragRef.current.axis = Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y';
      if (dragRef.current.axis === 'y') {
        dragRef.current.active = false;
        setDragging(false);
        return;
      }
    }
    if (dragRef.current.axis !== 'x') return;

    const nextOffset = isRtl ?
    Math.max(0, Math.min(maxReveal, dx)) :
    Math.max(-maxReveal, Math.min(0, dx));
    setOffset(nextOffset);
  };

  const onPointerUp = (e) => {
    if (!dragRef.current.active) return;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    finishSwipe(offset);
  };

  const handleTap = () => {
    if (dragging || Math.abs(offset) > 10) return;
    onClick?.();
    onNavigate?.();
    message.onClick?.();
  };

  const transform = `translate3d(${offset}px,0,0)`;

  return (
    <div
      className={`notification-toast${pinned ? ' notification-toast--pinned' : ''}${
      dragging ? ' notification-toast--dragging' : ''}`
      }
      role="alert">
      
            {!pinned ?
      <div
        className="notification-toast__save-hint"
        aria-hidden={Math.abs(offset) < 8}
        style={{ opacity: Math.min(1, Math.abs(offset) / 40) }}>
        
                    <FaBookmark />
                    <AppText as="span">{t('notification_toast_keep', 'Keep')}</AppText>
                </div> :
      null}
            <div
        className="notification-toast__panel"
        style={{ transform }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => finishSwipe(offset)}
        onClick={handleTap}>
        
                {message.icon ?
        <img
          src={message.icon}
          alt=""
          className="notification-toast__avatar"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }} /> :

        null}
                <div className="notification-toast__copy">
                    <AppText as="h4" className="notification-toast__title">
                        {pinned ?
            <AppText as="span" className="notification-toast__saved-badge">
                                {t('notification_toast_saved', 'Saved')}
                            </AppText> :
            null}
                        {message.title || t('new_notification', 'New Notification')}
                    </AppText>
                    <AppText as="p" className="notification-toast__body">{message.body || message.text}</AppText>
                    {!pinned ?
          <AppText as="p" className="notification-toast__hint">
                            {t('notification_toast_swipe_hint', 'Swipe left to keep')}
                        </AppText> :
          null}
                </div>
                {pinned ?
        <button
          type="button"
          className="notification-toast__close"
          aria-label={t('close', 'Close')}
          onClick={(e) => {
            e.stopPropagation();
            onDismiss(toast.id);
          }}>
          
                        <FaTimes />
                    </button> :
        null}
            </div>
        </div>);

}