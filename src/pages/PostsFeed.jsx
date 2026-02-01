import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { FaArrowLeft } from 'react-icons/fa';
import PostCard from '../components/PostCard';

const PostsFeed = () => {
    const navigate = useNavigate();
    const { currentUser } = useAuth();
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = subscribeToPosts();
        return () => unsubscribe && unsubscribe();
    }, []);

    const subscribeToPosts = () => {
        try {
            const q = query(
                collection(db, 'communityPosts'),
                orderBy('createdAt', 'asc') // Changed to asc to match index
            );

            return onSnapshot(q, (snapshot) => {
                const postsList = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                // Reverse to show newest first
                setPosts(postsList.reverse());
                setLoading(false);
            });
        } catch (error) {
            console.error('Error subscribing to posts:', error);
            setLoading(false);
            return () => { };
        }
    };

    const handleLike = async (postId, currentLikes = []) => {
        if (!currentUser) return;

        try {
            const postRef = doc(db, 'communityPosts', postId);
            const hasLiked = currentLikes.includes(currentUser.uid);

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

    const formatDate = (timestamp) => {
        if (!timestamp) return '';
        const date = timestamp.toDate();
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
                <p style={{ color: 'var(--text-muted)' }}>Loading posts...</p>
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
                        Partners Feed
                    </h3>
                </div>
                <div style={{ width: '40px' }} />
            </header>

            {/* Posts List */}
            <div style={{ padding: '1rem' }}>
                {posts.length === 0 ? (
                    <div style={{
                        textAlign: 'center',
                        padding: '3rem 1rem',
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '16px',
                        color: 'var(--text-muted)'
                    }}>
                        <p>No posts yet. Check back later!</p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {posts.map(post => (
                            <PostCard key={post.id} post={post} showInChat={false} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default PostsFeed;
