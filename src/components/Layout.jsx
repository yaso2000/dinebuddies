import React from 'react';
import { useNavigate, Link, useLocation, Outlet } from 'react-router-dom';
import { FaHome, FaPlusCircle, FaUser, FaGlobe, FaBell, FaStore, FaUsers } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';
import { useInvitations } from '../context/InvitationContext';

const Layout = ({ children }) => {
    const location = useLocation();
    const navigate = useNavigate();
    const { t, i18n } = useTranslation();
    const { notifications, getFollowingInvitations, restoreDefaults } = useInvitations();

    const unreadCount = notifications ? notifications.filter(n => !n.read).length : 0;

    const isActive = (path) => location.pathname === path;

    const toggleLanguage = () => {
        const newLang = i18n.language === 'ar' ? 'en' : 'ar';
        i18n.changeLanguage(newLang);
    };

    const friendActivities = getFollowingInvitations() || [];
    const hasFriendsActive = friendActivities.length > 0;

    return (
        <div className="app-container" dir={i18n.language === 'ar' ? 'rtl' : 'ltr'}>
            <header className="app-header">
                <div className="app-logo" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
                    DineBuddies <span style={{ fontSize: '0.6rem', opacity: 0.5, fontWeight: 'normal' }}>v1.8</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <div onClick={() => navigate('/notifications')} style={{ position: 'relative', cursor: 'pointer', padding: '5px' }}>
                        <FaBell style={{ fontSize: '1.2rem', color: 'var(--text-white)', opacity: 0.8 }} />
                        {unreadCount > 0 && <span className="notification-badge-small">{unreadCount}</span>}
                    </div>
                </div>
            </header>

            <main style={{ minHeight: '80vh', paddingBottom: '100px' }}>
                {children || <Outlet />}
            </main>

            <nav className="bottom-nav">
                <Link to="/" className={`nav-item ${isActive('/') ? 'active' : ''}`}>
                    <FaHome className="nav-icon" />
                    <span>{t('nav_home')}</span>
                </Link>

                <Link to="/restaurants" className={`nav-item ${isActive('/restaurants') ? 'active' : ''}`}>
                    <FaStore className="nav-icon" />
                    <span>{t('nav_partners')}</span>
                </Link>

                <Link to="/create" className={`nav-item fab-nav-item ${isActive('/create') ? 'active' : ''}`}>
                    <div className="fab-container">
                        <FaPlusCircle className="nav-icon fab" />
                    </div>
                    <span className="fab-label">{t('nav_create')}</span>
                </Link>

                <Link to="/friends" className={`nav-item ${isActive('/friends') ? 'active' : ''}`}>
                    <div className="friend-nav-icon-container">
                        {hasFriendsActive ? (
                            <div className="friend-avatar-nav-wrapper">
                                <img src={friendActivities[0].author?.avatar} alt="F" />
                                <div className="tik-badge">{friendActivities.length}</div>
                            </div>
                        ) : (
                            <FaUsers className="nav-icon" />
                        )}
                    </div>
                    <span>{t('nav_friends')}</span>
                </Link>

                <Link to="/profile" className={`nav-item ${isActive('/profile') ? 'active' : ''}`}>
                    <FaUser className="nav-icon" />
                    <span>{t('nav_profile')}</span>
                </Link>
            </nav>
        </div>
    );
};

export default Layout;
