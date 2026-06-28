import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { isUserOpenToDating } from './openToDating';
import { isFollowing, isMutualFollow } from './followHelpers';
import { getDiscoveryLikeRef } from './discoveryProfile';

/** @typedef {'dating' | 'acquaintance' | 'friendship'} ConnectionKind */
/** @typedef {'dating' | 'acquaintance' | 'friendship'} CelebrationType */

export const CONNECTION_KIND = {
    DATING: 'dating',
    ACQUAINTANCE: 'acquaintance',
    FRIENDSHIP: 'friendship',
};

/** Primary action on a profile card — determined by profile owner only. */
export function profileShowsLikeButton(profile) {
    return isUserOpenToDating(profile);
}

/**
 * Relationship label between two members (for notifications / celebration visuals).
 * @param {object | null | undefined} profileA
 * @param {object | null | undefined} profileB
 * @returns {ConnectionKind}
 */
export function resolveConnectionKind(profileA, profileB) {
    const aOpen = isUserOpenToDating(profileA);
    const bOpen = isUserOpenToDating(profileB);
    if (aOpen && bOpen) return CONNECTION_KIND.DATING;
    if (!aOpen && !bOpen) return CONNECTION_KIND.FRIENDSHIP;
    return CONNECTION_KIND.ACQUAINTANCE;
}

/** @param {ConnectionKind} kind */
export function connectionKindToCelebrationType(kind) {
    if (kind === CONNECTION_KIND.DATING) return 'dating';
    if (kind === CONNECTION_KIND.FRIENDSHIP) return 'friendship';
    return 'acquaintance';
}

/**
 * Whether a completed connection exists (chat allowed) for this pair.
 * @param {ConnectionKind} kind
 */
export function isConnectionCompleteSync(
    kind,
    {
        viewerId,
        targetId,
        viewerFollowing = [],
        targetFollowing = [],
        likedViewerToTarget = false,
        likedTargetToViewer = false,
    }
) {
    if (!viewerId || !targetId || viewerId === targetId) return false;

    const mutualFollow = isMutualFollow(viewerFollowing, targetFollowing, viewerId, targetId);
    const mutualLike = likedViewerToTarget && likedTargetToViewer;
    const viewerFollows = isFollowing(viewerFollowing, targetId);
    const targetFollows = isFollowing(targetFollowing, viewerId);

    if (kind === CONNECTION_KIND.DATING) return mutualLike;
    if (kind === CONNECTION_KIND.FRIENDSHIP) return mutualFollow;

    if (mutualFollow) return true;
    if (viewerFollows && likedTargetToViewer) return true;
    if (targetFollows && likedViewerToTarget) return true;
    return false;
}

export async function fetchLikePair(viewerId, targetId) {
    const [viewerToTargetSnap, targetToViewerSnap] = await Promise.all([
        getDoc(getDiscoveryLikeRef(targetId, viewerId)),
        getDoc(getDiscoveryLikeRef(viewerId, targetId)),
    ]);
    return {
        likedViewerToTarget: viewerToTargetSnap.exists(),
        likedTargetToViewer: targetToViewerSnap.exists(),
    };
}

async function resolveProfileShape(userId, profileHint) {
    if (profileHint && typeof profileHint === 'object') {
        return { id: userId, ...profileHint };
    }
    const snap = await getDoc(doc(db, 'users', userId));
    return snap.exists() ? { id: userId, ...snap.data() } : { id: userId };
}

/**
 * Live connection gate — chat opens when this returns true for all three kinds.
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

    const [viewerShape, targetShape, likes] = await Promise.all([
        resolveProfileShape(viewerId, viewerProfile),
        resolveProfileShape(targetId, targetProfile),
        fetchLikePair(viewerId, targetId),
    ]);

    let tf = targetFollowing;
    if (tf === null) {
        tf = Array.isArray(targetShape.following) ? targetShape.following : [];
    }

    const kind = resolveConnectionKind(viewerShape, targetShape);
    return isConnectionCompleteSync(kind, {
        viewerId,
        targetId,
        viewerFollowing,
        targetFollowing: tf,
        ...likes,
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

    const kind = resolveConnectionKind(viewerProfile, targetUser);
    celebrateMatch({
        type: connectionKindToCelebrationType(kind),
        otherUser: targetUser,
        otherId: targetUser.id,
        otherName: displayName || targetUser.display_name || targetUser.name,
    });
    return true;
}
