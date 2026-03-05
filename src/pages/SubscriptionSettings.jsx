import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FaArrowLeft, FaCheck, FaCrown, FaBolt } from 'react-icons/fa';
import './SettingsPages.css';

const SubscriptionSettings = () => {
    const navigate = useNavigate();
    const { userProfile, isBusiness } = useAuth();
    const [loading, setLoading] = useState(false);

    const subscriptionTier = userProfile?.subscriptionTier || 'free';
    const isElite = subscriptionTier === 'elite';
    const isProfessional = subscriptionTier === 'professional';
    const isPremium = !isBusiness && subscriptionTier === 'premium';

    const userPlans = [
        {
            id: 'free', name: 'Free', price: '$0', period: 'forever', icon: '📦', color: '#6b7280',
            features: ['Create 3 Public Invitations per month', 'Browse all nearby Public Invitations', 'Join Food Communities', 'App-based technical support']
        },
        {
            id: 'pro', name: 'Pro', price: '$8', period: 'per month', icon: '⚡', color: 'var(--primary)',
            features: ['4 Private Invitations/month', 'Unlimited Public Invites', 'Pro Badge', 'Search Priority', 'Fast Support']
        },
        {
            id: 'premium', name: 'Premium', price: '$15', period: 'per month', icon: '💎', color: '#fbbf24', popular: true,
            features: ['10 Private Invitations/month', 'Unlimited Public Invites', 'Golden Badge', 'Maximum Priority', 'Partner Discounts', 'Priority Support']
        }
    ];

    const handleUpgrade = () => {
        if (isBusiness) {
            // On desktop go to BusinessProDashboard Subscription section
            // On mobile go to business pricing page
            const isDesktop = window.innerWidth >= 1024;
            navigate(isDesktop ? '/business-pro' : '/business/pricing');
        } else {
            navigate('/pricing');
        }
    };

    const handleManageSubscription = () => {
        window.open('https://billing.stripe.com/p/login/test_...', '_blank');
    };

    return (
        <div className="settings-page">
            <div className="settings-header">
                <button onClick={() => navigate('/settings')} className="back-btn">
                    <FaArrowLeft />
                </button>
                <h1>Subscription</h1>
                <div style={{ width: '40px' }}></div>
            </div>

            <div className="settings-content">
                {/* Current Plan */}
                <div className="settings-card">
                    <div className="settings-icon-wrapper" style={{ background: 'rgba(251, 191, 36, 0.1)' }}>
                        <span style={{ fontSize: '2rem' }}>
                            {isElite ? '👑' : isProfessional ? '⚡' : isPremium ? '💎' : '📦'}
                        </span>
                    </div>
                    <h2>Current Plan</h2>
                    <p className="settings-description">
                        {isBusiness
                            ? `You are on the ${isElite ? '👑 Elite Partner' : isProfessional ? '⚡ Professional Partner' : '🎁 Free Partner'} plan`
                            : <> You are currently on the <strong>{isPremium ? 'Premium' : subscriptionTier === 'pro' ? 'Pro' : 'Free'}</strong> plan</>
                        }
                    </p>
                    {isBusiness && (isElite || isProfessional) && (
                        <div className="verified-badge" style={{
                            background: isElite ? 'rgba(251,191,36,0.1)' : 'rgba(139,92,246,0.1)',
                            color: isElite ? '#fbbf24' : '#a78bfa'
                        }}>
                            {isElite ? <FaCrown /> : <FaBolt />} {isElite ? 'Elite Partner' : 'Professional Partner'}
                        </div>
                    )}
                    {!isBusiness && isPremium && (
                        <div className="verified-badge" style={{ background: 'rgba(251, 191, 36, 0.1)', color: '#fbbf24' }}>
                            <FaCrown /> Premium Member
                        </div>
                    )}
                </div>

                {/* Business: simple upgrade card */}
                {isBusiness && (
                    <div className="settings-card" style={{ marginTop: '2rem' }}>
                        <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--text-main)', marginBottom: '0.75rem' }}>
                            Partner Plans
                        </h3>
                        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1.5rem', lineHeight: 1.6 }}>
                            {isElite
                                ? '✅ You have the highest partner plan. Enjoy your permanent offer slot and full access.'
                                : isProfessional
                                    ? '⚡ You are on the Professional plan. Upgrade to Elite for a permanent offer slot in the banner.'
                                    : 'Upgrade to a Partner plan to unlock premium features, listings, and offer publishing.'}
                        </p>
                        <button
                            className="submit-btn"
                            onClick={handleUpgrade}
                            style={{
                                background: isElite ? 'var(--bg-secondary)' : 'linear-gradient(135deg, #f59e0b, #ea580c)',
                                color: isElite ? 'var(--text-secondary)' : 'white',
                                cursor: isElite ? 'default' : 'pointer',
                                boxShadow: isElite ? 'none' : '0 4px 12px rgba(245,158,11,0.3)'
                            }}
                            disabled={isElite}
                        >
                            {isElite ? 'You have the best plan ✅' : isProfessional ? 'Upgrade to Elite →' : 'View Partner Plans →'}
                        </button>
                    </div>
                )}

                {/* User: plan comparison grid */}
                {!isBusiness && (
                    <div style={{ marginTop: '2rem' }}>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--text-main)', marginBottom: '1.5rem', textAlign: 'center' }}>
                            Choose Your Plan
                        </h3>
                        <div style={{ display: 'grid', gap: '1.5rem', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
                            {userPlans.map(plan => (
                                <div key={plan.id} className="settings-card" style={{ border: plan.id === subscriptionTier ? '2px solid var(--primary)' : '2px solid transparent', position: 'relative' }}>
                                    {plan.popular && (
                                        <div style={{ position: 'absolute', top: '-12px', right: '20px', background: 'linear-gradient(135deg, var(--primary), var(--secondary))', color: 'white', padding: '4px 12px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: '700' }}>
                                            POPULAR
                                        </div>
                                    )}
                                    <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                                        <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>{plan.icon}</div>
                                        <h3 style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--text-main)', marginBottom: '0.5rem' }}>{plan.name}</h3>
                                        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: '0.25rem' }}>
                                            <span style={{ fontSize: '2rem', fontWeight: '800', color: plan.color }}>{plan.price}</span>
                                            <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>/{plan.period}</span>
                                        </div>
                                    </div>
                                    <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 1.5rem 0', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                        {plan.features.map((feature, index) => (
                                            <li key={index} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                                                <FaCheck style={{ color: '#10b981', flexShrink: 0 }} /> {feature}
                                            </li>
                                        ))}
                                    </ul>
                                    {plan.id === subscriptionTier ? (
                                        <button className="submit-btn" style={{ background: 'var(--bg-secondary)', color: 'var(--text-main)', cursor: 'default' }} disabled>Current Plan</button>
                                    ) : plan.id !== 'free' ? (
                                        <button className="submit-btn" onClick={handleUpgrade} style={{ background: 'linear-gradient(135deg, #f59e0b, #ea580c)', boxShadow: '0 4px 12px rgba(245,158,11,0.3)' }}>
                                            Upgrade to {plan.name}
                                        </button>
                                    ) : null}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Manage Subscription for paid users */}
                {(isPremium || subscriptionTier === 'pro') && !isBusiness && (
                    <div className="settings-card" style={{ marginTop: '2rem' }}>
                        <h3 style={{ fontSize: '1.1rem', fontWeight: '600', color: 'var(--text-main)', marginBottom: '1rem' }}>Manage Subscription</h3>
                        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                            Update your payment method, view invoices, or cancel your subscription
                        </p>
                        <button className="submit-btn" onClick={handleManageSubscription} style={{ background: 'var(--bg-secondary)', color: 'var(--text-main)' }}>
                            Manage Subscription
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SubscriptionSettings;
