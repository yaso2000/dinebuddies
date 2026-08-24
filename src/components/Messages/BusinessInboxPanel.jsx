import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FaExclamationCircle, FaLightbulb, FaCircle, FaStore } from 'react-icons/fa';
import UserAvatar from '../UserAvatar';
import { AppText } from '../base';

const STATUS_COLOR = { open: '#f59e0b', in_progress: '#3b82f6', resolved: '#22c55e', archived: '#94a3b8' };
const statusOf = (t) => (t.status && STATUS_COLOR[t.status] ? t.status : (t.isResolved ? 'resolved' : 'open'));

export default function BusinessInboxPanel({ threads = [], loading, searchQuery = '' }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();

  const term = searchQuery.trim().toLowerCase();
  const list = term
    ? threads.filter((th) => `${th.businessName || ''} ${th.content || ''}`.toLowerCase().includes(term))
    : threads;

  const fmt = (ts) => {
    if (!ts?.toDate) return '';
    try { return ts.toDate().toLocaleString(i18n.language || undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); }
    catch { return ''; }
  };

  if (loading) {
    return <div className="messages-page__loading">{t('loading_conversations', 'Loading conversations...')}</div>;
  }

  if (list.length === 0) {
    return (
      <div className="messages-page__empty">
        <div className="messages-page__empty-icon" aria-hidden><FaStore /></div>
        <AppText as="h3" className="messages-page__empty-title" format={false}>
          {t('business_inbox_empty_title', 'No business messages')}
        </AppText>
        <AppText as="p" className="messages-page__empty-text" format={false}>
          {t('business_inbox_empty_hint', 'Feedback you send to a business, and their replies, appear here.')}
        </AppText>
      </div>
    );
  }

  return (
    <div className="messages-page__list">
      {list.map((th) => {
        const s = statusOf(th);
        const isSuggestion = th.type === 'suggestion';
        const snippet = (th.content || '').length > 60 ? th.content.slice(0, 60) + '…' : (th.content || '');
        return (
          <button
            key={th.id}
            type="button"
            onClick={() => navigate(`/business-thread/${th.id}`)}
            style={{
              display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'start',
              padding: '14px 16px', background: 'transparent', border: 'none', borderBottom: '1px solid var(--border-color)',
              cursor: 'pointer', position: 'relative'
            }}>
            <UserAvatar user={{ photo_url: th.businessAvatar, display_name: th.businessName }} alt={th.businessName} style={{ width: 48, height: 48, flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <AppText as="span" style={{ fontWeight: 700, color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {th.businessName || t('business', 'Business')}
                </AppText>
                <AppText as="span" style={{ fontSize: '0.72rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', flexShrink: 0 }}>{fmt(th.lastMessageAt || th.createdAt)}</AppText>
              </div>
              <div style={{ fontSize: '0.85rem', color: th.unreadForUser ? 'var(--text-main)' : 'var(--text-secondary)', fontWeight: th.unreadForUser ? 600 : 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                <span style={{ color: isSuggestion ? '#22c55e' : '#ef4444', marginInlineEnd: 6 }}>
                  {isSuggestion ? <FaLightbulb /> : <FaExclamationCircle />}
                </span>
                {snippet}
              </div>
              <span style={{ fontSize: '0.68rem', fontWeight: 700, color: STATUS_COLOR[s] }}>
                {t(`feedback_status_${s}`, s)}
              </span>
            </div>
            {th.unreadForUser && <FaCircle style={{ fontSize: 9, color: 'var(--brand-primary)', flexShrink: 0 }} />}
          </button>
        );
      })}
    </div>
  );
}
