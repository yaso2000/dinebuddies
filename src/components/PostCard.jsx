import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, updateDoc, deleteDoc, arrayUnion, arrayRemove, serverTimestamp, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { FaRegComment, FaComment, FaRetweet, FaRegHeart, FaHeart, FaShare, FaEllipsisH, FaTrash } from 'react-icons/fa';
import ShareButtons from './ShareButtons';
import './PostCard.css';

const PostCard = ({ post, showInChat = false }) => {
    const navigate = useNavigate();
    const { currentUser, userProfile } = useAuth();

    const [showComments, setShowComments] = useState(false);
    const [showMenu, setShowMenu] = useState(false);
    const [showShare, setShowShare] = useState(false);
    const [newComment, setNewComment] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [userData, setUserData] = useState(null);

    // Identify author ID
    const authorId = post.partnerId || post.author?.id || post.authorId || post.userId || post.uid;

    useEffect(() => {
        if (!authorId) return;

        // SKIP FETCH if we have good data in the post object itself
        const currentName = post.partnerName || post.author?.name;
        const currentAvatar = post.partnerLogo || post.author?.avatar;
        const hasGoodName = currentName && currentName !== 'User';

        if (hasGoodName && currentAvatar) return;

        // SKIP FETCH if it is ME (we use live profile in render)
        if (currentUser?.uid === authorId && userProfile) return;

        const fetchUser = async () => {
            try {
                const docRef = doc(db, 'users', authorId);
                const snap = await getDoc(docRef);
                if (snap.exists()) {
                    setUserData(snap.data());
                }
            } catch (err) {
                console.error("Error fetching post author:", err);
            }
        };
        fetchUser();
    }, [authorId, post, currentUser, userProfile]);

    // Derived State
    const hasLiked = post.likes?.includes(currentUser?.uid);
    const hasReposted = post.reposts?.includes(currentUser?.uid); // Assuming 'reposts' field exists or will be added

    const handleLike = async (e) => {
        e.stopPropagation();
        if (!currentUser) return;

        try {
            const postRef = doc(db, 'communityPosts', post.id);
            if (hasLiked) {
                await updateDoc(postRef, { likes: arrayRemove(currentUser.uid) });
            } else {
                await updateDoc(postRef, { likes: arrayUnion(currentUser.uid) });
            }
        } catch (error) {
            console.error('Error toggling like:', error);
        }
    };

    const handleRepost = async (e) => {
        e.stopPropagation();
        if (!currentUser) return;

        try {
            const postRef = doc(db, 'communityPosts', post.id);
            if (hasReposted) {
                await updateDoc(postRef, { reposts: arrayRemove(currentUser.uid) });
            } else {
                await updateDoc(postRef, { reposts: arrayUnion(currentUser.uid) });
            }
        } catch (error) {
            console.error('Error toggling repost:', error);
        }
    };

    const handleDelete = async (e) => {
        e.stopPropagation();
        if (!window.confirm("Are you sure you want to delete this post? This cannot be undone.")) return;

        try {
            await deleteDoc(doc(db, 'communityPosts', post.id));
            // UI should update automatically if parent is listening to snapshots
        } catch (error) {
            console.error("Error deleting post:", error);
            alert("Failed to delete post.");
        }
    };

    const handleAddComment = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!currentUser || !newComment.trim() || submitting) return;

        setSubmitting(true);
        try {
            const postRef = doc(db, 'communityPosts', post.id);
            const comment = {
                id: Date.now().toString(),
                userId: currentUser.uid,
                userName: currentUser.displayName || 'User',
                userPhoto: currentUser.photoURL || null,
                text: newComment.trim(),
                createdAt: new Date().toISOString()
            };

            await updateDoc(postRef, {
                comments: arrayUnion(comment)
            });

            setNewComment('');
        } catch (error) {
            console.error('Error adding comment:', error);
        } finally {
            setSubmitting(false);
        }
    };

    const formatDate = (timestamp) => {
        if (!timestamp) return '';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        const now = new Date();
        const diff = now - date;

        // Twitter style time
        if (diff < 60000) return 'Just now';
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
        if (diff < 604800000) return `${Math.floor(diff / 86400000)}d`;
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    // --- AUTHOR DATA RESOLUTION ---
    // 1. Initial State from Post Document (Snapshot) - With RESTORED Fallbacks
    let authorName = post.partnerName || post.author?.name || post.userName || post.user_name || post.displayName || 'User';

    let authorAvatar =
        post.partnerLogo ||
        post.author?.avatar ||
        post.author?.photoURL ||
        post.userPhoto ||
        post.user_photo ||
        post.photoURL ||
        post.photo_url ||
        post.profilePicture ||
        null;

    let authorHandle = post.author?.username || post.author?.handle || null;

    // 2. Override with Fetched Data (from useEffect - Medium Priority)
    if (userData) {
        authorName = userData.displayName || userData.display_name || userData.name || userData.businessInfo?.businessName || authorName;
        authorAvatar = userData.photoURL || userData.photo_url || userData.avatar || userData.businessInfo?.logo || authorAvatar;
        authorHandle = userData.username || userData.handle || authorHandle;
    }

    // 3. Override with Current User - Live Profile (Highest Priority for Self)
    // This fixes the issue where my own posts show stale "User" name immediately.
    if (currentUser?.uid === authorId && userProfile) {
        authorName =
            userProfile.businessInfo?.businessName ||
            userProfile.displayName ||
            userProfile.display_name ||
            userProfile.name ||
            authorName;

        authorAvatar =
            userProfile.businessInfo?.logo ||
            userProfile.photoURL ||
            userProfile.photo_url ||
            userProfile.avatar ||
            authorAvatar;

        authorHandle = userProfile.username || userProfile.handle || authorHandle;
    }

    // Fallbacks
    if (!authorAvatar) {
        authorAvatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${authorId}`;
    }

    if (!authorHandle) {
        authorHandle = `@${authorName.toLowerCase().replace(/\s/g, '')}`;
    } else if (!authorHandle.startsWith('@')) {
        authorHandle = `@${authorHandle}`;
    }

    return (
        <div
            className={`post-card ${showInChat ? 'in-chat' : ''}`}
            onClick={() => {
                // Navigate to detail view if not in chat
                if (!showInChat) {
                    // navigate(/post/${post.id}); // TODO: Add Post Detail Page
                }
            }}
        >
            {/* Left: Avatar */}
            <div className="post-avatar-col">
                <div
                    className="post-avatar"
                    style={{ backgroundImage: `url(${authorAvatar})` }}
                    onClick={(e) => {
                        e.stopPropagation();
                        // Special handling for partner vs user
                        if (post.partnerId) {
                            navigate(`/partner/${post.partnerId}`);
                        } else if (authorId) {
                            navigate(`/profile/${authorId}`);
                        }
                    }}
                />
            </div>

            {/* Right: Content */}
            <div className="post-content-col">
                {/* Header */}
                <div className="post-header-row">
                    <span className="post-user-name">{authorName}</span>
                    <span className="post-user-handle">{authorHandle}</span>
                    <span className="post-dot-separator">·</span>
                    <span className="post-time">{formatDate(post.createdAt)}</span>
                    <div style={{ marginLeft: 'auto', position: 'relative' }}>
                        <button
                            className="icon-btn-small"
                            onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--text-muted)',
                                padding: '6px',
                                borderRadius: '50%',
                                cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}
                        >
                            <FaEllipsisH size={18} />
                        </button>

                        {/* Dropdown Menu */}
                        {showMenu && (
                            <div style={{
                                position: 'absolute', top: '100%', right: 0,
                                background: 'var(--bg-card)',
                                border: '1px solid var(--border-color)',
                                borderRadius: '8px',
                                boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
                                zIndex: 10, minWidth: '120px', overflow: 'hidden'
                            }}>
                                {(currentUser?.uid === authorId) ? (
                                    <button
                                        onClick={handleDelete}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: '8px',
                                            padding: '10px 16px', width: '100%', border: 'none',
                                            background: 'transparent', color: 'red', cursor: 'pointer',
                                            fontSize: '0.9rem', textAlign: 'left'
                                        }}
                                    >
                                        <FaTrash size={14} /> Delete
                                    </button>
                                ) : (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); alert("Reported."); setShowMenu(false); }}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: '8px',
                                            padding: '10px 16px', width: '100%', border: 'none',
                                            background: 'transparent', color: 'var(--text-main)', cursor: 'pointer',
                                            fontSize: '0.9rem', textAlign: 'left'
                                        }}
                                    >
                                        Report Post
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Text Content */}
                {(post.content || (!post.overlayText && post.caption)) && (
                    <div className="post-text" style={{ whiteSpace: 'pre-wrap', marginBottom: '12px' }}>
                        {post.content || post.caption}
                    </div>
                )}

                {/* Media */}
                {(post.mediaUrl || post.image) && (
                    <div className="post-media-container" style={{ position: 'relative', borderRadius: '16px', overflow: 'hidden' }}>
                        {post.mediaType === 'video' ? (
                            <video
                                src={post.mediaUrl || post.image}
                                controls
                                className="post-media-content"
                                onClick={(e) => e.stopPropagation()}
                                style={{ width: '100%', display: 'block' }}
                            />
                        ) : (
                            <img
                                src={post.mediaUrl || post.image}
                                alt="Post media"
                                className="post-media-content"
                                style={{ width: '100%', display: 'block' }}
                            />
                        )}

                        {/* Overlay Text Support */}
                        {post.overlayText && (
                            <div style={{
                                position: 'absolute', inset: 0,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                pointerEvents: 'none', padding: '20px',
                                zIndex: 5
                            }}>
                                <span style={{
                                    color: post.overlayStyle?.color || 'white',
                                    fontFamily: post.overlayStyle?.fontFamily || 'inherit',
                                    fontSize: '1.5rem', fontWeight: 'bold',
                                    textAlign: 'center',
                                    textShadow: '0 2px 4px rgba(0,0,0,0.5)',
                                    WebkitTextStroke: post.overlayStyle?.hasStroke ? '1px black' : 'none',
                                    whiteSpace: 'pre-wrap'
                                }}>
                                    {post.overlayText}
                                </span>
                            </div>
                        )}
                    </div>
                )}

                {/* Actions Bar */}
                <div className="post-actions">
                    {/* Reply */}
                    <button
                        className="action-item reply"
                        onClick={(e) => {
                            e.stopPropagation();
                            setShowComments(!showComments);
                        }}
                    >
                        <FaRegComment />
                        {post.comments?.length > 0 && <span className="action-count">{post.comments.length}</span>}
                    </button>

                    {/* Repost */}
                    <button
                        className={`action-item repost ${hasReposted ? 'reposted' : ''}`}
                        onClick={handleRepost}
                        style={{ color: hasReposted ? '#00ba7c' : '' }}
                    >
                        <FaRetweet />
                        {post.reposts?.length > 0 && <span className="action-count">{post.reposts.length}</span>}
                    </button>

                    {/* Like */}
                    <button
                        className={`action-item like ${hasLiked ? 'liked' : ''}`}
                        onClick={handleLike}
                    >
                        {hasLiked ? <FaHeart /> : <FaRegHeart />}
                        {(post.likes?.length || 0) > 0 && <span className="action-count">{post.likes.length}</span>}
                    </button>

                    {/* Share */}
                    <button
                        className="action-item share"
                        onClick={(e) => {
                            e.stopPropagation();
                            setShowShare(true);
                        }}
                    >
                        <FaShare />
                    </button>
                </div>

                {/* Comments Section (Inline) */}
                {showComments && (
                    <div className="comments-section" onClick={(e) => e.stopPropagation()}>
                        {/* Input */}
                        <form onSubmit={handleAddComment} className="comment-input-row">
                            <input
                                type="text"
                                className="comment-input"
                                placeholder="Post your reply"
                                value={newComment}
                                onChange={(e) => setNewComment(e.target.value)}
                                autoFocus
                            />
                            <button
                                type="submit"
                                disabled={!newComment.trim() || submitting}
                                style={{
                                    background: '#1d9bf0',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '9999px',
                                    padding: '0 16px',
                                    fontWeight: 'bold',
                                    cursor: 'pointer',
                                    opacity: !newComment.trim() ? 0.5 : 1
                                }}
                            >
                                Reply
                            </button>
                        </form>

                        {/* Recent Comments */}
                        {post.comments?.length > 0 && (
                            <div className="recent-comments">
                                {post.comments.slice(-3).reverse().map((comment, idx) => (
                                    <div key={idx} style={{
                                        padding: '8px 0',
                                        borderTop: '1px solid var(--border-color)',
                                        fontSize: '0.9rem'
                                    }}>
                                        <div style={{ fontWeight: 'bold', marginBottom: '2px' }}>
                                            {comment.userName}
                                            <span style={{ fontWeight: 'normal', color: 'var(--text-muted)', marginLeft: '6px' }}>
                                                {formatDate(comment.createdAt)}
                                            </span>
                                        </div>
                                        <div style={{ color: 'var(--text-main)' }}>{comment.text}</div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Share Modal */}
            {showShare && (
                <div
                    style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    onClick={(e) => { e.stopPropagation(); setShowShare(false); }}
                >
                    <div
                        style={{ background: 'var(--bg-card)', padding: '20px', borderRadius: '16px', border: '1px solid var(--border-color)', maxWidth: '90%', width: '320px' }}
                        onClick={e => e.stopPropagation()}
                    >
                        <h3 style={{ textAlign: 'center', marginBottom: '16px', color: 'white' }}>{t('share_post')}</h3>
                        <ShareButtons
                            url={window.location.href}
                            title={`Post by ${authorName}`}
                            description={post.caption || post.content || 'Check out this post on DineBuddies!'}
                            type="post"
                            storyData={{
                                title: `Post by ${authorName}`,
                                image: post.mediaUrl || post.image,
                                description: post.caption || post.content,
                                hostName: authorName,
                                hostImage: authorAvatar
                            }}
                        />
                        <button
                            onClick={(e) => { e.stopPropagation(); setShowShare(false); }}
                            style={{ width: '100%', marginTop: '16px', padding: '10px', background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-muted)', borderRadius: '8px', cursor: 'pointer' }}
                        >
                            {t('close')}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PostCard;
