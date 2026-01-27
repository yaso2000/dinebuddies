import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useInvitations } from '../../context/InvitationContext';
import { FaUserShield, FaUsers, FaStore, FaMoneyBillWave, FaHeadset, FaGavel, FaSignOutAlt, FaChartLine, FaBars, FaTimes } from 'react-icons/fa';
import './admin.css'; // Import the CSS file

const AdminLayout = () => {
    const { currentUser, switchUserAccount } = useInvitations();
    const navigate = useNavigate();
    const location = useLocation();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    // Close mobile menu when route changes
    React.useEffect(() => {
        setIsMobileMenuOpen(false);
    }, [location]);

    // Protect Admin Route
    if (currentUser?.userRole !== 'admin') {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', textAlign: 'center' }}>
                <FaUserShield size={60} color="#ef4444" style={{ marginBottom: '20px' }} />
                <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '10px' }}>الدخول غير مصرح به</h1>
                <p style={{ color: '#666', marginBottom: '30px' }}>هذه المنطقة مخصصة للمشرفين فقط.</p>
                <div style={{ display: 'flex', gap: '15px' }}>
                    <button
                        onClick={() => navigate('/')}
                        className="btn-primary-admin"
                        style={{ background: '#64748b' }}
                    >
                        العودة للرئيسية
                    </button>
                    {/* Dev Only: Quick Switch for testing */}
                    <button
                        onClick={() => switchUserAccount('admin')} // This reloads/updates context
                        className="btn-primary-admin"
                    >
                        [TEST] التبديل لحساب الأدمن
                    </button>
                </div>
            </div>
        );
    }

    const menuItems = [
        { path: '/admin', icon: <FaChartLine />, label: 'لوحة التحكم' },
        { path: '/admin/users', icon: <FaUsers />, label: 'الأعضاء' },
        { path: '/admin/partners', icon: <FaStore />, label: 'الشركاء' },
        { path: '/admin/subscriptions', icon: <FaMoneyBillWave />, label: 'الاشتراكات' },
        { path: '/admin/support', icon: <FaHeadset />, label: 'الدعم الفني' },
        { path: '/admin/legal', icon: <FaGavel />, label: 'القانونية' },
    ];

    return (
        <div className="admin-container">
            {/* Mobile Overlay */}
            {isMobileMenuOpen && (
                <div className="sidebar-overlay" onClick={() => setIsMobileMenuOpen(false)}></div>
            )}

            {/* Top Bar for Mobile (Optional, can be integrated into main content header or separate) */}

            {/* Sidebar */}
            <aside className={`admin-sidebar ${isMobileMenuOpen ? 'open' : ''}`}>
                <div className="admin-sidebar-header">
                    <button
                        className="mobile-nav-toggle"
                        style={{ color: 'white', marginRight: 'auto' }}
                        onClick={() => setIsMobileMenuOpen(false)}
                    >
                        <FaTimes />
                    </button>
                    <FaUserShield size={28} color="#f59e0b" />
                    <div>
                        <h2 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0 }}>لوحة الإدارة</h2>
                        <span style={{ fontSize: '12px', color: '#64748b' }}>DineBuddies Admin</span>
                    </div>
                </div>

                <nav className="admin-sidebar-nav">
                    {menuItems.map((item) => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            end={item.path === '/admin'}
                            className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`}
                        >
                            {item.icon}
                            <span>{item.label}</span>
                        </NavLink>
                    ))}
                </nav>

                <div className="admin-sidebar-footer">
                    <button
                        onClick={() => {
                            switchUserAccount('user');
                            navigate('/');
                        }}
                        className="btn-logout"
                    >
                        <FaSignOutAlt />
                        <span>تسجيل خروج</span>
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="admin-main">
                {/* Mobile Header Toggle */}
                <div className="md:hidden" style={{ display: 'flex', alignItems: 'center', marginBottom: '1rem' }}>
                    <button
                        className="mobile-nav-toggle"
                        onClick={() => setIsMobileMenuOpen(true)}
                    >
                        <FaBars />
                    </button>
                    {/* Only show on mobile top bar if needed, otherwise rely on page headers */}
                </div>

                <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
                    <Outlet />
                </div>
            </main>
        </div>
    );
};

export default AdminLayout;
