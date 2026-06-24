import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { db } from '../../firebase/config';
import { browseUsersPage, searchUsers } from '../../utils/adminUserQueries';
import { adminApi } from '../api';
import { AppText, AppTextInput } from "../../components/base";

const USER_TABS = [
{
  id: 'regular',
  labelKey: 'admin_users_tab_regular',
  hintKey: 'admin_users_tab_regular_hint',
  roleFilter: 'user',
  freezeDays: 7,
  freezeLabelKey: 'admin_freeze_7_days'
},
{
  id: 'business',
  labelKey: 'admin_users_tab_business',
  hintKey: 'admin_users_tab_business_hint',
  roleFilter: 'business',
  freezeDays: null,
  freezeLabelKey: 'admin_freeze_account',
  verifyPlaceholder: true
},
{
  id: 'agents',
  labelKey: 'admin_users_tab_agents',
  hintKey: 'admin_users_tab_agents_hint',
  roleFilter: 'affiliate_agent',
  agents: true
}];


function fmtMoney(cents) {
  const n = Math.max(0, Math.floor(Number(cents) || 0));
  return `$${(n / 100).toFixed(2)}`;
}

function agentStats(u) {
  const referred =
  typeof u.total_referred_users === 'number' ?
  Math.max(0, Math.floor(u.total_referred_users)) :
  Math.max(
    0,
    Math.floor(Number(u.successful_referrals_count) || 0) +
    Math.floor(Number(u.pending_referrals_count) || 0)
  );
  const pending =
  typeof u.pending_commissions === 'number' ?
  Math.max(0, Math.floor(u.pending_commissions)) :
  Math.max(0, Math.floor(Number(u.current_balance) || 0));
  const earned =
  typeof u.total_earned === 'number' ? Math.max(0, Math.floor(u.total_earned)) : 0;
  return { referred, pending, earned };
}

function StatusBadge({ u, t }) {
  if (u.banned) return <AppText as="span" className="db-badge db-badge--ban">{t('admin_status_banned')}</AppText>;
  if (u.frozen) return <AppText as="span" className="db-badge db-badge--warn">{t('admin_status_frozen')}</AppText>;
  return <AppText as="span" className="db-badge db-badge--ok">{t('admin_status_active')}</AppText>;
}

function nameForTab(tab, u) {
  if (tab === 'business') {
    return u.businessInfo?.businessName || u.businessInfo?.name || u.display_name || u.email || u.id;
  }
  return u.display_name || u.displayName || u.nickname || u.name || u.email || u.id;
}

export default function UsersPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState('regular');
  const cfg = USER_TABS.find((row) => row.id === tab) || USER_TABS[0];

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [cursor, setCursor] = useState(null);
  const [hasNext, setHasNext] = useState(false);
  const [acting, setActing] = useState(null);

  const load = useCallback(
    async (startAfterId = null) => {
      setLoading(true);
      setError('');
      try {
        const res = await browseUsersPage(db, {
          roleFilter: cfg.roleFilter,
          startAfterId,
          pageSize: 25
        });
        setRows(res.users);
        setHasNext(res.hasNext);
        setCursor(res.lastId);
      } catch (e) {
        setError(e.message || t('admin_load_failed'));
      } finally {
        setLoading(false);
      }
    },
    [cfg.roleFilter, t]
  );

  const runSearch = useCallback(async () => {
    const term = search.trim();
    if (term.length < 2) {
      load();
      return;
    }
    setLoading(true);
    setError('');
    try {
      let list = await searchUsers(db, term);
      const rf = cfg.roleFilter;
      if (rf === 'user') {
        list = list.filter((u) => !u.role || String(u.role).toLowerCase() === 'user');
      } else if (rf === 'business') {
        list = list.filter((u) => ['business', 'partner'].includes(String(u.role || '').toLowerCase()));
      } else if (rf === 'affiliate_agent') {
        list = list.filter((u) => String(u.role || '').toLowerCase() === 'affiliate_agent');
      }
      setRows(list.slice(0, 50));
      setHasNext(false);
    } catch (e) {
      setError(e.message || t('admin_search_failed'));
    } finally {
      setLoading(false);
    }
  }, [search, load, cfg.roleFilter, t]);

  useEffect(() => {
    setSearch('');
    load(null);
  }, [tab, load]);

  const act = async (uid, fn) => {
    if (!window.confirm(t('admin_action_confirm'))) return;
    setActing(uid);
    try {
      await fn();
      if (search.trim().length >= 2) await runSearch();else
      await load();
    } catch (e) {
      alert(e.message || t('admin_failed'));
    } finally {
      setActing(null);
    }
  };

  const renderActions = (u) => {
    if (cfg.agents) {
      return (
        <div className="db-actions">
                    {!u.banned &&
          <>
                            <button
              type="button"
              className="db-btn db-btn--warn"
              disabled={acting === u.id}
              onClick={() =>
              act(u.id, () => adminApi.setUserFreezeStatus(u.id, true, null))
              }>

                                {t('admin_freeze_agent_dashboard')}
                            </button>
                            <button
              type="button"
              className="db-btn db-btn--danger"
              disabled={acting === u.id}
              onClick={() => act(u.id, () => adminApi.setUserBanStatus(u.id, true))}>

                                {t('admin_ban_permanent')}
                            </button>
                            <button type="button" className="db-btn" disabled title={t('admin_coming_soon')}>
                                {t('admin_payout_transfer')}
                            </button>
                        </>
          }
                    {u.frozen && !u.banned &&
          <button
            type="button"
            className="db-btn db-btn--lime"
            disabled={acting === u.id}
            onClick={() => act(u.id, () => adminApi.setUserFreezeStatus(u.id, false))}>

                            {t('admin_unfreeze')}
                        </button>
          }
                    {u.banned &&
          <button
            type="button"
            className="db-btn db-btn--lime"
            disabled={acting === u.id}
            onClick={() => act(u.id, () => adminApi.setUserBanStatus(u.id, false))}>

                            {t('admin_unban')}
                        </button>
          }
                </div>);

    }

    return (
      <div className="db-actions">
                {!u.banned &&
        <>
                        <button
            type="button"
            className="db-btn db-btn--warn"
            disabled={acting === u.id}
            onClick={() =>
            act(u.id, () =>
            adminApi.setUserFreezeStatus(u.id, true, cfg.freezeDays ?? 7)
            )
            }>

                            {t(cfg.freezeLabelKey)}
                        </button>
                        <button
            type="button"
            className="db-btn db-btn--danger"
            disabled={acting === u.id}
            onClick={() => act(u.id, () => adminApi.setUserBanStatus(u.id, true))}>

                            {t('admin_ban_permanent')}
                        </button>
                        {cfg.verifyPlaceholder &&
          <button type="button" className="db-btn" disabled title={t('admin_coming_soon')}>
                                {t('admin_verify')}
                            </button>
          }
                        {tab === 'business' &&
          <button
            type="button"
            className="db-btn db-btn--danger"
            disabled={acting === u.id}
            onClick={async () => {
              if (!window.confirm(t('admin_delete_partner_confirm', { name: nameForTab(tab, u) }))) return;
              setActing(u.id);
              try {
                await adminApi.deletePartner(u.id);
                if (search.trim().length >= 2) await runSearch();
                else await load();
              } catch (e) {
                alert(e.message || t('admin_failed'));
              } finally {
                setActing(null);
              }
            }}>

                                {t('admin_delete_partner')}
                            </button>
          }
                    </>
        }
                {u.frozen && !u.banned &&
        <button
          type="button"
          className="db-btn db-btn--lime"
          disabled={acting === u.id}
          onClick={() => act(u.id, () => adminApi.setUserFreezeStatus(u.id, false))}>

                        {t('admin_unfreeze')}
                    </button>
        }
                {u.banned &&
        <button
          type="button"
          className="db-btn db-btn--lime"
          disabled={acting === u.id}
          onClick={() => act(u.id, () => adminApi.setUserBanStatus(u.id, false))}>

                        {t('admin_unban')}
                    </button>
        }
            </div>);

  };

  return (
    <>
            <AppText as="h1" className="db-h1">{t('admin_users_title')}</AppText>
            <AppText as="p" className="db-lead">{t('admin_users_lead')}</AppText>

            <div className="db-tabs">
                {USER_TABS.map((row) =>
        <button
          key={row.id}
          type="button"
          className={`db-tab${tab === row.id ? ' active' : ''}`}
          onClick={() => setTab(row.id)}>

                        {t(row.labelKey)}
                    </button>
        )}
            </div>

            <AppText as="p" className="db-hint">
                <strong>{t(cfg.labelKey)}:</strong> {t(cfg.hintKey)}
            </AppText>

            <div className="db-toolbar">
                <AppTextInput
          className="db-input"
          style={{ flex: 1, minWidth: 200 }}
          placeholder={t('admin_search_uid_email')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && runSearch()} />

                <button type="button" className="db-btn db-btn--lime" onClick={runSearch}>
                    {t('admin_search')}
                </button>
                <button
          type="button"
          className="db-btn db-btn--ghost"
          onClick={() => {
            setSearch('');
            load();
          }}>

                    {t('admin_all')}
                </button>
            </div>

            {error && <AppText as="p" style={{ color: 'var(--db-danger)', marginBottom: '1rem' }}>{error}</AppText>}

            <div className="db-panel">
                {loading ?
        <div className="db-spin" /> :
        rows.length === 0 ?
        <div className="db-empty">{t('admin_empty_accounts')}</div> :
        cfg.agents ?
        <table className="db-table">
                        <thead>
                            <tr>
                                <th>{t('admin_users_agent')}</th>
                                <th>{t('admin_users_joined')}</th>
                                <th>{t('admin_users_financial')}</th>
                                <th>{t('admin_users_status')}</th>
                                <th>{t('admin_users_actions')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((u) => {
              const s = agentStats(u);
              return (
                <tr key={u.id}>
                                        <td>
                                            <div>{nameForTab(tab, u)}</div>
                                            <div className="db-id">{u.id}</div>
                                        </td>
                                        <td>
                                            <strong style={{ color: 'var(--db-lime)' }}>{s.referred}</strong>
                                        </td>
                                        <td className="db-fin">
                                            <AppText as="span">Pending</AppText>
                                            <AppText as="span" className="pending">{fmtMoney(s.pending)}</AppText>
                                            <AppText as="span">Total earned</AppText>
                                            <AppText as="span" className="total">{fmtMoney(s.earned)}</AppText>
                                        </td>
                                        <td>
                                            <StatusBadge u={u} t={t} />
                                        </td>
                                        <td>{renderActions(u)}</td>
                                    </tr>);

            })}
                        </tbody>
                    </table> :

        <table className="db-table">
                        <thead>
                            <tr>
                                <th>{tab === 'business' ? t('admin_users_business_col') : t('admin_users_user_col')}</th>
                                <th>{t('admin_users_status')}</th>
                                <th>{t('admin_users_actions')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((u) =>
            <tr key={u.id}>
                                    <td>
                                        <div>{nameForTab(tab, u)}</div>
                                        <div className="db-id">{u.id}</div>
                                    </td>
                                    <td>
                                        <StatusBadge u={u} t={t} />
                                    </td>
                                    <td>{renderActions(u)}</td>
                                </tr>
            )}
                        </tbody>
                    </table>
        }
            </div>

            {!loading && hasNext && !search.trim() &&
      <div style={{ marginTop: '1rem' }}>
                    <button type="button" className="db-btn db-btn--ghost" onClick={() => load(cursor)}>
                        {t('admin_more')}
                    </button>
                </div>
      }
        </>);

}