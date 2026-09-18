import { isConnectionComplete } from './connectConnection';

/** Deterministic 1:1 conversation document id (matches Cloud Function). */
export function getDirectConversationId(uidA, uidB) {
    if (!uidA || !uidB || uidA === uidB) return null;
    return [uidA, uidB].sort().join('_');
}

/**
 * Whether two members may DM — a mutual Follow (friends) is the only gate. *
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
    { currentUserProfile = null, targetUserProfile = null, viewerFollowers = null } = {}
) {
    // When viewerFollowers (the viewer's own reverse follow index) is provided,
    // isConnectionComplete answers "does target follow me?" from it and never reads
    // the target's users doc; targetUserFollowing is then ignored.
    return isConnectionComplete(
        currentUserId,
        targetUserId,
        currentUserProfile,
        targetUserProfile,
        currentUserFollowing,
        targetUserFollowing,
        viewerFollowers
    );
}

/**
 * Resolve chat permission for conversation list rows.
 *
 * @param {string} currentUserId
 * @param {Array<{ id: string, following?: string[], lookingFor?: string[] }>} targets
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

    // Reverse follow index: "does target follow me?" is answered from the viewer's
    // own followers[] (followerIdsOfViewer) — never a read of the target's users doc.
    // Callers MUST pass followerIdsOfViewer (the viewer's users/{uid}.followers[]).
    const viewerFollowers = Array.isArray(followerIdsOfViewer) ? followerIdsOfViewer : [];
    const map = {};

    await Promise.all(
        targets.map(async (target) => {
            const targetId = target?.id;
            if (!targetId || targetId === currentUserId) return;

            map[targetId] = await checkCanMessage(
                currentUserId,
                targetId,
                currentUserFollowing,
                [],
                { currentUserProfile, targetUserProfile: target, viewerFollowers }
            );
        })
    );

    return map;
}
