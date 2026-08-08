import { isConnectionComplete } from './connectConnection';

/** Deterministic 1:1 conversation document id (matches Cloud Function). */
export function getDirectConversationId(uidA, uidB) {
    if (!uidA || !uidB || uidA === uidB) return null;
    return [uidA, uidB].sort().join('_');
}

/**
 * Whether two members may DM — unified gate for dating, acquaintance, and friendship. *
 * @param {string} currentUserId
 * @param {string} targetUserId
 * @param {string[]} [currentUserFollowing]
 * @param {string[]} [targetUserFollowing]
 * @param {{ currentUserProfile?: object, targetUserProfile?: object }} [options]
 * @returns {Promise<boolean>}
 */
export async function checkCanMessage(
    currentUserId,
    targetUserId,
    currentUserFollowing = [],
    targetUserFollowing = [],
    { currentUserProfile = null, targetUserProfile = null } = {}
) {
    return isConnectionComplete(
        currentUserId,
        targetUserId,
        currentUserProfile,
        targetUserProfile,
        currentUserFollowing,
        targetUserFollowing
    );
}

/**
 * Resolve chat permission for conversation list rows.
 *
 * @param {string} currentUserId
 * @param {Array<{ id: string, following?: string[], openToDating?: boolean, lookingFor?: string[] }>} targets
 * @param {string[]} currentUserFollowing
 * @param {{ followerIdsOfViewer?: string[], currentUserProfile?: object }} [options]
 * @returns {Promise<Record<string, boolean>>}
 */
export async function resolveCanMessageMap(
    currentUserId,
    targets,
    currentUserFollowing = [],
    { followerIdsOfViewer = [], currentUserProfile = null } = {}
) {
    if (!currentUserId || !Array.isArray(targets) || targets.length === 0) {
        return {};
    }

    const followerSet = new Set(followerIdsOfViewer.filter(Boolean));
    const map = {};

    await Promise.all(
        targets.map(async (target) => {
            const targetId = target?.id;
            if (!targetId || targetId === currentUserId) return;

            const targetFollowing = Array.isArray(target.following) ? target.following : [];
            const enrichedFollowing =
                followerSet.has(targetId) && !targetFollowing.includes(currentUserId)
                    ? [...targetFollowing, currentUserId]
                    : targetFollowing;

            map[targetId] = await checkCanMessage(
                currentUserId,
                targetId,
                currentUserFollowing,
                enrichedFollowing,
                { currentUserProfile, targetUserProfile: target }
            );
        })
    );

    return map;
}
