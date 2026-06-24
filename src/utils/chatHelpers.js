import { checkIsMutualMatch } from './discoveryProfile';
import { isMutualFollow } from './followHelpers';

/**
 * Whether two standard users may DM each other (mutual follow OR mutual discovery like).
 * Mutual follow is resolved from in-memory following arrays when possible (no network).
 *
 * @param {string} currentUserId
 * @param {string} targetUserId
 * @param {string[]} [currentUserFollowing]
 * @param {string[]} [targetUserFollowing]
 * @returns {Promise<boolean>}
 */
export async function checkCanMessage(
    currentUserId,
    targetUserId,
    currentUserFollowing = [],
    targetUserFollowing = []
) {
    if (!currentUserId || !targetUserId || currentUserId === targetUserId) {
        return false;
    }

    if (isMutualFollow(currentUserFollowing, targetUserFollowing, currentUserId, targetUserId)) {
        return true;
    }

    return checkIsMutualMatch(currentUserId, targetUserId);
}

/**
 * Resolve chat permission for many list rows efficiently:
 * - mutual follows: local only (no Firestore reads)
 * - everyone else: parallel `checkIsMutualMatch` calls only
 *
 * @param {string} currentUserId
 * @param {Array<{ id: string, following?: string[] }>} targets
 * @param {string[]} currentUserFollowing
 * @param {{ followerIdsOfViewer?: string[] }} [options]
 * @returns {Promise<Record<string, boolean>>}
 */
export async function resolveCanMessageMap(
    currentUserId,
    targets,
    currentUserFollowing = [],
    { followerIdsOfViewer = [] } = {}
) {
    if (!currentUserId || !Array.isArray(targets) || targets.length === 0) {
        return {};
    }

    const followerSet = new Set(followerIdsOfViewer.filter(Boolean));
    const map = {};
    const matchQueue = [];

    for (const target of targets) {
        const targetId = target?.id;
        if (!targetId || targetId === currentUserId) continue;

        const targetFollowing = Array.isArray(target.following) ? target.following : [];
        const enrichedFollowing =
            followerSet.has(targetId) && !targetFollowing.includes(currentUserId)
                ? [...targetFollowing, currentUserId]
                : targetFollowing;

        if (isMutualFollow(currentUserFollowing, enrichedFollowing, currentUserId, targetId)) {
            map[targetId] = true;
        } else {
            matchQueue.push(targetId);
        }
    }

    if (matchQueue.length > 0) {
        const results = await Promise.all(
            matchQueue.map(async (targetId) => {
                const matched = await checkIsMutualMatch(currentUserId, targetId);
                return [targetId, matched];
            })
        );
        for (const [targetId, matched] of results) {
            map[targetId] = matched;
        }
    }

    return map;
}
