import React, { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, doc, getDoc, updateDoc, deleteDoc, query, where } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { FaPlus, FaEdit, FaTrash, FaSync, FaSave, FaTimes } from 'react-icons/fa';
import { BASE_SUBSCRIPTION_PLANS, BASE_CREDIT_PACKS } from '../../config/planDefaults';

const Plans = () => {
    const [tab, setTab] = useState('plans');
    const [plans, setPlans] = useState([]);
    const [packs, setPacks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editorOpen, setEditorOpen] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState(emptyPlan());

    function emptyPlan() {
        return {
            name: '',
            title: '',
            description: '',
            type: 'user',
            tier: 'free',
            price: 0,
            originalPrice: 0,
            discount: 0,
            duration: { type: 'month', value: 1 },
            features: [],
            stripePriceId: '',
            active: true,
            recommended: false,
        };
    }

    useEffect(() => {
        load();
    }, []);

    const load = async () => {
        try {
            setLoading(true);
            const [plansSnap, packsSnap] = await Promise.all([
                getDocs(collection(db, 'subscriptionPlans')),
                getDocs(collection(db, 'creditPacks')),
            ]);
            setPlans(plansSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
            setPacks(packsSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const syncFromCode = async () => {
        if (!window.confirm('Sync plans and packs from code defaults? This will add new or update existing by tier/stripePriceId.')) return;
        try {
            setLoading(true);
            let planImported = 0, planUpdated = 0, packImported = 0, packUpdated = 0;

            for (const plan of BASE_SUBSCRIPTION_PLANS) {
                let existing = { empty: true };
                if (plan.stripePriceId) {
                    const q = query(collection(db, 'subscriptionPlans'), where('stripePriceId', '==', plan.stripePriceId));
                    existing = await getDocs(q);
                }
                if (existing.empty && plan.tier) {
                    const q = query(collection(db, 'subscriptionPlans'), where('tier', '==', plan.tier), where('type', '==', plan.type));
                    existing = await getDocs(q);
                }
                const data = { ...plan };
                delete data.id;
                if (existing.empty || !existing.docs?.length) {
                    await addDoc(collection(db, 'subscriptionPlans'), data);
                    planImported++;
                } else {
                    await updateDoc(doc(db, 'subscriptionPlans', existing.docs[0].id), data);
                    planUpdated++;
                }
            }

            for (const pack of BASE_CREDIT_PACKS) {
                const q = query(collection(db, 'creditPacks'), where('stripePriceId', '==', pack.stripePriceId));
                const existing = await getDocs(q);
                const data = { ...pack, active: true };
                delete data.id;
                if (existing.empty || !existing.docs?.length) {
                    await addDoc(collection(db, 'creditPacks'), data);
                    packImported++;
                } else {
                    await updateDoc(doc(db, 'creditPacks', existing.docs[0].id), data);
                    packUpdated++;
                }
            }

            alert(`Synced. Plans: ${planImported} new, ${planUpdated} updated. Packs: ${packImported} new, ${packUpdated} updated.`);
            load();
        } catch (e) {
            alert('Error: ' + e.message);
        } finally {
            setLoading(false);
        }
    };

    const openCreate = () => {
        setEditingId(null);
        setForm(emptyPlan());
        setEditorOpen(true);
    };

    const openEdit = async (id) => {
        try {
            const snap = await getDoc(doc(db, 'subscriptionPlans', id));
            if (snap.exists()) {
                const d = snap.data();
                setForm({
                    name: d.name || '',
                    title: d.title || '',
                    description: d.description || '',
                    type: d.type || 'user',
                    tier: d.tier || 'free',
                    price: d.price ?? 0,
                    originalPrice: d.originalPrice ?? 0,
                    discount: d.discount ?? 0,
                    duration: d.duration || { type: 'month', value: 1 },
                    features: Array.isArray(d.features)
                        ? d.features.map((f) => (typeof f === 'string' ? f : f?.text || ''))
                        : [],
                    stripePriceId: d.stripePriceId || '',
                    active: d.active !== false,
                    recommended: !!d.recommended,
                });
                setEditingId(id);
                setEditorOpen(true);
            }
        } catch (e) {
            alert('Error loading plan: ' + e.message);
        }
    };

    const closeEditor = () => {
        setEditorOpen(false);
        setEditingId(null);
    };

    const addFeature = () => {
        const text = window.prompt('Feature text (English):');
        if (text?.trim()) setForm((prev) => ({ ...prev, features: [...prev.features, text.trim()] }));
    };

    const removeFeature = (i) => {
        setForm((prev) => ({ ...prev, features: prev.features.filter((_, idx) => idx !== i) }));
    };

    const savePlan = async () => {
        if (!form.name?.trim()) {
            alert('Plan name is required.');
            return;
        }
        try {
            setSaving(true);
            const data = {
                ...form,
                duration: form.duration || { type: 'month', value: 1 },
                features: form.features.map((f) => (typeof f === 'string' ? f : f?.text || '')).filter(Boolean),
                updatedAt: new Date(),
            };
            if (editingId) {
                await updateDoc(doc(db, 'subscriptionPlans', editingId), data);
                alert('Plan updated.');
            } else {
                data.createdAt = new Date();
                await addDoc(collection(db, 'subscriptionPlans'), data);
                alert('Plan created.');
            }
            closeEditor();
            load();
        } catch (e) {
            alert('Error saving: ' + e.message);
        } finally {
            setSaving(false);
        }
    };

    const deletePlan = async (id) => {
        if (!window.confirm('Delete this plan? This cannot be undone.')) return;
        try {
            await deleteDoc(doc(db, 'subscriptionPlans', id));
            load();
        } catch (e) {
            alert('Error: ' + e.message);
        }
    };

    if (loading) {
        return (
            <div className="admin-loading">
                <div className="admin-spinner" />
                <p style={{ color: 'var(--admin-text-secondary)', marginTop: '1rem' }}>Loading plans…</p>
            </div>
        );
    }

    return (
        <div dir="ltr">
            <div className="admin-page-header">
                <h1 className="admin-page-title">Plans & Packs</h1>
                <p className="admin-page-subtitle">Subscription plans and credit packs. All content in English.</p>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                <button type="button" className={`admin-btn ${tab === 'plans' ? 'admin-btn-primary' : 'admin-btn-secondary'}`} onClick={() => setTab('plans')}>
                    Subscription Plans ({plans.length})
                </button>
                <button type="button" className={`admin-btn ${tab === 'packs' ? 'admin-btn-primary' : 'admin-btn-secondary'}`} onClick={() => setTab('packs')}>
                    Credit Packs ({packs.length})
                </button>
                <button type="button" className="admin-btn admin-btn-secondary" onClick={syncFromCode}>
                    <FaSync /> Sync from Code
                </button>
                {tab === 'plans' && (
                    <button type="button" className="admin-btn admin-btn-primary" onClick={openCreate}>
                        <FaPlus /> Create New Plan
                    </button>
                )}
            </div>

            {tab === 'plans' && (
                <div className="admin-grid admin-grid-3">
                    {plans.length === 0 ? (
                        <div className="admin-card">
                            <div className="admin-empty">
                                <p className="admin-empty-text">No plans yet. Click "Sync from Code" or "Create New Plan".</p>
                            </div>
                        </div>
                    ) : (
                        plans.map((p) => (
                            <div key={p.id} className="admin-card">
                                <h3 style={{ fontSize: '1.2rem', fontWeight: '700', color: 'var(--admin-text-primary)', marginBottom: '0.25rem' }}>
                                    {p.name || p.id}
                                </h3>
                                <p style={{ fontSize: '0.85rem', color: 'var(--admin-text-muted)', marginBottom: '0.75rem', minHeight: '2.5rem' }}>
                                    {p.description || '—'}
                                </p>
                                <div style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--admin-text-primary)', marginBottom: '0.5rem' }}>
                                    ${Number(p.price || 0).toFixed(2)}
                                    <span style={{ fontSize: '0.8rem', color: 'var(--admin-text-muted)', fontWeight: '500' }}>
                                        {' '}/ {p.duration?.type || 'month'}
                                    </span>
                                </div>
                                <div style={{ marginBottom: '1rem' }}>
                                    <span className={`admin-badge ${p.type === 'business' ? 'admin-badge-warning' : 'admin-badge-primary'}`}>
                                        {p.type === 'business' ? 'Business' : 'User'}
                                    </span>
                                    {p.recommended && <span className="admin-badge admin-badge-success" style={{ marginLeft: '0.5rem' }}>Recommended</span>}
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button type="button" className="admin-btn admin-btn-secondary admin-btn-sm" style={{ flex: 1 }} onClick={() => openEdit(p.id)}>
                                        <FaEdit /> Edit
                                    </button>
                                    <button type="button" className="admin-btn admin-btn-danger admin-btn-sm" onClick={() => deletePlan(p.id)}>
                                        <FaTrash />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}

            {tab === 'packs' && (
                <div className="admin-grid admin-grid-3">
                    {packs.length === 0 ? (
                        <div className="admin-card">
                            <div className="admin-empty">
                                <p className="admin-empty-text">No credit packs. Click "Sync from Code".</p>
                            </div>
                        </div>
                    ) : (
                        packs.map((p) => (
                            <div key={p.id} className="admin-card">
                                <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--admin-text-primary)' }}>{p.name || p.id}</h3>
                                <div style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--admin-text-primary)' }}>
                                    {p.amount ?? p.offerHours ?? '—'} {p.type === 'offer_slot' ? 'hours' : 'credits'}
                                </div>
                                <div style={{ color: 'var(--admin-warning)', fontWeight: '700' }}>${Number(p.price || 0).toFixed(2)}</div>
                                <p style={{ fontSize: '0.8rem', color: 'var(--admin-text-muted)' }}>Credit packs are read-only. Edit in code and sync.</p>
                            </div>
                        ))
                    )}
                </div>
            )}

            {editorOpen && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', overflow: 'auto' }}>
                    <div className="admin-card" style={{ maxWidth: '560px', width: '100%', maxHeight: '90vh', overflow: 'auto' }}>
                        <h2 style={{ marginBottom: '1rem' }}>{editingId ? 'Edit Plan' : 'Create New Plan'}</h2>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div>
                                <label className="admin-label">Plan Name *</label>
                                <input type="text" className="admin-input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Pro Plan" />
                            </div>
                            <div>
                                <label className="admin-label">Title (optional)</label>
                                <input type="text" className="admin-input" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. Most Popular" />
                            </div>
                            <div>
                                <label className="admin-label">Description</label>
                                <textarea className="admin-input" rows={2} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Plan benefits..." />
                            </div>
                            <div>
                                <label className="admin-label">Type</label>
                                <select className="admin-select" value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>
                                    <option value="user">User</option>
                                    <option value="business">Business</option>
                                </select>
                            </div>
                            <div>
                                <label className="admin-label">Tier</label>
                                <input type="text" className="admin-input" value={form.tier} onChange={(e) => setForm((f) => ({ ...f, tier: e.target.value }))} placeholder="free, pro, vip, professional, elite" />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                                <div>
                                    <label className="admin-label">Price ($)</label>
                                    <input type="number" className="admin-input" min={0} step={0.01} value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: parseFloat(e.target.value) || 0 }))} />
                                </div>
                                <div>
                                    <label className="admin-label">Original ($)</label>
                                    <input type="number" className="admin-input" min={0} step={0.01} value={form.originalPrice} onChange={(e) => setForm((f) => ({ ...f, originalPrice: parseFloat(e.target.value) || 0 }))} />
                                </div>
                                <div>
                                    <label className="admin-label">Discount %</label>
                                    <input type="number" className="admin-input" min={0} max={100} value={form.discount} onChange={(e) => setForm((f) => ({ ...f, discount: parseInt(e.target.value) || 0 }))} />
                                </div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                                <div>
                                    <label className="admin-label">Duration value</label>
                                    <input type="number" className="admin-input" min={1} value={form.duration?.value ?? 1} onChange={(e) => setForm((f) => ({ ...f, duration: { ...f.duration, value: parseInt(e.target.value) || 1 } }))} />
                                </div>
                                <div>
                                    <label className="admin-label">Duration type</label>
                                    <select className="admin-select" value={form.duration?.type || 'month'} onChange={(e) => setForm((f) => ({ ...f, duration: { ...f.duration, type: e.target.value } }))}>
                                        <option value="day">Day</option>
                                        <option value="month">Month</option>
                                        <option value="year">Year</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="admin-label">Stripe Price ID</label>
                                <input type="text" className="admin-input" value={form.stripePriceId} onChange={(e) => setForm((f) => ({ ...f, stripePriceId: e.target.value }))} placeholder="price_xxx" />
                            </div>
                            <div>
                                <label className="admin-label">Features</label>
                                {form.features.map((f, i) => (
                                    <div key={i} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                        <input type="text" className="admin-input" value={typeof f === 'string' ? f : f?.text || ''} onChange={(e) => setForm((prev) => ({ ...prev, features: prev.features.map((x, j) => (j === i ? e.target.value : x)) }))} placeholder="Feature" />
                                        <button type="button" className="admin-btn admin-btn-danger admin-btn-sm" onClick={() => removeFeature(i)}><FaTrash /></button>
                                    </div>
                                ))}
                                <button type="button" className="admin-btn admin-btn-secondary admin-btn-sm" onClick={addFeature}><FaPlus /> Add feature</button>
                            </div>
                            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', color: 'var(--admin-text-primary)' }}>
                                    <input type="checkbox" checked={form.active} onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))} />
                                    Active
                                </label>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', color: 'var(--admin-text-primary)' }}>
                                    <input type="checkbox" checked={form.recommended} onChange={(e) => setForm((f) => ({ ...f, recommended: e.target.checked }))} />
                                    Recommended
                                </label>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.5rem' }}>
                            <button type="button" className="admin-btn admin-btn-primary" onClick={savePlan} disabled={saving}><FaSave /> {saving ? 'Saving…' : 'Save'}</button>
                            <button type="button" className="admin-btn admin-btn-secondary" onClick={closeEditor}><FaTimes /> Cancel</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Plans;
