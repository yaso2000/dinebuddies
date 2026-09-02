import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { adminApi } from '../api';
import { ADMIN_REGION_LIST } from '../../utils/adminAccess';

/**
 * Owner-only: securely provision regional managers.
 * The manager account is created by the owner and privileged server-side; the
 * owner never sets or sees the password — a one-time setup link is generated
 * for the manager to set their own.
 */
export default function ManagersPage() {
    const { t } = useTranslation();
    const [email, setEmail] = useState('');
    const [region, setRegion] = useState(ADMIN_REGION_LIST[0]?.key || '');
    const [displayName, setDisplayName] = useState('');
    const [creating, setCreating] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState('');
    const [copied, setCopied] = useState(false);

    const [managers, setManagers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [accessLog, setAccessLog] = useState([]);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [mgrs, log] = await Promise.all([
                adminApi.listRegionalManagers(),
                adminApi.listAccessLog(40).catch(() => ({ entries: [] })),
            ]);
            setManagers(Array.isArray(mgrs?.managers) ? mgrs.managers : []);
            setAccessLog(Array.isArray(log?.entries) ? log.entries : []);
        } catch (e) {
            setError(e?.message || String(e));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const create = async () => {
        setError('');
        setResult(null);
        setCopied(false);
        if (!email.trim()) {
            setError(t('admin_mgr_email_required', 'أدخل بريدًا صحيحًا'));
            return;
        }
        setCreating(true);
        try {
            const res = await adminApi.createRegionalManager(email.trim(), region, displayName.trim());
            setResult(res);
            setEmail('');
            setDisplayName('');
            await load();
        } catch (e) {
            setError(e?.message || String(e));
        } finally {
            setCreating(false);
        }
    };

    const revoke = async (uid, label) => {
        if (!window.confirm(t('admin_mgr_revoke_confirm', 'إلغاء صلاحيات هذا المدير؟ سيُمنع من الدخول.') + `\n${label}`)) {
            return;
        }
        try {
            await adminApi.revokeRegionalManager(uid);
            await load();
        } catch (e) {
            setError(e?.message || String(e));
        }
    };

    const copyLink = async () => {
        if (!result?.setupLink) return;
        try {
            await navigator.clipboard.writeText(result.setupLink);
            setCopied(true);
            setTimeout(() => setCopied(false), 2500);
        } catch {
            /* clipboard blocked — the link is shown for manual copy */
        }
    };

    const regionLabel = (key) => {
        const r = ADMIN_REGION_LIST.find((x) => x.key === key);
        return r ? `${r.emoji} ${t(r.labelKey, r.defaultLabel)}` : key;
    };

    return (
        <div>
            <h1 className="db-h1">{t('admin_mgr_title', 'المدراء الإقليميون')}</h1>
            <p className="db-lead">
                {t('admin_mgr_lead', 'أنشئ حساب مدير إقليمي وعيّن منطقته. لا يمكن لأحد التسجيل كمدير — المالك وحده يُنشئ الحساب، ثم يرسل رابط التعيين للمدير ليضع كلمة مروره بنفسه.')}
            </p>

            {error ? <div className="db-hint" style={{ borderInlineStartColor: 'var(--db-danger)' }}><strong>{error}</strong></div> : null}

            <div className="db-panel" style={{ padding: '18px 20px', marginBottom: 18 }}>
                <h2 className="db-h2">{t('admin_mgr_create', 'إنشاء مدير جديد')}</h2>
                <div className="db-toolbar" style={{ marginBottom: 12 }}>
                    <input
                        className="db-input"
                        type="email"
                        placeholder={t('admin_mgr_email', 'بريد المدير')}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        style={{ minWidth: 220 }}
                    />
                    <input
                        className="db-input"
                        placeholder={t('admin_mgr_name', 'الاسم (اختياري)')}
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                    />
                    <select className="db-select" value={region} onChange={(e) => setRegion(e.target.value)}>
                        {ADMIN_REGION_LIST.map((r) => (
                            <option key={r.key} value={r.key}>
                                {r.emoji} {t(r.labelKey, r.defaultLabel)}
                            </option>
                        ))}
                    </select>
                    <button className="db-btn db-btn--lime" onClick={create} disabled={creating}>
                        {creating ? t('admin_mgr_creating', 'جارٍ الإنشاء…') : t('admin_mgr_create_btn', 'إنشاء + رابط تعيين')}
                    </button>
                </div>

                {result ? (
                    <div
                        className="db-hint"
                        style={{ borderInlineStartColor: 'var(--db-lime)', marginBottom: 0 }}
                    >
                        <strong>
                            {result.created
                                ? t('admin_mgr_created_ok', 'تم إنشاء الحساب')
                                : t('admin_mgr_promoted_ok', 'تمت ترقية حساب موجود')}
                            {' '}({result.email} — {regionLabel(result.region)})
                        </strong>
                        <div style={{ marginTop: 10 }}>
                            {result.setupLink ? (
                                <>
                                    <div className="db-field-label">{t('admin_mgr_setup_link', 'رابط تعيين كلمة المرور — أرسله للمدير')}</div>
                                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                                        <input className="db-input" readOnly value={result.setupLink} style={{ flex: 1, minWidth: 260, direction: 'ltr' }} />
                                        <button className="db-btn" onClick={copyLink}>
                                            {copied ? t('admin_mgr_copied', 'تم النسخ ✓') : t('admin_mgr_copy', 'نسخ')}
                                        </button>
                                    </div>
                                    <div className="db-muted" style={{ marginTop: 6 }}>
                                        {t('admin_mgr_setup_note', 'الرابط صالح لفترة محدودة. المدير يفتحه ويضع كلمة مروره، ثم يدخل من صفحة الدخول العادية.')}
                                    </div>
                                </>
                            ) : (
                                <span className="db-muted">{t('admin_mgr_no_link', 'تعذّر توليد الرابط — استخدم «نسيت كلمة المرور» ببريد المدير.')}</span>
                            )}
                        </div>
                    </div>
                ) : null}
            </div>

            <div className="db-panel">
                <table className="db-table">
                    <thead>
                        <tr>
                            <th>{t('admin_mgr_col_email', 'البريد')}</th>
                            <th>{t('admin_mgr_col_region', 'المنطقة')}</th>
                            <th>{t('admin_mgr_col_actions', 'إجراءات')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={3}><div className="db-spin" /></td></tr>
                        ) : managers.length === 0 ? (
                            <tr><td colSpan={3}><div className="db-empty">{t('admin_mgr_empty', 'لا يوجد مدراء إقليميون بعد.')}</div></td></tr>
                        ) : (
                            managers.map((m) => (
                                <tr key={m.uid}>
                                    <td>
                                        <div style={{ fontWeight: 700 }}>{m.displayName || '—'}</div>
                                        <div className="db-id">{m.email || m.uid}</div>
                                    </td>
                                    <td><span className="db-badge db-badge--ok">{regionLabel(m.region)}</span></td>
                                    <td>
                                        <div className="db-actions">
                                            <button
                                                className="db-btn db-btn--danger"
                                                onClick={() => revoke(m.uid, m.email || m.uid)}
                                            >
                                                {t('admin_mgr_revoke', 'إلغاء الصلاحية')}
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            <h2 className="db-h2" style={{ marginTop: 28 }}>{t('admin_access_title', 'آخر عمليات الدخول')}</h2>
            <p className="db-lead">{t('admin_access_lead', 'سجل دخول المدراء إلى اللوحة. يصلك تنبيه فوري عند دخول مدير من جهاز جديد.')}</p>
            <div className="db-panel">
                <table className="db-table">
                    <thead>
                        <tr>
                            <th>{t('admin_access_who', 'المستخدم')}</th>
                            <th>{t('admin_access_region', 'المنطقة')}</th>
                            <th>IP</th>
                            <th>{t('admin_access_when', 'الوقت')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {accessLog.length === 0 ? (
                            <tr><td colSpan={4}><div className="db-empty">{t('admin_access_empty', 'لا سجل بعد.')}</div></td></tr>
                        ) : (
                            accessLog.map((e) => (
                                <tr key={e.id}>
                                    <td>
                                        <div style={{ fontWeight: 600 }}>{e.email || '—'}</div>
                                        <div className="db-id">{e.role || 'admin'}{e.isNewDevice ? ' · ' : ''}
                                            {e.isNewDevice ? <span className="db-badge db-badge--warn">{t('admin_access_new_device', 'جهاز جديد')}</span> : null}
                                        </div>
                                    </td>
                                    <td>{e.region ? regionLabel(e.region) : '—'}</td>
                                    <td className="db-id">{e.ip || '—'}</td>
                                    <td className="db-muted">{e.at ? new Date(e.at).toLocaleString() : '—'}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
