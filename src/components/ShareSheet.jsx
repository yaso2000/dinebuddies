import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AppText } from './base';
import './ShareSheet.css';

/**
 * One share surface for the whole app — posts, stories, invitations, business
 * profiles.
 *
 * Portaled to document.body as a bottom sheet: the old inline modals used
 * position:fixed from inside the card that opened them, and any transformed
 * ancestor (feed animations, swipe decks) re-anchors fixed positioning to
 * itself — which is how the share box could end up half off-screen or hidden.
 * From the body it cannot be clipped, moved, or covered by its opener.
 */
export default function ShareSheet({ open, title, onClose, children }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="share-sheet-overlay"
      role="presentation"
      onClick={(event) => {
        event.stopPropagation();
        if (event.target === event.currentTarget) onClose?.();
      }}
    >
      <div
        className="share-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <span className="share-sheet__grabber" aria-hidden />
        <AppText as="h3" className="share-sheet__title">
          {title}
        </AppText>
        <div className="share-sheet__body">{children}</div>
        <button type="button" className="share-sheet__close" onClick={() => onClose?.()}>
          ✕
        </button>
      </div>
    </div>,
    document.body
  );
}
