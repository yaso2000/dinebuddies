import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { getDocs } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { FaSearch, FaStore, FaCheckCircle, FaTimesCircle, FaBan, FaTrash, FaEye, FaMapMarkerAlt, FaPhone, FaChevronLeft, FaChevronRight, FaList, FaMapMarkedAlt } from 'react-icons/fa';
import { Link, useNavigate } from 'react-router-dom';
import { adminSecurityService } from '../../services/adminSecurityService';
import {
    ADMIN_USERS_PAGE_SIZE,
    buildBusinessBrowseQuery,
    buildBusinessBrowseQueryPrev,
    searchBusinesses,
    fetchBusinessStats,
} from '../../utils/adminUserQueries';
import { getUserDocLatLng } from '../../utils/userDocCoords';
import '../../components/MapStyles.css';

function getBusinessMapTitle(b) {
    return b.businessInfo?.businessName || b.display_name || b.displayName || 'Business';
}

/** Address / city / or lat,lng from stored coordinates */
function formatBusinessLocationLine(b) {
    const addr = b.businessInfo?.location;
    if (addr != null && String(addr).trim() !== '') return String(addr).trim();
    const parts = [b.businessInfo?.city, b.businessInfo?.country].filter(Boolean);
    if (parts.length) return parts.join(', ');
    const c = getUserDocLatLng(b);
    if (c) return `${c.lat.toFixed(5)}, ${c.lng.toFixed(5)}`;
    return 'N/A';
}

const processPageSnap = (snap, setRows, setHasNext, setFirst, setLast) => {
    const all = snap.docs;
    const hasMore = all.length > ADMIN_USERS_PAGE_SIZE;
    const take = hasMore ? ADMIN_USERS_PAGE_SIZE : all.length;
    const pageDocs = all.slice(0, take);
    const rows = pageDocs.map((d) => ({ id: d.id, ...d.data() }));
    setRows(rows);
    setHasNext(hasMore);
    if (pageDocs.length) {
        setFirst(pageDocs[0]);
        setLast(pageDocs[pageDocs.length - 1]);
    } else {
        setFirst(null);
        setLast(null);
    }
};

const BusinessManagement = () => {
    const navigate = useNavigate();

    const [listBusinesses, setListBusinesses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [pageLoading, setPageLoading] = useState(false);

    const [searchInput, setSearchInput] = useState('');
    const [searchMode, setSearchMode] = useState(false);

    const [filterStatus, setFilterStatus] = useState('all');
    const [firstVisible, setFirstVisible] = useState(null);
    const [lastVisible, setLastVisible] = useState(null);
    const [hasNext, setHasNext] = useState(false);
    const [pageIndex, setPageIndex] = useState(0);

    const [stats, setStats] = useState({ totalBusiness: 0, bannedBusiness: 0 });

    const [selectedBusiness, setSelectedBusiness] = useState(null);
    const [showModal, setShowModal] = useState(false);

    const [viewMode, setViewMode] = useState('list');
    const mapRef = useRef(null);
    const mapInstance = useRef(null);

    const skipFilterEffectOnce = useRef(true);

    const refreshStats = useCallback(async () => {
        try {
            const s = await fetchBusinessStats(db);
            setStats(s);
        } catch (e) {
            console.warn('Business stats failed', e);
        }
    }, []);

    /** Server-side: all businesses, or banned-only when filterStatus === 'banned' */
    const serverBannedOnly = filterStatus === 'banned';

    const loadBrowseFirst = useCallback(async () => {
        setPageLoading(true);
        setSearchMode(false);
        setPageIndex(0);
        try {
            const q = buildBusinessBrowseQuery(db, { cursorLast: null, filterBanned: serverBannedOnly });
            const snap = await getDocs(q);
            processPageSnap(snap, setListBusinesses, setHasNext, setFirstVisible, setLastVisible);
        } catch (error) {
            console.error(error);
            alert('Error loading businesses: ' + (error.message || error));
        } finally {
            setPageLoading(false);
        }
    }, [serverBannedOnly]);

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
        if (filterStatus === 'active' || filterStatus === 'unpublished') {
            return;
        }
        loadBrowseFirst();
    }, [filterStatus, searchMode, loadBrowseFirst]);

    const loadNext = async () => {
        if (!lastVisible || !hasNext || searchMode) return;
        setPageLoading(true);
        try {
            const q = buildBusinessBrowseQuery(db, { cursorLast: lastVisible, filterBanned: serverBannedOnly });
            const snap = await getDocs(q);
            processPageSnap(snap, setListBusinesses, setHasNext, setFirstVisible, setLastVisible);
            setPageIndex((p) => p + 1);
        } catch (error) {
            console.error(error);
            alert('Failed to load next page');
        } finally {
            setPageLoading(false);
        }
    };

    const loadPrev = async () => {
        if (!firstVisible || pageIndex === 0 || searchMode) return;
        setPageLoading(true);
        try {
            const q = buildBusinessBrowseQueryPrev(db, { firstVisible, filterBanned: serverBannedOnly });
            const snap = await getDocs(q);
            processPageSnap(snap, setListBusinesses, setHasNext, setFirstVisible, setLastVisible);
            setPageIndex((p) => Math.max(0, p - 1));
        } catch (error) {
            console.error(error);
            alert('Failed to load previous page');
        } finally {
            setPageLoading(false);
        }
    };

    const handleSearchSubmit = async (e) => {
        e.preventDefault();
        const term = searchInput.trim();
        if (!term) return;
        setPageLoading(true);
        setSearchMode(true);
        try {
            const rows = await searchBusinesses(db, term);
            setListBusinesses(rows);
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

    const displayedBusinesses = useMemo(() => {
        if (filterStatus === 'active') {
            return listBusinesses.filter((b) => !b.banned && b.businessInfo?.published);
        }
        if (filterStatus === 'unpublished') {
            return listBusinesses.filter((b) => !b.businessInfo?.published);
        }
        return listBusinesses;
    }, [listBusinesses, filterStatus]);

    const businessesWithCoords = useMemo(
        () =>
            displayedBusinesses
                .map((b) => {
                    const coords = getUserDocLatLng(b);
                    if (!coords) return null;
                    return { ...b, lat: coords.lat, lng: coords.lng };
                })
                .filter(Boolean),
        [displayedBusinesses]
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
        businessesWithCoords.forEach((b) => {
            const title = getBusinessMapTitle(b);
            const initial = (title || '?').charAt(0).toUpperCase();
            const m = L.marker([b.lat, b.lng], {
                icon: L.divIcon({
                    className: 'admin-user-marker',
                    html: `<div style="width:32px;height:32px;border-radius:50%;border:2px solid #8b5cf6;background:#1e1b4b;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:0.85rem;box-shadow:0 2px 8px rgba(0,0,0,0.3);">${initial}</div>`,
                    iconSize: [32, 32],
                    iconAnchor: [16, 32],
                }),
            });
            m.bindPopup(
                `<strong>${title}</strong><br/>${b.email || ''}<br/>${b.businessInfo?.category || ''}`
            );
            m.addTo(map);
            bounds.push([b.lat, b.lng]);
        });
        if (bounds.length === 1) map.setView(bounds[0], 11);
        else if (bounds.length > 1) map.fitBounds(bounds, { padding: [30, 30] });
    }, [viewMode, businessesWithCoords]);

    const patchBusiness = (id, patch) => {
        setListBusinesses((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));
    };

    const removeBusiness = (id) => {
        setListBusinesses((prev) => prev.filter((b) => b.id !== id));
    };

    const handleBanBusiness = async (businessId, currentStatus) => {
        const action = currentStatus ? 'unban' : 'ban';
        if (!window.confirm(`Are you sure you want to ${action} this business?`)) return;
        try {
            await adminSecurityService.setUserBanStatus(businessId, !currentStatus);
            patchBusiness(businessId, { banned: !currentStatus });
            refreshStats();
            alert(`Business ${action}ned successfully!`);
        } catch (error) {
            console.error('Error banning business:', error);
            alert('Failed to update business status');
        }
    };

    const handleDeleteBusiness = async (businessId) => {
        if (!window.confirm('Are you sure you want to DELETE this business? This action cannot be undone!')) return;
        try {
            await adminSecurityService.deletePartner(businessId);
            removeBusiness(businessId);
            refreshStats();
            alert('Business deleted successfully!');
        } catch (error) {
            console.error('Error deleting business:', error);
            alert('Failed to delete business');
        }
    };

    const activeApprox = Math.max(0, stats.totalBusiness - stats.bannedBusiness);

    if (loading) {
        return (
            <div className="admin-loading">
                <div style={{ textAlign: 'center' }}>
                    <div className="admin-spinner" />
                    <p style={{ color: '#94a3b8', fontSize: '1rem', marginTop: '1rem' }}>Loading businesses...</p>
                </div>
            </div>
        );
    }

    return (
        <div>
            <div className="admin-page-header admin-mb-4">
                <h1 className="admin-page-title">Business Management</h1>
                <p className="admin-page-subtitle">
                    Paginated <code style={{ fontSize: '0.85em' }}>role: business</code> accounts. Search: exact email or Firebase UID.
                    List / Map: map pins use the same stored coordinates as the app (<code>coordinates</code>, GeoPoint, or <code>businessInfo</code>).
                    Limits: <Link to="/admin/business-limits" style={{ color: 'var(--admin-accent)' }}>Business limits</Link>.
                    All users: <Link to="/admin/users" style={{ color: 'var(--admin-accent)' }}>Users</Link>.
                </p>
            </div>

            <div className="admin-grid admin-grid-4 admin-mb-4">
                <div className="admin-card">
                    <div style={{ fontSize: '2rem', fontWeight: '800', color: '#ffffff' }}>{stats.totalBusiness}</div>
                    <div style={{ fontSize: '0.875rem', color: '#94a3b8' }}>Total businesses</div>
                </div>
                <div className="admin-card">
                    <div style={{ fontSize: '2rem', fontWeight: '800', color: '#22c55e' }}>{activeApprox}</div>
                    <div style={{ fontSize: '0.875rem', color: '#94a3b8' }}>Active (not banned)</div>
                </div>
                <div className="admin-card">
                    <div style={{ fontSize: '2rem', fontWeight: '800', color: '#ef4444' }}>{stats.bannedBusiness}</div>
                    <div style={{ fontSize: '0.875rem', color: '#94a3b8' }}>Banned</div>
                </div>
                <div className="admin-card">
                    <div style={{ fontSize: '2rem', fontWeight: '800', color: '#f59e0b' }}>{displayedBusinesses.length}</div>
                    <div style={{ fontSize: '0.875rem', color: '#94a3b8' }}>{searchMode ? 'Matches' : 'On this page (after filter)'}</div>
                </div>
            </div>

            <form onSubmit={handleSearchSubmit} className="admin-card admin-mb-4" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'flex-end' }}>
                <div className="admin-search" style={{ flex: 1, minWidth: 260 }}>
                    <FaSearch className="admin-search-icon" />
                    <input
                        className="admin-search-input"
                        placeholder="Business email (exact) or owner UID..."
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
                    <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        className="admin-select"
                        style={{ width: 220 }}
                        disabled={searchMode}
                    >
                        <option value="all">All partners (paged)</option>
                        <option value="banned">Banned only (paged)</option>
                        <option value="active">Active on this page</option>
                        <option value="unpublished">Unpublished on this page</option>
                    </select>
                </div>
                {!searchMode && (filterStatus === 'active' || filterStatus === 'unpublished') && (
                    <p style={{ margin: '0.75rem 0 0', fontSize: '0.8rem', color: '#94a3b8' }}>
                        &quot;Active&quot; / &quot;Unpublished&quot; narrow the current page only. Use All / Banned + pages for full coverage.
                    </p>
                )}
                {!searchMode && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: '0.75rem', flexWrap: 'wrap' }}>
                        <button type="button" className="admin-btn admin-btn-secondary" disabled={pageLoading || pageIndex === 0} onClick={loadPrev}>
                            <FaChevronLeft /> Prev
                        </button>
                        <span style={{ color: '#94a3b8', fontSize: '0.9rem' }}>
                            Page {pageIndex + 1}
                            {hasNext ? ' · more ahead' : ''}
                        </span>
                        <button type="button" className="admin-btn admin-btn-secondary" disabled={pageLoading || !hasNext} onClick={loadNext}>
                            Next <FaChevronRight />
                        </button>
                        {pageLoading && <span style={{ color: '#94a3b8' }}>Loading…</span>}
                    </div>
                )}
                <div style={{ marginTop: '0.75rem', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
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
                        Pins use stored coordinates (<code>coordinates</code>, GeoPoint <code>location</code>, or <code>businessInfo</code>). Same scope as the table: current page, search results, or filters.
                    </p>
                )}
            </div>

            {displayedBusinesses.length === 0 ? (
                <div className="admin-card">
                    <div className="admin-empty">
                        <div className="admin-empty-icon">🏪</div>
                        <h3 className="admin-empty-title">No businesses found</h3>
                        <p className="admin-empty-text">{searchMode ? 'Try exact email or UID' : 'Try another page or filter'}</p>
                    </div>
                </div>
            ) : (
                <>
                    {viewMode === 'map' && (
                        <div className="admin-card" style={{ padding: 0, overflow: 'hidden', minHeight: 400, position: 'relative', marginBottom: '1rem' }}>
                            <div ref={mapRef} style={{ width: '100%', height: 450, borderRadius: 8 }} />
                            {businessesWithCoords.length === 0 && (
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
                                        padding: '1rem',
                                        textAlign: 'center',
                                    }}
                                >
                                    No stored coordinates for businesses in this list
                                </div>
                            )}
                        </div>
                    )}
                    {viewMode === 'list' && (
                <div className="admin-card" style={{ padding: 0, overflow: 'hidden' }}>
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th>Business</th>
                                <th>Owner</th>
                                <th>Contact</th>
                                <th>Location</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {displayedBusinesses.map((business) => (
                                <tr key={business.id}>
                                    <td>
                                        <div className="admin-flex admin-gap-2" style={{ alignItems: 'center' }}>
                                            <div
                                                style={{
                                                    width: '40px',
                                                    height: '40px',
                                                    borderRadius: '50%',
                                                    background: '#8b5cf6',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    color: '#ffffff',
                                                    fontWeight: '700',
                                                }}
                                            >
                                                <FaStore />
                                            </div>
                                            <div>
                                                <div style={{ fontWeight: '600', color: '#ffffff' }}>
                                                    {business.businessInfo?.businessName || 'No Business Name'}
                                                </div>
                                                <div style={{ fontSize: '0.875rem', color: '#94a3b8' }}>
                                                    {business.businessInfo?.category || 'Uncategorized'}
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td>
                                        <div>
                                            <div style={{ fontWeight: '600', color: '#ffffff' }}>
                                                {business.display_name || business.displayName || 'No Name'}
                                            </div>
                                            <div style={{ fontSize: '0.875rem', color: '#94a3b8' }}>{business.email}</div>
                                        </div>
                                    </td>
                                    <td>
                                        <div className="admin-flex admin-gap-1" style={{ alignItems: 'center' }}>
                                            <FaPhone style={{ color: '#60a5fa', fontSize: '0.875rem' }} />
                                            <span style={{ fontSize: '0.875rem', color: '#94a3b8' }}>{business.businessInfo?.phone || 'N/A'}</span>
                                        </div>
                                    </td>
                                    <td>
                                        <div className="admin-flex admin-gap-1" style={{ alignItems: 'center' }}>
                                            <FaMapMarkerAlt style={{ color: '#f59e0b', fontSize: '0.875rem' }} />
                                            <span style={{ fontSize: '0.875rem', color: '#94a3b8' }}>{formatBusinessLocationLine(business)}</span>
                                        </div>
                                    </td>
                                    <td>
                                        <div className="admin-flex admin-gap-1" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                                            <span className={business.banned ? 'admin-badge admin-badge-danger' : 'admin-badge admin-badge-success'}>
                                                {business.banned ? (
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
                                            {business.businessInfo?.published ? (
                                                <span className="admin-badge admin-badge-primary">Published</span>
                                            ) : (
                                                <span className="admin-badge admin-badge-warning">Unpublished</span>
                                            )}
                                        </div>
                                    </td>
                                    <td>
                                        <div className="admin-flex admin-gap-1">
                                            <button
                                                onClick={() => {
                                                    setSelectedBusiness(business);
                                                    setShowModal(true);
                                                }}
                                                className="admin-btn admin-btn-sm"
                                                style={{ background: '#3b82f6', color: '#ffffff', padding: '0.5rem' }}
                                            >
                                                <FaEye />
                                            </button>
                                            <button
                                                onClick={() => handleBanBusiness(business.id, business.banned)}
                                                className={`admin-btn admin-btn-sm ${business.banned ? 'admin-btn-success' : 'admin-btn-danger'}`}
                                                style={{ padding: '0.5rem' }}
                                            >
                                                <FaBan />
                                            </button>
                                            <button onClick={() => handleDeleteBusiness(business.id)} className="admin-btn admin-btn-sm admin-btn-danger" style={{ padding: '0.5rem' }}>
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
                </>
            )}

            {showModal && selectedBusiness && (
                <div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        background: 'rgba(0, 0, 0, 0.7)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 50,
                        padding: '1rem',
                    }}
                >
                    <div className="admin-card" style={{ maxWidth: '600px', width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
                        <div className="admin-flex-between admin-mb-4">
                            <h2 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#ffffff' }}>Business Details</h2>
                            <button
                                onClick={() => setShowModal(false)}
                                style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '2rem', cursor: 'pointer' }}
                            >
                                ×
                            </button>
                        </div>

                        <div style={{ display: 'grid', gap: '1rem' }}>
                            <div>
                                <label className="admin-label">Business Name</label>
                                <div style={{ color: '#ffffff', fontWeight: '600' }}>{selectedBusiness.businessInfo?.businessName || 'N/A'}</div>
                            </div>
                            <div>
                                <label className="admin-label">Category</label>
                                <div style={{ color: '#ffffff' }}>{selectedBusiness.businessInfo?.category || 'N/A'}</div>
                            </div>
                            <div>
                                <label className="admin-label">Description</label>
                                <div style={{ color: '#ffffff' }}>{selectedBusiness.businessInfo?.description || 'N/A'}</div>
                            </div>
                            <div>
                                <label className="admin-label">Owner Name</label>
                                <div style={{ color: '#ffffff' }}>{selectedBusiness.display_name || selectedBusiness.displayName || 'N/A'}</div>
                            </div>
                            <div>
                                <label className="admin-label">Email</label>
                                <div style={{ color: '#ffffff' }}>{selectedBusiness.email}</div>
                            </div>
                            <div>
                                <label className="admin-label">Phone</label>
                                <div style={{ color: '#ffffff' }}>{selectedBusiness.businessInfo?.phone || 'N/A'}</div>
                            </div>
                            <div>
                                <label className="admin-label">Location</label>
                                <div style={{ color: '#ffffff' }}>{formatBusinessLocationLine(selectedBusiness)}</div>
                            </div>
                            {(() => {
                                const ll = getUserDocLatLng(selectedBusiness);
                                if (!ll) return null;
                                return (
                                    <div>
                                        <label className="admin-label">Coordinates (stored)</label>
                                        <div style={{ color: '#ffffff', fontFamily: 'monospace', fontSize: '0.9rem' }}>
                                            {ll.lat.toFixed(6)}, {ll.lng.toFixed(6)}
                                        </div>
                                    </div>
                                );
                            })()}
                            <div>
                                <label className="admin-label">Joined</label>
                                <div style={{ color: '#ffffff' }}>{selectedBusiness.createdAt?.toDate?.()?.toLocaleString() || 'N/A'}</div>
                            </div>
                        </div>

                        <div className="admin-flex admin-gap-2 admin-mt-4">
                            <button
                                onClick={() => {
                                    handleBanBusiness(selectedBusiness.id, selectedBusiness.banned);
                                    setShowModal(false);
                                }}
                                className={`admin-btn ${selectedBusiness.banned ? 'admin-btn-success' : 'admin-btn-danger'}`}
                                style={{ flex: 1 }}
                            >
                                {selectedBusiness.banned ? 'Unban Business' : 'Ban Business'}
                            </button>
                            <button type="button" className="admin-btn admin-btn-secondary" style={{ flex: 1 }} onClick={() => navigate(`/business/${selectedBusiness.id}`)}>
                                Open public profile
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BusinessManagement;
