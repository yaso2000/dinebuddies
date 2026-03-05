import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation, Outlet } from 'react-router-dom';
import { FaHome, FaPlusCircle, FaBell, FaStore, FaUsers, FaComments, FaCrown, FaCog, FaEnvelope, FaUser, FaClock, FaFire } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';
import { useInvitations } from '../context/InvitationContext';
import { useChat } from '../context/ChatContext';
import { useNotifications } from '../context/NotificationContext';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import ProfileCompletionModal from './ProfileCompletionModal';
import { getSafeAvatar } from '../utils/avatarUtils';
import { collection, query, orderBy, limit, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import OffersBanner from './OffersBanner';

const Layout = ({ children }) => {
    const [imgLoaded, setImgLoaded] = useState(false);
    const location = useLocation();
    const navigate = useNavigate();
    const { t, i18n } = useTranslation();
    const { invitations, getFollowingInvitations, currentUser } = useInvitations();
    const { unreadCount: chatUnreadCount } = useChat();
    const { unreadCount } = useNotifications();
    const { userProfile, isGuest } = useAuth();
    const { themeMode } = useTheme();

    // Right sidebar data
    const [trendingPartners, setTrendingPartners] = useState([]);
    const [recentCommunities, setRecentCommunities] = useState([]);
    const [joinedCommunityData, setJoinedCommunityData] = useState([]);

    const isActive = (path) => location.pathname === path;
    const isBusinessAccount = userProfile?.role === 'business';

    // Route type detection
    const isChatRoute = location.pathname.startsWith('/chat/') ||
        location.pathname === '/messages' ||
        location.pathname.startsWith('/messages') ||
        (location.pathname.startsWith('/invitation/') && location.pathname.endsWith('/chat'));
    const isCommunityRoute = location.pathname.startsWith('/community/');
    const isStoryRoute = location.pathname === '/create-story';
    const isChatScreen = isChatRoute || isCommunityRoute; // mobile: hide bottom nav

    // Reset avatar on change
    useEffect(() => {
        setImgLoaded(false);
    }, [userProfile?.photoURL, userProfile?.photo_url, userProfile?.avatar]);


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
                    if (!['business', 'partner'].includes(d.accountType) && d.role !== 'business') return null;
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

    const changeLanguage = (lang) => i18n.changeLanguage(lang);

    // Latest invitations for right sidebar
    const latestInvitations = invitations?.slice(0, 3) || [];

    // ── Contextual Chat Sidebar (conversations list for /chat/ & /messages) ──
    const { conversations } = useChat();
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

    const Badge = ({ count }) => count > 0 ? (
        <span style={{
            background: 'var(--primary)', color: 'white',
            borderRadius: '9999px', fontSize: '0.62rem',
            padding: '1px 5px', marginLeft: '6px',
            fontWeight: '800', lineHeight: 1
        }}>{count}</span>
    ) : null;

    // ── Right Sidebar Widgets ──────────────────────────────
    const [hasOffers, setHasOffers] = useState(false);

    const RightSidebar = () => (
        <aside className="ds-right-sidebar">

            {/* ── Offers Banner (desktop only) ── */}
            <OffersBanner onHasOffers={setHasOffers} />

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
                        <span>{t('trending_partners', 'Trending Partners')}</span>
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
                                <div className="ds-widget-sub">⭐ {r.rating || '—'} · {r.cuisine || 'Restaurant'}</div>
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
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', paddingLeft: '4px', lineHeight: 2 }}>
                © {new Date().getFullYear()} DineBuddies ·{' '}
                <Link to="/settings" style={{ color: 'var(--text-muted)' }}>Settings</Link>
            </div>
        </aside>
    );

    return (
        <div className="app-layout" dir={i18n.language === 'ar' ? 'rtl' : 'ltr'}>

            <ProfileCompletionModal />

            {/* ── HEADER ── always on desktop, hidden on mobile chat ── */}
            <header className={`app-header${isChatScreen ? ' app-header--chat' : ''}`}>
                <div className="logo-wrapper" onClick={() => navigate('/')}>
                    <img src="/db-logo.svg" alt="DineBuddies" className="app-logo-img" />
                    <span className="app-name">DineBuddies</span>
                </div>
                <div className="header-actions">
                    {!isGuest && userProfile?.accountType !== 'guest' ? (
                        <>
                            <Link to="/messages" className="notification-bell">
                                <FaComments />
                                {chatUnreadCount > 0 && <span className="badge">{chatUnreadCount}</span>}
                            </Link>
                            <Link to="/notifications" className="notification-bell">
                                <FaBell />
                                {unreadCount > 0 && <span className="badge">{unreadCount}</span>}
                            </Link>
                            <Link to="/settings" className="notification-bell" title={t('settings', 'Settings')}>
                                <FaCog />
                            </Link>

                            <div
                                className="header-profile-pic"
                                onClick={() => navigate(isBusinessAccount ? (window.innerWidth >= 1024 ? '/business-pro' : '/business-dashboard') : '/profile')}
                                style={{ width: '40px', height: '40px', borderRadius: '50%', overflow: 'hidden', border: '1px solid var(--border-color)', cursor: 'pointer', position: 'relative', background: 'var(--hover-overlay)' }}
                            >
                                {!imgLoaded && (
                                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, var(--bg-input) 25%, var(--border-color) 50%, var(--bg-input) 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite' }} />
                                )}
                                <img
                                    src={getSafeAvatar(userProfile)}
                                    alt="Profile"
                                    onLoad={() => setImgLoaded(true)}
                                    onError={() => setImgLoaded(true)}
                                    style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: imgLoaded ? 1 : 0, transition: 'opacity 0.3s' }}
                                />
                            </div>
                        </>
                    ) : (
                        <button onClick={() => navigate('/login')} style={{ background: 'white', color: 'var(--primary)', border: 'none', padding: '8px 16px', borderRadius: '20px', fontWeight: '700', fontSize: '0.9rem', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}>
                            {t('login_signup', 'Login / Sign Up')}
                        </button>
                    )}
                </div>
            </header>

            {/* ── DESKTOP 3-COLUMN BODY (all routes, incl. chat) ── */}
            <div className="ds-body-grid">

                {/* Column 1 — contextual left sidebar */}
                {isChatRoute ? (
                    <ChatSidebar />
                ) : isCommunityRoute ? (
                    <CommunitySidebar />
                ) : (
                    <aside className="ds-left-sidebar">
                        <Link to="/" className={`ds-nav-item ${isActive('/') ? 'active' : ''}`}>
                            <FaHome /><span>{t('nav_home')}</span>
                        </Link>
                        <Link to="/invitations" className={`ds-nav-item ${isActive('/invitations') ? 'active' : ''}`}>
                            <FaEnvelope /><span>{t('nav_invitations', 'Invitations')}</span>
                        </Link>
                        <Link to="/restaurants" className={`ds-nav-item ${isActive('/restaurants') ? 'active' : ''}`}>
                            <FaStore /><span>{t('nav_partners', 'Partners')}</span>
                        </Link>
                        {!isBusinessAccount && !isGuest && userProfile?.accountType !== 'guest' && (
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
                                            <FaComments />
                                            <span>{t('nav_messages', 'Messages')}<Badge count={chatUnreadCount} /></span>
                                        </Link>
                                        <Link to="/notifications" className={`ds-nav-item ${isActive('/notifications') ? 'active' : ''}`}>
                                            <FaBell />
                                            <span>{t('notifications', 'Notifications')}<Badge count={unreadCount} /></span>
                                        </Link>
                                    </>
                                )}
                                <Link to={isBusinessAccount ? '/business-pro' : '/profile'} className={`ds-nav-item ${isActive('/profile') || isActive('/business-pro') ? 'active' : ''}`}>
                                    <FaUser /><span>{isBusinessAccount ? 'Dashboard' : t('profile', 'Profile')}</span>
                                </Link>
                                {isBusinessAccount && currentUser && (
                                    <Link
                                        to={`/partner/${currentUser.uid}`}
                                        className={`ds-nav-item ${location.pathname === `/partner/${currentUser.uid}` ? 'active' : ''}`}
                                    >
                                        <FaStore /><span>My Profile</span>
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
                        {(userProfile?.role === 'admin' || ['admin@dinebuddies.com', 'yaser@dinebuddies.com', 'info@dinebuddies.com.au', 'y.abohamed@gmail.com'].includes(currentUser?.email?.toLowerCase()) || currentUser?.uid === 'xTgHC1v00LZIZ6ESA9YGjGU5zW33') && (
                            <Link to="/admin" className={`ds-nav-item ${isActive('/admin') ? 'active' : ''}`}>
                                <FaCrown /><span>Admin</span>
                            </Link>
                        )}
                        {!isBusinessAccount && !isGuest && (
                            <button className="ds-create-btn" onClick={() => navigate('/create-post')}>
                                ✏️ {t('create', 'New Post')}
                            </button>
                        )}
                    </aside>
                )}

                {/* Column 2 — Main content */}
                <main className={`app-main${isChatScreen ? ' app-main--chat' : ''}${isStoryRoute ? ' app-main--fullscreen' : ''}`}>
                    {children}
                    <Outlet />
                </main>

                {/* Column 3 — Right widgets */}
                <RightSidebar />
            </div>

            {/* ── MOBILE BOTTOM NAV ── */}
            {!isChatScreen && (
                <nav className="bottom-nav user-nav">
                    <Link to="/" className={`nav-item ${isActive('/') ? 'active' : ''}`}>
                        <FaHome className="nav-icon" />
                        <span>{t('nav_home')}</span>
                    </Link>
                    <Link to="/invitations" className={`nav-item ${isActive('/invitations') ? 'active' : ''}`}>
                        <FaEnvelope className="nav-icon" />
                        <span>{t('nav_invitations', 'Invitations')}</span>
                    </Link>
                    {!isBusinessAccount && !isGuest && (
                        <Link to="/create-post" className={`nav-item fab-nav-item ${isActive('/create-post') ? 'active' : ''}`}>
                            <div className="fab-container"><FaPlusCircle className="nav-icon fab" /></div>
                        </Link>
                    )}
                    {isBusinessAccount && (
                        <Link to="/create-post" className={`nav-item fab-nav-item ${isActive('/create-post') ? 'active' : ''}`}>
                            <div className="fab-container"><FaPlusCircle className="nav-icon fab" /></div>
                        </Link>
                    )}
                    <Link to="/restaurants" className={`nav-item ${isActive('/restaurants') ? 'active' : ''}`}>
                        <FaStore className="nav-icon" />
                        <span>{t('nav_partners', 'Partners')}</span>
                    </Link>
                    {!isBusinessAccount && !isGuest && userProfile?.accountType !== 'guest' && (
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
                    {(userProfile?.role === 'admin' || ['admin@dinebuddies.com', 'yaser@dinebuddies.com', 'info@dinebuddies.com.au', 'y.abohamed@gmail.com'].includes(currentUser?.email?.toLowerCase()) || currentUser?.uid === 'xTgHC1v00LZIZ6ESA9YGjGU5zW33') && (
                        <Link to="/admin" className={`nav-item ${isActive('/admin') ? 'active' : ''}`}>
                            <FaCrown className="nav-icon" />
                            <span>Admin</span>
                        </Link>
                    )}
                </nav>
            )}
        </div>
    );
};

export default Layout;
