import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, getDocs, query, orderBy, limit, documentId } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { FaSearch, FaFilter, FaCheckCircle, FaTimesCircle, FaCreditCard, FaCalendar, FaDollarSign, FaUser } from 'react-icons/fa';
import { adminSecurityService } from '../../services/adminSecurityService';

const SubscriptionManagement = () => {
    const [subscriptions, setSubscriptions] = useState([]);
    const [filteredSubscriptions, setFilteredSubscriptions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');

    useEffect(() => {
        fetchSubscriptions();
    }, []);

    useEffect(() => {
        filterSubscriptions();
    }, [subscriptions, searchQuery, filterStatus]);

    const fetchSubscriptions = async () => {
        try {
            setLoading(true);
            // Fetch all users with subscriptions
            const usersSnapshot = await getDocs(
                query(collection(db, 'users'), orderBy(documentId()), limit(500))
            );
            const usersWithSubs = usersSnapshot.docs
                .map((d) => ({
                    userId: d.id,
                    userName: d.data().display_name || d.data().displayName || 'No Name',
                    userEmail: d.data().email,
                    subscription: d.data().subscription,
                    role: d.data().role,
                    isBusiness: d.data().isBusiness === true,
                }))
                .filter(
                    (user) =>
                        user.subscription &&
                        user.subscription.active &&
                        (user.role === 'business' || user.isBusiness)
                );

            setSubscriptions(usersWithSubs);
        } catch (error) {
            console.error('Error fetching subscriptions:', error);
        } finally {
            setLoading(false);
        }
    };

    const filterSubscriptions = () => {
        let filtered = [...subscriptions];

        // Filter by status
        if (filterStatus !== 'all') {
            filtered = filtered.filter(sub => sub.subscription?.status === filterStatus);
        }

        // Filter by search
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(sub =>
                sub.userName?.toLowerCase().includes(query) ||
                sub.userEmail?.toLowerCase().includes(query) ||
                sub.subscription?.planId?.toLowerCase().includes(query)
            );
        }

        setFilteredSubscriptions(filtered);
    };

    const handleCancelSubscription = async (userId, userName) => {
        if (!window.confirm(`Cancel subscription for ${userName}?`)) return;

        try {
            await adminSecurityService.cancelUserSubscription(userId);

            setSubscriptions(subscriptions.map(sub =>
                sub.userId === userId
                    ? {
                        ...sub,
                        subscription: {
                            ...sub.subscription,
                            active: false,
                            status: 'canceled'
                        }
                    }
                    : sub
            ));

            alert('Subscription canceled successfully!');
        } catch (error) {
            console.error('Error canceling subscription:', error);
            alert('Failed to cancel subscription');
        }
    };

    // Calculate stats
    const stats = {
        total: subscriptions.length,
        active: subscriptions.filter(s => s.subscription?.status === 'active').length,
        canceled: subscriptions.filter(s => s.subscription?.status === 'canceled').length,
        revenue: subscriptions
            .filter(s => s.subscription?.status === 'active')
            .reduce((sum, s) => sum + (s.subscription?.price || 0), 0)
    };

    if (loading) {
        return (
            <div className="admin-loading">
                <div style={{ textAlign: 'center' }}>
                    <div className="admin-spinner" />
                    <p style={{ color: '#94a3b8', fontSize: '1rem', marginTop: '1rem' }}>Loading subscriptions...</p>
                </div>
            </div>
        );
    }

    return (
        <div>
            {/* Header */}
            <div className="admin-page-header admin-mb-4">
                <h1 className="admin-page-title">Subscription management</h1>
                <p className="admin-page-subtitle">
                    <strong>Business</strong> recurring subscriptions only. Consumer accounts use Dine credits — manage them under{' '}
                    <Link to="/admin/grant-credits" style={{ color: 'var(--admin-accent)' }}>Grant credits</Link>.
                </p>
            </div>

            <div
                className="admin-card admin-mb-4"
                style={{
                    borderLeft: '4px solid var(--admin-accent)',
                    padding: '1rem 1.25rem',
                    background: 'rgba(99, 102, 241, 0.08)',
                }}
            >
                <p style={{ margin: 0, color: 'var(--admin-text-primary)', fontSize: '0.95rem', lineHeight: 1.5 }}>
                    <strong>Stripe price IDs &amp; Firestore sync</strong> are not on this page. Update defaults in{' '}
                    <code style={{ fontSize: '0.85em' }}>src/config/planDefaults.js</code>, then open{' '}
                    <Link to="/admin/plans" style={{ color: 'var(--admin-accent)', fontWeight: 700 }}>
                        Plans &amp; Packs
                    </Link>{' '}
                    and use <strong>Sync from code → Firestore</strong> (does not call the Stripe API).
                </p>
            </div>

            {/* Stats */}
            <div className="admin-grid admin-grid-4 admin-mb-4">
                <div className="admin-card">
                    <div style={{ fontSize: '2rem', fontWeight: '800', color: '#ffffff' }}>{stats.total}</div>
                    <div style={{ fontSize: '0.875rem', color: '#94a3b8' }}>Total Subscriptions</div>
                </div>
                <div className="admin-card">
                    <div style={{ fontSize: '2rem', fontWeight: '800', color: '#22c55e' }}>{stats.active}</div>
                    <div style={{ fontSize: '0.875rem', color: '#94a3b8' }}>Active</div>
                </div>
                <div className="admin-card">
                    <div style={{ fontSize: '2rem', fontWeight: '800', color: '#ef4444' }}>{stats.canceled}</div>
                    <div style={{ fontSize: '0.875rem', color: '#94a3b8' }}>Canceled</div>
                </div>
                <div className="admin-card">
                    <div style={{ fontSize: '2rem', fontWeight: '800', color: '#f59e0b' }}>${stats.revenue}</div>
                    <div style={{ fontSize: '0.875rem', color: '#94a3b8' }}>Monthly Revenue</div>
                </div>
            </div>

            {/* Filters */}
            <div className="admin-card admin-mb-4">
                <div className="admin-flex admin-gap-2" style={{ flexWrap: 'wrap' }}>
                    {/* Search */}
                    <div className="admin-search" style={{ flex: 1, minWidth: '300px' }}>
                        <FaSearch className="admin-search-icon" />
                        <input
                            type="text"
                            placeholder="Search by user, email, or plan..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="admin-search-input"
                        />
                    </div>

                    {/* Filter */}
                    <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        className="admin-select"
                        style={{ width: '200px' }}
                    >
                        <option value="all">All Status</option>
                        <option value="active">Active</option>
                        <option value="canceled">Canceled</option>
                        <option value="past_due">Past Due</option>
                    </select>
                </div>
            </div>

            {/* Subscriptions List */}
            {filteredSubscriptions.length === 0 ? (
                <div className="admin-card">
                    <div className="admin-empty">
                        <div className="admin-empty-icon">💳</div>
                        <h3 className="admin-empty-title">No Subscriptions Found</h3>
                        <p className="admin-empty-text">
                            {searchQuery ? 'Try a different search term' : 'No active subscriptions yet'}
                        </p>
                    </div>
                </div>
            ) : (
                <div className="admin-card" style={{ padding: 0, overflow: 'hidden' }}>
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th>User</th>
                                <th>Plan</th>
                                <th>Price</th>
                                <th>Status</th>
                                <th>Start Date</th>
                                <th>Next Billing</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredSubscriptions.map(sub => (
                                <tr key={sub.userId}>
                                    {/* User */}
                                    <td>
                                        <div className="admin-flex admin-gap-2" style={{ alignItems: 'center' }}>
                                            <div style={{
                                                width: '40px',
                                                height: '40px',
                                                borderRadius: '50%',
                                                background: '#6366f1',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                color: '#ffffff',
                                                fontWeight: '700'
                                            }}>
                                                {sub.userName?.charAt(0)?.toUpperCase() || 'U'}
                                            </div>
                                            <div>
                                                <div style={{ fontWeight: '600', color: '#ffffff' }}>
                                                    {sub.userName}
                                                </div>
                                                <div style={{ fontSize: '0.875rem', color: '#94a3b8' }}>
                                                    {sub.userEmail}
                                                </div>
                                            </div>
                                        </div>
                                    </td>

                                    {/* Plan */}
                                    <td>
                                        <div className="admin-flex admin-gap-1" style={{ alignItems: 'center' }}>
                                            <FaCreditCard style={{ color: '#8b5cf6' }} />
                                            <span style={{ color: '#ffffff', fontWeight: '600' }}>
                                                {sub.subscription?.planId || 'Unknown'}
                                            </span>
                                        </div>
                                    </td>

                                    {/* Price */}
                                    <td>
                                        <div className="admin-flex admin-gap-1" style={{ alignItems: 'center' }}>
                                            <FaDollarSign style={{ color: '#22c55e' }} />
                                            <span style={{ color: '#ffffff', fontWeight: '600' }}>
                                                ${sub.subscription?.price || 0}
                                            </span>
                                            <span style={{ color: '#64748b', fontSize: '0.875rem' }}>
                                                /month
                                            </span>
                                        </div>
                                    </td>

                                    {/* Status */}
                                    <td>
                                        <span className={
                                            sub.subscription?.status === 'active'
                                                ? 'admin-badge admin-badge-success'
                                                : sub.subscription?.status === 'canceled'
                                                    ? 'admin-badge admin-badge-danger'
                                                    : 'admin-badge admin-badge-warning'
                                        }>
                                            {sub.subscription?.status === 'active' ? (
                                                <>
                                                    <FaCheckCircle style={{ fontSize: '0.75rem' }} />
                                                    Active
                                                </>
                                            ) : (
                                                <>
                                                    <FaTimesCircle style={{ fontSize: '0.75rem' }} />
                                                    {sub.subscription?.status || 'Unknown'}
                                                </>
                                            )}
                                        </span>
                                    </td>

                                    {/* Start Date */}
                                    <td>
                                        <div style={{ fontSize: '0.875rem', color: '#94a3b8' }}>
                                            {sub.subscription?.startDate?.toDate?.()?.toLocaleDateString() || 'N/A'}
                                        </div>
                                    </td>

                                    {/* Next Billing */}
                                    <td>
                                        <div className="admin-flex admin-gap-1" style={{ alignItems: 'center' }}>
                                            <FaCalendar style={{ color: '#f59e0b', fontSize: '0.875rem' }} />
                                            <span style={{ fontSize: '0.875rem', color: '#94a3b8' }}>
                                                {sub.subscription?.nextBillingDate?.toDate?.()?.toLocaleDateString() || 'N/A'}
                                            </span>
                                        </div>
                                    </td>

                                    {/* Actions */}
                                    <td>
                                        <div className="admin-flex admin-gap-1">
                                            <button
                                                onClick={() => handleCancelSubscription(sub.userId, sub.userName)}
                                                className="admin-btn admin-btn-sm admin-btn-danger"
                                                disabled={sub.subscription?.status !== 'active'}
                                            >
                                                Cancel
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
    );
};

export default SubscriptionManagement;
