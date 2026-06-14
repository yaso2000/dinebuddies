import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { adminApi } from '../api';

const AUDIENCE_OPTIONS = [
    { id: 'all', labelKey: 'admin_sender_audience_all' },
    { id: 'user', labelKey: 'admin_sender_audience_users' },
    { id: 'business', labelKey: 'admin_sender_audience_business' },
    { id: 'affiliate_agent', labelKey: 'admin_sender_audience_agents' },
    { id: 'id', labelKey: 'admin_sender_audience_by_uid' },
];

export default function SmartSenderPage() {
    const { t } = useTranslation();
    const [audience, setAudience] = useState('all');
    const [targetUid, setTargetUid] = useState('');
    const [message, setMessage] = useState('');
    const [sending, setSending] = useState(false);
    const [status, setStatus] = useState('');
    const [history, setHistory] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(true);

    const audienceLabel = useCallback(
        (id) => {
            const opt = AUDIENCE_OPTIONS.find((o) => o.id === id);
            return opt ? t(opt.labelKey) : id;
        },
        [t],
    );

    const loadHistory = useCallback(async () => {
        setLoadingHistory(true);
        try {
            const res = await adminApi.listAnnouncements({ pageSize: 15 });
            setHistory(res.items || []);
        } catch (e) {
            setStatus(e.message || t('admin_sender_history_load_failed'));
        } finally {
            setLoadingHistory(false);
        }
    }, [t]);

    useEffect(() => {
        loadHistory();
    }, [loadHistory]);

    const send = async () => {
        const text = message.trim();
        if (!text) {
            setStatus(t('admin_sender_enter_message'));
            return;
        }
        if (audience === 'id' && !targetUid.trim()) {
            setStatus(t('admin_sender_enter_uid'));
            return;
        }
        const label = audienceLabel(audience);
        const uidSuffix = audience === 'id' ? ` (${targetUid.trim()})` : '';
        if (
            !window.confirm(
                t('admin_sender_confirm_mass', { label, uidSuffix }),
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
            const failedSuffix = res.failedCount
                ? ` — ${t('admin_sender_failed_count', { count: res.failedCount })}`
                : '';
            setStatus(
                t('admin_sender_sent_result', {
                    sent: res.sentCount,
                    total: res.targetCount,
                    failedSuffix,
                }),
            );
            setMessage('');
            await loadHistory();
        } catch (e) {
            setStatus(e.message || t('admin_failed'));
        } finally {
            setSending(false);
        }
    };

    const fmt = (iso) => (iso ? new Date(iso).toLocaleString() : '—');

    return (
        <>
            <h1 className="db-h1">{t('admin_sender_title')}</h1>
            <p className="db-lead">{t('admin_sender_lead')}</p>

            <div className="db-panel" style={{ marginBottom: '1rem' }}>
                <div className="db-field-label">{t('admin_sender_audience')}</div>
                <div className="db-tabs" style={{ marginBottom: '1rem', flexWrap: 'wrap' }}>
                    {AUDIENCE_OPTIONS.map((opt) => (
                        <button
                            key={opt.id}
                            type="button"
                            className={`db-tab${audience === opt.id ? ' active' : ''}`}
                            onClick={() => setAudience(opt.id)}
                        >
                            {t(opt.labelKey)}
                        </button>
                    ))}
                </div>

                {audience === 'id' && (
                    <input
                        className="db-input"
                        style={{ width: '100%', marginBottom: '1rem' }}
                        placeholder={t('admin_sender_uid_placeholder')}
                        value={targetUid}
                        onChange={(e) => setTargetUid(e.target.value)}
                    />
                )}

                <div className="db-field-label">{t('admin_sender_message_body')}</div>
                <textarea
                    className="db-input"
                    rows={6}
                    style={{ width: '100%', resize: 'vertical', marginBottom: '1rem' }}
                    placeholder={t('admin_sender_message_placeholder')}
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
                        {sending ? t('admin_sender_sending') : t('admin_sender_send')}
                    </button>
                    <span className="db-muted">{message.length}/4000</span>
                </div>

                {status && <p className="db-status-msg">{status}</p>}
            </div>

            <h2 className="db-h2">{t('admin_sender_campaign_history')}</h2>
            <div className="db-panel">
                {loadingHistory ? (
                    <div className="db-spin" />
                ) : history.length === 0 ? (
                    <div className="db-empty">{t('admin_sender_empty_history')}</div>
                ) : (
                    <table className="db-table">
                        <thead>
                            <tr>
                                <th>{t('admin_sender_date')}</th>
                                <th>{t('admin_sender_audience')}</th>
                                <th>{t('admin_sender_recipients')}</th>
                                <th>{t('admin_sender_sent_col')}</th>
                                <th>{t('admin_sender_text_col')}</th>
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
                                                {t('admin_sender_failed_count', { count: row.failedCount })}
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
