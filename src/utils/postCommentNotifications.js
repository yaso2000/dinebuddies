import { createNotification } from './notificationHelpers';

export function postCommentActionUrl(post) {
    if (!post?.id) return '/posts-feed';
    const docId = post.featuredPostId || post.id;
    return post._isFeatured ? `/post/featured/${docId}` : `/post/${post.id}`;
}

/**
 * Notify post author and/or parent comment author after a new comment or reply.
 */
export async function notifyPostCommentActivity({
    post,
    comment,
    replyTarget,
    postAuthorId,
    commenterUid,
    commenterName,
}) {
    if (!commenterUid || !comment?.id) return;

    const actionUrl = postCommentActionUrl(post);
    const preview = String(comment.text || '').slice(0, 80);
    const metadata = {
        postId: post?.id || null,
        commentId: comment.id,
        parentId: replyTarget?.id || null,
    };

    const targets = new Set();

    if (replyTarget?.userId && replyTarget.userId !== commenterUid) {
        targets.add(replyTarget.userId);
    }

    if (replyTarget?.id && postAuthorId && postAuthorId !== commenterUid && postAuthorId !== replyTarget.userId) {
        targets.add(postAuthorId);
    }

    if (!replyTarget?.id && postAuthorId && postAuthorId !== commenterUid) {
        targets.add(postAuthorId);
    }

    const tasks = [...targets].map((userId) => {
        const isDirectReply = replyTarget?.id && replyTarget.userId === userId;
        return createNotification({
            userId,
            type: isDirectReply ? 'comment_reply' : 'comment',
            title: isDirectReply
                ? `${commenterName} replied to your comment`
                : `${commenterName} commented on your post`,
            message: preview || (isDirectReply ? 'New reply' : 'New comment'),
            actionUrl,
            metadata,
        });
    });

    const results = await Promise.allSettled(tasks);
    results.forEach((r) => {
        if (r.status === 'rejected') {
            console.error('[notifyPostCommentActivity]', r.reason);
        }
    });
}

/**
 * Notify comment author when someone likes their comment (not on unlike).
 */
export async function notifyCommentLikeActivity({
    post,
    comment,
    commenterUid,
    commenterName,
}) {
    const authorId = comment?.userId;
    if (!authorId || authorId === commenterUid || !comment?.id) return;

    try {
        await createNotification({
            userId: authorId,
            type: 'comment_like',
            title: `${commenterName} liked your comment`,
            message: String(comment.text || '').slice(0, 80) || 'Liked your comment',
            actionUrl: postCommentActionUrl(post),
            metadata: {
                postId: post?.id || null,
                commentId: comment.id,
            },
        });
    } catch (err) {
        console.error('[notifyCommentLikeActivity]', err);
    }
}
