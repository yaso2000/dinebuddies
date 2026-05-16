import React, { memo } from 'react';
import { FaCheckCircle } from 'react-icons/fa';

function ProfilePremiumActivePlanCard({ userProfile, navigate, t }) {
    if (userProfile?.subscription?.status !== 'active') return null;
    return (
        <div
            className="premium-plan-card"
            style={{
                padding: '1.5rem',
                borderRadius: '24px',
                border: '1px solid var(--border-color)',
                marginBottom: 'var(--profile-stack-gap)',
                position: 'relative',
                overflow: 'hidden',
            }}
        >
            <div
                style={{
                    position: 'absolute',
                    top: '-10px',
                    right: '-10px',
                    width: '60px',
                    height: '60px',
                    background: 'var(--luxury-gold)',
                    borderRadius: '50%',
                    filter: 'blur(30px)',
                    opacity: 0.2,
                }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span>💳</span> {t('my_plan')}
                </h3>
                <span
                    style={{
                        background: 'color-mix(in srgb, var(--stat-reviews) 18%, var(--bg-card))',
                        color: 'var(--text-main)',
                        padding: '4px 12px',
                        borderRadius: '20px',
                        fontSize: '0.75rem',
                        fontWeight: '900',
                        border: '1px solid color-mix(in srgb, var(--stat-reviews) 35%, var(--border-color))',
                    }}
                >
                    {userProfile?.subscription?.planName || 'PREMIUM'}
                </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {userProfile?.subscription?.features?.map((feature, index) => (
                    <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9rem' }}>
                        <FaCheckCircle style={{ color: 'var(--primary)' }} />
                        <span>{feature}</span>
                    </div>
                ))}
            </div>
            <button
                type="button"
                className="ui-btn ui-btn--secondary"
                onClick={() => navigate('/plans')}
                style={{ width: '100%', marginTop: '1rem', padding: '12px', fontSize: '0.85rem' }}
            >
                {t('manage_subscription')}
            </button>
        </div>
    );
}

export default memo(ProfilePremiumActivePlanCard);
