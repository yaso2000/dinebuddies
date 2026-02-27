import React, { useState, useEffect } from 'react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import { getPlanById, getNextTier } from '../config/subscriptionPlans';
import { FaTimes, FaSave, FaUndo, FaClock, FaInfinity } from 'react-icons/fa';

const BusinessLimitsEditor = ({ business, onClose, onSave }) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const planId = business.businessInfo?.subscriptionPlan || 'free';
    const defaultLimits = getPlanById(planId);

    // Form state
    const [customLimits, setCustomLimits] = useState({
        maxMembers: business.businessInfo?.customLimits?.maxMembers ?? null,
        maxPostsPerMonth: business.businessInfo?.customLimits?.maxPostsPerMonth ?? null,
        maxServices: business.businessInfo?.customLimits?.maxServices ?? null,
        priorityListing: business.businessInfo?.customLimits?.priorityListing ?? null,
        showInInvitations: business.businessInfo?.customLimits?.showInInvitations ?? null,
        canCreateOffers: business.businessInfo?.customLimits?.canCreateOffers ?? null,
        featuredListing: business.businessInfo?.customLimits?.featuredListing ?? null
    });

    const [expiry, setExpiry] = useState({
        maxMembers: business.businessInfo?.customLimitsExpiry?.maxMembers || '',
        maxPostsPerMonth: business.businessInfo?.customLimitsExpiry?.maxPostsPerMonth || '',
        maxServices: business.businessInfo?.customLimitsExpiry?.maxServices || '',
        priorityListing: business.businessInfo?.customLimitsExpiry?.priorityListing || '',
        showInInvitations: business.businessInfo?.customLimitsExpiry?.showInInvitations || '',
        canCreateOffers: business.businessInfo?.customLimitsExpiry?.canCreateOffers || '',
        featuredListing: business.businessInfo?.customLimitsExpiry?.featuredListing || ''
    });

    const [adminNotes, setAdminNotes] = useState(business.businessInfo?.adminNotes || '');
    const [overrides, setOverrides] = useState({
        maxMembers: customLimits.maxMembers !== null,
        maxPostsPerMonth: customLimits.maxPostsPerMonth !== null,
        maxServices: customLimits.maxServices !== null,
        priorityListing: customLimits.priorityListing !== null,
        showInInvitations: customLimits.showInInvitations !== null,
        canCreateOffers: customLimits.canCreateOffers !== null,
        featuredListing: customLimits.featuredListing !== null
    });

    const handleOverrideToggle = (key) => {
        setOverrides(prev => ({
            ...prev,
            [key]: !prev[key]
        }));

        if (overrides[key]) {
            // Turning off override, reset to null
            setCustomLimits(prev => ({
                ...prev,
                [key]: null
            }));
            setExpiry(prev => ({
                ...prev,
                [key]: ''
            }));
        }
    };

    const handleLimitChange = (key, value) => {
        setCustomLimits(prev => ({
            ...prev,
            [key]: value === '' ? null : (typeof defaultLimits[key] === 'boolean' ? value === 'true' : Number(value))
        }));
    };

    const handleExpiryChange = (key, value) => {
        setExpiry(prev => ({
            ...prev,
            [key]: value
        }));
    };

    const handleQuickAction = (action) => {
        const nextTier = getNextTier(planId);
        const nextPlan = nextTier ? getPlanById(nextTier) : null;

        switch (action) {
            case 'grant_pro_month':
                const proPlan = getPlanById('pro');
                const oneMonthLater = new Date();
                oneMonthLater.setMonth(oneMonthLater.getMonth() + 1);
                const expiryDate = oneMonthLater.toISOString().split('T')[0];

                setCustomLimits({
                    maxMembers: proPlan.maxMembers === Infinity ? 999999 : proPlan.maxMembers,
                    maxPostsPerMonth: proPlan.maxPostsPerMonth === Infinity ? 999999 : proPlan.maxPostsPerMonth,
                    maxServices: proPlan.maxServices === Infinity ? 999999 : proPlan.maxServices,
                    priorityListing: true,
                    showInInvitations: true,
                    canCreateOffers: true,
                    featuredListing: false
                });

                setExpiry({
                    maxMembers: expiryDate,
                    maxPostsPerMonth: expiryDate,
                    maxServices: expiryDate,
                    priorityListing: expiryDate,
                    showInInvitations: expiryDate,
                    canCreateOffers: expiryDate,
                    featuredListing: ''
                });

                setOverrides({
                    maxMembers: true,
                    maxPostsPerMonth: true,
                    maxServices: true,
                    priorityListing: true,
                    showInInvitations: true,
                    canCreateOffers: true,
                    featuredListing: false
                });

                setAdminNotes('Granted Pro features for 1 month');
                break;

            case 'double_posts':
                const currentPostLimit = defaultLimits.maxPostsPerMonth;
                if (currentPostLimit > 0 && currentPostLimit !== Infinity) {
                    setCustomLimits(prev => ({
                        ...prev,
                        maxPostsPerMonth: currentPostLimit * 2
                    }));
                    setOverrides(prev => ({ ...prev, maxPostsPerMonth: true }));
                }
                break;

            case 'unlimited_week':
                const oneWeekLater = new Date();
                oneWeekLater.setDate(oneWeekLater.getDate() + 7);
                const weekExpiry = oneWeekLater.toISOString().split('T')[0];

                setCustomLimits(prev => ({
                    ...prev,
                    maxMembers: 999999
                }));
                setExpiry(prev => ({
                    ...prev,
                    maxMembers: weekExpiry
                }));
                setOverrides(prev => ({ ...prev, maxMembers: true }));
                setAdminNotes('Unlimited members for 7 days');
                break;

            case 'reset':
                setCustomLimits({
                    maxMembers: null,
                    maxPostsPerMonth: null,
                    maxServices: null,
                    priorityListing: null,
                    showInInvitations: null,
                    canCreateOffers: null,
                    featuredListing: null
                });
                setExpiry({
                    maxMembers: '',
                    maxPostsPerMonth: '',
                    maxServices: '',
                    priorityListing: '',
                    showInInvitations: '',
                    canCreateOffers: '',
                    featuredListing: ''
                });
                setOverrides({
                    maxMembers: false,
                    maxPostsPerMonth: false,
                    maxServices: false,
                    priorityListing: false,
                    showInInvitations: false,
                    canCreateOffers: false,
                    featuredListing: false
                });
                setAdminNotes('');
                break;
        }
    };

    const handleSave = async () => {
        setLoading(true);
        setError('');

        try {
            // Prepare custom limits (only include overridden values)
            const finalCustomLimits = {};
            const finalExpiry = {};

            Object.keys(overrides).forEach(key => {
                if (overrides[key] && customLimits[key] !== null) {
                    finalCustomLimits[key] = customLimits[key];
                    if (expiry[key]) {
                        finalExpiry[key] = expiry[key];
                    }
                }
            });

            // Update Firestore
            await updateDoc(doc(db, 'users', business.uid), {
                'businessInfo.customLimits': finalCustomLimits,
                'businessInfo.customLimitsExpiry': finalExpiry,
                'businessInfo.adminNotes': adminNotes,
                'businessInfo.lastAdminUpdate': serverTimestamp()
            });

            if (onSave) onSave();
            onClose();
        } catch (err) {
            console.error('Error saving custom limits:', err);
            setError('Failed to save changes. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const renderLimitField = (key, label, type = 'number') => {
        const defaultValue = defaultLimits[key];
        const isInfinite = defaultValue === Infinity;

        return (
            <div style={{
                background: 'var(--bg-body)',
                borderRadius: '12px',
                padding: '1rem',
                marginBottom: '1rem'
            }}>
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '0.75rem'
                }}>
                    <label style={{
                        fontSize: '0.95rem',
                        fontWeight: '600',
                        color: 'var(--text-primary)'
                    }}>
                        {label}
                    </label>
                    <label style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                        color: 'var(--text-secondary)'
                    }}>
                        <input
                            type="checkbox"
                            checked={overrides[key]}
                            onChange={() => handleOverrideToggle(key)}
                            style={{ cursor: 'pointer' }}
                        />
                        Override
                    </label>
                </div>

                <div style={{
                    display: 'flex',
                    gap: '0.5rem',
                    alignItems: 'center',
                    marginBottom: '0.5rem'
                }}>
                    <span style={{
                        fontSize: '0.85rem',
                        color: 'var(--text-muted)',
                        minWidth: '80px'
                    }}>
                        Default: {isInfinite ? '∞ Unlimited' : (type === 'boolean' ? (defaultValue ? 'Enabled' : 'Disabled') : defaultValue)}
                    </span>

                    {overrides[key] && (
                        <>
                            {type === 'boolean' ? (
                                <select
                                    value={customLimits[key] === null ? '' : customLimits[key].toString()}
                                    onChange={(e) => handleLimitChange(key, e.target.value)}
                                    style={{
                                        flex: 1,
                                        padding: '0.5rem',
                                        background: 'var(--bg-card)',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: '8px',
                                        color: 'var(--text-primary)'
                                    }}
                                >
                                    <option value="">Select...</option>
                                    <option value="true">Enabled</option>
                                    <option value="false">Disabled</option>
                                </select>
                            ) : (
                                <input
                                    type="number"
                                    value={customLimits[key] === null ? '' : customLimits[key]}
                                    onChange={(e) => handleLimitChange(key, e.target.value)}
                                    placeholder="Custom value"
                                    style={{
                                        flex: 1,
                                        padding: '0.5rem',
                                        background: 'var(--bg-card)',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: '8px',
                                        color: 'var(--text-primary)'
                                    }}
                                />
                            )}
                        </>
                    )}
                </div>

                {overrides[key] && (
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                    }}>
                        <FaClock style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }} />
                        <input
                            type="date"
                            value={expiry[key]}
                            onChange={(e) => handleExpiryChange(key, e.target.value)}
                            placeholder="No expiry"
                            style={{
                                flex: 1,
                                padding: '0.5rem',
                                background: 'var(--bg-card)',
                                border: '1px solid var(--border-color)',
                                borderRadius: '8px',
                                color: 'var(--text-primary)',
                                fontSize: '0.85rem'
                            }}
                        />
                        {!expiry[key] && (
                            <span style={{
                                fontSize: '0.75rem',
                                color: 'var(--text-muted)'
                            }}>
                                No expiry
                            </span>
                        )}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1rem'
        }}>
            <div style={{
                background: 'var(--bg-card)',
                borderRadius: '20px',
                width: '100%',
                maxWidth: '600px',
                maxHeight: '90vh',
                overflow: 'auto',
                border: '1px solid var(--border-color)'
            }}>
                {/* Header */}
                <div style={{
                    padding: '1.5rem',
                    borderBottom: '1px solid var(--border-color)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    position: 'sticky',
                    top: 0,
                    background: 'var(--bg-card)',
                    zIndex: 1
                }}>
                    <div>
                        <h2 style={{
                            fontSize: '1.3rem',
                            fontWeight: '800',
                            marginBottom: '0.25rem',
                            color: 'var(--text-primary)'
                        }}>
                            Edit Custom Limits
                        </h2>
                        <p style={{
                            fontSize: '0.9rem',
                            color: 'var(--text-secondary)'
                        }}>
                            {business.businessInfo?.businessName || business.display_name}
                        </p>
                        <p style={{
                            fontSize: '0.85rem',
                            color: 'var(--text-muted)',
                            marginTop: '0.25rem'
                        }}>
                            Current Plan: <strong>{defaultLimits.displayName}</strong>
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-muted)',
                            cursor: 'pointer',
                            fontSize: '1.5rem',
                            padding: '0.5rem'
                        }}
                    >
                        <FaTimes />
                    </button>
                </div>

                {/* Quick Actions */}
                <div style={{
                    padding: '1.5rem',
                    borderBottom: '1px solid var(--border-color)',
                    background: 'var(--bg-body)'
                }}>
                    <h3 style={{
                        fontSize: '0.9rem',
                        fontWeight: '700',
                        color: 'var(--text-muted)',
                        marginBottom: '1rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px'
                    }}>
                        Quick Actions
                    </h3>
                    <div style={{
                        display: 'flex',
                        gap: '0.5rem',
                        flexWrap: 'wrap'
                    }}>
                        <button
                            onClick={() => handleQuickAction('grant_pro_month')}
                            style={{
                                padding: '0.5rem 1rem',
                                background: 'linear-gradient(135deg, var(--primary), #f97316)',
                                border: 'none',
                                borderRadius: '8px',
                                color: 'white',
                                fontSize: '0.85rem',
                                fontWeight: '600',
                                cursor: 'pointer'
                            }}
                        >
                            🌟 Grant Pro (1 Month)
                        </button>
                        <button
                            onClick={() => handleQuickAction('double_posts')}
                            style={{
                                padding: '0.5rem 1rem',
                                background: 'var(--bg-card)',
                                border: '1px solid var(--border-color)',
                                borderRadius: '8px',
                                color: 'var(--text-primary)',
                                fontSize: '0.85rem',
                                fontWeight: '600',
                                cursor: 'pointer'
                            }}
                        >
                            ✖️2 Double Posts
                        </button>
                        <button
                            onClick={() => handleQuickAction('unlimited_week')}
                            style={{
                                padding: '0.5rem 1rem',
                                background: 'var(--bg-card)',
                                border: '1px solid var(--border-color)',
                                borderRadius: '8px',
                                color: 'var(--text-primary)',
                                fontSize: '0.85rem',
                                fontWeight: '600',
                                cursor: 'pointer'
                            }}
                        >
                            <FaInfinity /> Unlimited (7 Days)
                        </button>
                        <button
                            onClick={() => handleQuickAction('reset')}
                            style={{
                                padding: '0.5rem 1rem',
                                background: 'rgba(239, 68, 68, 0.1)',
                                border: '1px solid rgba(239, 68, 68, 0.3)',
                                borderRadius: '8px',
                                color: '#ef4444',
                                fontSize: '0.85rem',
                                fontWeight: '600',
                                cursor: 'pointer'
                            }}
                        >
                            <FaUndo /> Reset All
                        </button>
                    </div>
                </div>

                {/* Error Message */}
                {error && (
                    <div style={{
                        margin: '1rem 1.5rem',
                        padding: '1rem',
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        borderRadius: '12px',
                        color: '#ef4444',
                        fontSize: '0.9rem'
                    }}>
                        {error}
                    </div>
                )}

                {/* Limits */}
                <div style={{ padding: '1.5rem' }}>
                    <h3 style={{
                        fontSize: '0.9rem',
                        fontWeight: '700',
                        color: 'var(--text-muted)',
                        marginBottom: '1rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px'
                    }}>
                        Limits
                    </h3>

                    {renderLimitField('maxMembers', 'Max Community Members')}
                    {renderLimitField('maxPostsPerMonth', 'Max Posts per Month')}
                    {renderLimitField('maxServices', 'Max Services/Menu Items')}

                    <h3 style={{
                        fontSize: '0.9rem',
                        fontWeight: '700',
                        color: 'var(--text-muted)',
                        marginTop: '1.5rem',
                        marginBottom: '1rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px'
                    }}>
                        Features
                    </h3>

                    {renderLimitField('priorityListing', 'Priority Listing', 'boolean')}
                    {renderLimitField('showInInvitations', 'Show in Invitations', 'boolean')}
                    {renderLimitField('canCreateOffers', 'Can Create Offers', 'boolean')}
                    {renderLimitField('featuredListing', 'Featured Listing', 'boolean')}

                    {/* Admin Notes */}
                    <div style={{
                        background: 'var(--bg-body)',
                        borderRadius: '12px',
                        padding: '1rem',
                        marginTop: '1rem'
                    }}>
                        <label style={{
                            display: 'block',
                            fontSize: '0.95rem',
                            fontWeight: '600',
                            color: 'var(--text-primary)',
                            marginBottom: '0.5rem'
                        }}>
                            Admin Notes
                        </label>
                        <textarea
                            value={adminNotes}
                            onChange={(e) => setAdminNotes(e.target.value)}
                            placeholder="Add notes about these custom limits..."
                            rows={3}
                            style={{
                                width: '100%',
                                padding: '0.75rem',
                                background: 'var(--bg-card)',
                                border: '1px solid var(--border-color)',
                                borderRadius: '8px',
                                color: 'var(--text-primary)',
                                fontSize: '0.9rem',
                                resize: 'vertical'
                            }}
                        />
                    </div>
                </div>

                {/* Footer */}
                <div style={{
                    padding: '1.5rem',
                    borderTop: '1px solid var(--border-color)',
                    display: 'flex',
                    gap: '1rem',
                    position: 'sticky',
                    bottom: 0,
                    background: 'var(--bg-card)'
                }}>
                    <button
                        onClick={onClose}
                        disabled={loading}
                        style={{
                            flex: 1,
                            padding: '0.75rem',
                            background: 'var(--bg-body)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '12px',
                            color: 'var(--text-primary)',
                            fontSize: '1rem',
                            fontWeight: '600',
                            cursor: loading ? 'not-allowed' : 'pointer',
                            opacity: loading ? 0.6 : 1
                        }}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={loading}
                        style={{
                            flex: 2,
                            padding: '0.75rem',
                            background: loading ? 'var(--bg-body)' : 'linear-gradient(135deg, var(--primary), #f97316)',
                            border: 'none',
                            borderRadius: '12px',
                            color: 'white',
                            fontSize: '1rem',
                            fontWeight: '700',
                            cursor: loading ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.5rem',
                            opacity: loading ? 0.6 : 1
                        }}
                    >
                        <FaSave />
                        {loading ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default BusinessLimitsEditor;
