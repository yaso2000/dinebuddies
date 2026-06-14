import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { useInvitations } from '../context/InvitationContext';
import { FaUsers, FaComments, FaHeart, FaEnvelope, FaStore, FaBullhorn, FaThLarge, FaInbox, FaArchive, FaChartLine } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';
import BusinessDashboardShell from '../components/BusinessDashboardShell';
import CommunityManagement from '../components/CommunityManagement';
import { getBusinessSubscriptionAccess } from '../utils/businessSubscription';
import './MyCommunity.css';

const MyCommunity = () => {
    const navigate = useNavigate();
    const { t } = useTranslation();
    const { currentUser, userProfile } = useAuth();
    const { getCommunityMembers } = useInvitations();
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        members: 0,
        invitations: 0,
        engagement: 0
    });

    const tierAccess = getBusinessSubscriptionAccess(userProfile?.subscriptionTier);

    // Check if user is a business account (unified flag)
    const isBusinessAccount = userProfile?.isBusiness || false;

    useEffect(() => {
        if (!isBusinessAccount || !currentUser?.uid) {
            if (!isBusinessAccount) navigate('/');
            return;
        }

        const unsubInvitations = subscribeToInvitations();
        const unsubMembers = subscribeToMembers();
        const unsubEngagement = subscribeToEngagement();

        return () => {
            if (unsubInvitations) unsubInvitations();
            if (unsubMembers) unsubMembers();
            if (unsubEngagement) unsubEngagement();
        };
    }, [currentUser?.uid, isBusinessAccount]);

    const subscribeToMembers = () => {
        try {
            const refreshMemberCount = async () => {
                const result = await getCommunityMembers(currentUser.uid, {
                    includeMembers: false,
                    limit: 1
                });
                setStats(prev => ({
                    ...prev,
                    members: Number(result?.memberCount || 0)
                }));
            };

            refreshMemberCount();
            const intervalId = setInterval(refreshMemberCount, 30000);
            return () => clearInterval(intervalId);
        } catch (error) {
            console.error("Error in subscribeToMembers:", error);
            return () => { };
        }
    };

    const invitationIdsByRestaurant = useRef(new Set());
    const invitationIdsByHost = useRef(new Set());

    const subscribeToInvitations = () => {
        try {
            // Count invitations for this business: at this venue (restaurantId) OR created by partner (hostId)
            const qRestaurant = query(
                collection(db, 'invitations'),
                where('restaurantId', '==', currentUser.uid)
            );
            const qHost = query(
                collection(db, 'invitations'),
                where('hostId', '==', currentUser.uid)
            );
            const applyCount = () => {
                const merged = new Set([...invitationIdsByRestaurant.current, ...invitationIdsByHost.current]);
                setStats(prev => ({ ...prev, invitations: merged.size }));
                setLoading(false);
            };
            const unsub1 = onSnapshot(qRestaurant, (snapshot) => {
                invitationIdsByRestaurant.current = new Set(snapshot.docs.map(d => d.id));
                applyCount();
            }, (error) => {
                console.error('Error subscribing to invitations (restaurantId):', error);
                setLoading(false);
            });
            const unsub2 = onSnapshot(qHost, (snapshot) => {
                invitationIdsByHost.current = new Set(snapshot.docs.map(d => d.id));
                applyCount();
            }, (error) => {
                console.error('Error subscribing to invitations (hostId):', error);
                setLoading(false);
            });
            return () => {
                unsub1();
                unsub2();
            };
        } catch (error) {
            console.error('Error subscribing to invitations:', error);
            setLoading(false);
            return () => { };
        }
    };

    const subscribeToEngagement = () => {
        try {
            const q = query(
                collection(db, 'communityPosts'),
                where('partnerId', '==', currentUser.uid),
                orderBy('createdAt', 'asc')
            );
            return onSnapshot(q, (snapshot) => {
                const postsList = snapshot.docs.map(d => ({ ...d.data() }));
                const totalEngagement = postsList.reduce((sum, post) => {
                    const likes = post.likes?.length || 0;
                    const comments = post.comments?.length || 0;
                    return sum + likes + comments;
                }, 0);
                setStats(prev => ({ ...prev, engagement: totalEngagement }));
            }, (error) => {
                console.error('Error subscribing to engagement:', error);
            });
        } catch (error) {
            return () => { };
        }
    };



    if (!isBusinessAccount) {
        return null;
    }

    if (loading) {
        return (
            <BusinessDashboardShell
                title={t('business_dashboard', 'Dashboard')}
                icon={<FaThLarge />}
                onBack={() => navigate('/')}
            >
                <div style={{ padding: '2rem', textAlign: 'center' }}>
                    <div style={{
                        width: '50px',
                        height: '50px',
                        border: '4px solid var(--border-color)',
                        borderTop: '4px solid var(--primary)',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite',
                        margin: '0 auto 1rem'
                    }} />
                    <p style={{ color: 'var(--text-muted)' }}>{t('loading', 'Loading…')}</p>
                </div>
            </BusinessDashboardShell>
        );
    }

    return (
        <BusinessDashboardShell
            title={t('business_dashboard', 'Dashboard')}
            icon={<FaThLarge />}
            onBack={() => navigate('/')}
            rightSlot={(
                <button
                    type="button"
                    className="back-btn"
                    onClick={() => navigate(`/business/${currentUser.uid}`)}
                    aria-label={t('business_profile', 'Business profile')}
                >
                    <FaStore />
                </button>
            )}
        >
            {/* Stats Cards */}
            <div className="my-community-stats">
                <div className="my-community-stat-card ui-card">
                    <FaUsers style={{ fontSize: '1.5rem', color: 'var(--primary)', marginBottom: '8px' }} />
                    <h4 style={{ fontSize: '1.5rem', fontWeight: '800', margin: '4px 0' }}>{stats.members}</h4>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>{t('members', 'Members')}</p>
                </div>
                <div className="my-community-stat-card ui-card">
                    <FaEnvelope style={{ fontSize: '1.5rem', color: 'var(--primary)', marginBottom: '8px' }} />
                    <h4 style={{ fontSize: '1.5rem', fontWeight: '800', margin: '4px 0' }}>{stats.invitations}</h4>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>{t('invitations', 'Invitations')}</p>
                </div>
                <div className="my-community-stat-card ui-card" title={t('engagement_tooltip', 'Likes and comments on your community posts')}>
                    <FaHeart style={{ fontSize: '1.5rem', color: '#ef4444', marginBottom: '8px' }} />
                    <h4 style={{ fontSize: '1.5rem', fontWeight: '800', margin: '4px 0' }}>{stats.engagement}</h4>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>{t('engagement', 'Engagement')}</p>
                    <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', margin: '2px 0 0', opacity: 0.9 }}>{t('engagement_hint', 'Likes + comments')}</p>
                </div>
            </div>

            {/* Action Buttons */}
            <div className="my-community-actions">
                <button
                    type="button"
                    onClick={() => navigate(`/community/${currentUser.uid}`)}
                    className="my-community-btn my-community-btn--chat"
                >
                    <FaComments style={{ fontSize: '0.8rem' }} />
                    {t('chat', 'Chat')}
                </button>
                <button
                    type="button"
                    className="my-community-btn my-community-btn--post ios-tap-target"
                    onClick={() => navigate('/business-dashboard#business-notifications')}
                    title={t('business_member_notifications', 'Member alerts & offers')}
                >
                    <FaBullhorn style={{ fontSize: '0.75rem' }} />
                    {t('business_member_notifications', 'Member alerts')}
                </button>
                <button
                    type="button"
                    onClick={() => navigate('/my-community/analytics')}
                    className="my-community-btn my-community-btn--post"
                >
                    <FaChartLine style={{ fontSize: '0.75rem' }} />
                    {t('analytics', 'Analytics')}
                </button>
                <button
                    type="button"
                    onClick={() => navigate('/my-community/inbox')}
                    className="my-community-btn my-community-btn--story"
                >
                    <FaInbox style={{ fontSize: '0.75rem' }} />
                    {t('inbox', 'Inbox')}
                </button>
                <button
                    type="button"
                    onClick={() => navigate('/my-community/archive')}
                    className="my-community-btn my-community-btn--chat"
                >
                    <FaArchive style={{ fontSize: '0.75rem' }} />
                    {t('archive', 'Archive')}
                </button>
            </div>

            {/* Members & group messaging */}
            <div className="my-community-section">
                <div className="my-community-card" style={{ padding: '1rem' }}>
                    <CommunityManagement
                        businessId={currentUser.uid}
                        businessName={userProfile?.display_name || userProfile?.businessInfo?.name}
                        canUseMemberNotifications={tierAccess.canUseMemberNotifications}
                        compact
                    />
                </div>
            </div>
        </BusinessDashboardShell>
    );
};

export default MyCommunity;
