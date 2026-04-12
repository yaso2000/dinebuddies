import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../context/AuthContext';
import { useInvitations } from '../../context/InvitationContext';
import { FaUsers, FaCalendar, FaStar, FaArrowUp, FaEye, FaHeart, FaShareAlt } from 'react-icons/fa';
import { HiSparkles } from 'react-icons/hi2';
import { computeBusinessRankingScore } from '../../services/businessRankingService';

const StatCard = ({ icon, iconClass, value, label, trend }) => (
    <div className="bpro-stat-card">
        <div className={`bpro-stat-icon ${iconClass}`}>{icon}</div>
        <div className="bpro-stat-value">{value ?? '—'}</div>
        <div className="bpro-stat-label">{label}</div>
        {trend != null && (
            <div style={{ fontSize: '0.75rem', color: trend >= 0 ? '#10b981' : '#ef4444', display: 'flex', alignItems: 'center', gap: 4 }}>
                <FaArrowUp style={{ transform: trend < 0 ? 'rotate(180deg)' : 'none' }} />
                {Math.abs(trend)}% this month
            </div>
        )}
    </div>
);

const ProOverview = () => {
    const { currentUser, userProfile } = useAuth();
    const { getCommunityMembers } = useInvitations();
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [recentMembers, setRecentMembers] = useState([]);

    const isElite = (userProfile?.subscriptionTier || 'free').toLowerCase() === 'elite';
    const businessName = userProfile?.businessInfo?.businessName || userProfile?.display_name || 'Business';

    // Run only when uid changes; getCommunityMembers is from context and must not retrigger (its ref changes every render and would cause a second fetch that can clear members)
    useEffect(() => {
        if (!currentUser?.uid) return;
        let cancelled = false;
        const fetch = async () => {
            try {
                let membersResult = await getCommunityMembers(currentUser.uid, {
                    includeMembers: true,
                    limit: 200
                });
                if (cancelled) return;
                // Fallback: if callable returns 0 but profile page shows members, read from users doc (same source as profile)
                let memberCountFromCallable = Number(membersResult?.memberCount ?? 0);
                if (memberCountFromCallable === 0) {
                    try {
                        const meSnap = await getDoc(doc(db, 'users', currentUser.uid));
                        if (meSnap.exists()) {
                            const arr = meSnap.data()?.communityMembers;
                            memberCountFromCallable = Array.isArray(arr) ? arr.length : 0;
                            if (memberCountFromCallable > 0 && membersResult) {
                                membersResult = { ...membersResult, memberCount: memberCountFromCallable, members: membersResult.members || [] };
                            }
                        }
                    } catch (_) { /* keep callable result */ }
                }
                const members = membersResult?.members || [];

                // Invitations: by venue (restaurantId), by host (hostId); optional legacy partnerId — merge by id
                const invRef = collection(db, 'invitations');
                const [invByRestaurant, invByHost, invByPartner] = await Promise.all([
                    getDocs(query(invRef, where('restaurantId', '==', currentUser.uid))),
                    getDocs(query(invRef, where('hostId', '==', currentUser.uid))),
                    getDocs(query(invRef, where('partnerId', '==', currentUser.uid))).catch(() => ({ docs: [] }))
                ]);
                if (cancelled) return;
                const byInvId = new Map();
                [...invByRestaurant.docs, ...invByHost.docs, ...(invByPartner?.docs || [])].forEach(d => byInvId.set(d.id, d.data()));
                const allInvitations = Array.from(byInvId.entries()).map(([id, data]) => ({ id, ...data }));
                const now = new Date();
                const activeInv = allInvitations.filter(inv => {
                    const d = inv.date || '';
                    const t = inv.time || '23:59';
                    return new Date(`${d}T${t}`) > now;
                }).length;
                const totalInvitations = byInvId.size;

                let rating = 0, reviewCount = 0;
                try {
                    const [snapPartner, snapProfile, snapRestaurant] = await Promise.all([
                        getDocs(query(collection(db, 'reviews'), where('partnerId', '==', currentUser.uid))),
                        getDocs(query(collection(db, 'reviews'), where('profileId', '==', currentUser.uid))),
                        getDocs(query(collection(db, 'reviews'), where('restaurantId', '==', currentUser.uid)))
                    ]);
                    const byId = new Map();
                    [...snapPartner.docs, ...snapProfile.docs, ...snapRestaurant.docs].forEach(d => byId.set(d.id, d.data()));
                    const allReviews = Array.from(byId.values());
                    reviewCount = allReviews.length;
                    if (reviewCount > 0) {
                        const total = allReviews.reduce((s, d) => s + (d.rating || 0), 0);
                        rating = (total / reviewCount).toFixed(1);
                    }
                } catch (_) { /* reviews optional */ }

                if (cancelled) return;
                // Fresh profile stats from Firestore (not cached userProfile)
                let profileViews = Number(userProfile?.businessInfo?.profileViews || 0);
                let profileLikes = Number(userProfile?.businessInfo?.profileLikes || 0);
                let profileShares = Number(userProfile?.businessInfo?.profileShares || 0);
                let totalInvitationsStored = totalInvitations;
                try {
                    const userSnap = await getDoc(doc(db, 'users', currentUser.uid));
                    if (userSnap.exists()) {
                        const bizInfo = userSnap.data()?.businessInfo || {};
                        profileViews = Number(bizInfo.profileViews ?? profileViews);
                        profileLikes = Number(bizInfo.profileLikes ?? profileLikes);
                        profileShares = Number(bizInfo.profileShares ?? profileShares);
                        if (typeof bizInfo.totalInvitations === 'number') totalInvitationsStored = bizInfo.totalInvitations;
                    }
                } catch (_) { /* keep defaults */ }
                if (cancelled) return;
                setStats({
                    memberCount: Number(memberCountFromCallable || membersResult?.memberCount || 0),
                    activeInvitations: activeInv,
                    totalInvitations: totalInvitationsStored,
                    rating,
                    reviewCount,
                    profileViews,
                    profileLikes,
                    profileShares,
                });

                setRecentMembers(
                    members.slice(0, 5).map((m) => ({
                        id: m.id,
                        display_name: m.displayName || 'User',
                        avatar_url: m.avatarUrl || '',
                        role: m.role || m.profileType || 'user',
                        city: m.city || '',
                        country: m.country || ''
                    }))
                );
            } catch (e) {
                if (!cancelled) console.error('ProOverview fetch error:', e);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        fetch();
        return () => { cancelled = true; };
    }, [currentUser?.uid]);

    // When userProfile loads or profile stats change, sync the three counts without re-fetching
    useEffect(() => {
        const biz = userProfile?.businessInfo;
        if (!biz || !stats) return;
        const v = Number(biz.profileViews || 0);
        const l = Number(biz.profileLikes || 0);
        const s = Number(biz.profileShares || 0);
        setStats(prev => {
            if (!prev || prev.profileViews === v && prev.profileLikes === l && prev.profileShares === s) return prev;
            return { ...prev, profileViews: v, profileLikes: l, profileShares: s };
        });
    }, [userProfile?.businessInfo?.profileViews, userProfile?.businessInfo?.profileLikes, userProfile?.businessInfo?.profileShares, stats?.memberCount]);


    if (loading) return <div className="bpro-spinner" />;

    return (
        <div>
            {/* Stats Grid */}
            <div className="bpro-stats-grid">
                <StatCard icon={<FaUsers />} iconClass="purple" value={stats?.memberCount} label="Community Members" trend={null} />
                <StatCard icon={<FaCalendar />} iconClass="orange" value={stats?.activeInvitations} label="Active Invitations" />
                <StatCard icon={<FaStar />} iconClass="green" value={stats?.reviewCount != null ? (Number(stats.rating) || 0).toFixed(1) : '—'} label={`Rating (${stats?.reviewCount ?? 0} reviews)`} />
                <StatCard icon={<HiSparkles />} iconClass="blue" value={stats?.totalInvitations} label="Total Invitations" />
                <StatCard icon={<FaEye />} iconClass="blue" value={stats?.profileViews} label="Profile Views" />
                <StatCard icon={<FaHeart />} iconClass="purple" value={Math.max(0, stats?.profileLikes ?? 0)} label="Profile Likes" />
                <StatCard icon={<FaShareAlt />} iconClass="orange" value={stats?.profileShares} label="Profile Shares" />
            </div>

            {/* Evaluation Score (for ranking) — 6 metrics only; Active Invitations excluded */}
            {stats && (
                <div className="ui-card" style={{ marginBottom: 20, padding: 16, borderRadius: 16, background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(139, 92, 246, 0.1))', border: '1px solid rgba(99, 102, 241, 0.3)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                        <div>
                            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)' }}>Evaluation Score (for ranking)</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 4 }}>Based on: Community Members, Total Invitations, Rating, Profile Views, Likes, Shares. Active Invitations not included.</div>
                        </div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#6366f1' }}>
                            {Math.round(computeBusinessRankingScore({
                                memberCount: stats.memberCount,
                                totalInvitations: stats.totalInvitations,
                                rating: stats.rating,
                                reviewCount: stats.reviewCount,
                                profileViews: stats.profileViews,
                                profileLikes: stats.profileLikes,
                                profileShares: stats.profileShares
                            }))}
                        </div>
                    </div>
                </div>
            )}


            {/* Recent Members */}
            <div className="ui-card" style={{ marginBottom: 20, padding: 24, borderRadius: 16 }}>
                <div className="bpro-card-header">
                    <div>
                        <div className="bpro-card-title">Recent Members</div>
                        <div className="bpro-card-subtitle">People who joined your community</div>
                    </div>
                </div>
                {recentMembers.length === 0 ? (
                    <div className="bpro-empty">
                        <div className="bpro-empty-icon">👥</div>
                        <h3>No members yet</h3>
                        <p>Share your profile to attract community members</p>
                    </div>
                ) : (
                    <table className="bpro-table">
                        <thead>
                            <tr>
                                <th>Member</th>
                                <th>Role</th>
                                <th>Location</th>
                            </tr>
                        </thead>
                        <tbody>
                            {recentMembers.map(m => (
                                <tr key={m.id}>
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                            <img
                                                src={m.avatar_url || m.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(m.display_name || 'User')}&background=7c3aed&color=fff`}
                                                alt=""
                                                style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }}
                                            />
                                            <span style={{ color: '#f1f5f9', fontWeight: 500 }}>{m.display_name || m.name || 'User'}</span>
                                        </div>
                                    </td>
                                    <td style={{ textTransform: 'capitalize' }}>{m.role === 'business' ? 'Business' : (m.role || 'user')}</td>
                                    <td>{m.city || m.location || '—'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
};

export default ProOverview;
