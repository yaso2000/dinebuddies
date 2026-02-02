import React, { useMemo } from 'react';
import { useInvitations } from '../context/InvitationContext';
import { useTranslation } from 'react-i18next';
import PostCard from '../components/PostCard';
import { FaGlobe, FaBuilding } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';

const FriendsFeed = () => {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const { partnerPosts, restaurants } = useInvitations();

    // All City Posts (Public Feed)
    const cityPosts = useMemo(() => {
        if (!partnerPosts) return [];
        // Filter: Must be explicitly public, OR legacy posts (undefined) are treated as public for now to avoid empty feed
        // But the user specifically wants separation.
        // Let's filter: display if isPublic is true.
        // Legacy posts without flags were "Community" by default in the code logic (only spread in IF block).
        // So legacy posts are effectively private/community.
        return partnerPosts
            .filter(post => post.isPublic !== false)
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }, [partnerPosts]);

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
        </div>
    );
};

export default FriendsFeed;
