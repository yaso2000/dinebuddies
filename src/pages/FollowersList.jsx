import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useInvitations } from '../context/InvitationContext';
import { FaArrowRight, FaComments, FaUserPlus, FaUserCheck, FaUsers, FaHeart } from 'react-icons/fa';
import { getFollowers, getFollowing, getMutualFollowers, getMutualFollowersCount } from '../utils/followHelpers';

const FollowersList = () => {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const { currentUser, toggleFollow } = useInvitations();
    const [activeTab, setActiveTab] = useState('mutual');
    const [followers, setFollowers] = useState([]);
    const [following, setFollowing] = useState([]);
    const [mutualFollowers, setMutualFollowers] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!currentUser?.uid) {
            setLoading(false);
            return;
        }

        const fetchFollowData = async () => {
            setLoading(true);
            try {
                console.log('📊 Fetching follow data for user:', currentUser.uid);

                // Fetch all data in parallel
                const [followersData, followingData, mutualData] = await Promise.all([
                    getFollowers(currentUser.uid),
                    getFollowing(currentUser.uid, currentUser.following || []),
                    getMutualFollowers(currentUser.uid, currentUser.following || [])
                ]);

                console.log('✅ Followers:', followersData.length);
                console.log('✅ Following:', followingData.length);
                console.log('✅ Mutual:', mutualData.length);

                // Add mutual followers count to each user
                const followersWithMutual = followersData.map(user => ({
                    ...user,
                    mutualFollowersCount: getMutualFollowersCount(
                        currentUser.following || [],
                        user.following || []
                    ),
                    isFollowingMe: true,
                    isFollowedByMe: (currentUser.following || []).includes(user.id)
                }));

                const followingWithMutual = followingData.map(user => ({
                    ...user,
                    mutualFollowersCount: getMutualFollowersCount(
                        currentUser.following || [],
                        user.following || []
                    ),
                    isFollowingMe: (user.following || []).includes(currentUser.uid),
                    isFollowedByMe: true
                }));

                const mutualWithMutual = mutualData.map(user => ({
                    ...user,
                    mutualFollowersCount: getMutualFollowersCount(
                        currentUser.following || [],
                        user.following || []
                    ),
                    isFollowingMe: true,
                    isFollowedByMe: true
                }));

                setFollowers(followersWithMutual);
                setFollowing(followingWithMutual);
                setMutualFollowers(mutualWithMutual);
            } catch (error) {
                console.error('❌ Error fetching follow data:', error);
                // Set empty arrays on error
                setFollowers([]);
                setFollowing([]);
                setMutualFollowers([]);
            } finally {
                setLoading(false);
            }
        };

        fetchFollowData();
    }, [currentUser]);

    // Filter users based on active tab
    const getFilteredUsers = () => {
        switch (activeTab) {
            case 'followers':
                return followers;
            case 'following':
                return following;
            case 'mutual':
                return mutualFollowers;
            default:
                return [];
        }
    };

    const filteredUsers = getFilteredUsers();

    const handleChatClick = (userId) => {
        // Navigate to chat page
        navigate(`/chat/${userId}`);
    };

    const handleProfileClick = (userId) => {
        navigate(`/profile/${userId}`);
    };

    const isMutualFollow = (user) => {
        return user.isFollowingMe && user.isFollowedByMe;
    };

    return (
        <div className="page-container" style={{ paddingBottom: '100px', minHeight: '100vh' }}>
            {/* Header */}
            <header className="app-header">
                <button className="back-btn" onClick={() => navigate('/profile')}>
                    <FaArrowRight style={i18n.language === 'ar' ? {} : { transform: 'rotate(180deg)' }} />
                </button>
                <h3 style={{ fontSize: '1.1rem', fontWeight: '800' }}>
                    {t('followers')}
                </h3>
                <div style={{ width: '40px' }}></div>
            </header>

            <div style={{ padding: '1.5rem' }}>
                {/* Tabs */}
                <div style={{
                    display: 'flex',
                    gap: '8px',
                    marginBottom: '1.5rem',
                    background: 'var(--bg-card)',
                    padding: '6px',
                    borderRadius: '16px',
                    border: '1px solid var(--border-color)'
                }}>
                    <button
                        onClick={() => setActiveTab('mutual')}
                        style={{
                            flex: 1,
                            padding: '10px',
                            borderRadius: '12px',
                            border: 'none',
                            background: activeTab === 'mutual' ? 'var(--primary)' : 'transparent',
                            color: activeTab === 'mutual' ? 'white' : 'var(--text-muted)',
                            fontSize: '0.85rem',
                            fontWeight: '800',
                            cursor: 'pointer',
                            transition: 'all 0.3s',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px'
                        }}
                    >
                        <FaHeart />
                        {t('mutual')}
                    </button>
                    <button
                        onClick={() => setActiveTab('followers')}
                        style={{
                            flex: 1,
                            padding: '10px',
                            borderRadius: '12px',
                            border: 'none',
                            background: activeTab === 'followers' ? 'var(--primary)' : 'transparent',
                            color: activeTab === 'followers' ? 'white' : 'var(--text-muted)',
                            fontSize: '0.85rem',
                            fontWeight: '800',
                            cursor: 'pointer',
                            transition: 'all 0.3s',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px'
                        }}
                    >
                        <FaUsers />
                        {t('followers')}
                    </button>
                    <button
                        onClick={() => setActiveTab('following')}
                        style={{
                            flex: 1,
                            padding: '10px',
                            borderRadius: '12px',
                            border: 'none',
                            background: activeTab === 'following' ? 'var(--primary)' : 'transparent',
                            color: activeTab === 'following' ? 'white' : 'var(--text-muted)',
                            fontSize: '0.85rem',
                            fontWeight: '800',
                            cursor: 'pointer',
                            transition: 'all 0.3s',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px'
                        }}
                    >
                        <FaUserCheck />
                        {t('following')}
                    </button>
                </div>

                {/* Stats */}
                {!loading && (
                    <div style={{
                        background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(244, 63, 94, 0.1) 100%)',
                        padding: '1rem',
                        borderRadius: '16px',
                        marginBottom: '1.5rem',
                        border: '1px solid rgba(139, 92, 246, 0.2)'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-around', textAlign: 'center' }}>
                            <div>
                                <div style={{ fontSize: '1.5rem', fontWeight: '900', color: 'var(--primary)' }}>
                                    {mutualFollowers.length}
                                </div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '700' }}>
                                    {t('mutual')}
                                </div>
                            </div>
                            <div style={{ borderLeft: '1px solid var(--border-color)' }}></div>
                            <div>
                                <div style={{ fontSize: '1.5rem', fontWeight: '900', color: 'white' }}>
                                    {followers.length}
                                </div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '700' }}>
                                    {t('followers')}
                                </div>
                            </div>
                            <div style={{ borderLeft: '1px solid var(--border-color)' }}></div>
                            <div>
                                <div style={{ fontSize: '1.5rem', fontWeight: '900', color: 'white' }}>
                                    {following.length}
                                </div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '700' }}>
                                    {t('following')}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Loading State */}
                {loading ? (
                    <div style={{
                        textAlign: 'center',
                        padding: '3rem 1rem',
                        color: 'var(--text-muted)'
                    }}>
                        <div style={{
                            width: '50px',
                            height: '50px',
                            border: '4px solid var(--border-color)',
                            borderTop: '4px solid var(--primary)',
                            borderRadius: '50%',
                            animation: 'spin 1s linear infinite',
                            margin: '0 auto 1rem'
                        }} />
                        <p style={{ fontSize: '0.9rem', fontWeight: '600' }}>
                            {t('loading')}
                        </p>
                    </div>
                ) : (
                    /* Users List */
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {filteredUsers.length === 0 ? (
                            <div style={{
                                textAlign: 'center',
                                padding: '3rem 1rem',
                                color: 'var(--text-muted)'
                            }}>
                                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>👥</div>
                                <p style={{ fontSize: '0.9rem', fontWeight: '600' }}>
                                    {t('no_users_in_list')}
                                </p>
                            </div>
                        ) : (
                            filteredUsers.map(user => (
                                <div
                                    key={user.id}
                                    style={{
                                        background: 'var(--bg-card)',
                                        borderRadius: '20px',
                                        padding: '1rem',
                                        border: '1px solid var(--border-color)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '12px',
                                        transition: 'all 0.3s',
                                        cursor: 'pointer'
                                    }}
                                    onClick={() => handleProfileClick(user.id)}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.transform = 'translateY(-2px)';
                                        e.currentTarget.style.boxShadow = '0 8px 20px rgba(139, 92, 246, 0.2)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.transform = 'translateY(0)';
                                        e.currentTarget.style.boxShadow = 'none';
                                    }}
                                >
                                    {/* Avatar */}
                                    <div style={{ position: 'relative' }}>
                                        <div style={{
                                            width: '60px',
                                            height: '60px',
                                            borderRadius: '50%',
                                            border: `3px solid ${isMutualFollow(user) ? 'var(--primary)' : 'var(--border-color)'}`,
                                            overflow: 'hidden'
                                        }}>
                                            <img
                                                src={user.avatar}
                                                alt={user.name}
                                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                            />
                                        </div>
                                        {/* Online indicator */}
                                        <div style={{
                                            position: 'absolute',
                                            bottom: '2px',
                                            right: '2px',
                                            width: '14px',
                                            height: '14px',
                                            background: '#10b981',
                                            border: '2px solid var(--bg-card)',
                                            borderRadius: '50%'
                                        }}></div>
                                    </div>

                                    {/* User Info */}
                                    <div style={{ flex: 1 }}>
                                        <div style={{
                                            fontSize: '1rem',
                                            fontWeight: '800',
                                            marginBottom: '4px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px'
                                        }}>
                                            {user.name}
                                            {isMutualFollow(user) && (
                                                <span style={{
                                                    background: 'rgba(139, 92, 246, 0.2)',
                                                    color: 'var(--primary)',
                                                    padding: '2px 8px',
                                                    borderRadius: '8px',
                                                    fontSize: '0.65rem',
                                                    fontWeight: '800',
                                                    border: '1px solid rgba(139, 92, 246, 0.3)'
                                                }}>
                                                    <FaHeart style={{ fontSize: '0.6rem' }} /> {t('mutual')}
                                                </span>
                                            )}
                                        </div>
                                        <div style={{
                                            fontSize: '0.8rem',
                                            color: 'var(--text-muted)',
                                            marginBottom: '4px'
                                        }}>
                                            {user.bio}
                                        </div>
                                        <div style={{
                                            fontSize: '0.7rem',
                                            color: 'var(--text-muted)',
                                            fontWeight: '600'
                                        }}>
                                            {user.mutualFollowersCount || 0} {t('mutual_followers')}
                                        </div>
                                    </div>

                                    {/* Action Buttons */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        {/* Chat Button - Only for mutual followers */}
                                        {isMutualFollow(user) && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleChatClick(user.id);
                                                }}
                                                style={{
                                                    background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-hover) 100%)',
                                                    color: 'white',
                                                    border: 'none',
                                                    borderRadius: '12px',
                                                    padding: '10px 16px',
                                                    fontSize: '0.85rem',
                                                    fontWeight: '800',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '6px',
                                                    boxShadow: '0 4px 12px rgba(139, 92, 246, 0.3)',
                                                    transition: 'all 0.3s'
                                                }}
                                                onMouseEnter={(e) => {
                                                    e.currentTarget.style.transform = 'scale(1.05)';
                                                    e.currentTarget.style.boxShadow = '0 6px 16px rgba(139, 92, 246, 0.4)';
                                                }}
                                                onMouseLeave={(e) => {
                                                    e.currentTarget.style.transform = 'scale(1)';
                                                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(139, 92, 246, 0.3)';
                                                }}
                                            >
                                                <FaComments />
                                                {t('chat')}
                                            </button>
                                        )}

                                        {/* Follow/Unfollow Button */}
                                        {!user.isFollowedByMe ? (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    toggleFollow(user.id);
                                                }}
                                                style={{
                                                    background: 'rgba(139, 92, 246, 0.15)',
                                                    color: 'var(--primary)',
                                                    border: '1px solid var(--primary)',
                                                    borderRadius: '12px',
                                                    padding: '8px 12px',
                                                    fontSize: '0.75rem',
                                                    fontWeight: '800',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '4px',
                                                    transition: 'all 0.3s'
                                                }}
                                            >
                                                <FaUserPlus style={{ fontSize: '0.7rem' }} />
                                                {t('follow')}
                                            </button>
                                        ) : (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (window.confirm(t('unfollow_confirm'))) {
                                                        toggleFollow(user.id);
                                                    }
                                                }}
                                                style={{
                                                    background: 'transparent',
                                                    color: 'var(--text-muted)',
                                                    border: '1px solid var(--border-color)',
                                                    borderRadius: '12px',
                                                    padding: '8px 12px',
                                                    fontSize: '0.75rem',
                                                    fontWeight: '800',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '4px',
                                                    transition: 'all 0.3s'
                                                }}
                                            >
                                                <FaUserCheck style={{ fontSize: '0.7rem' }} />
                                                {t('following')}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default FollowersList;
