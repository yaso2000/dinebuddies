import React, { useState, useEffect } from 'react';
import { Outlet, useLocation, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Sidebar from '../../components/admin/Sidebar';
import { useAuth } from '../../context/AuthContext';
import { FaBars, FaSignOutAlt, FaSearch, FaChevronDown } from 'react-icons/fa';
import '../../styles/admin.css';

const ROUTE_LABELS = {
    dashboard: 'Dashboard',
    users: 'User Management',
    partners: 'Businesses',
    businesses: 'Businesses',
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
    settings: 'Settings',
};

const AdminLayout = () => {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [userMenuOpen, setUserMenuOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const { currentUser, signOut } = useAuth();
    const location = useLocation();
    const { i18n } = useTranslation();

    useEffect(() => {
        const prev = i18n.language;
        i18n.changeLanguage('en');
        return () => { i18n.changeLanguage(prev); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleLogout = async () => {
        setUserMenuOpen(false);
        if (window.confirm('Sign out of the admin panel?')) {
            await signOut();
        }
    };

    // Build breadcrumb from pathname: /admin/dashboard -> ["Admin", "Dashboard"]
    const pathParts = location.pathname.replace(/^\/admin\/?/, '').split('/').filter(Boolean);
    const breadcrumbLabels = pathParts.map((part, i) => {
        const key = i === 0 ? part : pathParts.slice(0, i + 1).join('/');
        if (key.startsWith('edit/')) return ROUTE_LABELS['plans/edit'] || 'Edit';
        return ROUTE_LABELS[key] || key.charAt(0).toUpperCase() + key.slice(1).replace(/-/g, ' ');
    });

    return (
        <div className="admin-container">
            <div className="admin-layout">
                <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

                <div className="admin-main">
                    <header className="admin-topbar">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: '1', minWidth: 0 }}>
                            <button
                                type="button"
                                onClick={() => setSidebarOpen(!sidebarOpen)}
                                className="lg:hidden"
                                style={{
                                    padding: '0.5rem',
                                    borderRadius: 'var(--admin-radius-sm)',
                                    background: 'var(--admin-bg-hover)',
                                    border: 'none',
                                    color: 'var(--admin-text-primary)',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}
                                aria-label="Toggle menu"
                            >
                                <FaBars />
                            </button>

                            <nav className="admin-breadcrumb" aria-label="Breadcrumb">
                                <Link to="/admin/dashboard">Admin</Link>
                                {breadcrumbLabels.map((label, i) => (
                                    <React.Fragment key={i}>
                                        <span className="admin-breadcrumb-sep">/</span>
                                        <span className={i === breadcrumbLabels.length - 1 ? 'admin-breadcrumb-current' : ''}>
                                            {i === breadcrumbLabels.length - 1 ? label : (
                                                <Link to={`/admin/${pathParts.slice(0, i + 1).join('/')}`}>{label}</Link>
                                            )}
                                        </span>
                                    </React.Fragment>
                                ))}
                            </nav>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <div className="admin-search" style={{ maxWidth: '220px' }}>
                                <FaSearch className="admin-search-icon" style={{ left: '0.75rem' }} />
                                <input
                                    type="search"
                                    placeholder="Search..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="admin-search-input"
                                    style={{ paddingLeft: '2.25rem', fontSize: '0.875rem' }}
                                    aria-label="Search"
                                />
                            </div>

                            <div style={{ position: 'relative' }}>
                                <button
                                    type="button"
                                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem',
                                        padding: '0.4rem 0.75rem',
                                        background: 'var(--admin-bg-hover)',
                                        border: '1px solid var(--admin-border)',
                                        borderRadius: 'var(--admin-radius-sm)',
                                        color: 'var(--admin-text-primary)',
                                        cursor: 'pointer',
                                        fontSize: '0.875rem',
                                    }}
                                    aria-expanded={userMenuOpen}
                                    aria-haspopup="true"
                                >
                                    <div
                                        className="admin-topbar-avatar"
                                        style={{ width: '28px', height: '28px', fontSize: '0.75rem' }}
                                    >
                                        {currentUser?.displayName?.charAt(0)?.toUpperCase() ||
                                            currentUser?.email?.charAt(0)?.toUpperCase() ||
                                            'A'}
                                    </div>
                                    <span className="lg:inline" style={{ maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {currentUser?.displayName || currentUser?.email?.split('@')[0] || 'Admin'}
                                    </span>
                                    <FaChevronDown style={{ fontSize: '0.7rem', opacity: 0.8 }} />
                                </button>
                                {userMenuOpen && (
                                    <>
                                        <div
                                            role="presentation"
                                            style={{ position: 'fixed', inset: 0, zIndex: 10 }}
                                            onClick={() => setUserMenuOpen(false)}
                                        />
                                        <div
                                            style={{
                                                position: 'absolute',
                                                top: '100%',
                                                right: 0,
                                                marginTop: '0.25rem',
                                                minWidth: '200px',
                                                background: 'var(--admin-bg-elevated)',
                                                border: '1px solid var(--admin-border)',
                                                borderRadius: 'var(--admin-radius-sm)',
                                                boxShadow: 'var(--admin-shadow-lg)',
                                                zIndex: 20,
                                                padding: '0.5rem',
                                            }}
                                        >
                                            <div style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--admin-border)', marginBottom: '0.5rem' }}>
                                                <div style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--admin-text-primary)' }}>
                                                    {currentUser?.displayName || 'Admin'}
                                                </div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted)' }}>
                                                    {currentUser?.email}
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={handleLogout}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '0.5rem',
                                                    width: '100%',
                                                    padding: '0.5rem 0.75rem',
                                                    background: 'none',
                                                    border: 'none',
                                                    borderRadius: 'var(--admin-radius-sm)',
                                                    color: 'var(--admin-danger)',
                                                    cursor: 'pointer',
                                                    fontSize: '0.875rem',
                                                    textAlign: 'left',
                                                }}
                                            >
                                                <FaSignOutAlt /> Sign out
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </header>

                    <main className="admin-content">
                        <Outlet />
                    </main>
                </div>
            </div>
        </div>
    );
};

export default AdminLayout;
