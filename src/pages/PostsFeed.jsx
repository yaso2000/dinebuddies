import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { collection, query, orderBy, onSnapshot, getDocs, limit, doc, updateDoc, deleteDoc, arrayUnion, arrayRemove, serverTimestamp, addDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useNavigate } from 'react-router-dom';
import PostCard from '../components/PostCard';
import StoriesBar from '../components/StoriesBar';
import StoryViewer from '../components/StoryViewer';
import FeaturedPostSlideCard from '../components/FeaturedPostSlideCard';
import InlinePostEditor from '../components/InlinePostEditor';
import { AiOutlineHeart, AiFillHeart } from 'react-icons/ai';
import { FaRegCommentDots } from 'react-icons/fa';
import { IoShareSocialOutline } from 'react-icons/io5';
import { getSafeAvatar } from '../utils/avatarUtils';
import { createNotification } from '../utils/notificationHelpers';
import { useTranslation } from 'react-i18next';
import { asUidArray } from '../utils/userSocialLists';

// Removed redundant FeaturedPostCard. PostCard now natively handles featured_posts when post._isFeatured is true.

const PostsFeed = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { userProfile, currentUser } = useAuth();
    const menuRef = useRef({});
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [viewingStory, setViewingStory] = useState(null);
    const [geoFilter, setGeoFilter] = useState('local');
    const [isSearchActive, setIsSearchActive] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // Featured posts (elite slides from business partners)
    const [featuredPosts, setFeaturedPosts] = useState([]);
    const [openMenuId, setOpenMenuId] = useState(null);
    const [confirmDeleteId, setConfirmDeleteId] = useState(null);

    const toggleMenu = useCallback((id) => setOpenMenuId(prev => prev === id ? null : id), []);

    const hidePost = useCallback(async (post) => {
        const newStatus = post.status === 'draft' ? 'published' : 'draft';
        await updateDoc(doc(db, 'featured_posts', post.id), { status: newStatus, updatedAt: serverTimestamp() });
        setOpenMenuId(null);
    }, []);

    const deletePost = useCallback(async (id) => {
        await deleteDoc(doc(db, 'featured_posts', id));
        setConfirmDeleteId(null);
    }, []);

    // Close menu on outside click
    useEffect(() => {
        const handler = (e) => {
            const isInsideAny = Object.values(menuRef.current).some(el => el && el.contains(e.target));
            if (!isInsideAny) setOpenMenuId(null);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    useEffect(() => {
        const q = query(collection(db, 'communityPosts'), orderBy('createdAt', 'asc'));
        const unsub = onSnapshot(q, (snap) => {
            setPosts(snap.docs.map(d => ({ id: d.id, ...d.data() })).reverse());
            setLoading(false);
        }, () => setLoading(false));
        return () => unsub();
    }, []);

    // Fetch elite featured posts with live updates so likes/reposts refresh
    useEffect(() => {
        let unsub;
        const load = async () => {
            try {
                const q = query(
                    collection(db, 'featured_posts'),
                    limit(20)
                );
                unsub = onSnapshot(q, (snap) => {
                    const fp = snap.docs
                        .map(d => ({ id: d.id, ...d.data(), _isFeatured: true }))
                        .filter(p => (!p.type || p.type === 'elite_slide') && (p.status === 'published' || !p.status));
                    setFeaturedPosts(fp);
                }, err => console.error('[PostsFeed] featured_posts error:', err));
            } catch (e) {
                console.error('[PostsFeed] featured_posts load error:', e);
            }
        };
        load();
        return () => unsub?.();
    }, []);

    const calculateDistance = (lat1, lon1, lat2, lon2) => {
        const R = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    };

    const filteredPosts = useMemo(() => {
        const norm = (v) => String(v || '').trim().toLowerCase();
        const userCountry = norm(userProfile?.country);
        const userCountryCode = norm(userProfile?.countryCode);
        const userCity = norm(userProfile?.city);
        const userCoords = userProfile?.coordinates;

        const canViewLocalPost = (p) => {
            if (p.authorId === currentUser?.uid) return true;
            if (!userProfile) return false;

            const pCountry = norm(p.country);
            const pCountryCode = norm(p.countryCode);
            const pCity = norm(p.city);
            const sameCountry =
                (userCountry && pCountry && userCountry === pCountry) ||
                (userCountryCode && pCountryCode && userCountryCode === pCountryCode);

            const pLat = p.coordinates?.lat || p.attachedInvitation?.lat || p.lat;
            const pLng = p.coordinates?.lng || p.attachedInvitation?.lng || p.lng;
            const hasCoords = userCoords?.lat != null && userCoords?.lng != null && pLat != null && pLng != null;
            const radiusKm = 500;
            const nearEnough = hasCoords
                ? calculateDistance(userCoords.lat, userCoords.lng, pLat, pLng) < radiusKm
                : false;
            const sameCity = Boolean(userCity && pCity && userCity === pCity);

            return sameCountry || sameCity || nearEnough;
        };

        const blocked = new Set(asUidArray(userProfile?.blockedUserIds));
        let result = posts.filter(p => p.status !== 'draft');
        if (blocked.size > 0) {
            result = result.filter((p) => !p.authorId || !blocked.has(p.authorId));
        }

        // Scope-aware visibility:
        // - global posts are visible to everyone
        // - local posts are visible only within matching local audience
        result = result.filter((p) => {
            const scope = (p.visibilityScope || 'local').toLowerCase();
            if (geoFilter === 'global') {
                // Global tab is a broad feed: includes both global and local posts
                return scope === 'global' || canViewLocalPost(p);
            }
            // Local tab: local audience posts only
            if (scope === 'global') return false;
            return canViewLocalPost(p);
        });

        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            result = result.filter(p => p.content?.toLowerCase().includes(q) || p.author?.name?.toLowerCase().includes(q));
        }
        if (userProfile?.coordinates && geoFilter === 'local') {
            const { lat: uLat, lng: uLng } = userProfile.coordinates;
            result = result.filter(p => {
                // Bypass distance filter for events so they are visible everywhere
                if (p.type === 'event') return true;

                const pLat = p.coordinates?.lat || p.attachedInvitation?.lat || p.lat;
                const pLng = p.coordinates?.lng || p.attachedInvitation?.lng || p.lng;
                if (!pLat || !pLng) return false;
                const d = calculateDistance(uLat, uLng, pLat, pLng);
                return d < 500;
            });
        }
        return result;
    }, [posts, geoFilter, userProfile, searchQuery, userProfile?.blockedUserIds]);

    // Helper: extract a comparable timestamp number from any post
    const getTimestamp = (p) => {
        const ts = p.publishedAt || p.updatedAt || p.createdAt;
        if (!ts) return 0;
        return typeof ts.toDate === 'function' ? ts.toDate().getTime() : new Date(ts).getTime();
    };

    // Merge featured + regular posts into one feed sorted newest-first
    const mergedFeed = useMemo(() => {
        const blocked = new Set(asUidArray(userProfile?.blockedUserIds));
        const featured = featuredPosts
            .map(p => ({ ...p, _isFeatured: true }))
            .filter((p) => !p.authorId || !blocked.has(p.authorId));
        return [
            ...featured,
            ...filteredPosts.map(p => ({ ...p, _isFeatured: false }))
        ].sort((a, b) => getTimestamp(b) - getTimestamp(a));
    }, [featuredPosts, filteredPosts, userProfile?.blockedUserIds]);

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
                    <div style={{ display: 'flex', width: '100%', alignItems: 'center', gap: '6px' }}>
                        <input
                            type="text" autoFocus value={searchQuery}
                            placeholder={t('search_posts', 'Search...')}
                            onChange={e => setSearchQuery(e.target.value)}
                            onBlur={() => { if (!searchQuery?.trim()) setIsSearchActive(false); }}
                            style={{ flex: 1, padding: '8px 12px', borderRadius: '12px', border: 'none', background: 'var(--bg-input)', outline: 'none', fontSize: '0.9rem', color: 'var(--text-main)' }}
                        />
                        <button
                            onClick={() => {
                                setSearchQuery('');
                                setIsSearchActive(false);
                            }}
                            aria-label={t('close_search', 'Close search')}
                            style={{
                                width: 36,
                                height: 36,
                                border: 'none',
                                borderRadius: '10px',
                                background: 'transparent',
                                cursor: 'pointer',
                                fontSize: '1.05rem',
                                color: 'var(--text-muted)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}
                        >
                            ✕
                        </button>
                    </div>
                ) : (
                    <div style={{ display: 'flex', width: '100%', gap: '4px', alignItems: 'center' }}>
                        {[
                            { id: 'local', label: t('post_scope_local', 'Local'), icon: '📍' },
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
                    { id: 'local', label: t('post_scope_local', 'Local'), icon: '📍' },
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

            {/* Unified Feed — featured + regular merged by date */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', paddingBottom: '100px', maxWidth: '100%', width: '100%', margin: 0, paddingTop: '12px' }}>
                
                {/* Real Inline Post Creator */}
                <InlinePostEditor />

                {mergedFeed.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
                        {searchQuery.trim() ? t('no_results', 'No results found.') : t('no_posts_yet', 'No posts yet.')}
                    </div>
                ) : (
                    mergedFeed.map((post, idx) => (
                        <PostCard key={post.id} post={post} showInChat={false} />
                    ))
                )}
            </div>

            {viewingStory && <StoryViewer partnerStories={viewingStory} onClose={() => setViewingStory(null)} />}

            {/* Delete confirmation modal */}
            {confirmDeleteId && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 24 }}>
                    <div style={{ background: 'var(--bg-card)', borderRadius: 16, padding: 28, maxWidth: 360, width: '100%', border: '1px solid var(--border-color)', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>
                        <div style={{ fontSize: '1.5rem', textAlign: 'center', marginBottom: 10 }}>🗑️</div>
                        <h3 style={{ margin: '0 0 8px', textAlign: 'center', fontSize: '1rem' }}>Delete this post?</h3>
                        <p style={{ margin: '0 0 20px', textAlign: 'center', fontSize: '0.82rem', color: 'var(--text-muted)' }}>This action is permanent and cannot be undone.</p>
                        <div style={{ display: 'flex', gap: 10 }}>
                            <button onClick={() => setConfirmDeleteId(null)} style={{ flex: 1, padding: 10, borderRadius: 10, border: '1px solid var(--border-color)', background: 'transparent', cursor: 'pointer', fontWeight: 600, color: 'var(--text-muted)' }}>Cancel</button>
                            <button onClick={() => deletePost(confirmDeleteId)} style={{ flex: 1, padding: 10, borderRadius: 10, border: 'none', background: '#ef4444', color: '#fff', cursor: 'pointer', fontWeight: 700 }}>Delete</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PostsFeed;
