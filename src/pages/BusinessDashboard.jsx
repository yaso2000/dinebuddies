import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, orderBy, limit, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import CommunityManagement from '../components/CommunityManagement';
import PremiumOfferCard from '../components/PremiumOfferCard';
import { premiumOfferService } from '../services/premiumOfferService';
import { getSafeAvatar } from '../utils/avatarUtils';
import { FaUsers, FaUserPlus, FaChartLine, FaEye, FaStar, FaEdit, FaStore, FaCalendar, FaCog, FaTrash, FaSnowflake, FaCheckCircle, FaHourglassHalf, FaDesktop } from 'react-icons/fa';

const BusinessDashboard = () => {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const { currentUser, userProfile, loading: authLoading } = useAuth();
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        memberCount: 0,
        activeInvitations: 0,
        profileViews: 0,
        rating: 0,
        reviewCount: 0
    });
    const [recentActivity, setRecentActivity] = useState([]);
    const [publishingOffer, setPublishingOffer] = useState(false);
    const [offers, setOffers] = useState([]);
    const [offersLoading, setOffersLoading] = useState(false);

    // Desktop redirect — if user opens this on a wide screen, send to Pro Dashboard
    useEffect(() => {
        if (window.innerWidth >= 1024) {
            navigate('/business-pro', { replace: true });
        }
    }, [navigate]);


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

            // Fetch offers
            setOffersLoading(true);
            const businessOffers = await premiumOfferService.getPartnerOffers(currentUser.uid);
            setOffers(businessOffers);
            setOffersLoading(false);
        } catch (error) {
            console.error('❌ Error fetching dashboard data:', error);
        } finally {
            setLoading(false);
            setOffersLoading(false);
        }
    };

    // Initial loading state and redirection
    useEffect(() => {
        // Wait for auth and profile listener to finish
        if (authLoading) return;

        // If no user or not a business account, redirect
        if (!currentUser || !userProfile || userProfile.role !== 'business') {
            console.log('🚫 Unauthorized or missing business profile, redirecting...');
            navigate('/');
            return;
        }

        // Only fetch data if we are surely a business user
        if (userProfile.role === 'business') {
            fetchDashboardData();
        } else {
            setLoading(false);
        }
    }, [currentUser, userProfile, authLoading, navigate]);

    if (authLoading || (loading && userProfile?.role === 'business')) {
        return (
            <div className="page-container" style={{ padding: '2rem', textAlign: 'center', minHeight: '80vh', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <div style={{
                    width: '50px',
                    height: '50px',
                    border: '4px solid var(--border-color)',
                    borderTop: '4px solid var(--primary)',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite',
                    margin: '0 auto 1rem'
                }} />
                <p style={{ color: 'var(--text-muted)' }}>{t('loading_dashboard', 'Loading dashboard...')}</p>
            </div>
        );
    }

    if (!currentUser || !userProfile || userProfile.role !== 'business') {
        return null;
    }


    const handlePublishOffer = async (offerData, file, offerId = null) => {
        try {
            setPublishingOffer(true);
            if (offerId) {
                await premiumOfferService.updateOffer(offerId, offerData, file);
                alert('✅ Offer updated successfully!');
            } else {
                await premiumOfferService.createOffer(offerData, file);
                alert('✅ Offer published successfully!');
            }

            // Refresh data
            const businessOffers = await premiumOfferService.getPartnerOffers(currentUser.uid);
            setOffers(businessOffers);
            fetchDashboardData();
        } catch (error) {
            console.error('Error in handlePublishOffer:', error);
            alert(`❌ Failed to publish offer: ${error.message}`);
        } finally {
            setPublishingOffer(false);
        }
    };

    const handleFreezeOffer = async (offerId) => {
        if (!window.confirm('Are you sure you want to freeze this offer? It will be removed from the active carousel.')) return;
        try {
            await premiumOfferService.freezeOffer(offerId);
            const businessOffers = await premiumOfferService.getPartnerOffers(currentUser.uid);
            setOffers(businessOffers);
        } catch (error) {
            alert('Error freezing offer: ' + error.message);
        }
    };

    const handleRepublishOffer = async (offerId, offerData) => {
        if (!window.confirm('Are you sure you want to republish this offer?')) return;
        try {
            await premiumOfferService.republishOffer(offerId, currentUser.uid, offerData);
            const businessOffers = await premiumOfferService.getPartnerOffers(currentUser.uid);
            setOffers(businessOffers);
        } catch (error) {
            alert('Could not republish: ' + error.message);
        }
    };

    const handleDeleteOffer = async (offerId) => {
        if (!window.confirm('Are you sure you want to delete this offer permanently?')) return;
        try {
            await premiumOfferService.deleteOffer(offerId);
            setOffers(offers.filter(o => o.id !== offerId));
        } catch (error) {
            alert('Error deleting offer: ' + error.message);
        }
    };


    const businessInfo = userProfile?.businessInfo || {};

    return (
        <div className="page-container" style={{ paddingBottom: '100px' }}>
            {/* Header */}
            <header className="app-header sticky-header-glass">
                <div style={{ width: '40px' }}></div>
                <h3 style={{ fontSize: '1rem', fontWeight: '800', margin: 0 }}>
                    📊 Business Dashboard
                </h3>
                <button className="back-btn" onClick={() => currentUser && navigate(`/partner/${currentUser.uid}`)}>
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
                    <img
                        src={getSafeAvatar(userProfile)}
                        alt="Logo"
                        style={{
                            width: '60px',
                            height: '60px',
                            borderRadius: '12px',
                            objectFit: 'cover',
                            border: '2px solid var(--primary)'
                        }}
                    />
                    <div style={{ flex: 1 }}>
                        <h2 style={{ fontSize: '1.3rem', fontWeight: '800', marginBottom: '0.25rem' }}>
                            {userProfile?.display_name || 'Your Business'}
                        </h2>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
                            <span style={{
                                padding: '4px 10px',
                                background: userProfile?.subscriptionTier === 'elite' || userProfile?.subscriptionTier === 'premium'
                                    ? 'linear-gradient(135deg, #fbbf24, #d97706)'
                                    : userProfile?.subscriptionTier === 'professional'
                                        ? 'linear-gradient(135deg, #8b5cf6, #d946ef)'
                                        : 'rgba(156, 163, 175, 0.2)',
                                borderRadius: '12px',
                                fontSize: '0.75rem',
                                fontWeight: '700',
                                color: 'white'
                            }}>
                                {userProfile?.subscriptionTier === 'elite' || userProfile?.subscriptionTier === 'premium'
                                    ? 'Elite Partner'
                                    : userProfile?.subscriptionTier === 'professional'
                                        ? 'Professional'
                                        : 'Free Plan'}
                            </span>
                            {(!userProfile?.subscriptionTier || userProfile?.subscriptionTier === 'free') && (
                                <button
                                    onClick={() => navigate('/settings/subscription')}
                                    style={{
                                        border: 'none',
                                        background: 'linear-gradient(135deg, #f59e0b, #ea580c)',
                                        color: 'white',
                                        padding: '4px 12px',
                                        borderRadius: '20px',
                                        fontSize: '0.7rem',
                                        fontWeight: '800',
                                        cursor: 'pointer',
                                        boxShadow: '0 2px 8px rgba(139, 92, 246, 0.3)',
                                        marginLeft: '8px',
                                        transition: 'transform 0.2s ease',
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                                    onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                                >
                                    {t('upgrade_now', 'Upgrade Now')}
                                </button>
                            )}
                        </div>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
                            {businessInfo.businessType || 'Business'} • {businessInfo.city || 'Location'}
                        </p>
                    </div>
                </div>

                {/* Trial Promo Banner */}
                {(!userProfile?.subscriptionTier || userProfile?.subscriptionTier === 'free') && (
                    <div
                        onClick={() => navigate('/settings/subscription')}
                        style={{
                            background: 'linear-gradient(135deg, #f59e0b, #ea580c)',
                            padding: '12px 20px',
                            borderRadius: '16px',
                            marginBottom: '1.5rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            color: 'white',
                            cursor: 'pointer',
                            boxShadow: '0 4px 15px rgba(234, 88, 12, 0.3)',
                            animation: 'pulse 2s infinite ease-in-out'
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ fontSize: '1.5rem' }}>🎁</div>
                            <div>
                                <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '800' }}>
                                    Try Elite Partner FREE!
                                </h4>
                                <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.9 }}>
                                    Get a full month of premium features
                                </p>
                            </div>
                        </div>
                        <div style={{
                            background: 'white',
                            color: '#ea580c',
                            padding: '6px 12px',
                            borderRadius: '20px',
                            fontSize: '0.8rem',
                            fontWeight: '900'
                        }}>
                            Explore
                        </div>
                    </div>
                )}

                {/* Quick Actions */}
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <button
                        onClick={() => currentUser && navigate(`/partner/${currentUser.uid}`)}
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
                        onClick={() => currentUser && navigate(`/partner/${currentUser.uid}`)}
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

            {/* Special Offers Management */}
            <div style={{
                marginTop: '1.5rem',
                background: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                borderRadius: '16px',
                padding: '1.5rem'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h3 style={{
                        fontSize: '1.1rem',
                        fontWeight: '800',
                        margin: 0,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                    }}>
                        <FaStore style={{ color: '#ff6b00' }} />
                        My Special Offers
                    </h3>
                    <button
                        onClick={() => navigate('/business-pro', { state: { openDesign: true } })}
                        style={{
                            background: 'var(--primary)',
                            color: 'white',
                            border: 'none',
                            padding: '6px 14px',
                            borderRadius: '12px',
                            fontSize: '0.8rem',
                            fontWeight: '700',
                            cursor: 'pointer'
                        }}
                    >
                        + New
                    </button>
                </div>

                {offersLoading ? (
                    <div style={{ textAlign: 'center', padding: '1rem' }}>Loading offers...</div>
                ) : offers.length === 0 ? (
                    <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>No offers created yet.</p>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {offers.map((offer) => (
                            <PremiumOfferCard
                                key={offer.id}
                                offer={offer}
                                isOwnerView={true}
                                onEdit={(o) => navigate('/business-pro', { state: { openDesign: true, editOffer: o } })}
                                onFreeze={(o) => handleFreezeOffer(o.id)}
                                onRepublish={(o) => handleRepublishOffer(o.id, o)}
                                onDelete={(o) => handleDeleteOffer(o.id)}
                            />
                        ))}
                    </div>
                )}
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
