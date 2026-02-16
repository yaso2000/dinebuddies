import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, updateDoc, deleteDoc, arrayUnion, arrayRemove, serverTimestamp, getDoc, addDoc, collection } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { FaRegCommentDots, FaTrash, FaEllipsisH } from 'react-icons/fa';
import { AiOutlineHeart, AiFillHeart } from 'react-icons/ai';
import { BiRepost } from 'react-icons/bi';
import { IoShareSocialOutline } from 'react-icons/io5';
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

        // Define the post to be reposted (if reposting a repost, target the original)
        const targetPost = post.type === 'repost' ? post.originalPost : post;
        if (!targetPost) return;

        try {
            // 1. Create a new Repost Document in the feed
            await addDoc(collection(db, 'communityPosts'), {
                type: 'repost',
                author: {
                    id: currentUser.uid,
                    name: currentUser.displayName || 'User',
                    avatar: currentUser.photoURL
                },
                originalPost: targetPost, // Store snapshot of original content
                createdAt: serverTimestamp(),
                likes: [],
                comments: [],
                reposts: []
            });

            // 2. Increment repost count on the ORIGINAL post
            const originalRef = doc(db, 'communityPosts', targetPost.id);
            await updateDoc(originalRef, { reposts: arrayUnion(currentUser.uid) });

            alert("Reposted to your feed!");
        } catch (error) {
            console.error('Error reposting:', error);
            alert("Failed to repost.");
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

    // --- REPOST RENDERING LOGIC ---
    // If this is a repost, we show the reposter's info at the top,
    // but the MAIN content is the original post.
    const isRepost = post.type === 'repost' && post.originalPost;
    const displayPost = isRepost ? post.originalPost : post;

    // Resolve Display Post Author (Original Author)
    // We need to apply the SAME logic as above but for the displayPost object
    let displayAuthorName = displayPost.partnerName || displayPost.author?.name || displayPost.userName || displayPost.user_name || displayPost.displayName || 'User';
    let displayAuthorAvatar = displayPost.partnerLogo || displayPost.author?.avatar || displayPost.author?.photoURL || displayPost.userPhoto || displayPost.user_photo || displayPost.photoURL || displayPost.photo_url || displayPost.profilePicture || null;
    let displayAuthorId = displayPost.partnerId || displayPost.author?.id || displayPost.authorId || displayPost.userId || displayPost.uid;

    // Override for current user (if I am the original author)
    if (currentUser?.uid === displayAuthorId && userProfile && !isRepost) {
        displayAuthorName = userProfile.businessInfo?.businessName || userProfile.displayName || userProfile.display_name || userProfile.name || displayAuthorName;
        displayAuthorAvatar = userProfile.businessInfo?.logo || userProfile.photoURL || userProfile.photo_url || userProfile.avatar || displayAuthorAvatar;
    }

    if (!displayAuthorAvatar) {
        displayAuthorAvatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${displayAuthorId || 'default'}`;
    }

    let displayAuthorHandle = displayPost.author?.username || displayPost.author?.handle || null;
    if (!displayAuthorHandle) {
        displayAuthorHandle = `@${displayAuthorName.toLowerCase().replace(/\s/g, '')}`;
    }


    return (
        <div
            className={`post-card ${showInChat ? 'in-chat' : ''}`}
            onClick={() => {
                if (!showInChat) {
                    // navigate(/post/${post.id}); 
                }
            }}
        >
            {/* Repost Header */}
            {isRepost && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '8px', paddingLeft: '40px' }}>
                    <BiRepost size={16} />
                    <span style={{ fontWeight: 'bold' }}>{authorName} reposted</span>
                </div>
            )}

            <div style={{ display: 'flex', gap: '12px' }}>
                {/* Left: Avatar (Of the Original Author) */}
                <div className="post-avatar-col">
                    <img
                        src={displayAuthorAvatar}
                        className="post-avatar"
                        style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover', cursor: 'pointer' }}
                        onClick={(e) => {
                            e.stopPropagation();
                            if (displayPost.partnerId) navigate(`/partner/${displayPost.partnerId}`);
                            else if (displayAuthorId) navigate(`/profile/${displayAuthorId}`);
                        }}
                    />
                </div>

                {/* Right: Content */}
                <div className="post-content-col" style={{ flex: 1 }}>
                    {/* Header: Original Author Info */}
                    <div className="post-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                            <span className="post-user-name" style={{ fontWeight: 'bold', color: 'var(--text-main)' }}>
                                {displayAuthorName}
                            </span>
                            <span className="post-user-handle" style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                                {displayAuthorHandle}
                            </span>
                            <span className="post-dot-separator" style={{ color: 'var(--text-muted)' }}>·</span>
                            <span className="post-time" style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                                {formatDate(displayPost.createdAt)}
                            </span>
                        </div>
                        <div style={{ marginLeft: 'auto', position: 'relative' }}>
                            <button
                                className="icon-btn-small"
                                onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
                                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                            >
                                <FaEllipsisH size={16} />
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

                    {/* Content Wrapper with Custom Styles (Using Display Post) */}
                    <div style={{
                        backgroundColor: displayPost.textStyle?.backgroundColor || 'transparent',
                        color: displayPost.textStyle?.color || 'inherit',
                        fontFamily: displayPost.textStyle?.fontFamily || 'inherit',
                        borderRadius: displayPost.textStyle?.backgroundColor && displayPost.textStyle.backgroundColor !== 'transparent' ? '12px' : '0',
                        padding: displayPost.textStyle?.backgroundColor && displayPost.textStyle.backgroundColor !== 'transparent' ? '12px' : '0',
                        marginBottom: '12px'
                    }}>
                        {/* Text Content */}
                        {(displayPost.content || (!displayPost.overlayText && displayPost.caption)) && (
                            <div className="post-text" style={{
                                whiteSpace: 'pre-wrap',
                                marginBottom: (displayPost.mediaUrl || displayPost.image) ? '12px' : '0',
                                fontSize: displayPost.textStyle?.fontSize ? `${displayPost.textStyle.fontSize}px` : 'inherit',
                                textAlign: displayPost.textStyle?.textAlign || 'left',
                                fontWeight: displayPost.textStyle?.fontWeight || 'normal',
                                fontStyle: displayPost.textStyle?.fontStyle || 'normal',
                            }}>
                                {displayPost.content || displayPost.caption}
                            </div>
                        )}

                        {/* Media */}
                        {(displayPost.mediaUrl || displayPost.image) && (
                            <div className="post-media-container" style={{ position: 'relative', borderRadius: '8px', overflow: 'hidden', marginTop: '8px' }}>
                                {displayPost.mediaType === 'video' ? (
                                    <video
                                        src={displayPost.mediaUrl || displayPost.image}
                                        controls
                                        className="post-media-content"
                                        onClick={(e) => e.stopPropagation()}
                                        style={{ width: '100%', display: 'block' }}
                                    />
                                ) : (
                                    <img
                                        src={displayPost.mediaUrl || displayPost.image}
                                        alt="Post media"
                                        className="post-media-content"
                                        style={{ width: '100%', display: 'block' }}
                                    />
                                )}

                                {/* Overlay Text Support */}
                                {displayPost.overlayText && (
                                    <div style={{
                                        position: 'absolute', inset: 0,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        pointerEvents: 'none', padding: '20px',
                                        zIndex: 5
                                    }}>
                                        <span style={{
                                            color: displayPost.overlayStyle?.color || 'white',
                                            fontFamily: displayPost.overlayStyle?.fontFamily || 'inherit',
                                            fontSize: '1.5rem', fontWeight: 'bold',
                                            textAlign: 'center',
                                            textShadow: '0 2px 4px rgba(0,0,0,0.5)',
                                            WebkitTextStroke: displayPost.overlayStyle?.hasStroke ? '1px black' : 'none',
                                            whiteSpace: 'pre-wrap'
                                        }}>
                                            {displayPost.overlayText}
                                        </span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Actions Bar */}
                    <div className="post-actions">
                        {/* Like */}
                        <button
                            className={`action-item like ${hasLiked ? 'liked' : ''}`}
                            onClick={handleLike}
                        >
                            {hasLiked ? <AiFillHeart size={20} /> : <AiOutlineHeart size={20} />}
                            {(post.likes?.length || 0) > 0 && <span className="action-count">{post.likes.length}</span>}
                        </button>

                        {/* Reply */}
                        <button
                            className="action-item reply"
                            onClick={(e) => {
                                e.stopPropagation();
                                setShowComments(!showComments);
                            }}
                        >
                            <FaRegCommentDots size={19} />
                            {post.comments?.length > 0 && <span className="action-count">{post.comments.length}</span>}
                        </button>

                        {/* Repost */}
                        <button
                            className={`action-item repost ${hasReposted ? 'reposted' : ''}`}
                            onClick={handleRepost}
                            style={{ color: hasReposted ? '#00ba7c' : '' }}
                        >
                            <BiRepost size={22} />
                            {post.reposts?.length > 0 && <span className="action-count">{post.reposts.length}</span>}
                        </button>

                        {/* Share */}
                        <button
                            className="action-item share"
                            onClick={(e) => {
                                e.stopPropagation();
                                setShowShare(true);
                            }}
                        >
                            <IoShareSocialOutline size={20} />
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
        </div>
    );
};

export default PostCard;
