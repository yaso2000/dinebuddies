/**
 * Post comments use two visual layers only:
 * 1) top-level comment on the post
 * 2) flat replies under that comment (including replies-to-replies)
 */

/**
 * @param {object|null|undefined} comment
 * @param {object[]} allComments
 * @returns {string|null} id of the top-level comment for this thread
 */
export function getCommentThreadRootId(comment, allComments = []) {
    if (!comment?.id) return null;

    const byId = new Map();
    for (const c of allComments) {
        if (c?.id) byId.set(c.id, c);
    }

    let cur = comment;
    for (let depth = 0; depth < 64 && cur?.parentId; depth += 1) {
        const parent = byId.get(cur.parentId);
        if (!parent) {
            // Direct parent is the root (or missing doc — treat parentId as root).
            return cur.parentId;
        }
        cur = parent;
    }

    return cur.id;
}

/**
 * @param {object[]} sortedComments oldest → newest
 */
export function buildPostCommentThreads(sortedComments = []) {
    const byId = new Map();
    for (const c of sortedComments) {
        if (c?.id) byId.set(c.id, c);
    }

    const topLevelComments = [];
    const repliesByParentId = {};

    for (const c of sortedComments) {
        if (!c?.parentId) {
            topLevelComments.push(c);
            continue;
        }

        const rootId = getCommentThreadRootId(c, sortedComments);
        if (!rootId) continue;

        if (!repliesByParentId[rootId]) repliesByParentId[rootId] = [];
        repliesByParentId[rootId].push(c);
    }

    return { topLevelComments, repliesByParentId };
}

/**
 * parentId for a new reply — always the top-level comment in the thread.
 */
export function resolveReplyParentId(replyTarget, allComments = []) {
    if (!replyTarget?.id) return null;
    if (!replyTarget.parentId) return replyTarget.id;
    return getCommentThreadRootId(replyTarget, allComments) || replyTarget.parentId;
}
