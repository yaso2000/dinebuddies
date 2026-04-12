import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getDocs } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../context/AuthContext';
import { FaSearch, FaBan, FaTrash, FaEye, FaCrown, FaCheckCircle, FaTimesCircle, FaMapMarkedAlt, FaList, FaChevronLeft, FaChevronRight } from 'react-icons/fa';
import { adminSecurityService } from '../../services/adminSecurityService';
import { getSafeAvatar } from '../../utils/avatarUtils';
import {
    ADMIN_USERS_PAGE_SIZE,
    buildUsersBrowseQuery,
    buildUsersBrowseQueryPrev,
    searchUsers,
    fetchUserStats,
} from '../../utils/adminUserQueries';
import { getUserDocLatLng } from '../../utils/userDocCoords';
import '../../components/MapStyles.css';

const isBusiness = (u) => u.role === 'business';

const USER_TIERS = [
    { value: 'free', label: '🆓 Free', color: '#64748b' },
    { value: 'pro', label: '⚡ Pro', color: '#22c55e' },
    { value: 'vip', label: '👑 VIP', color: '#f59e0b' },
];

const BIZ_TIERS = [
    { value: 'free', label: '🆓 Free', color: '#64748b' },
    { value: 'professional', label: '⚡ Professional', color: '#8b5cf6' },
    { value: 'elite', label: '👑 Elite', color: '#f59e0b' },
];

const SYSTEM_ROLES = ['user', 'business', 'staff', 'support', 'admin'];

const UserManagement = () => {
    const { currentUser } = useAuth();

    const [listUsers, setListUsers] = useState([]);
    const [searchMode, setSearchMode] = useState(false);
    const [searchInput, setSearchInput] = useState('');
    const [filterRole, setFilterRole] = useState('all');

    const [loading, setLoading] = useState(true);
    const [pageLoading, setPageLoading] = useState(false);

    const [firstVisible, setFirstVisible] = useState(null);
    const [lastVisible, setLastVisible] = useState(null);
    const [hasNext, setHasNext] = useState(false);
    const [pageIndex, setPageIndex] = useState(0);

    const [stats, setStats] = useState({
        total: 0,
        businesses: 0,
        team: 0,
        usersRoleUser: 0,
    });

    const [viewMode, setViewMode] = useState('list');
    const mapRef = useRef(null);
    const mapInstance = useRef(null);
    const [selectedUser, setSelectedUser] = useState(null);
    const [showUserModal, setShowUserModal] = useState(false);

    const refreshStats = useCallback(async () => {
        try {
            const s = await fetchUserStats(db);
            setStats(s);
        } catch (e) {
            console.warn('User stats count failed', e);
        }
    }, []);

    const processBrowseSnap = useCallback((snap) => {
        const all = snap.docs;
        const hasMore = all.length > ADMIN_USERS_PAGE_SIZE;
        const take = hasMore ? ADMIN_USERS_PAGE_SIZE : all.length;
        const pageDocs = all.slice(0, take);
        const rows = pageDocs.map((d) => ({ id: d.id, ...d.data() }));
        setListUsers(rows);
        setHasNext(hasMore);
        if (pageDocs.length) {
            setFirstVisible(pageDocs[0]);
            setLastVisible(pageDocs[pageDocs.length - 1]);
        } else {
            setFirstVisible(null);
            setLastVisible(null);
        }
    }, []);

    const loadBrowseFirst = useCallback(async () => {
        setPageLoading(true);
        setSearchMode(false);
        setPageIndex(0);
        try {
            const q = buildUsersBrowseQuery(db, { roleFilter: filterRole, cursorLast: null });
            const snap = await getDocs(q);
            processBrowseSnap(snap);
        } catch (err) {
            console.error(err);
            alert('Failed to load users: ' + (err.message || err));
        } finally {
            setPageLoading(false);
        }
    }, [filterRole, processBrowseSnap]);

    const skipFilterEffectOnce = useRef(true);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            try {
                await refreshStats();
                if (cancelled) return;
                await loadBrowseFirst();
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    useEffect(() => {
        if (skipFilterEffectOnce.current) {
            skipFilterEffectOnce.current = false;
            return;
        }
        if (searchMode) return;
        loadBrowseFirst();
    }, [filterRole, searchMode, loadBrowseFirst]);

    const loadNext = async () => {
        if (!lastVisible || !hasNext || searchMode) return;
        setPageLoading(true);
        try {
            const q = buildUsersBrowseQuery(db, { roleFilter: filterRole, cursorLast: lastVisible });
            const snap = await getDocs(q);
            processBrowseSnap(snap);
            setPageIndex((p) => p + 1);
        } catch (err) {
            console.error(err);
            alert('Failed: ' + (err.message || err));
        } finally {
            setPageLoading(false);
        }
    };

    const loadPrev = async () => {
        if (!firstVisible || pageIndex === 0 || searchMode) return;
        setPageLoading(true);
        try {
            const q = buildUsersBrowseQueryPrev(db, { roleFilter: filterRole, firstVisible });
            const snap = await getDocs(q);
            processBrowseSnap(snap);
            setPageIndex((p) => Math.max(0, p - 1));
        } catch (err) {
            console.error(err);
            alert('Failed: ' + (err.message || err));
        } finally {
            setPageLoading(false);
        }
    };

    const handleSearchSubmit = async (e) => {
        e.preventDefault();
        const q = searchInput.trim();
        if (!q) return;
        setPageLoading(true);
        setSearchMode(true);
        try {
            const rows = await searchUsers(db, q);
            setListUsers(rows);
            setPageIndex(0);
            setHasNext(false);
            setFirstVisible(null);
            setLastVisible(null);
        } catch (err) {
            console.error(err);
            alert('Search failed: ' + (err.message || err));
        } finally {
            setPageLoading(false);
        }
    };

    const clearSearch = () => {
        setSearchInput('');
        setSearchMode(false);
        loadBrowseFirst();
    };

    const usersWithCoords = useMemo(
        () =>
            listUsers
                .map((u) => {
                    const coords = getUserDocLatLng(u);
                    if (!coords) return null;
                    return { ...u, lat: coords.lat, lng: coords.lng };
                })
                .filter(Boolean),
        [listUsers]
    );

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
            if (mapInstance.current) {
                mapInstance.current.remove();
                mapInstance.current = null;
            }
        };
    }, [viewMode]);

    useEffect(() => {
        if (viewMode !== 'map' || !mapInstance.current || typeof window.L === 'undefined') return;
        const L = window.L;
        const map = mapInstance.current;
        const markers = [];
        map.eachLayer((l) => {
            if (l instanceof L.Marker) markers.push(l);
        });
        markers.forEach((m) => map.removeLayer(m));
        const bounds = [];
        usersWithCoords.forEach((u) => {
            const m = L.marker([u.lat, u.lng], {
                icon: L.divIcon({
                    className: 'admin-user-marker',
                    html: `<div style="width:32px;height:32px;border-radius:50%;border:2px solid #6366f1;overflow:hidden;background:#fff;box-shadow:0 2px 8px rgba(0,0,0,0.3);"><img src="${getSafeAvatar(u)}" alt="" style="width:100%;height:100%;object-fit:cover;display:block;" /></div>`,
                    iconSize: [32, 32],
                    iconAnchor: [16, 32],
                }),
            });
            m.bindPopup(`<strong>${getUserName(u)}</strong><br/>${u.email}<br/>${u.businessInfo?.businessName || ''}`);
            m.addTo(map);
            bounds.push([u.lat, u.lng]);
        });
        if (bounds.length === 1) map.setView(bounds[0], 10);
        else if (bounds.length > 1) map.fitBounds(bounds, { padding: [30, 30] });
    }, [viewMode, usersWithCoords]);

    const patchUserInList = (userId, patch) => {
        setListUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, ...patch } : u)));
    };

    const removeUserFromList = (userId) => {
        setListUsers((prev) => prev.filter((u) => u.id !== userId));
    };

    const handleBanUser = async (userId, currentStatus) => {
        if (!window.confirm(`${currentStatus ? 'Unban' : 'Ban'} this user?`)) return;
        try {
            await adminSecurityService.setUserBanStatus(userId, !currentStatus);
            patchUserInList(userId, { banned: !currentStatus });
            refreshStats();
        } catch (err) {
            alert('Failed: ' + err.message);
        }
    };

    const handleDeleteUser = async (userId) => {
        if (!window.confirm('Delete this user? This cannot be undone!')) return;
        try {
            const res = await adminSecurityService.deleteUser(userId);
            removeUserFromList(userId);
            refreshStats();
            alert(`Deleted user + ${res?.deletedItems || 0} associated items.`);
        } catch (err) {
            alert('Failed: ' + err.message);
        }
    };

    const handleUpdateSystemRole = async (userId, newRole) => {
        const currentRole = listUsers.find((u) => u.id === userId)?.role || 'user';
        if ((currentRole === 'user' && newRole === 'business') || (currentRole === 'business' && newRole === 'user')) {
            alert('Account type cannot be changed: user and business accounts are separate. Cannot convert between them.');
            return;
        }
        if (!window.confirm(`Change role to "${newRole}"?`)) return;
        try {
            await adminSecurityService.setUserRole(userId, newRole);
            patchUserInList(userId, { role: newRole });
            refreshStats();
        } catch (err) {
            alert('Failed: ' + err.message);
        }
    };

    const handleUpdateSubscription = async (userId, newTier, isBusinessUser) => {
        try {
            await adminSecurityService.setUserSubscriptionTier(userId, newTier, isBusinessUser);
            patchUserInList(userId, { subscriptionTier: newTier });
        } catch (err) {
            alert('Failed: ' + err.message);
        }
    };

    const getUserName = (u) => u.display_name || u.displayName || 'No Name';
    const getInitial = (u) => (getUserName(u).charAt(0) || u.email?.charAt(0) || '?').toUpperCase();

    const TypeBadge = ({ user }) => {
        if (isBusiness(user)) return <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#c084fc', background: 'rgba(192,132,252,0.15)', padding: '3px 8px', borderRadius: 6, border: '1px solid rgba(192,132,252,0.3)' }}>🏪 Business</span>;
        if (user.role === 'admin') return <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#fbbf24', background: 'rgba(251,191,36,0.15)', padding: '3px 8px', borderRadius: 6, border: '1px solid rgba(251,191,36,0.3)' }}>👑 Admin</span>;
        if (user.role === 'staff') return <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#a855f7', background: 'rgba(168,85,247,0.15)', padding: '3px 8px', borderRadius: 6, border: '1px solid rgba(168,85,247,0.3)' }}>🛠 Staff</span>;
        if (user.role === 'support') return <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#3b82f6', background: 'rgba(59,130,246,0.15)', padding: '3px 8px', borderRadius: 6, border: '1px solid rgba(59,130,246,0.3)' }}>💬 Support</span>;
        return <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#60a5fa', background: 'rgba(96,165,250,0.15)', padding: '3px 8px', borderRadius: 6, border: '1px solid rgba(96,165,250,0.3)' }}>👤 User</span>;
    };

    if (loading) {
        return (
            <div className="admin-loading">
                <div style={{ textAlign: 'center' }}>
                    <div className="admin-spinner" />
                    <p style={{ color: '#94a3b8', marginTop: '1rem' }}>Loading users...</p>
                </div>
            </div>
        );
    }

    const individualsApprox = Math.max(0, stats.total - stats.businesses - stats.team);

    return (
        <div>
            <div className="admin-flex-between admin-mb-4">
                <div className="admin-page-header" style={{ marginBottom: 0 }}>
                    <h1 className="admin-page-title">User Management</h1>
                    <p className="admin-page-subtitle">
                        Paginated browse (no full collection load). Search: exact email, user ID, or prefix on <code>display_name</code>. Business limits:{' '}
                        <Link to="/admin/business-limits" style={{ color: 'var(--admin-accent)' }}>Business limits</Link>
                        . Feed tools:{' '}
                        <Link to="/admin/system-tools" style={{ color: 'var(--admin-accent)' }}>System tools</Link>.
                    </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '2rem', fontWeight: 800, color: '#6366f1' }}>{searchMode ? listUsers.length : listUsers.length}</div>
                    <div style={{ fontSize: '0.875rem', color: '#94a3b8' }}>{searchMode ? 'Matches' : 'On page'}</div>
                </div>
            </div>

            <div className="admin-grid admin-grid-4 admin-mb-4">
                {[
                    { label: 'Total (accounts)', value: stats.total, color: '#ffffff' },
                    { label: 'Businesses', value: stats.businesses, color: '#c084fc' },
                    { label: 'Team (admin/staff/support)', value: stats.team, color: '#fbbf24' },
                    { label: 'Individuals (approx.)', value: individualsApprox, color: '#60a5fa' },
                ].map((s) => (
                    <div key={s.label} className="admin-card">
                        <div style={{ fontSize: '2rem', fontWeight: 800, color: s.color }}>{s.value}</div>
                        <div style={{ fontSize: '0.875rem', color: '#94a3b8' }}>{s.label}</div>
                    </div>
                ))}
            </div>

            <form onSubmit={handleSearchSubmit} className="admin-card admin-mb-4" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'flex-end' }}>
                <div className="admin-search" style={{ flex: 1, minWidth: 260 }}>
                    <FaSearch className="admin-search-icon" />
                    <input
                        className="admin-search-input"
                        placeholder="Email (exact), Firebase UID, or start of display name..."
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                    />
                </div>
                <button type="submit" className="admin-btn admin-btn-primary" disabled={pageLoading}>
                    Search
                </button>
                {searchMode && (
                    <button type="button" className="admin-btn admin-btn-secondary" onClick={clearSearch}>
                        Clear search
                    </button>
                )}
            </form>

            <div className="admin-card admin-mb-4">
                <div className="admin-flex admin-gap-2" style={{ flexWrap: 'wrap', alignItems: 'center' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <label style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 'bold' }}>ROLE (browse)</label>
                        <select
                            value={filterRole}
                            onChange={(e) => setFilterRole(e.target.value)}
                            className="admin-select"
                            style={{ width: 160 }}
                            disabled={searchMode}
                        >
                            <option value="all">All roles</option>
                            <option value="user">User</option>
                            <option value="business">Business</option>
                            <option value="staff">Staff</option>
                            <option value="support">Support</option>
                            <option value="admin">Admin</option>
                        </select>
                    </div>

                    {!searchMode && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto', flexWrap: 'wrap' }}>
                            <button
                                type="button"
                                className="admin-btn admin-btn-secondary"
                                disabled={pageLoading || pageIndex === 0}
                                onClick={loadPrev}
                            >
                                <FaChevronLeft /> Prev
                            </button>
                            <span style={{ color: '#94a3b8', fontSize: '0.9rem' }}>
                                Page {pageIndex + 1}
                                {hasNext ? ' · more ahead' : ''}
                            </span>
                            <button
                                type="button"
                                className="admin-btn admin-btn-secondary"
                                disabled={pageLoading || !hasNext}
                                onClick={loadNext}
                            >
                                Next <FaChevronRight />
                            </button>
                            {pageLoading && <span style={{ color: '#94a3b8' }}>Loading…</span>}
                        </div>
                    )}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginLeft: searchMode ? 0 : undefined }}>
                        <label style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 'bold' }}>VIEW</label>
                        <div style={{ display: 'flex', gap: 4, border: '1px solid #334155', borderRadius: 8, padding: 2, background: '#0f172a' }}>
                            <button
                                type="button"
                                onClick={() => setViewMode('list')}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 6,
                                    padding: '8px 14px',
                                    borderRadius: 6,
                                    border: 'none',
                                    cursor: 'pointer',
                                    background: viewMode === 'list' ? '#6366f1' : 'transparent',
                                    color: viewMode === 'list' ? '#fff' : '#94a3b8',
                                    fontWeight: 600,
                                    fontSize: '0.875rem',
                                }}
                            >
                                <FaList /> List
                            </button>
                            <button
                                type="button"
                                onClick={() => setViewMode('map')}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 6,
                                    padding: '8px 14px',
                                    borderRadius: 6,
                                    border: 'none',
                                    cursor: 'pointer',
                                    background: viewMode === 'map' ? '#6366f1' : 'transparent',
                                    color: viewMode === 'map' ? '#fff' : '#94a3b8',
                                    fontWeight: 600,
                                    fontSize: '0.875rem',
                                }}
                            >
                                <FaMapMarkedAlt /> Map
                            </button>
                        </div>
                    </div>
                </div>
                {viewMode === 'map' && (
                    <p style={{ margin: '0.75rem 0 0', fontSize: '0.8rem', color: '#94a3b8' }}>
                        Pins use each account’s stored location (<code>coordinates</code>, GeoPoint <code>location</code>, or business address). Same scope as the table: current page or search results (max {ADMIN_USERS_PAGE_SIZE} rows in browse).
                    </p>
                )}
            </div>

            {viewMode === 'map' && (
                <div className="admin-card" style={{ padding: 0, overflow: 'hidden', minHeight: 400, position: 'relative' }}>
                    <div ref={mapRef} style={{ width: '100%', height: 450, borderRadius: 8 }} />
                    {usersWithCoords.length === 0 && (
                        <div
                            style={{
                                position: 'absolute',
                                inset: 0,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                background: 'rgba(15,23,42,0.8)',
                                borderRadius: 8,
                                color: '#94a3b8',
                                fontSize: '1rem',
                            }}
                        >
                            No users with location data in current list
                        </div>
                    )}
                </div>
            )}

            {listUsers.length === 0 ? (
                <div className="admin-card">
                    <div className="admin-empty">
                        <div className="admin-empty-icon">👥</div>
                        <h3 className="admin-empty-title">No Users Found</h3>
                        <p className="admin-empty-text">{searchMode ? 'Try email, UID, or display name prefix' : 'End of list or empty'}</p>
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
                            {listUsers.map((user) => {
                                const bizUser = isBusiness(user);
                                const tiers = bizUser ? BIZ_TIERS : USER_TIERS;
                                const currentTier = tiers.find((t) => t.value === (user.subscriptionTier || 'free')) || tiers[0];

                                return (
                                    <tr key={user.id}>
                                        <td>
                                            <div className="admin-flex admin-gap-2" style={{ alignItems: 'center' }}>
                                                <div
                                                    style={{
                                                        width: 40,
                                                        height: 40,
                                                        borderRadius: '50%',
                                                        background: bizUser ? '#7c3aed' : '#6366f1',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        color: '#fff',
                                                        fontWeight: 700,
                                                        fontSize: '1rem',
                                                        flexShrink: 0,
                                                    }}
                                                >
                                                    {user.photo_url ? (
                                                        <img src={user.photo_url} alt="" style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }} />
                                                    ) : (
                                                        getInitial(user)
                                                    )}
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
                                        <td>
                                            <TypeBadge user={user} />
                                        </td>
                                        <td>
                                            {!bizUser ? (
                                                <select
                                                    value={user.role || 'user'}
                                                    onChange={(e) => handleUpdateSystemRole(user.id, e.target.value)}
                                                    className="admin-select"
                                                    style={{
                                                        width: 110,
                                                        borderColor:
                                                            user.role === 'admin'
                                                                ? '#fbbf24'
                                                                : user.role === 'staff'
                                                                  ? '#a855f7'
                                                                  : user.role === 'support'
                                                                    ? '#3b82f6'
                                                                    : 'rgba(255,255,255,0.1)',
                                                        color:
                                                            user.role === 'admin'
                                                                ? '#fbbf24'
                                                                : user.role === 'staff'
                                                                  ? '#a855f7'
                                                                  : user.role === 'support'
                                                                    ? '#3b82f6'
                                                                    : '#fff',
                                                        fontWeight: user.role !== 'user' ? 'bold' : 'normal',
                                                    }}
                                                >
                                                    {SYSTEM_ROLES.filter((r) => {
                                                        const isBiz = isBusiness(user);
                                                        if (r === 'user' && isBiz) return false;
                                                        if (r === 'business' && !isBiz && (user.role || 'user') === 'user') return false;
                                                        return true;
                                                    }).map((r) => (
                                                        <option key={r} value={r}>
                                                            {r === 'business' ? 'Business' : r.charAt(0).toUpperCase() + r.slice(1)}
                                                        </option>
                                                    ))}
                                                </select>
                                            ) : (
                                                <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Business</span>
                                            )}
                                        </td>
                                        <td>
                                            <select
                                                value={user.subscriptionTier || 'free'}
                                                onChange={(e) => handleUpdateSubscription(user.id, e.target.value, bizUser)}
                                                style={{
                                                    background: '#1e293b',
                                                    border: '1px solid #334155',
                                                    borderRadius: 6,
                                                    color: currentTier.color,
                                                    padding: '6px 10px',
                                                    fontSize: '0.875rem',
                                                    fontWeight: 600,
                                                    cursor: 'pointer',
                                                    width: 150,
                                                }}
                                            >
                                                {tiers.map((t) => (
                                                    <option key={t.value} value={t.value}>
                                                        {t.label}
                                                    </option>
                                                ))}
                                            </select>
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                                <span className={user.banned ? 'admin-badge admin-badge-danger' : 'admin-badge admin-badge-success'}>
                                                    {user.banned ? (
                                                        <>
                                                            <FaTimesCircle style={{ fontSize: '0.75rem' }} /> Banned
                                                        </>
                                                    ) : (
                                                        <>
                                                            <FaCheckCircle style={{ fontSize: '0.75rem' }} /> Active
                                                        </>
                                                    )}
                                                </span>
                                            </div>
                                        </td>
                                        <td>
                                            <div style={{ fontSize: '0.875rem', color: '#94a3b8' }}>
                                                {(() => {
                                                    if (!user.createdAt) return 'N/A';
                                                    try {
                                                        const d = user.createdAt?.toDate ? user.createdAt.toDate() : new Date(user.createdAt);
                                                        return isNaN(d.getTime()) ? 'N/A' : d.toLocaleDateString();
                                                    } catch {
                                                        return 'N/A';
                                                    }
                                                })()}
                                            </div>
                                        </td>
                                        <td>
                                            <div className="admin-flex admin-gap-1">
                                                <button
                                                    onClick={() => {
                                                        setSelectedUser(user);
                                                        setShowUserModal(true);
                                                    }}
                                                    className="admin-btn admin-btn-sm"
                                                    style={{ background: '#3b82f6', color: '#fff', padding: '0.5rem' }}
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
                                                {(() => {
                                                    const isSuperOwner = ['admin@dinebuddies.com', 'y.abohamed@gmail.com', 'yaser@dinebuddies.com', 'info@dinebuddies.com.au'].includes(
                                                        currentUser?.email?.toLowerCase()
                                                    ) || currentUser?.uid === 'xTgHC1v00LZIZ6ESA9YGjGU5zW33';
                                                    if (user.role !== 'admin' || isSuperOwner) {
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

            {showUserModal && selectedUser && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '1rem' }}>
                    <div className="admin-card" style={{ maxWidth: 620, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
                        <div className="admin-flex-between admin-mb-4">
                            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#fff' }}>User Details</h2>
                            <button
                                onClick={() => setShowUserModal(false)}
                                style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '2rem', cursor: 'pointer', padding: 0 }}
                            >
                                ×
                            </button>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            {[
                                { label: 'Name', value: getUserName(selectedUser) },
                                { label: 'Email', value: selectedUser.email },
                                { label: 'User ID', value: selectedUser.id, mono: true },
                                { label: 'Role', value: isBusiness(selectedUser) ? 'Business' : selectedUser.role || 'user' },
                                { label: 'Subscription', value: selectedUser.subscriptionTier || 'free' },
                                { label: 'Status', value: selectedUser.banned ? 'Banned' : 'Active', color: selectedUser.banned ? '#ef4444' : '#22c55e' },
                            ].map((f) => (
                                <div key={f.label}>
                                    <label className="admin-label">{f.label}</label>
                                    <div style={{ color: f.color || '#fff', fontFamily: f.mono ? 'monospace' : undefined, fontSize: f.mono ? '0.8rem' : undefined, wordBreak: 'break-all' }}>{f.value}</div>
                                </div>
                            ))}
                            {selectedUser.createdAt && (
                                <div style={{ gridColumn: '1 / -1' }}>
                                    <label className="admin-label">Joined</label>
                                    <div style={{ color: '#fff' }}>
                                        {(() => {
                                            try {
                                                const d = selectedUser.createdAt?.toDate ? selectedUser.createdAt.toDate() : new Date(selectedUser.createdAt);
                                                return isNaN(d.getTime()) ? 'N/A' : d.toLocaleString();
                                            } catch {
                                                return 'N/A';
                                            }
                                        })()}
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
                                <button
                                    onClick={() => {
                                        handleUpdateSystemRole(selectedUser.id, selectedUser.role === 'admin' ? 'user' : 'admin');
                                        setShowUserModal(false);
                                    }}
                                    className="admin-btn"
                                    style={{ flex: 1, background: '#a855f7', color: '#fff' }}
                                >
                                    {selectedUser.role === 'admin' ? 'Remove Admin' : 'Make Admin'}
                                </button>
                            )}
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
