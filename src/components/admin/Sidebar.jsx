import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { isAdminIdentity } from '../../utils/adminAccess';
import {
    FaTachometerAlt,
    FaUsers,
    FaEnvelope,
    FaTimes,
    FaCreditCard,
    FaBox,
    FaFlag,
    FaComments,
    FaBell,
    FaCog,
    FaDatabase,
    FaTools,
    FaCopy,
    FaHistory,
    FaGift,
} from 'react-icons/fa';
import { APP_LOGO } from '../../config/appLogo';

const Sidebar = ({ isOpen, onClose }) => {
    const { currentUser, userProfile } = useAuth();
    const { t } = useTranslation();
    const location = useLocation();
    const userRole = userProfile?.role;
    const isAdmin = isAdminIdentity(currentUser, userProfile);

    const navGroups = [
        {
            titleKey: 'admin_nav_overview',
            items: [
                { path: '/admin/dashboard', icon: FaTachometerAlt, labelKey: 'admin_nav_dashboard', roles: ['admin', 'moderator', 'support'] },
            ],
        },
        {
            titleKey: 'admin_nav_group_accounts',
            items: [
                { path: '/admin/accounts', icon: FaUsers, labelKey: 'admin_nav_item_accounts', roles: ['admin', 'moderator', 'support'] },
            ],
        },
        {
            titleKey: 'admin_nav_billing',
            items: [
                { path: '/admin/subscriptions', icon: FaCreditCard, labelKey: 'admin_nav_subscriptions', roles: ['admin'] },
                { path: '/admin/plans', icon: FaBox, labelKey: 'admin_nav_plans', roles: ['admin'] },
                { path: '/admin/grant-credits', icon: FaGift, labelKey: 'admin_nav_grant_credits', roles: ['admin'] },
            ],
        },
        {
            titleKey: 'admin_nav_safety',
            items: [
                { path: '/admin/reports', icon: FaFlag, labelKey: 'admin_nav_reports', roles: ['admin', 'moderator'] },
                { path: '/admin/audit-log', icon: FaHistory, labelKey: 'admin_nav_audit', roles: ['admin'] },
            ],
        },
        {
            titleKey: 'admin_nav_content',
            items: [
                { path: '/admin/invitations', icon: FaEnvelope, labelKey: 'admin_nav_invitations', roles: ['admin', 'moderator'] },
                { path: '/admin/chat-community', icon: FaComments, labelKey: 'admin_nav_chat', roles: ['admin', 'moderator'] },
            ],
        },
        {
            titleKey: 'admin_nav_ops',
            items: [
                { path: '/admin/notifications', icon: FaBell, labelKey: 'admin_nav_notifications', roles: ['admin'] },
                { path: '/admin/migration', icon: FaDatabase, labelKey: 'admin_nav_migration', roles: ['admin'] },
                { path: '/admin/system-tools', icon: FaTools, labelKey: 'admin_nav_system_tools', roles: ['admin'] },
                { path: '/admin/backups', icon: FaCopy, labelKey: 'admin_nav_backups', roles: ['admin'] },
            ],
        },
        {
            titleKey: 'admin_nav_settings',
            items: [
                { path: '/admin/settings', icon: FaCog, labelKey: 'admin_nav_settings', roles: ['admin'] },
            ],
        },
    ];

    const canSee = (roles) => isAdmin || (roles && roles.includes(userRole));

    const isAccountsActive = location.pathname.startsWith('/admin/accounts');

    return (
        <>
            {isOpen && (
                <div
                    onClick={onClose}
                    style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 40 }}
                    className="lg:hidden"
                    aria-hidden="true"
                />
            )}
            <aside className={`admin-sidebar ${!isOpen ? 'mobile-hidden' : ''}`}>
                <div className="admin-sidebar-header">
                    <div className="admin-sidebar-logo" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <img src={APP_LOGO.white} alt="Logo" style={{ width: '36px', height: '36px', objectFit: 'contain' }} />
                        <div style={{ fontSize: '1rem', fontWeight: '800', color: '#fff', letterSpacing: '-0.02em' }}>
                            DineBuddies <span style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted)', fontWeight: '500', marginLeft: '4px' }}>Admin</span>
                        </div>
                    </div>
                    <button type="button" onClick={onClose} className="lg:hidden" style={{ background: 'none', border: 'none', color: 'var(--admin-text-muted)', fontSize: '1.25rem', cursor: 'pointer', padding: '0.5rem' }} aria-label="Close menu">
                        <FaTimes />
                    </button>
                </div>
                <nav className="admin-nav">
                    {navGroups.map((group) => {
                        const visibleItems = group.items.filter((item) => canSee(item.roles));
                        if (visibleItems.length === 0) return null;
                        return (
                            <div key={group.titleKey} className="admin-nav-group">
                                <div className="admin-nav-group-title">{t(group.titleKey)}</div>
                                {visibleItems.map((item) => (
                                    <NavLink
                                        key={item.path}
                                        to={item.path}
                                        onClick={onClose}
                                        className={({ isActive }) => {
                                            const accountsMatch = item.path === '/admin/accounts' && isAccountsActive;
                                            return `admin-nav-item ${isActive || accountsMatch ? 'active' : ''}`;
                                        }}
                                        style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.6rem 1rem', borderRadius: 'var(--admin-radius-sm)', textDecoration: 'none', color: 'inherit', fontWeight: '500', fontSize: '0.9rem' }}
                                    >
                                        <item.icon className="admin-nav-icon" style={{ fontSize: '1rem', flexShrink: 0 }} />
                                        <span>{t(item.labelKey)}</span>
                                    </NavLink>
                                ))}
                            </div>
                        );
                    })}
                </nav>
                <div className="admin-sidebar-footer">
                    <div style={{ fontSize: '0.7rem', color: 'var(--admin-text-muted)', textAlign: 'center' }}>Admin • DineBuddies</div>
                </div>
            </aside>
        </>
    );
};

export default Sidebar;
