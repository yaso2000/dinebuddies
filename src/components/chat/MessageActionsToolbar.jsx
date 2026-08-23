import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FaArrowLeft,
  FaEllipsisV,
  FaReply,
  FaShare,
  FaStar,
  FaRegStar,
  FaTrash,
  FaCopy,
} from 'react-icons/fa';
import './MessageActionsToolbar.css';

/**
 * WhatsApp-style selection toolbar — rendered by a page in place of its
 * normal header while exactly one message is selected (long-pressed).
 *
 * @param {{
 *   onBack: () => void,
 *   selectedCount?: number,
 *   canReply?: boolean, onReply?: () => void,
 *   isStarred?: boolean, onToggleStar?: () => void,
 *   canDelete?: boolean, onDelete?: () => void,
 *   canForward?: boolean, onForward?: () => void,
 *   onCopy?: () => void,
 *   moreActions?: Array<{ key: string, label: string, onClick: () => void }>,
 * }} props
 */
export default function MessageActionsToolbar({
  onBack,
  selectedCount = 1,
  canReply = false,
  onReply,
  isStarred = false,
  onToggleStar,
  canDelete = false,
  onDelete,
  canForward = false,
  onForward,
  onCopy,
  moreActions = [],
}) {
  const { t } = useTranslation();
  const [showMore, setShowMore] = useState(false);
  const moreRef = useRef(null);

  useEffect(() => {
    if (!showMore) return undefined;
    const onDocClick = (event) => {
      if (!moreRef.current?.contains(event.target)) setShowMore(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [showMore]);

  const hasMore = onCopy || moreActions.length > 0;

  return (
    <div className="message-actions-toolbar">
      <button
        type="button"
        className="message-actions-toolbar__back"
        onClick={onBack}
        aria-label={t('back', 'Back')}
      >
        <FaArrowLeft style={{ transform: 'rotate(180deg)' }} />
      </button>

      <span className="message-actions-toolbar__count">{selectedCount}</span>

      <div className="message-actions-toolbar__spacer" />

      {canReply ? (
        <button
          type="button"
          className="message-actions-toolbar__icon-btn"
          onClick={onReply}
          aria-label={t('reply', 'Reply')}
          title={t('reply', 'Reply')}
        >
          <FaReply />
        </button>
      ) : null}

      {onToggleStar ? (
        <button
          type="button"
          className="message-actions-toolbar__icon-btn"
          onClick={onToggleStar}
          aria-label={t('star', 'Star')}
          title={t('star', 'Star')}
        >
          {isStarred ? <FaStar className="message-actions-toolbar__star-filled" /> : <FaRegStar />}
        </button>
      ) : null}

      {canDelete ? (
        <button
          type="button"
          className="message-actions-toolbar__icon-btn"
          onClick={onDelete}
          aria-label={t('delete', 'Delete')}
          title={t('delete', 'Delete')}
        >
          <FaTrash />
        </button>
      ) : null}

      {canForward ? (
        <button
          type="button"
          className="message-actions-toolbar__icon-btn"
          onClick={onForward}
          aria-label={t('forward', 'Forward')}
          title={t('forward', 'Forward')}
        >
          <FaShare />
        </button>
      ) : null}

      {hasMore ? (
        <div className="message-actions-toolbar__more" ref={moreRef}>
          <button
            type="button"
            className="message-actions-toolbar__icon-btn"
            onClick={() => setShowMore((v) => !v)}
            aria-label={t('more_options', 'More options')}
            title={t('more_options', 'More options')}
          >
            <FaEllipsisV />
          </button>
          {showMore ? (
            <div className="message-actions-toolbar__more-menu">
              {onCopy ? (
                <button
                  type="button"
                  onClick={() => {
                    setShowMore(false);
                    onCopy();
                  }}
                >
                  <FaCopy aria-hidden />
                  {t('copy', 'Copy')}
                </button>
              ) : null}
              {moreActions.map((action) => (
                <button
                  key={action.key}
                  type="button"
                  onClick={() => {
                    setShowMore(false);
                    action.onClick();
                  }}
                >
                  {action.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
