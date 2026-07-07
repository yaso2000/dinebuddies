import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { useNavigate, Link, useLocation, Outlet, Navigate } from 'react-router-dom';
import { useDesktopShell } from '../hooks/useDesktopShell';
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
  FaSignInAlt,
  FaTimes,
  FaLock,
  FaHeart,
  FaImages,
  FaPenAlt,
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
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import AppRouteLoading from './AppRouteLoading';
import AppShellLoading from './AppShellLoading';
import DesktopRightSidebar from './DesktopRightSidebar';
import PushNotificationPrompt from './PushNotificationPrompt';
import PushSessionManager from './PushSessionManager';
import InviteLandingGate from './Invitations/InviteLandingGate';
import InviteInboxLiveGate from './Invitations/InviteInboxLiveGate';
import { getAppRouteShell, APP_HOME_PATH } from '../utils/appRouteShell';
import useStaleInvitationNotificationCleanup from '../hooks/useStaleInvitationNotificationCleanup';
import { isBusinessUser } from '../utils/accountRole';
import { needsEmailPasswordVerification, needsConsumerEmailVerification } from '../utils/emailVerification';
import { buildLoginPath, goToLogin } from '../utils/goToLogin';
import { isAdminIdentity } from '../utils/adminAccess';
import { useToast } from '../context/ToastContext';
import { attachIosAppHeaderViewportOffset } from '../utils/iosAppHeaderVisualViewport';
import { attachHideBottomNavOnKeyboard } from '../utils/hideBottomNavOnKeyboard';
import { isIOS, isStandalonePwa, markIosPwaLaunch } from '../services/notificationService';
import { isAuthRoutePath } from '../utils/authRoutePaths';
import { usePresence } from '../hooks/usePresence';
import { AppText } from "./base";

function DesktopNavGroup({ title, variant = 'default', children }) {
  const items = React.Children.toArray(children).filter(Boolean);
  if (items.length === 0) return null;

  return (
    <section className={`ds-nav-group ds-nav-group--${variant}`} aria-label={title || undefined}>
      {title ? <AppText as="h2" className="ds-nav-group__title">{title}</AppText> : null}
      <div className="ds-nav-group__items">{items}</div>
    </section>
  );
}

const Layout = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { currentUser, userProfile, isGuest, isBusiness, loading } = useAuth();
  usePresence();
  const invContext = useInvitations();
  const {
    canCreateSocialInvitation
  } = invContext || {};
  const { unreadCount: chatUnreadCount, conversations = [] } = useChat();
  const { unreadCount, unreadBellCount = 0, unreadMessageCount = 0, markMessageNotificationsAsRead } = useNotifications();
  useStaleInvitationNotificationCleanup();

  // Total unread messages
  const totalChatUnread = chatUnreadCount + unreadMessageCount;
  const { themeMode } = useTheme();
  const isDesktopShell = useDesktopShell();
  const { showToast } = useToast();

  const [businessCreateOpen, setBusinessCreateOpen] = useState(false);
  const [inviteCreateOpen, setInviteCreateOpen] = useState(false);

  const viewerUid = currentUser?.uid || currentUser?.id;
  const businessNavHintEarly = useMemo(() => {
    try {
      return Boolean(viewerUid && sessionStorage.getItem('dineb_biz_uid') === viewerUid);
    } catch {
      return false;
    }
  }, [viewerUid]);
  const isBusinessAccountEarly = isBusiness || businessNavHintEarly;

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
    if (kind === 'social') {
      const q = canCreateSocialInvitation?.('social');
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
      navigate('/create-social');
      closeInviteCreate();
      return;
    }
    if (kind === 'private' || kind === 'dating') {
      const q = canCreateSocialInvitation?.('private');
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
    if (isStandalonePwa()) {
      markIosPwaLaunch();
      return;
    }
    try {
      if (!window.matchMedia('(display-mode: browser)').matches) {
        markIosPwaLaunch();
      }
    } catch {

      /* ignore */}
  }, []);

  // iOS: keep fixed app header aligned with the visual viewport when the keyboard opens (feed, comments, etc.)
  useEffect(() => {
    const path = location.pathname;
    const isChatLike =
    path.startsWith('/chat/') ||
    path === '/messages' ||
    path.startsWith('/messages') ||
    path.startsWith('/invitation/') && path.endsWith('/chat') ||
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

  const [joinedCommunityData, setJoinedCommunityData] = useState([]);

  // Auto-mark chat notifications as read when visiting chat pages or the messages inbox panel.
  useEffect(() => {
    if (!location || !markMessageNotificationsAsRead) return;

    const path = location.pathname;
    if (path === '/messages') {
      const panel = new URLSearchParams(location.search).get('panel');
      if (panel === 'notifications') return undefined;
      const timer = window.setTimeout(() => markMessageNotificationsAsRead('/messages'), 400);
      return () => window.clearTimeout(timer);
    }
    if (path.startsWith('/chat/') || path.startsWith('/community/') || path.startsWith('/invitation/')) {
      const timer = window.setTimeout(() => markMessageNotificationsAsRead(path), 500);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [location?.pathname, markMessageNotificationsAsRead]);

  // Fetch communities the current user has JOINED (from userProfile.joinedCommunities)
  useEffect(() => {
    const ids = userProfile?.joinedCommunities;
    if (!ids || ids.length === 0) {setJoinedCommunityData([]);return;}
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
            name: bi.businessName || d.display_name || d.name || t('layout_community_fallback', 'Community'),
            logo: d.photo_url || d.photoURL || d.avatar || null,
            memberCount: d.communityMembers?.length || 0
          };
        } catch {return null;}
      })
    ).then((results) => {
      if (!cancelled) setJoinedCommunityData(results.filter(Boolean));
    });
    return () => {cancelled = true;};
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
  location.pathname === '/create-private' ||
  location.pathname === '/create-social' ||
  location.pathname === '/create' ||
  location.pathname.startsWith('/create/');
  const isPrivateInvitationDeepLink =
  location.pathname.startsWith('/invitation/private/') ||
  location.pathname.startsWith('/invite/p/');
  const isCommunityChatPath = location.pathname.startsWith('/community/');
  const keepOutletMountedWhileLoading =
  isAuthRoutePath(location.pathname) ||
  (isCommunityChatPath && Boolean(currentUser?.uid)) ||
  (isAdminPath || isCreateInvitationPath || isPrivateInvitationDeepLink) &&
  Boolean(currentUser?.uid);

  if (loading && !keepOutletMountedWhileLoading) {
    return <AppShellLoading variant="session" />;
  }

  // 2. Email verification — email/password accounts (consumer or business) until verified
  // For business accounts, we allow them to continue but show the EmailVerificationBusinessBanner instead of force redirect.
  const isAdminAccount = isAdminIdentity(currentUser, userProfile);
  const privateInvitationPath =
  location.pathname.startsWith('/invitation/private/') ||
  location.pathname.startsWith('/invite/p/') ||
  location.pathname === '/create-private' ||
  location.pathname === '/create-social' ||
  location.pathname === '/create' ||
  location.pathname.startsWith('/create/');
  if (
  !isAdminAccount &&
  !isGuest &&
  currentUser &&
  userProfile &&
  needsConsumerEmailVerification(currentUser, userProfile) &&
  !privateInvitationPath)
  {
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
  const feedHomePath = APP_HOME_PATH;
  const isFeedHomeActive = isActive('/posts-feed') || isActive('/');

  const routeShell = getAppRouteShell(location.pathname, location.search, { isDesktopShell });
  const {
    isMessagesHub,
    isMessagesIndex,
    isCommunityRoute,
    isCommunityFullscreen,
    showConversationSidebar,
    isNotificationsRoute,
    hideMobileAppHeader,
    hideBottomNav,
    useChatMainLayout,
  } = routeShell;
  const isDashboardRoute = location.pathname.startsWith('/my-community');
  const isStoryRoute = location.pathname === '/create-story';
  const isAiDesignRoute = location.pathname === '/ai-design-studio';
  const isAiTextRoute = location.pathname === '/ai-text-studio';
  const isStudioRoute =
  location.pathname === '/create-post' || location.pathname === '/create-featured-post';
  const isDirectoryNavActive =
  location.pathname === '/search' ||
  location.pathname === '/search/list' ||
  location.pathname.startsWith('/search/');
  const isSearchListRoute =
  location.pathname === '/search/list' || location.pathname.startsWith('/search/list/');
  const isInboxMessagesActive = isMessagesHub && !isNotificationsRoute;
  const isAdminRoute = location.pathname.startsWith('/admin');

  const businessCreateFabActive =
  location.pathname === '/create-post' ||
  location.pathname === '/business-dashboard';

  const inviteCreateFabActive =
  location.pathname === '/create/manual' ||
  location.pathname === '/create' ||
  location.pathname === '/create-social' ||
  location.pathname === '/create-private';

  const changeLanguage = (lang) => i18n.changeLanguage(lang);

  // ── Contextual Chat Sidebar (conversations list for /chat/ & /messages) ──
  const ChatSidebar = () => {
    const { t: tl } = useTranslation();
    const seenUids = new Set();
    const filteredConvos = (conversations || []).
    filter((c) => c.otherUser).
    filter((c) => {
      if (seenUids.has(c.otherUser.uid)) return false;
      seenUids.add(c.otherUser.uid);
      return true;
    });
    return (
      <aside className="ds-left-sidebar">
                <div style={{ padding: '6px 14px 8px', fontSize: '0.9rem', fontWeight: '800', color: 'var(--text-main)', borderBottom: '1px solid var(--border-color)', marginBottom: '6px' }}>
                    💬 {tl('messages', 'Messages')}
                </div>
                {filteredConvos.length === 0 &&
        <div style={{ padding: '12px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>{t('no_conversations', 'No conversations yet')}</div>
        }
                {filteredConvos.map((convo) => {
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
                transition: 'background 0.15s'
              }}>
              
                            <UserAvatar
                user={ou}
                src={ou?.photoURL || ou?.avatar}
                alt={ou?.displayName}
                style={{ width: 38, height: 38, flexShrink: 0 }} />
              
                            <div style={{ minWidth: 0 }}>
                                <div style={{ fontWeight: '700', fontSize: '0.88rem', color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ou.displayName}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{convo.lastMessage || '...'}</div>
                            </div>
                            {convo.isUnread && <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--primary)', flexShrink: 0, marginLeft: 'auto' }} />}
                        </div>);

        })}
            </aside>);

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
                {joinedCommunityData.length === 0 &&
        <div style={{ padding: '12px', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                        {tl('no_communities_joined', 'No communities joined yet')}
                    </div>
        }
                {joinedCommunityData.map((c) => {
          const isActiveC = activeCommunityId === c.id;
          return (
            <div
              key={c.id}
              onClick={() => navigate(`/community/${c.id}`)}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '9px 12px', borderRadius: '12px', cursor: 'pointer',
                background: isActiveC ? 'var(--hover-overlay)' : 'transparent',
                transition: 'background 0.15s'
              }}>
              
                            <img src={c.logo || '/default-avatar.png'} alt={c.name}
              style={{ width: 38, height: 38, borderRadius: '10px', objectFit: 'cover', flexShrink: 0 }}
              onError={(e) => {e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="40" height="40"%3E%3Crect fill="%238b5cf6" width="40" height="40"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" fill="white" font-size="18"%3E👥%3C/text%3E%3C/svg%3E';}} />
              
                            <div style={{ minWidth: 0 }}>
                                <div style={{ fontWeight: '700', fontSize: '0.88rem', color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{c.memberCount} members</div>
                            </div>
                        </div>);

        })}
                <button
          onClick={() => navigate('/messages?tab=communities')}
          style={{ margin: '8px 12px 0', padding: '7px 12px', borderRadius: '9999px', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-muted)', fontSize: '0.82rem', cursor: 'pointer', width: 'calc(100% - 24px)' }}>
          
                    + {tl('explore_communities', 'Explore Communities')}
                </button>
            </aside>);

  };

  const Badge = ({ count, absolute }) => count > 0 ?
  <AppText as="span" style={{
    background: 'var(--primary)', color: 'white',
    borderRadius: '9999px', fontSize: '0.62rem',
    padding: '1px 5px', marginLeft: absolute ? 0 : '6px',
    fontWeight: '800', lineHeight: 1,
    position: absolute ? 'absolute' : 'static',
    top: absolute ? '-6px' : 'auto',
    right: absolute ? '-8px' : 'auto',
    border: absolute ? '2px solid var(--bg-card)' : 'none'
  }}>{count}</AppText> :
  null;

  // ── Right Sidebar Widgets ──────────────────────────────

  return (
    <div className="app-layout" dir={i18n.language === 'ar' ? 'rtl' : 'ltr'}>

            <PushNotificationPrompt />
            <PushSessionManager />
            {currentUser?.uid && !isGuest && !isBusinessAccount &&
      <>
        <InviteLandingGate />
        <InviteInboxLiveGate />
      </>
      }
            {/* ── HEADER ── hidden on mobile chat only (chat has its own bar) ── */}
            <header
              className={`app-header${hideMobileAppHeader ? ' app-header--chat' : ''}${isCommunityFullscreen ? ' app-header--community-fullscreen' : ''}`}>
                <div className="logo-wrapper" onClick={() => navigate(feedHomePath)}>
                    <img src="/db-logo.svg" alt="DineBuddies" className="app-logo-img" />
                </div>
                <div className="header-actions">
                    {!isGuest && userProfile?.role !== 'guest' ?
          <>
                            <Link
              to="/ai-design-studio"
              className={`notification-bell header-ai-studio-btn header-ai-studio-btn--image${isAiDesignRoute ? ' active' : ''}`}
              title={t('ai_image_nav', 'AI Images')}
              aria-label={t('ai_image_nav', 'AI Images')}>
              
                                <FaImages />
                            </Link>
                            <Link
              to="/ai-text-studio"
              className={`notification-bell header-ai-studio-btn header-ai-studio-btn--text${isAiTextRoute ? ' active' : ''}`}
              title={t('ai_text_nav', 'Relationship tips')}
              aria-label={t('ai_text_nav', 'Relationship tips')}>
              
                                <FaPenAlt />
                            </Link>
                            {!isBusinessAccount &&
            <Link
              to="/search/list"
              className={`notification-bell header-connect-btn${isSearchListRoute ? ' active' : ''}`}
              title={t('user_directory_list_view', 'Card view')}
              aria-label={t('user_directory_nav', 'Connect')}>
              
                                <FaUsers aria-hidden />
                            </Link>
            }
                            <Link
              to="/messages"
              className={`notification-bell${isMessagesHub || isNotificationsRoute ? ' active' : ''}`}
              aria-label={t('inbox_hub_title', 'Inbox')}
              title={t('inbox_hub_title', 'Inbox')}>
                                <FaBell />
                                {(totalChatUnread + unreadBellCount) > 0 && (
                                  <AppText as="span" className="badge">
                                    {(totalChatUnread + unreadBellCount) > 99 ? '99+' : totalChatUnread + unreadBellCount}
                                  </AppText>
                                )}
                            </Link>
                            <Link
              to="/settings"
              className={`notification-bell${isActive('/settings') || location.pathname.startsWith('/settings/') ? ' active' : ''}`}
              title={t('settings', 'Settings')}
              aria-label={t('settings', 'Settings')}>
                                <FaCog />
                            </Link>

                            <div
              className="header-profile-pic"
              onClick={() => navigate(isBusinessAccount ? `/business/${currentUser.uid}` : '/profile')}
              style={{ cursor: 'pointer', position: 'relative', lineHeight: 0 }}>
              
                                <UserAvatar
                user={userProfile || currentUser}
                alt="Profile"
                style={{ width: 40, height: 40 }} />
              
                            </div>
                        </> :

          <button onClick={() => goToLogin()} style={{ background: 'white', color: 'var(--primary)', border: 'none', padding: '8px 16px', borderRadius: '20px', fontWeight: '700', fontSize: '0.9rem', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}>
                            {t('login_signup', 'Login / Sign Up')}
                        </button>
          }
                </div>
            </header>

            {/* ── DESKTOP 3-COLUMN BODY (all routes, incl. chat) ── */}
            <div
              className={`ds-body-grid${isAdminRoute ? ' ds-body-grid--admin' : ''}${isCommunityFullscreen ? ' ds-body-grid--community-fullscreen' : ''}`}>

                {/* Column 1 — contextual left sidebar */}
                {!isAdminRoute && (showConversationSidebar ?
        <ChatSidebar /> :
        isCommunityRoute && !isCommunityFullscreen ?
        <CommunitySidebar /> :

        <aside className="ds-left-sidebar">
                        {isGuest &&
          <DesktopNavGroup variant="auth">
                            <Link to="/login" className={`ds-nav-item ${isActive('/login') ? 'active' : ''}`} style={{ color: 'var(--primary)', textDecoration: 'none' }}>
                                <FaSignInAlt /><AppText as="span">{t('nav_login', 'Login')}</AppText>
                            </Link>
          </DesktopNavGroup>
          }

                        <DesktopNavGroup title={t('nav_group_browse', 'Browse')} variant="browse">
                        <Link to={feedHomePath} className={`ds-nav-item ${isFeedHomeActive ? 'active' : ''}`}>
                            <FaHome /><AppText as="span">{t('nav_home')}</AppText>
                        </Link>
                        </DesktopNavGroup>

                        {!isGuest && userProfile?.role !== 'guest' &&
          <DesktopNavGroup title={t('nav_group_create', 'Create')} variant="create">
          <Link
            to="/ai-design-studio"
            className={`ds-nav-item ds-nav-item--ai-image${isAiDesignRoute ? ' active' : ''}`}>
                                <FaImages aria-hidden /><AppText as="span">{t('ai_image_nav', 'AI Images')}</AppText>
                            </Link>
          <Link
            to="/ai-text-studio"
            className={`ds-nav-item ds-nav-item--ai-text${isAiTextRoute ? ' active' : ''}`}>
                                <FaPenAlt aria-hidden /><AppText as="span">{t('ai_text_nav', 'AI Text')}</AppText>
                            </Link>
                        {!isBusinessAccount && currentUser &&
          <button
            type="button"
            className={`ds-nav-item${inviteCreateFabActive || inviteCreateOpen ? ' active' : ''}`}
            onClick={openInviteCreate}
            aria-haspopup="dialog"
            aria-expanded={inviteCreateOpen}>
            
                                <FaPlusCircle /><AppText as="span">{t('create_invitation', 'Create Invitation')}</AppText>
                            </button>
          }
          </DesktopNavGroup>
          }

                        <DesktopNavGroup title={t('nav_group_discover', 'Discover')} variant="discover">
                        <Link to="/invitations" className={`ds-nav-item ${isActive('/invitations') ? 'active' : ''}`}>
                            <FaEnvelope /><AppText as="span">{t('nav_invitations', 'Invitations')}</AppText>
                        </Link>
                        <Link to="/restaurants" className={`ds-nav-item ${isActive('/restaurants') ? 'active' : ''}`}>
                            <FaStore /><AppText as="span">{t('nav_partners', 'Businesses')}</AppText>
                        </Link>
                        {!isBusinessAccount && !isGuest && userProfile?.role !== 'guest' &&
          <Link to="/search" className={`ds-nav-item ${isDirectoryNavActive ? 'active' : ''}`}>
                                <FaUsers /><AppText as="span">{t('user_directory_nav', 'Connect')}</AppText>
                            </Link>
          }
                        </DesktopNavGroup>

                        {!isGuest &&
          <DesktopNavGroup title={t('nav_group_inbox', 'Inbox')} variant="inbox">
                                <Link to="/messages" className={`ds-nav-item ${isInboxMessagesActive ? 'active' : ''}`}>
                                    <div style={{ position: 'relative', display: 'inline-flex' }}>
                                        <FaComments />
                                        <Badge count={totalChatUnread} absolute />
                                    </div>
                                    <AppText as="span">{t('nav_messages', 'Messages')}</AppText>
                                </Link>
                                <Link to="/messages?panel=notifications" className={`ds-nav-item ${isNotificationsRoute ? 'active' : ''}`}>
                                    <div style={{ position: 'relative', display: 'inline-flex' }}>
                                        <FaBell />
                                        <Badge count={unreadBellCount} absolute />
                                    </div>
                                    <AppText as="span">{t('notifications', 'Notifications')}</AppText>
                                </Link>
          </DesktopNavGroup>
          }

                        {isBusinessAccount && currentUser &&
          <DesktopNavGroup title={t('nav_group_business', 'Business')} variant="business">
            <button
              type="button"
              className={`ds-nav-item${businessCreateFabActive ? ' active' : ''}`}
              onClick={() => setBusinessCreateOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={businessCreateOpen}>
              
                                        <FaPlusCircle /><AppText as="span">{t('business_nav_create_posts', 'Create posts')}</AppText>
                                    </button>
            <Link
              to={`/business/${currentUser.uid}`}
              className={`ds-nav-item ${location.pathname === `/business/${currentUser.uid}` ? 'active' : ''}`}>
              
                                        <FaStore /><AppText as="span">{t('profile_title', 'My Profile')}</AppText>
                                    </Link>
            <Link
              to="/my-community"
              className={`ds-nav-item ${location.pathname.startsWith('/my-community') ? 'active' : ''}`}>
              
                                        <FaThLarge /><AppText as="span">{t('business_dashboard', 'Dashboard')}</AppText>
                                    </Link>
          </DesktopNavGroup>
          }

                        {(!isGuest || !isBusinessAccount) &&
          <DesktopNavGroup title={t('nav_group_settings', 'Settings')} variant="settings">
                        {!isGuest &&
          <Link to={isBusinessAccount ? '/business-dashboard' : '/profile'} className={`ds-nav-item ${isActive('/profile') || isActive('/business-dashboard') ? 'active' : ''}`}>
                                    <FaUser /><AppText as="span">{isBusinessAccount ? t('dashboard', 'Dashboard') : t('profile', 'Profile')}</AppText>
                                </Link>
          }
                        {!isBusinessAccount && (
          isGuest ?
          <Link
            to={buildLoginPath({ returnPath: '/settings' })}
            className={`ds-nav-item ${isActive('/login') ? 'active' : ''}`}>
            
                                    <FaCog /><AppText as="span">{t('settings', 'Settings')}</AppText>
                                </Link> :

          <Link to="/settings" className={`ds-nav-item ${isActive('/settings') ? 'active' : ''}`}>
                                    <FaCog /><AppText as="span">{t('settings', 'Settings')}</AppText>
                                </Link>)

          }
                        {isAdminAccount &&
          <Link to="/admin/users" className={`ds-nav-item ${location.pathname.startsWith('/admin') ? 'active' : ''}`}>
                                <FaCrown /><AppText as="span">Admin</AppText>
                            </Link>
          }
          </DesktopNavGroup>
          }

                    </aside>)
        }

                {/* Column 2 — Main content */}
                <main
                  className={`app-main${useChatMainLayout ? ' app-main--chat' : ''}${isMessagesIndex ? ' app-main--messages-index' : ''}${isStoryRoute || isStudioRoute ? ' app-main--fullscreen' : ''}${isCommunityFullscreen ? ' app-main--community-fullscreen' : ''}${isAdminRoute ? ' app-main--admin' : ''}${isDashboardRoute ? ' app-main--dashboard' : ''}`}>
                    {!isSearchListRoute && !isCommunityFullscreen && <EmailVerificationBusinessBanner />}
                    {!isSearchListRoute && !isCommunityFullscreen && <UnpublishedBusinessReminder />}
                    {children}
                    <Suspense fallback={<AppRouteLoading variant="route" />}>
                        <Outlet />
                    </Suspense>
                </main>

                {/* Column 3 — Right widgets */}
                {!isAdminRoute && !isCommunityFullscreen && <DesktopRightSidebar />}
            </div>

            {/* ── MOBILE BOTTOM NAV (admin uses embedded nav in AdminLayout) ── */}
            {!hideBottomNav && !isAdminRoute && !isStudioRoute &&
      <nav className="bottom-nav user-nav">
                    <Link to={feedHomePath} className={`nav-item ${isFeedHomeActive ? 'active' : ''}`}>
                        <FaHome className="nav-icon" />
                        <AppText as="span">{t('nav_home')}</AppText>
                    </Link>
                    <Link to="/invitations" className={`nav-item ${isActive('/invitations') ? 'active' : ''}`}>
                        <FaEnvelope className="nav-icon" />
                        <AppText as="span">{t('nav_invitations', 'Invitations')}</AppText>
                    </Link>
                    {isGuest ?
        <Link to="/login" className={`nav-item ${isActive('/login') ? 'active' : ''}`} style={{ color: 'var(--primary)', textDecoration: 'none' }}>
                            <FaSignInAlt className="nav-icon" />
                            <AppText as="span">{t('nav_login', 'Login')}</AppText>
                        </Link> :
        !isBusinessAccount ?
        <button
          type="button"
          className={`nav-item fab-nav-item${inviteCreateFabActive ? ' active' : ''}`}
          onClick={openInviteCreate}
          aria-haspopup="dialog"
          aria-expanded={inviteCreateOpen}
          aria-label={t('invite_create_menu', 'Create invitation')}>
          
                            <div className="fab-container"><FaPlusCircle className="nav-icon fab" /></div>
                        </button> :
        null}
                    {isBusinessAccount &&
        <button
          type="button"
          className={`nav-item fab-nav-item${businessCreateFabActive ? ' active' : ''}`}
          onClick={() => setBusinessCreateOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={businessCreateOpen}
          aria-label={t('business_create_menu', 'Create')}>
          
                            <div className="fab-container"><FaPlusCircle className="nav-icon fab" /></div>
                        </button>
        }
                    <Link to="/restaurants" className={`nav-item ${isActive('/restaurants') ? 'active' : ''}`}>
                        <FaStore className="nav-icon" />
                        <AppText as="span">{t('nav_partners', 'Businesses')}</AppText>
                    </Link>
                    {!isBusinessAccount && !isGuest && userProfile?.role !== 'guest' &&
        <Link to="/search" className={`nav-item ${isDirectoryNavActive ? 'active' : ''}`}>
                            <div className="friend-nav-icon-container"><FaUsers className="nav-icon" /></div>
                            <AppText as="span">{t('user_directory_nav', 'Connect')}</AppText>
                        </Link>
        }
                    {isBusinessAccount &&
        <Link to="/my-community" className={`nav-item ${location.pathname.startsWith('/my-community') ? 'active' : ''}`}>
                            <div className="friend-nav-icon-container"><FaThLarge className="nav-icon" /></div>
                            <AppText as="span">{t('business_dashboard', 'Dashboard')}</AppText>
                        </Link>
        }
                    {isAdminAccount &&
        <Link to="/admin/users" className={`nav-item ${location.pathname.startsWith('/admin') ? 'active' : ''}`}>
                            <FaCrown className="nav-icon" />
                            <AppText as="span">Admin</AppText>
                        </Link>
        }
                </nav>
      }

            {!isBusinessAccount && !isGuest && inviteCreateOpen &&
      <div
        className="business-create-overlay"
        role="presentation"
        onClick={closeInviteCreate}>
        
                    <div
          className="business-create-sheet"
          role="dialog"
          aria-modal="true"
          aria-labelledby="invite-create-title"
          onClick={(e) => e.stopPropagation()}>
          
                        <div className="business-create-sheet__header">
                            <div className="business-create-sheet__titles">
                                <AppText as="h2" id="invite-create-title" className="business-create-sheet__title">
                                    {t('invite_create_title', 'Create invitation')}
                                </AppText>
                                <AppText as="p" className="business-create-sheet__subtitle">
                                    {t(
                  'invite_create_subtitle',
                  'Choose the type of invitation you want to create.'
                )}
                                </AppText>
                            </div>
                            <button
              type="button"
              className="business-create-sheet__close"
              onClick={closeInviteCreate}
              aria-label={t('close', 'Close')}>
              
                                <FaTimes />
                            </button>
                        </div>
                        <div className="business-create-sheet__options">
                            <button
              type="button"
              className="business-create-option"
              onClick={() => finishInviteCreateManual('public')}>
              
                                <AppText as="span" className="business-create-option__icon business-create-option__icon--public" aria-hidden>
                                    <FaGlobe />
                                </AppText>
                                <AppText as="span" className="business-create-option__text">
                                    <AppText as="span" className="business-create-option__label">
                                        {t('invite_create_public_title', 'Public invitation')}
                                    </AppText>
                                    <AppText as="span" className="business-create-option__desc">
                                        {t(
                    'invite_create_public_desc',
                    'A discoverable invitation others can browse and join.'
                  )}
                                    </AppText>
                                </AppText>
                                <FaChevronRight className="business-create-option__arrow" aria-hidden />
                            </button>
                            <button
              type="button"
              className="business-create-option"
              onClick={() => finishInviteCreateManual('social')}>
              
                                <AppText as="span" className="business-create-option__icon business-create-option__icon--private" aria-hidden>
                                    <FaLock />
                                </AppText>
                                <AppText as="span" className="business-create-option__text">
                                    <AppText as="span" className="business-create-option__label">
                                        {t('invite_create_social_title', 'Social Invite')}
                                    </AppText>
                                    <AppText as="span" className="business-create-option__desc">
                                        {t(
                    'invite_create_social_desc',
                    'Invite specific guests with a private link.'
                  )}
                                    </AppText>
                                </AppText>
                                <FaChevronRight className="business-create-option__arrow" aria-hidden />
                            </button>
                            <button
              type="button"
              className="business-create-option"
              onClick={() => finishInviteCreateManual('private')}>
              
                                <AppText as="span" className="business-create-option__icon business-create-option__icon--dating" aria-hidden>
                                    <FaHeart />
                                </AppText>
                                <AppText as="span" className="business-create-option__text">
                                    <AppText as="span" className="business-create-option__label">
                                        {t('invite_create_private_title', 'Personal Invite')}
                                    </AppText>
                                    <AppText as="span" className="business-create-option__desc">
                                        {t(
                    'invite_create_private_desc',
                    'A private-style invitation for matched dining.'
                  )}
                                    </AppText>
                                </AppText>
                                <FaChevronRight className="business-create-option__arrow" aria-hidden />
                            </button>
                        </div>
                    </div>
                </div>
      }

            {isBusinessAccount && businessCreateOpen &&
      <div
        className="business-create-overlay"
        role="presentation"
        onClick={() => setBusinessCreateOpen(false)}>
        
                    <div
          className="business-create-sheet"
          role="dialog"
          aria-modal="true"
          aria-labelledby="business-create-title"
          onClick={(e) => e.stopPropagation()}>
          
                        <div className="business-create-sheet__header">
                            <div className="business-create-sheet__titles">
                                <AppText as="h2" id="business-create-title" className="business-create-sheet__title">
                                    {t('business_create_title', 'Create')}
                                </AppText>
                                <AppText as="p" className="business-create-sheet__subtitle">
                                    {t('business_create_subtitle', 'Choose what you want to publish')}
                                </AppText>
                            </div>
                            <button
              type="button"
              className="business-create-sheet__close"
              onClick={() => setBusinessCreateOpen(false)}
              aria-label={t('close', 'Close')}>
              
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
              }}>
              
                                <AppText as="span" className="business-create-option__icon business-create-option__icon--featured" aria-hidden>
                                    <FaImages />
                                </AppText>
                                <AppText as="span" className="business-create-option__text">
                                    <AppText as="span" className="business-create-option__label">
                                        {t('business_create_featured_title', 'Featured Post')}
                                    </AppText>
                                    <AppText as="span" className="business-create-option__desc">
                                        {t(
                    'business_create_featured_desc',
                    'Elite slide on the home feed for all users.'
                  )}
                                    </AppText>
                                </AppText>
                                <FaChevronRight className="business-create-option__arrow" aria-hidden />
                            </button>
                            <button
              type="button"
              className="business-create-option"
              onClick={() => {
                setBusinessCreateOpen(false);
                navigate('/create-post');
              }}>
              
                                <AppText as="span" className="business-create-option__icon business-create-option__icon--motion" aria-hidden>
                                    <FaPhotoVideo />
                                </AppText>
                                <AppText as="span" className="business-create-option__text">
                                    <AppText as="span" className="business-create-option__label">
                                        {t('business_create_studio_title', 'Motion post')}
                                    </AppText>
                                    <AppText as="span" className="business-create-option__desc">
                                        {t(
                    'business_create_studio_desc',
                    'Animated studio post in the community feed.'
                  )}
                                    </AppText>
                                </AppText>
                                <FaChevronRight className="business-create-option__arrow" aria-hidden />
                            </button>
                        </div>
                    </div>
                </div>
      }
        </div>);

};

export default Layout;