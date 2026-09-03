import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { adminApi } from '../api';
import { ADMIN_REGIONS } from '../../utils/adminAccess';

/**
 * AI operating-mode control.
 *  - Owner: a global master switch + a per-region override for every region.
 *  - Regional manager: a switch for their own region only.
 * Shows Claude health; when Claude is down the system forces manual coverage.
 */
export default function AiModeControl() {
    const { t } = useTranslation();
    const [state, setState] = useState(null);
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState('');

    const load = useCallback(async () => {
        try {
            const res = await adminApi.getAiMode();
            setState(res);
        } catch (e) {
            setErr(e?.message || String(e));
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const apply = async (scope, mode, region) => {
        setBusy(true);
        setErr('');
        try {
            await adminApi.setAiMode(scope, mode, region);
            await load();
        } catch (e) {
            setErr(e?.message || String(e));
        } finally {
            setBusy(false);
        }
    };

    if (!state) return null;

    const down = state.config?.health === 'down';
    const label = (key) => {
        const r = ADMIN_REGIONS[key];
        return r ? `${r.emoji} ${t(r.labelKey, r.defaultLabel)}` : key;
    };

    const Toggle = ({ current, onAuto, onManual }) => (
        <div style={{ display: 'inline-flex', gap: 4 }}>
            <button
                className={`db-btn db-btn--sm ${current === 'auto' && !down ? 'db-btn--lime' : 'db-btn--ghost'}`}
                disabled={busy || down}
                onClick={onAuto}
            >🤖 {t('ai_mode_auto', 'Claude تلقائي')}</button>
            <button
                className={`db-btn db-btn--sm ${current === 'manual' || down ? 'db-btn--warn' : 'db-btn--ghost'}`}
                disabled={busy}
                onClick={onManual}
            >🧑 {t('ai_mode_manual', 'تغطية يدوية')}</button>
        </div>
    );

    return (
        <div className="db-panel" style={{ padding: '14px 16px', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                <div style={{ fontWeight: 800 }}>🤖 {t('ai_mode_title', 'وضع الذكاء الاصطناعي')}</div>
                <span className={`db-badge ${down ? 'db-badge--ban' : 'db-badge--ok'}`}>
                    {down ? t('ai_mode_down', 'Claude متوقف') : t('ai_mode_up', 'Claude يعمل')}
                </span>
            </div>

            {down ? (
                <div className="db-hint" style={{ borderInlineStartColor: 'var(--db-danger)', margin: '10px 0 4px' }}>
                    {t('ai_mode_down_note', 'تعذّر الاتصال بـ Claude — التغطية اليدوية مفعّلة تلقائيًا حتى يعود.')}
                </div>
            ) : null}

            {err ? <div className="db-hint" style={{ borderInlineStartColor: 'var(--db-danger)' }}>{err}</div> : null}

            {state.isOwner ? (
                <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
                        <span className="db-field-label" style={{ margin: 0 }}>{t('ai_mode_global', 'الوضع العام (كل الأقاليم)')}</span>
                        <Toggle
                            current={state.config.global}
                            onAuto={() => apply('global', 'auto')}
                            onManual={() => apply('global', 'manual')}
                        />
                    </div>
                    <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
                        {state.regionKeys.map((rk) => (
                            <div key={rk} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                                <span style={{ fontWeight: 600, fontSize: 14 }}>{label(rk)}</span>
                                <Toggle
                                    current={state.effective.byRegion[rk]}
                                    onAuto={() => apply('region', 'auto', rk)}
                                    onManual={() => apply('region', 'manual', rk)}
                                />
                            </div>
                        ))}
                    </div>
                </>
            ) : state.region ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
                    <span className="db-field-label" style={{ margin: 0 }}>{label(state.region)}</span>
                    <Toggle
                        current={state.effective.self}
                        onAuto={() => apply('region', 'auto', state.region)}
                        onManual={() => apply('region', 'manual', state.region)}
                    />
                </div>
            ) : null}
        </div>
    );
}
