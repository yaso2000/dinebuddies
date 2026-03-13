import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { FaCrown, FaBolt, FaCheck, FaExternalLinkAlt } from 'react-icons/fa';
import { BASE_SUBSCRIPTION_PLANS } from '../../config/planDefaults';
import { useToast } from '../../context/ToastContext';

const PARTNER_PLANS = BASE_SUBSCRIPTION_PLANS.filter(p => p.type === 'business' && p.price > 0);

const ProSubscription = () => {
    const { userProfile } = useAuth();
    const { showToast } = useToast();
    const [loading, setLoading] = useState(null);

    const tier = userProfile?.subscriptionTier || 'free';
    const isElite = tier === 'elite';
    const isProfessional = tier === 'professional';

    const handleUpgrade = async (plan) => {
        if (!plan.stripePriceId) {
            showToast('Please contact support to upgrade your plan.', 'warning');
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
            showToast('Could not start checkout: ' + e.message, 'error');
        } finally {
            setLoading(null);
        }
    };

    const handleManageBilling = () => {
        window.open('https://billing.stripe.com/p/login/test_...', '_blank');
    };

    const currentPlanLabel = isElite ? '👑 Elite Business' : isProfessional ? '⚡ Professional Business' : '🎁 Free Business';

    return (
        <div>
            {/* Current Plan Banner - uses theme tokens for light/dark */}
            <div style={{
                background: isElite
                    ? 'linear-gradient(135deg, color-mix(in srgb, var(--stat-reviews) 18%, transparent), color-mix(in srgb, var(--stat-reviews) 10%, transparent))'
                    : isProfessional
                        ? 'linear-gradient(135deg, color-mix(in srgb, var(--primary) 18%, transparent), color-mix(in srgb, var(--primary) 10%, transparent))'
                        : 'var(--hover-overlay)',
                border: `1px solid ${isElite ? 'color-mix(in srgb, var(--stat-reviews) 40%, transparent)' : isProfessional ? 'color-mix(in srgb, var(--primary) 35%, transparent)' : 'var(--border-color)'}`,
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
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 6, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                        Current Plan
                    </div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: isElite ? 'var(--stat-reviews)' : isProfessional ? 'var(--primary)' : 'var(--text-muted)' }}>
                        {currentPlanLabel}
                    </div>
                    {(isElite || isProfessional) && (
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: 6 }}>
                            {isElite
                                ? '1 permanent offer slot • Unlimited display time • Priority placement'
                                : '1 offer slot × 50h/week • Buy extra hours or slots as needed'}
                        </div>
                    )}
                </div>
                {(isElite || isProfessional) && (
                    <button
                        type="button"
                        className="ui-btn ui-btn--secondary"
                        onClick={handleManageBilling}
                        style={{ padding: '10px 18px', gap: 8, fontSize: '0.875rem' }}
                    >
                        <FaExternalLinkAlt size={12} /> Manage Billing
                    </button>
                )}
            </div>

            {/* Plans Comparison - theme tokens for text/surfaces */}
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 20, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                {isElite ? 'Plan Overview' : 'Available Plans'}
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
                {PARTNER_PLANS.map(plan => {
                    const isCurrent = plan.tier === tier;
                    const isRecommended = plan.recommended;

                    return (
                        <div key={plan.id} style={{
                            background: isCurrent ? 'color-mix(in srgb, var(--stat-reviews) 12%, var(--bg-card))' : 'var(--bg-card)',
                            border: `1px solid ${isCurrent ? 'color-mix(in srgb, var(--stat-reviews) 45%, transparent)' : isRecommended ? 'color-mix(in srgb, var(--primary) 35%, transparent)' : 'var(--border-color)'}`,
                            borderRadius: 16,
                            padding: '24px',
                            position: 'relative',
                            display: 'flex',
                            flexDirection: 'column'
                        }}>
                            {isCurrent && (
                                <div style={{
                                    position: 'absolute', top: -10, right: 16,
                                    background: 'linear-gradient(135deg, var(--stat-reviews), var(--primary-hover))',
                                    color: 'var(--text-white)', padding: '3px 12px', borderRadius: 8,
                                    fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.05em'
                                }}>
                                    CURRENT
                                </div>
                            )}
                            {isRecommended && !isCurrent && (
                                <div style={{
                                    position: 'absolute', top: -10, right: 16,
                                    background: 'linear-gradient(135deg, var(--primary), var(--primary-hover))',
                                    color: 'var(--text-white)', padding: '3px 12px', borderRadius: 8,
                                    fontSize: '0.7rem', fontWeight: 800
                                }}>
                                    RECOMMENDED
                                </div>
                            )}

                            {/* Plan header */}
                            <div style={{ marginBottom: 16 }}>
                                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: 4 }}>
                                    {plan.name}
                                </div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                    {plan.description}
                                </div>
                            </div>

                            {/* Price */}
                            <div style={{ marginBottom: 20 }}>
                                <span style={{ fontSize: '2.2rem', fontWeight: 900, color: isCurrent ? 'var(--stat-reviews)' : 'var(--text-main)' }}>
                                    ${Math.round(plan.price * 1.53)} AUD
                                </span>
                                <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginLeft: 6 }}>/ month</span>
                                {plan.discount > 0 && (
                                    <div style={{ fontSize: '0.8rem', color: 'var(--color-success)', marginTop: 4 }}>
                                        ✨ First month FREE
                                    </div>
                                )}
                            </div>

                            {/* Features */}
                            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 20px 0', flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
                                {(plan.features || []).map((f, i) => (
                                    <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                                        <FaCheck style={{ color: 'var(--color-success)', flexShrink: 0, marginTop: 2 }} />
                                        {f}
                                    </li>
                                ))}
                            </ul>

                            {/* CTA */}
                            {isCurrent ? (
                                <button type="button" className="ui-btn ui-btn--secondary" disabled style={{ padding: '12px', fontSize: '0.875rem', cursor: 'default', opacity: 0.8 }}>
                                    Current Plan
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => handleUpgrade(plan)}
                                    disabled={loading === plan.id}
                                    className="ui-btn ui-btn--primary"
                                    style={{
                                        padding: '12px', borderRadius: 10, fontSize: '0.875rem',
                                        opacity: loading === plan.id ? 0.6 : 1,
                                        background: isRecommended ? 'linear-gradient(135deg, var(--stat-reviews), var(--primary-hover))' : undefined,
                                        color: isRecommended ? 'var(--text-white)' : undefined
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
