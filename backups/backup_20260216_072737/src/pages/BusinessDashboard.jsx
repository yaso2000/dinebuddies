import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { FaUsers, FaUserPlus, FaChartLine, FaEye, FaStar, FaEdit, FaStore, FaCalendar, FaCog } from 'react-icons/fa';
import { HiBuildingStorefront } from 'react-icons/hi2';
import CommunityManagement from '../components/CommunityManagement';

const BusinessDashboard = () => {
    const navigate = useNavigate();
    const { currentUser, userProfile } = useAuth();
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        memberCount: 0,
        activeInvitations: 0,
        profileViews: 0,
        rating: 0,
        reviewCount: 0
    });
    const [recentActivity, setRecentActivity] = useState([]);

    // Redirect if not a business account
    useEffect(() => {
        if (!userProfile || userProfile.accountType !== 'business') {
            navigate('/');
        }
    }, [userProfile, navigate]);

    useEffect(() => {
        if (currentUser && userProfile?.accountType === 'business') {
            fetchDashboardData();
        }
    }, [currentUser, userProfile]);

    const fetchDashboardData = async () => {
        try {
            setLoading(true);
            console.log('🔄 Fetching dashboard data for:', currentUser.uid);

            // Fetch community members count - FIXED: Read from users collection
            const membersQuery = query(
                collection(db, 'users'),
                where('joinedCommunities', 'array-contains', currentUser.uid)
            );
            const membersSnapshot = await getDocs(membersQuery);
            const memberCount = membersSnapshot.size;
            console.log('👥 Community Members:', memberCount);

            // Fetch active invitations count - FIXED: use restaurantId instead of partnerId
            const invitationsQuery = query(
                collection(db, 'invitations'),
                where('restaurantId', '==', currentUser.uid)
            );
            const invitationsSnapshot = await getDocs(invitationsQuery);
            console.log('📨 Total Invitations found:', invitationsSnapshot.size);

            // Filter for active invitations (not expired)
            const now = new Date();
            const activeInvitations = invitationsSnapshot.docs.filter(doc => {
                const data = doc.data();
                const inviteDate = new Date(`${data.date}T${data.time}`);
                const isActive = inviteDate > now;
                console.log('  - Invitation:', data.title, '| Date:', inviteDate, '| Active:', isActive);
                return isActive;
            }).length;
            console.log('✅ Active Invitations:', activeInvitations);

            // Fetch reviews and calculate real rating
            const reviewsQuery = query(
                collection(db, 'reviews'),
                where('partnerId', '==', currentUser.uid)
            );
            const reviewsSnapshot = await getDocs(reviewsQuery);
            const reviewsData = reviewsSnapshot.docs.map(doc => doc.data());
            const reviewCount = reviewsData.length;
            console.log('⭐ Reviews found:', reviewCount);

            let rating = 0;
            if (reviewCount > 0) {
                const totalRating = reviewsData.reduce((sum, review) => sum + review.rating, 0);
                rating = totalRating / reviewCount;
                console.log('📊 Rating calculation:', {
                    totalRating,
                    reviewCount,
                    average: rating.toFixed(1)
                });
            }

            // Fetch recent activity (last 5 invitations) - Removed orderBy to avoid index requirement
            const recentQuery = query(
                collection(db, 'invitations'),
                where('restaurantId', '==', currentUser.uid),
                limit(5)
            );
            const recentSnapshot = await getDocs(recentQuery);
            const recentData = recentSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            console.log('📋 Recent Activity:', recentData.length, 'items');

            const finalStats = {
                memberCount,
                activeInvitations,
                profileViews: userProfile?.businessInfo?.profileViews || 0,
                rating,
                reviewCount
            };

            console.log('✅ Final Stats:', finalStats);
            setStats(finalStats);

            setRecentActivity(recentData);
        } catch (error) {
            console.error('❌ Error fetching dashboard data:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="page-container" style={{ padding: '2rem', textAlign: 'center' }}>
                <div style={{
                    width: '50px',
                    height: '50px',
                    border: '4px solid var(--border-color)',
                    borderTop: '4px solid var(--primary)',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite',
                    margin: '0 auto 1rem'
                }} />
                <p style={{ color: 'var(--text-muted)' }}>Loading dashboard...</p>
            </div>
        );
    }

    const businessInfo = userProfile?.businessInfo || {};

    return (
        <div className="page-container" style={{ paddingBottom: '100px' }}>
            {/* Header */}
            <header className="app-header sticky-header-glass">
                <div style={{ width: '40px' }}></div>
                <h3 style={{ fontSize: '1rem', fontWeight: '800', margin: 0 }}>
                    📊 Business Dashboard
                </h3>
                <button className="back-btn" onClick={() => navigate('/edit-business-profile')}>
                    <FaEdit />
                </button>
            </header>

            {/* Business Info Card */}
            <div style={{
                marginTop: '24px',
                background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(236, 72, 153, 0.1))',
                border: '2px solid rgba(139, 92, 246, 0.3)',
                borderRadius: '20px',
                padding: '1.5rem',
                marginBottom: '1.5rem'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                    {userProfile?.photo_url ? (
                        <img
                            src={userProfile.photo_url}
                            alt="Logo"
                            style={{
                                width: '60px',
                                height: '60px',
                                borderRadius: '12px',
                                objectFit: 'cover',
                                border: '2px solid var(--primary)'
                            }}
                        />
                    ) : (
                        <div style={{
                            width: '60px',
                            height: '60px',
                            borderRadius: '12px',
                            background: 'linear-gradient(135deg, var(--primary), #f97316)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '1.5rem'
                        }}>
                            <HiBuildingStorefront style={{ color: 'var(--btn-text)' }} />
                        </div>
                    )}
                    <div style={{ flex: 1 }}>
                        <h2 style={{ fontSize: '1.3rem', fontWeight: '800', marginBottom: '0.25rem' }}>
                            {userProfile?.display_name || 'Your Business'}
                        </h2>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
                            {businessInfo.businessType || 'Business'} • {businessInfo.city || 'Location'}
                        </p>
                    </div>
                </div>

                {/* Quick Actions */}
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <button
                        onClick={() => navigate(`/partner/${currentUser.uid}`)}
                        style={{
                            flex: '1 1 calc(50% - 5px)',
                            padding: '12px',
                            background: 'var(--bg-card)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '12px',
                            color: 'var(--text-main)',
                            fontWeight: '700',
                            fontSize: '0.85rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'rgba(139, 92, 246, 0.1)';
                            e.currentTarget.style.borderColor = 'var(--primary)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'var(--bg-card)';
                            e.currentTarget.style.borderColor = 'var(--border-color)';
                        }}
                    >
                        <FaEye /> View Profile
                    </button>
                    <button
                        onClick={() => navigate('/edit-business-profile')}
                        style={{
                            flex: '1 1 calc(50% - 5px)',
                            padding: '12px',
                            background: 'var(--bg-card)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '12px',
                            color: 'var(--text-main)',
                            fontWeight: '700',
                            fontSize: '0.85rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'rgba(139, 92, 246, 0.1)';
                            e.currentTarget.style.borderColor = 'var(--primary)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'var(--bg-card)';
                            e.currentTarget.style.borderColor = 'var(--border-color)';
                        }}
                    >
                        <FaEdit /> Edit Profile
                    </button>
                    <button
                        onClick={() => navigate('/settings')}
                        style={{
                            flex: '1 1 calc(50% - 5px)',
                            padding: '12px',
                            background: 'var(--bg-card)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '12px',
                            color: 'var(--text-main)',
                            fontWeight: '700',
                            fontSize: '0.85rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'rgba(139, 92, 246, 0.1)';
                            e.currentTarget.style.borderColor = 'var(--primary)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'var(--bg-card)';
                            e.currentTarget.style.borderColor = 'var(--border-color)';
                        }}
                    >
                        <FaCog /> Settings
                    </button>
                </div>
            </div>

            {/* Stats Grid */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '1rem',
                marginBottom: '1.5rem'
            }}>
                {/* Community Members */}
                <div style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '16px',
                    padding: '1.25rem',
                    textAlign: 'center'
                }}>
                    <div style={{
                        width: '50px',
                        height: '50px',
                        borderRadius: '12px',
                        background: 'rgba(34, 197, 94, 0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 0.75rem',
                        fontSize: '1.3rem',
                        color: '#22c55e'
                    }}>
                        <FaUsers />
                    </div>
                    <div style={{ fontSize: '1.8rem', fontWeight: '900', marginBottom: '0.25rem' }}>
                        {stats.memberCount}
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        Community Members
                    </div>
                </div>

                {/* Active Invitations */}
                <div style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '16px',
                    padding: '1.25rem',
                    textAlign: 'center'
                }}>
                    <div style={{
                        width: '50px',
                        height: '50px',
                        borderRadius: '12px',
                        background: 'rgba(139, 92, 246, 0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 0.75rem',
                        fontSize: '1.3rem',
                        color: 'var(--primary)'
                    }}>
                        <FaUserPlus />
                    </div>
                    <div style={{ fontSize: '1.8rem', fontWeight: '900', marginBottom: '0.25rem' }}>
                        {stats.activeInvitations}
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        Active Invitations
                    </div>
                </div>

                {/* Profile Views */}
                <div style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '16px',
                    padding: '1.25rem',
                    textAlign: 'center'
                }}>
                    <div style={{
                        width: '50px',
                        height: '50px',
                        borderRadius: '12px',
                        background: 'rgba(59, 130, 246, 0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 0.75rem',
                        fontSize: '1.3rem',
                        color: '#3b82f6'
                    }}>
                        <FaEye />
                    </div>
                    <div style={{ fontSize: '1.8rem', fontWeight: '900', marginBottom: '0.25rem' }}>
                        {stats.profileViews}
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        Profile Views
                    </div>
                </div>

                {/* Rating */}
                <div style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '16px',
                    padding: '1.25rem',
                    textAlign: 'center'
                }}>
                    <div style={{
                        width: '50px',
                        height: '50px',
                        borderRadius: '12px',
                        background: 'rgba(251, 191, 36, 0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 0.75rem',
                        fontSize: '1.3rem',
                        color: '#fbbf24'
                    }}>
                        <FaStar />
                    </div>
                    <div style={{ fontSize: '1.8rem', fontWeight: '900', marginBottom: '0.25rem' }}>
                        {stats.rating.toFixed(1)}
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        Rating ({stats.reviewCount} reviews)
                    </div>
                </div>
            </div>

            {/* Recent Activity */}
            <div style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                borderRadius: '16px',
                padding: '1.5rem'
            }}>
                <h3 style={{
                    fontSize: '1.1rem',
                    fontWeight: '800',
                    marginBottom: '1rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                }}>
                    <FaCalendar style={{ color: 'var(--primary)' }} />
                    Recent Activity
                </h3>

                {recentActivity.length === 0 ? (
                    <div style={{
                        textAlign: 'center',
                        padding: '2rem',
                        color: 'var(--text-muted)'
                    }}>
                        <FaUserPlus style={{ fontSize: '3rem', marginBottom: '1rem', opacity: 0.3 }} />
                        <p>No recent activity</p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {recentActivity.map((activity) => (
                            <div
                                key={activity.id}
                                onClick={() => navigate(`/invitation/${activity.id}`)}
                                style={{
                                    padding: '1rem',
                                    background: 'rgba(139, 92, 246, 0.05)',
                                    border: '1px solid rgba(139, 92, 246, 0.1)',
                                    borderRadius: '12px',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.background = 'rgba(139, 92, 246, 0.1)';
                                    e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.3)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.background = 'rgba(139, 92, 246, 0.05)';
                                    e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.1)';
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{
                                        width: '40px',
                                        height: '40px',
                                        borderRadius: '10px',
                                        background: 'linear-gradient(135deg, var(--primary), #f97316)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '1.1rem',
                                        color: 'var(--btn-text)'
                                    }}>
                                        <FaUserPlus />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: '700', marginBottom: '4px' }}>
                                            New Invitation
                                        </div>
                                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                            {activity.createdAt?.toDate?.()?.toLocaleDateString() || 'Recent'}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Community Management */}
            <div style={{ marginTop: '1.5rem' }}>
                <CommunityManagement partnerId={currentUser.uid} />
            </div>
        </div>
    );
};

export default BusinessDashboard;
