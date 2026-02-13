import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { FaUsers, FaStore, FaCreditCard, FaDollarSign, FaEnvelope, FaExclamationTriangle, FaArrowUp, FaArrowDown, FaPlus, FaUserPlus } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import CreateUserAccount from '../../components/CreateUserAccount';
import CreateBusinessAccount from '../../components/CreateBusinessAccount';

const AdminDashboard = () => {
    const navigate = useNavigate();
    const [stats, setStats] = useState({
        totalUsers: 0,
        totalPartners: 0,
        activeSubscriptions: 0,
        monthlyRevenue: 0,
        pendingInvitations: 0,
        pendingReports: 0
    });
    const [loading, setLoading] = useState(true);
    const [showCreateUser, setShowCreateUser] = useState(false);
    const [showCreateBusiness, setShowCreateBusiness] = useState(false);

    useEffect(() => {
        console.log('🎯 Admin Dashboard loaded with Create buttons');
        fetchStats();
    }, []);

    const fetchStats = async () => {
        try {
            setLoading(true);

            // Fetch users
            const usersSnapshot = await getDocs(collection(db, 'users'));
            const users = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            const totalUsers = users.length;
            const totalPartners = users.filter(u => u.accountType === 'business').length;
            const activeSubscriptions = users.filter(u => u.subscription?.status === 'active').length;

            // Calculate revenue
            const monthlyRevenue = users
                .filter(u => u.subscription?.status === 'active')
                .reduce((sum, u) => sum + (u.subscription?.price || 0), 0);

            // Fetch invitations
            const invitationsSnapshot = await getDocs(collection(db, 'invitations'));
            const pendingInvitations = invitationsSnapshot.size;

            // Fetch reports
            try {
                const reportsSnapshot = await getDocs(
                    query(collection(db, 'reports'), where('status', '==', 'pending'))
                );
                const pendingReports = reportsSnapshot.size;

                setStats({
                    totalUsers,
                    totalPartners,
                    activeSubscriptions,
                    monthlyRevenue,
                    pendingInvitations,
                    pendingReports
                });
            } catch (error) {
                // If reports collection doesn't exist
                setStats({
                    totalUsers,
                    totalPartners,
                    activeSubscriptions,
                    monthlyRevenue,
                    pendingInvitations,
                    pendingReports: 0
                });
            }
        } catch (error) {
            console.error('Error fetching stats:', error);
        } finally {
            setLoading(false);
        }
    };

    const StatCard = ({ icon: Icon, label, value, change, color, bgColor, onClick }) => (
        <div className="admin-stat-card" onClick={onClick} style={{ borderColor: '#334155' }}>
            <div className="admin-flex-between admin-mb-2">
                <div className="admin-stat-icon" style={{ backgroundColor: bgColor }}>
                    <Icon style={{ color: color }} />
                </div>
                {change && (
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                        fontSize: '0.875rem',
                        fontWeight: '600',
                        color: change > 0 ? '#22c55e' : '#ef4444'
                    }}>
                        {change > 0 ? <FaArrowUp /> : <FaArrowDown />}
                        {Math.abs(change)}%
                    </div>
                )}
            </div>
            <div>
                <p className="admin-stat-label">{label}</p>
                <p className="admin-stat-value">{typeof value === 'number' ? value.toLocaleString() : value}</p>
            </div>
        </div>
    );

    const QuickAction = ({ icon: Icon, label, description, color, onClick }) => (
        <button
            onClick={onClick}
            className="admin-card"
            style={{
                textAlign: 'left',
                cursor: 'pointer',
                border: '1px solid #334155',
                background: '#1e293b',
                width: '100%'
            }}
        >
            <div className="admin-flex admin-gap-2" style={{ alignItems: 'center' }}>
                <div style={{
                    width: '2.5rem',
                    height: '2.5rem',
                    borderRadius: '0.5rem',
                    backgroundColor: `${color}20`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}>
                    <Icon style={{ fontSize: '1.25rem', color: color }} />
                </div>
                <div style={{ flex: 1 }}>
                    <p style={{ fontSize: '1rem', fontWeight: '600', color: '#ffffff', marginBottom: '0.25rem' }}>
                        {label}
                    </p>
                    <p style={{ fontSize: '0.875rem', color: '#94a3b8', margin: 0 }}>
                        {description}
                    </p>
                </div>
            </div>
        </button>
    );

    if (loading) {
        return (
            <div className="admin-loading">
                <div style={{ textAlign: 'center' }}>
                    <div className="admin-spinner" />
                    <p style={{ color: '#94a3b8', fontSize: '1rem', marginTop: '1rem' }}>Loading dashboard...</p>
                </div>
            </div>
        );
    }

    return (
        <div>
            {/* Header */}
            <div className="admin-page-header">
                <h1 className="admin-page-title">Dashboard</h1>
                <p className="admin-page-subtitle">
                    Welcome back! Here's what's happening with your platform.
                </p>
            </div>

            {/* Stats Grid */}
            <div className="admin-grid admin-grid-4 admin-mb-4">
                <StatCard
                    icon={FaUsers}
                    label="Total Users"
                    value={stats.totalUsers}
                    change={12}
                    color="#6366f1"
                    bgColor="rgba(99, 102, 241, 0.1)"
                    onClick={() => navigate('/admin/users')}
                />
                <StatCard
                    icon={FaStore}
                    label="Partners"
                    value={stats.totalPartners}
                    change={8}
                    color="#8b5cf6"
                    bgColor="rgba(139, 92, 246, 0.1)"
                    onClick={() => navigate('/admin/partners')}
                />
                <StatCard
                    icon={FaCreditCard}
                    label="Active Subscriptions"
                    value={stats.activeSubscriptions}
                    change={15}
                    color="#22c55e"
                    bgColor="rgba(34, 197, 94, 0.1)"
                    onClick={() => navigate('/admin/subscriptions')}
                />
                <StatCard
                    icon={FaDollarSign}
                    label="Monthly Revenue"
                    value={`$${stats.monthlyRevenue}`}
                    change={23}
                    color="#f59e0b"
                    bgColor="rgba(245, 158, 11, 0.1)"
                />
            </div>

            {/* Quick Actions */}
            <div className="admin-mb-4">
                <h2 style={{
                    fontSize: '1.5rem',
                    fontWeight: '700',
                    color: '#ffffff',
                    marginBottom: '1rem',
                    letterSpacing: '-0.025em'
                }}>
                    Quick Actions
                </h2>
                <div className="admin-grid admin-grid-3">
                    <QuickAction
                        icon={FaUsers}
                        label="Manage Users"
                        description="View and manage all users"
                        color="#6366f1"
                        onClick={() => navigate('/admin/users')}
                    />
                    <QuickAction
                        icon={FaCreditCard}
                        label="Manage Plans"
                        description="Create and edit subscription plans"
                        color="#8b5cf6"
                        onClick={() => navigate('/admin/plans')}
                    />
                    <QuickAction
                        icon={FaStore}
                        label="Business Limits"
                        description="Manage business subscription limits"
                        color="#22c55e"
                        onClick={() => navigate('/admin/business-limits')}
                    />
                    <QuickAction
                        icon={FaExclamationTriangle}
                        label="Review Reports"
                        description={`${stats.pendingReports} pending reports`}
                        color="#ef4444"
                        onClick={() => navigate('/admin/reports')}
                    />
                </div>
            </div>

            {/* Create New */}
            <div className="admin-mb-4">
                <h2 style={{
                    fontSize: '1.5rem',
                    fontWeight: '700',
                    color: '#ffffff',
                    marginBottom: '1rem',
                    letterSpacing: '-0.025em'
                }}>
                    Create New
                </h2>
                <div className="admin-grid admin-grid-2">
                    <QuickAction
                        icon={FaUserPlus}
                        label="Create User Account"
                        description="Add a new regular user"
                        color="#6366f1"
                        onClick={() => setShowCreateUser(true)}
                    />
                    <QuickAction
                        icon={FaStore}
                        label="Create Business Account"
                        description="Add a new business partner"
                        color="#22c55e"
                        onClick={() => setShowCreateBusiness(true)}
                    />
                </div>
            </div>

            {/* Recent Activity */}
            <div>
                <h2 style={{
                    fontSize: '1.5rem',
                    fontWeight: '700',
                    color: '#ffffff',
                    marginBottom: '1rem',
                    letterSpacing: '-0.025em'
                }}>
                    Recent Activity
                </h2>
                <div className="admin-card">
                    <div className="admin-empty">
                        <div className="admin-empty-icon">📊</div>
                        <h3 className="admin-empty-title">Activity Tracking</h3>
                        <p className="admin-empty-text">
                            Activity tracking coming soon...
                        </p>
                    </div>
                </div>
            </div>

            {/* Create User Modal */}
            {showCreateUser && (
                <CreateUserAccount
                    onClose={() => setShowCreateUser(false)}
                    onSuccess={() => {
                        setShowCreateUser(false);
                        fetchStats(); // Refresh stats
                    }}
                />
            )}

            {/* Create Business Modal */}
            {showCreateBusiness && (
                <CreateBusinessAccount
                    onClose={() => setShowCreateBusiness(false)}
                    onSuccess={() => {
                        setShowCreateBusiness(false);
                        fetchStats(); // Refresh stats
                    }}
                />
            )}
        </div>
    );
};

export default AdminDashboard;
