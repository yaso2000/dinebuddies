import React, { memo } from 'react';

function ProfileReadOnlyIdentity({ realtimeUser, t }) {
    return (
        <>
            <h1 style={{ fontSize: '1.6rem', fontWeight: '900', marginTop: '0.75rem', marginBottom: '0.15rem', color: 'var(--text-main)' }}>
                {realtimeUser.name}
            </h1>
            <p style={{ color: 'var(--text-muted)', marginBottom: '0.4rem', fontSize: '0.85rem' }}>{realtimeUser.bio || t('active_member')}</p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '1rem' }}>
                <div
                    style={{
                        background: 'color-mix(in srgb, var(--primary) 12%, var(--bg-card))',
                        padding: '6px 12px',
                        borderRadius: '12px',
                        border: '1px solid color-mix(in srgb, var(--primary) 28%, var(--border-color))',
                        fontSize: '0.85rem',
                        fontWeight: '700',
                        color: 'var(--text-main)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                    }}
                >
                    <span>{realtimeUser.gender === 'male' ? '👨' : realtimeUser.gender === 'female' ? '👩' : '👤'}</span>
                    <span>
                        {realtimeUser.gender === 'male'
                            ? t('male')
                            : realtimeUser.gender === 'female'
                              ? t('female')
                              : t('non_binary', { defaultValue: 'Other' })}
                    </span>
                </div>
                <div
                    style={{
                        background: 'color-mix(in srgb, var(--stat-reviews) 14%, var(--bg-card))',
                        padding: '6px 12px',
                        borderRadius: '12px',
                        border: '1px solid color-mix(in srgb, var(--stat-reviews) 35%, var(--border-color))',
                        fontSize: '0.85rem',
                        fontWeight: '700',
                        color: 'var(--text-main)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                    }}
                >
                    <span>🎂</span>
                    <span>{realtimeUser.ageCategory || (realtimeUser.age ? `${realtimeUser.age} ${t('years')}` : '')}</span>
                </div>
            </div>
        </>
    );
}

export default memo(ProfileReadOnlyIdentity);
