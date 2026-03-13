/**
 * Admin Dashboard — new professional home.
 * Role-based only (admin / user / business). No geo restrictions for admin.
 * Privacy-aware: minimal PII in tables; full details only when needed.
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../../firebase/config';
import {
    FaUsers,
    FaStore,
    FaEnvelope,
    FaShieldAlt,
    FaUser,
    FaUtensils,
    FaLock,
} from 'react-icons/fa';
import '../../styles/admin.css';

const toMillis = (v) => {
    if (!v) return 0;
    if (v.toMillis) return v.toMillis();
    if (v.seconds) return v.seconds * 1000;
    return typeof v === 'number' ? v : 0;
};

const maskEmail = (email) => {
    if (!email || typeof email !== 'string') return '—';
    const [local, domain] = email.split('@');
    if (!domain) return email;
    const show = local.length <= 2 ? local : local.slice(0, 2) + '***';
    return `${show}@${domain}`;
};

const AdminHome = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [users, setUsers] = useState([]);
    const [invitations, setInvitations] = useState([]);
    const [privateInvitations, setPrivateInvitations] = useState([]);
    const [activeTab, setActiveTab] = useState('overview');

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const [usersSnap, invSnap, privSnap] = await Promise.all([
                getDocs(collection(db, 'users')),
                getDocs(query(collection(db, 'invitations'), orderBy('createdAt', 'desc'), limit(100))),
                getDocs(query(collection(db, 'private_invitations'), orderBy('createdAt', 'desc'), limit(100))),
            ]);
            setUsers(usersSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
            setInvitations(invSnap.docs.map((d) => ({ id: d.id, ...d.data(), type: 'public' })));
            setPrivateInvitations(privSnap.docs.map((d) => ({ id: d.id, ...d.data(), type: 'private' })));
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const byRole = { admin: 0, user: 0, business: 0, other: 0 };
    users.forEach((u) => {
        const r = (u.role || '').toLowerCase();
        if (r === 'admin') byRole.admin++;
        else if (r === 'user') byRole.user++;
        else if (r === 'business') byRole.business++;
        else if (r) byRole.other++;
    });

    const allInvitations = [
        ...invitations.map((i) => ({ ...i, sortTime: toMillis(i.createdAt) })),
        ...privateInvitations.map((i) => ({ ...i, sortTime: toMillis(i.createdAt) })),
    ].sort((a, b) => (b.sortTime || 0) - (a.sortTime || 0));

    const formatDate = (ms) => (ms ? new Date(ms).toLocaleString() : '—');

    if (loading) {
        return (
            <div className="admin-loading">
                <div className="admin-spinner" />
                <p style={{ color: 'var(--admin-text-secondary)', marginTop: '1rem' }}>Loading…</p>
            </div>
        );
    }

    const tabs = [
        { id: 'overview', label: 'Overview', icon: FaShieldAlt },
        { id: 'users', label: 'Users', icon: FaUser },
        { id: 'businesses', label: 'Businesses', icon: FaStore },
        { id: 'invitations', label: 'Invitations', icon: FaEnvelope },
    ];

    return (
        <div className="admin-home">
            <div className="admin-page-header">
                <h1 className="admin-page-title">Admin Dashboard</h1>
                <p className="admin-page-subtitle">
                    Role-based overview. No geographic restrictions for admin access.
                </p>
            </div>

            <div className="admin-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                <div className="admin-card" style={{ padding: '1.25rem', borderLeft: '4px solid var(--admin-accent)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                        <FaShieldAlt style={{ color: 'var(--admin-accent)', fontSize: '1.25rem' }} />
                        <span style={{ fontSize: '0.8rem', color: 'var(--admin-text-muted)', fontWeight: '600' }}>Admins</span>
                    </div>
                    <div style={{ fontSize: '1.75rem', fontWeight: '800', color: 'var(--admin-text-primary)' }}>{byRole.admin}</div>
                </div>
                <div className="admin-card" style={{ padding: '1.25rem', borderLeft: '4px solid #22c55e' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                        <FaUsers style={{ color: '#22c55e', fontSize: '1.25rem' }} />
                        <span style={{ fontSize: '0.8rem', color: 'var(--admin-text-muted)', fontWeight: '600' }}>Users</span>
                    </div>
                    <div style={{ fontSize: '1.75rem', fontWeight: '800', color: 'var(--admin-text-primary)' }}>{byRole.user}</div>
                </div>
                <div className="admin-card" style={{ padding: '1.25rem', borderLeft: '4px solid #f59e0b' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                        <FaStore style={{ color: '#f59e0b', fontSize: '1.25rem' }} />
                        <span style={{ fontSize: '0.8rem', color: 'var(--admin-text-muted)', fontWeight: '600' }}>Businesses</span>
                    </div>
                    <div style={{ fontSize: '1.75rem', fontWeight: '800', color: 'var(--admin-text-primary)' }}>{byRole.business}</div>
                </div>
                <div className="admin-card" style={{ padding: '1.25rem', borderLeft: '4px solid #8b5cf6' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                        <FaEnvelope style={{ color: '#8b5cf6', fontSize: '1.25rem' }} />
                        <span style={{ fontSize: '0.8rem', color: 'var(--admin-text-muted)', fontWeight: '600' }}>Invitations</span>
                    </div>
                    <div style={{ fontSize: '1.75rem', fontWeight: '800', color: 'var(--admin-text-primary)' }}>{allInvitations.length}</div>
                </div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                {tabs.map((t) => (
                    <button
                        key={t.id}
                        type="button"
                        className={`admin-btn ${activeTab === t.id ? 'admin-btn-primary' : 'admin-btn-secondary'}`}
                        onClick={() => setActiveTab(t.id)}
                    >
                        <t.icon style={{ marginRight: '0.5rem' }} />
                        {t.label}
                    </button>
                ))}
            </div>

            {activeTab === 'overview' && (
                <div className="admin-card" style={{ padding: 0, overflow: 'hidden' }}>
                    <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--admin-border)' }}>
                        <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '700' }}>Latest invitations</h2>
                        <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: 'var(--admin-text-muted)' }}>Public and private — no geographic filter.</p>
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                        {allInvitations.length === 0 ? (
                            <div className="admin-empty">
                                <p className="admin-empty-text">No invitations yet.</p>
                            </div>
                        ) : (
                            <table className="admin-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr>
                                        <th style={{ textAlign: 'left', padding: '0.75rem 1rem', borderBottom: '1px solid var(--admin-border)', fontSize: '0.75rem', color: 'var(--admin-text-muted)', fontWeight: '600' }}>Type</th>
                                        <th style={{ textAlign: 'left', padding: '0.75rem 1rem', borderBottom: '1px solid var(--admin-border)', fontSize: '0.75rem', color: 'var(--admin-text-muted)', fontWeight: '600' }}>Title</th>
                                        <th style={{ textAlign: 'left', padding: '0.75rem 1rem', borderBottom: '1px solid var(--admin-border)', fontSize: '0.75rem', color: 'var(--admin-text-muted)', fontWeight: '600' }}>Created</th>
                                        <th style={{ textAlign: 'left', padding: '0.75rem 1rem', borderBottom: '1px solid var(--admin-border)', fontSize: '0.75rem', color: 'var(--admin-text-muted)', fontWeight: '600' }}></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {allInvitations.slice(0, 15).map((inv) => (
                                        <tr key={inv.id} style={{ borderBottom: '1px solid var(--admin-border)' }}>
                                            <td style={{ padding: '0.75rem 1rem' }}>
                                                {inv.type === 'private' ? <FaLock style={{ color: 'var(--admin-text-muted)', fontSize: '0.9rem' }} title="Private" /> : <FaUtensils style={{ color: 'var(--admin-text-muted)', fontSize: '0.9rem' }} title="Public" />}
                                            </td>
                                            <td style={{ padding: '0.75rem 1rem', fontWeight: '500' }}>{inv.title || inv.id}</td>
                                            <td style={{ padding: '0.75rem 1rem', fontSize: '0.85rem', color: 'var(--admin-text-secondary)' }}>{formatDate(inv.sortTime)}</td>
                                            <td style={{ padding: '0.75rem 1rem' }}>
                                                <button type="button" className="admin-btn admin-btn-secondary" style={{ fontSize: '0.8rem', padding: '0.35rem 0.6rem' }} onClick={() => navigate(inv.type === 'private' ? `/private-invitation/${inv.id}` : `/invitation/${inv.id}`)}>View</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            )}

            {activeTab === 'users' && (
                <div className="admin-card" style={{ padding: 0, overflow: 'hidden' }}>
                    <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--admin-border)' }}>
                        <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '700' }}>Users (role: user)</h2>
                        <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: 'var(--admin-text-muted)' }}>Email masked for privacy.</p>
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                        {users.filter((u) => (u.role || '').toLowerCase() === 'user').length === 0 ? (
                            <div className="admin-empty">
                                <p className="admin-empty-text">No users with role &quot;user&quot;.</p>
                            </div>
                        ) : (
                            <table className="admin-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr>
                                        <th style={{ textAlign: 'left', padding: '0.75rem 1rem', borderBottom: '1px solid var(--admin-border)', fontSize: '0.75rem', color: 'var(--admin-text-muted)', fontWeight: '600' }}>Display name</th>
                                        <th style={{ textAlign: 'left', padding: '0.75rem 1rem', borderBottom: '1px solid var(--admin-border)', fontSize: '0.75rem', color: 'var(--admin-text-muted)', fontWeight: '600' }}>Email</th>
                                        <th style={{ textAlign: 'left', padding: '0.75rem 1rem', borderBottom: '1px solid var(--admin-border)', fontSize: '0.75rem', color: 'var(--admin-text-muted)', fontWeight: '600' }}></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {users.filter((u) => (u.role || '').toLowerCase() === 'user').map((u) => (
                                        <tr key={u.id} style={{ borderBottom: '1px solid var(--admin-border)' }}>
                                            <td style={{ padding: '0.75rem 1rem', fontWeight: '500' }}>{u.display_name || u.displayName || '—'}</td>
                                            <td style={{ padding: '0.75rem 1rem', fontSize: '0.9rem', color: 'var(--admin-text-secondary)' }}>{maskEmail(u.email)}</td>
                                            <td style={{ padding: '0.75rem 1rem' }}>
                                                <button type="button" className="admin-btn admin-btn-secondary" style={{ fontSize: '0.8rem', padding: '0.35rem 0.6rem' }} onClick={() => navigate(`/profile/${u.id}`)}>Profile</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            )}

            {activeTab === 'businesses' && (
                <div className="admin-card" style={{ padding: 0, overflow: 'hidden' }}>
                    <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--admin-border)' }}>
                        <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '700' }}>Businesses (role: business)</h2>
                        <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: 'var(--admin-text-muted)' }}>Email masked for privacy.</p>
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                        {users.filter((u) => (u.role || '').toLowerCase() === 'business').length === 0 ? (
                            <div className="admin-empty">
                                <p className="admin-empty-text">No businesses yet.</p>
                            </div>
                        ) : (
                            <table className="admin-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr>
                                        <th style={{ textAlign: 'left', padding: '0.75rem 1rem', borderBottom: '1px solid var(--admin-border)', fontSize: '0.75rem', color: 'var(--admin-text-muted)', fontWeight: '600' }}>Business / Name</th>
                                        <th style={{ textAlign: 'left', padding: '0.75rem 1rem', borderBottom: '1px solid var(--admin-border)', fontSize: '0.75rem', color: 'var(--admin-text-muted)', fontWeight: '600' }}>Email</th>
                                        <th style={{ textAlign: 'left', padding: '0.75rem 1rem', borderBottom: '1px solid var(--admin-border)', fontSize: '0.75rem', color: 'var(--admin-text-muted)', fontWeight: '600' }}>Plan</th>
                                        <th style={{ textAlign: 'left', padding: '0.75rem 1rem', borderBottom: '1px solid var(--admin-border)', fontSize: '0.75rem', color: 'var(--admin-text-muted)', fontWeight: '600' }}></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {users.filter((u) => (u.role || '').toLowerCase() === 'business').map((u) => (
                                        <tr key={u.id} style={{ borderBottom: '1px solid var(--admin-border)' }}>
                                            <td style={{ padding: '0.75rem 1rem', fontWeight: '500' }}>{u.businessInfo?.businessName || u.display_name || u.displayName || '—'}</td>
                                            <td style={{ padding: '0.75rem 1rem', fontSize: '0.9rem', color: 'var(--admin-text-secondary)' }}>{maskEmail(u.email)}</td>
                                            <td style={{ padding: '0.75rem 1rem', fontSize: '0.85rem', textTransform: 'capitalize' }}>{u.subscriptionTier || 'free'}</td>
                                            <td style={{ padding: '0.75rem 1rem' }}>
                                                <button type="button" className="admin-btn admin-btn-secondary" style={{ fontSize: '0.8rem', padding: '0.35rem 0.6rem' }} onClick={() => navigate(`/business/${u.id}`)}>Profile</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            )}

            {activeTab === 'invitations' && (
                <div className="admin-card" style={{ padding: 0, overflow: 'hidden' }}>
                    <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--admin-border)' }}>
                        <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '700' }}>All invitations</h2>
                        <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: 'var(--admin-text-muted)' }}>Public and private. Use &quot;Invitation Management&quot; in the sidebar for full actions.</p>
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                        {allInvitations.length === 0 ? (
                            <div className="admin-empty">
                                <p className="admin-empty-text">No invitations.</p>
                            </div>
                        ) : (
                            <table className="admin-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr>
                                        <th style={{ textAlign: 'left', padding: '0.75rem 1rem', borderBottom: '1px solid var(--admin-border)', fontSize: '0.75rem', color: 'var(--admin-text-muted)', fontWeight: '600' }}>Type</th>
                                        <th style={{ textAlign: 'left', padding: '0.75rem 1rem', borderBottom: '1px solid var(--admin-border)', fontSize: '0.75rem', color: 'var(--admin-text-muted)', fontWeight: '600' }}>Title</th>
                                        <th style={{ textAlign: 'left', padding: '0.75rem 1rem', borderBottom: '1px solid var(--admin-border)', fontSize: '0.75rem', color: 'var(--admin-text-muted)', fontWeight: '600' }}>Created</th>
                                        <th style={{ textAlign: 'left', padding: '0.75rem 1rem', borderBottom: '1px solid var(--admin-border)', fontSize: '0.75rem', color: 'var(--admin-text-muted)', fontWeight: '600' }}></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {allInvitations.map((inv) => (
                                        <tr key={inv.id} style={{ borderBottom: '1px solid var(--admin-border)' }}>
                                            <td style={{ padding: '0.75rem 1rem' }}>{inv.type === 'private' ? <FaLock style={{ color: 'var(--admin-text-muted)' }} /> : <FaUtensils style={{ color: 'var(--admin-text-muted)' }} />}</td>
                                            <td style={{ padding: '0.75rem 1rem', fontWeight: '500' }}>{inv.title || inv.id}</td>
                                            <td style={{ padding: '0.75rem 1rem', fontSize: '0.85rem', color: 'var(--admin-text-secondary)' }}>{formatDate(inv.sortTime)}</td>
                                            <td style={{ padding: '0.75rem 1rem' }}>
                                                <button type="button" className="admin-btn admin-btn-secondary" style={{ fontSize: '0.8rem', padding: '0.35rem 0.6rem' }} onClick={() => navigate(inv.type === 'private' ? `/private-invitation/${inv.id}` : `/invitation/${inv.id}`)}>View</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminHome;
