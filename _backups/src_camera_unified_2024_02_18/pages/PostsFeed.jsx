import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { FaArrowLeft, FaMapMarkerAlt } from 'react-icons/fa';
import PostCard from '../components/PostCard';
import StoriesBar from '../components/StoriesBar';
import StoryViewer from '../components/StoryViewer';
import { useTranslation } from 'react-i18next';

const PostsFeed = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { currentUser, userProfile } = useAuth();
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [viewingStory, setViewingStory] = useState(null);

    // Location & FIltering State
    const [geoFilter, setGeoFilter] = useState('global'); // 'city', 'country', 'global'
    const [isSearchActive, setIsSearchActive] = useState(false); // Toggle search bar

    // We now use userProfile.coordinates from AuthContext directly
    // No need for local userLocation state or manual fetching here

    useEffect(() => {
        const unsubscribe = subscribeToPosts();
        return () => unsubscribe && unsubscribe();
    }, []);

    const subscribeToPosts = () => {
        try {
            const q = query(
                collection(db, 'communityPosts'),
                orderBy('createdAt', 'asc')
            );

            return onSnapshot(q, (snapshot) => {
                const postsList = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                setPosts(postsList.reverse());
                setLoading(false);
            });
        } catch (error) {
            console.error('Error subscribing to posts:', error);
            setLoading(false);
            return () => { };
        }
    };

    // Search State
    const [searchQuery, setSearchQuery] = useState('');

    // Helper: Calculate Distance
    const calculateDistance = (lat1, lon1, lat2, lon2) => {
        const R = 6371; // km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    };

    // Filter Posts Logic
    const filteredPosts = useMemo(() => {
        let result = posts;

        // 1. Text Search Filter
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            result = result.filter(post =>
                post.content?.toLowerCase().includes(query) ||
                post.author?.name?.toLowerCase().includes(query)
            );
        }

        // 2. Location Filter (Implicit "My City" when searching, or explicit tabs otherwise)
        if (userProfile?.coordinates) {
            const { lat: userLat, lng: userLng } = userProfile.coordinates;

            // If searching, we strictly restrict to City level (approx 50km) as requested "restricted to registered city implicitly"
            // If NOT searching, we respect the selected tab (geoFilter)
            const activeFilter = searchQuery.trim() ? 'city' : geoFilter;

            if (activeFilter !== 'global') {
                result = result.filter(post => {
                    // Check explict post coordinates
                    if (post.coordinates?.lat && post.coordinates?.lng) {
                        const dist = calculateDistance(userLat, userLng, post.coordinates.lat, post.coordinates.lng);
                        return activeFilter === 'city' ? dist < 50 : dist < 500;
                    }
                    // Check attached invitation
                    if (post.attachedInvitation?.lat && post.attachedInvitation?.lng) {
                        const dist = calculateDistance(userLat, userLng, post.attachedInvitation.lat, post.attachedInvitation.lng);
                        return activeFilter === 'city' ? dist < 50 : dist < 500;
                    }
                    // Check legacy location
                    if (post.location && post.lat && post.lng) {
                        const dist = calculateDistance(userLat, userLng, post.lat, post.lng);
                        return activeFilter === 'city' ? dist < 50 : dist < 500;
                    }
                    return false; // No location = hide in local modes
                });
            }
        }

        return result;
    }, [posts, geoFilter, userProfile, searchQuery]);


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

            {/* Stories Bar */}
            <StoriesBar onStoryClick={setViewingStory} />

            {/* Search Bar MOVED to Filter Bar */}

            {/* Location Filter Tabs (Only show if NOT searching to avoid clutter, or keep them?) 
                 User asked "put only the search box without the city". 
                 Let's HIDE tabs if the user is searching to simplify? 
                 Or maybe hide them entirely if that was the "disaster"? 
                 "Without the city" might mean "without the specific City SELECTOR box".
                 I will keep tabs for now but hide them if searching to focus the view.
             */}
            {/* Combined Control Bar: Filters + Search Toggle */}
            <div style={{
                display: 'flex',
                background: 'var(--bg-card)',
                padding: '4px',
                borderRadius: '16px',
                margin: '0 16px 16px 16px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                position: 'relative',
                zIndex: 40,
                border: '1px solid var(--border-color)',
                alignItems: 'center',
                minHeight: '44px' // Consistent height
            }}>
                {isSearchActive ? (
                    /* --- ACTIVE SEARCH MODE --- */
                    <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', width: '100%' }}>
                        <span style={{ position: 'absolute', left: '10px', opacity: 0.5, fontSize: '0.9rem' }}>🔍</span>
                        <input
                            type="text"
                            autoFocus
                            value={searchQuery}
                            placeholder={t('search_posts', { defaultValue: 'Search...' })}
                            onChange={e => setSearchQuery(e.target.value)}
                            onBlur={() => { if (!searchQuery || searchQuery.trim() === '') setIsSearchActive(false); }}
                            style={{
                                width: '100%',
                                padding: '8px 30px 8px 32px',
                                borderRadius: '12px',
                                border: 'none',
                                background: 'var(--bg-main)',
                                outline: 'none',
                                fontSize: '0.9rem',
                                color: 'var(--text-main)'
                            }}
                        />
                        {/* Clear/Close Button */}
                        <button
                            onClick={() => { setSearchQuery(''); setIsSearchActive(false); }}
                            style={{
                                position: 'absolute', right: '4px',
                                background: 'none', border: 'none',
                                cursor: 'pointer', fontSize: '1.2rem',
                                padding: '0 8px', color: 'var(--text-muted)'
                            }}
                        >
                            &times;
                        </button>
                    </div>
                ) : (
                    /* --- DEFAULT MODE: FILTERS + SEARCH ICON --- */
                    <div style={{ display: 'flex', width: '100%', gap: '4px', alignItems: 'center' }}>
                        {/* Filter Tabs */}
                        {[
                            { id: 'city', label: t('my_city', { defaultValue: 'City' }), icon: '🏙️' },
                            { id: 'country', label: t('my_country', { defaultValue: 'Country' }), icon: '🏳️' },
                            { id: 'global', label: t('global', { defaultValue: 'Global' }), icon: '🌍' }
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setGeoFilter(tab.id)}
                                style={{
                                    flex: 1,
                                    padding: '8px 4px',
                                    borderRadius: '12px',
                                    border: 'none',
                                    background: geoFilter === tab.id ? 'var(--primary)' : 'transparent',
                                    color: geoFilter === tab.id ? 'white' : 'var(--text-muted)',
                                    fontWeight: geoFilter === tab.id ? '800' : '600',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    fontSize: '0.75rem', // Compact font
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
                                    whiteSpace: 'nowrap', // Prevent wrap
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis'
                                }}
                            >
                                <span style={{ fontSize: '1.1em' }}>{tab.icon}</span>
                                <span>{tab.label}</span>
                            </button>
                        ))}

                        {/* Separator */}
                        <div style={{ width: '1px', height: '24px', background: 'var(--border-color)', margin: '0 2px' }}></div>

                        {/* Search Toggle Button */}
                        <button
                            onClick={() => setIsSearchActive(true)}
                            style={{
                                width: '36px',
                                height: '36px',
                                border: 'none',
                                background: 'transparent',
                                cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '1rem',
                                color: 'var(--text-main)',
                                borderRadius: '12px',
                                flexShrink: 0
                            }}
                        >
                            🔍
                        </button>
                    </div>
                )}
            </div>

            {/* Posts List */}
            <div style={{ padding: '0 1rem 1rem 1rem' }}>
                {filteredPosts.length === 0 ? (
                    <div style={{
                        textAlign: 'center',
                        padding: '3rem 1rem',
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '16px',
                        color: 'var(--text-muted)'
                    }}>
                        <p>{
                            searchQuery.trim()
                                ? t('no_local_results', { defaultValue: 'No results found in your city.' })
                                : (geoFilter !== 'global' ? t('no_posts_location', { defaultValue: 'No posts in this area yet.' }) : t('no_posts_yet', { defaultValue: 'No posts yet.' }))
                        }</p>
                        {/* ... Clear/Reset Buttons ... */}
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {filteredPosts.map(post => (
                            <PostCard key={post.id} post={post} showInChat={false} />
                        ))}
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

export default PostsFeed;
