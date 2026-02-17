import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FaArrowLeft, FaCheck, FaCrown } from 'react-icons/fa';
import './SettingsPages.css';

const SubscriptionSettings = () => {
    const navigate = useNavigate();
    const { userProfile } = useAuth();
    const [loading, setLoading] = useState(false);

    const subscriptionTier = userProfile?.subscriptionTier || 'free';
    const isPremium = subscriptionTier === 'premium';

    const plans = [
        {
            id: 'free',
            name: 'Free',
            price: '$0',
            period: 'forever',
            icon: '📦',
            color: '#6b7280',
            features: [
                'Basic business profile',
                'Up to 10 photos',
                'Community chat',
                'Basic analytics',
                'Email support'
            ]
        },
        {
            id: 'premium',
            name: 'Premium',
            price: '$29',
            period: 'per month',
            icon: '💎',
            color: '#fbbf24',
            popular: true,
            features: [
                'Everything in Free',
                'Unlimited photos',
                'Priority listing',
                'Advanced analytics',
                'Custom branding',
                'Priority support',
                'Featured badge',
                'Special offers'
            ]
        }
    ];

    const handleUpgrade = () => {
        navigate('/pricing');
    };

    const handleManageSubscription = () => {
        // Navigate to Stripe customer portal
        window.open('https://billing.stripe.com/p/login/test_...', '_blank');
    };

    return (
        <div className="settings-page">
            {/* Header */}
            <div className="settings-header">
                <button onClick={() => navigate('/settings')} className="back-btn">
                    <FaArrowLeft />
                </button>
                <h1>Subscription</h1>
                <div style={{ width: '40px' }}></div>
            </div>

            {/* Content */}
            <div className="settings-content">
                {/* Current Plan */}
                <div className="settings-card">
                    <div className="settings-icon-wrapper" style={{ background: `rgba(251, 191, 36, 0.1)` }}>
                        <span style={{ fontSize: '2rem' }}>{isPremium ? '💎' : '📦'}</span>
                    </div>

                    <h2>Current Plan</h2>
                    <p className="settings-description">
                        You are currently on the <strong>{isPremium ? 'Premium' : 'Free'}</strong> plan
                    </p>

                    {isPremium && (
                        <div className="verified-badge" style={{ background: 'rgba(251, 191, 36, 0.1)', color: '#fbbf24' }}>
                            <FaCrown /> Premium Member
                        </div>
                    )}
                </div>

                {/* Plans Comparison */}
                <div style={{ marginTop: '2rem' }}>
                    <h3 style={{
                        fontSize: '1.25rem',
                        fontWeight: '700',
                        color: 'var(--text-main)',
                        marginBottom: '1.5rem',
                        textAlign: 'center'
                    }}>
                        Choose Your Plan
                    </h3>

                    <div style={{
                        display: 'grid',
                        gap: '1.5rem',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))'
                    }}>
                        {plans.map(plan => (
                            <div
                                key={plan.id}
                                className="settings-card"
                                style={{
                                    border: plan.id === subscriptionTier ? '2px solid var(--primary)' : '2px solid transparent',
                                    position: 'relative'
                                }}
                            >
                                {plan.popular && (
                                    <div style={{
                                        position: 'absolute',
                                        top: '-12px',
                                        right: '20px',
                                        background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
                                        color: 'white',
                                        padding: '4px 12px',
                                        borderRadius: '12px',
                                        fontSize: '0.75rem',
                                        fontWeight: '700'
                                    }}>
                                        POPULAR
                                    </div>
                                )}

                                <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                                    <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>
                                        {plan.icon}
                                    </div>
                                    <h3 style={{
                                        fontSize: '1.5rem',
                                        fontWeight: '700',
                                        color: 'var(--text-main)',
                                        marginBottom: '0.5rem'
                                    }}>
                                        {plan.name}
                                    </h3>
                                    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: '0.25rem' }}>
                                        <span style={{
                                            fontSize: '2rem',
                                            fontWeight: '800',
                                            color: plan.color
                                        }}>
                                            {plan.price}
                                        </span>
                                        <span style={{
                                            fontSize: '0.9rem',
                                            color: 'var(--text-secondary)'
                                        }}>
                                            /{plan.period}
                                        </span>
                                    </div>
                                </div>

                                <ul style={{
                                    listStyle: 'none',
                                    padding: 0,
                                    margin: '0 0 1.5rem 0',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '0.75rem'
                                }}>
                                    {plan.features.map((feature, index) => (
                                        <li key={index} style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.5rem',
                                            fontSize: '0.9rem',
                                            color: 'var(--text-secondary)'
                                        }}>
                                            <FaCheck style={{ color: '#10b981', flexShrink: 0 }} />
                                            {feature}
                                        </li>
                                    ))}
                                </ul>

                                {plan.id === subscriptionTier ? (
                                    <button
                                        className="submit-btn"
                                        style={{
                                            background: 'var(--bg-secondary)',
                                            color: 'var(--text-main)',
                                            cursor: 'default'
                                        }}
                                        disabled
                                    >
                                        Current Plan
                                    </button>
                                ) : plan.id === 'premium' ? (
                                    <button
                                        className="submit-btn"
                                        onClick={handleUpgrade}
                                    >
                                        Upgrade to Premium
                                    </button>
                                ) : null}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Manage Subscription */}
                {isPremium && (
                    <div className="settings-card" style={{ marginTop: '2rem' }}>
                        <h3 style={{
                            fontSize: '1.1rem',
                            fontWeight: '600',
                            color: 'var(--text-main)',
                            marginBottom: '1rem'
                        }}>
                            Manage Subscription
                        </h3>
                        <p style={{
                            fontSize: '0.9rem',
                            color: 'var(--text-secondary)',
                            marginBottom: '1.5rem'
                        }}>
                            Update your payment method, view invoices, or cancel your subscription
                        </p>
                        <button
                            className="submit-btn"
                            onClick={handleManageSubscription}
                            style={{
                                background: 'var(--bg-secondary)',
                                color: 'var(--text-main)'
                            }}
                        >
                            Manage Subscription
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SubscriptionSettings;
