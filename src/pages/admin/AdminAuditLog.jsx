import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy, limit as firestoreLimit } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { FaHistory } from 'react-icons/fa';

const AdminAuditLog = () => {
    const [entries, setEntries] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        load();
    }, []);

    const load = async () => {
        try {
            setLoading(true);
            try {
                const snap = await getDocs(query(collection(db, 'audit_log'), orderBy('createdAt', 'desc'), firestoreLimit(100)));
                setEntries(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
            } catch {
                setEntries([]);
            }
        } finally {
            setLoading(false);
        }
    };

    const toDate = (v) => {
        if (!v) return '—';
        if (v.toMillis) return new Date(v.toMillis()).toLocaleString();
        return new Date(v).toLocaleString();
    };

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
                <h1 className="admin-page-title">Audit Log</h1>
                <p className="admin-page-subtitle">All admin actions are recorded here. Connect backend to write to audit_log collection.</p>
            </div>

            <div className="admin-card">
                {entries.length === 0 ? (
                    <div className="admin-empty">
                        <FaHistory style={{ fontSize: '2rem', color: 'var(--admin-text-muted)' }} />
                        <p className="admin-empty-text">No audit entries yet. Implement logging in Cloud Functions (e.g. adminSetUserBanStatus, adminDeleteUser) writing to audit_log with: adminUid, action, targetId, metadata, createdAt.</p>
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table className="admin-table">
                            <thead>
                                <tr>
                                    <th>Time</th>
                                    <th>Admin</th>
                                    <th>Action</th>
                                    <th>Target</th>
                                    <th>Details</th>
                                </tr>
                            </thead>
                            <tbody>
                                {entries.map((e) => (
                                    <tr key={e.id}>
                                        <td>{toDate(e.createdAt)}</td>
                                        <td>{e.adminUid || '—'}</td>
                                        <td>{e.action || '—'}</td>
                                        <td>{e.targetId || '—'}</td>
                                        <td><pre style={{ margin: 0, fontSize: '0.75rem', whiteSpace: 'pre-wrap' }}>{JSON.stringify(e.metadata || {})}</pre></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdminAuditLog;
