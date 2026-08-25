import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { adminApi } from '../api';
import { AppText } from '../../components/base';
import { useConfirm } from '../../context/ConfirmContext';

const SECTIONS = [
  { id: 'accounts', types: new Set(['user', 'partner']), labelKey: 'admin_reports_accounts' },
  { id: 'invitations', types: new Set(['invitation', 'message']), labelKey: 'admin_reports_invitations' },
  { id: 'content', types: new Set(['post', 'story', 'comment', 'image']), labelKey: 'admin_reports_posts' },
];

const SEV_COLOR = { low: '#94a3b8', medium: '#f59e0b', high: '#ef4444', critical: '#b91c1c' };

function Badge({ text, color, solid }) {
  if (!text) return null;
  return (
    <span style={{
      fontSize: '0.68rem', fontWeight: 800, borderRadius: 8, padding: '2px 8px', whiteSpace: 'nowrap',
      color: solid ? '#fff' : color, background: solid ? color : `${color}22`, border: `1px solid ${color}55`,
    }}>{text}</span>
  );
}

export default function ReportsPage() {
  const { t } = useTranslation();
  const confirm = useConfirm();
  const [section, setSection] = useState('accounts');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(null);
  const [selected, setSelected] = useState(null);
  const [responseText, setResponseText] = useState('');
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.listReports({ status: 'pending', pageSize: 50 });
      setItems(res.items || []);
    } catch (e) {
      alert(e.message || t('admin_failed'));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { load(); }, [load]);

  const cfg = SECTIONS.find((s) => s.id === section) || SECTIONS[0];
  const filtered = items
    .filter((r) => cfg.types.has(r.type))
    .sort((a, b) => (b.escalated ? 1 : 0) - (a.escalated ? 1 : 0));

  const resolve = async (id, status) => {
    if (!(await confirm({ message: status === 'resolved' ? t('admin_report_accept_confirm') : t('admin_report_dismiss_confirm'), tone: 'danger' }))) return;
    setActing(id);
    try {
      await adminApi.setReportStatus(id, status);
      setItems((prev) => prev.filter((r) => r.id !== id));
      if (selected?.id === id) setSelected(null);
    } catch (e) {
      alert(e.message || t('admin_failed'));
    } finally {
      setActing(null);
    }
  };

  const openDetail = (r) => { setSelected(r); setResponseText(r.aiSuggestedResponse || ''); };

  const retriage = async (r) => {
    setBusy('triage');
    try {
      await adminApi.triageReport(r.id);
      await load();
      setSelected(null);
    } catch (e) { alert(e.message || t('admin_failed')); }
    finally { setBusy(''); }
  };

  const sendResponse = async (r) => {
    if (!responseText.trim()) return;
    setBusy('respond');
    try {
      await adminApi.respondToReport(r.id, responseText.trim());
      alert(t('admin_report_response_sent', 'Reply sent to the reporter.'));
    } catch (e) { alert(e.message || t('admin_failed')); }
    finally { setBusy(''); }
  };

  return (
    <>
      <AppText as="h1" className="db-h1">{t('admin_reports_title')}</AppText>
      <AppText as="p" className="db-lead">{t('admin_reports_lead')}</AppText>

      <div className="db-tabs">
        {SECTIONS.map((s) => (
          <button key={s.id} type="button" className={`db-tab${section === s.id ? ' active' : ''}`} onClick={() => setSection(s.id)}>
            {t(s.labelKey)}
          </button>
        ))}
      </div>

      <div className="db-panel">
        {loading ? <div className="db-spin" /> : filtered.length === 0 ? (
          <div className="db-empty">{t('admin_empty_pending_reports')}</div>
        ) : (
          <table className="db-table">
            <thead>
              <tr>
                <th>{t('admin_reports_target')}</th>
                <th>{t('admin_report_ai', 'AI triage')}</th>
                <th>{t('admin_reports_reason')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} style={r.escalated ? { background: 'rgba(185,28,28,0.08)' } : undefined}>
                  <td>
                    <div>{r.targetName || r.targetId}</div>
                    <div className="db-id">{r.type}</div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
                      {r.escalated ? <Badge text="⚠ CSAM" color="#b91c1c" solid /> : null}
                      {r.aiSeverity ? <Badge text={r.aiSeverity} color={SEV_COLOR[r.aiSeverity] || '#94a3b8'} solid /> : null}
                      {r.aiCategory ? <Badge text={t(`report_cat_${r.aiCategory}`, r.aiCategory)} color="#6366f1" /> : null}
                      {!r.aiProcessed ? <Badge text="…" color="#94a3b8" /> : null}
                    </div>
                    {r.aiSummary ? <div className="db-id" style={{ marginTop: 4, maxWidth: 320, whiteSpace: 'normal' }}>{r.aiSummary}</div> : null}
                  </td>
                  <td>{r.reason}</td>
                  <td>
                    <div className="db-actions">
                      <button type="button" className="db-btn db-btn--ghost" onClick={() => openDetail(r)}>{t('admin_report_details', 'Details')}</button>
                      <button type="button" className="db-btn db-btn--lime" disabled={acting === r.id} onClick={() => resolve(r.id, 'resolved')}>{t('admin_report_accept')}</button>
                      <button type="button" className="db-btn db-btn--ghost" disabled={acting === r.id} onClick={() => resolve(r.id, 'dismissed')}>{t('admin_report_dismiss')}</button>
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
          <div style={{ background: 'var(--bg-card)', borderRadius: 16, width: '100%', maxWidth: 560, maxHeight: '88vh', overflowY: 'auto', padding: 20 }} onClick={(e) => e.stopPropagation()}>
            {selected.escalated ? (
              <div style={{ background: 'rgba(185,28,28,0.12)', color: '#b91c1c', borderRadius: 10, padding: 12, fontWeight: 800, fontSize: '0.85rem', marginBottom: 12 }}>
                {t('admin_report_csam_warn', '⚠ Suspected child-safety content. Do NOT action here — escalate to the specialized pipeline and authorities.')}
              </div>
            ) : null}

            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
              {selected.aiSeverity ? <Badge text={selected.aiSeverity} color={SEV_COLOR[selected.aiSeverity] || '#94a3b8'} solid /> : null}
              {selected.aiCategory ? <Badge text={t(`report_cat_${selected.aiCategory}`, selected.aiCategory)} color="#6366f1" /> : null}
              {selected.aiRecommendation ? <Badge text={t(`report_rec_${selected.aiRecommendation}`, selected.aiRecommendation)} color="#0ea5e9" /> : null}
            </div>

            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 4 }}>{t('admin_report_content', 'Reported content')} · {selected.type}</div>
            {selected.aiContentImage ? <img src={selected.aiContentImage} alt="" style={{ width: '100%', maxHeight: 220, objectFit: 'contain', borderRadius: 10, background: 'var(--bg-elevated)', marginBottom: 8 }} /> : null}
            <div style={{ background: 'var(--bg-elevated)', borderRadius: 10, padding: 12, fontSize: '0.9rem', color: 'var(--text-main)', whiteSpace: 'pre-wrap', marginBottom: 12 }}>
              {selected.aiContentText || t('admin_report_no_text', '(no text content)')}
            </div>

            {selected.aiSummary ? <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 12 }}><b>{t('admin_report_ai', 'AI triage')}:</b> {selected.aiSummary}</div> : null}
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 8 }}>{t('admin_reports_reason')}: <b>{selected.reason}</b>{selected.details ? ` — ${selected.details}` : ''}</div>

            <div style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: 6 }}>{t('admin_report_reply', 'Reply to reporter')}</div>
            <textarea value={responseText} onChange={(e) => setResponseText(e.target.value)} rows={3} style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid var(--border-color)', background: 'var(--bg-elevated)', color: 'var(--text-main)', boxSizing: 'border-box', fontFamily: 'inherit' }} />

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
              <button type="button" className="db-btn db-btn--lime" disabled={busy === 'respond' || !responseText.trim()} onClick={() => sendResponse(selected)}>{t('admin_report_send_reply', 'Send reply')}</button>
              <button type="button" className="db-btn db-btn--ghost" disabled={busy === 'triage'} onClick={() => retriage(selected)}>{t('admin_report_retriage', 'Re-run AI')}</button>
              <button type="button" className="db-btn db-btn--ghost" onClick={() => setSelected(null)}>{t('close', 'Close')}</button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
