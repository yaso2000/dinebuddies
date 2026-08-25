import React from 'react';
import { useTranslation } from 'react-i18next';
import { FaCamera, FaTimes, FaHeart } from 'react-icons/fa';
import './PrivateChatTopPanels.css';

/**
 * Two side-by-side banner panels above a private 1:1 chat header — one per
 * participant, defaulting to that participant's profile photo. Only the
 * viewer's own panel is editable (swap for a custom image, or reset back to
 * the profile photo); the other participant's panel is read-only here.
 *
 * Wrapped in dir="ltr" to keep "my" panel on the physical right, matching the
 * same convention already used for the message bubbles in this chat.
 */
export default function PrivateChatTopPanels({
  myImageUrl,
  theirImageUrl,
  myAlt = '',
  theirAlt = '',
  hasCustomMyImage = false,
  onEditMyPanel,
  onResetMyPanel,
  connectionKind,
  relationshipBadge,
  compat,
  onOpenCompat,
}) {
  const { t } = useTranslation();

  const compatPhase = compat?.phase || 'none';
  const compatLabel =
    compatPhase === 'completed' ? `${compat?.compatPct ?? 0}%`
      : compatPhase === 'failed' ? t('compat_center_retry', 'Replay')
        : compatPhase === 'active' ? t('compat_lvl_of', 'Lvl {{n}}/5', { n: compat?.level || 1 })
          : t('compat_center_start', 'Play');

  return (
    <div className="private-chat-top-panels" dir="ltr">
      <div className="private-chat-top-panels__panel private-chat-top-panels__panel--other">
        {theirImageUrl ? (
          <img src={theirImageUrl} alt={theirAlt} className="private-chat-top-panels__img" />
        ) : (
          <div className="private-chat-top-panels__img private-chat-top-panels__img--fallback" />
        )}
      </div>
      {onOpenCompat ? (
        <button
          type="button"
          onClick={onOpenCompat}
          className="private-chat-top-panels__link"
          title={t('compat_title', 'Compatibility Journey')}
          aria-label={t('compat_title', 'Compatibility Journey')}
          style={{
            border: 'none', cursor: 'pointer', background: 'rgba(0,0,0,0.6)',
            borderRadius: 16, padding: '6px 12px', display: 'flex', flexDirection: 'column',
            alignItems: 'center', gap: 1, minWidth: 64,
            boxShadow: '0 2px 12px rgba(236,72,153,0.55)',
            pointerEvents: 'auto', // the shared __link class sets pointer-events:none
          }}
        >
          <FaHeart style={{ color: '#ec4899', fontSize: 18, filter: compatPhase === 'completed' ? 'drop-shadow(0 0 5px rgba(236,72,153,0.8))' : 'none' }} />
          <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#fff', whiteSpace: 'nowrap' }}>{compatLabel}</span>
        </button>
      ) : relationshipBadge ? (
        <div
          className={`private-chat-top-panels__link private-chat-top-panels__link--${connectionKind}`}
          title={t(relationshipBadge.labelKey, relationshipBadge.label)}
        >
          <span className="private-chat-top-panels__link-icon" aria-hidden>
            <relationshipBadge.icon size={16} />
          </span>
          <span className="private-chat-top-panels__link-label">
            {t(relationshipBadge.labelKey, relationshipBadge.label)}
          </span>
        </div>
      ) : null}
      <div
        className="private-chat-top-panels__panel private-chat-top-panels__panel--mine"
        onClick={onEditMyPanel}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onEditMyPanel?.();
          }
        }}
        aria-label={t('chat_panel_change_photo', 'Change your chat photo')}
        title={t('chat_panel_change_photo', 'Change your chat photo')}
      >
        {myImageUrl ? (
          <img src={myImageUrl} alt={myAlt} className="private-chat-top-panels__img" />
        ) : (
          <div className="private-chat-top-panels__img private-chat-top-panels__img--fallback" />
        )}
        <span className="private-chat-top-panels__edit-badge" aria-hidden>
          <FaCamera size={13} />
        </span>
        {hasCustomMyImage ? (
          <button
            type="button"
            className="private-chat-top-panels__reset-btn"
            onClick={(e) => {
              e.stopPropagation();
              onResetMyPanel?.();
            }}
            aria-label={t('chat_panel_reset_photo', 'Use profile photo')}
            title={t('chat_panel_reset_photo', 'Use profile photo')}
          >
            <FaTimes size={11} />
          </button>
        ) : null}
      </div>
    </div>
  );
}
