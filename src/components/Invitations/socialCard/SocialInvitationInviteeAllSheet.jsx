import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { FaSearch, FaTimes } from 'react-icons/fa';
import { AppText, AppTextInput } from '../../base';
import './SocialInvitationInviteeAllSheet.css';

export default function SocialInvitationInviteeAllSheet({
  open,
  onClose,
  title,
  searchQuery,
  onSearchQueryChange,
  loading = false,
  emptyMessage,
  children,
}) {
  const { t } = useTranslation();

  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div className="invitee-all-sheet-portal">
      <button
        type="button"
        className="invitee-all-sheet-backdrop"
        aria-label={t('close', 'Close')}
        onClick={onClose}
      />
      <div
        className="invitee-all-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="invitee-all-sheet__grab" aria-hidden />
        <div className="invitee-all-sheet__head">
          <AppText as="h3" className="invitee-all-sheet__title">
            {title}
          </AppText>
          <button
            type="button"
            className="invitee-all-sheet__close"
            onClick={onClose}
            aria-label={t('close', 'Close')}
          >
            <FaTimes aria-hidden />
          </button>
        </div>
        <div className="invitee-all-sheet__search-wrap">
          <AppTextInput
            type="search"
            className="invitee-all-sheet__search"
            placeholder={t('search_friends')}
            value={searchQuery}
            onChange={(e) => onSearchQueryChange?.(e.target.value)}
            autoComplete="off"
            autoFocus
          />
          <FaSearch className="invitee-all-sheet__search-icon" aria-hidden />
        </div>
        <div className="invitee-all-sheet__body">
          {loading ? (
            <AppText as="p" className="invitee-all-sheet__loading">
              {t('loading')}
            </AppText>
          ) : emptyMessage ? (
            <AppText as="p" className="invitee-all-sheet__empty">
              {emptyMessage}
            </AppText>
          ) : (
            <div className="invitee-all-sheet__grid">{children}</div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
