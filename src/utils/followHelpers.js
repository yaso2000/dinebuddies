import { doc, updateDoc, arrayUnion, arrayRemove, increment, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { notifyNewFollower } from './notificationHelpers';
import { getSafeAvatar } from './avatarUtils';
import { isHiddenFromConsumerApp } from './consumerSearchExclusions';

const functions = getFunctions();
const listUserNetworkCallable = httpsCallable(functions, 'listUserNetwork');
const getFollowerCountCallable = httpsCallable(functions, 'getFollowerCount');

/** Per-user cache + in-flight dedup — Profile re-renders must not spam getFollowerCount (429). */
const followerCountCache = new Map();
const followerCountInflight = new Map();
const FOLLOWER_COUNT_TTL_MS = 60_000;

/** Coalesce identical in-flight listUserNetwork calls (Firestore/auth can fan out many at once). */
const listUserNetworkInflight = new Map();
function callListUserNetwork(payload) {
    const key = JSON.stringify(payload);
    if (listUserNetworkInflight.has(key)) {
        return listUserNetworkInflight.get(key);
    }
    const promise = listUserNetworkCallable(payload).finally(() => {
        listUserNetworkInflight.delete(key);
    });
    listUserNetworkInflight.set(key, promise);
    return promise;
}

const mapNetworkUser = (user) => ({
    id: user?.id || user?.uid || '',
    uid: user?.uid || user?.id || '',
    name: user?.displayName || user?.display_name || 'User',
    display_name: user?.displayName || user?.display_name || 'User',
    avatar_url: user?.avatarUrl || user?.avatar_url || '',
    photo_url: user?.avatarUrl || user?.avatar_url || '',
    profileType: user?.profileType || 'user',
    bio: '',
    city: user?.city || '',
    country: user?.country || '',
    following: []
});

const filterVisibleNetworkUsers = (users) =>
    (users || []).filter((user) => !isHiddenFromConsumerApp({ id: user?.id || user?.uid, role: user?.role, accountRole: user?.accountRole }));

/**
 * Get users who follow a specific user
 */
export const getFollowers = async (userId) => {
    try {
        const result = await callListUserNetwork({
            userId,
            includeFollowers: true,
            includeFollowing: false,
            limit: 200
        });
        const followers = Array.isArray(result?.data?.followers) ? result.data.followers : [];
        return filterVisibleNetworkUsers(followers).map(mapNetworkUser);
    } catch (error) {
        console.error('Error getting followers for user:', userId, error);
        return [];
    }
};

/**
 * Get users that a specific user follows
 */
export const getFollowing = async (userId, followingIds = []) => {
    try {
        if (!followingIds || followingIds.length === 0) {
            console.log('User is not following anyone (list is empty)');
            return [];
        }

        const result = await callListUserNetwork({
            userId,
            includeFollowers: false,
            includeFollowing: true,
            limit: Math.min(200, followingIds.length)
        });
        const following = Array.isArray(result?.data?.following) ? result.data.following : [];
        return filterVisibleNetworkUsers(following).map(mapNetworkUser);
    } catch (error) {
        console.error('Error getting following:', error);
        return [];
    }
};

export const getFollowersCount = async (userId, { force = false } = {}) => {
    if (!userId) return 0;

    const cached = followerCountCache.get(userId);
    if (!force && cached && Date.now() - cached.at < FOLLOWER_COUNT_TTL_MS) {
        return cached.count;
    }

    if (followerCountInflight.has(userId)) {
        return followerCountInflight.get(userId);
    }

    const promise = getFollowerCountCallable({ userId })
        .then((result) => {
            const count = Number(result?.data?.followersCount || 0);
            followerCountCache.set(userId, { count, at: Date.now() });
            return count;
        })
        .catch((error) => {
            if (cached) return cached.count;
            console.error('Error getting followers count:', error);
            return 0;
        })
        .finally(() => {
            followerCountInflight.delete(userId);
        });

    followerCountInflight.set(userId, promise);
    return promise;
};

/**
 * Get mutual followers (users who follow each other)
 */
export const getMutualFollowers = async (userId, followingIds = []) => {
    try {
        const followers = await getFollowers(userId);

        // Filter followers who are also in the following list
        return followers.filter(follower =>
            followingIds.includes(follower.id)
        );
    } catch (error) {
        console.error('Error getting mutual followers:', error);
        return [];
    }
};

/**
 * Get count of mutual followers between two users
 */
export const getMutualFollowersCount = (user1Following = [], user2Following = []) => {
    return user1Following.filter(id => user2Following.includes(id)).length;
};

/**
 * Follow a user
 * @param {{ skipAlreadyCheck?: boolean }} [options] — skip getDoc when caller already verified state
 */
export const followUser = async (currentUserId, targetUserId, currentUserData = null, options = {}) => {
    const { skipAlreadyCheck = false } = options;
    try {
        const currentUserRef = doc(db, 'users', currentUserId);
        const targetUserRef = doc(db, 'users', targetUserId);

        let followerData = currentUserData;
        if (!skipAlreadyCheck) {
            const currentUserDoc = await getDoc(currentUserRef);
            const currentUserFollowing = currentUserDoc.data()?.following || [];
            if (currentUserFollowing.includes(targetUserId)) {
                return { success: false, message: 'Already following' };
            }
            if (!followerData) {
                followerData = {
                    id: currentUserId,
                    name: currentUserDoc.data()?.name || 'Someone',
                    avatar: getSafeAvatar(currentUserDoc.data())
                };
            }
        } else if (!followerData) {
            followerData = {
                id: currentUserId,
                name: 'Someone',
                avatar: getSafeAvatar(null)
            };
        }

        await Promise.all([
            updateDoc(currentUserRef, { following: arrayUnion(targetUserId) }),
            updateDoc(targetUserRef, { followersCount: increment(1) })
        ]);

        notifyNewFollower(targetUserId, followerData);

        return { success: true, message: 'Followed successfully' };
    } catch (error) {
        console.error('Error following user:', error);
        return { success: false, message: error.message };
    }
};

/**
 * Unfollow a user
 */
export const unfollowUser = async (currentUserId, targetUserId) => {
    try {
        const currentUserRef = doc(db, 'users', currentUserId);
        const targetUserRef = doc(db, 'users', targetUserId);

        await Promise.all([
            updateDoc(currentUserRef, { following: arrayRemove(targetUserId) }),
            updateDoc(targetUserRef, { followersCount: increment(-1) })
        ]);

        return true;
    } catch (error) {
        console.error('Error unfollowing user:', error);
        return false;
    }
};

/**
 * Check if user A follows user B
 */
export const isFollowing = (userAFollowing = [], userBId) => {
    return userAFollowing.includes(userBId);
};

/**
 * Check if two users follow each other (mutual)
 */
export const isMutualFollow = (user1Following = [], user2Following = [], user1Id, user2Id) => {
    return user1Following.includes(user2Id) && user2Following.includes(user1Id);
};
