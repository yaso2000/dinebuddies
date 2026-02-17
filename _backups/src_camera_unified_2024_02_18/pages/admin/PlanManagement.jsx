import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { FaPlus, FaEdit, FaTrash, FaEye, FaToggleOn, FaToggleOff, FaCrown } from 'react-icons/fa';

const PlanManagement = () => {
    const navigate = useNavigate();
    const [plans, setPlans] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filterType, setFilterType] = useState('all');

    useEffect(() => {
        fetchPlans();
    }, []);

    const fetchPlans = async () => {
        try {
            setLoading(true);
            const snapshot = await getDocs(collection(db, 'subscriptionPlans'));
            const plansData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setPlans(plansData);
        } catch (error) {
            console.error('Error fetching plans:', error);
        } finally {
            setLoading(false);
        }
    };

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
        if (!window.confirm('Are you sure you want to delete this plan? This action cannot be undone!')) return;

        try {
            await deleteDoc(doc(db, 'subscriptionPlans', planId));
            setPlans(plans.filter(plan => plan.id !== planId));
            alert('Plan deleted successfully!');
        } catch (error) {
            console.error('Error deleting plan:', error);
            alert('Failed to delete plan');
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
            <div className="admin-flex-between admin-mb-4">
                <div className="admin-page-header" style={{ marginBottom: 0 }}>
                    <h1 className="admin-page-title">Plan Management</h1>
                    <p className="admin-page-subtitle">Create and manage subscription plans</p>
                </div>
                <button
                    onClick={() => navigate('/admin/plans/new')}
                    className="admin-btn admin-btn-primary"
                >
                    <FaPlus />
                    Create New Plan
                </button>
            </div>

            {/* Filters */}
            <div className="admin-flex admin-gap-2 admin-mb-4">
                <button
                    onClick={() => setFilterType('all')}
                    className={`admin-btn ${filterType === 'all' ? 'admin-btn-primary' : 'admin-btn-secondary'}`}
                >
                    All Plans ({plans.length})
                </button>
                <button
                    onClick={() => setFilterType('user')}
                    className={`admin-btn ${filterType === 'user' ? 'admin-btn-primary' : 'admin-btn-secondary'}`}
                >
                    User Plans ({plans.filter(p => p.type === 'user').length})
                </button>
                <button
                    onClick={() => setFilterType('partner')}
                    className={`admin-btn ${filterType === 'partner' ? 'admin-btn-primary' : 'admin-btn-secondary'}`}
                >
                    Partner Plans ({plans.filter(p => p.type === 'partner').length})
                </button>
            </div>

            {/* Plans Grid */}
            {filteredPlans.length === 0 ? (
                <div className="admin-card">
                    <div className="admin-empty">
                        <div className="admin-empty-icon">📦</div>
                        <h3 className="admin-empty-title">No Plans Found</h3>
                        <p className="admin-empty-text">
                            Create your first subscription plan to get started
                        </p>
                        <button
                            onClick={() => navigate('/admin/plans/new')}
                            className="admin-btn admin-btn-primary"
                        >
                            Create Plan
                        </button>
                    </div>
                </div>
            ) : (
                <div className="admin-grid admin-grid-3">
                    {filteredPlans.map(plan => (
                        <div key={plan.id} className="admin-card">
                            {/* Badge */}
                            {plan.design?.badge?.show && plan.recommended && (
                                <div style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.25rem',
                                    padding: '0.25rem 0.75rem',
                                    background: 'linear-gradient(135deg, #ec4899 0%, #a855f7 100%)',
                                    borderRadius: '9999px',
                                    fontSize: '0.75rem',
                                    fontWeight: '700',
                                    marginBottom: '1rem',
                                    color: '#ffffff'
                                }}>
                                    <FaCrown />
                                    {plan.design.badge.text || 'Recommended'}
                                </div>
                            )}

                            {/* Icon */}
                            <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>
                                {plan.design?.icon || (plan.price === 0 ? '🎁' : plan.recommended ? '👑' : '🔥')}
                            </div>

                            {/* Title */}
                            <h3 style={{
                                fontSize: '1.75rem',
                                fontWeight: '700',
                                color: '#ffffff',
                                marginBottom: '0.5rem',
                                letterSpacing: '-0.025em'
                            }}>
                                {plan.name}
                            </h3>

                            {/* Description */}
                            <p style={{
                                fontSize: '0.9375rem',
                                color: '#94a3b8',
                                marginBottom: '1rem',
                                lineHeight: '1.5',
                                minHeight: '3rem'
                            }}>
                                {plan.description}
                            </p>

                            {/* Price */}
                            <div className="admin-mb-2">
                                {plan.discount > 0 && (
                                    <div className="admin-flex admin-gap-1 admin-mb-1" style={{ alignItems: 'center' }}>
                                        <span style={{ color: '#64748b', textDecoration: 'line-through', fontSize: '0.875rem' }}>
                                            ${plan.originalPrice}
                                        </span>
                                        <span className="admin-badge admin-badge-success">
                                            {plan.discount}% OFF
                                        </span>
                                    </div>
                                )}
                                <div className="admin-flex admin-gap-1" style={{ alignItems: 'baseline' }}>
                                    <span style={{
                                        fontSize: '2.5rem',
                                        fontWeight: '800',
                                        background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                                        WebkitBackgroundClip: 'text',
                                        WebkitTextFillColor: 'transparent',
                                        letterSpacing: '-0.025em'
                                    }}>
                                        ${plan.price}
                                    </span>
                                    <span style={{ color: '#94a3b8', fontSize: '1rem' }}>
                                        / {plan.duration?.type === 'month' ? 'month' : plan.duration?.type === 'year' ? 'year' : 'day'}
                                    </span>
                                </div>
                            </div>

                            {/* Badges */}
                            <div className="admin-flex admin-gap-1 admin-mb-3" style={{ flexWrap: 'wrap' }}>
                                <span className={plan.type === 'user' ? 'admin-badge admin-badge-primary' : 'admin-badge admin-badge-warning'}>
                                    {plan.type === 'user' ? 'User Plan' : 'Partner Plan'}
                                </span>
                                <span className={plan.active ? 'admin-badge admin-badge-success' : 'admin-badge admin-badge-danger'}>
                                    {plan.active ? 'Active' : 'Inactive'}
                                </span>
                            </div>

                            {/* Features */}
                            <div className="admin-mb-3" style={{ flex: 1 }}>
                                {plan.features?.slice(0, 3).map((feature, idx) => (
                                    <div key={idx} className="admin-flex admin-gap-1 admin-mb-1" style={{ alignItems: 'flex-start' }}>
                                        <span style={{ color: '#22c55e', fontSize: '1rem', marginTop: '0.125rem', flexShrink: 0 }}>✓</span>
                                        <span style={{ color: '#cbd5e1', fontSize: '0.9375rem', lineHeight: '1.5' }}>
                                            {feature.text || feature}
                                        </span>
                                    </div>
                                ))}
                                {plan.features?.length > 3 && (
                                    <div style={{ color: '#64748b', fontSize: '0.8125rem', paddingLeft: '1.5rem' }}>
                                        +{plan.features.length - 3} more features
                                    </div>
                                )}
                            </div>

                            {/* Actions */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                                <button
                                    onClick={() => navigate(`/admin/plans/edit/${plan.id}`)}
                                    className="admin-btn admin-btn-sm"
                                    style={{ background: '#3b82f6', color: '#ffffff' }}
                                >
                                    <FaEdit />
                                    Edit
                                </button>
                                <button
                                    onClick={() => handleToggleActive(plan.id, plan.active)}
                                    className={`admin-btn admin-btn-sm ${plan.active ? 'admin-btn-warning' : 'admin-btn-success'}`}
                                >
                                    {plan.active ? <FaToggleOff /> : <FaToggleOn />}
                                    {plan.active ? 'Disable' : 'Enable'}
                                </button>
                                <button
                                    onClick={() => navigate(`/admin/plans/preview/${plan.id}`)}
                                    className="admin-btn admin-btn-sm"
                                    style={{ background: '#a855f7', color: '#ffffff' }}
                                >
                                    <FaEye />
                                    Preview
                                </button>
                                <button
                                    onClick={() => handleDeletePlan(plan.id)}
                                    className="admin-btn admin-btn-sm admin-btn-danger"
                                >
                                    <FaTrash />
                                    Delete
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default PlanManagement;
