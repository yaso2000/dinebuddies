import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation, Outlet } from 'react-router-dom';
import { FaHome, FaPlusCircle, FaUser, FaGlobe, FaBell, FaStore, FaUsers, FaBuilding, FaSearch, FaComments, FaNewspaper, FaCrown, FaCog, FaEnvelope } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';
import { useInvitations } from '../context/InvitationContext';
import { useChat } from '../context/ChatContext';
import { useNotifications } from '../context/NotificationContext';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import ProfileCompletionModal from './ProfileCompletionModal';
import { getSafeAvatar } from '../utils/avatarUtils';

const Layout = ({ children }) => {
    const [imgLoaded, setImgLoaded] = useState(false);
    const location = useLocation();
    const navigate = useNavigate();
    const { t, i18n } = useTranslation();
    const { getFollowingInvitations, currentUser } = useInvitations();
    const { unreadCount: chatUnreadCount } = useChat();
    const { unreadCount } = useNotifications();
    const { userProfile, isGuest, loading: authLoading } = useAuth();
    const { themeMode } = useTheme();



    const isActive = (path) => location.pathname === path;

    // Reset image loading state when avatar changes
    useEffect(() => {
        setImgLoaded(false);
    }, [userProfile?.photoURL, userProfile?.photo_url, userProfile?.avatar]);

    // Check if current user is a business account (Broad check for legacy compatibility)
    const isBusinessAccount = userProfile?.accountType === 'business' || userProfile?.role === 'partner';

    const friendActivities = getFollowingInvitations ? getFollowingInvitations() : [];
    const hasFriendsActive = friendActivities.length > 0;

    const changeLanguage = (lang) => {
        i18n.changeLanguage(lang);
    };

    // Note: Authentication is handled by Firebase - no need for manual redirect
    // Users will be redirected by Firebase if not authenticated

    // Show loading state while checking authentication


    return (
        <div className="app-layout" dir={i18n.language === 'ar' ? 'rtl' : 'ltr'}>

            {/* Profile Completion Modal */}
            <ProfileCompletionModal />
            {/* Header - Hidden on Chat Screens */}
            {!location.pathname.startsWith('/chat/') && !location.pathname.startsWith('/community/') && !(location.pathname.startsWith('/invitation/') && location.pathname.endsWith('/chat')) && (
                <header className="app-header">
                    <div className="logo-wrapper" onClick={() => navigate('/')} style={{ display: 'flex', alignItems: 'center' }}>
                        <img
                            src="/logo-w.png"
                            alt="DineBuddies"
                            className="app-logo-img"
                        />
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
                                {/* Profile Icon - Only show for logged in users */}
                                <div
                                    className="header-profile-pic"
                                    onClick={() => {
                                        if (isBusinessAccount) {
                                            navigate('/business-dashboard');
                                        } else {
                                            navigate('/profile');
                                        }
                                    }}
                                    style={{
                                        width: '40px',
                                        height: '40px',
                                        borderRadius: '50%',
                                        overflow: 'hidden',
                                        border: '1px solid var(--border-color)',
                                        cursor: 'pointer',
                                        position: 'relative',
                                        background: 'var(--hover-overlay)'
                                    }}
                                >
                                    {!imgLoaded && (
                                        <div style={{
                                            position: 'absolute',
                                            inset: 0,
                                            background: 'linear-gradient(90deg, var(--bg-input) 25%, var(--border-color) 50%, var(--bg-input) 75%)',
                                            backgroundSize: '200% 100%',
                                            animation: 'shimmer 1.5s infinite',
                                        }} />
                                    )}
                                    <img
                                        src={getSafeAvatar(userProfile)}
                                        alt="Profile"
                                        onLoad={() => setImgLoaded(true)}
                                        onError={() => {
                                            setImgLoaded(true);
                                        }} // Avoid stuck loading
                                        style={{
                                            width: '100%',
                                            height: '100%',
                                            objectFit: 'cover',
                                            opacity: imgLoaded ? 1 : 0,
                                            transition: 'opacity 0.3s ease-in-out'
                                        }}
                                    />
                                </div>
                            </>
                        ) : (
                            <button
                                onClick={() => navigate('/login')}
                                style={{
                                    background: 'white',
                                    color: 'var(--primary)',
                                    border: 'none',
                                    padding: '8px 16px',
                                    borderRadius: '20px',
                                    fontWeight: '700',
                                    fontSize: '0.9rem',
                                    cursor: 'pointer',
                                    boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
                                }}
                            >
                                {t('login_signup', 'Login / Sign Up')}
                            </button>
                        )}
                    </div>
                </header>
            )}

            {/* Main Content */}
            <main className="app-main" style={{
                paddingBottom: (location.pathname.startsWith('/chat/') || location.pathname.startsWith('/community/') || (location.pathname.startsWith('/invitation/') && location.pathname.endsWith('/chat'))) ? '0' : undefined
            }}>
                {children}
                <Outlet />
            </main>



            {/* Bottom Navigation - User Only - Hidden on Chat Screens */}
            {!location.pathname.startsWith('/chat/') && !location.pathname.startsWith('/community/') && !(location.pathname.startsWith('/invitation/') && location.pathname.endsWith('/chat')) && (
                <nav className="bottom-nav user-nav">
                    <Link to="/" className={`nav-item ${isActive('/') ? 'active' : ''}`}>
                        <FaHome className="nav-icon" />
                        <span>{t('nav_home')}</span>
                    </Link>

                    {/* Invitations - Visible to Everyone (Guest, Regular, Business) */}
                    <Link to="/invitations" className={`nav-item ${isActive('/invitations') ? 'active' : ''}`}>
                        <FaEnvelope className="nav-icon" />
                        <span>{t('nav_invitations', 'Invitations')}</span>
                    </Link>

                    {/* Create Post (Center FAB) - For Regular Users Only */}
                    {!isBusinessAccount && !isGuest && (
                        <Link
                            to="/create-post"
                            className={`nav-item fab-nav-item ${isActive('/create-post') ? 'active' : ''}`}
                        >
                            <div className="fab-container">
                                <FaPlusCircle className="nav-icon fab" />
                            </div>
                        </Link>
                    )}

                    {/* Create Post - For Business Accounts */}
                    {isBusinessAccount && (
                        <Link
                            to="/create-post"
                            className={`nav-item fab-nav-item ${isActive('/create-post') ? 'active' : ''}`}
                        >
                            <div className="fab-container">
                                <FaPlusCircle className="nav-icon fab" />
                            </div>
                        </Link>
                    )}

                    {/* Partners - Show for everyone (Business Directory) */}
                    <Link to="/restaurants" className={`nav-item ${isActive('/restaurants') ? 'active' : ''}`}>
                        <FaStore className="nav-icon" />
                        <span>{t('nav_partners', 'Partners')}</span>
                    </Link>

                    {/* Show Communities for regular users, not guests */}
                    {!isBusinessAccount && !isGuest && userProfile?.accountType !== 'guest' && (
                        <Link to="/communities" className={`nav-item ${isActive('/communities') ? 'active' : ''}`}>
                            <div className="friend-nav-icon-container">
                                <FaUsers className="nav-icon" />
                            </div>
                            <span>{t('communities')}</span>
                        </Link>
                    )}



                    {/* Show My Community for business accounts only */}
                    {isBusinessAccount && (
                        <Link to="/my-community" className={`nav-item ${isActive('/my-community') ? 'active' : ''}`}>
                            <div className="friend-nav-icon-container">
                                <FaUsers className="nav-icon" />
                            </div>
                            <span>{t('my_community')}</span>
                        </Link>
                    )}

                    {/* Show Admin Dashboard for admin accounts only */}
                    {(
                        userProfile?.role === 'admin' ||
                        userProfile?.accountType === 'admin' ||
                        ['admin@dinebuddies.com', 'yaser@dinebuddies.com', 'info@dinebuddies.com.au', 'y.abohamed@gmail.com'].includes(currentUser?.email?.toLowerCase()) ||
                        currentUser?.uid === 'xTgHC1v00LZIZ6ESA9YGjGU5zW33'
                    ) && (
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
