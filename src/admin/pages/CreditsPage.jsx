import React, { useCallback, useState } from 'react';
import { db } from '../../firebase/config';
import { searchUsers } from '../../utils/adminUserQueries';
import { adminApi } from '../api';

export default function CreditsPage() {
    const [search, setSearch] = useState('');
    const [results, setResults] = useState([]);
    const [selected, setSelected] = useState(null);
    const [amount, setAmount] = useState(50);
    const [note, setNote] = useState('');
    const [loading, setLoading] = useState(false);
    const [granting, setGranting] = useState(false);
    const [msg, setMsg] = useState('');

    const paid = Math.max(0, Math.floor(Number(selected?.paidCredits) || 0));
    const free = Math.max(0, Math.floor(Number(selected?.freeCredits) || 0));

    const runSearch = useCallback(async () => {
        const term = search.trim();
        if (term.length < 2) return;
        setLoading(true);
        setMsg('');
        try {
            const rows = await searchUsers(db, term);
            setResults(rows.slice(0, 12));
        } catch (e) {
            setMsg(e.message || 'فشل البحث');
        } finally {
            setLoading(false);
        }
    }, [search]);

    const grant = async () => {
        if (!selected?.id) return;
        const n = Math.floor(Number(amount));
        if (!Number.isFinite(n) || n <= 0) {
            setMsg('أدخل كمية صحيحة');
            return;
        }
        if (!window.confirm(`منح ${n} رصيد مجاني فقط؟`)) return;
        setGranting(true);
        try {
            const res = await adminApi.grantFreeCredits(selected.id, n, note);
            setSelected((p) => (p ? { ...p, freeCredits: res.freeCredits } : p));
            setMsg(`تم المنح. free_credit = ${res.freeCredits}`);
        } catch (e) {
            setMsg(e.message || 'فشل');
        } finally {
            setGranting(false);
        }
    };

    return (
        <>
            <h1 className="db-h1">نظام الرصيد</h1>
            <p className="db-lead">
                فصل <strong>paid_credit</strong> و <strong>free_credit</strong>. الأدمن يمنح المجاني فقط — لا تعديل على
                المدفوع.
            </p>

            <div className="db-toolbar">
                <input
                    className="db-input"
                    style={{ flex: 1 }}
                    placeholder="بحث مستخدم"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && runSearch()}
                />
                <button type="button" className="db-btn db-btn--lime" onClick={runSearch} disabled={loading}>
                    بحث
                </button>
            </div>

            {results.length > 0 && !selected && (
                <div className="db-panel" style={{ marginBottom: '1rem', padding: '0.5rem' }}>
                    {results.map((u) => (
                        <button
                            key={u.id}
                            type="button"
                            className="db-btn db-btn--ghost"
                            style={{ display: 'block', width: '100%', textAlign: 'left', marginBottom: 4 }}
                            onClick={() => setSelected(u)}
                        >
                            {u.display_name || u.email || u.id} — مجاني: {u.freeCredits ?? 0} | مدفوع:{' '}
                            {u.paidCredits ?? 0}
                        </button>
                    ))}
                </div>
            )}

            {selected && (
                <div className="db-panel" style={{ padding: '1rem' }}>
                    <div style={{ marginBottom: '0.5rem', fontWeight: 600 }}>
                        {selected.display_name || selected.email}
                    </div>
                    <div className="db-id" style={{ marginBottom: '1rem' }}>
                        {selected.id}
                    </div>

                    <div className="db-credit-row">
                        <div className="db-credit-box db-credit-box--paid">
                            <label>paid_credit</label>
                            <div className="val">{paid}</div>
                            <small style={{ color: 'var(--db-muted)' }}>قراءة فقط</small>
                        </div>
                        <div className="db-credit-box db-credit-box--free">
                            <label>free_credit</label>
                            <div className="val">{free}</div>
                        </div>
                    </div>

                    <div className="db-toolbar">
                        <input
                            className="db-input"
                            type="number"
                            min={1}
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                        />
                        <input
                            className="db-input"
                            style={{ flex: 1 }}
                            placeholder="ملاحظة"
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                        />
                        <button type="button" className="db-btn db-btn--lime" onClick={grant} disabled={granting}>
                            منح free_credit
                        </button>
                        <button type="button" className="db-btn db-btn--ghost" onClick={() => setSelected(null)}>
                            إلغاء
                        </button>
                    </div>
                    {msg && (
                        <p style={{ marginTop: '0.75rem', color: msg.startsWith('تم') ? 'var(--db-lime)' : 'var(--db-danger)' }}>
                            {msg}
                        </p>
                    )}
                </div>
            )}
        </>
    );
}
