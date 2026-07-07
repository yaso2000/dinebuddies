import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useInvitations } from '../context/InvitationContext';
import { useAuth } from '../context/AuthContext';
import { FaArrowRight, FaComments, FaUserCheck, FaUsers, FaUserFriends } from 'react-icons/fa';
import { getFollowers, getFollowing, getMutualFollowersCount } from '../utils/followHelpers';
import { canViewerSeeProfileFriends } from '../utils/profileSectionVisibility';
import { resolveCanMessageMap } from '../utils/chatHelpers';
import UserAvatar from '../components/UserAvatar';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { AppText } from "../components/base";
import './FollowersList.css';

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
    <div className="page-container friends-list-page">
            <div className="friends-list-page__header">
                <button
          type="button"
          className="friends-list-page__back"
          onClick={() => isOwnProfile ? navigate('/profile') : navigate(-1)}>
          
                    <FaArrowRight style={i18n.language === 'ar' ? {} : { transform: 'rotate(180deg)' }} />
                </button>
                <AppText as="h2" className="friends-list-page__title">
                    {profileName
                      ? `${t('network_of', 'Network of')} ${profileName}`
                      : isOwnProfile
                        ? t('friends', 'Friends')
                        : t('friends', 'Friends')}
                </AppText>
            </div>

            <div className="friends-list-shell">
                {loading ? (
        <div className="friends-list-card">
                        <div className="friends-list-card__message">
                        <div className="loading-spinner" style={{ margin: '0 auto 1rem' }} />
                        <AppText as="p" className="friends-list-card__message-text">{t('loading')}</AppText>
                    </div>
                    </div>
        ) : (
        <div className="friends-list-card">
                        {isOwnProfile && (
          <div className="friends-list-tabs">
                                {['mutual', 'followers', 'following'].map((tab) =>
            <button
              key={tab}
              type="button"
              className={`friends-list-tab${activeTab === tab ? ' friends-list-tab--active' : ''}`}
              onClick={() => setActiveTab(tab)}>
              
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>
                                            {tab === 'mutual' && <FaUserFriends aria-hidden />}
                                            {tab === 'followers' && <FaUsers />}
                                            {tab === 'following' && <FaUserCheck />}
                                        </div>
                                    </button>
            )}
                            </div>
          )}

                        <div className="friends-list-stats">
                            <div className="friends-list-stats__grid">
                                {isOwnProfile ? (
              <>
                                        <div className="friends-list-stats__item">
                                            <div className="friends-list-stats__value friends-list-stats__value--accent">
                                                {mutualFollowers.length}
                                            </div>
                                            <div className="friends-list-stats__label">
                                                {t('friends', 'Friends')}
                                            </div>
                                        </div>
                                        <div className="friends-list-stats__divider" aria-hidden />
                                        <div className="friends-list-stats__item">
                                    <div className="friends-list-stats__value">
                                        {followers.length}
                                    </div>
                                    <div className="friends-list-stats__label">
                                        {t('followers')}
                                    </div>
                                </div>
                                        <div className="friends-list-stats__divider" aria-hidden />
                                        <div className="friends-list-stats__item">
                                            <div className="friends-list-stats__value">
                                                {following.length}
                                            </div>
                                            <div className="friends-list-stats__label">
                                                {t('following')}
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                  <div className="friends-list-stats__item">
                                    <div className="friends-list-stats__value friends-list-stats__value--accent">
                                      {mutualFollowers.length}
                                    </div>
                                    <div className="friends-list-stats__label">
                                      {t('friends', 'Friends')}
                                    </div>
                                  </div>
                                )}
                            </div>
                        </div>

                {friendsListPrivate ? (
        <div className="friends-list-card__message">
                        <AppText as="p" className="friends-list-card__message-text">
                          {t('friends_list_private', 'This member has hidden their friends list.')}
                        </AppText>
                    </div>
        ) : filteredUsers.length === 0 ? (
          <div className="friends-list-card__message">
                                <div className="friends-list-card__message-icon">
                                    {activeTab === 'mutual' ? '🤝' : activeTab === 'following' ? '👣' : '👥'}
                                </div>
                                <AppText as="p" className="friends-list-card__message-text">
                                    {t('no_users_in_list') || 'No users in this list'}
                                </AppText>
                            </div>
        ) : (
          <ul className="friends-list-rows">
          {filteredUsers.map((user) =>
          <li
            key={user.id}
            className="friends-list-row"
            onClick={() => handleProfileClick(user.id)}>
            
                                    <div className="friends-list-row__avatar-wrap">
                                        <UserAvatar
                user={user}
                alt={user.name}
                ringColorOverride={
                canChatWithUser(user) && isOwnProfile ? 'var(--primary)' : undefined
                }
                style={{ width: 50, height: 50 }} />
              
                                        {userProfile?.role !== 'business' && !user.isFollowedByMe && user.id !== (currentUser?.id || currentUser?.uid) &&
              <button
                type="button"
                className="friends-list-row__follow-badge"
                aria-label={t('follow', 'Follow')}
                onClick={async (e) => {
                  e.stopPropagation();
                  const result = await toggleFollow(user.id);
                  if (!result?.ok) return;

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
                }}>
                +
              </button>
              }
                                    </div>

                                    <div className="friends-list-row__info">
                                        <div className="friends-list-row__name">
                                            {user.name}
                                        </div>
                                        <div className="friends-list-row__bio">
                                            {user.bio || t('no_bio')}
                                        </div>
                                    </div>

                                    {canChatWithUser(user) && (
              <button
                type="button"
                className="friends-list-row__chat"
                onClick={(e) => {
                  e.stopPropagation();
                  handleChatClick(user.id);
                }}>
                
                                                <FaComments aria-hidden />
                                                {t('chat')}
                                            </button>
              )}
                                </li>
          )}
                    </ul>
        )}
                    </div>
        )}
            </div>
        </div>);

};

export default FollowersList;