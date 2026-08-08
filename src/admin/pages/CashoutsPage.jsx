import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import { resolveCashoutRequest } from '../../utils/requestCashout';
import { AppText, AppTextInput } from '../../components/base';

function formatWhen(ts) {
  try {
    if (ts?.toDate) return ts.toDate().toLocaleString();
    if (ts?.seconds) return new Date(ts.seconds * 1000).toLocaleString();
  } catch {
    /* ignore */
  }
  return '—';
}

export default function CashoutsPage() {
  const { t } = useTranslation();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [ledgerUserId, setLedgerUserId] = useState(null);
  const [ledgerRows, setLedgerRows] = useState([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [rejectDraft, setRejectDraft] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    setMsg('');
    try {
      const q = query(
        collection(db, 'cashout_requests'),
        where('status', '==', 'pending'),
        orderBy('createdAt', 'desc'),
        limit(50)
      );
      const snap = await getDocs(q);
      setRows(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (e) {
      setMsg(e?.message || t('admin_cashout_load_failed', 'Failed to load cash-out requests.'));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const openLedger = async (userId) => {
    setLedgerUserId(userId);
    setLedgerLoading(true);
    setLedgerRows([]);
    try {
      const q = query(
        collection(db, 'credit_transactions'),
        where('userId', '==', userId),
        orderBy('createdAt', 'desc'),
        limit(40)
      );
      const snap = await getDocs(q);
      setLedgerRows(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (e) {
      setMsg(e?.message || t('admin_cashout_ledger_failed', 'Could not load ledger.'));
    } finally {
      setLedgerLoading(false);
    }
  };

  const act = async (row, action) => {
    setBusyId(row.id);
    setMsg('');
    try {
      await resolveCashoutRequest({
        requestId: row.id,
        action,
        rejectReason: action === 'reject' ? rejectDraft[row.id] || '' : undefined,
      });
      setMsg(
        action === 'paid'
          ? t('admin_cashout_marked_paid', 'Marked as paid.')
          : t('admin_cashout_rejected', 'Request rejected; savings refunded.')
      );
      await load();
    } catch (e) {
      setMsg(e?.message || t('admin_cashout_action_failed', 'Action failed.'));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="db-page">
      <AppText as="h1">{t('admin_cashout_title', 'Shield cash-outs')}</AppText>
      <AppText as="p" style={{ opacity: 0.75, marginTop: 0 }}>
        {t(
          'admin_cashout_subtitle',
          'Pending Shield package redemptions from savings. Review ledger before paying via PayPal.'
        )}
      </AppText>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button type="button" onClick={load} disabled={loading}>
          {loading ? t('loading', 'Loading…') : t('refresh', 'Refresh')}
        </button>
      </div>

      {msg ? <AppText as="p" style={{ color: 'var(--primary)' }}>{msg}</AppText> : null}

      {!loading && rows.length === 0 ? (
        <AppText as="p">{t('admin_cashout_empty', 'No pending cash-out requests.')}</AppText>
      ) : null}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {rows.map((row) => (
          <div
            key={row.id}
            className="settings-card"
            style={{ padding: 14, border: '1px solid var(--border-color)', borderRadius: 12 }}
          >
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between' }}>
              <div>
                <AppText as="strong">
                  {row.displayName || row.userEmail || row.userId}
                </AppText>
                <div style={{ fontSize: 13, opacity: 0.8 }}>
                  {t('admin_cashout_user', 'User')}: {row.userId}
                </div>
                <div style={{ fontSize: 13, opacity: 0.8 }}>
                  {t('admin_cashout_shield', 'Shield')}: {String(row.shieldType || '').toUpperCase()} ·{' '}
                  {Number(row.amountCredits || 0).toLocaleString()} credits · ${Number(row.amountFiat || 0)} USD
                </div>
                <div style={{ fontSize: 13, opacity: 0.8 }}>
                  PayPal: <strong>{row.paypalEmail || '—'}</strong>
                </div>
                <div style={{ fontSize: 12, opacity: 0.65 }}>{formatWhen(row.createdAt)}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 220 }}>
                <button type="button" onClick={() => openLedger(row.userId)} disabled={busyId === row.id}>
                  {t('admin_cashout_view_ledger', 'View ledger')}
                </button>
                <button
                  type="button"
                  onClick={() => act(row, 'paid')}
                  disabled={busyId === row.id}
                  style={{ background: 'var(--primary)', color: '#fff', border: 'none', padding: '8px 10px', borderRadius: 8 }}
                >
                  {t('admin_cashout_mark_paid', 'Mark as paid')}
                </button>
                <AppTextInput
                  value={rejectDraft[row.id] || ''}
                  onChange={(e) =>
                    setRejectDraft((prev) => ({ ...prev, [row.id]: e.target.value }))
                  }
                  placeholder={t('admin_cashout_reject_reason', 'Reject reason (optional)')}
                />
                <button type="button" onClick={() => act(row, 'reject')} disabled={busyId === row.id}>
                  {t('admin_cashout_reject', 'Reject')}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {ledgerUserId ? (
        <div style={{ marginTop: 24 }}>
          <AppText as="h2">
            {t('admin_cashout_ledger_title', 'Ledger')} — {ledgerUserId}
          </AppText>
          <button type="button" onClick={() => setLedgerUserId(null)} style={{ marginBottom: 8 }}>
            {t('close', 'Close')}
          </button>
          {ledgerLoading ? <AppText as="p">{t('loading', 'Loading…')}</AppText> : null}
          <ul style={{ fontSize: 13, lineHeight: 1.45 }}>
            {ledgerRows.map((r) => (
              <li key={r.id}>
                {formatWhen(r.createdAt)} · {r.type} · {r.amount} · {r.wallet || r.balanceType} ·{' '}
                {r.reason}
              </li>
            ))}
          </ul>
          {!ledgerLoading && ledgerRows.length === 0 ? (
            <AppText as="p">{t('admin_cashout_ledger_empty', 'No ledger rows.')}</AppText>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
