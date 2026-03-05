import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import PostCard from '../components/PostCard';
import StoriesBar from '../components/StoriesBar';
import StoryViewer from '../components/StoryViewer';
import { useTranslation } from 'react-i18next';

const PostsFeed = () => {
    const { t } = useTranslation();
    const { userProfile } = useAuth();
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [viewingStory, setViewingStory] = useState(null);
    const [geoFilter, setGeoFilter] = useState('global');
    const [isSearchActive, setIsSearchActive] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        const q = query(collection(db, 'communityPosts'), orderBy('createdAt', 'asc'));
        const unsub = onSnapshot(q, (snap) => {
            setPosts(snap.docs.map(d => ({ id: d.id, ...d.data() })).reverse());
            setLoading(false);
        }, () => setLoading(false));
        return () => unsub();
    }, []);

    const calculateDistance = (lat1, lon1, lat2, lon2) => {
        const R = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    };

    const filteredPosts = useMemo(() => {
        let result = posts;
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            result = result.filter(p => p.content?.toLowerCase().includes(q) || p.author?.name?.toLowerCase().includes(q));
        }
        if (userProfile?.coordinates && geoFilter !== 'global') {
            const { lat: uLat, lng: uLng } = userProfile.coordinates;
            result = result.filter(p => {
                const pLat = p.coordinates?.lat || p.attachedInvitation?.lat || p.lat;
                const pLng = p.coordinates?.lng || p.attachedInvitation?.lng || p.lng;
                if (!pLat || !pLng) return false;
                const d = calculateDistance(uLat, uLng, pLat, pLng);
                return geoFilter === 'city' ? d < 50 : d < 500;
            });
        }
        return result;
    }, [posts, geoFilter, userProfile, searchQuery]);

    if (loading) {
        return (
            <div style={{ padding: '2rem', textAlign: 'center' }}>
                <div style={{ width: 48, height: 48, border: '4px solid var(--border-color)', borderTop: '4px solid var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 1rem' }} />
                <p style={{ color: 'var(--text-muted)' }}>{t('loading', 'Loading...')}</p>
            </div>
        );
    }

    return (
        <div>
            {/* Stories */}
            <StoriesBar onStoryClick={setViewingStory} />

            {/* Mobile filter bar (hidden on desktop via CSS) */}
            <div className="mobile-filter-bar" style={{ background: 'var(--bg-card)', padding: '4px', borderRadius: '16px', margin: '0 12px 12px', border: '1px solid var(--border-color)', alignItems: 'center', minHeight: '44px' }}>
                {isSearchActive ? (
                    <input
                        type="text" autoFocus value={searchQuery}
                        placeholder={t('search_posts', 'Search...')}
                        onChange={e => setSearchQuery(e.target.value)}
                        onBlur={() => { if (!searchQuery?.trim()) setIsSearchActive(false); }}
                        style={{ flex: 1, padding: '8px 12px', borderRadius: '12px', border: 'none', background: 'var(--bg-input)', outline: 'none', fontSize: '0.9rem', color: 'var(--text-main)' }}
                    />
                ) : (
                    <div style={{ display: 'flex', width: '100%', gap: '4px', alignItems: 'center' }}>
                        {[
                            { id: 'city', label: t('my_city', 'City'), icon: '🏙️' },
                            { id: 'country', label: t('my_country', 'Country'), icon: '🏳️' },
                            { id: 'global', label: t('global', 'Global'), icon: '🌍' }
                        ].map(tab => (
                            <button key={tab.id} onClick={() => setGeoFilter(tab.id)} style={{ flex: 1, padding: '8px 4px', borderRadius: '12px', border: 'none', background: geoFilter === tab.id ? 'var(--primary)' : 'transparent', color: geoFilter === tab.id ? 'white' : 'var(--text-muted)', fontWeight: geoFilter === tab.id ? '800' : '600', cursor: 'pointer', fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                                <span>{tab.icon}</span><span>{tab.label}</span>
                            </button>
                        ))}
                        <div style={{ width: 1, height: 24, background: 'var(--border-color)', margin: '0 2px' }} />
                        <button onClick={() => setIsSearchActive(true)} style={{ width: 36, height: 36, border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '1.1rem', color: 'var(--text-muted)' }}>🔍</button>
                    </div>
                )}
            </div>

            {/* Desktop filter bar — only visible on desktop */}
            <div className="desktop-feed-filters" style={{ gap: '6px', padding: '12px 16px', borderBottom: '1px solid var(--border-color)', alignItems: 'center' }}>
                {[
                    { id: 'city', label: t('my_city', 'City'), icon: '🏙️' },
                    { id: 'country', label: t('my_country', 'Country'), icon: '🏳️' },
                    { id: 'global', label: t('global', 'Global'), icon: '🌍' }
                ].map(tab => (
                    <button key={tab.id} onClick={() => setGeoFilter(tab.id)} style={{ padding: '6px 14px', borderRadius: '9999px', border: 'none', background: geoFilter === tab.id ? 'var(--primary)' : 'transparent', color: geoFilter === tab.id ? 'white' : 'var(--text-muted)', fontWeight: geoFilter === tab.id ? '800' : '600', cursor: 'pointer', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <span>{tab.icon}</span> {tab.label}
                    </button>
                ))}
                <div style={{ marginLeft: 'auto' }}>
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder={t('search_posts', 'Search posts...')}
                        style={{ padding: '6px 14px', borderRadius: '9999px', border: '1px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-main)', fontSize: '0.85rem', outline: 'none', width: '180px' }}
                    />
                </div>
            </div>

            {/* Posts */}
            <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '12px', paddingBottom: '100px' }}>
                {filteredPosts.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
                        {searchQuery.trim() ? t('no_results', 'No results found.') : t('no_posts_yet', 'No posts yet.')}
                    </div>
                ) : (
                    filteredPosts.map(post => <PostCard key={post.id} post={post} showInChat={false} />)
                )}
            </div>

            {viewingStory && <StoryViewer partnerStories={viewingStory} onClose={() => setViewingStory(null)} />}
        </div>
    );
};

export default PostsFeed;
