import { collection, query, where, getDocs, doc, updateDoc, arrayUnion, arrayRemove, increment, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { notifyNewFollower } from './notificationHelpers';

/**
 * Get users who follow a specific user
 */
export const getFollowers = async (userId) => {
    try {
        const usersRef = collection(db, 'users');
        const q = query(
            usersRef,
            where('following', 'array-contains', userId)
        );

        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
    } catch (error) {
        console.error('Error getting followers:', error);
        return [];
    }
};

/**
 * Get users that a specific user follows
 */
export const getFollowing = async (userId, followingIds = []) => {
    try {
        if (!followingIds || followingIds.length === 0) {
            return [];
        }

        // Firestore 'in' query limit is 10
        const chunks = [];
        for (let i = 0; i < followingIds.length; i += 10) {
            chunks.push(followingIds.slice(i, i + 10));
        }

        const allUsers = [];
        for (const chunk of chunks) {
            const usersRef = collection(db, 'users');
            const q = query(
                usersRef,
                where('__name__', 'in', chunk)
            );

            const snapshot = await getDocs(q);
            const users = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            allUsers.push(...users);
        }

        return allUsers;
    } catch (error) {
        console.error('Error getting following:', error);
        return [];
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
                avatar: currentUserDoc.data()?.avatar || null
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
