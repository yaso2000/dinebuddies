import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../context/AuthContext';
import { FaUsers, FaCalendar, FaStar, FaEye, FaArrowUp } from 'react-icons/fa';
import { HiSparkles } from 'react-icons/hi2';

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
    const { currentUser } = useAuth();
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [recentMembers, setRecentMembers] = useState([]);

    useEffect(() => {
        if (!currentUser?.uid) return;
        const fetch = async () => {
            try {
                // Members
                const membersSnap = await getDocs(query(
                    collection(db, 'users'),
                    where('joinedCommunities', 'array-contains', currentUser.uid)
                ));

                // Invitations
                const invSnap = await getDocs(query(
                    collection(db, 'invitations'),
                    where('restaurantId', '==', currentUser.uid)
                ));
                const now = new Date();
                const activeInv = invSnap.docs.filter(d => {
                    const data = d.data();
                    return new Date(`${data.date}T${data.time}`) > now;
                }).length;

                // Reviews
                let rating = 0, reviewCount = 0;
                try {
                    const revSnap = await getDocs(query(
                        collection(db, 'reviews'),
                        where('partnerId', '==', currentUser.uid)
                    ));
                    reviewCount = revSnap.size;
                    if (reviewCount > 0) {
                        const total = revSnap.docs.reduce((s, d) => s + (d.data().rating || 0), 0);
                        rating = (total / reviewCount).toFixed(1);
                    }
                } catch (_) { /* reviews optional */ }

                setStats({
                    memberCount: membersSnap.size,
                    activeInvitations: activeInv,
                    totalInvitations: invSnap.size,
                    rating,
                    reviewCount,
                });

                // Recent members (last 5)
                const members = membersSnap.docs.slice(0, 5).map(d => ({ id: d.id, ...d.data() }));
                setRecentMembers(members);
            } catch (e) {
                console.error('ProOverview fetch error:', e);
            } finally {
                setLoading(false);
            }
        };
        fetch();
    }, [currentUser?.uid]);

    if (loading) return <div className="bpro-spinner" />;

    return (
        <div>
            {/* Stats Grid */}
            <div className="bpro-stats-grid">
                <StatCard icon={<FaUsers />} iconClass="purple" value={stats?.memberCount} label="Community Members" trend={null} />
                <StatCard icon={<FaCalendar />} iconClass="orange" value={stats?.activeInvitations} label="Active Invitations" />
                <StatCard icon={<FaStar />} iconClass="green" value={stats?.rating || '—'} label={`Rating (${stats?.reviewCount} reviews)`} />
                <StatCard icon={<HiSparkles />} iconClass="blue" value={stats?.totalInvitations} label="Total Invitations" />
            </div>

            {/* Recent Members */}
            <div className="bpro-card">
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
                                <th>Account Type</th>
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
                                    <td style={{ textTransform: 'capitalize' }}>{m.accountType || 'user'}</td>
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
