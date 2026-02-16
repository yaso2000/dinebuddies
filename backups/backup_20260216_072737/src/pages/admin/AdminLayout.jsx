import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '../../components/admin/Sidebar';
import { useAuth } from '../../context/AuthContext';
import { FaBars, FaSignOutAlt, FaUser } from 'react-icons/fa';
import '../../styles/admin.css';

const AdminLayout = () => {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const { currentUser, logout } = useAuth();

    const handleLogout = async () => {
        if (window.confirm('Are you sure you want to logout?')) {
            await logout();
        }
    };

    return (
        <div className="admin-container">
            <div className="admin-layout">
                {/* Sidebar */}
                <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

                {/* Main Content */}
                <div className="admin-main">
                    {/* Top Bar */}
                    <div className="admin-topbar">
                        <div className="admin-flex admin-gap-2" style={{ alignItems: 'center' }}>
                            <button
                                onClick={() => setSidebarOpen(!sidebarOpen)}
                                className="admin-btn-secondary admin-btn-sm lg:hidden"
                                style={{
                                    padding: '0.5rem',
                                    borderRadius: '0.5rem',
                                    background: '#334155',
                                    border: 'none',
                                    color: '#ffffff',
                                    cursor: 'pointer'
                                }}
                            >
                                <FaBars />
                            </button>
                            <h2 className="admin-topbar-title">Admin Panel</h2>
                        </div>

                        <div className="admin-topbar-user">
                            <div style={{ textAlign: 'right', marginRight: '0.5rem' }}>
                                <div style={{ fontSize: '0.875rem', fontWeight: '600', color: '#ffffff' }}>
                                    {currentUser?.displayName || 'Admin'}
                                </div>
                                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                                    {currentUser?.email}
                                </div>
                            </div>
                            <div className="admin-topbar-avatar">
                                {currentUser?.displayName?.charAt(0)?.toUpperCase() ||
                                    currentUser?.email?.charAt(0)?.toUpperCase() ||
                                    'A'}
                            </div>
                            <button
                                onClick={handleLogout}
                                className="admin-btn-danger admin-btn-sm"
                                title="Sign Out"
                            >
                                <FaSignOutAlt />
                            </button>
                        </div>
                    </div>

                    {/* Page Content */}
                    <div className="admin-content">
                        <Outlet />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminLayout;
