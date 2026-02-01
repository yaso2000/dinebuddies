import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, updateDoc, arrayUnion, arrayRemove, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { FaHeart, FaComment, FaEye, FaRegHeart, FaPaperPlane, FaTimes } from 'react-icons/fa';

const PostCard = ({ post, showInChat = false }) => {
    const navigate = useNavigate();
    const { currentUser } = useAuth();
    const [showComments, setShowComments] = useState(false);
    const [newComment, setNewComment] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const hasLiked = post.likes?.includes(currentUser?.uid);

    const handleLike = async () => {
        if (!currentUser) return;

        try {
            const postRef = doc(db, 'communityPosts', post.id);

            if (hasLiked) {
                await updateDoc(postRef, {
                    likes: arrayRemove(currentUser.uid)
                });
            } else {
                await updateDoc(postRef, {
                    likes: arrayUnion(currentUser.uid)
                });
            }
        } catch (error) {
            console.error('Error toggling like:', error);
        }
    };

    const handleAddComment = async (e) => {
        e.preventDefault();
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
            alert('Failed to add comment. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    const formatDate = (timestamp) => {
        if (!timestamp) return '';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        const now = new Date();
        const diff = now - date;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) return 'Just now';
        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        if (days < 7) return `${days}d ago`;
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    const sortedComments = [...(post.comments || [])].sort((a, b) => {
        const dateA = new Date(a.createdAt);
        const dateB = new Date(b.createdAt);
        return dateB - dateA; // Newest first
    });

    return (
        <div
            style={{
                background: 'var(--bg-card)',
                border: showInChat ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                borderRadius: '16px',
                overflow: 'hidden',
                marginBottom: showInChat ? '8px' : '0'
            }}
        >
            {/* Post Header */}
            <div
                style={{
                    padding: '1rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    cursor: 'pointer'
                }}
                onClick={() => navigate(`/partner/${post.partnerId}`)}
            >
                <div style={{
                    width: showInChat ? '40px' : '48px',
                    height: showInChat ? '40px' : '48px',
                    borderRadius: '50%',
                    background: post.partnerLogo
                        ? `url(${post.partnerLogo})`
                        : 'linear-gradient(135deg, var(--primary), #f97316)',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    flexShrink: 0
                }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                    <h4 style={{
                        fontSize: showInChat ? '0.9rem' : '0.95rem',
                        fontWeight: '800',
                        margin: 0,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                    }}>
                        {post.partnerName}
                    </h4>
                    <p style={{
                        fontSize: showInChat ? '0.7rem' : '0.75rem',
                        color: 'var(--text-muted)',
                        margin: 0
                    }}>
                        {showInChat ? '📢 Official Post' : formatDate(post.createdAt)}
                    </p>
                </div>
            </div>

            {/* Post Content */}
            {post.content && (
                <div style={{ padding: '0 1rem 1rem' }}>
                    <p style={{
                        fontSize: '0.95rem',
                        lineHeight: '1.6',
                        margin: 0,
                        whiteSpace: 'pre-wrap'
                    }}>
                        {post.content}
                    </p>
                </div>
            )}

            {/* Post Image */}
            {post.image && (
                <img
                    src={post.image}
                    alt="Post"
                    style={{
                        width: '100%',
                        maxHeight: '400px',
                        objectFit: 'cover'
                    }}
                />
            )}

            {/* Post Stats */}
            <div style={{
                padding: '0.75rem 1rem',
                display: 'flex',
                gap: '16px',
                fontSize: '0.85rem',
                color: 'var(--text-muted)',
                borderTop: '1px solid var(--border-color)'
            }}>
                <span>{post.likes?.length || 0} likes</span>
                <span>{post.comments?.length || 0} comments</span>
            </div>

            {/* Post Actions */}
            <div style={{
                padding: '0.5rem 1rem',
                borderTop: '1px solid var(--border-color)',
                display: 'flex',
                gap: '8px'
            }}>
                <button
                    onClick={handleLike}
                    style={{
                        flex: 1,
                        padding: '10px',
                        background: 'transparent',
                        border: 'none',
                        color: hasLiked ? '#ef4444' : 'var(--text-muted)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        fontSize: '0.9rem',
                        fontWeight: '600',
                        borderRadius: '8px',
                        transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-body)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                    {hasLiked ? <FaHeart /> : <FaRegHeart />}
                    <span>Like</span>
                </button>

                <button
                    onClick={() => setShowComments(!showComments)}
                    style={{
                        flex: 1,
                        padding: '10px',
                        background: 'transparent',
                        border: 'none',
                        color: showComments ? 'var(--primary)' : 'var(--text-muted)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        fontSize: '0.9rem',
                        fontWeight: '600',
                        borderRadius: '8px',
                        transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-body)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                    <FaComment />
                    <span>Comment</span>
                </button>
            </div>

            {/* Comments Section */}
            {showComments && (
                <div style={{
                    borderTop: '1px solid var(--border-color)',
                    background: 'var(--bg-body)'
                }}>
                    {/* Add Comment Form */}
                    <form onSubmit={handleAddComment} style={{ padding: '1rem' }}>
                        <div style={{
                            display: 'flex',
                            gap: '8px',
                            alignItems: 'flex-start'
                        }}>
                            <div style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '50%',
                                background: currentUser?.photoURL
                                    ? `url(${currentUser.photoURL})`
                                    : 'linear-gradient(135deg, var(--primary), #f97316)',
                                backgroundSize: 'cover',
                                backgroundPosition: 'center',
                                flexShrink: 0
                            }} />
                            <div style={{ flex: 1, display: 'flex', gap: '8px' }}>
                                <input
                                    type="text"
                                    value={newComment}
                                    onChange={(e) => setNewComment(e.target.value)}
                                    placeholder="Write a comment..."
                                    style={{
                                        flex: 1,
                                        padding: '10px 12px',
                                        background: 'var(--bg-card)',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: '20px',
                                        color: 'white',
                                        fontSize: '0.9rem'
                                    }}
                                />
                                <button
                                    type="submit"
                                    disabled={!newComment.trim() || submitting}
                                    style={{
                                        padding: '10px 16px',
                                        background: newComment.trim() && !submitting
                                            ? 'linear-gradient(135deg, var(--primary), #f97316)'
                                            : 'var(--bg-card)',
                                        border: 'none',
                                        borderRadius: '20px',
                                        color: 'white',
                                        cursor: newComment.trim() && !submitting ? 'pointer' : 'not-allowed',
                                        opacity: newComment.trim() && !submitting ? 1 : 0.5
                                    }}
                                >
                                    <FaPaperPlane />
                                </button>
                            </div>
                        </div>
                    </form>

                    {/* Comments List */}
                    <div style={{
                        maxHeight: '300px',
                        overflowY: 'auto',
                        padding: '0 1rem 1rem'
                    }}>
                        {sortedComments.length === 0 ? (
                            <p style={{
                                textAlign: 'center',
                                color: 'var(--text-muted)',
                                fontSize: '0.85rem',
                                padding: '1rem'
                            }}>
                                No comments yet. Be the first to comment!
                            </p>
                        ) : (
                            sortedComments.map((comment) => (
                                <div
                                    key={comment.id}
                                    style={{
                                        display: 'flex',
                                        gap: '8px',
                                        marginBottom: '12px'
                                    }}
                                >
                                    <div style={{
                                        width: '32px',
                                        height: '32px',
                                        borderRadius: '50%',
                                        background: comment.userPhoto
                                            ? `url(${comment.userPhoto})`
                                            : 'linear-gradient(135deg, var(--primary), #f97316)',
                                        backgroundSize: 'cover',
                                        backgroundPosition: 'center',
                                        flexShrink: 0
                                    }} />
                                    <div style={{ flex: 1 }}>
                                        <div style={{
                                            background: 'var(--bg-card)',
                                            padding: '8px 12px',
                                            borderRadius: '12px'
                                        }}>
                                            <h5 style={{
                                                fontSize: '0.85rem',
                                                fontWeight: '700',
                                                margin: '0 0 4px 0'
                                            }}>
                                                {comment.userName}
                                            </h5>
                                            <p style={{
                                                fontSize: '0.9rem',
                                                margin: 0,
                                                lineHeight: '1.4',
                                                whiteSpace: 'pre-wrap'
                                            }}>
                                                {comment.text}
                                            </p>
                                        </div>
                                        <p style={{
                                            fontSize: '0.75rem',
                                            color: 'var(--text-muted)',
                                            margin: '4px 0 0 12px'
                                        }}>
                                            {formatDate(comment.createdAt)}
                                        </p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default PostCard;
