import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { collection, addDoc, doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { FaSave, FaTimes, FaEye, FaPlus, FaTrash, FaCrown, FaGift } from 'react-icons/fa';

const PlanEditor = () => {
    const navigate = useNavigate();
    const { id } = useParams();
    const isEditMode = !!id;

    const [loading, setLoading] = useState(false);
    const [showPreview, setShowPreview] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        type: 'user',
        price: 0,
        originalPrice: 0,
        discount: 0,
        duration: {
            value: 1,
            type: 'month'
        },
        features: [],
        design: {
            icon: '🎁',
            badge: {
                show: false,
                text: 'Recommended'
            }
        },
        stripe: {
            priceId: ''
        },
        active: true,
        published: true,
        recommended: false
    });

    const [newFeature, setNewFeature] = useState('');

    useEffect(() => {
        if (isEditMode) {
            fetchPlan();
        }
    }, [id]);

    const fetchPlan = async () => {
        try {
            setLoading(true);
            const planDoc = await getDoc(doc(db, 'subscriptionPlans', id));
            if (planDoc.exists()) {
                setFormData({ id: planDoc.id, ...planDoc.data() });
            } else {
                alert('Plan not found!');
                navigate('/admin/plans');
            }
        } catch (error) {
            console.error('Error fetching plan:', error);
            alert('Failed to fetch plan');
        } finally {
            setLoading(false);
        }
    };

    const handleInputChange = (field, value) => {
        setFormData(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const handleNestedChange = (parent, field, value) => {
        setFormData(prev => ({
            ...prev,
            [parent]: {
                ...prev[parent],
                [field]: value
            }
        }));
    };

    const handleAddFeature = () => {
        if (!newFeature.trim()) return;
        setFormData(prev => ({
            ...prev,
            features: [...prev.features, { text: newFeature, enabled: true }]
        }));
        setNewFeature('');
    };

    const handleRemoveFeature = (index) => {
        setFormData(prev => ({
            ...prev,
            features: prev.features.filter((_, i) => i !== index)
        }));
    };

    const handleSave = async () => {
        // Validation
        if (!formData.name.trim()) {
            alert('Please enter a plan name');
            return;
        }
        if (formData.price < 0) {
            alert('Price cannot be negative');
            return;
        }
        if (formData.features.length === 0) {
            alert('Please add at least one feature');
            return;
        }

        try {
            setLoading(true);
            const planData = {
                ...formData,
                updatedAt: new Date()
            };

            if (isEditMode) {
                const { id: planId, ...dataToUpdate } = planData;
                await updateDoc(doc(db, 'subscriptionPlans', id), dataToUpdate);
                alert('Plan updated successfully!');
            } else {
                planData.createdAt = new Date();
                await addDoc(collection(db, 'subscriptionPlans'), planData);
                alert('Plan created successfully!');
            }
            navigate('/admin/plans');
        } catch (error) {
            console.error('Error saving plan:', error);
            alert('Failed to save plan: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    if (loading && isEditMode) {
        return (
            <div className="admin-loading">
                <div style={{ textAlign: 'center' }}>
                    <div className="admin-spinner" />
                    <p style={{ color: '#94a3b8', fontSize: '1rem', marginTop: '1rem' }}>Loading plan...</p>
                </div>
            </div>
        );
    }

    return (
        <div>
            {/* Header */}
            <div className="admin-flex-between admin-mb-4">
                <div className="admin-page-header" style={{ marginBottom: 0 }}>
                    <h1 className="admin-page-title">
                        {isEditMode ? 'Edit Plan' : 'Create New Plan'}
                    </h1>
                    <p className="admin-page-subtitle">
                        {isEditMode ? 'Update subscription plan details' : 'Build a new subscription plan'}
                    </p>
                </div>
                <div className="admin-flex admin-gap-2">
                    <button
                        onClick={() => setShowPreview(!showPreview)}
                        className="admin-btn admin-btn-secondary"
                    >
                        <FaEye />
                        {showPreview ? 'Hide Preview' : 'Show Preview'}
                    </button>
                    <button
                        onClick={() => navigate('/admin/plans')}
                        className="admin-btn admin-btn-secondary"
                    >
                        <FaTimes />
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={loading}
                        className="admin-btn admin-btn-primary"
                    >
                        <FaSave />
                        {loading ? 'Saving...' : 'Save Plan'}
                    </button>
                </div>
            </div>

            <div className="admin-grid admin-grid-2">
                {/* Form */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    {/* Basic Information */}
                    <div className="admin-card">
                        <h2 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#ffffff', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            📋 Basic Information
                        </h2>
                        <div style={{ display: 'grid', gap: '1rem' }}>
                            <div>
                                <label className="admin-label">Plan Name *</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => handleInputChange('name', e.target.value)}
                                    placeholder="e.g. Pro Plan"
                                    className="admin-input"
                                />
                            </div>
                            <div>
                                <label className="admin-label">Description</label>
                                <textarea
                                    value={formData.description}
                                    onChange={(e) => handleInputChange('description', e.target.value)}
                                    placeholder="Brief description of the plan"
                                    className="admin-input"
                                    rows="3"
                                />
                            </div>
                            <div>
                                <label className="admin-label">Plan Type</label>
                                <div className="admin-flex admin-gap-2">
                                    <button
                                        onClick={() => handleInputChange('type', 'user')}
                                        className={`admin-btn ${formData.type === 'user' ? 'admin-btn-primary' : 'admin-btn-secondary'}`}
                                        style={{ flex: 1 }}
                                    >
                                        👤 For Users
                                    </button>
                                    <button
                                        onClick={() => handleInputChange('type', 'partner')}
                                        className={`admin-btn ${formData.type === 'partner' ? 'admin-btn-primary' : 'admin-btn-secondary'}`}
                                        style={{ flex: 1 }}
                                    >
                                        🏪 For Partners
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Pricing */}
                    <div className="admin-card">
                        <h2 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#ffffff', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            💰 Pricing
                        </h2>
                        <div style={{ display: 'grid', gap: '1rem' }}>
                            <div>
                                <label className="admin-label">Price ($) *</label>
                                <input
                                    type="number"
                                    value={formData.price}
                                    onChange={(e) => handleInputChange('price', parseFloat(e.target.value) || 0)}
                                    placeholder="0"
                                    className="admin-input"
                                    min="0"
                                    step="0.01"
                                />
                            </div>
                            <div>
                                <label className="admin-label">Original Price ($)</label>
                                <input
                                    type="number"
                                    value={formData.originalPrice}
                                    onChange={(e) => handleInputChange('originalPrice', parseFloat(e.target.value) || 0)}
                                    placeholder="0"
                                    className="admin-input"
                                    min="0"
                                    step="0.01"
                                />
                            </div>
                            <div>
                                <label className="admin-label">Discount (%)</label>
                                <input
                                    type="number"
                                    value={formData.discount}
                                    onChange={(e) => handleInputChange('discount', parseInt(e.target.value) || 0)}
                                    placeholder="0"
                                    className="admin-input"
                                    min="0"
                                    max="100"
                                />
                            </div>
                            <div className="admin-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div>
                                    <label className="admin-label">Duration Value</label>
                                    <input
                                        type="number"
                                        value={formData.duration.value}
                                        onChange={(e) => handleNestedChange('duration', 'value', parseInt(e.target.value) || 1)}
                                        className="admin-input"
                                        min="1"
                                    />
                                </div>
                                <div>
                                    <label className="admin-label">Duration Type</label>
                                    <select
                                        value={formData.duration.type}
                                        onChange={(e) => handleNestedChange('duration', 'type', e.target.value)}
                                        className="admin-select"
                                    >
                                        <option value="day">Day</option>
                                        <option value="month">Month</option>
                                        <option value="year">Year</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Design */}
                    <div className="admin-card">
                        <h2 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#ffffff', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            🎨 Design
                        </h2>
                        <div style={{ display: 'grid', gap: '1rem' }}>
                            <div>
                                <label className="admin-label">Icon (Emoji)</label>
                                <input
                                    type="text"
                                    value={formData.design.icon}
                                    onChange={(e) => handleNestedChange('design', 'icon', e.target.value)}
                                    placeholder="🎁"
                                    className="admin-input"
                                    maxLength="2"
                                />
                            </div>
                            <div>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', color: '#e2e8f0' }}>
                                    <input
                                        type="checkbox"
                                        checked={formData.recommended}
                                        onChange={(e) => handleInputChange('recommended', e.target.checked)}
                                        style={{ width: '1rem', height: '1rem' }}
                                    />
                                    Mark as Recommended
                                </label>
                            </div>
                            <div>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', color: '#e2e8f0' }}>
                                    <input
                                        type="checkbox"
                                        checked={formData.design.badge.show}
                                        onChange={(e) => handleNestedChange('design', 'badge', { ...formData.design.badge, show: e.target.checked })}
                                        style={{ width: '1rem', height: '1rem' }}
                                    />
                                    Show Badge
                                </label>
                            </div>
                            {formData.design.badge.show && (
                                <div>
                                    <label className="admin-label">Badge Text</label>
                                    <input
                                        type="text"
                                        value={formData.design.badge.text}
                                        onChange={(e) => handleNestedChange('design', 'badge', { ...formData.design.badge, text: e.target.value })}
                                        placeholder="Recommended"
                                        className="admin-input"
                                    />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Features */}
                    <div className="admin-card">
                        <h2 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#ffffff', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            ✨ Features
                        </h2>
                        <div style={{ display: 'grid', gap: '1rem' }}>
                            <div className="admin-flex admin-gap-2">
                                <input
                                    type="text"
                                    value={newFeature}
                                    onChange={(e) => setNewFeature(e.target.value)}
                                    onKeyPress={(e) => e.key === 'Enter' && handleAddFeature()}
                                    placeholder="Add a feature..."
                                    className="admin-input"
                                    style={{ flex: 1 }}
                                />
                                <button
                                    onClick={handleAddFeature}
                                    className="admin-btn admin-btn-primary"
                                >
                                    <FaPlus />
                                    Add
                                </button>
                            </div>
                            <div style={{ display: 'grid', gap: '0.5rem' }}>
                                {formData.features.map((feature, index) => (
                                    <div key={index} className="admin-flex-between" style={{
                                        padding: '0.75rem',
                                        background: '#0f172a',
                                        borderRadius: '0.5rem',
                                        border: '1px solid #334155'
                                    }}>
                                        <div className="admin-flex admin-gap-2" style={{ alignItems: 'center', flex: 1 }}>
                                            <span style={{ color: '#22c55e' }}>✓</span>
                                            <span style={{ color: '#e2e8f0' }}>{feature.text || feature}</span>
                                        </div>
                                        <button
                                            onClick={() => handleRemoveFeature(index)}
                                            className="admin-btn admin-btn-sm admin-btn-danger"
                                            style={{ padding: '0.25rem 0.5rem' }}
                                        >
                                            <FaTrash />
                                        </button>
                                    </div>
                                ))}
                                {formData.features.length === 0 && (
                                    <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                                        No features added yet
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Stripe Integration */}
                    <div className="admin-card">
                        <h2 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#ffffff', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            💳 Stripe Integration
                        </h2>
                        <div>
                            <label className="admin-label">Price ID</label>
                            <input
                                type="text"
                                value={formData.stripe.priceId}
                                onChange={(e) => handleNestedChange('stripe', 'priceId', e.target.value)}
                                placeholder="price_xxx"
                                className="admin-input"
                            />
                            <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.5rem' }}>
                                Get this from your Stripe dashboard
                            </p>
                        </div>
                    </div>

                    {/* Status */}
                    <div className="admin-card">
                        <h2 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#ffffff', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            📊 Status
                        </h2>
                        <div style={{ display: 'grid', gap: '0.75rem' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', color: '#e2e8f0' }}>
                                <input
                                    type="checkbox"
                                    checked={formData.active}
                                    onChange={(e) => handleInputChange('active', e.target.checked)}
                                    style={{ width: '1rem', height: '1rem' }}
                                />
                                Active
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', color: '#e2e8f0' }}>
                                <input
                                    type="checkbox"
                                    checked={formData.published}
                                    onChange={(e) => handleInputChange('published', e.target.checked)}
                                    style={{ width: '1rem', height: '1rem' }}
                                />
                                Published
                            </label>
                        </div>
                    </div>
                </div>

                {/* Preview */}
                {showPreview && (
                    <div style={{ position: 'sticky', top: '2rem' }}>
                        <div className="admin-card">
                            <h2 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#ffffff', marginBottom: '1rem' }}>
                                👁️ Live Preview
                            </h2>
                            <div className="admin-card" style={{ background: '#0f172a' }}>
                                {/* Badge */}
                                {formData.design.badge.show && formData.recommended && (
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
                                        {formData.design.badge.text}
                                    </div>
                                )}

                                {/* Icon */}
                                <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>
                                    {formData.design.icon}
                                </div>

                                {/* Title */}
                                <h3 style={{
                                    fontSize: '1.75rem',
                                    fontWeight: '700',
                                    color: '#ffffff',
                                    marginBottom: '0.5rem'
                                }}>
                                    {formData.name || 'Plan Name'}
                                </h3>

                                {/* Description */}
                                <p style={{
                                    fontSize: '0.9375rem',
                                    color: '#94a3b8',
                                    marginBottom: '1rem',
                                    minHeight: '3rem'
                                }}>
                                    {formData.description || 'Plan description'}
                                </p>

                                {/* Price */}
                                <div className="admin-mb-2">
                                    {formData.discount > 0 && (
                                        <div className="admin-flex admin-gap-1 admin-mb-1" style={{ alignItems: 'center' }}>
                                            <span style={{ color: '#64748b', textDecoration: 'line-through', fontSize: '0.875rem' }}>
                                                ${formData.originalPrice}
                                            </span>
                                            <span className="admin-badge admin-badge-success">
                                                {formData.discount}% OFF
                                            </span>
                                        </div>
                                    )}
                                    <div className="admin-flex admin-gap-1" style={{ alignItems: 'baseline' }}>
                                        <span style={{
                                            fontSize: '2.5rem',
                                            fontWeight: '800',
                                            background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                                            WebkitBackgroundClip: 'text',
                                            WebkitTextFillColor: 'transparent'
                                        }}>
                                            ${formData.price}
                                        </span>
                                        <span style={{ color: '#94a3b8', fontSize: '1rem' }}>
                                            / {formData.duration.type}
                                        </span>
                                    </div>
                                </div>

                                {/* Type Badge */}
                                <div className="admin-mb-3">
                                    <span className={formData.type === 'user' ? 'admin-badge admin-badge-primary' : 'admin-badge admin-badge-warning'}>
                                        {formData.type === 'user' ? 'User Plan' : 'Partner Plan'}
                                    </span>
                                </div>

                                {/* Features */}
                                <div>
                                    {formData.features.slice(0, 5).map((feature, idx) => (
                                        <div key={idx} className="admin-flex admin-gap-1 admin-mb-1" style={{ alignItems: 'flex-start' }}>
                                            <span style={{ color: '#22c55e', fontSize: '1rem' }}>✓</span>
                                            <span style={{ color: '#cbd5e1', fontSize: '0.9375rem' }}>
                                                {feature.text || feature}
                                            </span>
                                        </div>
                                    ))}
                                    {formData.features.length === 0 && (
                                        <div style={{ color: '#64748b', fontSize: '0.875rem', textAlign: 'center', padding: '1rem' }}>
                                            No features added
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PlanEditor;
