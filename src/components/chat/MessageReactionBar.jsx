import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { FaPlus } from 'react-icons/fa';
import './MessageReactionBar.css';

const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

/**
 * Floating quick-reaction row shown above a bubble on long-press.
 * @param {{ open: boolean, anchorRect: DOMRect|null, onSelectEmoji: (emoji: string) => void, onMore: () => void, onClose: () => void }} props
 */
export default function MessageReactionBar({ open, anchorRect, onSelectEmoji, onMore, onClose }) {
  const { t } = useTranslation();
  const barRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onOutside = (event) => {
      if (barRef.current && !barRef.current.contains(event.target)) onClose?.();
    };
    document.addEventListener('pointerdown', onOutside);
    return () => document.removeEventListener('pointerdown', onOutside);
  }, [open, onClose]);

  if (!open || !anchorRect || typeof document === 'undefined') return null;

  const BAR_WIDTH = 260;
  const top = Math.max(8, anchorRect.top - 56);
  const left = Math.min(
    window.innerWidth - BAR_WIDTH - 8,
    Math.max(8, anchorRect.left + anchorRect.width / 2 - BAR_WIDTH / 2)
  );

  return createPortal(
    <div ref={barRef} className="message-reaction-bar" style={{ top, left }} role="menu">
      {QUICK_EMOJIS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          className="message-reaction-bar__emoji"
          onClick={() => {
            onSelectEmoji?.(emoji);
            onClose?.();
          }}
        >
          {emoji}
        </button>
      ))}
      {onMore ? (
        <button
          type="button"
          className="message-reaction-bar__more"
          aria-label={t('more', 'More')}
          onClick={() => {
            onMore?.();
          }}
        >
          <FaPlus />
        </button>
      ) : null}
    </div>,
    document.body
  );
}
