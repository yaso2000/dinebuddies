import React, { useState, useEffect } from 'react';
import { collection, getDocs, doc, updateDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../context/AuthContext';
import { FaSearch, FaFilter, FaUser, FaStore, FaBan, FaTrash, FaEye, FaCrown, FaCheckCircle, FaTimesCircle } from 'react-icons/fa';

const UserManagement = () => {
    const { currentUser } = useAuth();
    const [users, setUsers] = useState([]);
    const [filteredUsers, setFilteredUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterType, setFilterType] = useState('all');
    const [filterRole, setFilterRole] = useState('all');
    const [selectedUser, setSelectedUser] = useState(null);
    const [showUserModal, setShowUserModal] = useState(false);
    const [isCleaningOrphans, setIsCleaningOrphans] = useState(false);
    const [isDeletingAll, setIsDeletingAll] = useState(false);

    useEffect(() => {
        fetchUsers();
    }, []);

    useEffect(() => {
        filterUsers();
    }, [users, searchQuery, filterType, filterRole]);

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
            if (filterType === 'business') {
                filtered = filtered.filter(user => user.accountType === 'business');
            } else if (filterType === 'individual') {
                filtered = filtered.filter(user => user.accountType !== 'business');
            }
        }

        // Filter by role
        if (filterRole !== 'all') {
            filtered = filtered.filter(user => user.role === filterRole);
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

            // Clean up user's posts, stories, and invitations automatically
            let deletedItems = 0;

            // Delete Posts
            const postsSnap = await getDocs(collection(db, 'communityPosts'));
            for (const docSnap of postsSnap.docs) {
                const post = docSnap.data();
                const authorId = post.partnerId || post.author?.id || post.authorId || post.userId || post.uid;
                if (authorId === userId) {
                    await deleteDoc(doc(db, 'communityPosts', docSnap.id));
                    deletedItems++;
                }
            }

            // Delete Stories
            const storiesSnap = await getDocs(collection(db, 'stories'));
            for (const docSnap of storiesSnap.docs) {
                const story = docSnap.data();
                const authorId = story.userId || story.uid || story.authorId || story.author?.id;
                if (authorId === userId) {
                    await deleteDoc(doc(db, 'stories', docSnap.id));
                    deletedItems++;
                }
            }

            // Delete Invitations
            const invSnap = await getDocs(collection(db, 'invitations'));
            for (const docSnap of invSnap.docs) {
                const inv = docSnap.data();
                const authorId = inv.author?.id || inv.authorId || inv.userId || inv.uid;
                if (authorId === userId) {
                    await deleteDoc(doc(db, 'invitations', docSnap.id));
                    deletedItems++;
                }
            }

            alert(`User deleted successfully! Cleaned up ${deletedItems} associated items.`);
        } catch (error) {
            console.error('Error deleting user:', error);
            alert('Failed to delete user: ' + error.message);
        }
    };

    const handleCleanOrphans = async () => {
        if (!window.confirm("This will scan the entire database for posts and stories belonging to deleted users and remove them. Continuing this action might take a few seconds. Proceed?")) return;

        setIsCleaningOrphans(true);
        try {
            // Get all valid user IDs
            const usersSnap = await getDocs(collection(db, 'users'));
            const validUserIds = new Set();
            usersSnap.docs.forEach(d => validUserIds.add(d.id));

            let deletedPosts = 0;
            let deletedStories = 0;

            // Check Posts
            const postsSnap = await getDocs(collection(db, 'communityPosts'));
            for (const docSnap of postsSnap.docs) {
                const post = docSnap.data();
                const authorId = post.partnerId || post.author?.id || post.authorId || post.userId || post.uid;
                if (authorId && !validUserIds.has(authorId)) {
                    await deleteDoc(doc(db, 'communityPosts', docSnap.id));
                    deletedPosts++;
                }
            }

            // Check Stories
            const storiesSnap = await getDocs(collection(db, 'stories'));
            for (const docSnap of storiesSnap.docs) {
                const story = docSnap.data();
                const authorId = story.userId || story.uid || story.authorId || story.author?.id;
                if (authorId && !validUserIds.has(authorId)) {
                    await deleteDoc(doc(db, 'stories', docSnap.id));
                    deletedStories++;
                }
            }

            alert(`Cleanup Complete!\nDeleted ${deletedPosts} orphaned posts.\nDeleted ${deletedStories} orphaned stories.`);
        } catch (err) {
            console.error(err);
            alert("Error cleaning orphans: " + err.message);
        } finally {
            setIsCleaningOrphans(false);
        }
    };

    const handleDeleteAllPosts = async () => {
        const confirm1 = window.confirm("⚠️ WARNING: This will DELETE ALL POSTS AND STORIES from the database for ALL USERS. This action is irreversible. Are you absolutely sure?");
        if (!confirm1) return;

        const confirm2 = window.prompt('To confirm deletion of ALL POSTS AND STORIES, please type "DELETE ALL"');
        if (confirm2 !== "DELETE ALL") {
            alert("Deletion cancelled.");
            return;
        }

        setIsDeletingAll(true);
        try {
            let deletedPosts = 0;
            let deletedStories = 0;

            // Delete ALL Posts
            const postsSnap = await getDocs(collection(db, 'communityPosts'));
            for (const docSnap of postsSnap.docs) {
                await deleteDoc(doc(db, 'communityPosts', docSnap.id));
                deletedPosts++;
            }

            // Delete ALL Stories
            const storiesSnap = await getDocs(collection(db, 'stories'));
            for (const docSnap of storiesSnap.docs) {
                await deleteDoc(doc(db, 'stories', docSnap.id));
                deletedStories++;
            }

            alert(`✅ Full Wipe Complete!\nDeleted ${deletedPosts} posts.\nDeleted ${deletedStories} stories.`);
        } catch (err) {
            console.error(err);
            alert("Error wiping database: " + err.message);
        } finally {
            setIsDeletingAll(false);
        }
    };

    const handleUpdateRole = async (userId, newRole) => {
        if (!window.confirm(`Are you sure you want to change this user's role to ${newRole}?`)) return;

        try {
            const updates = {};
            if (newRole === 'business') {
                updates.accountType = 'business';
                updates.role = 'user';
            } else {
                updates.accountType = 'individual';
                updates.role = newRole;
            }

            await updateDoc(doc(db, 'users', userId), updates);

            setUsers(users.map(user =>
                user.id === userId
                    ? { ...user, ...updates }
                    : user
            ));

            alert('User role updated successfully!');
        } catch (error) {
            console.error('Error updating user role:', error);
            alert('Failed to update user role');
        }
    };

    const handleMakeAdmin = async (userId, currentRole) => {
        const newRole = currentRole === 'admin' ? 'user' : 'admin';
        await handleUpdateRole(userId, newRole);
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
                <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    <button
                        onClick={handleDeleteAllPosts}
                        disabled={isDeletingAll || isCleaningOrphans}
                        className="admin-btn"
                        style={{ padding: '8px 16px', fontWeight: 'bold', background: '#dc2626', color: 'white', border: 'none' }}
                    >
                        {isDeletingAll ? 'Wiping DB...' : 'Delete ALL Posts & Stories'}
                    </button>
                    <button
                        onClick={handleCleanOrphans}
                        disabled={isCleaningOrphans || isDeletingAll}
                        className="admin-btn admin-btn-danger"
                        style={{ padding: '8px 16px', fontWeight: 'bold' }}
                    >
                        {isCleaningOrphans ? 'Cleaning...' : 'Clean Orphaned Posts/Stories'}
                    </button>
                    <div style={{ marginLeft: '12px', textAlign: 'right' }}>
                        <div style={{ fontSize: '2rem', fontWeight: '800', color: '#6366f1' }}>
                            {filteredUsers.length}
                        </div>
                        <div style={{ fontSize: '0.875rem', color: '#94a3b8' }}>
                            Total Users
                        </div>
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

                    {/* Type Filter */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 'bold' }}>ACCOUNT TYPE</label>
                        <select
                            value={filterType}
                            onChange={(e) => setFilterType(e.target.value)}
                            className="admin-select"
                            style={{ width: '160px' }}
                        >
                            <option value="all">All Types</option>
                            <option value="individual">Individual</option>
                            <option value="business">Business</option>
                        </select>
                    </div>

                    {/* Role Filter */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 'bold' }}>SYSTEM ROLE</label>
                        <select
                            value={filterRole}
                            onChange={(e) => setFilterRole(e.target.value)}
                            className="admin-select"
                            style={{ width: '160px' }}
                        >
                            <option value="all">All Roles</option>
                            <option value="user">User</option>
                            <option value="staff">Staff</option>
                            <option value="support">Support</option>
                            <option value="admin">Admin</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Stats */}
            <div className="admin-grid admin-grid-4 admin-mb-4">
                <div className="admin-card">
                    <div style={{ fontSize: '2rem', fontWeight: '800', color: '#ffffff' }}>{users.length}</div>
                    <div style={{ fontSize: '0.875rem', color: '#94a3b8' }}>Total Users</div>
                </div>
                <div className="admin-card">
                    <div style={{ fontSize: '2rem', fontWeight: '800', color: '#60a5fa' }}>
                        {users.filter(u => u.accountType !== 'business' && (!u.role || u.role === 'user')).length}
                    </div>
                    <div style={{ fontSize: '0.875rem', color: '#94a3b8' }}>Individuals</div>
                </div>
                <div className="admin-card">
                    <div style={{ fontSize: '2rem', fontWeight: '800', color: '#c084fc' }}>
                        {users.filter(u => u.accountType === 'business').length}
                    </div>
                    <div style={{ fontSize: '0.875rem', color: '#94a3b8' }}>Businesses</div>
                </div>
                <div className="admin-card">
                    <div style={{ fontSize: '2rem', fontWeight: '800', color: '#fbbf24' }}>
                        {users.filter(u => u.role === 'admin' || u.role === 'staff' || u.role === 'support').length}
                    </div>
                    <div style={{ fontSize: '0.875rem', color: '#94a3b8' }}>Team Members</div>
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

                                    {/* System Role Dropdown */}
                                    <td>
                                        <select
                                            value={user.accountType === 'business' ? 'business' : (user.role || 'user')}
                                            onChange={(e) => handleUpdateRole(user.id, e.target.value)}
                                            className="admin-select"
                                            style={{
                                                width: '120px',
                                                borderColor: user.accountType === 'business' ? '#c084fc' : user.role === 'admin' ? '#fbbf24' : user.role === 'staff' ? '#a855f7' : user.role === 'support' ? '#3b82f6' : 'rgba(255,255,255,0.1)',
                                                color: user.accountType === 'business' ? '#c084fc' : user.role === 'admin' ? '#fbbf24' : user.role === 'staff' ? '#a855f7' : user.role === 'support' ? '#3b82f6' : '#ffffff',
                                                fontWeight: (user.role !== 'user' || user.accountType === 'business') ? 'bold' : 'normal'
                                            }}
                                        >
                                            <option value="user">User</option>
                                            <option value="business">Business</option>
                                            <option value="staff">Staff</option>
                                            <option value="support">Support</option>
                                            <option value="admin">Admin</option>
                                        </select>
                                    </td>

                                    {/* Subscription */}
                                    <td>
                                        <select
                                            value={user.subscriptionTier || 'free'}
                                            onChange={async (e) => {
                                                const newTier = e.target.value;
                                                try {
                                                    await updateDoc(doc(db, 'users', user.id), {
                                                        subscriptionTier: newTier
                                                    });
                                                    setUsers(users.map(u =>
                                                        u.id === user.id
                                                            ? { ...u, subscriptionTier: newTier }
                                                            : u
                                                    ));
                                                    alert(`Subscription updated to ${newTier}!`);
                                                } catch (error) {
                                                    console.error('Error updating subscription:', error);
                                                    alert('Failed to update subscription');
                                                }
                                            }}
                                            style={{
                                                background: '#1e293b',
                                                border: '1px solid #334155',
                                                borderRadius: '6px',
                                                color: user.subscriptionTier === 'premium' ? '#22c55e' :
                                                    user.subscriptionTier === 'vip' ? '#f59e0b' : '#64748b',
                                                padding: '6px 10px',
                                                fontSize: '0.875rem',
                                                fontWeight: '600',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            <option value="free">Free</option>
                                            <option value="premium">Premium</option>
                                            <option value="vip">VIP</option>
                                        </select>
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
                                            {(() => {
                                                if (!user.createdAt) return 'N/A';
                                                try {
                                                    // Handle Firestore Timestamp or standard Date/String
                                                    const date = user.createdAt?.toDate ? user.createdAt.toDate() : new Date(user.createdAt);
                                                    return isNaN(date.getTime()) ? 'N/A' : date.toLocaleDateString();
                                                } catch (e) {
                                                    return 'N/A';
                                                }
                                            })()}
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
                                                onClick={() => handleBanUser(user.id, user.banned)}
                                                className={`admin-btn admin-btn-sm ${user.banned ? 'admin-btn-success' : 'admin-btn-danger'}`}
                                                style={{ padding: '0.5rem' }}
                                                title={user.banned ? 'Unban' : 'Ban'}
                                            >
                                                <FaBan />
                                            </button>
                                            {/* Delete Button - PROTECTED */}
                                            {(() => {
                                                const isSuperOwner = ['admin@dinebuddies.com', 'y.abohamed@gmail.com', 'yaser@dinebuddies.com', 'info@dinebuddies.com.au'].includes(currentUser?.email?.toLowerCase()) ||
                                                    currentUser?.uid === 'xTgHC1v00LZIZ6ESA9YGjGU5zW33';

                                                const targetIsAdmin = user.role === 'admin' || user.accountType === 'admin';

                                                // Only show delete button if:
                                                // 1. Target is NOT an admin (anyone with admin rights can delete normal users)
                                                // 2. OR Current user IS Super Owner (can delete anyone)
                                                if (!targetIsAdmin || isSuperOwner) {
                                                    return (
                                                        <button
                                                            onClick={() => handleDeleteUser(user.id)}
                                                            className="admin-btn admin-btn-sm admin-btn-danger"
                                                            style={{ padding: '0.5rem' }}
                                                            title="Delete User"
                                                        >
                                                            <FaTrash />
                                                        </button>
                                                    );
                                                }
                                                return null; // Hide button for admins if you are not super owner
                                            })()}
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
                                    {(() => {
                                        if (!selectedUser.createdAt) return 'N/A';
                                        try {
                                            const date = selectedUser.createdAt?.toDate ? selectedUser.createdAt.toDate() : new Date(selectedUser.createdAt);
                                            return isNaN(date.getTime()) ? 'N/A' : date.toLocaleString();
                                        } catch (e) {
                                            return 'N/A';
                                        }
                                    })()}
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
