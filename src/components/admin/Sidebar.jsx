import React from 'react';
import { NavLink } from 'react-router-dom';
import {
    FaTachometerAlt,
    FaUsers,
    FaCreditCard,
    FaStore,
    FaEnvelope,
    FaChartLine,
    FaCog,
    FaTimes,
    FaDatabase
} from 'react-icons/fa';

const Sidebar = ({ isOpen, onClose }) => {
    const navItems = [
        { path: '/admin/dashboard', icon: FaTachometerAlt, label: 'Dashboard' },
        { path: '/admin/users', icon: FaUsers, label: 'Users' },
        { path: '/admin/plans', icon: FaCreditCard, label: 'Plans' },
        { path: '/admin/subscriptions', icon: FaStore, label: 'Subscriptions' },
        { path: '/admin/partners', icon: FaStore, label: 'Partners' },
        { path: '/admin/invitations', icon: FaEnvelope, label: 'Invitations' },
        { path: '/admin/reports', icon: FaChartLine, label: 'Reports & Analytics' },
        { path: '/admin/migration', icon: FaDatabase, label: 'Migration' },
        { path: '/admin/settings', icon: FaCog, label: 'Settings' }
    ];

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
                    <h1 className="admin-sidebar-logo">
                        DineBuddies <span>Admin</span>
                    </h1>
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
                    {navItems.map((item) => (
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
