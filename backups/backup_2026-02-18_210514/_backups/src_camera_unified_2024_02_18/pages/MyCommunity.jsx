import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, orderBy, onSnapshot, deleteDoc, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { FaArrowLeft, FaUsers, FaChartLine, FaTrash, FaEdit, FaComments, FaHeart, FaPlus } from 'react-icons/fa';


const MyCommunity = () => {
    const navigate = useNavigate();
    const { currentUser, userProfile } = useAuth();
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);
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

        const unsubscribePosts = subscribeToPosts();
        const unsubscribeMembers = subscribeToMembers();

        return () => {
            if (unsubscribePosts) unsubscribePosts();
            if (unsubscribeMembers) unsubscribeMembers();
        };
    }, [currentUser, isBusinessAccount]);

    const subscribeToMembers = () => {
        try {
            // Source of Truth: Users who have this partner in their joinedCommunities
            const q = query(
                collection(db, 'users'),
                where('joinedCommunities', 'array-contains', currentUser.uid)
            );

            return onSnapshot(q, async (snapshot) => {
                const realCount = snapshot.size;
                const memberIds = snapshot.docs.map(doc => doc.id);

                setStats(prev => ({
                    ...prev,
                    members: realCount
                }));

                // Self-healing: Ensure partner's communityMembers array matches reality
                if (currentUser.uid) {
                    try {
                        const partnerRef = doc(db, 'users', currentUser.uid);
                        const partnerSnap = await getDoc(partnerRef);
                        const currentMembers = partnerSnap.data()?.communityMembers || [];

                        // Check if we need to update
                        const missingMembers = memberIds.filter(id => !currentMembers.includes(id));

                        if (missingMembers.length > 0) {
                            console.log('🔄 Syncing community members...', missingMembers);
                            const { updateDoc, arrayUnion } = await import('firebase/firestore');
                            await updateDoc(partnerRef, {
                                communityMembers: arrayUnion(...missingMembers)
                            });
                        }
                    } catch (err) {
                        console.error("Auto-sync error:", err);
                    }
                }
            }, (error) => {
                console.error("Error fetching members:", error);
            });
        } catch (error) {
            console.error("Error in subscribeToMembers:", error);
            return () => { };
        }
    };

    const subscribeToPosts = () => {
        try {
            const q = query(
                collection(db, 'communityPosts'),
                where('partnerId', '==', currentUser.uid),
                orderBy('createdAt', 'asc')
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
                    onClick={() => navigate(`/partner/${currentUser.uid}`)}
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
            <div style={{ padding: '0 1.5rem 1rem', display: 'flex', gap: '10px' }}>
                <button
                    onClick={() => navigate('/create-story')}
                    style={{
                        flex: 1,
                        padding: '10px 12px',
                        background: 'linear-gradient(135deg, #8b5cf6, #ec4899)',
                        border: 'none',
                        borderRadius: '14px',
                        color: 'white',
                        fontWeight: '700',
                        fontSize: '0.85rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        transition: 'all 0.2s',
                        boxShadow: '0 2px 8px rgba(139, 92, 246, 0.3)'
                    }}
                >
                    <FaPlus style={{ fontSize: '0.8rem' }} />
                    Story
                </button>

                <button
                    onClick={() => navigate('/create-post')}
                    style={{
                        flex: 1,
                        padding: '10px 12px',
                        background: 'linear-gradient(135deg, var(--primary), #f97316)',
                        border: 'none',
                        borderRadius: '14px',
                        color: 'white',
                        fontWeight: '700',
                        fontSize: '0.85rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        transition: 'all 0.2s',
                        boxShadow: '0 2px 8px rgba(139, 92, 246, 0.3)'
                    }}
                >
                    <FaEdit style={{ fontSize: '0.8rem' }} />
                    Post
                </button>

                <button
                    onClick={() => navigate(`/community/${currentUser.uid}`)}
                    style={{
                        flex: 1,
                        padding: '10px 12px',
                        background: 'linear-gradient(135deg, #10b981, #059669)',
                        border: 'none',
                        borderRadius: '14px',
                        color: 'white',
                        fontWeight: '700',
                        fontSize: '0.85rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        transition: 'all 0.2s',
                        boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)'
                    }}
                >
                    <FaComments style={{ fontSize: '0.8rem' }} />
                    Chat
                </button>
            </div>



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
