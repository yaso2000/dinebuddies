import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { adminApi } from '../api';
import { AppText } from '../../components/base';

const TABS = [
  { id: 'open', labelKey: 'admin_support_open' },
  { id: 'answered', labelKey: 'admin_support_answered' },
  { id: 'resolved', labelKey: 'admin_support_resolved' },
];

export default function SupportPage() {
  const { t } = useTranslation();
  const [status, setStatus] = useState('open');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.listSupportTickets({ status, pageSize: 100 });
      setItems(res.items || []);
    } catch (e) {
      alert(e.message || t('admin_failed'));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [status, t]);

  useEffect(() => { load(); }, [load]);

  const open = (row) => { setSelected(row); setReply(row.adminReply || ''); };

  const sendReply = async () => {
    if (!reply.trim() || !selected) return;
    setBusy('reply');
    try {
      await adminApi.replySupportTicket(selected.id, reply.trim());
      alert(t('admin_support_reply_sent', 'Reply sent to the user.'));
      setSelected(null);
      await load();
    } catch (e) { alert(e.message || t('admin_failed')); }
    finally { setBusy(''); }
  };

  const setTicketStatus = async (id, next) => {
    setBusy('status');
    try {
      await adminApi.setSupportTicketStatus(id, next);
      setSelected(null);
      await load();
    } catch (e) { alert(e.message || t('admin_failed')); }
    finally { setBusy(''); }
  };

  return (
    <>
      <AppText as="h1" className="db-h1">{t('admin_nav_support', 'Support')}</AppText>
      <AppText as="p" className="db-lead">{t('admin_support_lead', 'User questions escalated from the AI assistant.')}</AppText>

      <div className="db-tabs">
        {TABS.map((tab) => (
          <button key={tab.id} type="button" className={`db-tab${status === tab.id ? ' active' : ''}`} onClick={() => setStatus(tab.id)}>
            {t(tab.labelKey, tab.id)}
          </button>
        ))}
      </div>

      <div className="db-panel">
        {loading ? <div className="db-spin" /> : items.length === 0 ? (
          <div className="db-empty">{t('admin_support_empty', 'No tickets here.')}</div>
        ) : (
          <table className="db-table">
            <thead>
              <tr>
                <th>{t('admin_support_user', 'User')}</th>
                <th>{t('admin_support_question', 'Question')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <tr key={r.id}>
                  <td>
                    <div>{r.userName || r.userId}</div>
                    <div className="db-id">{r.userEmail}</div>
                  </td>
                  <td style={{ maxWidth: 420, whiteSpace: 'normal' }}>{r.message}</td>
                  <td>
                    <div className="db-actions">
                      <button type="button" className="db-btn db-btn--ghost" onClick={() => open(r)}>{t('admin_report_details', 'Details')}</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {selected ? (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000, padding: 16 }} onClick={() => setSelected(null)}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 16, width: '100%', maxWidth: 600, maxHeight: '88vh', overflowY: 'auto', padding: 20 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 10 }}>
              {selected.userName || selected.userId} · {selected.userEmail} · {selected.locale}
            </div>

            <div style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: 6 }}>{t('admin_support_transcript', 'Conversation')}</div>
            <div style={{ background: 'var(--bg-elevated)', borderRadius: 10, padding: 12, marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 300, overflowY: 'auto' }}>
              {(selected.transcript && selected.transcript.length ? selected.transcript : [{ role: 'user', text: selected.message }]).map((m, i) => (
                <div key={i} style={{
                  alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '85%',
                  background: m.role === 'user' ? 'var(--primary)' : 'var(--bg-card)',
                  color: m.role === 'user' ? '#fff' : 'var(--text-main)',
                  border: m.role === 'user' ? 'none' : '1px solid var(--border-color)',
                  borderRadius: 12, padding: '6px 10px', fontSize: '0.88rem', whiteSpace: 'pre-wrap',
                }}>{m.text}</div>
              ))}
            </div>

            {selected.adminReply ? (
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 12 }}>
                <b>{t('admin_support_last_reply', 'Last reply')}:</b> {selected.adminReply}
              </div>
            ) : null}

            <div style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: 6 }}>{t('admin_support_reply', 'Reply to user')}</div>
            <textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={3} style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid var(--border-color)', background: 'var(--bg-elevated)', color: 'var(--text-main)', boxSizing: 'border-box', fontFamily: 'inherit' }} />

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
              <button type="button" className="db-btn db-btn--lime" disabled={busy === 'reply' || !reply.trim()} onClick={sendReply}>{t('admin_support_send', 'Send reply')}</button>
              <button type="button" className="db-btn db-btn--ghost" disabled={busy === 'status'} onClick={() => setTicketStatus(selected.id, 'resolved')}>{t('admin_support_resolve', 'Mark resolved')}</button>
              <button type="button" className="db-btn db-btn--ghost" onClick={() => setSelected(null)}>{t('close', 'Close')}</button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
