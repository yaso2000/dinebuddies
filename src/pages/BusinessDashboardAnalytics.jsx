import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaChartLine, FaHeart, FaStar, FaStore } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { getBusinessSubscriptionAccess } from '../utils/businessSubscription';
import { computeBusinessRankingBreakdown } from '../services/businessRankingService';
import { loadBusinessRankingStats } from '../services/businessRankingStats';
import BusinessDashboardShell from '../components/BusinessDashboardShell';
import './MyCommunity.css';

function BreakdownRow({ icon, label, count, unitLabel, multiplierLabel, points }) {
    return (
        <div className="my-community-stat-card ui-card" style={{ textAlign: 'start', padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <span style={{ color: 'var(--primary)', fontSize: '1.1rem' }}>{icon}</span>
                <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-main)' }}>{label}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '12px' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {count} {unitLabel} · {multiplierLabel}
                </span>
                <span style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--primary)' }}>+{points}</span>
            </div>
        </div>
    );
}

export default function BusinessDashboardAnalytics() {
    const navigate = useNavigate();
    const { t } = useTranslation();
    const { currentUser, userProfile } = useAuth();
    const [breakdown, setBreakdown] = useState(null);
    const [loading, setLoading] = useState(true);

    const isBusinessAccount = userProfile?.isBusiness;
    const tierAccess = getBusinessSubscriptionAccess(userProfile?.subscriptionTier);

    useEffect(() => {
        if (!isBusinessAccount || !currentUser?.uid) {
            if (!isBusinessAccount) navigate('/');
            return;
        }
        if (!tierAccess.canUseAdvancedAnalytics) {
            setLoading(false);
            return;
        }

        let cancelled = false;
        (async () => {
            setLoading(true);
            try {
                const stats = await loadBusinessRankingStats(currentUser.uid, userProfile);
                if (!cancelled) setBreakdown(computeBusinessRankingBreakdown(stats));
            } catch (e) {
                console.error('BusinessDashboardAnalytics load error:', e);
                if (!cancelled) setBreakdown(computeBusinessRankingBreakdown({}));
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();

        return () => { cancelled = true; };
    }, [currentUser?.uid, isBusinessAccount, navigate, userProfile, tierAccess.canUseAdvancedAnalytics]);

    if (!isBusinessAccount || !currentUser) return null;

    if (!tierAccess.canUseAdvancedAnalytics) {
        return (
            <BusinessDashboardShell
                title={t('analytics', 'Analytics')}
                icon={<FaChartLine />}
            >
                <div className="my-community-stat-card ui-card" style={{ textAlign: 'center', padding: '2rem 1.25rem' }}>
                    <FaChartLine style={{ fontSize: '2rem', color: 'var(--primary)', marginBottom: '12px' }} />
                    <h4 style={{ margin: '0 0 8px', fontSize: '1.1rem', fontWeight: 800 }}>
                        {t('biz_plan_analytics_paid_only', 'Advanced analytics is a Paid Business feature')}
                    </h4>
                    <p style={{ margin: '0 0 16px', fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                        {t(
                            'biz_plan_analytics_paid_hint',
                            'Upgrade to see ranking breakdown, engagement points, and performance insights.'
                        )}
                    </p>
                    <button
                        type="button"
                        className="my-community-btn my-community-btn--post ios-tap-target"
                        style={{ width: '100%' }}
                        onClick={() => navigate('/settings/subscription')}
                    >
                        {t('biz_plan_upgrade_cta', 'Upgrade to Paid')} →
                    </button>
                </div>
            </BusinessDashboardShell>
        );
    }

    return (
        <BusinessDashboardShell
            title={t('analytics', 'Analytics')}
            icon={<FaChartLine />}
        >
            {loading ? (
                <p className="my-community-empty ui-prompt__desc">{t('loading', 'Loading…')}</p>
            ) : (
                <>
                    <div className="my-community-stat-card ui-card" style={{ textAlign: 'center', padding: '2rem 1rem', marginBottom: '1rem' }}>
                        <FaChartLine style={{ fontSize: '2rem', color: 'var(--primary)', marginBottom: '12px' }} />
                        <h4 style={{ fontSize: '2.5rem', fontWeight: 800, margin: '8px 0' }}>{breakdown?.total ?? 0}</h4>
                        <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', margin: 0 }}>
                            {t('biz_points_total', 'Total ranking points')}
                        </p>
                    </div>

                    <p className="my-community-empty ui-prompt__desc" style={{ marginBottom: '1rem' }}>
                        {t('biz_dashboard_analytics_hint', 'Points determine your position in business rankings.')}
                    </p>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <BreakdownRow
                            icon={<FaStore />}
                            label={t('biz_points_hosting', 'Completed hosted invitations')}
                            count={breakdown?.hostedInvitations ?? 0}
                            unitLabel={t('biz_points_hosting_unit', 'invitations')}
                            multiplierLabel={t('biz_points_multiplier_5', '5 pts each')}
                            points={breakdown?.hostingPoints ?? 0}
                        />
                        <BreakdownRow
                            icon={<FaHeart />}
                            label={t('biz_points_profile_likes', 'Profile likes')}
                            count={breakdown?.profileLikes ?? 0}
                            unitLabel={t('biz_points_like_unit', 'likes')}
                            multiplierLabel={t('biz_points_multiplier_1', '1 pt each')}
                            points={breakdown?.profileLikePoints ?? 0}
                        />
                        <BreakdownRow
                            icon={<FaHeart />}
                            label={t('biz_points_post_likes', 'Post likes')}
                            count={breakdown?.postLikes ?? 0}
                            unitLabel={t('biz_points_like_unit', 'likes')}
                            multiplierLabel={t('biz_points_multiplier_1', '1 pt each')}
                            points={breakdown?.postLikePoints ?? 0}
                        />
                        <BreakdownRow
                            icon={<FaStar />}
                            label={t('biz_points_rating_stars', 'Review stars')}
                            count={breakdown?.ratingStarsTotal ?? 0}
                            unitLabel={t('biz_points_star_unit', 'stars')}
                            multiplierLabel={t('biz_points_multiplier_1', '1 pt each')}
                            points={breakdown?.ratingPoints ?? 0}
                        />
                    </div>

                    <button
                        type="button"
                        className="my-community-btn my-community-btn--post ios-tap-target"
                        style={{ width: '100%', marginTop: '1.25rem' }}
                        onClick={() => navigate('/rankings')}
                    >
                        {t('rankings_title', 'Business Rankings')}
                    </button>
                </>
            )}
        </BusinessDashboardShell>
    );
}
