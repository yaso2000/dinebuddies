import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, orderBy, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { FaArrowLeft, FaUsers, FaChartLine, FaImage, FaTrash, FaEdit, FaComments, FaHeart } from 'react-icons/fa';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase/config';

const MyCommunity = () => {
    const navigate = useNavigate();
    const { currentUser, userProfile } = useAuth();
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCreatePost, setShowCreatePost] = useState(false);
    const [newPost, setNewPost] = useState({ content: '', image: null });
    const [uploading, setUploading] = useState(false);
    const [stats, setStats] = useState({
        members: 0,
        posts: 0
    });

    // Check if user is a business account
    const isBusinessAccount = userProfile?.accountType === 'business';

    useEffect(() => {
        if (!isBusinessAccount) {
            navigate('/');
            return;
        }
        fetchCommunityStats();
        const unsubscribe = subscribeToPosts();
        return () => unsubscribe && unsubscribe();
    }, [currentUser, isBusinessAccount]);

    const fetchCommunityStats = async () => {
        try {
            const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
            const userData = userDoc.data();
            setStats({
                members: userData?.communityMembers?.length || 0,
                posts: 0,       // Will be updated from posts subscription
                engagement: 0   // Will be updated from posts subscription (likes + comments)
            });
        } catch (error) {
            console.error('Error fetching stats:', error);
        }
    };

    const subscribeToPosts = () => {
        try {
            const q = query(
                collection(db, 'communityPosts'),
                where('partnerId', '==', currentUser.uid),
                orderBy('createdAt', 'asc') // Changed to asc to match index
            );

            return onSnapshot(
                q,
                (snapshot) => {
                    const postsList = snapshot.docs.map(doc => ({
                        id: doc.id,
                        ...doc.data()
                    }));

                    const postsCount = postsList.length;

                    // Calculate total engagement (likes + comments) from all posts
                    const totalEngagement = postsList.reduce((sum, post) => {
                        const likes = post.likes?.length || 0;
                        const comments = post.comments?.length || 0;
                        return sum + likes + comments;
                    }, 0);

                    // Reverse to show newest first
                    setPosts(postsList.reverse());
                    setStats(prev => ({
                        ...prev,
                        posts: postsCount,
                        engagement: totalEngagement
                    }));
                    setLoading(false);
                },
                (error) => {
                    console.error('Error subscribing to posts:', error);
                    setLoading(false);
                    setPosts([]);
                    setStats(prev => ({ ...prev, posts: 0, engagement: 0 }));
                }
            );
        } catch (error) {
            console.error('Error subscribing to posts:', error);
            setLoading(false);
            return () => { };
        }
    };

    const handleImageUpload = async (file) => {
        if (!file) return null;

        const storageRef = ref(storage, `community-posts/${currentUser.uid}/${Date.now()}_${file.name}`);
        await uploadBytes(storageRef, file);
        return await getDownloadURL(storageRef);
    };

    const handleCreatePost = async (e) => {
        e.preventDefault();

        if (!newPost.content.trim() && !newPost.image) {
            alert('Please add content or an image');
            return;
        }

        setUploading(true);
        try {
            let imageUrl = null;
            if (newPost.image) {
                imageUrl = await handleImageUpload(newPost.image);
            }

            const businessInfo = userProfile?.businessInfo || {};

            await addDoc(collection(db, 'communityPosts'), {
                partnerId: currentUser.uid,
                partnerName: businessInfo.businessName || 'Business',
                partnerLogo: businessInfo.logoImage || null,
                content: newPost.content.trim(),
                image: imageUrl,
                createdAt: serverTimestamp(),
                likes: [],
                comments: []
            });

            setNewPost({ content: '', image: null });
            setShowCreatePost(false);
            alert('Post created successfully!');
        } catch (error) {
            console.error('Error creating post:', error);
            alert('Failed to create post. Please try again.');
        } finally {
            setUploading(false);
        }
    };

    const handleDeletePost = async (postId) => {
        if (!window.confirm('Are you sure you want to delete this post?')) return;

        try {
            await deleteDoc(doc(db, 'communityPosts', postId));
            alert('Post deleted successfully!');
        } catch (error) {
            console.error('Error deleting post:', error);
            alert('Failed to delete post.');
        }
    };

    const formatDate = (timestamp) => {
        if (!timestamp) return '';
        const date = timestamp.toDate();
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    if (!isBusinessAccount) {
        return null;
    }

    if (loading) {
        return (
            <div className="page-container" style={{ padding: '2rem', textAlign: 'center' }}>
                <div style={{
                    width: '50px',
                    height: '50px',
                    border: '4px solid var(--border-color)',
                    borderTop: '4px solid var(--primary)',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite',
                    margin: '0 auto 1rem'
                }} />
                <p style={{ color: 'var(--text-muted)' }}>Loading your community...</p>
            </div>
        );
    }

    return (
        <div className="page-container" style={{ paddingBottom: '100px' }}>
            {/* Header */}
            <header className="app-header sticky-header-glass">
                <button className="back-btn" onClick={() => navigate('/')}>
                    <FaArrowLeft style={{ transform: 'rotate(180deg)' }} />
                </button>
                <div style={{ flex: 1, textAlign: 'center' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: '800', margin: 0 }}>
                        My Community
                    </h3>
                </div>
                <button
                    className="back-btn"
                    onClick={() => navigate('/business-profile')}
                >
                    <FaUsers />
                </button>
            </header>

            {/* Stats Cards */}
            <div style={{ padding: '1.5rem', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                <div style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '16px',
                    padding: '1rem',
                    textAlign: 'center'
                }}>
                    <FaUsers style={{ fontSize: '1.5rem', color: 'var(--primary)', marginBottom: '8px' }} />
                    <h4 style={{ fontSize: '1.5rem', fontWeight: '800', margin: '4px 0' }}>{stats.members}</h4>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>Members</p>
                </div>
                <div style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '16px',
                    padding: '1rem',
                    textAlign: 'center'
                }}>
                    <FaEdit style={{ fontSize: '1.5rem', color: '#f97316', marginBottom: '8px' }} />
                    <h4 style={{ fontSize: '1.5rem', fontWeight: '800', margin: '4px 0' }}>{stats.posts}</h4>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>Posts</p>
                </div>
                <div style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '16px',
                    padding: '1rem',
                    textAlign: 'center'
                }}>
                    <FaHeart style={{ fontSize: '1.5rem', color: '#ef4444', marginBottom: '8px' }} />
                    <h4 style={{ fontSize: '1.5rem', fontWeight: '800', margin: '4px 0' }}>{stats.engagement}</h4>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>Engagement</p>
                </div>
            </div>

            {/* Action Buttons */}
            <div style={{ padding: '0 1.5rem 1rem', display: 'flex', gap: '12px' }}>
                <button
                    onClick={() => setShowCreatePost(!showCreatePost)}
                    style={{
                        flex: 1,
                        padding: '14px',
                        background: 'linear-gradient(135deg, var(--primary), #f97316)',
                        border: 'none',
                        borderRadius: '16px',
                        color: 'white',
                        fontWeight: '700',
                        fontSize: '1rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        transition: 'all 0.2s'
                    }}
                >
                    <FaEdit />
                    {showCreatePost ? 'Cancel' : 'Create Post'}
                </button>

                <button
                    onClick={() => navigate(`/community/${currentUser.uid}`)}
                    style={{
                        flex: 1,
                        padding: '14px',
                        background: 'linear-gradient(135deg, #10b981, #059669)',
                        border: 'none',
                        borderRadius: '16px',
                        color: 'white',
                        fontWeight: '700',
                        fontSize: '1rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        transition: 'all 0.2s'
                    }}
                >
                    <FaComments />
                    Open Chat
                </button>
            </div>

            {/* Create Post Form */}
            {showCreatePost && (
                <div style={{
                    margin: '0 1.5rem 1.5rem',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '16px',
                    padding: '1.5rem'
                }}>
                    <form onSubmit={handleCreatePost}>
                        <textarea
                            value={newPost.content}
                            onChange={(e) => setNewPost({ ...newPost, content: e.target.value })}
                            placeholder="What's new in your business?"
                            style={{
                                width: '100%',
                                minHeight: '120px',
                                padding: '12px',
                                background: 'var(--bg-body)',
                                border: '1px solid var(--border-color)',
                                borderRadius: '12px',
                                color: 'white',
                                fontSize: '0.95rem',
                                resize: 'vertical',
                                marginBottom: '12px'
                            }}
                        />

                        <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => setNewPost({ ...newPost, image: e.target.files[0] })}
                            style={{
                                width: '100%',
                                padding: '12px',
                                background: 'var(--bg-body)',
                                border: '1px solid var(--border-color)',
                                borderRadius: '12px',
                                color: 'white',
                                fontSize: '0.9rem',
                                marginBottom: '12px'
                            }}
                        />

                        {newPost.image && (
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
                                📷 {newPost.image.name}
                            </p>
                        )}

                        <button
                            type="submit"
                            disabled={uploading}
                            style={{
                                width: '100%',
                                padding: '12px',
                                background: uploading ? 'var(--bg-body)' : 'linear-gradient(135deg, var(--primary), #f97316)',
                                border: 'none',
                                borderRadius: '12px',
                                color: 'white',
                                fontWeight: '700',
                                cursor: uploading ? 'not-allowed' : 'pointer',
                                opacity: uploading ? 0.6 : 1
                            }}
                        >
                            {uploading ? 'Posting...' : 'Post'}
                        </button>
                    </form>
                </div>
            )}

            {/* Posts List */}
            <div style={{ padding: '0 1.5rem' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: '800', marginBottom: '1rem' }}>
                    Your Posts
                </h3>

                {posts.length === 0 ? (
                    <div style={{
                        textAlign: 'center',
                        padding: '3rem 1rem',
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '16px',
                        color: 'var(--text-muted)'
                    }}>
                        <FaEdit style={{ fontSize: '3rem', marginBottom: '1rem', opacity: 0.3 }} />
                        <p>No posts yet. Create your first post!</p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {posts.map(post => (
                            <div
                                key={post.id}
                                style={{
                                    background: 'var(--bg-card)',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: '16px',
                                    padding: '1.5rem',
                                    position: 'relative'
                                }}
                            >
                                {/* Post Header */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                                    <div>
                                        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
                                            {formatDate(post.createdAt)}
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => handleDeletePost(post.id)}
                                        style={{
                                            background: 'transparent',
                                            border: 'none',
                                            color: '#ef4444',
                                            cursor: 'pointer',
                                            fontSize: '1.1rem',
                                            padding: '4px'
                                        }}
                                    >
                                        <FaTrash />
                                    </button>
                                </div>

                                {/* Post Content */}
                                {post.content && (
                                    <p style={{ fontSize: '0.95rem', lineHeight: '1.6', marginBottom: '12px' }}>
                                        {post.content}
                                    </p>
                                )}

                                {/* Post Image */}
                                {post.image && (
                                    <img
                                        src={post.image}
                                        alt="Post"
                                        style={{
                                            width: '100%',
                                            borderRadius: '12px',
                                            marginBottom: '12px'
                                        }}
                                    />
                                )}

                                {/* Post Stats */}
                                <div style={{
                                    display: 'flex',
                                    gap: '16px',
                                    paddingTop: '12px',
                                    borderTop: '1px solid var(--border-color)',
                                    fontSize: '0.85rem',
                                    color: 'var(--text-muted)'
                                }}>
                                    <span>❤️ {post.likes?.length || 0} likes</span>
                                    <span>💬 {post.comments?.length || 0} comments</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default MyCommunity;
