import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { searchUsers } from '../../utils/adminUserQueries';
import { getPurchaseCredits, getSavedCredits } from '../../utils/walletCredits';
import { adminApi } from '../api';
import { AppText, AppTextInput } from '../../components/base';

function isDemoAdminUser(u) {
  if (!u) return true;
  if (u.isDemo === true) return true;
  const id = String(u.id || '');
  return id.startsWith('demo_');
}

function walletSnapshot(u) {
  return {
    paid: getPurchaseCredits(u),
    saved: getSavedCredits(u),
  };
}

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
  const [resetPhrase, setResetPhrase] = useState('');
  const [resetting, setResetting] = useState(false);
  const [resetPreview, setResetPreview] = useState(null);

  const paid = getPurchaseCredits(selected);
  const saved = getSavedCredits(selected);

  const runSearch = useCallback(async () => {
    const term = search.trim();
    if (term.length < 2) return;
    setLoading(true);
    setMsg('');
    try {
      const rows = await searchUsers(db, term);
      const realUsers = (Array.isArray(rows) ? rows : [])
        .filter((u) => u && u.id && !isDemoAdminUser(u))
        .slice(0, 12);
      setResults(realUsers);
      if (rows?.length && realUsers.length === 0) {
        setMsg(
          t('admin_credits_no_real_users', {
            defaultValue: 'No non-demo users matched. Demo accounts are hidden here.',
          })
        );
      }
    } catch (e) {
      setMsg(e.message || t('admin_search_failed'));
    } finally {
      setLoading(false);
    }
  }, [search, t]);

  const selectUser = async (u) => {
    setMsg('');
    setSelected(u);
    try {
      const snap = await getDoc(doc(db, 'users', u.id));
      if (snap.exists()) {
        const fresh = { id: snap.id, ...snap.data() };
        if (isDemoAdminUser(fresh)) {
          setSelected(null);
          setMsg(
            t('admin_credits_demo_blocked', {
              defaultValue: 'Demo users cannot receive admin credit grants.',
            })
          );
          return;
        }
        setSelected(fresh);
      }
    } catch {
      /* keep search row */
    }
  };

  const grant = async () => {
    if (!selected?.id || isDemoAdminUser(selected)) return;
    const n = Math.floor(Number(amount));
    if (!Number.isFinite(n) || n <= 0) {
      setMsg(t('admin_invalid_amount'));
      return;
    }
    if (
      !window.confirm(
        t('admin_grant_paid_confirm', {
          count: n,
          defaultValue: `Grant ${n} purchase credits?`,
        })
      )
    ) {
      return;
    }
    setGranting(true);
    try {
      const res = await adminApi.grantFreeCredits(selected.id, n, note);
      const nextPaid = res.paidCredits ?? res.freeCredits ?? paid + n;
      setSelected((p) => (p ? { ...p, paidCredits: nextPaid, freeCredits: 0 } : p));
      setResults((prev) =>
        prev.map((row) =>
          row.id === selected.id ? { ...row, paidCredits: nextPaid, freeCredits: 0 } : row
        )
      );
      setMsg(
        t('admin_grant_paid_success', {
          count: nextPaid,
          defaultValue: `Purchase wallet: ${nextPaid}`,
        })
      );
    } catch (e) {
      setMsg(e.message || t('admin_failed'));
    } finally {
      setGranting(false);
    }
  };

  const previewResetAll = async () => {
    setResetting(true);
    setMsg('');
    try {
      const res = await adminApi.resetAllCredits('RESET ALL CREDITS', true);
      setResetPreview(res);
      setMsg(
        t('admin_reset_credits_preview', {
          count: res.hadBalance ?? 0,
          scanned: res.scanned ?? 0,
          defaultValue: `Dry run: ${res.hadBalance ?? 0} accounts with balance (of ${res.scanned ?? 0} total).`,
        })
      );
    } catch (e) {
      setMsg(e.message || t('admin_failed'));
    } finally {
      setResetting(false);
    }
  };

  const executeResetAll = async () => {
    if (resetPhrase.trim() !== 'RESET ALL CREDITS') {
      setMsg(t('admin_reset_credits_phrase_required', 'Type RESET ALL CREDITS to confirm.'));
      return;
    }
    if (
      !window.confirm(
        t(
          'admin_reset_credits_confirm',
          'This zeros paid + savings credits for every user. Subscription tiers are unchanged. Continue?'
        )
      )
    ) {
      return;
    }
    setResetting(true);
    setMsg('');
    try {
      const res = await adminApi.resetAllCredits('RESET ALL CREDITS', false);
      setResetPreview(res);
      setResetPhrase('');
      setSelected(null);
      setResults([]);
      setMsg(
        t('admin_reset_credits_done', {
          count: res.updated ?? 0,
          defaultValue: `Reset complete. Updated ${res.updated ?? 0} accounts.`,
        })
      );
    } catch (e) {
      setMsg(e.message || t('admin_failed'));
    } finally {
      setResetting(false);
    }
  };

  return (
    <>
      <AppText as="h1" className="db-h1">
        {t('admin_credits_title')}
      </AppText>
      <AppText as="p" className="db-lead">
        {t('admin_credits_lead')}
      </AppText>
      <AppText as="p" className="db-hint" style={{ marginBottom: '0.75rem' }}>
        {t('admin_credits_demo_excluded_hint', {
          defaultValue: 'Demo users are excluded from search and cannot receive grants.',
        })}
      </AppText>

      <div className="db-toolbar">
        <AppTextInput
          className="db-input"
          style={{ flex: 1 }}
          placeholder={t('admin_search_user')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && runSearch()}
        />

        <button type="button" className="db-btn db-btn--lime" onClick={runSearch} disabled={loading}>
          {t('admin_search')}
        </button>
      </div>

      {results.length > 0 && !selected ? (
        <div className="db-panel db-credit-user-list" style={{ marginBottom: '1rem', padding: '0.5rem' }}>
          {results.map((u) => {
            const wallets = walletSnapshot(u);
            const label = u.display_name || u.displayName || u.email || u.id;
            return (
              <button
                key={u.id}
                type="button"
                className="db-credit-user-row"
                onClick={() => selectUser(u)}
              >
                <div className="db-credit-user-row__meta">
                  <span className="db-credit-user-row__name">{label}</span>
                  {u.email ? <span className="db-credit-user-row__email">{u.email}</span> : null}
                  <span className="db-id">{u.id}</span>
                </div>
                <div className="db-credit-user-row__wallets" aria-label={t('admin_credits_wallets', 'Wallets')}>
                  <div className="db-credit-user-chip db-credit-user-chip--paid">
                    <span className="db-credit-user-chip__label">
                      {t('admin_credits_paid_label', 'purchase')}
                    </span>
                    <span className="db-credit-user-chip__val">{wallets.paid}</span>
                  </div>
                  <div className="db-credit-user-chip db-credit-user-chip--saved">
                    <span className="db-credit-user-chip__label">
                      {t('admin_savings_wallet_label', 'savings')}
                    </span>
                    <span className="db-credit-user-chip__val">{wallets.saved}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      ) : null}

      {selected ? (
        <div className="db-panel" style={{ padding: '1rem' }}>
          <div style={{ marginBottom: '0.5rem', fontWeight: 600 }}>
            {selected.display_name || selected.displayName || selected.email}
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
              onChange={(e) => setAmount(e.target.value)}
              aria-label={t('admin_credits_amount_label', 'Credit amount')}
            />

            <AppTextInput
              className="db-input"
              style={{ flex: 1 }}
              placeholder={t('admin_note_placeholder')}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />

            <button type="button" className="db-btn db-btn--lime" onClick={grant} disabled={granting}>
              {t('admin_credits_grant_btn')}
            </button>
            <button type="button" className="db-btn db-btn--ghost" onClick={() => setSelected(null)}>
              {t('admin_cancel')}
            </button>
          </div>
          {msg ? (
            <AppText
              as="p"
              style={{
                marginTop: '0.75rem',
                color:
                  msg.includes('wallet') || msg.includes('paid') || msg.includes('شراء')
                    ? 'var(--db-lime)'
                    : 'var(--db-danger)',
              }}
            >
              {msg}
            </AppText>
          ) : null}
        </div>
      ) : null}

      <div
        className="db-panel"
        style={{ marginTop: '1.5rem', padding: '1rem', borderColor: 'var(--db-danger)' }}
      >
        <AppText as="h2" style={{ fontSize: '1.05rem', marginBottom: '0.35rem' }}>
          {t('admin_reset_all_credits_title', 'Reset all credits')}
        </AppText>
        <AppText as="p" className="db-hint" style={{ marginBottom: '0.75rem' }}>
          {t(
            'admin_reset_all_credits_lead',
            'Zeros purchase + savings wallets for every user. Business subscription tiers are not changed. Admin grants work again after reset.'
          )}
        </AppText>
        {resetPreview ? (
          <AppText as="p" style={{ marginBottom: '0.75rem', color: 'var(--db-muted)', fontSize: '0.9rem' }}>
            {t('admin_reset_credits_stats', {
              scanned: resetPreview.scanned ?? 0,
              hadBalance: resetPreview.hadBalance ?? 0,
              updated: resetPreview.updated ?? 0,
              defaultValue: `Scanned ${resetPreview.scanned ?? 0}, with balance ${resetPreview.hadBalance ?? 0}, updated ${resetPreview.updated ?? 0}.`,
            })}
          </AppText>
        ) : null}
        <div className="db-toolbar" style={{ flexWrap: 'wrap' }}>
          <AppTextInput
            className="db-input"
            style={{ flex: 1, minWidth: 220 }}
            placeholder={t('admin_reset_credits_phrase_placeholder', 'Type RESET ALL CREDITS')}
            value={resetPhrase}
            onChange={(e) => setResetPhrase(e.target.value)}
          />

          <button type="button" className="db-btn db-btn--ghost" onClick={previewResetAll} disabled={resetting}>
            {t('admin_reset_credits_dry_run', 'Preview count')}
          </button>
          <button type="button" className="db-btn db-btn--danger" onClick={executeResetAll} disabled={resetting}>
            {t('admin_reset_credits_execute', 'Reset all now')}
          </button>
        </div>
        {msg && !selected ? (
          <AppText as="p" style={{ marginTop: '0.75rem', color: 'var(--db-danger)' }}>
            {msg}
          </AppText>
        ) : null}
      </div>
    </>
  );
}
