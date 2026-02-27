import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
    FaTachometerAlt,
    FaUsers,
    FaCreditCard,
    FaStore,
    FaEnvelope,
    FaChartLine,
    FaCog,
    FaTimes,
    FaDatabase,
    FaBoxOpen
} from 'react-icons/fa';

const Sidebar = ({ isOpen, onClose }) => {
    const { userProfile } = useAuth();
    const userRole = userProfile?.role || userProfile?.accountType;
    const isSuperAdmin = userRole === 'admin';

    const navItems = [
        { path: '/admin/dashboard', icon: FaTachometerAlt, label: 'Dashboard', roles: ['admin', 'moderator', 'support'] },
        { path: '/admin/users', icon: FaUsers, label: 'Users', roles: ['admin', 'moderator', 'support'] },
        { path: '/admin/plans', icon: FaCreditCard, label: 'Plans', roles: ['admin'] },
        { path: '/admin/subscriptions', icon: FaStore, label: 'Subscriptions', roles: ['admin', 'support'] },
        { path: '/admin/partners', icon: FaStore, label: 'Partners', roles: ['admin', 'moderator'] },
        { path: '/admin/invitations', icon: FaEnvelope, label: 'Invitations', roles: ['admin', 'moderator'] },
        { path: '/admin/reports', icon: FaChartLine, label: 'Reports & Analytics', roles: ['admin', 'moderator', 'support'] },
        { path: '/admin/migration', icon: FaDatabase, label: 'Migration', roles: ['admin'] },
        { path: '/admin/backups', icon: FaBoxOpen, label: 'Code Snapshots', roles: ['admin'] },
        { path: '/admin/settings', icon: FaCog, label: 'Settings', roles: ['admin'] }
    ];

    const filteredNavItems = navItems.filter(item =>
        isSuperAdmin || item.roles.includes(userRole)
    );

    return (
        <>
            {/* Overlay for mobile */}
            {isOpen && (
                <div
                    onClick={onClose}
                    style={{
                        position: 'fixed',
                        inset: 0,
                        background: 'rgba(0, 0, 0, 0.5)',
                        zIndex: 40
                    }}
                    className="lg:hidden"
                />
            )}

            {/* Sidebar */}
            <div className={`admin-sidebar ${!isOpen ? 'mobile-hidden' : ''}`}>
                {/* Header */}
                <div className="admin-sidebar-header">
                    <div className="admin-sidebar-logo" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <img src="/logo.png" alt="Logo" style={{ width: '40px', height: '40px', objectFit: 'contain', filter: 'brightness(0) invert(1)' }} />
                        <div style={{ fontSize: '1.075rem', fontWeight: '800', color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            DineBuddies <span style={{ fontSize: '0.8em', color: '#94a3b8', fontWeight: '400' }}>Admin</span>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="lg:hidden"
                        style={{
                            background: 'none',
                            border: 'none',
                            color: '#94a3b8',
                            fontSize: '1.5rem',
                            cursor: 'pointer',
                            padding: '0.5rem'
                        }}
                    >
                        <FaTimes />
                    </button>
                </div>

                {/* Navigation */}
                <nav className="admin-nav">
                    {filteredNavItems.map((item) => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            onClick={onClose}
                            className={({ isActive }) =>
                                `admin-nav-item ${isActive ? 'active' : ''}`
                            }
                        >
                            <item.icon className="admin-nav-icon" />
                            <span>{item.label}</span>
                        </NavLink>
                    ))}
                </nav>

                {/* Footer */}
                <div style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    padding: '1rem',
                    borderTop: '1px solid #334155',
                    background: '#1e293b'
                }}>
                    <div style={{
                        fontSize: '0.75rem',
                        color: '#64748b',
                        textAlign: 'center'
                    }}>
                        v1.0.0 • Admin Panel • Auto-Deploy ✅
                    </div>
                </div>
            </div>
        </>
    );
};

export default Sidebar;
