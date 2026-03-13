import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { deleteInvitationAndStorage } from '../../utils/storageCleanup';
import { FaEnvelope, FaLock, FaSearch, FaTrash, FaEye, FaFilter } from 'react-icons/fa';

const InvitationManagement = () => {
    const [tab, setTab] = useState('public');
    const [publicList, setPublicList] = useState([]);
    const [privateList, setPrivateList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState('all');
    const [selected, setSelected] = useState(null);

    useEffect(() => {
        load();
    }, []);

    const load = async () => {
        try {
            setLoading(true);
            const [pubSnap, privSnap] = await Promise.all([
                getDocs(query(collection(db, 'invitations'), orderBy('createdAt', 'desc'))),
                getDocs(query(collection(db, 'private_invitations'), orderBy('createdAt', 'desc'))),
            ]);
            setPublicList(pubSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
            setPrivateList(privSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const publicFiltered = publicList.filter((inv) => {
        const matchSearch = !search || [inv.title, inv.restaurantName, inv.creatorName, inv.id].some((v) => String(v || '').toLowerCase().includes(search.toLowerCase()));
        const matchFilter = filter === 'all' || (filter === 'active' && !inv.expired) || (filter === 'expired' && inv.expired) || (filter === 'reported' && inv.reported);
        return matchSearch && matchFilter;
    });

    const privateFiltered = privateList.filter((inv) => {
        const matchSearch = !search || [inv.title, inv.hostId, inv.id].some((v) => String(v || '').toLowerCase().includes(search.toLowerCase()));
        return matchSearch;
    });

    const handleDeletePublic = async (id) => {
        if (!window.confirm('Delete this public invitation? Storage will be removed.')) return;
        try {
            await deleteInvitationAndStorage(id, 'invitations');
            setPublicList((prev) => prev.filter((i) => i.id !== id));
            if (selected?.id === id) setSelected(null);
        } catch (e) {
            alert('Failed: ' + e.message);
        }
    };

    const toDate = (v) => (v?.toMillis ? new Date(v.toMillis()) : v ? new Date(v) : null);
    const dateStr = (v) => (v ? toDate(v).toLocaleString() : '—');

    if (loading) {
        return (
            <div className="admin-loading">
                <div className="admin-spinner" />
                <p style={{ color: 'var(--admin-text-secondary)', marginTop: '1rem' }}>Loading…</p>
            </div>
        );
    }

    return (
        <div>
            <div className="admin-page-header">
                <h1 className="admin-page-title">Invitation Management</h1>
                <p className="admin-page-subtitle">Public and private invitations — manage and moderate.</p>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                <button
                    type="button"
                    className={`admin-btn ${tab === 'public' ? 'admin-btn-primary' : 'admin-btn-secondary'}`}
                    onClick={() => setTab('public')}
                >
                    <FaEnvelope /> Public Invitations ({publicList.length})
                </button>
                <button
                    type="button"
                    className={`admin-btn ${tab === 'private' ? 'admin-btn-primary' : 'admin-btn-secondary'}`}
                    onClick={() => setTab('private')}
                >
                    <FaLock /> Private Invitations ({privateList.length})
                </button>
            </div>

            {tab === 'public' && (
                <>
                    <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                        <div className="admin-search" style={{ flex: '1', minWidth: '200px' }}>
                            <FaSearch className="admin-search-icon" />
                            <input
                                type="text"
                                className="admin-search-input"
                                placeholder="Search by title, restaurant, creator…"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                        <select className="admin-select" value={filter} onChange={(e) => setFilter(e.target.value)} style={{ width: 'auto', minWidth: '120px' }}>
                            <option value="all">All</option>
                            <option value="active">Active</option>
                            <option value="expired">Expired</option>
                            <option value="reported">Reported</option>
                        </select>
                    </div>
                    <div className="admin-card" style={{ padding: 0, overflow: 'hidden' }}>
                        {publicFiltered.length === 0 ? (
                            <div className="admin-empty">
                                <p className="admin-empty-text">No public invitations match.</p>
                            </div>
                        ) : (
                            <div style={{ overflowX: 'auto' }}>
                                <table className="admin-table">
                                    <thead>
                                        <tr>
                                            <th>Title / Restaurant</th>
                                            <th>Creator</th>
                                            <th>Created</th>
                                            <th>Status</th>
                                            <th></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {publicFiltered.map((inv) => (
                                            <tr key={inv.id}>
                                                <td>
                                                    <div>{inv.title || inv.id}</div>
                                                    <div style={{ fontSize: '0.8rem', color: 'var(--admin-text-muted)' }}>{inv.restaurantName || '—'}</div>
                                                </td>
                                                <td>{inv.creatorName || inv.author?.name || inv.hostId || '—'}</td>
                                                <td>{dateStr(inv.createdAt)}</td>
                                                <td>
                                                    {inv.reported && <span className="admin-badge admin-badge-danger">Reported</span>}
                                                    {inv.expired && <span className="admin-badge admin-badge-warning">Expired</span>}
                                                    {!inv.reported && !inv.expired && <span className="admin-badge admin-badge-success">Active</span>}
                                                </td>
                                                <td>
                                                    <button type="button" className="admin-btn admin-btn-secondary admin-btn-sm" onClick={() => setSelected(inv)} title="View">View</button>
                                                    <button type="button" className="admin-btn admin-btn-danger admin-btn-sm" style={{ marginLeft: '0.5rem' }} onClick={() => handleDeletePublic(inv.id)} title="Remove">Remove</button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </>
            )}

            {tab === 'private' && (
                <>
                    <div style={{ marginBottom: '1rem' }}>
                        <div className="admin-search" style={{ maxWidth: '320px' }}>
                            <FaSearch className="admin-search-icon" />
                            <input type="text" className="admin-search-input" placeholder="Search by title, host…" value={search} onChange={(e) => setSearch(e.target.value)} />
                        </div>
                    </div>
                    <div className="admin-card" style={{ padding: 0, overflow: 'hidden' }}>
                        {privateFiltered.length === 0 ? (
                            <div className="admin-empty">
                                <p className="admin-empty-text">No private invitations match.</p>
                            </div>
                        ) : (
                            <div style={{ overflowX: 'auto' }}>
                                <table className="admin-table">
                                    <thead>
                                        <tr>
                                            <th>Title</th>
                                            <th>Host</th>
                                            <th>Invitees / Status</th>
                                            <th>Created</th>
                                            <th></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {privateFiltered.map((inv) => (
                                            <tr key={inv.id}>
                                                <td>{inv.title || inv.id}</td>
                                                <td>{inv.hostId || inv.authorId || '—'}</td>
                                                <td>{Array.isArray(inv.invitedFriends) ? inv.invitedFriends.length : 0} invitees</td>
                                                <td>{dateStr(inv.createdAt)}</td>
                                                <td>
                                                    <button type="button" className="admin-btn admin-btn-secondary admin-btn-sm" onClick={() => setSelected(inv)}>View</button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </>
            )}

            {selected && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }} onClick={() => setSelected(null)}>
                    <div className="admin-card" style={{ maxWidth: '480px', width: '100%', maxHeight: '90vh', overflow: 'auto' }} onClick={(e) => e.stopPropagation()}>
                        <h3 style={{ marginBottom: '1rem' }}>Details</h3>
                        <pre style={{ fontSize: '0.8rem', overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{JSON.stringify(selected, null, 2)}</pre>
                        <button type="button" className="admin-btn admin-btn-secondary admin-mt-2" onClick={() => setSelected(null)}>Close</button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default InvitationManagement;
