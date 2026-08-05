import React from 'react';
import PostCommentRow from './PostCommentRow';
import PostCommentComposer from './PostCommentComposer';

function InlineReplyComposer({ targetId, nested, replyingTo, replyComposerProps }) {
    if (!replyingTo || replyingTo.id !== targetId) return null;

    const { currentUser, userProfile, value, onChange, onSubmit, submitting, placeholder, onCancel } =
        replyComposerProps;

    return (
        <PostCommentComposer
            currentUser={currentUser}
            userProfile={userProfile}
            value={value}
            onChange={onChange}
            onSubmit={onSubmit}
            submitting={submitting}
            placeholder={placeholder}
            variant="inline-reply"
            onCancel={onCancel}
            autoFocus
            nested={nested}
        />
    );
}

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
    replyingTo,
    replyComposerProps,
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
                            replyCount={replies.length}
                            t={t}
                        />
                        <InlineReplyComposer
                            targetId={cid}
                            nested={false}
                            replyingTo={replyingTo}
                            replyComposerProps={replyComposerProps}
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
                            ? replies.map((reply) => {
                                  const rid = reply.id || `${reply.userId}-${reply.createdAt}`;
                                  return (
                                      <React.Fragment key={rid}>
                                          <PostCommentRow
                                              comment={reply}
                                              postAuthorId={postAuthorId}
                                              currentUserId={currentUserId}
                                              onLike={onLike}
                                              onReply={onReply}
                                              onAuthorClick={onAuthorClick}
                                              nested
                                              t={t}
                                          />
                                          <InlineReplyComposer
                                              targetId={rid}
                                              nested
                                              replyingTo={replyingTo}
                                              replyComposerProps={replyComposerProps}
                                          />
                                      </React.Fragment>
                                  );
                              })
                            : null}
                    </React.Fragment>
                );
            })}
        </>
    );
}
