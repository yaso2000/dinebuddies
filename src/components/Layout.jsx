import React, { useState, useEffect, Suspense } from 'react';
import { useNavigate, Link, useLocation, Outlet, Navigate } from 'react-router-dom';
import {
    FaHome,
    FaPlusCircle,
    FaBell,
    FaStore,
    FaUsers,
    FaComments,
    FaCrown,
    FaCog,
    FaEnvelope,
    FaUser,
    FaClock,
    FaFire,
    FaSearch,
    FaSignInAlt,
    FaTimes,
    FaLock,
    FaHeart,
    FaMagic,
    FaImages,
    FaPhotoVideo,
    FaGlobe,
    FaChevronRight,
    FaThLarge,
} from 'react-icons/fa';
import { useTranslation } from 'react-i18next';
import { useInvitations } from '../context/InvitationContext';
import { useChat } from '../context/ChatContext';
import { useNotifications } from '../context/NotificationContext';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import UnpublishedBusinessReminder from './UnpublishedBusinessReminder';
import EmailVerificationBusinessBanner from './EmailVerificationBusinessBanner';
import { getSafeAvatar } from '../utils/avatarUtils';
import UserAvatar from './UserAvatar';
import { collection, query, orderBy, limit, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import AppRouteLoading from './AppRouteLoading';
import AppShellLoading from './AppShellLoading';
import RankingSidebarWidget from './RankingSidebarWidget';
import PushNotificationPrompt from './PushNotificationPrompt';
import PushSessionManager from './PushSessionManager';
import InvitationInboxOverlay from './Invitations/InvitationInboxOverlay';
import { isBusinessUser } from '../utils/accountRole';
import { needsEmailPasswordVerification, needsConsumerEmailVerification } from '../utils/emailVerification';
import { buildLoginPath, goToLogin } from '../utils/goToLogin';
import { isAdminIdentity } from '../utils/adminAccess';
import { useToast } from '../context/ToastContext';
import { attachIosAppHeaderViewportOffset } from '../utils/iosAppHeaderVisualViewport';
import { attachHideBottomNavOnKeyboard } from '../utils/hideBottomNavOnKeyboard';
import { isIOS, isStandalonePwa, markIosPwaLaunch } from '../services/notificationService';
import { isAuthRoutePath } from '../utils/authRoutePaths';

const Layout = ({ children }) => {
    const location = useLocation();
    const navigate = useNavigate();
    const { t, i18n } = useTranslation();
    const { currentUser, userProfile, isGuest, isBusiness, loading } = useAuth();
    const invContext = useInvitations();
    const {
        invitations = [],
        privateInvitations = [],
        getFollowingInvitations = () => [],
        canCreatePrivateInvitation,
        respondToPrivateInvitation
    } = invContext || {};
    const { showToast } = useToast();
    const { unreadCount: chatUnreadCount, conversations = [] } = useChat();
    const { unreadCount, unreadBellCount = 0, unreadMessageCount = 0, markMessageNotificationsAsRead } = useNotifications();
    
    // Total unread messages (from direct chats + push notifications for other chats)
    const totalChatUnread = chatUnreadCount + unreadMessageCount;
    const { themeMode } = useTheme();

    const [businessCreateOpen, setBusinessCreateOpen] = useState(false);
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
            if (q && !q.profileLoading && !q.canCreate) {
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
            if (q && !q.profileLoading && !q.canCreate) {
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
        if (!businessCreateOpen && !inviteCreateOpen) return;
        const onKey = (e) => {
            if (e.key === 'Escape') {
                setBusinessCreateOpen(false);
                setInviteCreateOpen(false);
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [businessCreateOpen, inviteCreateOpen]);

    // Mobile: hide bottom tab bar while any field is focused / keyboard is open (feed composer, comments, forms).
    useEffect(() => {
        return attachHideBottomNavOnKeyboard();
    }, []);

    useEffect(() => {
        if (!isIOS()) return;
        if (isStandalonePwa()) {
            markIosPwaLaunch();
            return;
        }
        try {
            if (!window.matchMedia('(display-mode: browser)').matches) {
                markIosPwaLaunch();
            }
        } catch {
            /* ignore */
        }
    }, []);

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

    // Right sidebar data
    const [trendingPartners, setTrendingPartners] = useState([]);
    const [recentCommunities, setRecentCommunities] = useState([]);
    const [joinedCommunityData, setJoinedCommunityData] = useState([]);

    // Auto-mark chat notifications as read when visiting chat pages
    useEffect(() => {
        if (!location || !markMessageNotificationsAsRead) return;
        
        const path = location.pathname;
        if (path.startsWith('/chat/') || path.startsWith('/community/') || path.startsWith('/invitation/')) {
            // Delay slightly so the context initializes
            setTimeout(() => {
                markMessageNotificationsAsRead(path);
            }, 500);
        }
    }, [location?.pathname, markMessageNotificationsAsRead]);

    // Fetch trending partners for right sidebar
    useEffect(() => {
        try {
            const q = query(collection(db, 'restaurants'), orderBy('rating', 'desc'), limit(4));
            const unsub = onSnapshot(q, (snap) => {
                setTrendingPartners(snap.docs.map(d => ({ id: d.id, ...d.data() })));
            }, () => { });
            return () => unsub();
        } catch { return () => { }; }
    }, []);

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

    // 1. Wait for auth to settle before running guards (must be after all hooks — see React #310).
    // Never return null here: <Outlet /> would not mount, so GuestBlockedRoute never runs and users
    // see a blank screen until refresh (protected routes + guests redirecting to /login).
    //
    // IMPORTANT: Do not unmount <Outlet /> on /admin while `loading` flips true (Firestore/auth churn).
    // That tore down AdminRoute/AdminLayout and felt like "desktop↔mobile" or home↔admin flicker.
    const isAdminPath = location.pathname.startsWith('/admin');
    const adminBypassConsumerGate = isAdminIdentity(currentUser, userProfile);
    const isCreateInvitationPath =
        location.pathname === '/create-dating' ||
        location.pathname === '/create-private' ||
        location.pathname === '/create' ||
        location.pathname.startsWith('/create/');
    const isPrivateInvitationDeepLink =
        location.pathname.startsWith('/invitation/private/') ||
        location.pathname.startsWith('/invite/p/');
    const keepOutletMountedWhileLoading =
        isAuthRoutePath(location.pathname) ||
        ((isAdminPath || isCreateInvitationPath || isPrivateInvitationDeepLink) &&
            Boolean(currentUser?.uid));

    if (loading && !keepOutletMountedWhileLoading) {
        return <AppShellLoading variant="session" />;
    }

    // 2. Email verification — email/password accounts (consumer or business) until verified
    // For business accounts, we allow them to continue but show the EmailVerificationBusinessBanner instead of force redirect.
    const isAdminAccount = isAdminIdentity(currentUser, userProfile);
    const privateInvitationPath =
        location.pathname.startsWith('/invitation/private/') ||
        location.pathname.startsWith('/invite/p/') ||
        location.pathname === '/create-dating' ||
        location.pathname === '/create-private' ||
        location.pathname === '/create' ||
        location.pathname.startsWith('/create/');
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
    const isDashboardRoute = location.pathname.startsWith('/my-community');
    const isStoryRoute = location.pathname === '/create-story';
    const isAiDesignRoute = location.pathname === '/ai-design-studio';
    const isStudioRoute =
        location.pathname === '/create-post' || location.pathname === '/create-featured-post';
    const isChatScreen = isChatRoute || isCommunityRoute; // mobile: hide bottom nav
    const isSearchRoute = location.pathname === '/search';
    const isAdminRoute = location.pathname.startsWith('/admin');

    const businessCreateFabActive =
        location.pathname === '/create-post' ||
        location.pathname === '/business-dashboard';

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
                            <UserAvatar
                                user={ou}
                                src={ou?.photoURL || ou?.avatar}
                                alt={ou?.displayName}
                                style={{ width: 38, height: 38, flexShrink: 0 }}
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
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', paddingLeft: '4px', lineHeight: 2, display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                <span dir="ltr">© {new Date().getFullYear()} DineBuddies</span> ·{' '}
                <Link to="/settings" style={{ color: 'var(--text-muted)' }}>{t('settings', 'Settings')}</Link>
            </div>
        </aside>
    );

    return (
        <div className="app-layout" dir={i18n.language === 'ar' ? 'rtl' : 'ltr'}>

            <PushNotificationPrompt />
            <PushSessionManager />
            {currentUser?.uid && !isGuest && !isBusinessAccount && respondToPrivateInvitation && (
                <InvitationInboxOverlay
                    invitations={privateInvitations}
                    viewerUid={currentUser.uid || currentUser.id}
                    pathname={location.pathname}
                    onRespond={respondToPrivateInvitation}
                    enabled={!loading}
                />
            )}
            {/* ── HEADER ── hidden on mobile chat only (chat has its own bar) ── */}
            <header className={`app-header${isChatScreen ? ' app-header--chat' : ''}`}>
                <div className="logo-wrapper" onClick={() => navigate(feedHomePath)}>
                    <img src="/db-logo.svg" alt="DineBuddies" className="app-logo-img" />
                </div>
                <div className="header-actions">
                    {!isGuest && userProfile?.role !== 'guest' ? (
                        <>
                            <Link
                                to="/ai-design-studio"
                                className={`notification-bell header-ai-studio-btn${isAiDesignRoute ? ' active' : ''}`}
                                title={t('ai_design_studio_nav', 'AI Design Studio')}
                                aria-label={t('ai_design_studio_nav', 'AI Design Studio')}
                            >
                                <FaMagic />
                            </Link>
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
                                style={{ cursor: 'pointer', position: 'relative', lineHeight: 0 }}
                            >
                                <UserAvatar
                                    user={userProfile || currentUser}
                                    alt="Profile"
                                    style={{ width: 40, height: 40 }}
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
                        {!isGuest && userProfile?.role !== 'guest' && (
                            <Link to="/ai-design-studio" className={`ds-nav-item ${isAiDesignRoute ? 'active' : ''}`}>
                                <FaMagic /><span>{t('ai_design_studio_nav', 'AI Design')}</span>
                            </Link>
                        )}
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
                                <Link to={isBusinessAccount ? '/business-dashboard' : '/profile'} className={`ds-nav-item ${isActive('/profile') || isActive('/business-dashboard') ? 'active' : ''}`}>
                                    <FaUser /><span>{isBusinessAccount ? t('dashboard', 'Dashboard') : t('profile', 'Profile')}</span>
                                </Link>
                                {isBusinessAccount && currentUser && (
                                    <button
                                        type="button"
                                        className={`ds-nav-item${businessCreateFabActive ? ' active' : ''}`}
                                        onClick={() => setBusinessCreateOpen(true)}
                                        aria-haspopup="dialog"
                                        aria-expanded={businessCreateOpen}
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
                                        className={`ds-nav-item ${location.pathname.startsWith('/my-community') ? 'active' : ''}`}
                                    >
                                        <FaThLarge /><span>{t('business_dashboard', 'Dashboard')}</span>
                                    </Link>
                                )}
                            </>
                        )}
                        {/* Settings: hidden for business accounts (available in dashboard) */}
                        {!isBusinessAccount && (
                            isGuest ? (
                                <Link
                                    to={buildLoginPath({ returnPath: '/settings' })}
                                    className={`ds-nav-item ${isActive('/login') ? 'active' : ''}`}
                                >
                                    <FaCog /><span>{t('settings', 'Settings')}</span>
                                </Link>
                            ) : (
                                <Link to="/settings" className={`ds-nav-item ${isActive('/settings') ? 'active' : ''}`}>
                                    <FaCog /><span>{t('settings', 'Settings')}</span>
                                </Link>
                            )
                        )}
                        {isAdminAccount && (
                            <Link to="/admin/users" className={`ds-nav-item ${location.pathname.startsWith('/admin') ? 'active' : ''}`}>
                                <FaCrown /><span>Admin</span>
                            </Link>
                        )}

                    </aside>
                ))}

                {/* Column 2 — Main content */}
                <main className={`app-main${isChatScreen ? ' app-main--chat' : ''}${isMessagesIndex ? ' app-main--messages-index' : ''}${isStoryRoute || isStudioRoute ? ' app-main--fullscreen' : ''}${isAdminRoute ? ' app-main--admin' : ''}${isDashboardRoute ? ' app-main--dashboard' : ''}`}>
                    {!isSearchRoute && <EmailVerificationBusinessBanner />}
                    {!isSearchRoute && <UnpublishedBusinessReminder />}
                    {children}
                    <Suspense fallback={<AppRouteLoading variant="route" />}>
                        <Outlet />
                    </Suspense>
                </main>

                {/* Column 3 — Right widgets */}
                {!isAdminRoute && <RightSidebar />}
            </div>

            {/* ── MOBILE BOTTOM NAV (admin uses embedded nav in AdminLayout) ── */}
            {!isChatScreen && !isAdminRoute && !isStudioRoute && (
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
                            onClick={() => setBusinessCreateOpen(true)}
                            aria-haspopup="dialog"
                            aria-expanded={businessCreateOpen}
                            aria-label={t('business_create_menu', 'Create')}
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
                        <Link to="/my-community" className={`nav-item ${location.pathname.startsWith('/my-community') ? 'active' : ''}`}>
                            <div className="friend-nav-icon-container"><FaThLarge className="nav-icon" /></div>
                            <span>{t('business_dashboard', 'Dashboard')}</span>
                        </Link>
                    )}
                    {isAdminAccount && (
                        <Link to="/admin/users" className={`nav-item ${location.pathname.startsWith('/admin') ? 'active' : ''}`}>
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
                                <span className="business-create-option__icon business-create-option__icon--public" aria-hidden>
                                    <FaGlobe />
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
                                <FaChevronRight className="business-create-option__arrow" aria-hidden />
                            </button>
                            <button
                                type="button"
                                className="business-create-option"
                                onClick={() => finishInviteCreateManual('private')}
                            >
                                <span className="business-create-option__icon business-create-option__icon--private" aria-hidden>
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
                                <FaChevronRight className="business-create-option__arrow" aria-hidden />
                            </button>
                            <button
                                type="button"
                                className="business-create-option"
                                onClick={() => finishInviteCreateManual('dating')}
                            >
                                <span className="business-create-option__icon business-create-option__icon--dating" aria-hidden>
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
                                <FaChevronRight className="business-create-option__arrow" aria-hidden />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {isBusinessAccount && businessCreateOpen && (
                <div
                    className="business-create-overlay"
                    role="presentation"
                    onClick={() => setBusinessCreateOpen(false)}
                >
                    <div
                        className="business-create-sheet"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="business-create-title"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="business-create-sheet__header">
                            <div className="business-create-sheet__titles">
                                <h2 id="business-create-title" className="business-create-sheet__title">
                                    {t('business_create_title', 'Create')}
                                </h2>
                                <p className="business-create-sheet__subtitle">
                                    {t('business_create_subtitle', 'Choose what you want to publish')}
                                </p>
                            </div>
                            <button
                                type="button"
                                className="business-create-sheet__close"
                                onClick={() => setBusinessCreateOpen(false)}
                                aria-label={t('close', 'Close')}
                            >
                                <FaTimes />
                            </button>
                        </div>
                        <div className="business-create-sheet__options">
                            <button
                                type="button"
                                className="business-create-option"
                                onClick={() => {
                                    setBusinessCreateOpen(false);
                                    navigate('/create-featured-post');
                                }}
                            >
                                <span className="business-create-option__icon business-create-option__icon--featured" aria-hidden>
                                    <FaImages />
                                </span>
                                <span className="business-create-option__text">
                                    <span className="business-create-option__label">
                                        {t('business_create_featured_title', 'Featured Post')}
                                    </span>
                                    <span className="business-create-option__desc">
                                        {t(
                                            'business_create_featured_desc',
                                            'Elite slide on the home feed for all users.'
                                        )}
                                    </span>
                                </span>
                                <FaChevronRight className="business-create-option__arrow" aria-hidden />
                            </button>
                            <button
                                type="button"
                                className="business-create-option"
                                onClick={() => {
                                    setBusinessCreateOpen(false);
                                    navigate('/create-post');
                                }}
                            >
                                <span className="business-create-option__icon business-create-option__icon--motion" aria-hidden>
                                    <FaPhotoVideo />
                                </span>
                                <span className="business-create-option__text">
                                    <span className="business-create-option__label">
                                        {t('business_create_studio_title', 'Motion post')}
                                    </span>
                                    <span className="business-create-option__desc">
                                        {t(
                                            'business_create_studio_desc',
                                            'Animated studio post in the community feed.'
                                        )}
                                    </span>
                                </span>
                                <FaChevronRight className="business-create-option__arrow" aria-hidden />
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Layout;
