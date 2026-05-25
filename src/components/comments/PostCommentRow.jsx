import React from 'react';
import { AiFillLike, AiOutlineLike } from 'react-icons/ai';
import UserAvatar from '../UserAvatar';
import { formatCommentTime } from '../../utils/commentTime';

export default function PostCommentRow({
    comment,
    postAuthorId,
    currentUserId,
    onLike,
    onReply,
    onAuthorClick,
    nested = false,
    t,
}) {
    const likes = Array.isArray(comment.likes) ? comment.likes : [];
    const likeCount = likes.length;
    const hasLiked = currentUserId && likes.includes(currentUserId);
    const isAuthor = comment.userId && postAuthorId && comment.userId === postAuthorId;

    const userShape = {
        displayName: comment.userName,
        photo_url: comment.userPhoto,
        photoURL: comment.userPhoto,
        avatarUrl: comment.userPhoto,
    };

    return (
        <div className={`fb-comment-row${nested ? ' fb-comment-row--nested' : ''}`}>
            <UserAvatar
                user={userShape}
                src={comment.userPhoto || undefined}
                className="fb-comment-row__avatar"
                alt={comment.userName || ''}
                onClick={(e) => {
                    e.stopPropagation();
                    onAuthorClick?.(comment.userId);
                }}
            />
            <div className="fb-comment-row__main">
                <div className="fb-comment-bubble">
                    <span
                        className="fb-comment-bubble__name"
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                            e.stopPropagation();
                            onAuthorClick?.(comment.userId);
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') onAuthorClick?.(comment.userId);
                        }}
                    >
                        {comment.userName}
                    </span>
                    {isAuthor ? (
                        <span className="fb-comment-bubble__badge">
                            {t('comment_by_author', 'Author')}
                        </span>
                    ) : null}
                    <span className="fb-comment-bubble__text">{comment.text}</span>
                </div>
                <div className="fb-comment-actions">
                    <button
                        type="button"
                        className={`fb-comment-actions__btn${hasLiked ? ' fb-comment-actions__btn--liked' : ''}`}
                        onClick={(e) => {
                            e.stopPropagation();
                            onLike?.(comment);
                        }}
                    >
                        {t('like', 'Like')}
                    </button>
                    <button
                        type="button"
                        className="fb-comment-actions__btn"
                        onClick={(e) => {
                            e.stopPropagation();
                            onReply?.(comment);
                        }}
                    >
                        {t('reply', 'Reply')}
                    </button>
                    <span className="fb-comment-actions__time">{formatCommentTime(comment.createdAt, t)}</span>
                </div>
                {likeCount > 0 ? (
                    <div className="fb-comment-reactions">
                        <span className="fb-comment-reactions__icon" aria-hidden>
                            {hasLiked ? <AiFillLike size={14} /> : <AiOutlineLike size={14} />}
                        </span>
                        <span>{likeCount}</span>
                    </div>
                ) : null}
            </div>
        </div>
    );
}
