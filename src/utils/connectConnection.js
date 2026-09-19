import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { isMutualFollow } from './followHelpers';
import { sameAgeClass } from './minorSafety';

/** @typedef {'friendship'} ConnectionKind */
/** @typedef {'friendship'} CelebrationType */

/** There is exactly one way to connect: a mutual Follow makes two members friends. */
export const CONNECTION_KIND = {
    FRIENDSHIP: 'friendship',
};

/** @returns {ConnectionKind} */
export function resolveConnectionKind() {
    return CONNECTION_KIND.FRIENDSHIP;
}

/** @param {ConnectionKind} _kind */
export function connectionKindToCelebrationType() {
    return 'friendship';
}

/**
 * Whether a completed connection exists (chat allowed) for this pair:
 * a mutual Follow.
 */
export function isConnectionCompleteSync(
    _kind,
    { viewerId, targetId, viewerFollowing = [], targetFollowing = [] }
) {
    if (!viewerId || !targetId || viewerId === targetId) return false;
    return isMutualFollow(viewerFollowing, targetFollowing, viewerId, targetId);
}

async function resolveProfileShape(userId, profileHint) {
    if (profileHint && typeof profileHint === 'object') {
        return { id: userId, ...profileHint };
    }
    // Public projection only (legacy path; the reverse-index path never calls this).
    const snap = await getDoc(doc(db, 'public_profiles', userId));
    return snap.exists() ? { id: userId, ...snap.data() } : { id: userId };
}

/**
 * Live connection gate — chat opens when this returns true (a mutual Follow).
 *
 * Privacy: pass `viewerFollowers` (the viewer's own users/{uid}.followers[] reverse
 * index) and the gate answers "does target follow me?" from the VIEWER's OWN doc —
 * no read of the target's users/{uid} doc. The 16–17↔adult minor-safety gate is
 * enforced authoritatively server-side (createOrGetConversation + firestore.rules
 * `sameAgeClass`); on this path the client applies it only when both profiles are
 * already in hand (no extra read). When `viewerFollowers` is omitted, the legacy
 * path is used (may read the target doc) — kept for callers not yet migrated.
 */
export async function isConnectionComplete(
    viewerId,
    targetId,
    viewerProfile,
    targetProfile,
    viewerFollowing = [],
    targetFollowing = null,
    viewerFollowers = null
) {
    if (!viewerId || !targetId || viewerId === targetId) return false;
    if (!Array.isArray(viewerFollowing) || !viewerFollowing.includes(targetId)) return false;

    // Preferred path: reverse follow index from the viewer's own doc (no target read).
    if (Array.isArray(viewerFollowers)) {
        if (!viewerFollowers.includes(targetId)) return false;
        if (viewerProfile && targetProfile && !sameAgeClass(viewerProfile, targetProfile)) return false;
        return true;
    }

    // Legacy path: resolve shapes (may read the target users doc).
    const [viewerShape, targetShape] = await Promise.all([
        resolveProfileShape(viewerId, viewerProfile),
        resolveProfileShape(targetId, targetProfile),
    ]);
    // 16–17 and adults never chat directly.
    if (!sameAgeClass(viewerShape, targetShape)) return false;

    let tf = targetFollowing;
    if (tf === null) {
        tf = Array.isArray(targetShape.following) ? targetShape.following : [];
    }

    return isConnectionCompleteSync(CONNECTION_KIND.FRIENDSHIP, {
        viewerId,
        targetId,
        viewerFollowing,
        targetFollowing: tf,
    });
}

export async function tryCelebrateConnectionComplete({
    viewerUid,
    targetUser,
    viewerProfile,
    viewerFollowing,
    viewerFollowers = null,
    celebrateMatch,
    displayName,
}) {
    if (!viewerUid || !targetUser?.id || !celebrateMatch) return false;

    const complete = await isConnectionComplete(
        viewerUid,
        targetUser.id,
        viewerProfile,
        targetUser,
        viewerFollowing,
        null,
        viewerFollowers
    );
    if (!complete) return false;

    celebrateMatch({
        type: 'friendship',
        otherUser: targetUser,
        otherId: targetUser.id,
        otherName: displayName || targetUser.display_name || targetUser.name,
    });
    return true;
}
