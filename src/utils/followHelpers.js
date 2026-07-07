import app, { db } from '../firebase/config';
import { doc, updateDoc, arrayUnion, arrayRemove, increment, getDoc } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { notifyNewFollower } from './notificationHelpers';
import { getSafeAvatar } from './avatarUtils';
import { isHiddenFromConsumerApp } from './consumerSearchExclusions';
import { getCallableErrorReason } from './callableErrorDetails';
import {
  checkFollowRefollowAllowed,
  clearFollowCooldown,
  recordFollowCancelled,
} from './connectionActionCooldown';

const FUNCTIONS_REGION = 'us-central1';
const functions = getFunctions(app, FUNCTIONS_REGION);
const setUserFollowCallable = httpsCallable(functions, 'setUserFollow');
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

function isCallableUnavailable(error) {
    const code = error?.code || '';
    return (
        code === 'functions/not-found' ||
        code === 'functions/unavailable' ||
        code === 'functions/deadline-exceeded' ||
        code === 'functions/internal'
    );
}

async function followViaDirectFirestore(currentUserId, targetUserId, currentUserData, { skipAlreadyCheck = false, skipCooldown = false } = {}) {
    if (!skipCooldown) {
        const allowed = await checkFollowRefollowAllowed(currentUserId, targetUserId);
        if (!allowed.ok) {
            return {
                success: false,
                message: allowed.reason === 'cooldown' ? 'cooldown' : 'follow_failed',
                reason: allowed.reason,
                cancelledAtMs: allowed.cancelledAtMs,
                retryAtMs: allowed.retryAtMs,
            };
        }
    }

    const currentUserRef = doc(db, 'users', currentUserId);
    const targetUserRef = doc(db, 'users', targetUserId);

    let followerData = currentUserData;
    if (!skipAlreadyCheck) {
        const currentUserDoc = await getDoc(currentUserRef);
        if (!currentUserDoc.exists()) {
            return { success: false, message: 'viewer_not_found', reason: 'viewer_not_found' };
        }
        const currentUserFollowing = currentUserDoc.data()?.following || [];
        if (currentUserFollowing.includes(targetUserId)) {
            return { success: false, message: 'Already following' };
        }
        if (!followerData) {
            followerData = {
                id: currentUserId,
                name: currentUserDoc.data()?.name || currentUserDoc.data()?.display_name || 'Someone',
                avatar: getSafeAvatar(currentUserDoc.data()),
            };
        }
    } else if (!followerData) {
        followerData = {
            id: currentUserId,
            name: 'Someone',
            avatar: getSafeAvatar(null),
        };
    }

    await updateDoc(currentUserRef, { following: arrayUnion(targetUserId) });
    try {
        await updateDoc(targetUserRef, { followersCount: increment(1) });
    } catch (counterErr) {
        console.warn('[followUser] followersCount increment failed', counterErr?.message || counterErr);
    }

    void clearFollowCooldown(currentUserId, targetUserId).catch(() => {});

    return { success: true, message: 'Followed successfully', followerData };
}

async function unfollowViaDirectFirestore(currentUserId, targetUserId) {
    const currentUserRef = doc(db, 'users', currentUserId);
    const targetUserRef = doc(db, 'users', targetUserId);

    await updateDoc(currentUserRef, { following: arrayRemove(targetUserId) });
    try {
        await updateDoc(targetUserRef, { followersCount: increment(-1) });
    } catch (counterErr) {
        console.warn('[unfollowUser] followersCount decrement failed', counterErr?.message || counterErr);
    }

    void recordFollowCancelled(currentUserId, targetUserId).catch(() => {});

    return { success: true };
}

function getCallableErrorDetails(error) {
    if (!error || typeof error !== 'object') return null;
    const details = error.details;
    return details && typeof details === 'object' ? details : null;
}

function mapFollowCallableError(error) {
    const reason = getCallableErrorReason(error);
    const details = getCallableErrorDetails(error);
    if (reason === 'cooldown' && details) {
        return {
            success: false,
            message: 'cooldown',
            reason: 'cooldown',
            cancelledAtMs: details.cancelledAtMs,
            retryAtMs: details.retryAtMs,
        };
    }
    if (reason === 'privacy' || reason === 'target_business') {
        return { success: false, message: reason, reason };
    }
    if (reason === 'target_not_found') {
        return { success: false, message: 'target_not_found', reason: 'target_not_found' };
    }
    if (reason === 'viewer_not_found') {
        return { success: false, message: 'viewer_not_found', reason: 'viewer_not_found' };
    }
    if (reason === 'viewer_business') {
        return { success: false, message: 'viewer_business', reason: 'viewer_business' };
    }
    return {
        success: false,
        message: error?.message || 'follow_failed',
        reason: reason || 'error',
    };
}

const mapNetworkUser = (user) => {
    const avatar =
        user?.avatarUrl ||
        user?.avatar_url ||
        user?.photo_url ||
        user?.photoURL ||
        user?.avatar ||
        '';
    return {
        id: user?.id || user?.uid || '',
        uid: user?.uid || user?.id || '',
        name: user?.displayName || user?.display_name || 'User',
        display_name: user?.displayName || user?.display_name || 'User',
        avatar_url: avatar,
        photo_url: avatar,
        photoURL: avatar,
        avatar: avatar,
        avatarUrl: avatar,
        profileGallery: user?.profileGallery,
        gender: user?.gender || null,
        profileType: user?.profileType || 'user',
        bio: '',
        city: user?.city || '',
        country: user?.country || '',
        following: [],
    };
};

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
 * Follow a user (server-side callable — reliable writes).
 */
export const followUser = async (currentUserId, targetUserId, currentUserData = null, options = {}) => {
    const { skipAlreadyCheck = false, skipCooldown = false } = options;
    try {
        if (!currentUserId || !targetUserId || currentUserId === targetUserId) {
            return { success: false, message: 'invalid', reason: 'invalid' };
        }

        if (!skipAlreadyCheck) {
            const currentUserDoc = await getDoc(doc(db, 'users', currentUserId));
            const currentUserFollowing = currentUserDoc.data()?.following || [];
            if (currentUserFollowing.includes(targetUserId)) {
                return { success: false, message: 'Already following' };
            }
        }

        try {
            const result = await setUserFollowCallable({ targetUserId, action: 'follow' });
            const data = result?.data || {};
            if (!data.ok) {
                return { success: false, message: data.reason || 'follow_failed', reason: data.reason };
            }

            let followerData = currentUserData;
            if (!followerData) {
                const currentUserDoc = await getDoc(doc(db, 'users', currentUserId));
                followerData = {
                    id: currentUserId,
                    name: currentUserDoc.data()?.name || currentUserDoc.data()?.display_name || 'Someone',
                    avatar: getSafeAvatar(currentUserDoc.data()),
                };
            }

            notifyNewFollower(targetUserId, followerData);

            return {
                success: true,
                message: 'Followed successfully',
                mutualFollow: data.mutualFollow === true,
            };
        } catch (callableErr) {
            if (!isCallableUnavailable(callableErr)) {
                console.error('Error following user (callable):', callableErr);
                return mapFollowCallableError(callableErr);
            }
            console.warn('[followUser] callable unavailable, falling back to Firestore', callableErr?.code);
        }

        const direct = await followViaDirectFirestore(
            currentUserId,
            targetUserId,
            currentUserData,
            { skipAlreadyCheck, skipCooldown }
        );
        if (!direct.success) return direct;

        notifyNewFollower(targetUserId, direct.followerData || currentUserData);
        return { success: true, message: 'Followed successfully' };
    } catch (error) {
        console.error('Error following user:', error);
        if (error?.code === 'permission-denied') {
            return { success: false, message: 'permission-denied', reason: 'permission-denied' };
        }
        return mapFollowCallableError(error);
    }
};

/**
 * Unfollow a user — always allowed; starts 24h refollow cooldown (server-side).
 */
export const unfollowUser = async (currentUserId, targetUserId) => {
    try {
        if (!currentUserId || !targetUserId || currentUserId === targetUserId) {
            return { success: false, reason: 'invalid' };
        }

        try {
            const result = await setUserFollowCallable({ targetUserId, action: 'unfollow' });
            const data = result?.data || {};
            if (!data.ok) {
                return { success: false, reason: data.reason || 'error' };
            }
            return { success: true };
        } catch (callableErr) {
            if (!isCallableUnavailable(callableErr)) {
                console.error('Error unfollowing user (callable):', callableErr);
                return mapFollowCallableError(callableErr);
            }
            console.warn('[unfollowUser] callable unavailable, falling back to Firestore', callableErr?.code);
        }

        return unfollowViaDirectFirestore(currentUserId, targetUserId);
    } catch (error) {
        console.error('Error unfollowing user:', error);
        if (error?.code === 'permission-denied') {
            return { success: false, reason: 'permission-denied' };
        }
        return mapFollowCallableError(error);
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
