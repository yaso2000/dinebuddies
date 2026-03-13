import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, doc, updateDoc, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { getSafeAvatar } from '../utils/avatarUtils';
import { adminSecurityService } from '../services/adminSecurityService';
import { FaArrowLeft, FaUser, FaStore, FaCrown, FaSearch } from 'react-icons/fa';
import './AdminPanel.css';

const AdminPanel = () => {
    const navigate = useNavigate();
    const { currentUser, userProfile } = useAuth();
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState('all'); // all, individual, business
    const [updating, setUpdating] = useState(null);

    useEffect(() => {
        // Check if user is admin
        if (!currentUser || userProfile?.role !== 'admin') {
            navigate('/');
            return;
        }

        fetchUsers();
    }, [currentUser, userProfile, navigate]);

    const fetchUsers = async () => {
        try {
            setLoading(true);
            const usersRef = collection(db, 'users');
            const q = query(usersRef, orderBy('created_time', 'desc'));
            const snapshot = await getDocs(q);

            const usersData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            setUsers(usersData);
        } catch (error) {
            console.error('Error fetching users:', error);
        } finally {
            setLoading(false);
        }
    };

    // Map tier → weeklyPrivateQuota for regular user plans only (matches planDefaults.js)
    const TIER_QUOTAS = {
        free: 0,
        pro: 2,     // Pro: 2 private invitations/week
        vip: -1     // Premium (vip): unlimited
    };

    const updateSubscription = async (userId, newTier) => {
        try {
            setUpdating(userId);
            const userRef = doc(db, 'users', userId);
            const quota = TIER_QUOTAS[newTier] ?? 0;
            await updateDoc(userRef, {
                subscriptionTier: newTier,
                weeklyPrivateQuota: quota,
                // Reset used credits when upgrading
                usedPrivateCreditsThisWeek: 0
            });

            // Update local state
            setUsers(users.map(user =>
                user.id === userId
                    ? { ...user, subscriptionTier: newTier, weeklyPrivateQuota: quota }
                    : user
            ));

            console.log(`✅ Updated ${userId} to ${newTier} (quota: ${quota === -1 ? 'unlimited' : quota})`);
        } catch (error) {
            console.error('Error updating subscription:', error);
            alert('Failed to update subscription');
        } finally {
            setUpdating(null);
        }
    };

    const updateBusinessSubscription = async (userId, newTier) => {
        try {
            setUpdating(userId);
            await adminSecurityService.setUserSubscriptionTier(userId, newTier, true);

            setUsers(users.map(user =>
                user.id === userId ? { ...user, subscriptionTier: newTier } : user
            ));

            console.log(`✅ Updated business ${userId} to ${newTier}`);
        } catch (error) {
            console.error('Error updating business subscription:', error);
            alert('Failed to update business subscription');
        } finally {
            setUpdating(null);
        }
    };

    const filteredUsers = users.filter(user => {
        const matchesSearch =
            user.display_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            user.businessInfo?.businessName?.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesFilter =
            filterType === 'all' ||
            (filterType === 'business' && user.role === 'business') ||
            (filterType === 'individual' && user.role !== 'business');

        return matchesSearch && matchesFilter;
    });

    if (loading) {
        return (
            <div className="admin-panel">
                <div className="loading-container">
                    <div className="spinner"></div>
                    <p>Loading users...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="admin-panel">
            {/* Header */}
            <header className="app-header sticky-header-glass">
                <button className="back-btn" onClick={() => navigate('/')}>
                    <FaArrowLeft style={{ transform: 'rotate(180deg)' }} />
                </button>
                <h1 style={{ flex: 1, textAlign: 'center', fontSize: '1.2rem', fontWeight: '800' }}>
                    👑 Admin Panel
                </h1>
                <div style={{ width: '40px' }}></div>
            </header>

            <div className="admin-content">
                {/* Search & Filters */}
                <div className="admin-controls">
                    <div className="search-box">
                        <FaSearch />
                        <input
                            type="text"
                            placeholder="Search users..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <div className="filter-tabs">
                        <button
                            className={filterType === 'all' ? 'active' : ''}
                            onClick={() => setFilterType('all')}
                        >
                            All ({users.length})
                        </button>
                        <button
                            className={filterType === 'individual' ? 'active' : ''}
                            onClick={() => setFilterType('individual')}
                        >
                            <FaUser /> Users ({users.filter(u => u.role !== 'business').length})
                        </button>
                        <button
                            className={filterType === 'business' ? 'active' : ''}
                            onClick={() => setFilterType('business')}
                        >
                            <FaStore /> Businesses ({users.filter(u => u.role === 'business').length})
                        </button>
                    </div>
                </div>

                {/* Users List */}
                <div className="users-list">
                    {filteredUsers.length === 0 ? (
                        <div className="no-results">
                            <p>No users found</p>
                        </div>
                    ) : (
                        filteredUsers.map(user => (
                            <div key={user.id} className="user-card">
                                {/* User Info */}
                                <div className="user-info">
                                    <div className="user-avatar">
                                        <img src={getSafeAvatar(user)} alt={user.display_name} />
                                    </div>

                                    <div className="user-details">
                                        <h3>
                                            {user.role === 'business'
                                                ? user.businessInfo?.businessName || user.display_name
                                                : user.display_name
                                            }
                                        </h3>
                                        <p className="user-email">{user.email}</p>
                                        <div className="user-badges">
                                            <span className={`badge ${user.role === 'business' ? 'business' : 'user'}`}>
                                                {user.role === 'business' ? <FaStore /> : <FaUser />}
                                                {user.role === 'business' ? 'Business' : 'User'}
                                            </span>
                                            {user.role === 'admin' && (
                                                <span className="badge admin">
                                                    👑 Admin
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Subscription Control */}
                                <div className="subscription-control">
                                    <label>Subscription Plan:</label>
                                    {user.role === 'business' ? (
                                        <>
                                            <select
                                                value={(() => {
                                                    const raw = (user.subscriptionTier || 'free').toLowerCase();
                                                    return ['free', 'professional', 'elite'].includes(raw) ? raw : 'free';
                                                })()}
                                                onChange={(e) => updateBusinessSubscription(user.id, e.target.value)}
                                                disabled={updating === user.id}
                                            >
                                                <option value="free">🆓 Free</option>
                                                <option value="professional">⚡ Professional</option>
                                                <option value="elite">👑 Elite</option>
                                            </select>
                                            <span className="plan-hint">Business plan</span>
                                        </>
                                    ) : (
                                        <select
                                            value={user.subscriptionTier || 'free'}
                                            onChange={(e) => updateSubscription(user.id, e.target.value)}
                                            disabled={updating === user.id}
                                        >
                                            <option value="free">🆓 Free</option>
                                            <option value="pro">⚡ Pro</option>
                                            <option value="vip">👑 Premium</option>
                                        </select>
                                    )}
                                    {updating === user.id && (
                                        <span className="updating">Updating...</span>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

export default AdminPanel;
