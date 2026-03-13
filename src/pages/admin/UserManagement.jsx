import React, { useState, useEffect, useRef, useMemo } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../context/AuthContext';
import { FaSearch, FaUser, FaStore, FaBan, FaTrash, FaEye, FaCrown, FaCheckCircle, FaTimesCircle, FaMapMarkedAlt, FaList } from 'react-icons/fa';
import { adminSecurityService } from '../../services/adminSecurityService';
import { getSafeAvatar } from '../../utils/avatarUtils';
import '../../components/MapStyles.css';

// ── Helpers ──────────────────────────────────────────────────────────────────
const isBusiness = (u) => u.role === 'business';

const getCity = (u) =>
    u.businessInfo?.city ||
    u.location?.city ||
    u.city ||
    '';

const getCountry = (u) =>
    u.businessInfo?.country ||
    u.location?.country ||
    u.country ||
    '';

const getCoords = (u) => {
    const lat = u.businessInfo?.lat ?? u.businessInfo?.location?.latitude ?? u.location?.latitude ?? null;
    const lng = u.businessInfo?.lng ?? u.businessInfo?.location?.longitude ?? u.location?.longitude ?? null;
    return lat != null && lng != null ? { lat: Number(lat), lng: Number(lng) } : null;
};

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

// Canonical roles only (no accountType)
const SYSTEM_ROLES = ['user', 'business', 'staff', 'support', 'admin'];

const UserManagement = () => {
    const { currentUser } = useAuth();
    const [users, setUsers] = useState([]);
    const [filteredUsers, setFilteredUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterRole, setFilterRole] = useState('all');
    const [filterCity, setFilterCity] = useState('all');
    const [filterCountry, setFilterCountry] = useState('all');
    const [viewMode, setViewMode] = useState('list'); // list | map
    const mapRef = useRef(null);
    const mapInstance = useRef(null);
    const [selectedUser, setSelectedUser] = useState(null);
    const [showUserModal, setShowUserModal] = useState(false);
    const [isCleaningOrphans, setIsCleaningOrphans] = useState(false);
    const [isDeletingAll, setIsDeletingAll] = useState(false);

    const uniqueCities = useMemo(() => {
        const set = new Set();
        users.forEach(u => {
            const c = getCity(u);
            if (c?.trim()) set.add(c.trim());
        });
        return Array.from(set).sort();
    }, [users]);

    const uniqueCountries = useMemo(() => {
        const set = new Set();
        users.forEach(u => {
            const c = getCountry(u);
            if (c?.trim()) set.add(c.trim());
        });
        return Array.from(set).sort();
    }, [users]);

    const usersWithCoords = useMemo(() =>
        filteredUsers
            .map(u => {
                const coords = getCoords(u);
                if (!coords) return null;
                return { ...u, lat: coords.lat, lng: coords.lng };
            })
            .filter(Boolean),
        [filteredUsers]
    );

    useEffect(() => { fetchUsers(); }, []);
    useEffect(() => { filterUsers(); }, [users, searchQuery, filterRole, filterCity, filterCountry]);

    useEffect(() => {
        if (viewMode !== 'map' || !mapRef.current || typeof window.L === 'undefined') return;
        const L = window.L;
        if (mapInstance.current) {
            mapInstance.current.remove();
            mapInstance.current = null;
        }
        const map = L.map(mapRef.current).setView([51.505, -0.09], 2);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(map);
        mapInstance.current = map;
        return () => {
            if (mapInstance.current) { mapInstance.current.remove(); mapInstance.current = null; }
        };
    }, [viewMode]);

    useEffect(() => {
        if (viewMode !== 'map' || !mapInstance.current || typeof window.L === 'undefined') return;
        const L = window.L;
        const map = mapInstance.current;
        const markers = [];
        map.eachLayer(l => { if (l instanceof L.Marker) markers.push(l); });
        markers.forEach(m => map.removeLayer(m));
        const bounds = [];
        usersWithCoords.forEach(u => {
            const m = L.marker([u.lat, u.lng], {
                icon: L.divIcon({
                    className: 'admin-user-marker',
                    html: `<div style="width:32px;height:32px;border-radius:50%;border:2px solid #6366f1;overflow:hidden;background:#fff;box-shadow:0 2px 8px rgba(0,0,0,0.3);"><img src="${getSafeAvatar(u)}" alt="" style="width:100%;height:100%;object-fit:cover;display:block;" /></div>`,
                    iconSize: [32, 32],
                    iconAnchor: [16, 32]
                })
            });
            m.bindPopup(`<strong>${getUserName(u)}</strong><br/>${u.email}<br/>${u.businessInfo?.businessName || ''}`);
            m.addTo(map);
            bounds.push([u.lat, u.lng]);
        });
        if (bounds.length === 1) map.setView(bounds[0], 10);
        else if (bounds.length > 1) map.fitBounds(bounds, { padding: [30, 30] });
    }, [viewMode, usersWithCoords]);

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
        if (filterRole !== 'all') {
            f = f.filter(u => (u.role || 'user') === filterRole);
        }

        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            f = f.filter(u =>
                u.display_name?.toLowerCase().includes(q) ||
                u.displayName?.toLowerCase().includes(q) ||
                u.email?.toLowerCase().includes(q) ||
                u.id.toLowerCase().includes(q) ||
                u.businessInfo?.businessName?.toLowerCase().includes(q)
            );
        }

        if (filterCity !== 'all') {
            f = f.filter(u => (getCity(u) || '').toLowerCase() === filterCity.toLowerCase());
        }
        if (filterCountry !== 'all') {
            f = f.filter(u => (getCountry(u) || '').toLowerCase() === filterCountry.toLowerCase());
        }

        setFilteredUsers(f);
    };

    // ── Actions ───────────────────────────────────────────────────────────────
    const handleBanUser = async (userId, currentStatus) => {
        if (!window.confirm(`${currentStatus ? 'Unban' : 'Ban'} this user?`)) return;
        try {
            await adminSecurityService.setUserBanStatus(userId, !currentStatus);
            setUsers(users.map(u => u.id === userId ? { ...u, banned: !currentStatus } : u));
        } catch (err) { alert('Failed: ' + err.message); }
    };

    const handleDeleteUser = async (userId) => {
        if (!window.confirm('Delete this user? This cannot be undone!')) return;
        try {
            const res = await adminSecurityService.deleteUser(userId);
            setUsers(users.filter(u => u.id !== userId));
            alert(`Deleted user + ${res?.deletedItems || 0} associated items.`);
        } catch (err) { alert('Failed: ' + err.message); }
    };

    const handleCleanOrphans = async () => {
        if (!window.confirm('Scan and delete orphaned posts/stories?')) return;
        setIsCleaningOrphans(true);
        try {
            const res = await adminSecurityService.cleanOrphanContent();
            alert(`Cleaned ${res?.deletedPosts || 0} posts + ${res?.deletedStories || 0} stories.`);
        } catch (err) { alert('Error: ' + err.message); }
        finally { setIsCleaningOrphans(false); }
    };

    const handleDeleteAllPosts = async () => {
        if (!window.confirm('⚠️ Delete ALL posts and stories? Irreversible!')) return;
        if (window.prompt('Type "DELETE ALL" to confirm') !== 'DELETE ALL') return;
        setIsDeletingAll(true);
        try {
            const res = await adminSecurityService.wipeCommunityContent();
            alert(`Wiped: ${res?.deletedPosts || 0} posts + ${res?.deletedStories || 0} stories.`);
        } catch (err) { alert('Error: ' + err.message); }
        finally { setIsDeletingAll(false); }
    };

    const handleUpdateSystemRole = async (userId, newRole) => {
        const currentRole = users.find(u => u.id === userId)?.role || 'user';
        // Cannot convert between regular user and business (account type is fixed)
        if ((currentRole === 'user' && newRole === 'business') || (currentRole === 'business' && newRole === 'user')) {
            alert('Account type cannot be changed: user and business accounts are separate. Cannot convert between them.');
            return;
        }
        if (!window.confirm(`Change role to "${newRole}"?`)) return;
        try {
            await adminSecurityService.setUserRole(userId, newRole);
            setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u));
        } catch (err) { alert('Failed: ' + err.message); }
    };

    const handleUpdateSubscription = async (userId, newTier, isBusinessUser) => {
        try {
            await adminSecurityService.setUserSubscriptionTier(userId, newTier, isBusinessUser);
            const updates = { subscriptionTier: newTier };
            setUsers(users.map(u => u.id === userId ? { ...u, ...updates } : u));
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

                    {/* Role (canonical: user | business | admin | staff | support) */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <label style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 'bold' }}>ROLE</label>
                        <select value={filterRole} onChange={e => setFilterRole(e.target.value)} className="admin-select" style={{ width: 160 }}>
                            <option value="all">All Roles</option>
                            <option value="user">User</option>
                            <option value="business">Business</option>
                            <option value="staff">Staff</option>
                            <option value="support">Support</option>
                            <option value="admin">Admin</option>
                        </select>
                    </div>

                    {/* Country */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <label style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 'bold' }}>COUNTRY</label>
                        <select value={filterCountry} onChange={e => setFilterCountry(e.target.value)} className="admin-select" style={{ width: 160 }}>
                            <option value="all">All Countries</option>
                            {uniqueCountries.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>

                    {/* City */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <label style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 'bold' }}>CITY</label>
                        <select value={filterCity} onChange={e => setFilterCity(e.target.value)} className="admin-select" style={{ width: 160 }}>
                            <option value="all">All Cities</option>
                            {uniqueCities.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>

                    {/* View Mode */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginLeft: 'auto' }}>
                        <label style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 'bold' }}>VIEW</label>
                        <div style={{ display: 'flex', gap: 4, border: '1px solid #334155', borderRadius: 8, padding: 2, background: '#0f172a' }}>
                            <button onClick={() => setViewMode('list')}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 6, border: 'none', cursor: 'pointer',
                                    background: viewMode === 'list' ? '#6366f1' : 'transparent', color: viewMode === 'list' ? '#fff' : '#94a3b8', fontWeight: 600, fontSize: '0.875rem'
                                }}>
                                <FaList /> List
                            </button>
                            <button onClick={() => setViewMode('map')}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 6, border: 'none', cursor: 'pointer',
                                    background: viewMode === 'map' ? '#6366f1' : 'transparent', color: viewMode === 'map' ? '#fff' : '#94a3b8', fontWeight: 600, fontSize: '0.875rem'
                                }}>
                                <FaMapMarkedAlt /> Map
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Map View */}
            {viewMode === 'map' && (
                <div className="admin-card" style={{ padding: 0, overflow: 'hidden', minHeight: 400, position: 'relative' }}>
                    <div ref={mapRef} style={{ width: '100%', height: 450, borderRadius: 8 }} />
                    {usersWithCoords.length === 0 && (
                        <div style={{
                            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: 'rgba(15,23,42,0.8)', borderRadius: 8, color: '#94a3b8', fontSize: '1rem'
                        }}>
                            No users with location data in current filters
                        </div>
                    )}
                </div>
            )}

            {/* Table (List View) */}
            {filteredUsers.length === 0 ? (
                <div className="admin-card">
                    <div className="admin-empty">
                        <div className="admin-empty-icon">👥</div>
                        <h3 className="admin-empty-title">No Users Found</h3>
                        <p className="admin-empty-text">{searchQuery ? 'Try a different search term' : 'No users in the system yet'}</p>
                    </div>
                </div>
            ) : viewMode === 'list' ? (
                <div className="admin-card" style={{ padding: 0, overflow: 'hidden' }}>
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th>User</th>
                                <th>Role</th>
                                <th>Change role</th>
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

                                        {/* Role badge */}
                                        <td><TypeBadge user={user} /></td>

                                        {/* Role (editable for non-business; business account type is fixed) */}
                                        <td>
                                            {!bizUser ? (
                                                <select value={user.role || 'user'}
                                                    onChange={e => handleUpdateSystemRole(user.id, e.target.value)}
                                                    title={isBusiness(user) ? 'Business account type cannot be changed to user' : (user.role || 'user') === 'user' ? 'User account type cannot be changed to business' : ''}
                                                    className="admin-select"
                                                    style={{
                                                        width: 110,
                                                        borderColor: user.role === 'admin' ? '#fbbf24' : user.role === 'staff' ? '#a855f7' : user.role === 'support' ? '#3b82f6' : 'rgba(255,255,255,0.1)',
                                                        color: user.role === 'admin' ? '#fbbf24' : user.role === 'staff' ? '#a855f7' : user.role === 'support' ? '#3b82f6' : '#fff',
                                                        fontWeight: user.role !== 'user' ? 'bold' : 'normal'
                                                    }}>
                                                    {SYSTEM_ROLES.filter(r => {
                                                        const isBiz = isBusiness(user);
                                                        if (r === 'user' && isBiz) return false; // business cannot become user
                                                        if (r === 'business' && !isBiz && (user.role || 'user') === 'user') return false; // user cannot become business
                                                        return true;
                                                    }).map(r => <option key={r} value={r}>{r === 'business' ? 'Business' : r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                                                </select>
                                            ) : (
                                                <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Business</span>
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
            ) : null}

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
                                { label: 'Role', value: isBusiness(selectedUser) ? 'Business' : (selectedUser.role || 'user') },
                                { label: 'Subscription', value: selectedUser.subscriptionTier || 'free' },
                                { label: 'Status', value: selectedUser.banned ? 'Banned' : 'Active', color: selectedUser.banned ? '#ef4444' : '#22c55e' },
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
