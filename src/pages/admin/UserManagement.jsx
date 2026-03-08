import React, { useState, useEffect } from 'react';
import { collection, getDocs, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../context/AuthContext';
import { FaSearch, FaUser, FaStore, FaBan, FaTrash, FaEye, FaCrown, FaCheckCircle, FaTimesCircle } from 'react-icons/fa';

// ── Helpers ──────────────────────────────────────────────────────────────────
const isBusiness = (u) => u.role === 'business';

// User subscription tiers (individual users)
const USER_TIERS = [
    { value: 'free', label: '🆓 Free', color: '#64748b' },
    { value: 'pro', label: '⚡ Pro', color: '#22c55e' },
    { value: 'vip', label: '👑 VIP', color: '#f59e0b' },
];

// Business subscription tiers
const BIZ_TIERS = [
    { value: 'free', label: '🆓 Free', color: '#64748b' },
    { value: 'professional', label: '⚡ Professional', color: '#8b5cf6' },
    { value: 'elite', label: '👑 Elite', color: '#f59e0b' },
];

// System roles
const SYSTEM_ROLES = ['user', 'staff', 'support', 'admin'];

const UserManagement = () => {
    const { currentUser } = useAuth();
    const [users, setUsers] = useState([]);
    const [filteredUsers, setFilteredUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterType, setFilterType] = useState('all');    // all | individual | business
    const [filterRole, setFilterRole] = useState('all');    // all | user | staff | support | admin | tester
    const [selectedUser, setSelectedUser] = useState(null);
    const [showUserModal, setShowUserModal] = useState(false);
    const [isCleaningOrphans, setIsCleaningOrphans] = useState(false);
    const [isDeletingAll, setIsDeletingAll] = useState(false);

    useEffect(() => { fetchUsers(); }, []);
    useEffect(() => { filterUsers(); }, [users, searchQuery, filterType, filterRole]);

    // ── Fetch ─────────────────────────────────────────────────────────────────
    const fetchUsers = async () => {
        try {
            setLoading(true);
            const snap = await getDocs(collection(db, 'users'));
            setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch (err) {
            console.error(err);
            alert('Failed to fetch users: ' + err.message);
        } finally { setLoading(false); }
    };

    // ── Filter ────────────────────────────────────────────────────────────────
    const filterUsers = () => {
        let f = [...users];

        if (filterType === 'business') f = f.filter(u => isBusiness(u));
        if (filterType === 'individual') f = f.filter(u => !isBusiness(u));

        if (filterRole !== 'all') {
            if (filterRole === 'tester') f = f.filter(u => u.isTester === true);
            else f = f.filter(u => u.role === filterRole);
        }

        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            f = f.filter(u =>
                u.display_name?.toLowerCase().includes(q) ||
                u.displayName?.toLowerCase().includes(q) ||
                u.email?.toLowerCase().includes(q) ||
                u.id.toLowerCase().includes(q)
            );
        }

        setFilteredUsers(f);
    };

    // ── Actions ───────────────────────────────────────────────────────────────
    const handleBanUser = async (userId, currentStatus) => {
        if (!window.confirm(`${currentStatus ? 'Unban' : 'Ban'} this user?`)) return;
        try {
            await updateDoc(doc(db, 'users', userId), {
                banned: !currentStatus,
                bannedAt: !currentStatus ? new Date() : null
            });
            setUsers(users.map(u => u.id === userId ? { ...u, banned: !currentStatus } : u));
        } catch (err) { alert('Failed: ' + err.message); }
    };

    const handleDeleteUser = async (userId) => {
        if (!window.confirm('Delete this user? This cannot be undone!')) return;
        try {
            await deleteDoc(doc(db, 'users', userId));
            setUsers(users.filter(u => u.id !== userId));
            // Cascade: posts, stories, invitations
            let deleted = 0;
            for (const col of ['communityPosts', 'stories', 'invitations']) {
                const snap = await getDocs(collection(db, col));
                for (const d of snap.docs) {
                    const data = d.data();
                    const aid = data.partnerId || data.author?.id || data.authorId || data.userId || data.uid;
                    if (aid === userId) { await deleteDoc(doc(db, col, d.id)); deleted++; }
                }
            }
            alert(`Deleted user + ${deleted} associated items.`);
        } catch (err) { alert('Failed: ' + err.message); }
    };

    const handleCleanOrphans = async () => {
        if (!window.confirm('Scan and delete orphaned posts/stories?')) return;
        setIsCleaningOrphans(true);
        try {
            const validIds = new Set((await getDocs(collection(db, 'users'))).docs.map(d => d.id));
            let dp = 0, ds = 0;
            for (const d of (await getDocs(collection(db, 'communityPosts'))).docs) {
                const data = d.data();
                const aid = data.partnerId || data.author?.id || data.authorId || data.userId || data.uid;
                if (aid && !validIds.has(aid)) { await deleteDoc(doc(db, 'communityPosts', d.id)); dp++; }
            }
            for (const d of (await getDocs(collection(db, 'stories'))).docs) {
                const data = d.data();
                const aid = data.userId || data.uid || data.authorId || data.author?.id;
                if (aid && !validIds.has(aid)) { await deleteDoc(doc(db, 'stories', d.id)); ds++; }
            }
            alert(`Cleaned ${dp} posts + ${ds} stories.`);
        } catch (err) { alert('Error: ' + err.message); }
        finally { setIsCleaningOrphans(false); }
    };

    const handleDeleteAllPosts = async () => {
        if (!window.confirm('⚠️ Delete ALL posts and stories? Irreversible!')) return;
        if (window.prompt('Type "DELETE ALL" to confirm') !== 'DELETE ALL') return;
        setIsDeletingAll(true);
        try {
            let dp = 0, ds = 0;
            for (const d of (await getDocs(collection(db, 'communityPosts'))).docs) { await deleteDoc(doc(db, 'communityPosts', d.id)); dp++; }
            for (const d of (await getDocs(collection(db, 'stories'))).docs) { await deleteDoc(doc(db, 'stories', d.id)); ds++; }
            alert(`Wiped: ${dp} posts + ${ds} stories.`);
        } catch (err) { alert('Error: ' + err.message); }
        finally { setIsDeletingAll(false); }
    };

    const handleUpdateSystemRole = async (userId, newRole) => {
        if (!window.confirm(`Change role to "${newRole}"?`)) return;
        try {
            await updateDoc(doc(db, 'users', userId), { role: newRole });
            setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u));
        } catch (err) { alert('Failed: ' + err.message); }
    };

    const handleUpdateSubscription = async (userId, newTier, isBusinessUser) => {
        try {
            const updates = { subscriptionTier: newTier };
            // For individual users: update weeklyPrivateQuota
            if (!isBusinessUser) {
                const QUOTAS = { free: 0, pro: 2, vip: -1 };
                updates.weeklyPrivateQuota = QUOTAS[newTier] ?? 0;
                updates.usedPrivateCreditsThisWeek = 0;
            }
            await updateDoc(doc(db, 'users', userId), updates);
            setUsers(users.map(u => u.id === userId ? { ...u, ...updates } : u));
        } catch (err) { alert('Failed: ' + err.message); }
    };

    const handleToggleTester = async (userId, current) => {
        if (!window.confirm(`${current ? 'Remove' : 'Grant'} Tester access?`)) return;
        try {
            await updateDoc(doc(db, 'users', userId), { isTester: !current });
            setUsers(users.map(u => u.id === userId ? { ...u, isTester: !current } : u));
            if (selectedUser?.id === userId) setSelectedUser(s => ({ ...s, isTester: !current }));
        } catch (err) { alert('Failed: ' + err.message); }
    };

    // ── Computed Stats ────────────────────────────────────────────────────────
    const stats = {
        total: users.length,
        individuals: users.filter(u => !isBusiness(u) && !['admin', 'staff', 'support'].includes(u.role)).length,
        businesses: users.filter(u => isBusiness(u)).length,
        team: users.filter(u => ['admin', 'staff', 'support'].includes(u.role)).length,
    };

    // ── Render helpers ────────────────────────────────────────────────────────
    const getUserName = (u) => u.display_name || u.displayName || 'No Name';
    const getInitial = (u) => (getUserName(u).charAt(0) || u.email?.charAt(0) || '?').toUpperCase();

    const TypeBadge = ({ user }) => {
        if (isBusiness(user)) return <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#c084fc', background: 'rgba(192,132,252,0.15)', padding: '3px 8px', borderRadius: 6, border: '1px solid rgba(192,132,252,0.3)' }}>🏪 Business</span>;
        if (user.role === 'admin') return <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#fbbf24', background: 'rgba(251,191,36,0.15)', padding: '3px 8px', borderRadius: 6, border: '1px solid rgba(251,191,36,0.3)' }}>👑 Admin</span>;
        if (user.role === 'staff') return <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#a855f7', background: 'rgba(168,85,247,0.15)', padding: '3px 8px', borderRadius: 6, border: '1px solid rgba(168,85,247,0.3)' }}>🛠 Staff</span>;
        if (user.role === 'support') return <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#3b82f6', background: 'rgba(59,130,246,0.15)', padding: '3px 8px', borderRadius: 6, border: '1px solid rgba(59,130,246,0.3)' }}>💬 Support</span>;
        return <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#60a5fa', background: 'rgba(96,165,250,0.15)', padding: '3px 8px', borderRadius: 6, border: '1px solid rgba(96,165,250,0.3)' }}>👤 User</span>;
    };

    if (loading) return (
        <div className="admin-loading">
            <div style={{ textAlign: 'center' }}>
                <div className="admin-spinner" />
                <p style={{ color: '#94a3b8', marginTop: '1rem' }}>Loading users...</p>
            </div>
        </div>
    );

    return (
        <div>
            {/* Header */}
            <div className="admin-flex-between admin-mb-4">
                <div className="admin-page-header" style={{ marginBottom: 0 }}>
                    <h1 className="admin-page-title">User Management</h1>
                    <p className="admin-page-subtitle">Manage all users, businesses, and team members</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    <button onClick={handleDeleteAllPosts} disabled={isDeletingAll || isCleaningOrphans}
                        className="admin-btn" style={{ padding: '8px 16px', fontWeight: 'bold', background: '#dc2626', color: 'white', border: 'none' }}>
                        {isDeletingAll ? 'Wiping...' : 'Delete ALL Posts & Stories'}
                    </button>
                    <button onClick={handleCleanOrphans} disabled={isCleaningOrphans || isDeletingAll}
                        className="admin-btn admin-btn-danger" style={{ padding: '8px 16px', fontWeight: 'bold' }}>
                        {isCleaningOrphans ? 'Cleaning...' : 'Clean Orphaned Posts'}
                    </button>
                    <div style={{ marginLeft: 12, textAlign: 'right' }}>
                        <div style={{ fontSize: '2rem', fontWeight: 800, color: '#6366f1' }}>{filteredUsers.length}</div>
                        <div style={{ fontSize: '0.875rem', color: '#94a3b8' }}>Showing</div>
                    </div>
                </div>
            </div>

            {/* Stats */}
            <div className="admin-grid admin-grid-4 admin-mb-4">
                {[
                    { label: 'Total', value: stats.total, color: '#ffffff' },
                    { label: 'Individuals', value: stats.individuals, color: '#60a5fa' },
                    { label: 'Businesses', value: stats.businesses, color: '#c084fc' },
                    { label: 'Team Members', value: stats.team, color: '#fbbf24' },
                ].map(s => (
                    <div key={s.label} className="admin-card">
                        <div style={{ fontSize: '2rem', fontWeight: 800, color: s.color }}>{s.value}</div>
                        <div style={{ fontSize: '0.875rem', color: '#94a3b8' }}>{s.label}</div>
                    </div>
                ))}
            </div>

            {/* Filters */}
            <div className="admin-card admin-mb-4">
                <div className="admin-flex admin-gap-2" style={{ flexWrap: 'wrap' }}>
                    {/* Search */}
                    <div className="admin-search" style={{ flex: 1, minWidth: 280 }}>
                        <FaSearch className="admin-search-icon" />
                        <input type="text" placeholder="Search by name, email, or ID..."
                            value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                            className="admin-search-input" />
                    </div>

                    {/* Account Type */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <label style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 'bold' }}>ACCOUNT TYPE</label>
                        <select value={filterType} onChange={e => setFilterType(e.target.value)} className="admin-select" style={{ width: 160 }}>
                            <option value="all">All Types</option>
                            <option value="individual">👤 Individual</option>
                            <option value="business">🏪 Business</option>
                        </select>
                    </div>

                    {/* System Role */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <label style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 'bold' }}>SYSTEM ROLE</label>
                        <select value={filterRole} onChange={e => setFilterRole(e.target.value)} className="admin-select" style={{ width: 160 }}>
                            <option value="all">All Roles</option>
                            <option value="user">User</option>
                            <option value="staff">Staff</option>
                            <option value="support">Support</option>
                            <option value="admin">Admin</option>
                            <option value="tester">🧪 Tester</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Table */}
            {filteredUsers.length === 0 ? (
                <div className="admin-card">
                    <div className="admin-empty">
                        <div className="admin-empty-icon">👥</div>
                        <h3 className="admin-empty-title">No Users Found</h3>
                        <p className="admin-empty-text">{searchQuery ? 'Try a different search term' : 'No users in the system yet'}</p>
                    </div>
                </div>
            ) : (
                <div className="admin-card" style={{ padding: 0, overflow: 'hidden' }}>
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th>User</th>
                                <th>Type</th>
                                <th>System Role</th>
                                <th>Subscription</th>
                                <th>Status</th>
                                <th>Joined</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredUsers.map(user => {
                                const bizUser = isBusiness(user);
                                const tiers = bizUser ? BIZ_TIERS : USER_TIERS;
                                const currentTier = tiers.find(t => t.value === (user.subscriptionTier || 'free')) || tiers[0];

                                return (
                                    <tr key={user.id}>
                                        {/* User */}
                                        <td>
                                            <div className="admin-flex admin-gap-2" style={{ alignItems: 'center' }}>
                                                <div style={{
                                                    width: 40, height: 40, borderRadius: '50%',
                                                    background: bizUser ? '#7c3aed' : '#6366f1',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    color: '#fff', fontWeight: 700, fontSize: '1rem', flexShrink: 0
                                                }}>
                                                    {user.photo_url
                                                        ? <img src={user.photo_url} alt="" style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }} />
                                                        : getInitial(user)}
                                                </div>
                                                <div>
                                                    <div className="admin-flex admin-gap-1" style={{ alignItems: 'center', fontWeight: 600, color: '#fff' }}>
                                                        {getUserName(user)}
                                                        {user.role === 'admin' && <FaCrown style={{ color: '#fbbf24', fontSize: '0.875rem' }} />}
                                                    </div>
                                                    <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{user.email}</div>
                                                </div>
                                            </div>
                                        </td>

                                        {/* Type Badge */}
                                        <td><TypeBadge user={user} /></td>

                                        {/* System Role — only for non-business */}
                                        <td>
                                            {!bizUser ? (
                                                <select value={user.role || 'user'}
                                                    onChange={e => handleUpdateSystemRole(user.id, e.target.value)}
                                                    className="admin-select"
                                                    style={{
                                                        width: 110,
                                                        borderColor: user.role === 'admin' ? '#fbbf24' : user.role === 'staff' ? '#a855f7' : user.role === 'support' ? '#3b82f6' : 'rgba(255,255,255,0.1)',
                                                        color: user.role === 'admin' ? '#fbbf24' : user.role === 'staff' ? '#a855f7' : user.role === 'support' ? '#3b82f6' : '#fff',
                                                        fontWeight: user.role !== 'user' ? 'bold' : 'normal'
                                                    }}>
                                                    {SYSTEM_ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                                                </select>
                                            ) : (
                                                <span style={{ fontSize: '0.8rem', color: '#64748b' }}>N/A (Business)</span>
                                            )}
                                        </td>

                                        {/* Subscription — different options for business vs user */}
                                        <td>
                                            <select
                                                value={user.subscriptionTier || 'free'}
                                                onChange={e => handleUpdateSubscription(user.id, e.target.value, bizUser)}
                                                style={{
                                                    background: '#1e293b', border: '1px solid #334155',
                                                    borderRadius: 6, color: currentTier.color,
                                                    padding: '6px 10px', fontSize: '0.875rem',
                                                    fontWeight: 600, cursor: 'pointer', width: 150
                                                }}>
                                                {tiers.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                                            </select>
                                        </td>

                                        {/* Status */}
                                        <td>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                                <span className={user.banned ? 'admin-badge admin-badge-danger' : 'admin-badge admin-badge-success'}>
                                                    {user.banned ? <><FaTimesCircle style={{ fontSize: '0.75rem' }} /> Banned</> : <><FaCheckCircle style={{ fontSize: '0.75rem' }} /> Active</>}
                                                </span>
                                                {user.isTester && (
                                                    <span style={{ fontSize: '0.7rem', background: 'rgba(99,102,241,0.2)', color: '#818cf8', border: '1px solid #6366f1', borderRadius: 8, padding: '2px 8px', fontWeight: 700 }}>🧪 Tester</span>
                                                )}
                                            </div>
                                        </td>

                                        {/* Joined */}
                                        <td>
                                            <div style={{ fontSize: '0.875rem', color: '#94a3b8' }}>
                                                {(() => {
                                                    if (!user.createdAt) return 'N/A';
                                                    try {
                                                        const d = user.createdAt?.toDate ? user.createdAt.toDate() : new Date(user.createdAt);
                                                        return isNaN(d.getTime()) ? 'N/A' : d.toLocaleDateString();
                                                    } catch { return 'N/A'; }
                                                })()}
                                            </div>
                                        </td>

                                        {/* Actions */}
                                        <td>
                                            <div className="admin-flex admin-gap-1">
                                                <button onClick={() => { setSelectedUser(user); setShowUserModal(true); }}
                                                    className="admin-btn admin-btn-sm" style={{ background: '#3b82f6', color: '#fff', padding: '0.5rem' }} title="View Details">
                                                    <FaEye />
                                                </button>
                                                <button onClick={() => handleToggleTester(user.id, user.isTester)}
                                                    className="admin-btn admin-btn-sm"
                                                    style={{ background: user.isTester ? '#4f46e5' : 'rgba(99,102,241,0.15)', color: user.isTester ? '#fff' : '#818cf8', border: '1px solid #6366f1', padding: '0.5rem', fontSize: '0.8rem' }}
                                                    title={user.isTester ? 'Remove Tester' : 'Make Tester'}>
                                                    🧪
                                                </button>
                                                <button onClick={() => handleBanUser(user.id, user.banned)}
                                                    className={`admin-btn admin-btn-sm ${user.banned ? 'admin-btn-success' : 'admin-btn-danger'}`}
                                                    style={{ padding: '0.5rem' }} title={user.banned ? 'Unban' : 'Ban'}>
                                                    <FaBan />
                                                </button>
                                                {(() => {
                                                    const isSuperOwner = ['admin@dinebuddies.com', 'y.abohamed@gmail.com', 'yaser@dinebuddies.com', 'info@dinebuddies.com.au'].includes(currentUser?.email?.toLowerCase()) || currentUser?.uid === 'xTgHC1v00LZIZ6ESA9YGjGU5zW33';
                                                    if (user.role !== 'admin' || isSuperOwner) return (
                                                        <button onClick={() => handleDeleteUser(user.id)}
                                                            className="admin-btn admin-btn-sm admin-btn-danger"
                                                            style={{ padding: '0.5rem' }} title="Delete User">
                                                            <FaTrash />
                                                        </button>
                                                    );
                                                    return null;
                                                })()}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* User Details Modal */}
            {showUserModal && selectedUser && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '1rem' }}>
                    <div className="admin-card" style={{ maxWidth: 620, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
                        <div className="admin-flex-between admin-mb-4">
                            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#fff' }}>User Details</h2>
                            <button onClick={() => setShowUserModal(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '2rem', cursor: 'pointer', padding: 0 }}>×</button>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            {[
                                { label: 'Name', value: getUserName(selectedUser) },
                                { label: 'Email', value: selectedUser.email },
                                { label: 'User ID', value: selectedUser.id, mono: true },
                                { label: 'Account Type', value: isBusiness(selectedUser) ? '🏪 Business' : '👤 Individual' },
                                { label: 'System Role', value: selectedUser.role || 'user' },
                                { label: 'Subscription', value: selectedUser.subscriptionTier || 'free' },
                                { label: 'Status', value: selectedUser.banned ? 'Banned' : 'Active', color: selectedUser.banned ? '#ef4444' : '#22c55e' },
                                { label: 'Tester', value: selectedUser.isTester ? '✅ Yes' : '❌ No' },
                            ].map(f => (
                                <div key={f.label}>
                                    <label className="admin-label">{f.label}</label>
                                    <div style={{ color: f.color || '#fff', fontFamily: f.mono ? 'monospace' : undefined, fontSize: f.mono ? '0.8rem' : undefined, wordBreak: 'break-all' }}>{f.value}</div>
                                </div>
                            ))}
                            {selectedUser.createdAt && (
                                <div style={{ gridColumn: '1 / -1' }}>
                                    <label className="admin-label">Joined</label>
                                    <div style={{ color: '#fff' }}>
                                        {(() => { try { const d = selectedUser.createdAt?.toDate ? selectedUser.createdAt.toDate() : new Date(selectedUser.createdAt); return isNaN(d.getTime()) ? 'N/A' : d.toLocaleString(); } catch { return 'N/A'; } })()}
                                    </div>
                                </div>
                            )}
                            {selectedUser.businessInfo?.businessName && (
                                <div style={{ gridColumn: '1 / -1' }}>
                                    <label className="admin-label">Business Name</label>
                                    <div style={{ color: '#fff' }}>{selectedUser.businessInfo.businessName}</div>
                                </div>
                            )}
                        </div>

                        <div className="admin-flex admin-gap-2 admin-mt-4" style={{ flexWrap: 'wrap' }}>
                            <button onClick={() => handleToggleTester(selectedUser.id, selectedUser.isTester)}
                                className="admin-btn" style={{ flex: 1, background: selectedUser.isTester ? '#4f46e5' : 'rgba(99,102,241,0.15)', color: selectedUser.isTester ? '#fff' : '#818cf8', border: '1px solid #6366f1' }}>
                                🧪 {selectedUser.isTester ? 'Remove Tester' : 'Grant Tester Access'}
                            </button>
                            {!isBusiness(selectedUser) && (
                                <button onClick={() => { handleUpdateSystemRole(selectedUser.id, selectedUser.role === 'admin' ? 'user' : 'admin'); setShowUserModal(false); }}
                                    className="admin-btn" style={{ flex: 1, background: '#a855f7', color: '#fff' }}>
                                    {selectedUser.role === 'admin' ? 'Remove Admin' : 'Make Admin'}
                                </button>
                            )}
                            <button onClick={() => { handleBanUser(selectedUser.id, selectedUser.banned); setShowUserModal(false); }}
                                className={`admin-btn ${selectedUser.banned ? 'admin-btn-success' : 'admin-btn-danger'}`} style={{ flex: 1 }}>
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
