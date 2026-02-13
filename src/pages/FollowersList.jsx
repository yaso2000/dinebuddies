import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useInvitations } from '../context/InvitationContext';
import { FaArrowRight, FaComments, FaUserPlus, FaUserCheck, FaUsers, FaHeart } from 'react-icons/fa';
import { getFollowers, getFollowing, getMutualFollowers, getMutualFollowersCount } from '../utils/followHelpers';

const FollowersList = () => {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const location = useLocation();
    const { currentUser, toggleFollow } = useInvitations();
    // Use state from location if available, otherwise default to 'mutual' or 'following' if mutual is empty? 
    // Sticking to 'mutual' as default is safer, but let's respect the user's entry point.
    const [activeTab, setActiveTab] = useState(location.state?.activeTab || 'mutual');

    const [followers, setFollowers] = useState([]);
    const [following, setFollowing] = useState([]);
    const [mutualFollowers, setMutualFollowers] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const userId = currentUser?.id || currentUser?.uid;

        if (!userId) {
            // Keep loading if we expect a user, but maybe set a timeout to stop it?
            // Or just return and wait for the user to load.
            return;
        }

        const fetchFollowData = async () => {
            setLoading(true);
            try {
                // Prepare IDs
                const followingIds = currentUser.following || [];

                // 1. Fetch Followers (people who follow me)
                let followersData = [];
                try {
                    followersData = await getFollowers(userId);
                } catch (e) {
                    console.error('Failed to get followers:', e);
                }

                // 2. Fetch Following (people I follow)
                let followingData = [];
                try {
                    if (followingIds.length > 0) {
                        followingData = await getFollowing(userId, followingIds);
                    }
                } catch (e) {
                    console.error('Failed to get following:', e);
                }

                // 3. Calculate Mutuals (Intersection)
                // Mutual = I follow them AND they follow me
                // We can derive this from the two lists we just fetched
                const followersIds = followersData.map(u => u.id);
                // Users I follow who are ALSO in my followers list
                const mutualData = followingData.filter(user => followersIds.includes(user.id));

                // Process Metadata (isFollowingMe, isFollowedByMe, mutualCount)

                // For Followers List:
                const followersProcessed = followersData.map(user => ({
                    ...user,
                    isFollowingMe: true, // They are in my followers list
                    isFollowedByMe: followingIds.includes(user.id), // Do I follow them?
                    mutualFollowersCount: getMutualFollowersCount(followingIds, user.following || [])
                }));

                // For Following List:
                const followingProcessed = followingData.map(user => ({
                    ...user,
                    isFollowingMe: (user.following || []).includes(userId), // Do they follow me?
                    isFollowedByMe: true, // I follow them
                    mutualFollowersCount: getMutualFollowersCount(followingIds, user.following || [])
                }));

                // For Mutual List:
                const mutualProcessed = mutualData.map(user => ({
                    ...user,
                    isFollowingMe: true,
                    isFollowedByMe: true,
                    mutualFollowersCount: getMutualFollowersCount(followingIds, user.following || [])
                }));

                setFollowers(followersProcessed);
                setFollowing(followingProcessed);
                setMutualFollowers(mutualProcessed);

            } catch (error) {
                console.error('❌ Error fetching follow data:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchFollowData();
    }, [currentUser]); // Re-run when currentUser updates (e.g. following list changes)

    // Filter users based on active tab
    const getFilteredUsers = () => {
        switch (activeTab) {
            case 'followers': return followers;
            case 'following': return following;
            case 'mutual': return mutualFollowers;
            default: return [];
        }
    };

    const filteredUsers = getFilteredUsers();

    const handleChatClick = (userId) => {
        navigate(`/chat/${userId}`);
    };

    const handleProfileClick = (userId) => {
        navigate(`/profile/${userId}`);
    };

    const isMutualFollow = (user) => {
        // Simple check based on processed flags
        return user.isFollowingMe && user.isFollowedByMe;
    };

    return (
        <div className="page-container" style={{ paddingBottom: '100px', minHeight: '100vh' }}>
            {/* Header */}
            <header className="app-header">
                <button className="back-btn" onClick={() => navigate('/profile')} style={{ color: 'var(--text-primary)' }}>
                    <FaArrowRight style={i18n.language === 'ar' ? {} : { transform: 'rotate(180deg)' }} />
                </button>
                <h3 style={{ fontSize: '1.1rem', fontWeight: '800' }}>
                    {t('followers') || 'Network'}
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
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            transition: 'all 0.3s'
                        }}
                    >
                        <FaHeart className={activeTab === 'mutual' ? 'beat-icon' : ''} />
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
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            transition: 'all 0.3s'
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
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            transition: 'all 0.3s'
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
                    <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
                        <div className="loading-spinner" style={{ margin: '0 auto 1rem' }} />
                        <p style={{ fontSize: '0.9rem', fontWeight: '600' }}>{t('loading')}</p>
                    </div>
                ) : (
                    /* Users List */
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {filteredUsers.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
                                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>
                                    {activeTab === 'mutual' ? '🤝' : activeTab === 'following' ? '👣' : '👥'}
                                </div>
                                <p style={{ fontSize: '0.9rem', fontWeight: '600' }}>
                                    {t('no_users_in_list') || 'No users in this list'}
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
                                                src={user.avatar || user.photoURL || user.photo_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.id}`}
                                                alt={user.name}
                                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                onError={(e) => { e.target.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.id}`; }}
                                            />
                                        </div>
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
                                                    background: 'rgba(16, 185, 129, 0.1)',
                                                    color: '#10b981',
                                                    padding: '2px 8px',
                                                    borderRadius: '8px',
                                                    fontSize: '0.65rem',
                                                    fontWeight: '800',
                                                }}>
                                                    {t('mutual') || 'Mutual'}
                                                </span>
                                            )}
                                        </div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                                            {user.bio || t('no_bio')}
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
                                                    background: '#10b981', // Green for chat
                                                    color: 'white',
                                                    border: 'none',
                                                    borderRadius: '12px',
                                                    padding: '8px 16px',
                                                    fontSize: '0.85rem',
                                                    fontWeight: '800',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '6px',
                                                    boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
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
                                                    background: 'rgba(139, 92, 246, 0.1)',
                                                    color: 'var(--primary)',
                                                    border: '1px solid var(--primary)',
                                                    borderRadius: '12px',
                                                    padding: '8px 12px',
                                                    fontSize: '0.75rem',
                                                    fontWeight: '800',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '4px'
                                                }}
                                            >
                                                <FaUserPlus /> {t('follow')}
                                            </button>
                                        ) : (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    toggleFollow(user.id);
                                                }}
                                                style={{
                                                    background: 'rgba(139, 92, 246, 0.15)',
                                                    color: 'var(--primary)',
                                                    border: '2px solid var(--primary)',
                                                    borderRadius: '12px',
                                                    padding: '8px 12px',
                                                    fontSize: '0.75rem',
                                                    fontWeight: '900',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '4px',
                                                    transition: 'all 0.2s'
                                                }}
                                            >
                                                <FaUserCheck /> {t('following')}
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
