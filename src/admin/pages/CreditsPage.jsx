import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { db } from '../../firebase/config';
import { searchUsers } from '../../utils/adminUserQueries';
import { adminApi } from '../api';
import { AppText, AppTextInput } from "../../components/base";

export default function CreditsPage() {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(null);
  const [amount, setAmount] = useState(50);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [granting, setGranting] = useState(false);
  const [msg, setMsg] = useState('');

  const paid = Math.max(0, Math.floor(Number(selected?.paidCredits) || 0));
  const saved = Math.max(0, Math.floor(Number(selected?.savedCredits) || 0));

  const runSearch = useCallback(async () => {
    const term = search.trim();
    if (term.length < 2) return;
    setLoading(true);
    setMsg('');
    try {
      const rows = await searchUsers(db, term);
      setResults(rows.slice(0, 12));
    } catch (e) {
      setMsg(e.message || t('admin_search_failed'));
    } finally {
      setLoading(false);
    }
  }, [search, t]);

  const grant = async () => {
    if (!selected?.id) return;
    const n = Math.floor(Number(amount));
    if (!Number.isFinite(n) || n <= 0) {
      setMsg(t('admin_invalid_amount'));
      return;
    }
    if (!window.confirm(t('admin_grant_paid_confirm', { count: n, defaultValue: `Grant ${n} purchase credits?` }))) return;
    setGranting(true);
    try {
      const res = await adminApi.grantFreeCredits(selected.id, n, note);
      const nextPaid = res.paidCredits ?? res.freeCredits ?? paid + n;
      setSelected((p) => p ? { ...p, paidCredits: nextPaid, freeCredits: 0 } : p);
      setMsg(t('admin_grant_paid_success', { count: nextPaid, defaultValue: `Purchase wallet: ${nextPaid}` }));
    } catch (e) {
      setMsg(e.message || t('admin_failed'));
    } finally {
      setGranting(false);
    }
  };

  return (
    <>
            <AppText as="h1" className="db-h1">{t('admin_credits_title')}</AppText>
            <AppText as="p" className="db-lead">{t('admin_credits_lead')}</AppText>

            <div className="db-toolbar">
                <AppTextInput
          className="db-input"
          style={{ flex: 1 }}
          placeholder={t('admin_search_user')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && runSearch()} />

                <button type="button" className="db-btn db-btn--lime" onClick={runSearch} disabled={loading}>
                    {t('admin_search')}
                </button>
            </div>

            {results.length > 0 && !selected &&
      <div className="db-panel" style={{ marginBottom: '1rem', padding: '0.5rem' }}>
                    {results.map((u) =>
        <button
          key={u.id}
          type="button"
          className="db-btn db-btn--ghost"
          style={{ display: 'block', width: '100%', textAlign: 'left', marginBottom: 4 }}
          onClick={() => setSelected(u)}>

                            {t('admin_credits_user_summary', {
            name: u.display_name || u.email || u.id,
            free: u.savedCredits ?? 0,
            paid: u.paidCredits ?? 0
          })}
                        </button>
        )}
                </div>
      }

            {selected &&
      <div className="db-panel" style={{ padding: '1rem' }}>
                    <div style={{ marginBottom: '0.5rem', fontWeight: 600 }}>
                        {selected.display_name || selected.email}
                    </div>
                    <div className="db-id" style={{ marginBottom: '1rem' }}>
                        {selected.id}
                    </div>

                    <div className="db-credit-row">
                        <div className="db-credit-box db-credit-box--paid">
                            <label>{t('admin_credits_paid_label', 'purchase')}</label>
                            <div className="val">{paid}</div>
                        </div>
                        <div className="db-credit-box db-credit-box--free">
                            <label>{t('admin_savings_wallet_label', 'savings')}</label>
                            <div className="val">{saved}</div>
                            <small style={{ color: 'var(--db-muted)' }}>{t('admin_read_only', 'Read only')}</small>
                        </div>
                    </div>

                    <div className="db-toolbar">
                        <input
            className="db-input"
            type="number"
            min={1}
            value={amount}
            onChange={(e) => setAmount(e.target.value)} />

                        <AppTextInput
            className="db-input"
            style={{ flex: 1 }}
            placeholder={t('admin_note_placeholder')}
            value={note}
            onChange={(e) => setNote(e.target.value)} />

                        <button type="button" className="db-btn db-btn--lime" onClick={grant} disabled={granting}>
                            {t('admin_credits_grant_btn')}
                        </button>
                        <button type="button" className="db-btn db-btn--ghost" onClick={() => setSelected(null)}>
                            {t('admin_cancel')}
                        </button>
                    </div>
                    {msg &&
        <AppText as="p"
        style={{
          marginTop: '0.75rem',
          color: msg.includes('wallet') || msg.includes('paid') ? 'var(--db-lime)' : 'var(--db-danger)'
        }}>

                            {msg}
                        </AppText>
        }
                </div>
      }
        </>);

}
