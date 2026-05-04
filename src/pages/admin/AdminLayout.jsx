import React, { useState } from 'react';
import { Outlet, useLocation, Link, NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { isAdminIdentity } from '../../utils/adminAccess';
import { ADMIN_NAV_GROUPS, canSeeAdminNavItem } from '../../utils/adminNavGroups';
import { FaSignOutAlt, FaChevronDown } from 'react-icons/fa';
import '../../styles/admin.css';

const ROUTE_LABELS = {
    dashboard: 'Dashboard',
    accounts: 'Accounts',
    users: 'Accounts',
    partners: 'Accounts',
    businesses: 'Accounts',
    plans: 'Plans & Packs',
    subscriptions: 'Subscription & Credits',
    invitations: 'Invitation Management',
    'chat-community': 'Chat & Community',
    reports: 'Reports & Moderation',
    notifications: 'Notifications System',
    'system-tools': 'System Tools',
    'audit-log': 'Audit Log',
    'business-limits': 'Business Limits',
    migration: 'Migration',
    backups: 'Code Snapshots',
    'grant-credits': 'Grant credits',
    settings: 'Settings',
};

const AdminLayout = () => {
    const { t } = useTranslation();
    const [userMenuOpen, setUserMenuOpen] = useState(false);
    const { currentUser, userProfile, signOut } = useAuth();
    const location = useLocation();
    const isSuper = isAdminIdentity(currentUser, userProfile);
    const userRole = userProfile?.role;

    const handleLogout = async () => {
        setUserMenuOpen(false);
        if (window.confirm('Sign out of the admin panel?')) {
            await signOut();
        }
    };

    const pathParts = location.pathname.replace(/^\/admin\/?/, '').split('/').filter(Boolean);
    const breadcrumbLabels = pathParts.map((part, i) => {
        const key = i === 0 ? part : pathParts.slice(0, i + 1).join('/');
        if (key.startsWith('edit/')) return ROUTE_LABELS['plans/edit'] || 'Edit';
        return ROUTE_LABELS[key] || key.charAt(0).toUpperCase() + key.slice(1).replace(/-/g, ' ');
    });

    return (
        <div className="admin-embedded">
            <header className="admin-embedded-header">
                <div className="admin-embedded-toolbar">
                    <Link to="/posts-feed" className="admin-embedded-back">
                        ← {t('nav_home', 'Home')}
                    </Link>
                    <nav className="admin-breadcrumb admin-breadcrumb--embedded" aria-label="Breadcrumb">
                        <Link to="/admin/dashboard">Admin</Link>
                        {breadcrumbLabels.map((label, i) => (
                            <React.Fragment key={i}>
                                <span className="admin-breadcrumb-sep">/</span>
                                <span className={i === breadcrumbLabels.length - 1 ? 'admin-breadcrumb-current' : ''}>
                                    {i === breadcrumbLabels.length - 1 ? (
                                        label
                                    ) : (
                                        <Link to={`/admin/${pathParts.slice(0, i + 1).join('/')}`}>{label}</Link>
                                    )}
                                </span>
                            </React.Fragment>
                        ))}
                    </nav>
                    <div className="admin-embedded-toolbar-spacer" />
                    <div style={{ position: 'relative' }}>
                        <button
                            type="button"
                            onClick={() => setUserMenuOpen(!userMenuOpen)}
                            className="admin-embedded-userbtn"
                            aria-expanded={userMenuOpen}
                            aria-haspopup="true"
                        >
                            <span className="admin-topbar-avatar admin-topbar-avatar--sm">
                                {currentUser?.displayName?.charAt(0)?.toUpperCase() ||
                                    currentUser?.email?.charAt(0)?.toUpperCase() ||
                                    'A'}
                            </span>
                            <span className="admin-embedded-userlabel">
                                {currentUser?.displayName || currentUser?.email?.split('@')[0] || 'Admin'}
                            </span>
                            <FaChevronDown style={{ fontSize: '0.65rem', opacity: 0.75 }} />
                        </button>
                        {userMenuOpen && (
                            <>
                                <div role="presentation" className="admin-embedded-menu-backdrop" onClick={() => setUserMenuOpen(false)} />
                                <div className="admin-embedded-menu">
                                    <div className="admin-embedded-menu-meta">
                                        <div style={{ fontWeight: 700 }}>{currentUser?.displayName || 'Admin'}</div>
                                        <div style={{ fontSize: '0.75rem', opacity: 0.75 }}>{currentUser?.email}</div>
                                    </div>
                                    <button type="button" className="admin-embedded-menu-signout" onClick={handleLogout}>
                                        <FaSignOutAlt /> {t('sign_out', 'Sign out')}
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>

                <nav className="admin-embedded-nav" aria-label={t('admin_panel', 'Admin panel')}>
                    {ADMIN_NAV_GROUPS.map((group) => {
                        const items = group.items.filter((item) => canSeeAdminNavItem(item.roles, isSuper, userRole));
                        if (items.length === 0) return null;
                        return (
                            <React.Fragment key={group.titleKey}>
                                {items.map((item) => {
                                    const accountsMatch = item.path === '/admin/accounts' && location.pathname.startsWith('/admin/accounts');
                                    return (
                                        <NavLink
                                            key={item.path}
                                            to={item.path}
                                            className={({ isActive }) =>
                                                `admin-embedded-pill${isActive || accountsMatch ? ' admin-embedded-pill--active' : ''}`
                                            }
                                        >
                                            {t(item.labelKey)}
                                        </NavLink>
                                    );
                                })}
                            </React.Fragment>
                        );
                    })}
                </nav>
            </header>

            <main className="admin-embedded-main">
                <Outlet />
            </main>
        </div>
    );
};

export default AdminLayout;
