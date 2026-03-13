import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
    FaTachometerAlt,
    FaUsers,
    FaEnvelope,
    FaStore,
    FaHistory,
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
    FaSlidersH,
} from 'react-icons/fa';

const Sidebar = ({ isOpen, onClose }) => {
    const { userProfile } = useAuth();
    const userRole = userProfile?.role;
    const isAdmin = userRole === 'admin';

    const navGroups = [
        {
            title: 'Main',
            items: [
                { path: '/admin/dashboard', icon: FaTachometerAlt, label: 'Dashboard', roles: ['admin', 'moderator', 'support'] },
                { path: '/admin/users', icon: FaUsers, label: 'Users', roles: ['admin', 'moderator', 'support'] },
                { path: '/admin/businesses', icon: FaStore, label: 'Businesses', roles: ['admin', 'moderator'] },
                { path: '/admin/invitations', icon: FaEnvelope, label: 'Invitations', roles: ['admin', 'moderator'] },
            ],
        },
        {
            title: 'Subscriptions & Plans',
            items: [
                { path: '/admin/subscriptions', icon: FaCreditCard, label: 'Subscriptions', roles: ['admin'] },
                { path: '/admin/plans', icon: FaBox, label: 'Plans & Packs', roles: ['admin'] },
            ],
        },
        {
            title: 'Content & Moderation',
            items: [
                { path: '/admin/reports', icon: FaFlag, label: 'Reports', roles: ['admin', 'moderator'] },
                { path: '/admin/chat-community', icon: FaComments, label: 'Chat & Community', roles: ['admin', 'moderator'] },
            ],
        },
        {
            title: 'Notifications',
            items: [
                { path: '/admin/notifications', icon: FaBell, label: 'Notifications', roles: ['admin'] },
            ],
        },
        {
            title: 'Data & Tools',
            items: [
                { path: '/admin/business-limits', icon: FaSlidersH, label: 'Business Limits', roles: ['admin'] },
                { path: '/admin/migration', icon: FaDatabase, label: 'Migration', roles: ['admin'] },
                { path: '/admin/system-tools', icon: FaTools, label: 'System Tools', roles: ['admin'] },
                { path: '/admin/audit-log', icon: FaHistory, label: 'Audit Log', roles: ['admin'] },
                { path: '/admin/backups', icon: FaCopy, label: 'Code Snapshots', roles: ['admin'] },
            ],
        },
        {
            title: 'Settings',
            items: [
                { path: '/admin/settings', icon: FaCog, label: 'Settings', roles: ['admin'] },
            ],
        },
    ];

    const canSee = (roles) => isAdmin || (roles && roles.includes(userRole));

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
                        <img src="/logo.png" alt="Logo" style={{ width: '36px', height: '36px', objectFit: 'contain', filter: 'brightness(0) invert(1)' }} />
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
                            <div key={group.title} className="admin-nav-group">
                                <div className="admin-nav-group-title">{group.title}</div>
                                {visibleItems.map((item) => (
                                    <NavLink
                                        key={item.path}
                                        to={item.path}
                                        onClick={onClose}
                                        className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`}
                                        style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.6rem 1rem', borderRadius: 'var(--admin-radius-sm)', textDecoration: 'none', color: 'inherit', fontWeight: '500', fontSize: '0.9rem' }}
                                    >
                                        <item.icon className="admin-nav-icon" style={{ fontSize: '1rem', flexShrink: 0 }} />
                                        <span>{item.label}</span>
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
