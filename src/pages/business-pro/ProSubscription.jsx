import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { FaCrown, FaBolt, FaCheck, FaExternalLinkAlt } from 'react-icons/fa';
import { BASE_SUBSCRIPTION_PLANS } from '../../config/planDefaults';

const PARTNER_PLANS = BASE_SUBSCRIPTION_PLANS.filter(p => p.type === 'business' && p.price > 0);

const ProSubscription = () => {
    const { userProfile } = useAuth();
    const [loading, setLoading] = useState(null);

    const tier = userProfile?.subscriptionTier || 'free';
    const isElite = tier === 'elite';
    const isProfessional = tier === 'professional';

    const handleUpgrade = async (plan) => {
        if (!plan.stripePriceId) {
            alert('Please contact support to upgrade your plan.');
            return;
        }
        setLoading(plan.id);
        try {
            const functions = getFunctions();
            const createCheckoutSession = httpsCallable(functions, 'createCheckoutSession');
            const result = await createCheckoutSession({
                priceId: plan.stripePriceId,
                planId: plan.id,
                planName: plan.name,
                successUrl: `${window.location.origin}/business-pro?section=subscription&purchase=success`,
                cancelUrl: `${window.location.origin}/business-pro?section=subscription`
            });
            window.location.href = result.data.url;
        } catch (e) {
            console.error('Checkout error:', e);
            alert('Could not start checkout: ' + e.message);
        } finally {
            setLoading(null);
        }
    };

    const handleManageBilling = () => {
        window.open('https://billing.stripe.com/p/login/test_...', '_blank');
    };

    const currentPlanLabel = isElite ? '👑 Elite Partner' : isProfessional ? '⚡ Professional Partner' : '🎁 Free Partner';

    return (
        <div>
            {/* Current Plan Banner */}
            <div style={{
                background: isElite
                    ? 'linear-gradient(135deg, rgba(251,191,36,0.15), rgba(245,158,11,0.08))'
                    : isProfessional
                        ? 'linear-gradient(135deg, rgba(139,92,246,0.15), rgba(109,40,217,0.08))'
                        : 'rgba(255,255,255,0.04)',
                border: `1px solid ${isElite ? 'rgba(251,191,36,0.35)' : isProfessional ? 'rgba(139,92,246,0.35)' : 'rgba(255,255,255,0.1)'}`,
                borderRadius: 16,
                padding: '24px 28px',
                marginBottom: 28,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 16
            }}>
                <div>
                    <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.45)', marginBottom: 6, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                        Current Plan
                    </div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: isElite ? '#fbbf24' : isProfessional ? '#a78bfa' : '#94a3b8' }}>
                        {currentPlanLabel}
                    </div>
                    {(isElite || isProfessional) && (
                        <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)', marginTop: 6 }}>
                            {isElite
                                ? '1 permanent offer slot • Unlimited display time • Priority placement'
                                : '1 offer slot × 50h/week • Buy extra hours or slots as needed'}
                        </div>
                    )}
                </div>
                {(isElite || isProfessional) && (
                    <button
                        onClick={handleManageBilling}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            padding: '10px 18px', borderRadius: 10,
                            border: '1px solid rgba(255,255,255,0.15)',
                            background: 'rgba(255,255,255,0.06)',
                            color: 'rgba(255,255,255,0.7)',
                            fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer'
                        }}
                    >
                        <FaExternalLinkAlt size={12} /> Manage Billing
                    </button>
                )}
            </div>

            {/* Plans Comparison */}
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'rgba(255,255,255,0.6)', marginBottom: 20, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                {isElite ? 'Plan Overview' : 'Available Plans'}
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
                {PARTNER_PLANS.map(plan => {
                    const isCurrent = plan.tier === tier;
                    const isRecommended = plan.recommended;

                    return (
                        <div key={plan.id} style={{
                            background: isCurrent ? 'rgba(251,191,36,0.07)' : 'rgba(255,255,255,0.04)',
                            border: `1px solid ${isCurrent ? 'rgba(251,191,36,0.4)' : isRecommended ? 'rgba(139,92,246,0.3)' : 'rgba(255,255,255,0.08)'}`,
                            borderRadius: 16,
                            padding: '24px',
                            position: 'relative',
                            display: 'flex',
                            flexDirection: 'column'
                        }}>
                            {isCurrent && (
                                <div style={{
                                    position: 'absolute', top: -10, right: 16,
                                    background: 'linear-gradient(135deg, #fbbf24, #f59e0b)',
                                    color: '#1a1a1a', padding: '3px 12px', borderRadius: 8,
                                    fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.05em'
                                }}>
                                    CURRENT
                                </div>
                            )}
                            {isRecommended && !isCurrent && (
                                <div style={{
                                    position: 'absolute', top: -10, right: 16,
                                    background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)',
                                    color: 'white', padding: '3px 12px', borderRadius: 8,
                                    fontSize: '0.7rem', fontWeight: 800
                                }}>
                                    RECOMMENDED
                                </div>
                            )}

                            {/* Plan header */}
                            <div style={{ marginBottom: 16 }}>
                                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f1f5f9', marginBottom: 4 }}>
                                    {plan.name}
                                </div>
                                <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)' }}>
                                    {plan.description}
                                </div>
                            </div>

                            {/* Price */}
                            <div style={{ marginBottom: 20 }}>
                                <span style={{ fontSize: '2.2rem', fontWeight: 900, color: isCurrent ? '#fbbf24' : '#f1f5f9' }}>
                                    ${Math.round(plan.price * 1.53)} AUD
                                </span>
                                <span style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.4)', marginLeft: 6 }}>/ month</span>
                                {plan.discount > 0 && (
                                    <div style={{ fontSize: '0.8rem', color: '#4ade80', marginTop: 4 }}>
                                        ✨ First month FREE
                                    </div>
                                )}
                            </div>

                            {/* Features */}
                            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 20px 0', flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
                                {(plan.features || []).map((f, i) => (
                                    <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: '0.875rem', color: 'rgba(255,255,255,0.7)' }}>
                                        <FaCheck style={{ color: '#4ade80', flexShrink: 0, marginTop: 2 }} />
                                        {f}
                                    </li>
                                ))}
                            </ul>

                            {/* CTA */}
                            {isCurrent ? (
                                <button disabled style={{
                                    padding: '12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)',
                                    background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.3)',
                                    fontWeight: 700, cursor: 'default', fontSize: '0.875rem'
                                }}>
                                    Current Plan
                                </button>
                            ) : (
                                <button
                                    onClick={() => handleUpgrade(plan)}
                                    disabled={loading === plan.id}
                                    style={{
                                        padding: '12px', borderRadius: 10, border: 'none',
                                        background: isRecommended
                                            ? 'linear-gradient(135deg, #fbbf24, #f59e0b)'
                                            : 'linear-gradient(135deg, #8b5cf6, #6d28d9)',
                                        color: isRecommended ? '#1a1a1a' : 'white',
                                        fontWeight: 700, cursor: loading === plan.id ? 'not-allowed' : 'pointer',
                                        fontSize: '0.875rem',
                                        opacity: loading === plan.id ? 0.6 : 1,
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    {loading === plan.id ? 'Loading...' : plan.tier === 'elite' ? 'Upgrade to Elite →' : 'Start with Professional →'}
                                </button>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default ProSubscription;
