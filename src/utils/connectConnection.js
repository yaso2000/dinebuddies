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

/**
 * Primary action on a profile card, anywhere it appears — swipe deck, list card
 * or profile page. There is no heart/like action: every card shows Follow.
 */
export function profileShowsLikeButton() {
    return false;
}

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
    const snap = await getDoc(doc(db, 'users', userId));
    return snap.exists() ? { id: userId, ...snap.data() } : { id: userId };
}

/**
 * Live connection gate — chat opens when this returns true.
 */
export async function isConnectionComplete(
    viewerId,
    targetId,
    viewerProfile,
    targetProfile,
    viewerFollowing = [],
    targetFollowing = null
) {
    if (!viewerId || !targetId || viewerId === targetId) return false;

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
    celebrateMatch,
    displayName,
}) {
    if (!viewerUid || !targetUser?.id || !celebrateMatch) return false;

    const complete = await isConnectionComplete(
        viewerUid,
        targetUser.id,
        viewerProfile,
        targetUser,
        viewerFollowing
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
