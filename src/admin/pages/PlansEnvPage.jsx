import React, { useCallback, useEffect, useState } from 'react';
import { collection, getDocs, doc, updateDoc, addDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { PLAN_ENV } from '../constants';

/** @param {Record<string, unknown>|undefined} doc */
function resolvePlanEnvironment(doc) {
    const raw = String(doc?.planEnvironment || '').trim().toLowerCase();
    if (raw === PLAN_ENV.SANDBOX || raw === PLAN_ENV.PRODUCTION) return raw;
    return 'legacy';
}

/** @param {Array<Record<string, unknown>>} rows @param {'sandbox'|'production'} env */
function filterPlansForEnv(rows, env) {
    if (env === PLAN_ENV.SANDBOX) {
        return rows.filter((p) => resolvePlanEnvironment(p) === PLAN_ENV.SANDBOX);
    }
    return rows.filter((p) => {
        const pe = resolvePlanEnvironment(p);
        return pe === PLAN_ENV.PRODUCTION || pe === 'legacy';
    });
}

function filterPacksForEnv(rows, env) {
    return filterPlansForEnv(rows, env);
}

function emptyPlan(planEnvironment) {
    return {
        name: '',
        description: '',
        type: 'business',
        tier: 'paid',
        price: planEnvironment === PLAN_ENV.SANDBOX ? 0 : 0,
        stripePriceId: planEnvironment === PLAN_ENV.SANDBOX ? 'price_sandbox_test' : '',
        planEnvironment,
        active: true,
        features: [],
    };
}

/**
 * @param {{ planEnvironment: 'sandbox' | 'production' }} props
 */
export default function PlansEnvPage({ planEnvironment }) {
    const isSandbox = planEnvironment === PLAN_ENV.SANDBOX;
    const [plans, setPlans] = useState([]);
    const [packs, setPacks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState('');
    const [legacyCount, setLegacyCount] = useState(0);
    const [tab, setTab] = useState('plans');
    const [editorOpen, setEditorOpen] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [form, setForm] = useState(() => emptyPlan(planEnvironment));

    const load = useCallback(async () => {
        setLoading(true);
        setLoadError('');
        try {
            const [pSnap, cSnap] = await Promise.all([
                getDocs(collection(db, 'subscriptionPlans')),
                getDocs(collection(db, 'creditPacks')),
            ]);
            const allPlans = pSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
            const allPacks = cSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
            const legacyPlans = allPlans.filter((p) => resolvePlanEnvironment(p) === 'legacy').length;
            const legacyPacks = allPacks.filter((p) => resolvePlanEnvironment(p) === 'legacy').length;
            setLegacyCount(legacyPlans + legacyPacks);
            setPlans(filterPlansForEnv(allPlans, planEnvironment));
            setPacks(filterPacksForEnv(allPacks, planEnvironment));
        } catch (e) {
            console.error(e);
            setPlans([]);
            setPacks([]);
            setLoadError(e?.message || 'تعذّر تحميل الخطط من Firestore');
        } finally {
            setLoading(false);
        }
    }, [planEnvironment]);

    useEffect(() => {
        setForm(emptyPlan(planEnvironment));
        setEditorOpen(false);
        setEditingId(null);
        load();
    }, [planEnvironment, load]);

    const tagAsEnvironment = async (collectionName, id, targetEnv) => {
        if (!window.confirm(`تعيين planEnvironment="${targetEnv}" لهذا المستند؟`)) return;
        await updateDoc(doc(db, collectionName, id), {
            planEnvironment: targetEnv,
            updatedAt: new Date(),
        });
        load();
    };

    const savePlan = async () => {
        if (!form.name?.trim()) {
            alert('الاسم مطلوب');
            return;
        }
        const data = {
            ...form,
            planEnvironment,
            price: Number(form.price) || 0,
            features: (form.features || []).filter(Boolean),
            updatedAt: new Date(),
        };
        if (isSandbox) {
            data.stripePriceId = data.stripePriceId || `sandbox_${Date.now()}`;
        }
        if (editingId) {
            await updateDoc(doc(db, 'subscriptionPlans', editingId), data);
        } else {
            await addDoc(collection(db, 'subscriptionPlans'), { ...data, createdAt: new Date() });
        }
        setEditorOpen(false);
        setEditingId(null);
        load();
    };

    const savePack = async (pack) => {
        const data = { ...pack, planEnvironment, updatedAt: new Date() };
        if (pack.id) {
            await updateDoc(doc(db, 'creditPacks', pack.id), data);
        } else {
            await addDoc(collection(db, 'creditPacks'), { ...data, createdAt: new Date(), active: true });
        }
        load();
    };

    if (loading) return <div className="db-spin" />;

    return (
        <>
            <h1 className="db-h1">{isSandbox ? 'خطط Sandbox' : 'خطط Production'}</h1>
            <p className="db-lead">
                {isSandbox
                    ? 'تظهر فقط الوثائق التي تحمل planEnvironment = sandbox. أنشئ خطة جديدة أو انقل خططاً من Production.'
                    : 'تشمل production والخطط القديمة بدون planEnvironment (تُعرض في التطبيق).'}
            </p>

            {loadError && <p className="db-status-msg" style={{ color: '#f87171' }}>{loadError}</p>}

            {!isSandbox && legacyCount > 0 && (
                <p className="db-muted" style={{ marginBottom: '0.75rem' }}>
                    {legacyCount} مستند(ات) بدون planEnvironment — تُعامل كإنتاج في التطبيق. لعزلها في Sandbox استخدم
                    «→ Sandbox».
                </p>
            )}

            {isSandbox && plans.length === 0 && packs.length === 0 && !loadError && (
                <p className="db-muted" style={{ marginBottom: '0.75rem' }}>
                    لا توجد وثائق بـ planEnvironment=sandbox. الخطط القديمة بدون الحقل تظهر في{' '}
                    <strong>خطط Production</strong> فقط.
                </p>
            )}

            <div className={`db-env-banner db-env-banner--${isSandbox ? 'sandbox' : 'production'}`}>
                {isSandbox ? 'بيئة Sandbox — معزولة' : 'بيئة Production — حية'}
            </div>

            <div className="db-tabs">
                <button type="button" className={`db-tab${tab === 'plans' ? ' active' : ''}`} onClick={() => setTab('plans')}>
                    خطط ({plans.length})
                </button>
                <button type="button" className={`db-tab${tab === 'packs' ? ' active' : ''}`} onClick={() => setTab('packs')}>
                    حزم رصيد ({packs.length})
                </button>
            </div>

            {tab === 'plans' && (
                <>
                    <div className="db-toolbar">
                        <button
                            type="button"
                            className="db-btn db-btn--lime"
                            onClick={() => {
                                setForm(emptyPlan(planEnvironment));
                                setEditingId(null);
                                setEditorOpen(true);
                            }}
                        >
                            خطة جديدة
                        </button>
                    </div>
                    <div className="db-panel">
                        <table className="db-table">
                            <thead>
                                <tr>
                                    <th>الاسم</th>
                                    <th>البيئة</th>
                                    <th>السعر</th>
                                    <th>Stripe</th>
                                    <th />
                                </tr>
                            </thead>
                            <tbody>
                                {plans.map((p) => {
                                    const pe = resolvePlanEnvironment(p);
                                    return (
                                    <tr key={p.id}>
                                        <td>{p.name}</td>
                                        <td>
                                            {pe === 'legacy' ? (
                                                <span className="db-badge db-badge--warn">قديمة</span>
                                            ) : (
                                                <span className="db-badge">{pe}</span>
                                            )}
                                        </td>
                                        <td>${Number(p.price || 0).toFixed(2)}</td>
                                        <td className="db-id">{p.stripePriceId || '—'}</td>
                                        <td>
                                            <div className="db-actions">
                                                <button
                                                    type="button"
                                                    className="db-btn db-btn--ghost"
                                                    onClick={() => {
                                                        setForm({ ...emptyPlan(planEnvironment), ...p });
                                                        setEditingId(p.id);
                                                        setEditorOpen(true);
                                                    }}
                                                >
                                                    تعديل
                                                </button>
                                                {!isSandbox && pe === 'legacy' && (
                                                    <button
                                                        type="button"
                                                        className="db-btn db-btn--lime"
                                                        onClick={() =>
                                                            tagAsEnvironment(
                                                                'subscriptionPlans',
                                                                p.id,
                                                                PLAN_ENV.SANDBOX
                                                            )
                                                        }
                                                    >
                                                        → Sandbox
                                                    </button>
                                                )}
                                                {isSandbox && (
                                                    <button
                                                        type="button"
                                                        className="db-btn db-btn--ghost"
                                                        onClick={() =>
                                                            tagAsEnvironment(
                                                                'subscriptionPlans',
                                                                p.id,
                                                                PLAN_ENV.PRODUCTION
                                                            )
                                                        }
                                                    >
                                                        → Production
                                                    </button>
                                                )}
                                                <button
                                                    type="button"
                                                    className="db-btn db-btn--danger"
                                                    onClick={async () => {
                                                        if (window.confirm('حذف؟')) {
                                                            await deleteDoc(doc(db, 'subscriptionPlans', p.id));
                                                            load();
                                                        }
                                                    }}
                                                >
                                                    حذف
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                        {plans.length === 0 && <div className="db-empty">لا خطط في هذه البيئة</div>}
                    </div>

                    {editorOpen && (
                        <div className="db-panel" style={{ marginTop: '1rem', padding: '1rem' }}>
                            <div className="db-toolbar" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                                <input
                                    className="db-input"
                                    placeholder="اسم الخطة"
                                    value={form.name}
                                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                                />
                                <input
                                    className="db-input"
                                    type="number"
                                    placeholder="السعر USD"
                                    value={form.price}
                                    onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                                />
                                <input
                                    className="db-input"
                                    placeholder="Stripe Price ID"
                                    value={form.stripePriceId}
                                    onChange={(e) => setForm((f) => ({ ...f, stripePriceId: e.target.value }))}
                                />
                                <div className="db-actions">
                                    <button type="button" className="db-btn db-btn--lime" onClick={savePlan}>
                                        حفظ
                                    </button>
                                    <button
                                        type="button"
                                        className="db-btn db-btn--ghost"
                                        onClick={() => setEditorOpen(false)}
                                    >
                                        إلغاء
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}

            {tab === 'packs' && (
                <div className="db-panel">
                    <table className="db-table">
                        <thead>
                            <tr>
                                <th>الحزمة</th>
                                <th>رصيد</th>
                                <th>السعر</th>
                            </tr>
                        </thead>
                        <tbody>
                            {packs.map((p) => (
                                <tr key={p.id}>
                                    <td>{p.name || p.id}</td>
                                    <td>{p.amount ?? p.credits ?? '—'}</td>
                                    <td>${Number(p.price || 0).toFixed(2)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {packs.length === 0 && (
                        <div className="db-empty">
                            لا حزم — أضف يدوياً في Firestore مع planEnvironment=&quot;{planEnvironment}&quot;
                        </div>
                    )}
                </div>
            )}
        </>
    );
}
