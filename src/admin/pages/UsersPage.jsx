import React, { useCallback, useEffect, useState } from 'react';
import { db } from '../../firebase/config';
import { browseUsersPage, searchUsers } from '../../utils/adminUserQueries';
import { adminApi } from '../api';

const USER_TABS = [
    {
        id: 'regular',
        label: 'مستخدم عادي',
        roleFilter: 'user',
        hint: 'صلاحيات: بوستات، دعوات، شات.',
        freezeDays: 7,
        freezeLabel: 'تجميد 7 أيام',
    },
    {
        id: 'business',
        label: 'أعمال',
        roleFilter: 'business',
        hint: 'صلاحيات: بوستات وعروض، دعوات رسمية، شات.',
        freezeDays: null,
        freezeLabel: 'تجميد الحساب',
        verifyPlaceholder: true,
    },
    {
        id: 'agents',
        label: 'وكلاء',
        roleFilter: 'affiliate_agent',
        hint: 'لوحة خارجية فقط — قراءة العدادات من وثيقة الوكيل (total_referred_users، pending_commissions، total_earned).',
        agents: true,
    },
];

function fmtMoney(cents) {
    const n = Math.max(0, Math.floor(Number(cents) || 0));
    return `$${(n / 100).toFixed(2)}`;
}

function agentStats(u) {
    const referred =
        typeof u.total_referred_users === 'number'
            ? Math.max(0, Math.floor(u.total_referred_users))
            : Math.max(
                  0,
                  Math.floor(Number(u.successful_referrals_count) || 0) +
                      Math.floor(Number(u.pending_referrals_count) || 0)
              );
    const pending =
        typeof u.pending_commissions === 'number'
            ? Math.max(0, Math.floor(u.pending_commissions))
            : Math.max(0, Math.floor(Number(u.current_balance) || 0));
    const earned =
        typeof u.total_earned === 'number' ? Math.max(0, Math.floor(u.total_earned)) : 0;
    return { referred, pending, earned };
}

function StatusBadge({ u }) {
    if (u.banned) return <span className="db-badge db-badge--ban">محظور</span>;
    if (u.frozen) return <span className="db-badge db-badge--warn">مجمّد</span>;
    return <span className="db-badge db-badge--ok">نشط</span>;
}

function nameForTab(tab, u) {
    if (tab === 'business') {
        return u.businessInfo?.businessName || u.businessInfo?.name || u.display_name || u.email || u.id;
    }
    return u.display_name || u.displayName || u.nickname || u.name || u.email || u.id;
}

export default function UsersPage() {
    const [tab, setTab] = useState('regular');
    const cfg = USER_TABS.find((t) => t.id === tab) || USER_TABS[0];

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
                    pageSize: 25,
                });
                setRows(res.users);
                setHasNext(res.hasNext);
                setCursor(res.lastId);
            } catch (e) {
                setError(e.message || 'فشل التحميل');
            } finally {
                setLoading(false);
            }
        },
        [cfg.roleFilter]
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
            setError(e.message || 'فشل البحث');
        } finally {
            setLoading(false);
        }
    }, [search, load, cfg.roleFilter]);

    useEffect(() => {
        setSearch('');
        load(null);
    }, [tab, load]);

    const act = async (uid, fn) => {
        if (!window.confirm('تأكيد الإجراء؟')) return;
        setActing(uid);
        try {
            await fn();
            if (search.trim().length >= 2) await runSearch();
            else await load();
        } catch (e) {
            alert(e.message || 'فشل');
        } finally {
            setActing(null);
        }
    };

    const renderActions = (u) => {
        if (cfg.agents) {
            return (
                <div className="db-actions">
                    {!u.banned && (
                        <>
                            <button
                                type="button"
                                className="db-btn db-btn--warn"
                                disabled={acting === u.id}
                                onClick={() =>
                                    act(u.id, () => adminApi.setUserFreezeStatus(u.id, true, null))
                                }
                            >
                                تجميد لوحة الوكيل
                            </button>
                            <button
                                type="button"
                                className="db-btn db-btn--danger"
                                disabled={acting === u.id}
                                onClick={() => act(u.id, () => adminApi.setUserBanStatus(u.id, true))}
                            >
                                حظر نهائي
                            </button>
                            <button type="button" className="db-btn" disabled title="قريباً">
                                تحويل مالي
                            </button>
                        </>
                    )}
                    {u.frozen && !u.banned && (
                        <button
                            type="button"
                            className="db-btn db-btn--lime"
                            disabled={acting === u.id}
                            onClick={() => act(u.id, () => adminApi.setUserFreezeStatus(u.id, false))}
                        >
                            إلغاء التجميد
                        </button>
                    )}
                    {u.banned && (
                        <button
                            type="button"
                            className="db-btn db-btn--lime"
                            disabled={acting === u.id}
                            onClick={() => act(u.id, () => adminApi.setUserBanStatus(u.id, false))}
                        >
                            إلغاء الحظر
                        </button>
                    )}
                </div>
            );
        }

        return (
            <div className="db-actions">
                {!u.banned && (
                    <>
                        <button
                            type="button"
                            className="db-btn db-btn--warn"
                            disabled={acting === u.id}
                            onClick={() =>
                                act(u.id, () =>
                                    adminApi.setUserFreezeStatus(u.id, true, cfg.freezeDays ?? 7)
                                )
                            }
                        >
                            {cfg.freezeLabel}
                        </button>
                        <button
                            type="button"
                            className="db-btn db-btn--danger"
                            disabled={acting === u.id}
                            onClick={() => act(u.id, () => adminApi.setUserBanStatus(u.id, true))}
                        >
                            حظر نهائي
                        </button>
                        {cfg.verifyPlaceholder && (
                            <button type="button" className="db-btn" disabled title="قريباً">
                                توثيق
                            </button>
                        )}
                    </>
                )}
                {u.frozen && !u.banned && (
                    <button
                        type="button"
                        className="db-btn db-btn--lime"
                        disabled={acting === u.id}
                        onClick={() => act(u.id, () => adminApi.setUserFreezeStatus(u.id, false))}
                    >
                        إلغاء التجميد
                    </button>
                )}
                {u.banned && (
                    <button
                        type="button"
                        className="db-btn db-btn--lime"
                        disabled={acting === u.id}
                        onClick={() => act(u.id, () => adminApi.setUserBanStatus(u.id, false))}
                    >
                        إلغاء الحظر
                    </button>
                )}
            </div>
        );
    };

    return (
        <>
            <h1 className="db-h1">إدارة المستخدمين</h1>
            <p className="db-lead">فصل الأدوار — إجراءات مباشرة، قراءة paginated فقط.</p>

            <div className="db-tabs">
                {USER_TABS.map((t) => (
                    <button
                        key={t.id}
                        type="button"
                        className={`db-tab${tab === t.id ? ' active' : ''}`}
                        onClick={() => setTab(t.id)}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            <p className="db-hint">
                <strong>{cfg.label}:</strong> {cfg.hint}
            </p>

            <div className="db-toolbar">
                <input
                    className="db-input"
                    style={{ flex: 1, minWidth: 200 }}
                    placeholder="بحث UID / بريد / اسم"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && runSearch()}
                />
                <button type="button" className="db-btn db-btn--lime" onClick={runSearch}>
                    بحث
                </button>
                <button
                    type="button"
                    className="db-btn db-btn--ghost"
                    onClick={() => {
                        setSearch('');
                        load();
                    }}
                >
                    الكل
                </button>
            </div>

            {error && <p style={{ color: 'var(--db-danger)', marginBottom: '1rem' }}>{error}</p>}

            <div className="db-panel">
                {loading ? (
                    <div className="db-spin" />
                ) : rows.length === 0 ? (
                    <div className="db-empty">لا توجد حسابات</div>
                ) : cfg.agents ? (
                    <table className="db-table">
                        <thead>
                            <tr>
                                <th>الوكيل</th>
                                <th>منضمون</th>
                                <th>مالي</th>
                                <th>الحالة</th>
                                <th>إجراءات</th>
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
                                            <span>Pending</span>
                                            <span className="pending">{fmtMoney(s.pending)}</span>
                                            <span>Total earned</span>
                                            <span className="total">{fmtMoney(s.earned)}</span>
                                        </td>
                                        <td>
                                            <StatusBadge u={u} />
                                        </td>
                                        <td>{renderActions(u)}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                ) : (
                    <table className="db-table">
                        <thead>
                            <tr>
                                <th>{tab === 'business' ? 'المنشأة' : 'المستخدم'}</th>
                                <th>الحالة</th>
                                <th>إجراءات</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((u) => (
                                <tr key={u.id}>
                                    <td>
                                        <div>{nameForTab(tab, u)}</div>
                                        <div className="db-id">{u.id}</div>
                                    </td>
                                    <td>
                                        <StatusBadge u={u} />
                                    </td>
                                    <td>{renderActions(u)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {!loading && hasNext && !search.trim() && (
                <div style={{ marginTop: '1rem' }}>
                    <button type="button" className="db-btn db-btn--ghost" onClick={() => load(cursor)}>
                        المزيد
                    </button>
                </div>
            )}
        </>
    );
}
