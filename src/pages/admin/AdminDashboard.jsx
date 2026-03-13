import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, query, where, orderBy, limit as firestoreLimit } from 'firebase/firestore';
import { db } from '../../firebase/config';
import {
    FaUsers,
    FaUtensils,
    FaEnvelope,
    FaComment,
    FaStore,
    FaExclamationTriangle,
    FaCreditCard,
    FaChartLine,
    FaRss,
    FaUserPlus,
    FaCalendarPlus,
    FaFlag,
} from 'react-icons/fa';

const todayStart = () => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
};

const AdminDashboard = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        usersToday: 0,
        usersTotal: 0,
        invitationsToday: 0,
        invitationsTotal: 0,
        messagesToday: 0,
        messagesTotal: 0,
        restaurantsTotal: 0,
        reportsPending: 0,
        activeSubscriptions: 0,
    });
    const [activity, setActivity] = useState([]);

    useEffect(() => {
        loadDashboard();
    }, []);

    const loadDashboard = async () => {
        try {
            setLoading(true);
            const since = todayStart();
            const sinceMillis = since.getTime();

            const [usersSnap, invitationsSnap, privateInvSnap, partnersSnap, reportsSnap] = await Promise.all([
                getDocs(collection(db, 'users')),
                getDocs(collection(db, 'invitations')),
                getDocs(collection(db, 'private_invitations')),
                getDocs(query(collection(db, 'users'), where('role', '==', 'business'))),
                getDocs(query(collection(db, 'reports'), where('status', '==', 'pending'))).catch(() => ({ docs: [], size: 0 })),
            ]);

            const users = usersSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
            const invitations = invitationsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
            const privateInvs = privateInvSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

            const toMillis = (v) => {
                if (!v) return 0;
                if (v.toMillis) return v.toMillis();
                if (v.seconds) return v.seconds * 1000;
                if (typeof v === 'number') return v;
                return 0;
            };

            const usersToday = users.filter((u) => toMillis(u.created_time) >= sinceMillis).length;
            const invToday = invitations.filter((i) => toMillis(i.createdAt) >= sinceMillis).length;
            const privateToday = privateInvs.filter((i) => toMillis(i.createdAt) >= sinceMillis).length;
            const invitationsToday = invToday + privateToday;

            let messagesTotal = 0;
            let messagesToday = 0;
            try {
                const convSnap = await getDocs(query(collection(db, 'conversations'), firestoreLimit(50)));
                for (const conv of convSnap.docs) {
                    const msgsSnap = await getDocs(query(collection(db, 'conversations', conv.id, 'messages'), firestoreLimit(200)));
                    messagesTotal += msgsSnap.size;
                    msgsSnap.docs.forEach((m) => {
                        if (toMillis(m.data().createdAt) >= sinceMillis) messagesToday += 1;
                    });
                }
            } catch {
                messagesTotal = 0;
                messagesToday = 0;
            }

            const activeSubs = users.filter(
                (u) => ['pro', 'vip', 'professional', 'elite'].includes(u.subscriptionTier)
            ).length;

            setStats({
                usersToday,
                usersTotal: users.length,
                invitationsToday,
                invitationsTotal: invitations.length + privateInvs.length,
                messagesToday,
                messagesTotal: messagesTotal > 0 ? messagesTotal : '-',
                restaurantsTotal: partnersSnap.size,
                reportsPending: reportsSnap.docs ? reportsSnap.docs.length : reportsSnap.size || 0,
                activeSubscriptions: activeSubs,
            });

            const events = [];
            users
                .filter((u) => toMillis(u.created_time) > 0)
                .sort((a, b) => toMillis(b.created_time) - toMillis(a.created_time))
                .slice(0, 15)
                .forEach((u) => {
                    events.push({
                        type: 'user_joined',
                        label: 'User joined',
                        detail: u.display_name || u.displayName || u.email || u.id,
                        time: toMillis(u.created_time),
                        id: u.id,
                    });
                });
            [...invitations, ...privateInvs]
                .filter((i) => toMillis(i.createdAt) > 0)
                .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt))
                .slice(0, 10)
                .forEach((i) => {
                    events.push({
                        type: 'invitation_created',
                        label: 'Invitation created',
                        detail: i.title || i.id,
                        time: toMillis(i.createdAt),
                        id: i.id,
                    });
                });
            try {
                const repSnap = await getDocs(query(collection(db, 'reports'), orderBy('createdAt', 'desc'), firestoreLimit(5)));
                repSnap.docs.forEach((d) => {
                    const r = d.data();
                    events.push({
                        type: 'report_submitted',
                        label: 'Report submitted',
                        detail: r.reason || d.id,
                        time: toMillis(r.createdAt),
                        id: d.id,
                    });
                });
            } catch {}
            partnersSnap.docs.forEach((d) => {
                const p = d.data();
                const t = toMillis(p.created_time);
                if (t > 0)
                    events.push({
                        type: 'business_registered',
                        label: 'Business registered',
                        detail: p.businessInfo?.businessName || p.email || d.id,
                        time: t,
                        id: d.id,
                    });
            });
            events.sort((a, b) => b.time - a.time);
            setActivity(events.slice(0, 25));
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const formatTime = (ms) => {
        if (!ms) return '';
        const d = new Date(ms);
        const now = Date.now();
        const diff = now - ms;
        if (diff < 60000) return 'Just now';
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
        return d.toLocaleDateString();
    };

    const statCards = [
        { key: 'users', label: 'Users', sub: 'today / total', value: `${stats.usersToday} / ${stats.usersTotal}`, icon: FaUsers, path: '/admin/users', color: '#6366f1' },
        { key: 'invitations', label: 'Invitations created', sub: 'today', value: stats.invitationsToday, extra: `Total: ${stats.invitationsTotal}`, icon: FaUtensils, path: '/admin/invitations', color: '#10b981' },
        { key: 'messages', label: 'Messages', sub: 'today', value: stats.messagesToday, extra: stats.messagesTotal !== '-' ? `Total: ${stats.messagesTotal}` : null, icon: FaComment, path: '/admin/chat-community', color: '#8b5cf6' },
        { key: 'restaurants', label: 'Businesses', value: stats.restaurantsTotal, icon: FaStore, path: '/admin/businesses', color: '#f59e0b' },
        { key: 'reports', label: 'Reports pending', value: stats.reportsPending, icon: FaExclamationTriangle, path: '/admin/reports', color: '#ef4444' },
        { key: 'subscriptions', label: 'Active subscriptions', value: stats.activeSubscriptions, icon: FaCreditCard, path: '/admin/subscriptions', color: '#22c55e' },
    ];

    if (loading) {
        return (
            <div className="admin-loading">
                <div className="admin-spinner" />
                <p style={{ color: 'var(--admin-text-secondary)', marginTop: '1rem' }}>Loading dashboard…</p>
            </div>
        );
    }

    return (
        <div>
            <div className="admin-page-header">
                <h1 className="admin-page-title">Dashboard</h1>
                <p className="admin-page-subtitle">Overview and live activity</p>
            </div>

            <section className="admin-mb-4">
                <h2 className="admin-section-title">Statistics</h2>
                <div className="admin-kpi-strip">
                    {statCards.map((c) => (
                        <div
                            key={c.key}
                            className="admin-kpi-item"
                            onClick={() => navigate(c.path)}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => e.key === 'Enter' && navigate(c.path)}
                        >
                            <div className="admin-kpi-label">{c.label}</div>
                            <div className="admin-kpi-value">{c.value}</div>
                            {(c.sub || c.extra) && <div className="admin-kpi-sub" style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted)', marginTop: '0.25rem' }}>{c.extra || c.sub}</div>}
                        </div>
                    ))}
                </div>
            </section>

            <section className="admin-mb-4">
                <h2 className="admin-section-title">Charts</h2>
                <div className="admin-grid admin-grid-2">
                    {[
                        { title: 'Invitations per day', icon: FaChartLine },
                        { title: 'New users per day', icon: FaUsers },
                        { title: 'Messages volume', icon: FaComment },
                        { title: 'Revenue / subscriptions', icon: FaCreditCard },
                    ].map((chart) => (
                        <div key={chart.title} className="admin-card admin-chart-placeholder">
                            <chart.icon style={{ fontSize: '2rem', color: 'var(--admin-text-muted)', marginBottom: '0.5rem' }} />
                            <h3 style={{ fontSize: '1rem', fontWeight: '600', color: 'var(--admin-text-primary)', marginBottom: '0.25rem' }}>{chart.title}</h3>
                            <p style={{ fontSize: '0.875rem', color: 'var(--admin-text-muted)' }}>Chart placeholder — connect to analytics when ready.</p>
                        </div>
                    ))}
                </div>
            </section>

            <section>
                <h2 className="admin-section-title">Live activity</h2>
                <div className="admin-card" style={{ padding: 0, overflow: 'hidden' }}>
                    {activity.length === 0 ? (
                        <div className="admin-empty">
                            <FaRss style={{ fontSize: '2rem', color: 'var(--admin-text-muted)' }} />
                            <p className="admin-empty-text">No recent activity</p>
                        </div>
                    ) : (
                        <ul style={{ listStyle: 'none', margin: 0, padding: 0, maxHeight: '400px', overflowY: 'auto' }}>
                            {activity.map((ev, i) => (
                                <li
                                    key={`${ev.type}-${ev.id}-${i}`}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.75rem',
                                        padding: '0.75rem 1rem',
                                        borderBottom: i < activity.length - 1 ? '1px solid var(--admin-border)' : 'none',
                                    }}
                                >
                                    {ev.type === 'user_joined' && <FaUserPlus style={{ color: '#6366f1', flexShrink: 0 }} />}
                                    {ev.type === 'invitation_created' && <FaCalendarPlus style={{ color: '#10b981', flexShrink: 0 }} />}
                                    {ev.type === 'report_submitted' && <FaFlag style={{ color: '#ef4444', flexShrink: 0 }} />}
                                    {ev.type === 'business_registered' && <FaStore style={{ color: '#f59e0b', flexShrink: 0 }} />}
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <span style={{ fontWeight: '600', color: 'var(--admin-text-primary)' }}>{ev.label}</span>
                                        <span style={{ color: 'var(--admin-text-secondary)', marginLeft: '0.5rem' }}>{ev.detail}</span>
                                    </div>
                                    <span style={{ fontSize: '0.8rem', color: 'var(--admin-text-muted)', flexShrink: 0 }}>{formatTime(ev.time)}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </section>
        </div>
    );
};

export default AdminDashboard;
