import React from 'react';
import { AiFillHeart, AiOutlineHeart } from 'react-icons/ai';
import { FaReply } from 'react-icons/fa';
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
    replyCount = 0,
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
        gender: comment.userGender ?? comment.gender,
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
                        className={`fb-comment-actions__btn fb-comment-actions__btn--icon fb-comment-actions__btn--like${hasLiked ? ' fb-comment-actions__btn--liked' : ''}`}
                        aria-label={t('like', 'Like')}
                        title={t('like', 'Like')}
                        onClick={(e) => {
                            e.stopPropagation();
                            onLike?.(comment);
                        }}
                    >
                        {hasLiked ? <AiFillHeart size={16} aria-hidden /> : <AiOutlineHeart size={16} aria-hidden />}
                        {likeCount > 0 ? (
                            <span className="fb-comment-actions__count">{likeCount}</span>
                        ) : null}
                    </button>
                    <button
                        type="button"
                        className="fb-comment-actions__btn fb-comment-actions__btn--icon fb-comment-actions__btn--reply"
                        aria-label={
                            replyCount > 0
                                ? t('comment_view_replies', 'View {{count}} replies', { count: replyCount })
                                : t('reply', 'Reply')
                        }
                        title={t('reply', 'Reply')}
                        onClick={(e) => {
                            e.stopPropagation();
                            onReply?.(comment);
                        }}
                    >
                        <FaReply size={14} aria-hidden />
                        {!nested && replyCount > 0 ? (
                            <span className="fb-comment-actions__count">{replyCount}</span>
                        ) : null}
                    </button>
                    <span className="fb-comment-actions__time">{formatCommentTime(comment.createdAt, t)}</span>
                </div>
            </div>
        </div>
    );
}
