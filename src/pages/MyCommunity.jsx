import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { useInvitations } from '../context/InvitationContext';
import { FaArrowLeft, FaUsers, FaEdit, FaComments, FaHeart, FaPlus, FaEnvelope } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';
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
    const [topMembers, setTopMembers] = useState([]);

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

    useEffect(() => {
        if (!isBusinessAccount || !currentUser?.uid) return;
        let cancelled = false;
        (async () => {
            try {
                const result = await getCommunityMembers(currentUser.uid, { includeMembers: true, limit: 10 });
                const list = result?.members || [];
                if (!cancelled) setTopMembers(list.slice(0, 3));
            } catch (e) {
                if (!cancelled) setTopMembers([]);
            }
        })();
        return () => { cancelled = true; };
    }, [currentUser?.uid, isBusinessAccount, getCommunityMembers]);

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
                <p style={{ color: 'var(--text-muted)' }}>Loading your community...</p>
            </div>
        );
    }

    return (
        <div className="page-container my-community-page">
            <div className="my-community-inner">
            {/* Header */}
            <header className="app-header sticky-header-glass">
                <button className="back-btn" onClick={() => navigate('/')}>
                    <FaArrowLeft style={{ transform: 'rotate(180deg)' }} />
                </button>
                <div style={{ flex: 1, textAlign: 'center' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: '800', margin: 0 }}>
                        {t('my_community', 'My Community')}
                    </h3>
                </div>
                <button
                    className="back-btn"
                    onClick={() => navigate(`/business/${currentUser.uid}`)}
                >
                    <FaUsers />
                </button>
            </header>

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
                    onClick={() => navigate('/create-story')}
                    className="my-community-btn my-community-btn--story"
                >
                    <FaPlus style={{ fontSize: '0.8rem' }} />
                    Story
                </button>
                <button
                    onClick={() => navigate('/create-post')}
                    className="my-community-btn my-community-btn--post"
                >
                    <FaEdit style={{ fontSize: '0.8rem' }} />
                    Post
                </button>
                <button
                    onClick={() => navigate(`/community/${currentUser.uid}`)}
                    className="my-community-btn my-community-btn--chat"
                >
                    <FaComments style={{ fontSize: '0.8rem' }} />
                    Chat
                </button>
            </div>

            {/* Top members */}
            <div className="my-community-section">
                <h3>{t('top_members', 'Top members')}</h3>
                <div className="my-community-card">
                    {topMembers.length === 0 ? (
                        <div className="my-community-empty ui-prompt__desc">
                            {t('no_members_yet', 'No members yet. Share your community to grow.')}
                        </div>
                    ) : (
                        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                            {topMembers.map((member, index) => (
                                <li key={member.id || index} className="my-community-member-item">
                                    <div style={{
                                        width: '40px',
                                        height: '40px',
                                        borderRadius: '50%',
                                        background: 'var(--hover-overlay)',
                                        overflow: 'hidden',
                                        flexShrink: 0
                                    }}>
                                        {member.avatarUrl ? (
                                            <img src={member.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        ) : (
                                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)', fontSize: '1rem', fontWeight: '700' }}>
                                                {(member.displayName || member.name || '?')[0].toUpperCase()}
                                            </div>
                                        )}
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontWeight: '700', fontSize: '0.95rem', color: 'var(--text-main)' }}>
                                            {member.displayName || member.name || t('member', 'Member')}
                                        </div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                            {t('community_member', 'Community member')}
                                        </div>
                                    </div>
                                    <span style={{
                                        width: '28px',
                                        height: '28px',
                                        borderRadius: '50%',
                                        background: 'var(--primary)',
                                        color: 'white',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '0.8rem',
                                        fontWeight: '800'
                                    }}>
                                        {index + 1}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>

            </div>
        </div>
    );
};

export default MyCommunity;
