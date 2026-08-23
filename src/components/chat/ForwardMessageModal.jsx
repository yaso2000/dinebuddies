import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { FaTimes, FaSearch } from 'react-icons/fa';
import { useChat } from '../../context/ChatContext';
import { useToast } from '../../context/ToastContext';
import UserAvatar from '../UserAvatar';
import './ForwardMessageModal.css';

/**
 * Pick one of the user's existing private conversations to forward a
 * message into. Reuses ChatContext's already-loaded conversations list.
 * @param {{ open: boolean, message: object|null, onClose: () => void }} props
 */
export default function ForwardMessageModal({ open, message, onClose }) {
  const { t } = useTranslation();
  const { conversations, sendMessage } = useChat();
  const { showToast } = useToast();
  const [query, setQuery] = useState('');
  const [sendingTo, setSendingTo] = useState(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const withUser = conversations.filter((c) => c.otherUser?.uid);
    if (!q) return withUser;
    return withUser.filter((c) => (c.otherUser?.displayName || '').toLowerCase().includes(q));
  }, [conversations, query]);

  if (!open || typeof document === 'undefined') return null;

  const handlePick = async (conversation) => {
    if (!message || sendingTo) return;
    setSendingTo(conversation.id);
    try {
      await sendMessage(conversation.id, {
        type: message.type || 'text',
        text: message.text || '',
        forwardedFrom: true,
      });
      showToast(t('message_forwarded', 'Message forwarded.'), 'success');
      onClose?.();
    } catch (err) {
      console.error('Forward failed:', err);
      showToast(t('forward_failed', 'Could not forward the message.'), 'error');
    } finally {
      setSendingTo(null);
    }
  };

  return createPortal(
    <div
      className="forward-message-modal"
      role="dialog"
      aria-modal="true"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose?.();
      }}
    >
      <div className="forward-message-modal__panel">
        <div className="forward-message-modal__header">
          <span>{t('forward_message_title', 'Forward to…')}</span>
          <button type="button" onClick={() => onClose?.()} aria-label={t('close', 'Close')}>
            <FaTimes />
          </button>
        </div>

        <div className="forward-message-modal__search">
          <FaSearch aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('forward_search_placeholder', 'Search conversations…')}
            autoComplete="off"
          />
        </div>

        <div className="forward-message-modal__list">
          {filtered.length === 0 ? (
            <div className="forward-message-modal__empty">{t('no_results', 'No results')}</div>
          ) : (
            filtered.map((conversation) => (
              <button
                key={conversation.id}
                type="button"
                className="forward-message-modal__row"
                disabled={Boolean(sendingTo)}
                onClick={() => handlePick(conversation)}
              >
                <UserAvatar user={conversation.otherUser} style={{ width: 40, height: 40 }} />
                <span className="forward-message-modal__row-name">
                  {conversation.otherUser?.displayName}
                </span>
                {sendingTo === conversation.id ? (
                  <span className="forward-message-modal__row-status">
                    {t('sending', 'Sending…')}
                  </span>
                ) : null}
              </button>
            ))
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
