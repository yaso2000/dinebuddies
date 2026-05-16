import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import UserAvatar from './UserAvatar';
import { renderMotionPost } from '../features/motion-post/renderMotionPost';
import { motionFirestoreDocToPreviewPayload, motionPostPreviewAspectFromDoc } from '../features/motion-post/motionPostFeedUtils'; = (ts) => {
    if (!ts) return '';
    const d = typeof ts.toDate === 'function' ? ts.toDate() : new Date(ts);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

/**
 * Public feed card for published motion posts (`business_motion_posts`).
 * No navigation to a detail page — stays in feed (requirement).
 */
export default function MotionPostFeedCard({ post }) {
    const { t } = useTranslation();
    const navigate = useNavigate();

    const previewPayload = useMemo(() => motionFirestoreDocToPreviewPayload(post), [post]);
    const previewAspect = useMemo(() => motionPostPreviewAspectFromDoc(post), [post]);
    const previewMaxWidth = previewAspect === 'landscape' ? 520 : previewAspect === 'vertical' ? 300 : 420;

    const authorName = post._feedAuthorName || t('business', 'Business');
    const authorAvatar = post._feedAuthorAvatar || null;
    const timeSource = post.publishedAt || post.updatedAt;
    const authorObj = useMemo(
        () => ({
            displayName: authorName,
            display_name: authorName,
            role: 'business',
            photo_url: authorAvatar,
            photoURL: authorAvatar,
            avatarUrl: authorAvatar,
        }),
        [authorName, authorAvatar]
    );

    return (
        <div
            className="post-card motion-post-feed-card"
            role="article"
            onClick={(e) => e.stopPropagation()}
            style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 0,
                cursor: 'default',
            }}
        >
            <div className="post-header-row" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8, padding: '16px 16px 4px 16px' }}>
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
            </div>

            <div
                className="post-content-body motion-post-feed-card__canvas"
                style={{ width: '100%', padding: '0 16px 16px', boxSizing: 'border-box' }}
            >
                <div style={{ maxWidth: previewMaxWidth, margin: '0 auto', width: '100%' }}>
                    {renderMotionPost(previewPayload, { previewAspect })}
                </div>
            </div>
        </div>
    );
}
