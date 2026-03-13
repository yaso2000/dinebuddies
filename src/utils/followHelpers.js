import { doc, updateDoc, arrayUnion, arrayRemove, increment, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { notifyNewFollower } from './notificationHelpers';
import { getSafeAvatar } from './avatarUtils';

const functions = getFunctions();
const listUserNetworkCallable = httpsCallable(functions, 'listUserNetwork');
const getFollowerCountCallable = httpsCallable(functions, 'getFollowerCount');

const mapNetworkUser = (user) => ({
    id: user?.id || user?.uid || '',
    uid: user?.uid || user?.id || '',
    name: user?.displayName || user?.display_name || 'User',
    display_name: user?.displayName || user?.display_name || 'User',
    avatar_url: user?.avatarUrl || user?.avatar_url || '',
    photo_url: user?.avatarUrl || user?.avatar_url || '',
    bio: '',
    city: user?.city || '',
    country: user?.country || '',
    following: []
});

/**
 * Get users who follow a specific user
 */
export const getFollowers = async (userId) => {
    try {
        const result = await listUserNetworkCallable({
            userId,
            includeFollowers: true,
            includeFollowing: false,
            limit: 200
        });
        const followers = Array.isArray(result?.data?.followers) ? result.data.followers : [];
        return followers.map(mapNetworkUser);
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

        const result = await listUserNetworkCallable({
            userId,
            includeFollowers: false,
            includeFollowing: true,
            limit: Math.min(200, followingIds.length)
        });
        const following = Array.isArray(result?.data?.following) ? result.data.following : [];
        return following.map(mapNetworkUser);
    } catch (error) {
        console.error('Error getting following:', error);
        return [];
    }
};

export const getFollowersCount = async (userId) => {
    try {
        const result = await getFollowerCountCallable({ userId });
        return Number(result?.data?.followersCount || 0);
    } catch (error) {
        console.error('Error getting followers count:', error);
        return 0;
    }
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
 */
export const followUser = async (currentUserId, targetUserId, currentUserData = null) => {
    try {
        // 1. Check if already following (protection from duplicate follows)
        const currentUserRef = doc(db, 'users', currentUserId);
        const currentUserDoc = await getDoc(currentUserRef);
        const currentUserFollowing = currentUserDoc.data()?.following || [];

        if (currentUserFollowing.includes(targetUserId)) {
            console.log('Already following this user');
            return { success: false, message: 'Already following' };
        }

        // 2. Get current user data if not provided
        let followerData = currentUserData;
        if (!followerData) {
            followerData = {
                id: currentUserId,
                name: currentUserDoc.data()?.name || 'Someone',
                avatar: getSafeAvatar(currentUserDoc.data())
            };
        }

        // 3. Add to current user's following list
        await updateDoc(currentUserRef, {
            following: arrayUnion(targetUserId)
        });

        // 4. Increment target user's followers count
        const targetUserRef = doc(db, 'users', targetUserId);
        await updateDoc(targetUserRef, {
            followersCount: increment(1)
        });

        // 5. Send notification to target user
        await notifyNewFollower(targetUserId, followerData);

        console.log('✅ Successfully followed user and sent notification');
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

        // Remove from current user's following list
        await updateDoc(currentUserRef, {
            following: arrayRemove(targetUserId)
        });

        // Decrement target user's followers count
        await updateDoc(targetUserRef, {
            followersCount: increment(-1)
        });

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
