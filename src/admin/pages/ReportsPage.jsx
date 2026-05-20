import React, { useCallback, useEffect, useState } from 'react';
import { adminApi } from '../api';

const SECTIONS = [
    { id: 'accounts', types: new Set(['user', 'partner']), label: 'حسابات' },
    { id: 'invitations', types: new Set(['invitation', 'message']), label: 'دعوات' },
    { id: 'posts', types: new Set(['post']), label: 'منشورات' },
];

export default function ReportsPage() {
    const [section, setSection] = useState('accounts');
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [acting, setActing] = useState(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await adminApi.listReports({ status: 'pending', pageSize: 50 });
            setItems(res.items || []);
        } catch (e) {
            alert(e.message || 'فشل');
            setItems([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const cfg = SECTIONS.find((s) => s.id === section) || SECTIONS[0];
    const filtered = items.filter((r) => cfg.types.has(r.type));

    const resolve = async (id, status) => {
        if (!window.confirm(status === 'resolved' ? 'قبول البلاغ؟' : 'رفض البلاغ؟')) return;
        setActing(id);
        try {
            await adminApi.setReportStatus(id, status);
            setItems((prev) => prev.filter((r) => r.id !== id));
        } catch (e) {
            alert(e.message || 'فشل');
        } finally {
            setActing(null);
        }
    };

    return (
        <>
            <h1 className="db-h1">البلاغات</h1>
            <p className="db-lead">قبول (resolved) أو رفض (dismissed).</p>

            <div className="db-tabs">
                {SECTIONS.map((s) => (
                    <button
                        key={s.id}
                        type="button"
                        className={`db-tab${section === s.id ? ' active' : ''}`}
                        onClick={() => setSection(s.id)}
                    >
                        {s.label}
                    </button>
                ))}
            </div>

            <div className="db-panel">
                {loading ? (
                    <div className="db-spin" />
                ) : filtered.length === 0 ? (
                    <div className="db-empty">لا توجد بلاغات معلّقة</div>
                ) : (
                    <table className="db-table">
                        <thead>
                            <tr>
                                <th>الهدف</th>
                                <th>السبب</th>
                                <th>المبلّغ</th>
                                <th />
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((r) => (
                                <tr key={r.id}>
                                    <td>
                                        <div>{r.targetName || r.targetId}</div>
                                        <div className="db-id">{r.type}</div>
                                    </td>
                                    <td>{r.reason}</td>
                                    <td>{r.reporterName || r.reporterId}</td>
                                    <td>
                                        <div className="db-actions">
                                            <button
                                                type="button"
                                                className="db-btn db-btn--lime"
                                                disabled={acting === r.id}
                                                onClick={() => resolve(r.id, 'resolved')}
                                            >
                                                قبول
                                            </button>
                                            <button
                                                type="button"
                                                className="db-btn db-btn--ghost"
                                                disabled={acting === r.id}
                                                onClick={() => resolve(r.id, 'dismissed')}
                                            >
                                                رفض
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </>
    );
}
