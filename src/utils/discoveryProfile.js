import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';

import { db } from '../firebase/config';

import { getSafeAvatar } from './avatarUtils';
import { normalizeDiningPersona, normalizeJoinReasons } from '../constants/privateProfileOptions';
import { resolveSwipeProfilePhotoUrl } from './profileGallery';
import { getPrivateInviteeDisplayName } from './privateInviteAvailability';
import { notifyProfileGreeting, notifyMutualProfileMatch } from './notificationHelpers';
import { USER_DIRECTORY_DEFAULT_SWIPE_PHOTO } from './userDirectory';



const DISCOVERY_LIKES_COLLECTION = 'discovery_likes';
const DISCOVERY_GREETINGS_COLLECTION = 'discovery_greetings';

/** In-memory cache — avoids duplicate getDoc on every card mount. */
const actionStatusCache = new Map();

export function primeDiscoveryActionStatus(viewerId, targetId, patch) {
    if (!viewerId || !targetId) return;
    const key = `${viewerId}:${targetId}`;
    const prev = actionStatusCache.get(key) || { liked: false, greetedToday: false };
    actionStatusCache.set(key, { ...prev, ...patch });
}

function isPermissionDenied(err) {
    return err?.code === 'permission-denied' || err?.code === 'PERMISSION_DENIED';
}

/** Sync read from session cache (no network). */
export function peekDiscoveryActionStatus(viewerId, targetId) {
    if (!viewerId || !targetId) return null;
    const cached = actionStatusCache.get(`${viewerId}:${targetId}`);
    if (!cached || cached.dayKey !== getUtcDayKey()) return null;
    return { liked: cached.liked, greetedToday: cached.greetedToday };
}

/** UTC calendar day `YYYY-MM-DD` for daily greeting caps. */
export function getUtcDayKey(date = new Date()) {
    return date.toISOString().slice(0, 10);
}

/** Doc id: `{targetUserId}_{senderId}_{dayKey}` — one wave per sender→target per UTC day. */
export function getDiscoveryGreetingDocId(targetUserId, senderId, dayKey = getUtcDayKey()) {
    return `${targetUserId}_${senderId}_${dayKey}`;
}

export function getDiscoveryGreetingRef(targetUserId, senderId, dayKey = getUtcDayKey()) {
    return doc(
        db,
        DISCOVERY_GREETINGS_COLLECTION,
        getDiscoveryGreetingDocId(targetUserId, senderId, dayKey)
    );
}

/**
 * Whether the viewer already liked or greeted this member today.
 * @param {string} viewerId
 * @param {string} targetId
 */
export async function getDiscoveryActionStatus(viewerId, targetId) {
    if (!viewerId || !targetId || viewerId === targetId) {
        return { liked: false, greetedToday: false };
    }

    const key = `${viewerId}:${targetId}`;
    const dayKey = getUtcDayKey();
    const cached = actionStatusCache.get(key);
    if (cached && cached.dayKey === dayKey) {
        return { liked: cached.liked, greetedToday: cached.greetedToday };
    }

    const [likeSnap, greetingSnap] = await Promise.all([
        getDoc(getDiscoveryLikeRef(targetId, viewerId)),
        getDoc(getDiscoveryGreetingRef(targetId, viewerId, dayKey)),
    ]);

    const result = {
        liked: likeSnap.exists(),
        greetedToday: greetingSnap.exists(),
    };
    actionStatusCache.set(key, { ...result, dayKey });
    return result;
}



/** Doc id: `{targetUserId}_{likerId}` — target is liked BY liker. */

export function getDiscoveryLikeDocId(targetUserId, likerId) {

    return `${targetUserId}_${likerId}`;

}



export function getDiscoveryLikeRef(targetUserId, likerId) {

    return doc(db, DISCOVERY_LIKES_COLLECTION, getDiscoveryLikeDocId(targetUserId, likerId));

}



/**

 * Map a directory user row to the discovery card shape.

 * @param {object} user

 */

export function mapDirectoryUserToDiscoveryProfile(user) {

    if (!user?.id) return null;



    const name = getPrivateInviteeDisplayName(user) || 'User';
    const joinReasons = normalizeJoinReasons(user.joinReasons);
    const personaTags = normalizeDiningPersona(user.diningPersona);
    const interestTags = Array.isArray(user.interests)
        ? user.interests.map((tag) => String(tag || '').trim()).filter(Boolean).slice(0, 4)
        : [];
    const interests = personaTags.length ? personaTags.slice(0, 4) : interestTags;

    const profilePhoto =
        user.swipePhotoUrl ||
        resolveSwipeProfilePhotoUrl(user) ||
        getSafeAvatar(user) ||
        USER_DIRECTORY_DEFAULT_SWIPE_PHOTO;

    return {
        id: user.id,
        user,
        name,
        ageCategory: user.ageRange || user.ageCategory || (user.age ? String(user.age) : ''),
        profilePhoto,
        joinReasons,
        interests,
        city: user.city || '',
        country: user.country || '',
    };

}



function buildLikerPayload(likerId, likerProfile) {

    return {

        id: likerId,

        name:

            getPrivateInviteeDisplayName(likerProfile) ||

            likerProfile?.display_name ||

            likerProfile?.displayName ||

            'Someone',

        avatar: getSafeAvatar(likerProfile),

    };

}



/**

 * Returns true when both users have liked each other (mutual match recorded).

 * @param {string} userId1

 * @param {string} userId2

 */

export async function checkIsMutualMatch(userId1, userId2) {

    if (!userId1 || !userId2 || userId1 === userId2) return false;



    const [like1to2Snap, like2to1Snap] = await Promise.all([

        getDoc(getDiscoveryLikeRef(userId2, userId1)),

        getDoc(getDiscoveryLikeRef(userId1, userId2)),

    ]);



    if (!like1to2Snap.exists() || !like2to1Snap.exists()) return false;



    return like1to2Snap.data()?.mutual === true && like2to1Snap.data()?.mutual === true;

}



/**

 * Quick-like from discovery (stored for "Liked You" + notification).

 * Detects mutual matches when the reverse like already exists.

 * @param {string} likerId

 * @param {object} targetUser — directory row (`profile.user`)

 * @param {object} likerProfile — current user's profile

 */

export async function likeDiscoveryProfile(likerId, targetUser, likerProfile) {
    const targetId = targetUser?.id;
    if (!likerId || !targetId || likerId === targetId) {
        throw new Error('discovery_like_invalid');
    }

    const likeRef = getDiscoveryLikeRef(targetId, likerId);
    const reverseLikeRef = getDiscoveryLikeRef(likerId, targetId);
    const likerPayload = buildLikerPayload(likerId, likerProfile);

    const reverseSnap = await getDoc(reverseLikeRef);
    const isMatch = reverseSnap.exists();

    try {
        await setDoc(likeRef, {
            targetUserId: targetId,
            likerId,
            createdAt: serverTimestamp(),
            source: 'discovery_feed',
            mutual: isMatch,
        });
    } catch (err) {
        if (isPermissionDenied(err)) {
            primeDiscoveryActionStatus(likerId, targetId, { liked: true });
            return {
                ok: false,
                reason: 'already_liked',
                already: true,
                mutual: isMatch && reverseSnap.data()?.mutual === true,
            };
        }
        console.error('[discoveryProfile] like write failed', err?.code, err?.message);
        throw err;
    }

    primeDiscoveryActionStatus(likerId, targetId, { liked: true });

    if (isMatch) {
        if (reverseSnap.data()?.mutual !== true) {
            void updateDoc(reverseLikeRef, { mutual: true }).catch((e) => {
                console.warn('[discoveryProfile] reverse mutual update', e?.message || e);
            });
        }
        notifyMutualProfileMatch(targetId, likerPayload);
        return { ok: true, already: false, mutual: true, match: true };
    }

    return { ok: true, already: false, mutual: false };
}

/**
 * Send a wave greeting (👋) — once per sender→target per UTC day.
 * @param {string} senderId
 * @param {object} targetUser
 * @param {object} senderProfile
 */
export async function sendDiscoveryGreeting(senderId, targetUser, senderProfile) {
    const targetId = targetUser?.id;
    if (!senderId || !targetId || senderId === targetId) {
        return { ok: false, reason: 'invalid' };
    }

    const dayKey = getUtcDayKey();
    const greetingRef = getDiscoveryGreetingRef(targetId, senderId, dayKey);

    try {
        await setDoc(greetingRef, {
            targetUserId: targetId,
            senderId,
            dayKey,
            createdAt: serverTimestamp(),
            source: 'discovery_feed',
        });
    } catch (err) {
        if (isPermissionDenied(err)) {
            primeDiscoveryActionStatus(senderId, targetId, { greetedToday: true, dayKey });
            return { ok: false, reason: 'daily_limit', already: true };
        }
        console.error('[discoveryProfile] greeting write failed', err?.code, err?.message);
        throw err;
    }

    primeDiscoveryActionStatus(senderId, targetId, { greetedToday: true, dayKey });
    const senderPayload = buildLikerPayload(senderId, senderProfile);
    notifyProfileGreeting(targetId, senderPayload);
    return { ok: true };
}


