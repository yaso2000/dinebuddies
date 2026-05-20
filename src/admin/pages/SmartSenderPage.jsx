import React, { useCallback, useEffect, useState } from 'react';
import { adminApi } from '../api';

const AUDIENCE_OPTIONS = [
    { id: 'all', label: 'الكل' },
    { id: 'user', label: 'مستخدمون عاديون' },
    { id: 'business', label: 'أعمال' },
    { id: 'affiliate_agent', label: 'وكلاء' },
    { id: 'id', label: 'بحث بالمعرّف (UID)' },
];

export default function SmartSenderPage() {
    const [audience, setAudience] = useState('all');
    const [targetUid, setTargetUid] = useState('');
    const [message, setMessage] = useState('');
    const [sending, setSending] = useState(false);
    const [status, setStatus] = useState('');
    const [history, setHistory] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(true);

    const loadHistory = useCallback(async () => {
        setLoadingHistory(true);
        try {
            const res = await adminApi.listAnnouncements({ pageSize: 15 });
            setHistory(res.items || []);
        } catch (e) {
            setStatus(e.message || 'تعذّر تحميل السجل');
        } finally {
            setLoadingHistory(false);
        }
    }, []);

    useEffect(() => {
        loadHistory();
    }, [loadHistory]);

    const send = async () => {
        const text = message.trim();
        if (!text) {
            setStatus('اكتب نص الرسالة أولاً');
            return;
        }
        if (audience === 'id' && !targetUid.trim()) {
            setStatus('أدخل معرّف المستخدم');
            return;
        }
        const label = AUDIENCE_OPTIONS.find((o) => o.id === audience)?.label || audience;
        if (
            !window.confirm(
                `إرسال رسالة جماعية إلى: ${label}${audience === 'id' ? ` (${targetUid.trim()})` : ''}؟`
            )
        ) {
            return;
        }

        setSending(true);
        setStatus('');
        try {
            const res = await adminApi.sendMassMessage({
                audience,
                targetUid: audience === 'id' ? targetUid.trim() : undefined,
                message: text,
            });
            setStatus(
                `تم الإرسال: ${res.sentCount}/${res.targetCount} مستلم` +
                    (res.failedCount ? ` — فشل ${res.failedCount}` : '')
            );
            setMessage('');
            await loadHistory();
        } catch (e) {
            setStatus(e.message || 'فشل الإرسال');
        } finally {
            setSending(false);
        }
    };

    const fmt = (iso) => (iso ? new Date(iso).toLocaleString() : '—');
    const audienceLabel = (id) => AUDIENCE_OPTIONS.find((o) => o.id === id)?.label || id;

    return (
        <>
            <h1 className="db-h1">المرسل الذكي</h1>
            <p className="db-lead">
                رسائل نظامية في الدردشة باسم DineBuddies مع إشعار FCM — وسجل الحملات في admin_announcements.
            </p>

            <div className="db-panel" style={{ marginBottom: '1rem' }}>
                <div className="db-field-label">الجمهور</div>
                <div className="db-tabs" style={{ marginBottom: '1rem', flexWrap: 'wrap' }}>
                    {AUDIENCE_OPTIONS.map((opt) => (
                        <button
                            key={opt.id}
                            type="button"
                            className={`db-tab${audience === opt.id ? ' active' : ''}`}
                            onClick={() => setAudience(opt.id)}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>

                {audience === 'id' && (
                    <input
                        className="db-input"
                        style={{ width: '100%', marginBottom: '1rem' }}
                        placeholder="UID المستخدم"
                        value={targetUid}
                        onChange={(e) => setTargetUid(e.target.value)}
                    />
                )}

                <div className="db-field-label">نص الرسالة</div>
                <textarea
                    className="db-input"
                    rows={6}
                    style={{ width: '100%', resize: 'vertical', marginBottom: '1rem' }}
                    placeholder="رسالة من DineBuddies Support…"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    maxLength={4000}
                />

                <div className="db-toolbar">
                    <button
                        type="button"
                        className="db-btn db-btn--lime"
                        onClick={send}
                        disabled={sending}
                    >
                        {sending ? 'جاري الإرسال…' : 'إرسال'}
                    </button>
                    <span className="db-muted">{message.length}/4000</span>
                </div>

                {status && <p className="db-status-msg">{status}</p>}
            </div>

            <h2 className="db-h2">سجل الحملات</h2>
            <div className="db-panel">
                {loadingHistory ? (
                    <div className="db-spin" />
                ) : history.length === 0 ? (
                    <div className="db-empty">لا توجد حملات بعد</div>
                ) : (
                    <table className="db-table">
                        <thead>
                            <tr>
                                <th>التاريخ</th>
                                <th>الجمهور</th>
                                <th>المستهدفون</th>
                                <th>المرسلة</th>
                                <th>النص</th>
                            </tr>
                        </thead>
                        <tbody>
                            {history.map((row) => (
                                <tr key={row.id}>
                                    <td>{fmt(row.createdAt)}</td>
                                    <td>{audienceLabel(row.audience)}</td>
                                    <td>{row.targetCount}</td>
                                    <td>
                                        {row.sentCount}
                                        {row.failedCount > 0 && (
                                            <span className="db-badge db-badge--warn" style={{ marginInlineStart: 6 }}>
                                                فشل {row.failedCount}
                                            </span>
                                        )}
                                    </td>
                                    <td style={{ maxWidth: 320 }}>{row.message}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </>
    );
}
