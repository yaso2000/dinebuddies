import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';
import { FaChevronLeft } from 'react-icons/fa';
import PostCard from '../components/PostCard';

const PostDetails = () => {
    const { postId, featuredId } = useParams();
    const isFeatured = !!featuredId;
    const id = featuredId || postId;
    const collection = isFeatured ? 'featured_posts' : 'communityPosts';
    const navigate = useNavigate();
    const { t, i18n } = useTranslation();

    const [post, setPost] = useState(null);
    const [loading, setLoading] = useState(true);

    // Live listener for the post
    useEffect(() => {
        if (!id) return;
        const ref = doc(db, collection, id);
        const unsub = onSnapshot(ref, (snap) => {
            if (snap.exists()) {
                setPost({ id: snap.id, ...snap.data(), _isFeatured: isFeatured });
            } else {
                setPost(null);
            }
            setLoading(false);
        }, () => setLoading(false));

        return () => unsub();
    }, [id, collection, isFeatured]);

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
                <div style={{ width: 36, height: 36, border: '4px solid var(--border-color)', borderTop: '4px solid var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            </div>
        );
    }

    if (!post) {
        return (
            <div style={{ textAlign: 'center', padding: '4rem 1rem' }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>😕</div>
                <h2 style={{ color: 'var(--text-main)', marginBottom: '0.5rem' }}>{t('post_not_found', 'Post not found')}</h2>
                <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>{t('post_deleted', 'This post may have been deleted.')}</p>
                <button onClick={() => navigate(-1)} className="ui-btn ui-btn--primary">{t('btn_go_back', 'Go Back')}</button>
            </div>
        );
    }

    return (
        <div style={{ maxWidth: '100%', width: '100%', margin: 0, padding: '0 0 4rem', boxSizing: 'border-box' }}>
            {/* Header */}
            <div style={{
                display: 'flex', alignItems: 'center', gap: '1rem',
                padding: '1rem 1rem 0.75rem',
                borderBottom: '1px solid var(--border-color)',
                position: 'sticky', top: 0, background: 'var(--bg-main)', zIndex: 10
            }}>
                <button
                    onClick={() => navigate(-1)}
                    style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: 'var(--text-main)', padding: '6px',
                        borderRadius: '50%', display: 'flex', alignItems: 'center',
                        transition: 'background 0.15s'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--hover-overlay)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'none'}
                >
                    <FaChevronLeft size={18} style={{ transform: i18n.dir() === 'rtl' ? 'rotate(180deg)' : 'none' }} />
                </button>
                <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)' }}>
                    {t('post_title', 'Post')}</h2>
            </div>

            {/* Post — dynamically handled natively by unified PostCard */}
            <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)' }}>
                <PostCard post={post} showInChat={true} defaultExpandComments={true} />
            </div>
        </div>
    );
};

export default PostDetails;
