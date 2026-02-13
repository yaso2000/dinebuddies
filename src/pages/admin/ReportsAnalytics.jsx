import React, { useState, useEffect } from 'react';
import { FaExclamationTriangle, FaChartLine, FaUsers, FaEnvelope, FaStore, FaDollarSign, FaArrowUp, FaFlag, FaEye, FaCheckCircle, FaTimesCircle } from 'react-icons/fa';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../firebase/config';

const ReportsAnalytics = () => {
    const [activeTab, setActiveTab] = useState('analytics');
    const [loading, setLoading] = useState(true);

    // Real Analytics Data
    const [analytics, setAnalytics] = useState({
        users: {
            total: 0,
            growth: 0,
            newThisWeek: 0
        },
        invitations: {
            total: 0,
            growth: 0,
            activeToday: 0
        },
        partners: {
            total: 0,
            growth: 0,
            newThisMonth: 0
        },
        revenue: {
            total: 0,
            growth: 0,
            thisMonth: 0
        }
    });

    // Real Reports Data
    const [reports, setReports] = useState([]);

    useEffect(() => {
        fetchAnalytics();
        fetchReports();
    }, []);

    const fetchAnalytics = async () => {
        try {
            setLoading(true);

            // Fetch Users
            const usersSnapshot = await getDocs(collection(db, 'users'));
            const totalUsers = usersSnapshot.size;

            // Fetch Invitations
            const invitationsSnapshot = await getDocs(collection(db, 'invitations'));
            const totalInvitations = invitationsSnapshot.size;

            // Fetch Partners (business accounts)
            const partnersQuery = query(collection(db, 'users'), where('accountType', '==', 'business'));
            const partnersSnapshot = await getDocs(partnersQuery);
            const totalPartners = partnersSnapshot.size;

            // Fetch Subscriptions for revenue
            let totalRevenue = 0;
            try {
                const subscriptionsSnapshot = await getDocs(collection(db, 'subscriptions'));
                subscriptionsSnapshot.forEach(doc => {
                    const sub = doc.data();
                    if (sub.amount) {
                        totalRevenue += sub.amount;
                    }
                });
            } catch (err) {
                // Subscriptions collection may not exist yet
                console.log('Subscriptions collection not accessible');
            }

            setAnalytics({
                users: {
                    total: totalUsers,
                    growth: 0, // Can be calculated later
                    newThisWeek: 0 // Can be calculated later
                },
                invitations: {
                    total: totalInvitations,
                    growth: 0,
                    activeToday: 0
                },
                partners: {
                    total: totalPartners,
                    growth: 0,
                    newThisMonth: 0
                },
                revenue: {
                    total: totalRevenue,
                    growth: 0,
                    thisMonth: 0
                }
            });
        } catch (error) {
            console.error('Error fetching analytics:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchReports = async () => {
        try {
            // You can add reports collection later
            // const reportsSnapshot = await getDocs(collection(db, 'reports'));
            // setReports(reportsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));

            // Currently no reports
            setReports([]);
        } catch (error) {
            console.error('Error fetching reports:', error);
        }
    };

    const reportStats = {
        total: reports.length,
        pending: reports.filter(r => r.status === 'pending').length,
        resolved: reports.filter(r => r.status === 'resolved').length,
        dismissed: reports.filter(r => r.status === 'dismissed').length
    };

    if (loading) {
        return (
            <div className="admin-loading">
                <div style={{ textAlign: 'center' }}>
                    <div className="admin-spinner" />
                    <p style={{ color: '#94a3b8', fontSize: '1rem', marginTop: '1rem' }}>Loading analytics...</p>
                </div>
            </div>
        );
    }

    return (
        <div>
            {/* Header with Tabs */}
            <div className="admin-page-header admin-mb-4">
                <div>
                    <h1 className="admin-page-title">Reports & Analytics</h1>
                    <p className="admin-page-subtitle">Monitor platform performance and user reports</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="admin-card admin-mb-4" style={{ padding: '0.5rem' }}>
                <div className="admin-flex admin-gap-2">
                    <button
                        onClick={() => setActiveTab('analytics')}
                        className="admin-btn"
                        style={{
                            background: activeTab === 'analytics' ? 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)' : 'transparent',
                            color: activeTab === 'analytics' ? '#ffffff' : '#94a3b8',
                            border: activeTab === 'analytics' ? 'none' : '1px solid #334155',
                            flex: 1
                        }}
                    >
                        <FaChartLine />
                        Analytics Dashboard
                    </button>
                    <button
                        onClick={() => setActiveTab('reports')}
                        className="admin-btn"
                        style={{
                            background: activeTab === 'reports' ? 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)' : 'transparent',
                            color: activeTab === 'reports' ? '#ffffff' : '#94a3b8',
                            border: activeTab === 'reports' ? 'none' : '1px solid #334155',
                            flex: 1
                        }}
                    >
                        <FaExclamationTriangle />
                        User Reports
                    </button>
                </div>
            </div>

            {/* Analytics Tab */}
            {activeTab === 'analytics' && (
                <div>
                    {/* Key Metrics */}
                    <div className="admin-grid admin-grid-4 admin-mb-4">
                        {/* Users */}
                        <div className="admin-card">
                            <div className="admin-flex-between admin-mb-2">
                                <div style={{
                                    width: '3rem',
                                    height: '3rem',
                                    borderRadius: '0.75rem',
                                    background: 'rgba(99, 102, 241, 0.1)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}>
                                    <FaUsers style={{ fontSize: '1.5rem', color: '#6366f1' }} />
                                </div>
                                <div className="admin-flex admin-gap-1" style={{ alignItems: 'center' }}>
                                    <FaArrowUp style={{ color: '#22c55e', fontSize: '0.875rem' }} />
                                    <span style={{ color: '#22c55e', fontSize: '0.875rem', fontWeight: '600' }}>
                                        +{analytics.users.growth}%
                                    </span>
                                </div>
                            </div>
                            <div style={{ fontSize: '2rem', fontWeight: '800', color: '#ffffff', marginBottom: '0.25rem' }}>
                                {analytics.users.total}
                            </div>
                            <div style={{ fontSize: '0.875rem', color: '#94a3b8', marginBottom: '0.5rem' }}>
                                Total Users
                            </div>
                            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                +{analytics.users.newThisWeek} this week
                            </div>
                        </div>

                        {/* Invitations */}
                        <div className="admin-card">
                            <div className="admin-flex-between admin-mb-2">
                                <div style={{
                                    width: '3rem',
                                    height: '3rem',
                                    borderRadius: '0.75rem',
                                    background: 'rgba(139, 92, 246, 0.1)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}>
                                    <FaEnvelope style={{ fontSize: '1.5rem', color: '#8b5cf6' }} />
                                </div>
                                <div className="admin-flex admin-gap-1" style={{ alignItems: 'center' }}>
                                    <FaArrowUp style={{ color: '#22c55e', fontSize: '0.875rem' }} />
                                    <span style={{ color: '#22c55e', fontSize: '0.875rem', fontWeight: '600' }}>
                                        +{analytics.invitations.growth}%
                                    </span>
                                </div>
                            </div>
                            <div style={{ fontSize: '2rem', fontWeight: '800', color: '#ffffff', marginBottom: '0.25rem' }}>
                                {analytics.invitations.total}
                            </div>
                            <div style={{ fontSize: '0.875rem', color: '#94a3b8', marginBottom: '0.5rem' }}>
                                Total Invitations
                            </div>
                            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                {analytics.invitations.activeToday} active today
                            </div>
                        </div>

                        {/* Partners */}
                        <div className="admin-card">
                            <div className="admin-flex-between admin-mb-2">
                                <div style={{
                                    width: '3rem',
                                    height: '3rem',
                                    borderRadius: '0.75rem',
                                    background: 'rgba(245, 158, 11, 0.1)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}>
                                    <FaStore style={{ fontSize: '1.5rem', color: '#f59e0b' }} />
                                </div>
                                <div className="admin-flex admin-gap-1" style={{ alignItems: 'center' }}>
                                    <FaArrowUp style={{ color: '#22c55e', fontSize: '0.875rem' }} />
                                    <span style={{ color: '#22c55e', fontSize: '0.875rem', fontWeight: '600' }}>
                                        +{analytics.partners.growth}%
                                    </span>
                                </div>
                            </div>
                            <div style={{ fontSize: '2rem', fontWeight: '800', color: '#ffffff', marginBottom: '0.25rem' }}>
                                {analytics.partners.total}
                            </div>
                            <div style={{ fontSize: '0.875rem', color: '#94a3b8', marginBottom: '0.5rem' }}>
                                Business Partners
                            </div>
                            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                +{analytics.partners.newThisMonth} this month
                            </div>
                        </div>

                        {/* Revenue */}
                        <div className="admin-card">
                            <div className="admin-flex-between admin-mb-2">
                                <div style={{
                                    width: '3rem',
                                    height: '3rem',
                                    borderRadius: '0.75rem',
                                    background: 'rgba(34, 197, 94, 0.1)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}>
                                    <FaDollarSign style={{ fontSize: '1.5rem', color: '#22c55e' }} />
                                </div>
                                <div className="admin-flex admin-gap-1" style={{ alignItems: 'center' }}>
                                    <FaArrowUp style={{ color: '#22c55e', fontSize: '0.875rem' }} />
                                    <span style={{ color: '#22c55e', fontSize: '0.875rem', fontWeight: '600' }}>
                                        +{analytics.revenue.growth}%
                                    </span>
                                </div>
                            </div>
                            <div style={{ fontSize: '2rem', fontWeight: '800', color: '#ffffff', marginBottom: '0.25rem' }}>
                                ${analytics.revenue.total}
                            </div>
                            <div style={{ fontSize: '0.875rem', color: '#94a3b8', marginBottom: '0.5rem' }}>
                                Total Revenue
                            </div>
                            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                ${analytics.revenue.thisMonth} this month
                            </div>
                        </div>
                    </div>

                    {/* Charts Placeholder */}
                    <div className="admin-grid admin-grid-2 admin-mb-4">
                        <div className="admin-card">
                            <h3 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#ffffff', marginBottom: '1rem' }}>
                                User Growth
                            </h3>
                            <div style={{
                                height: '250px',
                                background: '#0f172a',
                                borderRadius: '0.75rem',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                border: '1px dashed #334155'
                            }}>
                                <div style={{ textAlign: 'center' }}>
                                    <FaChartLine style={{ fontSize: '3rem', color: '#6366f1', marginBottom: '1rem' }} />
                                    <p style={{ color: '#64748b', fontSize: '0.875rem' }}>
                                        Chart integration coming soon
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="admin-card">
                            <h3 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#ffffff', marginBottom: '1rem' }}>
                                Revenue Trend
                            </h3>
                            <div style={{
                                height: '250px',
                                background: '#0f172a',
                                borderRadius: '0.75rem',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                border: '1px dashed #334155'
                            }}>
                                <div style={{ textAlign: 'center' }}>
                                    <FaChartLine style={{ fontSize: '3rem', color: '#22c55e', marginBottom: '1rem' }} />
                                    <p style={{ color: '#64748b', fontSize: '0.875rem' }}>
                                        Chart integration coming soon
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Activity Breakdown */}
                    <div className="admin-card">
                        <h3 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#ffffff', marginBottom: '1rem' }}>
                            Activity Breakdown
                        </h3>
                        <div className="admin-grid admin-grid-3">
                            <div className="admin-card" style={{ background: '#0f172a' }}>
                                <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#6366f1', marginBottom: '0.5rem' }}>
                                    67%
                                </div>
                                <div style={{ fontSize: '0.875rem', color: '#94a3b8' }}>
                                    Active Users
                                </div>
                            </div>
                            <div className="admin-card" style={{ background: '#0f172a' }}>
                                <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#8b5cf6', marginBottom: '0.5rem' }}>
                                    45%
                                </div>
                                <div style={{ fontSize: '0.875rem', color: '#94a3b8' }}>
                                    Invitation Acceptance Rate
                                </div>
                            </div>
                            <div className="admin-card" style={{ background: '#0f172a' }}>
                                <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#f59e0b', marginBottom: '0.5rem' }}>
                                    23%
                                </div>
                                <div style={{ fontSize: '0.875rem', color: '#94a3b8' }}>
                                    Premium Conversion
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Reports Tab */}
            {activeTab === 'reports' && (
                <div>
                    {/* Stats */}
                    <div className="admin-grid admin-grid-4 admin-mb-4">
                        <div className="admin-card">
                            <div style={{ fontSize: '2rem', fontWeight: '800', color: '#ffffff' }}>{reportStats.total}</div>
                            <div style={{ fontSize: '0.875rem', color: '#94a3b8' }}>Total Reports</div>
                        </div>
                        <div className="admin-card">
                            <div style={{ fontSize: '2rem', fontWeight: '800', color: '#f59e0b' }}>{reportStats.pending}</div>
                            <div style={{ fontSize: '0.875rem', color: '#94a3b8' }}>Pending</div>
                        </div>
                        <div className="admin-card">
                            <div style={{ fontSize: '2rem', fontWeight: '800', color: '#22c55e' }}>{reportStats.resolved}</div>
                            <div style={{ fontSize: '0.875rem', color: '#94a3b8' }}>Resolved</div>
                        </div>
                        <div className="admin-card">
                            <div style={{ fontSize: '2rem', fontWeight: '800', color: '#64748b' }}>{reportStats.dismissed}</div>
                            <div style={{ fontSize: '0.875rem', color: '#94a3b8' }}>Dismissed</div>
                        </div>
                    </div>

                    {/* Reports List */}
                    {reports.length === 0 ? (
                        <div className="admin-card">
                            <div className="admin-empty">
                                <div className="admin-empty-icon">🎉</div>
                                <h3 className="admin-empty-title">No Reports</h3>
                                <p className="admin-empty-text">
                                    Great! No user reports at the moment.
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="admin-card" style={{ padding: 0, overflow: 'hidden' }}>
                            <table className="admin-table">
                                <thead>
                                    <tr>
                                        <th>Type</th>
                                        <th>Reported By</th>
                                        <th>Subject</th>
                                        <th>Reason</th>
                                        <th>Status</th>
                                        <th>Date</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {reports.map(report => (
                                        <tr key={report.id}>
                                            <td>
                                                <span className={
                                                    report.type === 'user'
                                                        ? 'admin-badge admin-badge-danger'
                                                        : 'admin-badge admin-badge-warning'
                                                }>
                                                    {report.type === 'user' ? '👤 User' : '✉️ Invitation'}
                                                </span>
                                            </td>
                                            <td>
                                                <div>
                                                    <div style={{ fontWeight: '600', color: '#ffffff' }}>
                                                        {report.reportedByName}
                                                    </div>
                                                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                                        ID: {report.reportedBy}
                                                    </div>
                                                </div>
                                            </td>
                                            <td>
                                                <div style={{ color: '#ffffff' }}>
                                                    {report.type === 'user'
                                                        ? report.reportedUserName
                                                        : report.invitationTitle}
                                                </div>
                                            </td>
                                            <td>
                                                <div className="admin-flex admin-gap-1" style={{ alignItems: 'center' }}>
                                                    <FaFlag style={{ color: '#ef4444', fontSize: '0.875rem' }} />
                                                    <span style={{ fontSize: '0.875rem', color: '#94a3b8' }}>
                                                        {report.reason}
                                                    </span>
                                                </div>
                                            </td>
                                            <td>
                                                <span className="admin-badge admin-badge-warning">
                                                    ⏳ {report.status}
                                                </span>
                                            </td>
                                            <td>
                                                <div style={{ fontSize: '0.875rem', color: '#94a3b8' }}>
                                                    {report.createdAt?.toLocaleDateString?.() || 'N/A'}
                                                </div>
                                            </td>
                                            <td>
                                                <div className="admin-flex admin-gap-1">
                                                    <button
                                                        className="admin-btn admin-btn-sm"
                                                        style={{ background: '#3b82f6', color: '#ffffff', padding: '0.5rem' }}
                                                    >
                                                        <FaEye />
                                                    </button>
                                                    <button
                                                        className="admin-btn admin-btn-sm admin-btn-success"
                                                        style={{ padding: '0.5rem' }}
                                                    >
                                                        <FaCheckCircle />
                                                    </button>
                                                    <button
                                                        className="admin-btn admin-btn-sm admin-btn-secondary"
                                                        style={{ padding: '0.5rem' }}
                                                    >
                                                        <FaTimesCircle />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default ReportsAnalytics;
