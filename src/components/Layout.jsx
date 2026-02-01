import React from 'react';
import { useNavigate, Link, useLocation, Outlet } from 'react-router-dom';
import { FaHome, FaPlusCircle, FaUser, FaGlobe, FaBell, FaStore, FaUsers, FaBuilding, FaSearch, FaComments, FaNewspaper } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';
import { useInvitations } from '../context/InvitationContext';
import { useChat } from '../context/ChatContext';
import { useNotifications } from '../context/NotificationContext';
import { useAuth } from '../context/AuthContext';

const Layout = ({ children }) => {
    const location = useLocation();
    const navigate = useNavigate();
    const { t, i18n } = useTranslation();
    const { getFollowingInvitations, currentUser } = useInvitations();
    const { unreadCount: chatUnreadCount } = useChat();
    const { unreadCount } = useNotifications();
    const { userProfile } = useAuth();

    const isActive = (path) => location.pathname === path;

    // Check if current user is a business account
    const isBusinessAccount = userProfile?.accountType === 'business';

    const friendActivities = getFollowingInvitations ? getFollowingInvitations() : [];
    const hasFriendsActive = friendActivities.length > 0;

    const changeLanguage = (lang) => {
        i18n.changeLanguage(lang);
    };

    // Note: Authentication is handled by Firebase - no need for manual redirect
    // Users will be redirected by Firebase if not authenticated

    // Show loading state while checking authentication
    if (!currentUser) {
        return (
            <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                height: '100vh',
                background: 'var(--background)'
            }}>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🍽️</div>
                    <div>Loading DineBuddies...</div>
                </div>
            </div>
        );
    }

    return (
        <div className="app-layout" dir={i18n.language === 'ar' ? 'rtl' : 'ltr'}>
            {/* Header */}
            <header className="app-header">
                <div className="logo-wrapper" onClick={() => navigate('/')}>
                    <span className="app-logo">🍽️</span>
                    <span className="app-name">DineBuddies</span>
                </div>
                <div className="header-actions">
                    <Link to="/messages" className="notification-bell">
                        <FaComments />
                        {chatUnreadCount > 0 && <span className="badge">{chatUnreadCount}</span>}
                    </Link>
                    <Link to="/notifications" className="notification-bell">
                        <FaBell />
                        {unreadCount > 0 && <span className="badge">{unreadCount}</span>}
                    </Link>
                    <div
                        className="header-profile-pic"
                        onClick={() => navigate('/profile')}
                        style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '50%',
                            overflow: 'hidden',
                            border: '2px solid rgba(255, 255, 255, 0.2)',
                            cursor: 'pointer',
                        }}
                    >
                        <img
                            src={currentUser?.avatar || 'https://via.placeholder.com/150'}
                            alt="Profile"
                            style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover'
                            }}
                        />
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="app-main">
                {children}
                <Outlet />
            </main>

            {/* Bottom Navigation - User Only */}
            <nav className="bottom-nav user-nav">
                <Link to="/" className={`nav-item ${isActive('/') ? 'active' : ''}`}>
                    <FaHome className="nav-icon" />
                    <span>{t('nav_home')}</span>
                </Link>

                <Link to="/restaurants" className={`nav-item ${isActive('/restaurants') ? 'active' : ''}`}>
                    <FaStore className="nav-icon" />
                    <span>{t('nav_partners')}</span>
                </Link>

                {/* Only show Create for regular users, not business accounts */}
                {!isBusinessAccount && (
                    <Link
                        to="/create"
                        className={`nav-item fab-nav-item ${isActive('/create') ? 'active' : ''}`}
                    >
                        <div className="fab-container">
                            <FaPlusCircle className="nav-icon fab" />
                        </div>
                        <span className="fab-label">{t('nav_create')}</span>
                    </Link>
                )}

                {/* Show Communities for regular users */}
                {!isBusinessAccount && (
                    <Link to="/communities" className={`nav-item ${isActive('/communities') ? 'active' : ''}`}>
                        <div className="friend-nav-icon-container">
                            <FaUsers className="nav-icon" />
                        </div>
                        <span>{i18n.language === 'ar' ? 'مجتمعاتي' : 'Communities'}</span>
                    </Link>
                )}

                {/* Show Posts Feed for regular users */}
                {!isBusinessAccount && (
                    <Link to="/posts-feed" className={`nav-item ${isActive('/posts-feed') ? 'active' : ''}`}>
                        <div className="friend-nav-icon-container">
                            <FaNewspaper className="nav-icon" />
                        </div>
                        <span>{i18n.language === 'ar' ? 'المنشورات' : 'Feed'}</span>
                    </Link>
                )}

                {/* Show My Community for business accounts only */}
                {isBusinessAccount && (
                    <Link to="/my-community" className={`nav-item ${isActive('/my-community') ? 'active' : ''}`}>
                        <div className="friend-nav-icon-container">
                            <FaUsers className="nav-icon" />
                        </div>
                        <span>{i18n.language === 'ar' ? 'مجتمعي' : 'My Community'}</span>
                    </Link>
                )}
            </nav>
        </div>
    );
};

export default Layout;
