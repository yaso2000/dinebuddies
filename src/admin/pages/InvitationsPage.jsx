import React, { useCallback, useEffect, useState } from 'react';
import { adminApi } from '../api';

const TYPE_TABS = [
    { id: 'all', label: 'الكل' },
    { id: 'public', label: 'عامة' },
    { id: 'private', label: 'خاصة' },
    { id: 'dating', label: 'مواعدة' },
];

const TYPE_LABEL = {
    public: 'عامة',
    private: 'خاصة',
    dating: 'مواعدة',
};

export default function InvitationsPage() {
    const [inviteType, setInviteType] = useState('all');
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [cursor, setCursor] = useState(null);
    const [hasNext, setHasNext] = useState(false);
    const [acting, setActing] = useState(null);

    const load = useCallback(
        async (startAfterId = null) => {
            setLoading(true);
            try {
                const res = await adminApi.listInvitations({
                    inviteType,
                    startAfterId,
                    pageSize: 25,
                });
                setItems(res.items || []);
                setHasNext(!!res.hasNext);
                setCursor(res.lastId);
            } catch (e) {
                alert(e.message || 'فشل التحميل');
            } finally {
                setLoading(false);
            }
        },
        [inviteType]
    );

    useEffect(() => {
        load(null);
    }, [load]);

    const moderate = async (inv, action) => {
        if (!window.confirm(`تأكيد: ${action}؟`)) return;
        setActing(inv.id);
        try {
            await adminApi.moderateInvitation(inv.id, action, inv.inviteType);
            await load(null);
        } catch (e) {
            alert(e.message || 'فشل');
        } finally {
            setActing(null);
        }
    };

    const fmt = (iso) => (iso ? new Date(iso).toLocaleString() : '—');

    return (
        <>
            <h1 className="db-h1">الدعوات</h1>
            <p className="db-lead">فرز حسب النوع (عام / خاص / مواعدة) — حذف، حجب، أو إعادة نشر.</p>

            <div className="db-tabs">
                {TYPE_TABS.map((tab) => (
                    <button
                        key={tab.id}
                        type="button"
                        className={`db-tab${inviteType === tab.id ? ' active' : ''}`}
                        onClick={() => setInviteType(tab.id)}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            <div className="db-panel">
                {loading ? (
                    <div className="db-spin" />
                ) : items.length === 0 ? (
                    <div className="db-empty">لا توجد دعوات</div>
                ) : (
                    <table className="db-table">
                        <thead>
                            <tr>
                                <th>النوع</th>
                                <th>العنوان</th>
                                <th>المضيف</th>
                                <th>التاريخ</th>
                                <th>الحالة</th>
                                <th />
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((inv) => (
                                <tr key={inv.id}>
                                    <td>
                                        <span className="db-badge">
                                            {TYPE_LABEL[inv.inviteType] || inv.inviteType}
                                        </span>
                                    </td>
                                    <td>{inv.title}</td>
                                    <td>{inv.hostName || inv.hostId}</td>
                                    <td>{fmt(inv.createdAt)}</td>
                                    <td>
                                        {inv.adminBlocked && <span className="db-badge db-badge--ban">محجوب</span>}
                                        {!inv.adminBlocked && !inv.expired && (
                                            <span className="db-badge db-badge--ok">نشط</span>
                                        )}
                                        {inv.expired && !inv.adminBlocked && (
                                            <span className="db-badge db-badge--warn">منتهي</span>
                                        )}
                                    </td>
                                    <td>
                                        <div className="db-actions">
                                            <button
                                                type="button"
                                                className="db-btn db-btn--danger"
                                                disabled={acting === inv.id}
                                                onClick={() => moderate(inv, 'delete')}
                                            >
                                                حذف
                                            </button>
                                            {!inv.adminBlocked && (
                                                <button
                                                    type="button"
                                                    className="db-btn db-btn--warn"
                                                    disabled={acting === inv.id}
                                                    onClick={() => moderate(inv, 'block')}
                                                >
                                                    حجب
                                                </button>
                                            )}
                                            {(inv.adminBlocked || inv.expired) && (
                                                <button
                                                    type="button"
                                                    className="db-btn db-btn--lime"
                                                    disabled={acting === inv.id}
                                                    onClick={() => moderate(inv, 'republish')}
                                                >
                                                    إعادة نشر
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
                {hasNext && !loading && (
                    <div className="db-toolbar" style={{ marginTop: '1rem' }}>
                        <button type="button" className="db-btn" onClick={() => load(cursor)}>
                            المزيد
                        </button>
                    </div>
                )}
            </div>
        </>
    );
}
