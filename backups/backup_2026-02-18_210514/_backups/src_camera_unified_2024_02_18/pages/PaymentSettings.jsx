import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FaArrowLeft, FaCreditCard, FaPlus, FaTrash } from 'react-icons/fa';
import './SettingsPages.css';

const PaymentSettings = () => {
    const navigate = useNavigate();
    const { userProfile } = useAuth();
    const [loading, setLoading] = useState(false);

    // Mock payment methods (in real app, fetch from Stripe)
    const [paymentMethods, setPaymentMethods] = useState([
        {
            id: 'pm_1',
            type: 'card',
            brand: 'visa',
            last4: '4242',
            expMonth: 12,
            expYear: 2025,
            isDefault: true
        }
    ]);

    const handleAddPaymentMethod = () => {
        // In real app, open Stripe payment method form
        alert('Add payment method functionality will be integrated with Stripe');
    };

    const handleRemovePaymentMethod = (id) => {
        if (window.confirm('Are you sure you want to remove this payment method?')) {
            setPaymentMethods(prev => prev.filter(pm => pm.id !== id));
        }
    };

    const handleSetDefault = (id) => {
        setPaymentMethods(prev => prev.map(pm => ({
            ...pm,
            isDefault: pm.id === id
        })));
    };

    const getCardBrandIcon = (brand) => {
        const icons = {
            visa: '💳',
            mastercard: '💳',
            amex: '💳',
            discover: '💳'
        };
        return icons[brand] || '💳';
    };

    return (
        <div className="settings-page">
            {/* Header */}
            <div className="settings-header">
                <button onClick={() => navigate('/settings')} className="back-btn">
                    <FaArrowLeft />
                </button>
                <h1>Payment Method</h1>
                <div style={{ width: '40px' }}></div>
            </div>

            {/* Content */}
            <div className="settings-content">
                <div className="settings-card">
                    <div className="settings-icon-wrapper" style={{ background: 'rgba(139, 92, 246, 0.1)' }}>
                        <FaCreditCard style={{ color: '#8b5cf6', fontSize: '1.5rem' }} />
                    </div>

                    <h2>Payment Methods</h2>
                    <p className="settings-description">
                        Manage your payment methods for subscription billing
                    </p>

                    {/* Payment Methods List */}
                    <div style={{ marginTop: '2rem' }}>
                        {paymentMethods.length === 0 ? (
                            <div style={{
                                textAlign: 'center',
                                padding: '3rem 1rem',
                                background: 'var(--bg-secondary)',
                                borderRadius: '12px'
                            }}>
                                <FaCreditCard style={{
                                    fontSize: '3rem',
                                    color: 'var(--text-secondary)',
                                    opacity: 0.3,
                                    marginBottom: '1rem'
                                }} />
                                <h3 style={{
                                    fontSize: '1.1rem',
                                    color: 'var(--text-main)',
                                    marginBottom: '0.5rem'
                                }}>
                                    No payment methods
                                </h3>
                                <p style={{
                                    fontSize: '0.9rem',
                                    color: 'var(--text-secondary)'
                                }}>
                                    Add a payment method to manage your subscription
                                </p>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                {paymentMethods.map(method => (
                                    <div
                                        key={method.id}
                                        style={{
                                            padding: '1.5rem',
                                            background: 'var(--bg-secondary)',
                                            borderRadius: '12px',
                                            border: method.isDefault ? '2px solid var(--primary)' : '2px solid transparent',
                                            position: 'relative'
                                        }}
                                    >
                                        {method.isDefault && (
                                            <div style={{
                                                position: 'absolute',
                                                top: '12px',
                                                right: '12px',
                                                background: 'rgba(139, 92, 246, 0.1)',
                                                color: 'var(--primary)',
                                                padding: '4px 8px',
                                                borderRadius: '6px',
                                                fontSize: '0.7rem',
                                                fontWeight: '700'
                                            }}>
                                                DEFAULT
                                            </div>
                                        )}

                                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                            <div style={{ fontSize: '2rem' }}>
                                                {getCardBrandIcon(method.brand)}
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <h3 style={{
                                                    fontSize: '1rem',
                                                    fontWeight: '600',
                                                    color: 'var(--text-main)',
                                                    marginBottom: '0.25rem',
                                                    textTransform: 'capitalize'
                                                }}>
                                                    {method.brand} •••• {method.last4}
                                                </h3>
                                                <p style={{
                                                    fontSize: '0.85rem',
                                                    color: 'var(--text-secondary)',
                                                    margin: 0
                                                }}>
                                                    Expires {method.expMonth}/{method.expYear}
                                                </p>
                                            </div>
                                            <button
                                                onClick={() => handleRemovePaymentMethod(method.id)}
                                                style={{
                                                    padding: '0.5rem',
                                                    background: 'rgba(239, 68, 68, 0.1)',
                                                    border: 'none',
                                                    borderRadius: '8px',
                                                    color: '#ef4444',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s'
                                                }}
                                            >
                                                <FaTrash />
                                            </button>
                                        </div>

                                        {!method.isDefault && (
                                            <button
                                                onClick={() => handleSetDefault(method.id)}
                                                style={{
                                                    marginTop: '1rem',
                                                    padding: '0.5rem 1rem',
                                                    background: 'var(--bg-input)',
                                                    border: '1px solid var(--border-color)',
                                                    borderRadius: '8px',
                                                    color: 'var(--text-main)',
                                                    fontSize: '0.85rem',
                                                    fontWeight: '600',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s',
                                                    width: '100%'
                                                }}
                                            >
                                                Set as Default
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Add Payment Method Button */}
                        <button
                            onClick={handleAddPaymentMethod}
                            className="submit-btn"
                            style={{
                                marginTop: '1.5rem',
                                background: 'var(--bg-secondary)',
                                color: 'var(--text-main)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.5rem'
                            }}
                        >
                            <FaPlus />
                            Add Payment Method
                        </button>
                    </div>

                    <div className="settings-note" style={{ marginTop: '2rem' }}>
                        <strong>Secure Payment:</strong> All payment information is securely processed by Stripe.
                        We never store your full card details on our servers.
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PaymentSettings;
