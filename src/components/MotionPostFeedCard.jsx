import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { FaTrash } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import UserAvatar from './UserAvatar';
import MotionPostBody from './MotionPostBody';
import { getGenderBorderColor } from '../utils/avatarUtils';
import { deleteFeedPostCascade } from '../utils/postDeleteCascade';

const formatFeedTime = (ts) => {
    if (!ts) return '';
    const d = typeof ts.toDate === 'function' ? ts.toDate() : new Date(ts);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

/**
 * Legacy feed card when a motion post is not yet mirrored to communityPosts.
 * Prefer PostCard for synced motion_post items (likes, comments, detail page).
 */
export default function MotionPostFeedCard({ post, communityPostId = null }) {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { currentUser } = useAuth();
    const { showToast } = useToast();

    const motionDocId = post.motionPostId || post.id;
    const ownerId = post.ownerId || post.authorId;
    const canDelete = Boolean(currentUser?.uid && ownerId && currentUser.uid === ownerId);

    const authorName = post._feedAuthorName || t('business', 'Business');
    const authorAvatar = post._feedAuthorAvatar || null;
    const timeSource = post.publishedAt || post.updatedAt;
    const authorObj = {
        displayName: authorName,
        display_name: authorName,
        role: 'business',
        photo_url: authorAvatar,
        photoURL: authorAvatar,
        avatarUrl: authorAvatar,
    };

    const openDetail = () => {
        if (communityPostId) {
            navigate(`/post/${communityPostId}`);
            return;
        }
        const motionId = post.motionPostId || post.id;
        if (motionId) navigate(`/post/${motionId}`);
    };

    const handleDelete = async (e) => {
        e.stopPropagation();
        if (
            !window.confirm(
                t('post_delete_confirm', 'هل أنت متأكد من حذف هذا المنشور؟ لا يمكن التراجع.')
            )
        ) {
            return;
        }
        try {
            await deleteFeedPostCascade({
                id: motionDocId ? `motion_${motionDocId}` : post.id,
                motionPostId: motionDocId,
            });
            showToast(t('post_delete_success', 'تم حذف المنشور.'), 'success');
        } catch (err) {
            console.error('[MotionPostFeedCard] delete', err);
            showToast(t('post_delete_failed', 'تعذّر حذف المنشور.'), 'error');
        }
    };

    return (
        <div
            className="post-card motion-post-feed-card"
            role="article"
            onClick={openDetail}
            style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 0,
                cursor: communityPostId || post.motionPostId || post.id ? 'pointer' : 'default',
            }}
        >
            <div
                className="post-header-row"
                style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8, padding: '16px 16px 4px 16px' }}
            >
                <UserAvatar
                    user={authorObj}
                    src={authorAvatar || undefined}
                    className="post-avatar"
                    alt={authorName}
                    style={{
                        width: 40,
                        height: 40,
                        borderRadius: '50%',
                        objectFit: 'cover',
                        cursor: 'pointer',
                        border: `2px solid ${getGenderBorderColor(authorObj)}`,
                    }}
                    onClick={(e) => {
                        e.stopPropagation();
                        if (post.businessId) navigate(`/business/${post.businessId}`);
                    }}
                />
                <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2, flex: 1, minWidth: 0 }}>
                    <span className="post-user-name" style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '0.85rem' }}>
                        {authorName}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 2 }}>
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.06 }}>
                            {t('motion_post', 'Motion post')}
                        </span>
                        <span style={{ flexShrink: 0 }}>·</span>
                        <span className="post-time" style={{ flexShrink: 0 }}>
                            {formatFeedTime(timeSource)}
                        </span>
                    </div>
                </div>
                {canDelete ? (
                    <button
                        type="button"
                        className="ios-tap-target"
                        onClick={handleDelete}
                        aria-label={t('delete', 'Delete')}
                        style={{
                            border: 'none',
                            background: 'transparent',
                            color: 'var(--text-muted)',
                            padding: 8,
                            cursor: 'pointer',
                        }}
                    >
                        <FaTrash aria-hidden />
                    </button>
                ) : null}
            </div>

            <div
                className="post-content-body motion-post-feed-card__canvas"
                style={{ width: '100%', padding: '0 16px 16px', boxSizing: 'border-box' }}
            >
                <MotionPostBody post={post} scrollReveal />
            </div>
        </div>
    );
}
