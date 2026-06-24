import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useInvitations } from '../context/InvitationContext';
import { useAuth } from '../context/AuthContext';
import { FaArrowRight, FaComments, FaUserPlus, FaUserCheck, FaUsers, FaHeart } from 'react-icons/fa';
import { getFollowers, getFollowing, getMutualFollowersCount } from '../utils/followHelpers';
import { canViewerSeeProfileFriends } from '../utils/profileSectionVisibility';
import { resolveCanMessageMap } from '../utils/chatHelpers';
import { getSafeAvatar } from '../utils/avatarUtils';
import UserAvatar from '../components/UserAvatar';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { AppText } from "../components/base";

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
  const [myFollowerIds, setMyFollowerIds] = useState([]);
  const [chatAllowedMap, setChatAllowedMap] = useState({});
  const [friendsListPrivate, setFriendsListPrivate] = useState(false);

  // Whose network are we viewing?
  const viewedUserId = paramUserId || currentUser?.id || currentUser?.uid;
  const isOwnProfile = !paramUserId || paramUserId === (currentUser?.id || currentUser?.uid);

  // Default to friends when viewing someone else, keep context when viewing own
  const [activeTab, setActiveTab] = useState(!isOwnProfile ? 'mutual' : location.state?.activeTab || 'mutual');


  useEffect(() => {
    if (!viewedUserId) return;

    const fetchFollowData = async () => {
      setLoading(true);
      try {
        // If viewing another user, get their following list from Firestore
        let viewedFollowingIds = [];
        let viewedUserDocData = null;
        if (!isOwnProfile) {
          const userDoc = await getDoc(doc(db, 'users', viewedUserId));
          if (userDoc.exists()) {
            viewedUserDocData = userDoc.data();
            viewedFollowingIds = viewedUserDocData.following || [];
            setProfileName(viewedUserDocData.display_name || viewedUserDocData.name || '');
          }
          const myUid = currentUser?.uid || currentUser?.id;
          const canSeeFriends = canViewerSeeProfileFriends(
            { ...viewedUserDocData, uid: viewedUserId, id: viewedUserId },
            myUid
          );
          setFriendsListPrivate(!canSeeFriends);
          if (!canSeeFriends) {
            setFollowers([]);
            setFollowing([]);
            setMutualFollowers([]);
            setLoading(false);
            return;
          }
        } else {
          viewedFollowingIds = currentUser?.following || [];
          setFriendsListPrivate(false);
        }

        const myFollowingIds = currentUser?.following || [];
        const myUid = currentUser?.uid || currentUser?.id;

        // 1. Fetch Followers
        let followersData = [];
        try {followersData = await getFollowers(viewedUserId);} catch (e) {}

        if (isOwnProfile && myUid) {
          setMyFollowerIds(followersData.map((u) => u.id));
        } else if (myUid) {
          try {
            const myFollowers = await getFollowers(myUid);
            setMyFollowerIds(myFollowers.map((u) => u.id));
          } catch (e) {
            setMyFollowerIds([]);
          }
        } else {
          setMyFollowerIds([]);
        }

        // 2. Fetch Following
        let followingData = [];
        try {
          if (viewedFollowingIds.length > 0) {
            followingData = await getFollowing(viewedUserId, viewedFollowingIds);
          }
        } catch (e) {}

        // 3. Mutuals
        const followersIds = followersData.map((u) => u.id);
        const mutualData = followingData.filter((user) => followersIds.includes(user.id));

        const followersProcessed = followersData.map((user) => ({
          ...user,
          isFollowingMe: true,
          isFollowedByMe: myFollowingIds.includes(user.id),
          mutualFollowersCount: getMutualFollowersCount(myFollowingIds, user.following || [])
        }));

        const followingProcessed = followingData.map((user) => ({
          ...user,
          isFollowingMe: (user.following || []).includes(viewedUserId),
          isFollowedByMe: myFollowingIds.includes(user.id),
          mutualFollowersCount: getMutualFollowersCount(myFollowingIds, user.following || [])
        }));

        const mutualProcessed = mutualData.map((user) => ({
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
  const filteredUsers = useMemo(() => {
    if (!isOwnProfile) return mutualFollowers;

    switch (activeTab) {
      case 'followers':return followers;
      case 'following':return following;
      case 'mutual':return mutualFollowers;
      default:return [];
    }
  }, [isOwnProfile, activeTab, followers, following, mutualFollowers]);

  useEffect(() => {
    const myUid = currentUser?.uid || currentUser?.id;
    if (loading || !myUid || currentUser?.isGuest || filteredUsers.length === 0) {
      setChatAllowedMap({});
      return;
    }

    let cancelled = false;

    (async () => {
      const map = await resolveCanMessageMap(
        myUid,
        filteredUsers,
        currentUser?.following || [],
        { followerIdsOfViewer: myFollowerIds }
      );
      if (!cancelled) setChatAllowedMap(map);
    })();

    return () => {
      cancelled = true;
    };
  }, [loading, filteredUsers, currentUser, myFollowerIds]);

  const handleChatClick = (userId) => {
    navigate(`/chat/${userId}`);
  };

  const handleProfileClick = (userId) => {
    navigate(`/profile/${userId}`);
  };

  const canChatWithUser = (user) => chatAllowedMap[user.id] === true;

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
          }}>
          
                    <FaArrowRight style={i18n.language === 'ar' ? {} : { transform: 'rotate(180deg)' }} />
                </button>
                <AppText as="h2" style={{ fontSize: '1.2rem', fontWeight: '800', margin: 0 }}>
                    {profileName
                      ? `${t('network_of', 'Network of')} ${profileName}`
                      : isOwnProfile
                        ? t('friends', 'Friends')
                        : t('friends', 'Friends')}
                </AppText>
            </div>

            <div style={{ padding: '0 8px' }}>
                {/* Tabs */}
                {/* Unified Dashboard Card */}
                {!loading &&
        <div style={{
          background: 'var(--bg-card)',
          borderRadius: '16px',
          border: '1px solid var(--border-color)',
          marginBottom: '1rem',
          overflow: 'hidden'
        }}>
                        {/* Tabs Section - Only show if it is the user's own profile */}
                        {isOwnProfile &&
          <div style={{
            display: 'flex',
            borderBottom: '1px solid var(--border-color)',
            background: 'rgba(0,0,0,0.1)'
          }}>
                                {['mutual', 'followers', 'following'].map((tab) =>
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
              }}>
              
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>
                                            {tab === 'mutual' && <FaHeart className={activeTab === 'mutual' ? 'beat-icon' : ''} />}
                                            {tab === 'followers' && <FaUsers />}
                                            {tab === 'following' && <FaUserCheck />}
                                        </div>
                                    </button>
            )}
                            </div>
          }

                        {/* Stats Section */}
                        <div style={{
            padding: '12px',
            background: 'linear-gradient(180deg, rgba(139, 92, 246, 0.05) 0%, transparent 100%)'
          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-around', textAlign: 'center' }}>
                                {isOwnProfile ? (
              <>
                                        <div>
                                            <div style={{ fontSize: '1.5rem', fontWeight: '900', color: 'var(--primary)' }}>
                                                {mutualFollowers.length}
                                            </div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '700' }}>
                                                {t('friends', 'Friends')}
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
                                    </>
                                ) : (
                                  <div>
                                    <div style={{ fontSize: '1.5rem', fontWeight: '900', color: 'var(--primary)' }}>
                                      {mutualFollowers.length}
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '700' }}>
                                      {t('friends', 'Friends')}
                                    </div>
                                  </div>
                                )}
                            </div>
                        </div>
                    </div>
        }

                {/* Loading State */}
                {loading ?
        <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
                        <div className="loading-spinner" style={{ margin: '0 auto 1rem' }} />
                        <AppText as="p" style={{ fontSize: '0.9rem', fontWeight: '600' }}>{t('loading')}</AppText>
                    </div> : friendsListPrivate ? (
        <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
                        <AppText as="p" style={{ fontSize: '0.9rem', fontWeight: '600' }}>
                          {t('friends_list_private', 'This member has hidden their friends list.')}
                        </AppText>
                    </div>
        ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {filteredUsers.length === 0 ?
          <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
                                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>
                                    {activeTab === 'mutual' ? '🤝' : activeTab === 'following' ? '👣' : '👥'}
                                </div>
                                <AppText as="p" style={{ fontSize: '0.9rem', fontWeight: '600' }}>
                                    {t('no_users_in_list') || 'No users in this list'}
                                </AppText>
                            </div> :

          filteredUsers.map((user) =>
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
            onClick={() => handleProfileClick(user.id)}>
            
                                    {/* Avatar */}
                                    <div style={{ position: 'relative' }}>
                                        <UserAvatar
                user={user}
                alt={user.name}
                ringColorOverride={
                canChatWithUser(user) && isOwnProfile ? 'var(--primary)' : undefined
                }
                style={{ width: 50, height: 50 }} />
              
                                        {/* Avatar Plus Badge just like in UserProfile */}
                                        {userProfile?.role !== 'business' && !user.isFollowedByMe && user.id !== (currentUser?.id || currentUser?.uid) &&
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  toggleFollow(user.id);

                  // Optimistic update for the badge
                  if (!isOwnProfile) {
                    setFollowers((prev) => prev.map((u) =>
                    u.id === user.id ? { ...u, isFollowedByMe: true } : u
                    ));
                  } else {
                    const updater = (prev) => prev.map((u) =>
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
                }}>
                +</div>
              }
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
                                        {/* Chat — mutual follow OR mutual discovery like */}
                                        {canChatWithUser(user) &&
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
                }}>
                
                                                <FaComments />
                                                {t('chat')}
                                            </button>
              }
                                        {/* We removed the full Follow/Unfollow button and replaced it with Avatar Badge logic */}
                                    </div>
                                </div>
          )
          }
                    </div>)
        }
            </div>
        </div>);

};

export default FollowersList;