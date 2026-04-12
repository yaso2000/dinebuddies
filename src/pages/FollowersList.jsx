import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useInvitations } from '../context/InvitationContext';
import { useAuth } from '../context/AuthContext';
import { FaArrowRight, FaComments, FaUserPlus, FaUserCheck, FaUsers, FaHeart } from 'react-icons/fa';
import { getFollowers, getFollowing, getMutualFollowersCount } from '../utils/followHelpers';
import { getSafeAvatar, getGenderBorderColor } from '../utils/avatarUtils';
import UserAvatar from '../components/UserAvatar';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';

const FollowersList = () => {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const location = useLocation();
    const { userId: paramUserId } = useParams();
    const { currentUser, toggleFollow } = useInvitations();
    const { userProfile } = useAuth();
    const [followers, setFollowers] = useState([]);
    const [following, setFollowing] = useState([]);
    const [mutualFollowers, setMutualFollowers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [profileName, setProfileName] = useState('');

    // Whose network are we viewing?
    const viewedUserId = paramUserId || currentUser?.id || currentUser?.uid;
    const isOwnProfile = !paramUserId || paramUserId === (currentUser?.id || currentUser?.uid);

    // Default to followers when viewing someone else, keep context when viewing own
    const [activeTab, setActiveTab] = useState(!isOwnProfile ? 'followers' : (location.state?.activeTab || 'mutual'));


    useEffect(() => {
        if (!viewedUserId) return;

        const fetchFollowData = async () => {
            setLoading(true);
            try {
                // If viewing another user, get their following list from Firestore
                let viewedFollowingIds = [];
                if (!isOwnProfile) {
                    const userDoc = await getDoc(doc(db, 'users', viewedUserId));
                    if (userDoc.exists()) {
                        viewedFollowingIds = userDoc.data().following || [];
                        setProfileName(userDoc.data().display_name || userDoc.data().name || '');
                    }
                } else {
                    viewedFollowingIds = currentUser?.following || [];
                }

                const myFollowingIds = currentUser?.following || [];

                // 1. Fetch Followers
                let followersData = [];
                try { followersData = await getFollowers(viewedUserId); } catch (e) {}

                // 2. Fetch Following
                let followingData = [];
                try {
                    if (viewedFollowingIds.length > 0) {
                        followingData = await getFollowing(viewedUserId, viewedFollowingIds);
                    }
                } catch (e) {}

                // 3. Mutuals
                const followersIds = followersData.map(u => u.id);
                const mutualData = followingData.filter(user => followersIds.includes(user.id));

                const followersProcessed = followersData.map(user => ({
                    ...user,
                    isFollowingMe: true,
                    isFollowedByMe: myFollowingIds.includes(user.id),
                    mutualFollowersCount: getMutualFollowersCount(myFollowingIds, user.following || [])
                }));

                const followingProcessed = followingData.map(user => ({
                    ...user,
                    isFollowingMe: (user.following || []).includes(viewedUserId),
                    isFollowedByMe: myFollowingIds.includes(user.id),
                    mutualFollowersCount: getMutualFollowersCount(myFollowingIds, user.following || [])
                }));

                const mutualProcessed = mutualData.map(user => ({
                    ...user,
                    isFollowingMe: true,
                    isFollowedByMe: myFollowingIds.includes(user.id),
                    mutualFollowersCount: getMutualFollowersCount(myFollowingIds, user.following || [])
                }));

                setFollowers(followersProcessed);
                setFollowing(followingProcessed);
                setMutualFollowers(mutualProcessed);
            } catch (error) {
                console.error('Error fetching follow data:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchFollowData();
    }, [viewedUserId, currentUser]);

    // Filter users based on active tab
    const getFilteredUsers = () => {
        // If viewing someone else, force showing only followers
        if (!isOwnProfile) return followers;

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
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '8px 8px 2px' }}>
                <button
                    onClick={() => isOwnProfile ? navigate('/profile') : navigate(-1)}
                    style={{
                        background: 'none',
                        border: 'none',
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        fontSize: '1.1rem',
                        cursor: 'pointer',
                        padding: '4px'
                    }}
                >
                    <FaArrowRight style={i18n.language === 'ar' ? {} : { transform: 'rotate(180deg)' }} />
                </button>
                <h2 style={{ fontSize: '1.2rem', fontWeight: '800', margin: 0 }}>
                    {profileName ? `${t('network_of', 'Network of')} ${profileName}` : (t('followers') || 'Network')}
                </h2>
            </div>

            <div style={{ padding: '0 8px' }}>
                {/* Tabs */}
                {/* Unified Dashboard Card */}
                {!loading && (
                    <div style={{
                        background: 'var(--bg-card)',
                        borderRadius: '16px',
                        border: '1px solid var(--border-color)',
                        marginBottom: '1rem',
                        overflow: 'hidden'
                    }}>
                        {/* Tabs Section - Only show if it is the user's own profile */}
                        {isOwnProfile && (
                            <div style={{
                                display: 'flex',
                                borderBottom: '1px solid var(--border-color)',
                                background: 'rgba(0,0,0,0.1)'
                            }}>
                                {['mutual', 'followers', 'following'].map((tab) => (
                                    <button
                                        key={tab}
                                        onClick={() => setActiveTab(tab)}
                                        style={{
                                            flex: 1,
                                            padding: '12px',
                                            border: 'none',
                                            background: activeTab === tab ? 'var(--primary)' : 'transparent',
                                            color: activeTab === tab ? 'white' : 'var(--text-muted)',
                                            fontSize: '0.85rem',
                                            fontWeight: '800',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            gap: '4px',
                                            transition: 'all 0.3s'
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>
                                            {tab === 'mutual' && <FaHeart className={activeTab === 'mutual' ? 'beat-icon' : ''} />}
                                            {tab === 'followers' && <FaUsers />}
                                            {tab === 'following' && <FaUserCheck />}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Stats Section */}
                        <div style={{
                            padding: '12px',
                            background: 'linear-gradient(180deg, rgba(139, 92, 246, 0.05) 0%, transparent 100%)'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-around', textAlign: 'center' }}>
                                {isOwnProfile && (
                                    <>
                                        <div>
                                            <div style={{ fontSize: '1.5rem', fontWeight: '900', color: 'var(--primary)' }}>
                                                {mutualFollowers.length}
                                            </div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '700' }}>
                                                {t('mutual')}
                                            </div>
                                        </div>
                                        <div style={{ borderLeft: '1px solid var(--border-color)' }}></div>
                                    </>
                                )}
                                <div>
                                    <div style={{ fontSize: '1.5rem', fontWeight: '900', color: 'white' }}>
                                        {followers.length}
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '700' }}>
                                        {t('followers')}
                                    </div>
                                </div>
                                {isOwnProfile && (
                                    <>
                                        <div style={{ borderLeft: '1px solid var(--border-color)' }}></div>
                                        <div>
                                            <div style={{ fontSize: '1.5rem', fontWeight: '900', color: 'white' }}>
                                                {following.length}
                                            </div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '700' }}>
                                                {t('following')}
                                            </div>
                                        </div>
                                    </>
                                )}
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
                                        borderRadius: '16px',
                                        padding: '10px',
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
                                            width: '50px',
                                            height: '50px',
                                            borderRadius: '50%',
                                            border: `2px solid ${isMutualFollow(user) && isOwnProfile ? 'var(--primary)' : getGenderBorderColor(user)}`,
                                            overflow: 'hidden'
                                        }}>
                                            <UserAvatar
                                                user={user}
                                                alt={user.name}
                                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                            />
                                        </div>
                                        {/* Avatar Plus Badge just like in UserProfile */}
                                        {userProfile?.role !== 'business' && !user.isFollowedByMe && user.id !== (currentUser?.id || currentUser?.uid) && (
                                            <div
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    toggleFollow(user.id);
                                                    
                                                    // Optimistic update for the badge
                                                    if (!isOwnProfile) {
                                                        setFollowers(prev => prev.map(u => 
                                                            u.id === user.id ? { ...u, isFollowedByMe: true } : u
                                                        ));
                                                    } else {
                                                        const updater = prev => prev.map(u => 
                                                            u.id === user.id ? { ...u, isFollowedByMe: true } : u
                                                        );
                                                        setFollowers(updater);
                                                        setFollowing(updater);
                                                        setMutualFollowers(updater);
                                                    }
                                                }}
                                                style={{
                                                    position: 'absolute', bottom: '-2px', insetInlineEnd: '-2px',
                                                    width: '20px', height: '20px', borderRadius: '50%',
                                                    background: 'var(--primary)', border: '2px solid var(--bg-card)',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    fontSize: '12px', color: 'white', fontWeight: '900', lineHeight: 1, zIndex: 1
                                                }}
                                            >+</div>
                                        )}
                                    </div>

                                    {/* User Info */}
                                    <div style={{ flex: 1 }}>
                                        <div style={{
                                            fontSize: '0.9rem',
                                            fontWeight: '800',
                                            marginBottom: '2px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px'
                                        }}>
                                            {user.name}
                                        </div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                                            {user.bio || t('no_bio')}
                                        </div>
                                    </div>

                                    {/* Action Buttons */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        {/* Chat Button - Only if mutual with ME (current viewer) */}
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
                                        {/* We removed the full Follow/Unfollow button and replaced it with Avatar Badge logic */}
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
