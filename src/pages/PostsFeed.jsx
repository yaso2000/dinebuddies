import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { collection, query, orderBy, onSnapshot, getDocs, limit, where, doc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import PostCard from '../components/PostCard';
import MotionPostFeedCard from '../components/MotionPostFeedCard';
import StoriesBar from '../components/StoriesBar';
import StoryViewer from '../components/StoryViewer';
import FeaturedPostSlideCard from '../components/FeaturedPostSlideCard';
import { normalizeFeaturedPostDoc } from '../services/featuredPostService';
import InlinePostEditor from '../components/InlinePostEditor';
import { AiOutlineHeart, AiFillHeart } from 'react-icons/ai';
import { FaRegCommentDots } from 'react-icons/fa';
import { IoShareSocialOutline } from 'react-icons/io5';
import { getSafeAvatar } from '../utils/avatarUtils';
import { createNotification } from '../utils/notificationHelpers';
import { useTranslation } from 'react-i18next';
import { asUidArray } from '../utils/userSocialLists';
import { authorIdFromPost, buildConsumerHomeFeed } from '../utils/feedSocialGraph';
import { deleteFeedPostCascade, filterOrphanedCommunityPosts } from '../utils/postDeleteCascade';
import {
    buildFollowingAuthorSet,
    filterPostsByFeedScope,
    normalizePlaceLabel,
} from '../utils/postsFeedScope';
// Removed redundant FeaturedPostCard. PostCard now natively handles featured_posts when post._isFeatured is true.

const PostsFeed = () => {
    const { t } = useTranslation();
    const location = useLocation();
    const navigate = useNavigate();
    const { userProfile, currentUser, isGuest } = useAuth();
    const menuRef = useRef({});
    const composerRef = useRef(null);
    const [composerInvitation, setComposerInvitation] = useState(null);
    const [composerAiImage, setComposerAiImage] = useState(null);

    useEffect(() => {
        const inv = location.state?.attachedInvitation;
        const aiStudioImage = location.state?.aiStudioImage;
        const scrollToComposer = location.state?.scrollToComposer;

        if (inv?.id) {
            setComposerInvitation(inv);
        }
        if (aiStudioImage) {
            setComposerAiImage(aiStudioImage);
        }

        if (inv?.id || aiStudioImage) {
            navigate(location.pathname, { replace: true, state: {} });
        }

        if (scrollToComposer) {
            requestAnimationFrame(() => {
                composerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
        }
    }, [location.state, location.pathname, navigate]);
    const [posts, setPosts] = useState([]);
    const [motionPosts, setMotionPosts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [viewingStory, setViewingStory] = useState(null);
    const [isSearchActive, setIsSearchActive] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    /** @type {'global' | 'local'} */
    const [feedGeoScope, setFeedGeoScope] = useState('global');
    /** @type {'all' | 'following'} */
    const [feedAudienceScope, setFeedAudienceScope] = useState('all');
    const [userLocation, setUserLocation] = useState(null);

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
        const featured = featuredPosts.find((p) => p.id === id);
        if (featured) {
            await deleteFeedPostCascade(featured);
        } else {
            await deleteDoc(doc(db, 'featured_posts', id));
        }
        setConfirmDeleteId(null);
    }, [featuredPosts]);

    useEffect(() => {
        if (!navigator.geolocation) return;
        navigator.geolocation.getCurrentPosition(
            (position) => {
                setUserLocation({
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                });
            },
            () => setUserLocation(null)
        );
    }, []);

    const geoScopeFilters = useMemo(
        () => [
            { id: 'global', label: t('feed_scope_global', t('global', 'Global')), icon: '🌍' },
            { id: 'local', label: t('feed_scope_local', t('in_my_city', 'My city')), icon: '🏙️' },
        ],
        [t]
    );

    const audienceScopeFilters = useMemo(
        () => [
            { id: 'all', label: t('feed_scope_all_users', 'Everyone'), icon: '👥' },
            { id: 'following', label: t('feed_scope_following', t('following', 'Following')), icon: '✓' },
        ],
        [t]
    );

    const followingAuthorIds = useMemo(
        () => buildFollowingAuthorSet(currentUser, userProfile),
        [currentUser?.following, userProfile?.following]
    );

    const userCityNorm = useMemo(
        () => normalizePlaceLabel(userProfile?.city),
        [userProfile?.city]
    );

    const userCountryNorm = useMemo(
        () => normalizePlaceLabel(userProfile?.country),
        [userProfile?.country]
    );

    const hasFeedScopeFilters =
        feedGeoScope !== 'global' || feedAudienceScope !== 'all';

    const renderFeedScopeChips = () => (
        <div
            className="posts-feed-scope-chips"
            role="group"
            aria-label={`${t('feed_scope_geo_aria', 'Area')}, ${t('feed_scope_audience_aria', 'People')}`}
        >
            {geoScopeFilters.map((f) => (
                <button
                    key={f.id}
                    type="button"
                    className={`home-geo-chip home-geo-chip--compact${feedGeoScope === f.id ? ' home-geo-chip--active' : ''}`}
                    onClick={() => setFeedGeoScope(f.id)}
                >
                    <span className="home-geo-chip__icon" aria-hidden>
                        {f.icon}
                    </span>
                    <span>{f.label}</span>
                </button>
            ))}
            <span className="posts-feed-scope-chips__divider" aria-hidden />
            {audienceScopeFilters.map((f) => (
                <button
                    key={f.id}
                    type="button"
                    className={`home-geo-chip home-geo-chip--compact${feedAudienceScope === f.id ? ' home-geo-chip--active' : ''}`}
                    onClick={() => setFeedAudienceScope(f.id)}
                >
                    <span className="home-geo-chip__icon" aria-hidden>
                        {f.icon}
                    </span>
                    <span>{f.label}</span>
                </button>
            ))}
        </div>
    );

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

    /** Published studio posts not yet mirrored to communityPosts (legacy publishes). */
    useEffect(() => {
        const q = query(
            collection(db, 'business_motion_posts'),
            where('status', '==', 'published'),
            orderBy('publishedAt', 'desc'),
            limit(40)
        );
        const unsub = onSnapshot(
            q,
            (snap) => {
                setMotionPosts(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
            },
            (err) => console.error('[PostsFeed] business_motion_posts error:', err)
        );
        return () => unsub();
    }, []);

    // Fetch elite featured posts with live updates so likes/reposts refresh
    useEffect(() => {
        let unsub;
        const load = async () => {
            try {
                const q = query(
                    collection(db, 'featured_posts'),
                    orderBy('createdAt', 'desc'),
                    limit(50)
                );
                unsub = onSnapshot(q, (snap) => {
                    const fp = snap.docs
                        .map((d) => normalizeFeaturedPostDoc(d.id, d.data()))
                        .filter((p) => p.status === 'published' || !p.status);
                    setFeaturedPosts(fp);
                }, err => console.error('[PostsFeed] featured_posts error:', err));
            } catch (e) {
                console.error('[PostsFeed] featured_posts load error:', e);
            }
        };
        load();
        return () => unsub?.();
    }, []);

    const publishedFeaturedIds = useMemo(
        () => new Set(featuredPosts.map((p) => String(p.id))),
        [featuredPosts]
    );

    const publishedMotionIds = useMemo(
        () => new Set(motionPosts.map((m) => String(m.id))),
        [motionPosts]
    );

    const filteredPosts = useMemo(() => {
        const blocked = new Set(asUidArray(userProfile?.blockedUserIds));
        let result = posts.filter((p) => p.status !== 'draft');
        result = filterOrphanedCommunityPosts(result, publishedFeaturedIds, publishedMotionIds);
        if (blocked.size > 0) {
            result = result.filter((p) => {
                const aid = authorIdFromPost(p);
                return !aid || !blocked.has(aid);
            });
        }
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            result = result.filter(
                (p) =>
                    p.content?.toLowerCase().includes(q) ||
                    p.author?.name?.toLowerCase().includes(q)
            );
        }
        return result;
    }, [posts, searchQuery, userProfile?.blockedUserIds, publishedFeaturedIds, publishedMotionIds]);

    const motionFeedPosts = useMemo(() => {
        const blocked = new Set(asUidArray(userProfile?.blockedUserIds));
        const mirroredIds = new Set(
            posts.filter((p) => p.motionPostId).map((p) => String(p.motionPostId))
        );

        return motionPosts
            .filter((m) => !mirroredIds.has(m.id))
            .filter((m) => !m.ownerId || !blocked.has(m.ownerId))
            .map((m) => ({
                id: `motion_${m.id}`,
                type: 'motion_post',
                motionPostId: m.id,
                authorId: m.ownerId,
                businessId: m.businessId,
                author: {
                    id: m.ownerId,
                    name: m.feedAuthorName || m._feedAuthorName,
                    avatar: m.feedAuthorAvatar || m._feedAuthorAvatar,
                },
                content: String(
                    (m.content && typeof m.content === 'object' && m.content.title) ||
                        (m.content && typeof m.content === 'object' && m.content.description) ||
                        ''
                ),
                publishedAt: m.publishedAt,
                updatedAt: m.updatedAt,
                createdAt: m.createdAt || m.publishedAt,
                motionPostSnapshot: m,
                _isMotionPost: true,
            }));
    }, [motionPosts, posts, userProfile?.blockedUserIds]);

    const motionPostById = useMemo(() => {
        const map = new Map();
        for (const m of motionPosts) {
            map.set(String(m.id), m);
        }
        return map;
    }, [motionPosts]);

    const communityFeedPosts = useMemo(() => {
        const blocked = new Set(asUidArray(userProfile?.blockedUserIds));
        return filteredPosts
            .map((p) => {
                const motionId = p.motionPostId ? String(p.motionPostId) : null;
                const motionSource = motionId ? motionPostById.get(motionId) : null;
                const hydrated =
                    motionSource && (!p.motionPostSnapshot || !p.studioEditor)
                        ? {
                              ...p,
                              type: 'motion_post',
                              motionPostSnapshot: p.motionPostSnapshot || motionSource,
                              studioEditor: p.studioEditor || motionSource.studioEditor,
                          }
                        : p;

                const isFeaturedMirror =
                    Boolean(p.featuredPostId) ||
                    p.type === 'elite_slide' ||
                    p.source === 'featured_post';

                if (isFeaturedMirror) {
                    const fpId = p.featuredPostId ? String(p.featuredPostId) : null;
                    const snap =
                        p.featuredPostSnapshot && typeof p.featuredPostSnapshot === 'object'
                            ? p.featuredPostSnapshot
                            : {};
                    return {
                        ...hydrated,
                        ...snap,
                        type: 'elite_slide',
                        featuredPostId: fpId,
                        partnerId: hydrated.partnerId || p.partnerId,
                        businessName: hydrated.businessName || p.businessName || snap.businessName,
                        businessLogoUrl:
                            hydrated.businessLogoUrl || p.businessLogoUrl || snap.businessLogoUrl,
                        _isFeatured: true,
                        _isMotionPost: false,
                    };
                }

                const isStudioFeed =
                    hydrated.type === 'motion_post' ||
                    hydrated.motionPostId ||
                    hydrated.motionPostSnapshot ||
                    (hydrated.source === 'smart_post_studio' && hydrated.mediaUrl);
                if (!isStudioFeed) {
                    return { ...hydrated, _isFeatured: false, _isMotionPost: false };
                }
                return {
                    ...hydrated,
                    type: 'motion_post',
                    _isFeatured: false,
                    _isMotionPost: true,
                    id: hydrated.id,
                    motionPostId: hydrated.motionPostId || motionSource?.id,
                };
            })
            .filter((p) => {
                const aid = authorIdFromPost(p);
                return !aid || !blocked.has(aid);
            });
    }, [filteredPosts, motionPostById, userProfile?.blockedUserIds]);

    /** All post types merged and sorted by publish date (newest first). */
    const feedPosts = useMemo(() => {
        const blocked = new Set(asUidArray(userProfile?.blockedUserIds));
        const featured = featuredPosts.map((p) => ({ ...p, _isFeatured: true, _isMotionPost: false }));
        const pool = [...featured, ...communityFeedPosts, ...motionFeedPosts];
        const merged = buildConsumerHomeFeed(pool, null, currentUser?.uid, { blockedSet: blocked }).mainFeed;
        return filterPostsByFeedScope(merged, {
            geoScope: feedGeoScope,
            audienceScope: feedAudienceScope,
            userLocation,
            userCityNorm,
            userCountryNorm,
            followingSet: followingAuthorIds,
            viewerUid: currentUser?.uid,
        });
    }, [
        featuredPosts,
        communityFeedPosts,
        motionFeedPosts,
        userProfile?.blockedUserIds,
        currentUser?.uid,
        feedGeoScope,
        feedAudienceScope,
        userLocation,
        userCityNorm,
        userCountryNorm,
        followingAuthorIds,
    ]);

    const hasFeedItems = feedPosts.length > 0;

    const communityPostIdByMotionId = useMemo(() => {
        const map = new Map();
        for (const p of posts) {
            if (p.motionPostId) map.set(String(p.motionPostId), p.id);
        }
        return map;
    }, [posts]);

    const renderFeedPost = (post) => {
        const isMotion =
            post._isMotionPost ||
            post.type === 'motion_post' ||
            post.motionPostId ||
            post.motionPostSnapshot ||
            (post.source === 'smart_post_studio' && post.mediaUrl);
        if (isMotion) {
            if (!String(post.id).startsWith('motion_')) {
                return <PostCard key={post.id} post={post} showInChat={false} />;
            }
            try {
                const motionDoc = post.motionPostSnapshot
                    ? { id: post.motionPostId || post.id, ...post.motionPostSnapshot }
                    : post;
                const cardPost = {
                    ...motionDoc,
                    _feedAuthorName: post.author?.name || motionDoc.feedAuthorName,
                    _feedAuthorAvatar: post.author?.avatar || motionDoc.feedAuthorAvatar,
                    publishedAt: post.publishedAt || motionDoc.publishedAt,
                    updatedAt: post.updatedAt || motionDoc.updatedAt,
                    businessId: post.businessId || motionDoc.businessId,
                };
                const motionId = post.motionPostId || String(post.id).replace(/^motion_/, '');
                return (
                    <MotionPostFeedCard
                        key={post.id}
                        post={cardPost}
                        communityPostId={communityPostIdByMotionId.get(motionId) || null}
                    />
                );
            } catch (err) {
                console.error('[PostsFeed] motion card render failed', post?.id, err);
                return null;
            }
        }
        return <PostCard key={post.id} post={post} showInChat={false} />;
    };

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
            <div className="mobile-filter-bar posts-feed-scope-bar">
                {isSearchActive ? (
                    <div className="posts-feed-scope-search-row">
                        <input
                            type="text"
                            autoFocus
                            value={searchQuery}
                            placeholder={t('search_posts', 'Search...')}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onBlur={() => {
                                if (!searchQuery?.trim()) setIsSearchActive(false);
                            }}
                            className="posts-feed-scope-search-input"
                        />
                        <button
                            type="button"
                            className="posts-feed-scope-icon-btn"
                            onClick={() => {
                                setSearchQuery('');
                                setIsSearchActive(false);
                            }}
                            aria-label={t('close_search', 'Close search')}
                        >
                            ✕
                        </button>
                    </div>
                ) : null}
                <div className="posts-feed-scope-toolbar">
                    {renderFeedScopeChips()}
                    {!isSearchActive && (
                        <button
                            type="button"
                            className="posts-feed-scope-icon-btn"
                            onClick={() => setIsSearchActive(true)}
                            aria-label={t('search_posts', 'Search posts')}
                        >
                            🔍
                        </button>
                    )}
                </div>
            </div>

            {/* Desktop filter bar — only visible on desktop */}
            <div className="desktop-feed-filters posts-feed-scope-bar posts-feed-scope-bar--desktop">
                <input
                    type="text"
                    className="posts-feed-scope-search-input posts-feed-scope-search-input--desktop"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={t('search_posts', 'Search posts...')}
                />
                {renderFeedScopeChips()}
            </div>

            {/* Unified Feed — featured + regular merged by date */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', paddingBottom: '100px', maxWidth: '100%', width: '100%', margin: 0, paddingTop: '12px' }}>
                
                {/* Post composer — guests must sign in first */}
                {isGuest ? (
                    <div
                        ref={composerRef}
                        className="inline-post-editor-anchor"
                        style={{
                            padding: '16px',
                            borderRadius: '16px',
                            border: '1px solid var(--border-color)',
                            background: 'var(--bg-card)',
                            textAlign: 'center',
                        }}
                    >
                        <p style={{ margin: '0 0 12px', color: 'var(--text-muted)', fontSize: '0.92rem' }}>
                            {t('guest_post_prompt', 'Sign in to share a post with the community.')}
                        </p>
                        <Link
                            to="/login?next=%2Fposts-feed"
                            className="ui-btn ui-btn--primary"
                            style={{ display: 'inline-block', textDecoration: 'none' }}
                        >
                            {t('login_signup', 'Login / Sign Up')}
                        </Link>
                    </div>
                ) : (
                    <div ref={composerRef} className="inline-post-editor-anchor">
                        <InlinePostEditor
                            attachedInvitation={composerInvitation}
                            onClearAttachedInvitation={() => setComposerInvitation(null)}
                            initialAiStudioImage={composerAiImage}
                            onClearInitialAiStudioImage={() => setComposerAiImage(null)}
                        />
                    </div>
                )}

                {!hasFeedItems ? (
                    <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
                        {searchQuery.trim() || hasFeedScopeFilters ? (
                            <>
                                <p style={{ margin: '0 0 12px' }}>{t('no_results', 'No results found.')}</p>
                                {(hasFeedScopeFilters || searchQuery.trim()) && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSearchQuery('');
                                            setFeedGeoScope('global');
                                            setFeedAudienceScope('all');
                                        }}
                                        style={{
                                            padding: '8px 16px',
                                            borderRadius: '12px',
                                            border: '1px solid var(--primary)',
                                            background: 'transparent',
                                            color: 'var(--primary)',
                                            fontWeight: 600,
                                            cursor: 'pointer',
                                        }}
                                    >
                                        {t('try_different_filters', 'Try different filters')}
                                    </button>
                                )}
                            </>
                        ) : (
                            t('no_posts_yet', 'No posts yet.')
                        )}
                    </div>
                ) : (
                    feedPosts.map((post) => renderFeedPost(post)).filter(Boolean)
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
