import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';

import { db } from '../firebase/config';

import { getSafeAvatar, hasRealProfilePhoto } from './avatarUtils';
import { normalizeDiningPersona, normalizeJoinReasons } from '../constants/privateProfileOptions';
import { normalizeLookingFor, getLookingForLabel } from '../constants/personalInviteCategories';
import { resolveSwipeProfilePhotoUrl } from './profileGallery';
import { getPrivateInviteeDisplayName } from './privateInviteAvailability';
import { notifyProfileGreeting } from './notificationHelpers';
import { USER_DIRECTORY_DEFAULT_SWIPE_PHOTO } from './userDirectory';



const DISCOVERY_GREETINGS_COLLECTION = 'discovery_greetings';

/** In-memory cache — avoids duplicate getDoc on every card mount. */
const actionStatusCache = new Map();
/** Deduplicate concurrent status fetches for the same pair. */
const actionStatusInflight = new Map();

export function primeDiscoveryActionStatus(viewerId, targetId, patch) {
    if (!viewerId || !targetId) return;
    const key = `${viewerId}:${targetId}`;
    const prev = actionStatusCache.get(key) || { liked: false, greetedToday: false };
    const next = { ...prev, ...patch, dayKey: patch.dayKey ?? prev.dayKey ?? getUtcDayKey() };
    actionStatusCache.set(key, next);
    if (typeof window !== 'undefined') {
        window.dispatchEvent(
            new CustomEvent('discovery-action-status', {
                detail: { viewerId, targetId, ...next },
            })
        );
    }
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

    const pending = actionStatusInflight.get(key);
    if (pending) return pending;

    const request = (async () => {
        // Person-"like" removed — only the daily-greeting status is read now.
        const greetingSnap = await getDoc(getDiscoveryGreetingRef(targetId, viewerId, dayKey));
        const result = { liked: false, greetedToday: greetingSnap.exists() };
        actionStatusCache.set(key, { ...result, dayKey });
        return result;
    })();

    actionStatusInflight.set(key, request);
    try {
        return await request;
    } finally {
        actionStatusInflight.delete(key);
    }
}






/**

 * Map a directory user row to the discovery card shape.

 * @param {object} user
 * @param {{ lat: number, lng: number } | null} [userLocation]

 */

export function mapDirectoryUserToDiscoveryProfile(user, userLocation = null) {

    if (!user?.id) return null;



    const name = getPrivateInviteeDisplayName(user) || 'User';
    const joinReasons = normalizeJoinReasons(user.joinReasons);
    const lookingFor = normalizeLookingFor(user.lookingFor);
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
        lookingFor,
        interests,
        city: user.city || '',
        country: user.country || '',
        bio: String(user.bio || user.shortBio || '').trim(),
        gender: user.gender || null,
        // TasteScope: title + answers feed the swipe card's title badge and the
        // compatibility ring. Visibility gates whether the title is shown at all.
        tasteTitleId: user.tasteTitleId || user.tasteScope?.titleId || null,
        tasteVisibility: user.tasteVisibility || user.tasteScope?.visibility || 'public',
        tasteAnswers: user.tasteAnswers || user.tasteScope?.answers || null,
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




/**

 * Quick-like from discovery (stored for "Liked You" + notification).

 * Detects mutual matches when the reverse like already exists.

 * @param {string} likerId

 * @param {object} targetUser — directory row (`profile.user`)

 * @param {object} likerProfile — current user's profile

 */

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
    // Profile-photo soft gate (target-side): can't greet a photo-less account.
    if (!hasRealProfilePhoto(targetUser)) return { ok: false, reason: 'target_no_photo' };

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


