import React, { memo } from 'react';
import { normalizeBusinessTier } from '../../utils/businessSubscription';
import { goToLogin } from '../../utils/goToLogin';

function ProfileFollowStatsAndSubscription({ realtimeUser, userProfile, navigate, t, i18n }) {
    return (
        <>
            <div className="profile-stats" style={{ justifyContent: 'center', gap: '1.25rem', marginTop: '0.5rem' }}>
                <div
                    className="profile-stat-item"
                    style={{ flex: 'none', cursor: 'pointer' }}
                    onClick={() => navigate('/followers', { state: { activeTab: 'followers' } })}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            navigate('/followers', { state: { activeTab: 'followers' } });
                        }
                    }}
                >
                    <div className="profile-stat-value">{realtimeUser.followersCount || 0}</div>
                    <div className="profile-stat-label">{t('followers')}</div>
                </div>
                <div className="profile-stats-divider" />
                <div
                    className="profile-stat-item"
                    style={{ flex: 'none', cursor: 'pointer' }}
                    onClick={() => navigate('/followers', { state: { activeTab: 'following' } })}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            navigate('/followers', { state: { activeTab: 'following' } });
                        }
                    }}
                >
                    <div className="profile-stat-value">{realtimeUser.following?.length || 0}</div>
                    <div className="profile-stat-label">{t('following')}</div>
                </div>
            </div>

            {!userProfile?.isGuest && (
                <div className="profile-subscription-card" style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <div
                            style={{
                                background: 'var(--primary)',
                                color: 'white',
                                padding: '4px 12px',
                                borderRadius: '20px',
                                fontSize: '0.75rem',
                                fontWeight: '800',
                            }}
                        >
                            {userProfile?.role === 'admin'
                                ? 'ADMIN'
                                : userProfile?.role === 'business'
                                  ? normalizeBusinessTier(userProfile?.subscriptionTier) === 'paid'
                                      ? t('profile_biz_paid_badge', 'PAID')
                                      : t('profile_biz_free_badge', 'FREE')
                                  : t('profile_standard_account', 'Standard')}
                        </div>
                        <span style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-main)' }}>
                            {userProfile?.role === 'business'
                                ? t('subscription_plan_label', 'Subscription plan')
                                : t('credits_wallet_heading', 'Credits')}
                        </span>
                    </div>

                    {!userProfile?.isBusiness && (
                        <div className="profile-subscription-quota-card" style={{ width: '100%' }}>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                                {t('dine_credits', 'Dine Credits')}
                            </div>
                            <div style={{ fontSize: '1.1rem', fontWeight: '900', color: 'var(--primary)' }}>
                                {Math.max(0, Number(userProfile?.freeCredits) || 0) + Math.max(0, Number(userProfile?.paidCredits) || 0)}
                            </div>
                            <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', marginTop: '6px', lineHeight: 1.35 }}>
                                {t(
                                    'dine_credits_use_hint',
                                    'Used for private & date invites. Public invites are free. AI is paused. Free pool is used first.'
                                )}
                            </div>
                            <button
                                type="button"
                                className="ui-btn ui-btn--ghost"
                                onClick={() => navigate('/settings/credits')}
                                style={{ marginTop: '8px', fontSize: '0.65rem', padding: '2px 8px' }}
                            >
                                {t('open_dine_credits_wallet', 'Wallet')}
                            </button>
                        </div>
                    )}

                    {userProfile?.trialExpiry && new Date(userProfile.trialExpiry.seconds * 1000) > new Date() && (
                        <div className="profile-subscription-trial-banner">
                            {t('trial_ends_label', '✨ Trial Pro Plan Active - Ends:')}{' '}
                            {new Date(userProfile.trialExpiry.seconds * 1000).toLocaleDateString(i18n.language, {
                                month: 'long',
                                day: 'numeric',
                                year: 'numeric',
                            })}
                        </div>
                    )}

                    {userProfile?.role === 'business' && normalizeBusinessTier(userProfile?.subscriptionTier) === 'free' && (
                        <button type="button" onClick={() => navigate('/business/pricing')} className="profile-subscription-upgrade-btn">
                            {t('upgrade_plan_btn', 'Upgrade plan')}
                        </button>
                    )}
                </div>
            )}

            {userProfile?.isGuest && (
                <div className="ui-prompt">
                    <h3 className="ui-prompt__title">{t('guest_welcome_title', { defaultValue: 'Join DineBuddies' })}</h3>
                    <p className="ui-prompt__desc">
                        {t('guest_profile_desc', { defaultValue: 'Create an account to customize your profile and join events.' })}
                    </p>
                    <button type="button" className="ui-btn ui-btn--primary" onClick={() => goToLogin()} style={{ width: '100%', padding: '12px' }}>
                        {t('login_signup')}
                    </button>
                </div>
            )}
        </>
    );
}

export default memo(ProfileFollowStatsAndSubscription);
