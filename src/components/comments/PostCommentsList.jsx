import React from 'react';
import PostCommentRow from './PostCommentRow';

export default function PostCommentsList({
    topLevelComments,
    repliesByParentId,
    expandedReplyIds,
    onToggleReplies,
    postAuthorId,
    currentUserId,
    onLike,
    onReply,
    onAuthorClick,
    t,
}) {
    return (
        <>
            {topLevelComments.map((comment) => {
                const cid = comment.id || `${comment.userId}-${comment.createdAt}`;
                const replies = repliesByParentId[cid] || [];
                const expanded = expandedReplyIds.has(cid);

                return (
                    <React.Fragment key={cid}>
                        <PostCommentRow
                            comment={comment}
                            postAuthorId={postAuthorId}
                            currentUserId={currentUserId}
                            onLike={onLike}
                            onReply={onReply}
                            onAuthorClick={onAuthorClick}
                            t={t}
                        />
                        {replies.length > 0 && !expanded ? (
                            <button
                                type="button"
                                className="fb-comment-view-replies"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onToggleReplies(cid);
                                }}
                            >
                                {t('comment_view_replies', 'View {{count}} replies', { count: replies.length })}
                            </button>
                        ) : null}
                        {expanded
                            ? replies.map((reply) => (
                                  <PostCommentRow
                                      key={reply.id || `${reply.userId}-${reply.createdAt}`}
                                      comment={reply}
                                      postAuthorId={postAuthorId}
                                      currentUserId={currentUserId}
                                      onLike={onLike}
                                      onReply={onReply}
                                      onAuthorClick={onAuthorClick}
                                      nested
                                      t={t}
                                  />
                              ))
                            : null}
                    </React.Fragment>
                );
            })}
        </>
    );
}
