import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { collection, query, orderBy, onSnapshot, getDocs, limit, where, doc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useLocation, useNavigate } from 'react-router-dom';
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
import useFeedAudienceGraph from '../hooks/useFeedAudienceGraph';
import { authorIdFromPost, buildConsumerHomeFeed } from '../utils/feedSocialGraph';
import { deleteFeedPostCascade, filterOrphanedCommunityPosts } from '../utils/postDeleteCascade';
// Removed redundant FeaturedPostCard. PostCard now natively handles featured_posts when post._isFeatured is true.

const PostsFeed = () => {
    const { t } = useTranslation();
    const location = useLocation();
    const navigate = useNavigate();
    const { userProfile, currentUser } = useAuth();
    const menuRef = useRef({});
    const composerRef = useRef(null);
    const [composerInvitation, setComposerInvitation] = useState(null);

    useEffect(() => {
        const inv = location.state?.attachedInvitation;
        if (!inv?.id) return;
        setComposerInvitation(inv);
        navigate(location.pathname, { replace: true, state: {} });
        if (location.state?.scrollToComposer) {
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
    const { graph: audienceGraph } = useFeedAudienceGraph(currentUser, userProfile);
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
        const featured = featuredPosts.find((p) => p.id === id);
        if (featured) {
            await deleteFeedPostCascade(featured);
        } else {
            await deleteDoc(doc(db, 'featured_posts', id));
        }
        setConfirmDeleteId(null);
    }, [featuredPosts]);

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

    /** Social ranking + followed businesses in main feed; discover strip for other businesses. */
    const { mainFeed, discoverFeed } = useMemo(() => {
        const blocked = new Set(asUidArray(userProfile?.blockedUserIds));
        const featured = featuredPosts.map((p) => ({ ...p, _isFeatured: true, _isMotionPost: false }));
        const pool = [...featured, ...communityFeedPosts, ...motionFeedPosts];
        return buildConsumerHomeFeed(pool, audienceGraph, currentUser?.uid, { blockedSet: blocked });
    }, [
        featuredPosts,
        communityFeedPosts,
        motionFeedPosts,
        userProfile?.blockedUserIds,
        audienceGraph,
        currentUser?.uid,
    ]);

    const hasFeedItems = mainFeed.length > 0 || discoverFeed.length > 0;

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
                    <div style={{ display: 'flex', width: '100%', justifyContent: 'flex-end', alignItems: 'center' }}>
                        <button
                            type="button"
                            onClick={() => setIsSearchActive(true)}
                            style={{
                                width: 36,
                                height: 36,
                                border: 'none',
                                background: 'transparent',
                                cursor: 'pointer',
                                fontSize: '1.1rem',
                                color: 'var(--text-muted)',
                            }}
                            aria-label={t('search_posts', 'Search posts')}
                        >
                            🔍
                        </button>
                    </div>
                )}
            </div>

            {/* Desktop filter bar — only visible on desktop */}
            <div
                className="desktop-feed-filters"
                style={{
                    gap: '6px',
                    padding: '12px 16px',
                    borderBottom: '1px solid var(--border-color)',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                }}
            >
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={t('search_posts', 'Search posts...')}
                    style={{
                        padding: '6px 14px',
                        borderRadius: '9999px',
                        border: '1px solid var(--border-color)',
                        background: 'var(--bg-input)',
                        color: 'var(--text-main)',
                        fontSize: '0.85rem',
                        outline: 'none',
                        width: 'min(280px, 100%)',
                    }}
                />
            </div>

            {/* Unified Feed — featured + regular merged by date */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', paddingBottom: '100px', maxWidth: '100%', width: '100%', margin: 0, paddingTop: '12px' }}>
                
                {/* Real Inline Post Creator */}
                <div ref={composerRef} className="inline-post-editor-anchor">
                    <InlinePostEditor
                        attachedInvitation={composerInvitation}
                        onClearAttachedInvitation={() => setComposerInvitation(null)}
                    />
                </div>

                {!hasFeedItems ? (
                    <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
                        {searchQuery.trim() ? t('no_results', 'No results found.') : t('no_posts_yet', 'No posts yet.')}
                    </div>
                ) : (
                    <>
                        {mainFeed.map((post) => renderFeedPost(post)).filter(Boolean)}
                        {discoverFeed.length > 0 ? (
                            <section
                                className="feed-discover-business"
                                aria-label={t('feed_discover_business', 'Discover businesses')}
                                style={{ marginTop: mainFeed.length ? 8 : 0 }}
                            >
                                <header
                                    style={{
                                        padding: '8px 16px 4px',
                                        borderTop: mainFeed.length
                                            ? '1px solid var(--border-color)'
                                            : 'none',
                                    }}
                                >
                                    <h2
                                        style={{
                                            margin: 0,
                                            fontSize: '0.95rem',
                                            fontWeight: 800,
                                            color: 'var(--text-main)',
                                        }}
                                    >
                                        {t('feed_discover_business', 'Discover businesses')}
                                    </h2>
                                    <p
                                        style={{
                                            margin: '4px 0 0',
                                            fontSize: '0.8rem',
                                            color: 'var(--text-muted)',
                                        }}
                                    >
                                        {t(
                                            'feed_discover_business_sub',
                                            'Recent updates from places you may want to follow'
                                        )}
                                    </p>
                                </header>
                                {discoverFeed.map((post) => renderFeedPost(post)).filter(Boolean)}
                            </section>
                        ) : null}
                    </>
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
