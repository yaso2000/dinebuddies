import React, { useEffect, useState } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useTranslation } from 'react-i18next';
import { FaUsers, FaUserPlus, FaEye, FaStar, FaHeart } from 'react-icons/fa';
import { useAuth } from '../../context/AuthContext';
import { useInvitations } from '../../context/InvitationContext';
import { AppText } from '../base';

function StatTile({ icon, iconColor, iconBg, value, label, title }) {
    return (
        <div title={title} style={{
            background: 'var(--bg-card)', border: '1px solid var(--border-color)',
            borderRadius: '16px', padding: '1.25rem', textAlign: 'center',
        }}>
            <div style={{
                width: '50px', height: '50px', borderRadius: '12px', background: iconBg,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 0.75rem', fontSize: '1.3rem', color: iconColor,
            }}>{icon}</div>
            <AppText as="div" style={{ fontSize: '1.8rem', fontWeight: 900, marginBottom: '0.25rem' }}>{value}</AppText>
            <AppText as="div" style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{label}</AppText>
        </div>
    );
}

/**
 * The business's core stats (members, active invitations, profile views, rating,
 * engagement) — moved here from the dashboard so all analytics live on one page.
 * Self-contained: does its own reads so it can drop into the Analytics page.
 */
export default function BusinessCoreStats() {
    const { t } = useTranslation();
    const { currentUser, userProfile } = useAuth();
    const { getCommunityMembers } = useInvitations();
    const [stats, setStats] = useState({
        memberCount: 0, activeInvitations: 0, profileViews: 0, rating: 0, reviewCount: 0, engagement: 0,
    });
    const [memberLoading, setMemberLoading] = useState(true);

    useEffect(() => {
        const uid = currentUser?.uid;
        if (!uid) return undefined;
        let cancelled = false;

        (async () => {
            try {
                const [invitationsSnap, reviewsSnap, engagementSnap] = await Promise.all([
                    getDocs(query(collection(db, 'invitations'), where('restaurantId', '==', uid))),
                    getDocs(query(collection(db, 'reviews'), where('partnerId', '==', uid))),
                    getDocs(query(collection(db, 'communityPosts'), where('partnerId', '==', uid))),
                ]);
                const now = new Date();
                const activeInvitations = invitationsSnap.docs
                    .map((d) => d.data())
                    .filter((inv) => new Date(`${inv.date}T${inv.time}`) > now).length;
                const reviews = reviewsSnap.docs.map((d) => d.data());
                const reviewCount = reviews.length;
                const rating = reviewCount > 0 ? reviews.reduce((s, r) => s + (r.rating || 0), 0) / reviewCount : 0;
                const engagement = engagementSnap.docs.reduce((s, d) => {
                    const p = d.data();
                    const commentN = Number.isFinite(p.commentCount) ? p.commentCount : (p.comments?.length || 0);
                    return s + (p.likes?.length || 0) + commentN;
                }, 0);
                if (!cancelled) {
                    setStats((prev) => ({
                        ...prev,
                        activeInvitations,
                        profileViews: userProfile?.businessInfo?.profileViews || 0,
                        rating,
                        reviewCount,
                        engagement,
                    }));
                }
            } catch (e) {
                console.error('BusinessCoreStats reads:', e);
            }
        })();

        (async () => {
            try {
                setMemberLoading(true);
                const res = await getCommunityMembers(uid, { includeMembers: false, limit: 1 });
                if (!cancelled) setStats((prev) => ({ ...prev, memberCount: Number(res?.memberCount || 0) }));
            } catch (e) {
                console.error('BusinessCoreStats member count:', e);
            } finally {
                if (!cancelled) setMemberLoading(false);
            }
        })();

        return () => { cancelled = true; };
    }, [currentUser?.uid, userProfile?.businessInfo?.profileViews, getCommunityMembers]);

    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '1.25rem' }}>
            <StatTile icon={<FaUsers />} iconColor="#22c55e" iconBg="rgba(34,197,94,0.1)" value={memberLoading ? '…' : stats.memberCount} label={t('stat_cmty_members', 'Community Members')} />
            <StatTile icon={<FaUserPlus />} iconColor="var(--primary)" iconBg="rgba(139,92,246,0.1)" value={stats.activeInvitations} label={t('stat_active_invites', 'Active Invitations')} />
            <StatTile icon={<FaEye />} iconColor="#3b82f6" iconBg="rgba(59,130,246,0.1)" value={stats.profileViews} label={t('stat_profile_views', 'Profile Views')} />
            <StatTile icon={<FaStar />} iconColor="#fbbf24" iconBg="rgba(251,191,36,0.1)" value={stats.rating.toFixed(1)} label={`${t('stat_rating_reviews', 'Rating')} (${stats.reviewCount} ${t('stat_reviews', 'reviews')})`} />
            <StatTile icon={<FaHeart />} iconColor="#ef4444" iconBg="rgba(239,68,68,0.1)" value={stats.engagement} label={t('engagement', 'Engagement')} title={t('engagement_tooltip', 'Likes and comments on your community posts')} />
        </div>
    );
}
