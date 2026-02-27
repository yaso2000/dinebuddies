import React, { useMemo, useState } from 'react';
import { useInvitations } from '../context/InvitationContext';
import { useTranslation } from 'react-i18next';
import PostCard from '../components/PostCard';
import { FaGlobe, FaBuilding } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import StoriesBar from '../components/StoriesBar';
import StoryViewer from '../components/StoryViewer';

const FriendsFeed = () => {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const { restaurants } = useInvitations();
    const [viewingStory, setViewingStory] = useState(null);

    // All City Posts (Public Feed)
    const cityPosts = useMemo(() => {
        return [];
    }, []);

    return (
        <div className="page-container" style={{ paddingBottom: '100px', animation: 'fadeIn 0.5s ease-out' }}>
            <div style={{ padding: '1.5rem 1.25rem' }}>
                <h1 style={{ fontSize: '1.8rem', fontWeight: '900', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <FaGlobe style={{ color: 'var(--primary)' }} />
                    {t('community')}
                </h1>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                    {t('discover_offers')}
                </p>
            </div>

            {/* Stories Bar */}
            <StoriesBar onStoryClick={setViewingStory} />

            <div style={{ padding: '0 1.25rem' }}>
                {cityPosts.length === 0 ? (
                    <div style={{
                        textAlign: 'center',
                        padding: '5rem 2rem',
                        background: 'var(--bg-card)',
                        borderRadius: '24px',
                        border: '1px dashed var(--border-color)',
                        marginTop: '1rem'
                    }}>
                        <FaBuilding style={{ fontSize: '3.5rem', color: 'var(--primary)', opacity: 0.3, marginBottom: '1.5rem' }} />
                        <h3 style={{ fontSize: '1.2rem', fontWeight: '800', marginBottom: '0.5rem' }}>
                            {t('city_quiet')}
                        </h3>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '2rem' }}>
                            {i18n.language === 'ar'
                                ? t('no_public_posts')
                                : 'No public posts yet. Be the first to post!'}
                        </p>
                        <button
                            onClick={() => navigate('/restaurants')}
                            className="btn btn-primary"
                            style={{ borderRadius: '15px', padding: '12px 25px' }}
                        >
                            {t('browse_partners')}
                        </button>
                    </div>
                ) : (
                    <div className="feed-list">
                        {cityPosts.map(post => {
                            const restaurant = restaurants.find(r => r.id === post.restaurantId);
                            if (!restaurant) return null;
                            return <PostCard key={post.id} post={post} restaurant={restaurant} />;
                        })}
                    </div>
                )}
            </div>

            {/* Story Viewer */}
            {viewingStory && (
                <StoryViewer
                    partnerStories={viewingStory}
                    onClose={() => setViewingStory(null)}
                />
            )}
        </div>
    );
};

export default FriendsFeed;
