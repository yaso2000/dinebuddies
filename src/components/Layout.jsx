import React, { useState, useEffect, useMemo, useRef, Suspense } from 'react';
import { useNavigate, Link, useLocation, Outlet, Navigate } from 'react-router-dom';
import { FaHome, FaPlusCircle, FaBell, FaStore, FaUsers, FaComments, FaCrown, FaCog, FaEnvelope, FaUser, FaClock, FaFire, FaSearch, FaSignInAlt, FaStar, FaTimes, FaLock, FaHeart } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';
import { useInvitations } from '../context/InvitationContext';
import { useChat } from '../context/ChatContext';
import { useNotifications } from '../context/NotificationContext';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import ProfileCompletionModal from './ProfileCompletionModal';
import UnpublishedBusinessReminder from './UnpublishedBusinessReminder';
import EmailVerificationBusinessBanner from './EmailVerificationBusinessBanner';
import { getSafeAvatar } from '../utils/avatarUtils';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import AppRouteLoading from './AppRouteLoading';
import RankingSidebarWidget from './RankingSidebarWidget';
import { isBusinessUser } from '../utils/accountRole';
import { needsEmailPasswordVerification, needsConsumerEmailVerification } from '../utils/emailVerification';
import { goToLogin } from '../utils/goToLogin';
import { isAdminIdentity } from '../utils/adminAccess';
import { useToast } from '../context/ToastContext';
import { attachIosAppHeaderViewportOffset } from '../utils/iosAppHeaderVisualViewport';
import { attachMobileBottomNavKeyboardGuard } from '../utils/mobileBottomNavKeyboardGuard';
import { refreshFcmIfUserOptedIn } from '../services/notificationService';
import { appLogoForChrome } from '../config/appLogo';
const Layout = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { t, i18n } = useTranslation();
    const { currentUser, userProfile, isGuest, isBusiness, loading } = useAuth();
    const invContext = useInvitations();
    const { invitations = [], restaurants = [], getFollowingInvitations = () => [], canCreatePrivateInvitation } = invContext || {};
    const { showToast } = useToast();
    const { unreadCount: chatUnreadCount, conversations = [] } = useChat();
    const { unreadCount, unreadBellCount = 0, unreadMessageCount = 0, markMessageNotificationsAsRead } = useNotifications();
    
    // Total unread messages (from direct chats + push notifications for other chats)
    const totalChatUnread = chatUnreadCount + unreadMessageCount;
    const { themeMode } = useTheme();

    const [inviteCreateOpen, setInviteCreateOpen] = useState(false);

    const openInviteCreate = () => {
        setInviteCreateOpen(true);
    };

    const closeInviteCreate = () => {
        setInviteCreateOpen(false);
    };

    const finishInviteCreateManual = (kind) => {
        if (kind === 'public') {
            navigate('/create');
            closeInviteCreate();
            return;
        }
        if (kind === 'private') {
            const q = canCreatePrivateInvitation?.('private');
            if (q && !q.canCreate) {
                showToast(
                    t(
                        'insufficient_dine_credits_wallet',
                        'Not enough Dine Credits. Open Settings → Dine Credits to top up.'
                    ),
                    'error'
                );
                navigate('/settings/credits');
                closeInviteCreate();
                return;
            }
            navigate('/create-private');
            closeInviteCreate();
            return;
        }
        if (kind === 'dating') {
            const q = canCreatePrivateInvitation?.('dating');
            if (q && !q.canCreate) {
                showToast(
                    t(
                        'insufficient_dine_credits_wallet',
                        'Not enough Dine Credits. Open Settings → Dine Credits to top up.'
                    ),
                    'error'
                );
                navigate('/settings/credits');
                closeInviteCreate();
                return;
            }
            navigate('/create-dating');
            closeInviteCreate();
        }
    };

    useEffect(() => {
        if (!inviteCreateOpen) return;
        const onKey = (e) => {
            if (e.key === 'Escape') {
                setInviteCreateOpen(false);
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [inviteCreateOpen]);

    // iOS: keep fixed app header aligned with the visual viewport when the keyboard opens (feed, comments, etc.)
    useEffect(() => {
        const path = location.pathname;
        const isChatLike =
            path.startsWith('/chat/') ||
            path === '/messages' ||
            path.startsWith('/messages') ||
            (path.startsWith('/invitation/') && path.endsWith('/chat')) ||
            path.startsWith('/community/');
        const mq = typeof window !== 'undefined' ? window.matchMedia('(max-width: 1023px)') : null;

        let detach = () => {};
        const attach = () => {
            detach();
            detach = () => {};
            if (isChatLike || !mq?.matches) return;
            detach = attachIosAppHeaderViewportOffset();
        };

        attach();
        const onMq = () => attach();
        mq?.addEventListener('change', onMq);
        return () => {
            mq?.removeEventListener('change', onMq);
            detach();
        };
    }, [location.pathname]);

    /** Mobile: hide bottom tab bar while the soft keyboard is open (posts, comments, create post, etc.). */
    useEffect(() => {
        const p = location.pathname;
        const isChatRoute =
            p.startsWith('/chat/') ||
            p === '/messages' ||
            p.startsWith('/messages') ||
            (p.startsWith('/invitation/') && p.endsWith('/chat'));
        const isCommunityRoute = p.startsWith('/community/');
        const isChatScreen = isChatRoute || isCommunityRoute;
        const isAdminRoute = p.startsWith('/admin');
        const shouldApply = () => !isAdminRoute && !isChatScreen;
        return attachMobileBottomNavKeyboardGuard(shouldApply);
    }, [location.pathname]);

    // iOS / PWA: FCM + service worker can go stale after suspend; refresh token when user returns (if push still on).
    // Skip on notification settings: toggling push can race visibility events; prefs may be mid-edit until saved.
    const fcmRefreshThrottleRef = useRef(0);
    useEffect(() => {
        const uid = currentUser?.uid;
        if (!uid || isGuest) return undefined;
        const run = () => {
            if (document.visibilityState !== 'visible') return;
            if (location.pathname === '/settings/notifications') return;
            const now = Date.now();
            if (now - fcmRefreshThrottleRef.current < 8000) return;
            fcmRefreshThrottleRef.current = now;
            refreshFcmIfUserOptedIn(uid);
        };
        document.addEventListener('visibilitychange', run);
        window.addEventListener('pageshow', run);
        return () => {
            document.removeEventListener('visibilitychange', run);
            window.removeEventListener('pageshow', run);
        };
    }, [currentUser?.uid, isGuest, location.pathname]);

    // Right sidebar data (trending uses same `restaurants` pipeline as directory — InvitationContext)
    const trendingPartners = useMemo(() => {
        const list = Array.isArray(restaurants) ? restaurants : [];
        return [...list]
            .sort((a, b) => {
                const ra = Number(a.averageRating ?? a.rating ?? 0);
                const rb = Number(b.averageRating ?? b.rating ?? 0);
                return rb - ra;
            })
            .slice(0, 4)
            .map((b) => ({
                id: b.id,
                name: b.name || 'Business',
                image: b.image || b.avatar || '',
                logo: b.avatar,
                rating: typeof b.averageRating === 'number' ? b.averageRating : (b.rating ?? null),
                cuisine: b.type || b.businessType || b.cuisine,
            }));
    }, [restaurants]);
    const [recentCommunities, setRecentCommunities] = useState([]);
    const [joinedCommunityData, setJoinedCommunityData] = useState([]);

    const markMessageNotificationsAsReadRef = useRef(markMessageNotificationsAsRead);
    markMessageNotificationsAsReadRef.current = markMessageNotificationsAsRead;

    // Auto-mark chat notifications as read when visiting chat pages
    useEffect(() => {
        if (!location) return;

        const path = location.pathname;
        if (!path.startsWith('/chat/') && !path.startsWith('/community/') && !path.startsWith('/invitation/')) {
            return undefined;
        }

        const timerId = window.setTimeout(() => {
            markMessageNotificationsAsReadRef.current?.(path);
        }, 500);

        return () => clearTimeout(timerId);
    }, [location.pathname]);

    // Fetch communities the current user has JOINED (from userProfile.joinedCommunities)
    useEffect(() => {
        const ids = userProfile?.joinedCommunities;
        if (!ids || ids.length === 0) { setJoinedCommunityData([]); return; }
        let cancelled = false;
        Promise.all(
            ids.map(async (partnerId) => {
                try {
                    const snap = await getDoc(doc(db, 'users', partnerId));
                    if (!snap.exists()) return null;
                    const d = snap.data();
                    if (!isBusinessUser(d)) return null;
                    const bi = d.businessInfo || {};
                    return {
                        id: partnerId,
                        name: bi.businessName || d.display_name || d.name || 'Community',
                        logo: d.photo_url || d.photoURL || d.avatar || null,
                        memberCount: d.communityMembers?.length || 0,
                    };
                } catch { return null; }
            })
        ).then(results => {
            if (!cancelled) setJoinedCommunityData(results.filter(Boolean));
        });
        return () => { cancelled = true; };
    }, [userProfile?.joinedCommunities, userProfile?.id]);

    // Session / profile gate: one full-viewport loader with the same horizontal cap as `.app-layout`
    // (see `app-loading-shell` in index.css) — avoids narrow-then-wide jumps before the shell mounts.
    const isAdminPath = location.pathname.startsWith('/admin');
    if (loading && !(isAdminPath && currentUser?.uid)) {
        return <AppRouteLoading variant="session" fullViewport />;
    }

    // Email verification — email/password accounts (consumer or business) until verified
    // For business accounts, we allow them to continue but show the EmailVerificationBusinessBanner instead of force redirect.
    const isAdminAccount = isAdminIdentity(currentUser, userProfile);
    const privateInvitationPath =
        location.pathname.startsWith('/invitation/private/');
    if (
        !isAdminAccount &&
        !isGuest &&
        currentUser &&
        userProfile &&
        needsConsumerEmailVerification(currentUser, userProfile) &&
        !privateInvitationPath
    ) {
        return <Navigate to="/verify-email" replace />;
    }

    const isActive = (path) => location.pathname === path;
    const businessNavHint = (() => {
        try {
            return Boolean(currentUser?.uid && sessionStorage.getItem('dineb_biz_uid') === currentUser.uid);
        } catch {
            return false;
        }
    })();
    const isBusinessAccount = isBusiness || businessNavHint;

    // Social feed "Home" — same for all logged-in users; business dashboard has its own nav row.
    const feedHomePath = '/posts-feed';
    const isFeedHomeActive = isActive('/posts-feed') || isActive('/');

    // Route type detection
    const isChatRoute = location.pathname.startsWith('/chat/') ||
        location.pathname === '/messages' ||
        location.pathname.startsWith('/messages') ||
        (location.pathname.startsWith('/invitation/') && location.pathname.endsWith('/chat'));
    /** Conversation list in left column — not on /messages (desktop: show main nav + list in center). */
    const isMessagesIndex = location.pathname === '/messages';
    const showConversationSidebar = isChatRoute && !isMessagesIndex;
    const isCommunityRoute = location.pathname.startsWith('/community/');
    const isStoryRoute = location.pathname === '/create-story';
    const isChatScreen = isChatRoute || isCommunityRoute; // mobile: hide bottom nav
    const isAdminRoute = location.pathname.startsWith('/admin');

    const businessCreateFabActive =
        location.pathname === '/create-post' || location.pathname === '/business-dashboard';

    const inviteCreateFabActive =
        location.pathname === '/create/manual' ||
        location.pathname === '/create' ||
        location.pathname === '/create-private' ||
        location.pathname === '/create-dating';

    const changeLanguage = (lang) => i18n.changeLanguage(lang);

    // Latest invitations for right sidebar
    const latestInvitations = invitations?.slice(0, 3) || [];

    // ── Contextual Chat Sidebar (conversations list for /chat/ & /messages) ──
    const ChatSidebar = () => {
        const { t: tl } = useTranslation();
        const seenUids = new Set();
        const filteredConvos = (conversations || [])
            .filter(c => c.otherUser)
            .filter(c => {
                if (seenUids.has(c.otherUser.uid)) return false;
                seenUids.add(c.otherUser.uid);
                return true;
            });
        return (
            <aside className="ds-left-sidebar">
                <div style={{ padding: '6px 14px 8px', fontSize: '0.9rem', fontWeight: '800', color: 'var(--text-main)', borderBottom: '1px solid var(--border-color)', marginBottom: '6px' }}>
                    💬 {tl('messages', 'Messages')}
                </div>
                {filteredConvos.length === 0 && (
                    <div style={{ padding: '12px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>No conversations yet</div>
                )}
                {filteredConvos.map(convo => {
                    const ou = convo.otherUser;
                    const activeChatId = location.pathname.split('/chat/')[1];
                    const isActiveCh = activeChatId === ou?.uid;
                    return (
                        <div
                            key={convo.id}
                            onClick={() => navigate(`/chat/${ou.uid}`)}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '10px',
                                padding: '9px 12px', borderRadius: '12px', cursor: 'pointer',
                                background: isActiveCh ? 'var(--hover-overlay)' : 'transparent',
                                transition: 'background 0.15s',
                            }}
                        >
                            <img src={ou.photoURL || ou.avatar || '/default-avatar.png'} alt={ou.displayName}
                                style={{ width: 38, height: 38, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                                onError={e => { e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="40" height="40"%3E%3Crect fill="%238b5cf6" width="40" height="40"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" fill="white" font-size="18"%3E👤%3C/text%3E%3C/svg%3E'; }}
                            />
                            <div style={{ minWidth: 0 }}>
                                <div style={{ fontWeight: '700', fontSize: '0.88rem', color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ou.displayName}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{convo.lastMessage || '...'}</div>
                            </div>
                            {convo.isUnread && <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--primary)', flexShrink: 0, marginLeft: 'auto' }} />}
                        </div>
                    );
                })}
            </aside>
        );
    };

    // ── Contextual Community Sidebar ──
    const CommunitySidebar = () => {
        const { t: tl } = useTranslation();
        const activeCommunityId = location.pathname.split('/community/')[1];
        return (
            <aside className="ds-left-sidebar">
                {/* Label */}
                <div style={{ padding: '6px 14px 8px', fontSize: '0.9rem', fontWeight: '800', color: 'var(--text-main)', borderBottom: '1px solid var(--border-color)', marginBottom: '6px' }}>
                    👥 {tl('my_communities', 'My Communities')}
                </div>
                {joinedCommunityData.length === 0 && (
                    <div style={{ padding: '12px', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                        {tl('no_communities_joined', 'No communities joined yet')}
                    </div>
                )}
                {joinedCommunityData.map(c => {
                    const isActiveC = activeCommunityId === c.id;
                    return (
                        <div
                            key={c.id}
                            onClick={() => navigate(`/community/${c.id}`)}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '10px',
                                padding: '9px 12px', borderRadius: '12px', cursor: 'pointer',
                                background: isActiveC ? 'var(--hover-overlay)' : 'transparent',
                                transition: 'background 0.15s',
                            }}
                        >
                            <img src={c.logo || '/default-avatar.png'} alt={c.name}
                                style={{ width: 38, height: 38, borderRadius: '10px', objectFit: 'cover', flexShrink: 0 }}
                                onError={e => { e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="40" height="40"%3E%3Crect fill="%238b5cf6" width="40" height="40"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" fill="white" font-size="18"%3E👥%3C/text%3E%3C/svg%3E'; }}
                            />
                            <div style={{ minWidth: 0 }}>
                                <div style={{ fontWeight: '700', fontSize: '0.88rem', color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{c.memberCount} members</div>
                            </div>
                        </div>
                    );
                })}
                <button
                    onClick={() => navigate('/communities')}
                    style={{ margin: '8px 12px 0', padding: '7px 12px', borderRadius: '9999px', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-muted)', fontSize: '0.82rem', cursor: 'pointer', width: 'calc(100% - 24px)' }}
                >
                    + {tl('explore_communities', 'Explore Communities')}
                </button>
            </aside>
        );
    };

    const Badge = ({ count, absolute }) => count > 0 ? (
        <span style={{
            background: 'var(--primary)', color: 'white',
            borderRadius: '9999px', fontSize: '0.62rem',
            padding: '1px 5px', marginLeft: absolute ? 0 : '6px',
            fontWeight: '800', lineHeight: 1,
            position: absolute ? 'absolute' : 'static',
            top: absolute ? '-6px' : 'auto',
            right: absolute ? '-8px' : 'auto',
            border: absolute ? '2px solid var(--bg-card)' : 'none'
        }}>{count}</span>
    ) : null;

    // ── Right Sidebar Widgets ──────────────────────────────
    const RightSidebar = () => (
        <aside className="ds-right-sidebar">

            {/* Top 3 Elite Ranking (desktop only) */}
            <RankingSidebarWidget />

            {/* Latest Invitations */}
            {latestInvitations.length > 0 && (

                <div className="ds-widget-card">
                    <div className="ds-widget-header">
                        <FaClock size={14} />
                        <span>{t('latest_invitations', 'Latest Invitations')}</span>
                        <Link to="/invitations" className="ds-widget-see-all">{t('see_all', 'See all')}</Link>
                    </div>
                    {latestInvitations.map(inv => (
                        <div
                            key={inv.id}
                            className="ds-widget-row"
                            onClick={() => navigate(`/invitation/${inv.id}`)}
                        >
                            <img
                                src={inv.restaurantImage || inv.customImage || inv.image || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=80'}
                                alt={inv.title}
                                className="ds-widget-img-sq"
                                onError={e => { e.target.src = 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=80'; }}
                            />
                            <div className="ds-widget-info">
                                <div className="ds-widget-title">{inv.title}</div>
                                <div className="ds-widget-sub">{inv.restaurantName || inv.location || '—'}</div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Trending Partners */}
            {trendingPartners.length > 0 && (
                <div className="ds-widget-card">
                    <div className="ds-widget-header">
                        <FaFire size={14} style={{ color: '#f97316' }} />
                        <span>{t('trending_partners', 'Trending Businesses')}</span>
                        <Link to="/restaurants" className="ds-widget-see-all">{t('see_all', 'See all')}</Link>
                    </div>
                    {trendingPartners.map(r => (
                        <div
                            key={r.id}
                            className="ds-widget-row"
                            onClick={() => navigate(`/restaurant/${r.id}`)}
                        >
                            <img
                                src={r.image || r.logo}
                                alt={r.name}
                                className="ds-widget-img-sq"
                                style={{ borderRadius: '10px' }}
                                onError={e => { e.target.src = `https://api.dicebear.com/7.x/identicon/svg?seed=${r.id}`; }}
                            />
                            <div className="ds-widget-info">
                                <div className="ds-widget-title">{r.name}</div>
                                <div className="ds-widget-sub">⭐ {r.rating || '—'} · {r.cuisine || t('venue', 'Venue')}</div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Communities */}
            {recentCommunities.length > 0 && (
                <div className="ds-widget-card">
                    <div className="ds-widget-header">
                        <FaUsers size={14} />
                        <span>{t('communities', 'Communities')}</span>
                        <Link to="/communities" className="ds-widget-see-all">{t('see_all', 'See all')}</Link>
                    </div>
                    {recentCommunities.map(c => (
                        <div
                            key={c.id}
                            className="ds-widget-row"
                            onClick={() => navigate(`/community/${c.id}`)}
                        >
                            <div className="ds-widget-avatar" style={{ background: c.color || 'var(--primary)', fontSize: '1.2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                {c.emoji || c.icon || '👥'}
                            </div>
                            <div className="ds-widget-info">
                                <div className="ds-widget-title">{c.name}</div>
                                <div className="ds-widget-sub">{c.membersCount || 0} {t('members', 'members')}</div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Footer */}
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', paddingLeft: '4px', lineHeight: 2, display: 'flex', gap: '4px' }}>
                <span dir="ltr">© {new Date().getFullYear()} DineBuddies</span> ·{' '}
                <Link to="/settings" style={{ color: 'var(--text-muted)' }}>{t('settings', 'Settings')}</Link>
            </div>
        </aside>
    );

    return (
        <div className="app-layout" dir={i18n.language === 'ar' ? 'rtl' : 'ltr'}>

            <ProfileCompletionModal />
            {/* ── HEADER ── always on desktop, hidden on mobile chat ── */}
            <header className={`app-header${isChatScreen ? ' app-header--chat' : ''}`}>
                <div
                    className="logo-wrapper app-header-brand"
                    onClick={() => navigate(feedHomePath)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            navigate(feedHomePath);
                        }
                    }}
                    role="button"
                    tabIndex={0}
                    aria-label={t('nav_home')}
                >
                    <img src={appLogoForChrome(themeMode)} alt="" className="app-logo-img" aria-hidden />
                </div>
                <span className="header-spacer" aria-hidden="true" />
                <div className="header-actions">
                    {!isGuest && userProfile?.role !== 'guest' ? (
                        <>
                            <button
                                className={`notification-bell nav-search-btn${isActive('/search') ? ' active' : ''}`}
                                onClick={() => navigate('/search')}
                                title="Search"
                                aria-label="Search"
                            >
                                <FaSearch />
                            </button>
                            <Link to="/messages" className="notification-bell">
                                <FaComments />
                                {totalChatUnread > 0 && <span className="badge">{totalChatUnread}</span>}
                            </Link>
                            <Link to="/notifications" className="notification-bell">
                                <FaBell />
                                {unreadBellCount > 0 && <span className="badge">{unreadBellCount}</span>}
                            </Link>
                            <Link to="/settings" className="notification-bell" title={t('settings', 'Settings')}>
                                <FaCog />
                            </Link>

                            <div
                                className="header-profile-pic"
                                onClick={() => navigate(isBusinessAccount ? `/business/${currentUser.uid}` : '/profile')}
                                style={{ width: '40px', height: '40px', borderRadius: '50%', overflow: 'hidden', border: '1px solid var(--border-color)', cursor: 'pointer', position: 'relative', background: 'var(--bg-card)' }}
                            >
                                <img
                                    src={getSafeAvatar(userProfile)}
                                    alt="Profile"
                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                />
                            </div>
                        </>
                    ) : (
                        <button onClick={() => goToLogin()} style={{ background: 'white', color: 'var(--primary)', border: 'none', padding: '8px 16px', borderRadius: '20px', fontWeight: '700', fontSize: '0.9rem', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}>
                            {t('login_signup', 'Login / Sign Up')}
                        </button>
                    )}
                </div>
            </header>

            {/* ── DESKTOP 3-COLUMN BODY (all routes, incl. chat) ── */}
            <div className={`ds-body-grid${isAdminRoute ? ' ds-body-grid--admin' : ''}`}>

                {/* Column 1 — contextual left sidebar */}
                {!isAdminRoute && (showConversationSidebar ? (
                    <ChatSidebar />
                ) : isCommunityRoute ? (
                    <CommunitySidebar />
                ) : (
                    <aside className="ds-left-sidebar">
                        {isGuest && (
                            <Link to="/login" className={`ds-nav-item ${isActive('/login') ? 'active' : ''}`} style={{ color: 'var(--primary)', textDecoration: 'none' }}>
                                <FaSignInAlt /><span>{t('nav_login', 'Login')}</span>
                            </Link>
                        )}
                        <Link to={feedHomePath} className={`ds-nav-item ${isFeedHomeActive ? 'active' : ''}`}>
                            <FaHome /><span>{t('nav_home')}</span>
                        </Link>
                        <Link to="/invitations" className={`ds-nav-item ${isActive('/invitations') ? 'active' : ''}`}>
                            <FaEnvelope /><span>{t('nav_invitations', 'Invitations')}</span>
                        </Link>
                        {!isBusinessAccount && !isGuest && userProfile?.role !== 'guest' && currentUser && (
                            <button
                                type="button"
                                className={`ds-nav-item${inviteCreateFabActive || inviteCreateOpen ? ' active' : ''}`}
                                onClick={openInviteCreate}
                                aria-haspopup="dialog"
                                aria-expanded={inviteCreateOpen}
                            >
                                <FaPlusCircle /><span>{t('create_invitation', 'Create Invitation')}</span>
                            </button>
                        )}
                        <Link to="/restaurants" className={`ds-nav-item ${isActive('/restaurants') ? 'active' : ''}`}>
                            <FaStore /><span>{t('nav_partners', 'Businesses')}</span>
                        </Link>
                        {!isBusinessAccount && !isGuest && userProfile?.role !== 'guest' && (
                            <Link to="/communities" className={`ds-nav-item ${isActive('/communities') ? 'active' : ''}`}>
                                <FaUsers /><span>{t('communities')}</span>
                            </Link>
                        )}

                        {!isGuest && (
                            <>
                                {/* Messages & Notifications: hidden for business (available in dashboard) */}
                                {!isBusinessAccount && (
                                    <>
                                        <Link to="/messages" className={`ds-nav-item ${isActive('/messages') ? 'active' : ''}`}>
                                            <div style={{ position: 'relative', display: 'inline-flex' }}>
                                                <FaComments />
                                                <Badge count={totalChatUnread} absolute />
                                            </div>
                                            <span>{t('nav_messages', 'Messages')}</span>
                                        </Link>
                                        <Link to="/notifications" className={`ds-nav-item ${isActive('/notifications') ? 'active' : ''}`}>
                                            <div style={{ position: 'relative', display: 'inline-flex' }}>
                                                <FaBell />
                                                <Badge count={unreadBellCount} absolute />
                                            </div>
                                            <span>{t('notifications', 'Notifications')}</span>
                                        </Link>
                                    </>
                                )}
                                <Link to={isBusinessAccount ? '/business-dashboard' : '/profile'} className={`ds-nav-item ${isActive('/profile') || isActive('/business-dashboard') ? 'active' : ''}`}>
                                    <FaUser /><span>{isBusinessAccount ? t('dashboard', 'Dashboard') : t('profile', 'Profile')}</span>
                                </Link>
                                {isBusinessAccount && currentUser && (
                                    <button
                                        type="button"
                                        className={`ds-nav-item${businessCreateFabActive ? ' active' : ''}`}
                                        onClick={() => navigate('/create-post')}
                                    >
                                        <FaPlusCircle /><span>{t('business_nav_create_posts', 'Create posts')}</span>
                                    </button>
                                )}
                                {isBusinessAccount && currentUser && (
                                    <Link
                                        to={`/business/${currentUser.uid}`}
                                        className={`ds-nav-item ${location.pathname === `/business/${currentUser.uid}` ? 'active' : ''}`}
                                    >
                                        <FaStore /><span>{t('profile_title', 'My Profile')}</span>
                                    </Link>
                                )}
                                {isBusinessAccount && currentUser && (
                                    <Link
                                        to="/my-community"
                                        className={`ds-nav-item ${isActive('/my-community') ? 'active' : ''}`}
                                    >
                                        <FaUsers /><span>{t('my_community', 'My Community')}</span>
                                    </Link>
                                )}
                            </>
                        )}
                        {/* Settings: hidden for business accounts (available in dashboard) */}
                        {!isBusinessAccount && (
                            <Link to="/settings" className={`ds-nav-item ${isActive('/settings') ? 'active' : ''}`}>
                                <FaCog /><span>{t('settings', 'Settings')}</span>
                            </Link>
                        )}
                        {isAdminAccount && (
                            <Link to="/admin/dashboard" className={`ds-nav-item ${location.pathname.startsWith('/admin') ? 'active' : ''}`}>
                                <FaCrown /><span>Admin</span>
                            </Link>
                        )}

                    </aside>
                ))}

                {/* Column 2 — Main content */}
                <main className={`app-main${isChatScreen ? ' app-main--chat' : ''}${isMessagesIndex ? ' app-main--messages-index' : ''}${isStoryRoute ? ' app-main--fullscreen' : ''}${isAdminRoute ? ' app-main--admin' : ''}`}>
                    <EmailVerificationBusinessBanner />
                    <UnpublishedBusinessReminder />
                    <Suspense fallback={<div className="app-route-suspense-fallback" role="status" aria-busy="true" aria-label={t('loading', 'Loading…')} />}>
                        <Outlet />
                    </Suspense>
                </main>

                {/* Column 3 — Right widgets */}
                {!isAdminRoute && <RightSidebar />}
            </div>

            {/* ── MOBILE BOTTOM NAV (admin uses embedded nav in AdminLayout) ── */}
            {!isChatScreen && !isAdminRoute && (
                <nav className="bottom-nav user-nav">
                    <Link to={feedHomePath} className={`nav-item ${isFeedHomeActive ? 'active' : ''}`}>
                        <FaHome className="nav-icon" />
                        <span>{t('nav_home')}</span>
                    </Link>
                    <Link to="/invitations" className={`nav-item ${isActive('/invitations') ? 'active' : ''}`}>
                        <FaEnvelope className="nav-icon" />
                        <span>{t('nav_invitations', 'Invitations')}</span>
                    </Link>
                    {isGuest ? (
                        <Link to="/login" className={`nav-item ${isActive('/login') ? 'active' : ''}`} style={{ color: 'var(--primary)', textDecoration: 'none' }}>
                            <FaSignInAlt className="nav-icon" />
                            <span>{t('nav_login', 'Login')}</span>
                        </Link>
                    ) : !isBusinessAccount ? (
                        <button
                            type="button"
                            className={`nav-item fab-nav-item${inviteCreateFabActive ? ' active' : ''}`}
                            onClick={openInviteCreate}
                            aria-haspopup="dialog"
                            aria-expanded={inviteCreateOpen}
                            aria-label={t('invite_create_menu', 'Create invitation')}
                        >
                            <div className="fab-container"><FaPlusCircle className="nav-icon fab" /></div>
                        </button>
                    ) : null}
                    {isBusinessAccount && (
                        <button
                            type="button"
                            className={`nav-item fab-nav-item${businessCreateFabActive ? ' active' : ''}`}
                            onClick={() => navigate('/create-post')}
                            aria-label={t('business_nav_create_posts', 'Create posts')}
                        >
                            <div className="fab-container"><FaPlusCircle className="nav-icon fab" /></div>
                        </button>
                    )}
                    <Link to="/restaurants" className={`nav-item ${isActive('/restaurants') ? 'active' : ''}`}>
                        <FaStore className="nav-icon" />
                        <span>{t('nav_partners', 'Businesses')}</span>
                    </Link>
                    {!isBusinessAccount && !isGuest && userProfile?.role !== 'guest' && (
                        <Link to="/communities" className={`nav-item ${isActive('/communities') ? 'active' : ''}`}>
                            <div className="friend-nav-icon-container"><FaUsers className="nav-icon" /></div>
                            <span>{t('communities')}</span>
                        </Link>
                    )}
                    {isBusinessAccount && (
                        <Link to="/my-community" className={`nav-item ${isActive('/my-community') ? 'active' : ''}`}>
                            <div className="friend-nav-icon-container"><FaUsers className="nav-icon" /></div>
                            <span>{t('my_community')}</span>
                        </Link>
                    )}
                    {isAdminAccount && (
                        <Link to="/admin/dashboard" className={`nav-item ${location.pathname.startsWith('/admin') ? 'active' : ''}`}>
                            <FaCrown className="nav-icon" />
                            <span>Admin</span>
                        </Link>
                    )}
                </nav>
            )}

            {!isBusinessAccount && !isGuest && inviteCreateOpen && (
                <div
                    className="business-create-overlay"
                    role="presentation"
                    onClick={closeInviteCreate}
                >
                    <div
                        className="business-create-sheet"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="invite-create-title"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="business-create-sheet__header">
                            <div className="business-create-sheet__titles">
                                <h2 id="invite-create-title" className="business-create-sheet__title">
                                    {t('invite_create_title', 'Create invitation')}
                                </h2>
                                <p className="business-create-sheet__subtitle">
                                    {t(
                                        'invite_create_subtitle',
                                        'Choose the type of invitation you want to create.'
                                    )}
                                </p>
                            </div>
                            <button
                                type="button"
                                className="business-create-sheet__close"
                                onClick={closeInviteCreate}
                                aria-label={t('close', 'Close')}
                            >
                                <FaTimes />
                            </button>
                        </div>
                        <div className="business-create-sheet__options">
                            <button
                                type="button"
                                className="business-create-option"
                                onClick={() => finishInviteCreateManual('public')}
                            >
                                <span className="business-create-option__icon business-create-option__icon--featured">
                                    <FaEnvelope />
                                </span>
                                <span className="business-create-option__text">
                                    <span className="business-create-option__label">
                                        {t('invite_create_public_title', 'Public invitation')}
                                    </span>
                                    <span className="business-create-option__desc">
                                        {t(
                                            'invite_create_public_desc',
                                            'A discoverable invitation others can browse and join.'
                                        )}
                                    </span>
                                </span>
                            </button>
                            <button
                                type="button"
                                className="business-create-option"
                                onClick={() => finishInviteCreateManual('private')}
                            >
                                <span className="business-create-option__icon business-create-option__icon--motion">
                                    <FaLock />
                                </span>
                                <span className="business-create-option__text">
                                    <span className="business-create-option__label">
                                        {t('invite_create_private_title', 'Private invitation')}
                                    </span>
                                    <span className="business-create-option__desc">
                                        {t(
                                            'invite_create_private_desc',
                                            'Invite specific guests with a private link.'
                                        )}
                                    </span>
                                </span>
                            </button>
                            <button
                                type="button"
                                className="business-create-option"
                                onClick={() => finishInviteCreateManual('dating')}
                            >
                                <span className="business-create-option__icon business-create-option__icon--featured">
                                    <FaHeart />
                                </span>
                                <span className="business-create-option__text">
                                    <span className="business-create-option__label">
                                        {t('invite_create_dating_title', 'Dating invitation')}
                                    </span>
                                    <span className="business-create-option__desc">
                                        {t(
                                            'invite_create_dating_desc',
                                            'A dating-style invitation for matched dining.'
                                        )}
                                    </span>
                                </span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

export default Layout;
