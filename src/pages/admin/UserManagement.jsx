import React, { useState, useEffect } from 'react';
import { collection, getDocs, doc, updateDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { FaSearch, FaFilter, FaUser, FaStore, FaBan, FaTrash, FaEye, FaCrown, FaCheckCircle, FaTimesCircle } from 'react-icons/fa';

const UserManagement = () => {
    const [users, setUsers] = useState([]);
    const [filteredUsers, setFilteredUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterType, setFilterType] = useState('all');
    const [selectedUser, setSelectedUser] = useState(null);
    const [showUserModal, setShowUserModal] = useState(false);

    useEffect(() => {
        fetchUsers();
    }, []);

    useEffect(() => {
        filterUsers();
    }, [users, searchQuery, filterType]);

    const fetchUsers = async () => {
        try {
            setLoading(true);
            const usersRef = collection(db, 'users');
            const snapshot = await getDocs(usersRef);

            const usersData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            console.log('Fetched users:', usersData); // Debug
            setUsers(usersData);
        } catch (error) {
            console.error('Error fetching users:', error);
            alert('Failed to fetch users: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const filterUsers = () => {
        let filtered = [...users];

        // Filter by type
        if (filterType !== 'all') {
            if (filterType === 'admin') {
                filtered = filtered.filter(user => user.role === 'admin');
            } else if (filterType === 'business') {
                filtered = filtered.filter(user => user.accountType === 'business');
            } else if (filterType === 'individual') {
                filtered = filtered.filter(user => user.accountType !== 'business' && user.role !== 'admin');
            }
        }

        // Filter by search
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(user =>
                user.displayName?.toLowerCase().includes(query) ||
                user.email?.toLowerCase().includes(query) ||
                user.id.toLowerCase().includes(query)
            );
        }

        setFilteredUsers(filtered);
    };

    const handleBanUser = async (userId, currentStatus) => {
        const action = currentStatus ? 'unban' : 'ban';
        if (!window.confirm(`Are you sure you want to ${action} this user?`)) return;

        try {
            await updateDoc(doc(db, 'users', userId), {
                banned: !currentStatus,
                bannedAt: !currentStatus ? new Date() : null
            });

            setUsers(users.map(user =>
                user.id === userId
                    ? { ...user, banned: !currentStatus }
                    : user
            ));

            alert(`User ${action}ned successfully!`);
        } catch (error) {
            console.error('Error banning user:', error);
            alert('Failed to update user status');
        }
    };

    const handleDeleteUser = async (userId) => {
        if (!window.confirm('Are you sure you want to DELETE this user? This action cannot be undone!')) return;

        try {
            await deleteDoc(doc(db, 'users', userId));
            setUsers(users.filter(user => user.id !== userId));
            alert('User deleted successfully!');
        } catch (error) {
            console.error('Error deleting user:', error);
            alert('Failed to delete user');
        }
    };

    const handleMakeAdmin = async (userId, currentRole) => {
        const action = currentRole === 'admin' ? 'remove admin role from' : 'make admin';
        if (!window.confirm(`Are you sure you want to ${action} this user?`)) return;

        try {
            await updateDoc(doc(db, 'users', userId), {
                role: currentRole === 'admin' ? 'user' : 'admin'
            });

            setUsers(users.map(user =>
                user.id === userId
                    ? { ...user, role: currentRole === 'admin' ? 'user' : 'admin' }
                    : user
            ));

            alert('User role updated successfully!');
        } catch (error) {
            console.error('Error updating user role:', error);
            alert('Failed to update user role');
        }
    };

    if (loading) {
        return (
            <div className="admin-loading">
                <div style={{ textAlign: 'center' }}>
                    <div className="admin-spinner" />
                    <p style={{ color: '#94a3b8', fontSize: '1rem', marginTop: '1rem' }}>Loading users...</p>
                </div>
            </div>
        );
    }

    return (
        <div>
            {/* Header */}
            <div className="admin-flex-between admin-mb-4">
                <div className="admin-page-header" style={{ marginBottom: 0 }}>
                    <h1 className="admin-page-title">User Management</h1>
                    <p className="admin-page-subtitle">Manage all users and their accounts</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '2rem', fontWeight: '800', color: '#6366f1' }}>
                        {filteredUsers.length}
                    </div>
                    <div style={{ fontSize: '0.875rem', color: '#94a3b8' }}>
                        Total Users
                    </div>
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
                            placeholder="Search by name, email, or ID..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="admin-search-input"
                        />
                    </div>

                    {/* Filter */}
                    <select
                        value={filterType}
                        onChange={(e) => setFilterType(e.target.value)}
                        className="admin-select"
                        style={{ width: '200px' }}
                    >
                        <option value="all">All Users</option>
                        <option value="individual">Individual</option>
                        <option value="business">Business</option>
                        <option value="admin">Admins</option>
                    </select>
                </div>
            </div>

            {/* Stats */}
            <div className="admin-grid admin-grid-4 admin-mb-4">
                <div className="admin-card">
                    <div style={{ fontSize: '2rem', fontWeight: '800', color: '#ffffff' }}>{users.length}</div>
                    <div style={{ fontSize: '0.875rem', color: '#94a3b8' }}>Total</div>
                </div>
                <div className="admin-card">
                    <div style={{ fontSize: '2rem', fontWeight: '800', color: '#60a5fa' }}>
                        {users.filter(u => u.accountType !== 'business' && u.role !== 'admin').length}
                    </div>
                    <div style={{ fontSize: '0.875rem', color: '#94a3b8' }}>Individual</div>
                </div>
                <div className="admin-card">
                    <div style={{ fontSize: '2rem', fontWeight: '800', color: '#c084fc' }}>
                        {users.filter(u => u.accountType === 'business').length}
                    </div>
                    <div style={{ fontSize: '0.875rem', color: '#94a3b8' }}>Business</div>
                </div>
                <div className="admin-card">
                    <div style={{ fontSize: '2rem', fontWeight: '800', color: '#fbbf24' }}>
                        {users.filter(u => u.role === 'admin').length}
                    </div>
                    <div style={{ fontSize: '0.875rem', color: '#94a3b8' }}>Admins</div>
                </div>
            </div>

            {/* Users List */}
            {filteredUsers.length === 0 ? (
                <div className="admin-card">
                    <div className="admin-empty">
                        <div className="admin-empty-icon">👥</div>
                        <h3 className="admin-empty-title">No Users Found</h3>
                        <p className="admin-empty-text">
                            {searchQuery ? 'Try a different search term' : 'No users in the system yet'}
                        </p>
                    </div>
                </div>
            ) : (
                <div className="admin-card" style={{ padding: 0, overflow: 'hidden' }}>
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th>User</th>
                                <th>Type</th>
                                <th>Subscription</th>
                                <th>Status</th>
                                <th>Joined</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredUsers.map(user => (
                                <tr key={user.id}>
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
                                                fontWeight: '700',
                                                fontSize: '1rem'
                                            }}>
                                                {user.displayName?.charAt(0)?.toUpperCase() ||
                                                    user.email?.charAt(0)?.toUpperCase() || '?'}
                                            </div>
                                            <div>
                                                <div className="admin-flex admin-gap-1" style={{ alignItems: 'center', fontWeight: '600', color: '#ffffff' }}>
                                                    {user.displayName || 'No Name'}
                                                    {user.role === 'admin' && (
                                                        <FaCrown style={{ color: '#fbbf24', fontSize: '0.875rem' }} title="Admin" />
                                                    )}
                                                </div>
                                                <div style={{ fontSize: '0.875rem', color: '#94a3b8' }}>{user.email}</div>
                                            </div>
                                        </div>
                                    </td>

                                    {/* Type */}
                                    <td>
                                        <div className="admin-flex admin-gap-1" style={{ alignItems: 'center' }}>
                                            {user.accountType === 'business' ? (
                                                <>
                                                    <FaStore style={{ color: '#c084fc' }} />
                                                    <span style={{ color: '#c084fc' }}>Business</span>
                                                </>
                                            ) : (
                                                <>
                                                    <FaUser style={{ color: '#60a5fa' }} />
                                                    <span style={{ color: '#60a5fa' }}>Individual</span>
                                                </>
                                            )}
                                        </div>
                                    </td>

                                    {/* Subscription */}
                                    <td>
                                        {user.subscription?.active ? (
                                            <div>
                                                <div style={{ color: '#22c55e', fontWeight: '600' }}>
                                                    {user.subscription.planId || 'Active'}
                                                </div>
                                                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                                                    {user.subscription.status || 'active'}
                                                </div>
                                            </div>
                                        ) : (
                                            <span style={{ color: '#64748b' }}>Free</span>
                                        )}
                                    </td>

                                    {/* Status */}
                                    <td>
                                        <span className={user.banned ? 'admin-badge admin-badge-danger' : 'admin-badge admin-badge-success'}>
                                            {user.banned ? (
                                                <>
                                                    <FaTimesCircle style={{ fontSize: '0.75rem' }} />
                                                    Banned
                                                </>
                                            ) : (
                                                <>
                                                    <FaCheckCircle style={{ fontSize: '0.75rem' }} />
                                                    Active
                                                </>
                                            )}
                                        </span>
                                    </td>

                                    {/* Joined */}
                                    <td>
                                        <div style={{ fontSize: '0.875rem', color: '#94a3b8' }}>
                                            {user.createdAt?.toDate?.()?.toLocaleDateString() || 'N/A'}
                                        </div>
                                    </td>

                                    {/* Actions */}
                                    <td>
                                        <div className="admin-flex admin-gap-1">
                                            <button
                                                onClick={() => {
                                                    setSelectedUser(user);
                                                    setShowUserModal(true);
                                                }}
                                                className="admin-btn admin-btn-sm"
                                                style={{ background: '#3b82f6', color: '#ffffff', padding: '0.5rem' }}
                                                title="View Details"
                                            >
                                                <FaEye />
                                            </button>
                                            <button
                                                onClick={() => handleMakeAdmin(user.id, user.role)}
                                                className="admin-btn admin-btn-sm"
                                                style={{
                                                    background: user.role === 'admin' ? '#f59e0b' : '#a855f7',
                                                    color: '#ffffff',
                                                    padding: '0.5rem'
                                                }}
                                                title={user.role === 'admin' ? 'Remove Admin' : 'Make Admin'}
                                            >
                                                <FaCrown />
                                            </button>
                                            <button
                                                onClick={() => handleBanUser(user.id, user.banned)}
                                                className={`admin-btn admin-btn-sm ${user.banned ? 'admin-btn-success' : 'admin-btn-danger'}`}
                                                style={{ padding: '0.5rem' }}
                                                title={user.banned ? 'Unban' : 'Ban'}
                                            >
                                                <FaBan />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteUser(user.id)}
                                                className="admin-btn admin-btn-sm admin-btn-danger"
                                                style={{ padding: '0.5rem' }}
                                                title="Delete User"
                                            >
                                                <FaTrash />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* User Details Modal */}
            {showUserModal && selectedUser && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    background: 'rgba(0, 0, 0, 0.7)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 50,
                    padding: '1rem'
                }}>
                    <div className="admin-card" style={{
                        maxWidth: '600px',
                        width: '100%',
                        maxHeight: '90vh',
                        overflowY: 'auto'
                    }}>
                        <div className="admin-flex-between admin-mb-4">
                            <h2 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#ffffff' }}>
                                User Details
                            </h2>
                            <button
                                onClick={() => setShowUserModal(false)}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    color: '#94a3b8',
                                    fontSize: '2rem',
                                    cursor: 'pointer',
                                    padding: 0
                                }}
                            >
                                ×
                            </button>
                        </div>

                        <div style={{ display: 'grid', gap: '1rem' }}>
                            <div>
                                <label className="admin-label">Name</label>
                                <div style={{ color: '#ffffff', fontWeight: '600' }}>
                                    {selectedUser.displayName || 'N/A'}
                                </div>
                            </div>
                            <div>
                                <label className="admin-label">Email</label>
                                <div style={{ color: '#ffffff' }}>{selectedUser.email}</div>
                            </div>
                            <div>
                                <label className="admin-label">User ID</label>
                                <div style={{ color: '#ffffff', fontFamily: 'monospace', fontSize: '0.875rem' }}>
                                    {selectedUser.id}
                                </div>
                            </div>
                            <div>
                                <label className="admin-label">Account Type</label>
                                <div style={{ color: '#ffffff' }}>
                                    {selectedUser.accountType || 'individual'}
                                </div>
                            </div>
                            <div>
                                <label className="admin-label">Role</label>
                                <div style={{ color: '#ffffff' }}>
                                    {selectedUser.role || 'user'}
                                </div>
                            </div>
                            <div>
                                <label className="admin-label">Status</label>
                                <div style={{ color: selectedUser.banned ? '#ef4444' : '#22c55e' }}>
                                    {selectedUser.banned ? 'Banned' : 'Active'}
                                </div>
                            </div>
                            <div>
                                <label className="admin-label">Joined</label>
                                <div style={{ color: '#ffffff' }}>
                                    {selectedUser.createdAt?.toDate?.()?.toLocaleString() || 'N/A'}
                                </div>
                            </div>
                            {selectedUser.businessInfo && (
                                <div>
                                    <label className="admin-label">Business Name</label>
                                    <div style={{ color: '#ffffff' }}>
                                        {selectedUser.businessInfo.businessName}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="admin-flex admin-gap-2 admin-mt-4">
                            <button
                                onClick={() => {
                                    handleMakeAdmin(selectedUser.id, selectedUser.role);
                                    setShowUserModal(false);
                                }}
                                className="admin-btn"
                                style={{
                                    flex: 1,
                                    background: '#a855f7',
                                    color: '#ffffff'
                                }}
                            >
                                {selectedUser.role === 'admin' ? 'Remove Admin' : 'Make Admin'}
                            </button>
                            <button
                                onClick={() => {
                                    handleBanUser(selectedUser.id, selectedUser.banned);
                                    setShowUserModal(false);
                                }}
                                className={`admin-btn ${selectedUser.banned ? 'admin-btn-success' : 'admin-btn-danger'}`}
                                style={{ flex: 1 }}
                            >
                                {selectedUser.banned ? 'Unban User' : 'Ban User'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UserManagement;
