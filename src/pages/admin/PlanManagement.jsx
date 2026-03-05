import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { FaPlus, FaEdit, FaTrash, FaEye, FaToggleOn, FaToggleOff, FaCrown, FaSync } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';
import { BASE_SUBSCRIPTION_PLANS, BASE_CREDIT_PACKS } from '../../config/planDefaults';

const PlanManagement = () => {
    const navigate = useNavigate();
    const { t, i18n } = useTranslation();
    const [plans, setPlans] = useState([]);
    const [creditPacks, setCreditPacks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState('plans'); // 'plans' or 'packs'
    const [filterType, setFilterType] = useState('all');

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const plansSnapshot = await getDocs(collection(db, 'subscriptionPlans'));
            const plansData = plansSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            const packsSnapshot = await getDocs(collection(db, 'creditPacks'));
            const packsData = packsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            setPlans(plansData);
            setCreditPacks(packsData);
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchPlans = fetchData; // For backward compatibility in sync logic

    const handleToggleActive = async (planId, currentStatus) => {
        try {
            await updateDoc(doc(db, 'subscriptionPlans', planId), {
                active: !currentStatus
            });
            setPlans(plans.map(plan =>
                plan.id === planId ? { ...plan, active: !currentStatus } : plan
            ));
        } catch (error) {
            console.error('Error toggling plan:', error);
            alert('Failed to update plan status');
        }
    };

    const handleDeletePlan = async (planId) => {
        if (!window.confirm(t('admin_delete_plan_confirm'))) return;

        try {
            await deleteDoc(doc(db, 'subscriptionPlans', planId));
            setPlans(plans.filter(plan => plan.id !== planId));
            alert(t('admin_delete_plan_success'));
        } catch (error) {
            console.error('Error deleting plan:', error);
            alert(t('admin_delete_plan_error'));
        }
    };

    const filteredPlans = filterType === 'all'
        ? plans
        : plans.filter(plan => plan.type === filterType);

    if (loading) {
        return (
            <div className="admin-loading">
                <div style={{ textAlign: 'center' }}>
                    <div className="admin-spinner" />
                    <p style={{ color: '#94a3b8', fontSize: '1rem', marginTop: '1rem' }}>Loading plans...</p>
                </div>
            </div>
        );
    }

    return (
        <div>
            {/* Header */}
            <div className="admin-flex-between admin-mb-4" dir="ltr">
                <div className="admin-page-header" style={{ marginBottom: 0 }}>
                    <h1 className="admin-page-title">Plan Management</h1>
                    <p className="admin-page-subtitle">Manage and sync subscription plans with Stripe</p>
                </div>
                <div className="admin-flex admin-gap-2">
                    {plans.length === 0 && (
                        <>
                            <button
                                onClick={async () => {
                                    if (!window.confirm(t('admin_sync_all_confirm'))) return;
                                    try {
                                        const { doc, setDoc, collection, addDoc, getDocs, query, where, updateDoc } = await import('firebase/firestore');

                                        let planSummary = { imported: 0, updated: 0 };
                                        let packSummary = { imported: 0, updated: 0 };

                                        // 1. Sync Subscription Plans
                                        for (const plan of BASE_SUBSCRIPTION_PLANS) {
                                            let existingQ = plan.stripePriceId
                                                ? query(collection(db, 'subscriptionPlans'), where('stripePriceId', '==', plan.stripePriceId))
                                                : null;

                                            let existing = existingQ ? await getDocs(existingQ) : { empty: true };

                                            if (existing.empty && plan.tier) {
                                                const tierQ = query(collection(db, 'subscriptionPlans'), where('tier', '==', plan.tier), where('type', '==', plan.type));
                                                existing = await getDocs(tierQ);
                                            }

                                            if (existing.empty) {
                                                const planData = { ...plan, createdAt: new Date(), updatedAt: new Date() };
                                                delete planData.id;
                                                await addDoc(collection(db, 'subscriptionPlans'), planData);
                                                planSummary.imported++;
                                            } else {
                                                const docId = existing.docs[0].id;
                                                const updateData = { ...plan, updatedAt: new Date() };
                                                delete updateData.id;
                                                await updateDoc(doc(db, 'subscriptionPlans', docId), updateData);
                                                planSummary.updated++;
                                            }
                                        }

                                        // 2. Sync Credit Packs
                                        for (const pack of BASE_CREDIT_PACKS) {
                                            const q = query(collection(db, 'creditPacks'), where('stripePriceId', '==', pack.stripePriceId));
                                            const existing = await getDocs(q);

                                            if (existing.empty) {
                                                const packData = { ...pack, active: true, createdAt: new Date(), updatedAt: new Date() };
                                                delete packData.id;
                                                await addDoc(collection(db, 'creditPacks'), packData);
                                                packSummary.imported++;
                                            } else {
                                                const docId = existing.docs[0].id;
                                                const updateData = { ...pack, updatedAt: new Date() };
                                                delete updateData.id;
                                                await updateDoc(doc(db, 'creditPacks', docId), updateData);
                                                packSummary.updated++;
                                            }
                                        }

                                        alert(t('admin_sync_success', {
                                            planImported: planSummary.imported,
                                            planUpdated: planSummary.updated,
                                            packImported: packSummary.imported,
                                            packUpdated: packSummary.updated
                                        }));
                                        fetchPlans();
                                    } catch (err) {
                                        console.error(err);
                                        alert(t('admin_sync_error', { error: err.message }));
                                    }
                                }}
                                className="admin-btn admin-btn-secondary"
                            >
                                <FaSync /> {t('sync_from_code', 'Sync from Code')}
                            </button>
                            <button
                                onClick={async () => {
                                    if (!window.confirm(t('admin_reset_confirm'))) return;
                                    try {
                                        const { deleteDoc, doc, collection, getDocs } = await import('firebase/firestore');

                                        const plansSnap = await getDocs(collection(db, 'subscriptionPlans'));
                                        for (const d of plansSnap.docs) await deleteDoc(doc(db, 'subscriptionPlans', d.id));

                                        const packsSnap = await getDocs(collection(db, 'creditPacks'));
                                        for (const d of packsSnap.docs) await deleteDoc(doc(db, 'creditPacks', d.id));

                                        alert(t('clear_success', 'Cleared successfully!'));
                                        fetchPlans();
                                    } catch (err) {
                                        console.error(err);
                                        alert('Error: ' + err.message);
                                    }
                                }}
                                className="admin-btn admin-btn-danger"
                            >
                                <FaTrash />
                                {t('admin_clear_reset_all')}
                            </button>
                        </>
                    )}
                    <button
                        onClick={() => navigate('/admin/plans/new')}
                        className="admin-btn admin-btn-primary"
                    >
                        <FaPlus />
                        {t('admin_create_new_plan')}
                    </button>
                </div>
            </div>

            {/* View Selection & Filters */}
            <div className="admin-flex admin-gap-4 admin-mb-4" dir={i18n.language === 'ar' ? 'rtl' : 'ltr'}>
                <div className="admin-flex admin-gap-2">
                    <button
                        onClick={() => setViewMode('plans')}
                        className={`admin-btn ${viewMode === 'plans' ? 'admin-btn-primary' : 'admin-btn-secondary'}`}
                    >
                        {t('admin_subscription_plans')}
                    </button>
                    <button
                        onClick={() => setViewMode('packs')}
                        className={`admin-btn ${viewMode === 'packs' ? 'admin-btn-primary' : 'admin-btn-secondary'}`}
                    >
                        {t('admin_credit_packs')}
                    </button>
                </div>

                {viewMode === 'plans' && (
                    <div className="admin-flex admin-gap-2">
                        <button
                            onClick={() => setFilterType('all')}
                            className={`admin-btn ${filterType === 'all' ? 'admin-btn-primary' : 'admin-btn-secondary'}`}
                        >
                            {t('admin_all')} ({plans.length})
                        </button>
                        <button
                            onClick={() => setFilterType('user')}
                            className={`admin-btn ${filterType === 'user' ? 'admin-btn-primary' : 'admin-btn-secondary'}`}
                        >
                            {t('admin_user')} ({plans.filter(p => p.type === 'user').length})
                        </button>
                        <button
                            onClick={() => setFilterType('partner')}
                            className={`admin-btn ${filterType === 'business' ? 'admin-btn-primary' : 'admin-btn-secondary'}`}
                        >
                            {t('admin_partner')} ({plans.filter(p => p.type === 'business').length})
                        </button>
                    </div>
                )}
            </div>

            {/* Data Grid */}
            <div dir={i18n.language === 'ar' ? 'rtl' : 'ltr'}>
                {viewMode === 'plans' ? (
                    filteredPlans.length === 0 ? (
                        <div className="admin-card">
                            <div className="admin-empty">
                                <div className="admin-empty-icon">📦</div>
                                <h3 className="admin-empty-title">{t('admin_no_plans_found')}</h3>
                            </div>
                        </div>
                    ) : (
                        <div className="admin-grid admin-grid-3">
                            {filteredPlans.map(plan => (
                                <div key={plan.id} className="admin-card">
                                    {/* Responsive Title */}
                                    <h3 style={{ fontSize: '1.5rem', fontWeight: '800', color: '#ffffff', marginBottom: '0.25rem' }}>
                                        {plan.name}
                                    </h3>

                                    {/* Description */}
                                    <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '1rem', height: '3.5rem', overflow: 'hidden' }}>
                                        {plan.description}
                                    </p>

                                    {/* Price */}
                                    <div style={{ fontSize: '1.75rem', fontWeight: '800', color: '#ffffff', marginBottom: '1rem' }}>
                                        ${plan.price} <span style={{ fontSize: '0.9rem', color: '#64748b' }}>/ {plan.duration?.type}</span>
                                    </div>

                                    {/* Actions */}
                                    <div className="admin-flex admin-gap-2">
                                        <button onClick={() => navigate(`/admin/plans/edit/${plan.id}`)} className="admin-btn admin-btn-sm" style={{ flex: 1, background: '#3b82f6', color: 'white' }}>
                                            <FaEdit /> Edit Plan
                                        </button>
                                        <button onClick={() => handleDeletePlan(plan.id)} className="admin-btn admin-btn-sm admin-btn-danger">
                                            <FaTrash />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )
                ) : (
                    creditPacks.length === 0 ? (
                        <div className="admin-card">
                            <div className="admin-empty">
                                <div className="admin-empty-icon">📩</div>
                                <h3 className="admin-empty-title">{t('admin_no_packs_found')}</h3>
                            </div>
                        </div>
                    ) : (
                        <div className="admin-grid admin-grid-3">
                            {creditPacks.map(pack => (
                                <div key={pack.id} className="admin-card">
                                    <h3 style={{ fontSize: '1.25rem', fontWeight: '800', color: '#ffffff', marginBottom: '0.25rem' }}>
                                        {pack.name}
                                    </h3>
                                    <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#ffffff', marginBottom: '0.5rem' }}>
                                        {pack.amount} {t('admin_credits')}
                                    </div>
                                    <div style={{ color: '#fbbf24', fontWeight: '700', marginBottom: '1.5rem' }}>
                                        ${pack.price}
                                    </div>
                                    <div className="admin-flex admin-gap-2">
                                        <button className="admin-btn admin-btn-sm" style={{ flex: 1, background: '#64748b', cursor: 'not-allowed' }}>
                                            <FaEdit /> ({t('admin_read_only')})
                                        </button>
                                        <button onClick={async () => {
                                            if (!window.confirm(t('admin_delete_pack_confirm'))) return;
                                            await deleteDoc(doc(db, 'creditPacks', pack.id));
                                            setCreditPacks(creditPacks.filter(p => p.id !== pack.id));
                                        }} className="admin-btn admin-btn-sm admin-btn-danger">
                                            <FaTrash />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )
                )}
            </div >
        </div >
    );
};

export default PlanManagement;
