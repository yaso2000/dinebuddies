/**
 * Admin dashboard home — aggregated stats via Cloud Function; light client reads for previews.
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { collection, getDocs, query, orderBy, limit, documentId, where } from 'firebase/firestore';
import { useTranslation } from 'react-i18next';
import { db } from '../../firebase/config';
import { adminSecurityService } from '../../services/adminSecurityService';
import {
    FaUsers,
    FaStore,
    FaEnvelope,
    FaShieldAlt,
    FaUser,
    FaUtensils,
    FaLock,
    FaUsersCog,
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
    const { t } = useTranslation();
    const [loading, setLoading] = useState(true);
    const [agg, setAgg] = useState(null);
    const [consumerPreview, setConsumerPreview] = useState([]);
    const [businessPreview, setBusinessPreview] = useState([]);
    const [invitations, setInvitations] = useState([]);
    const [privateInvitations, setPrivateInvitations] = useState([]);
    const [activeTab, setActiveTab] = useState('overview');

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const [statsRes, consSnap, bizSnap, invSnap, privSnap] = await Promise.all([
                adminSecurityService.getDashboardStats().catch(() => null),
                getDocs(query(collection(db, 'users'), where('role', '==', 'user'), orderBy(documentId()), limit(40))).catch(() => ({ docs: [] })),
                getDocs(query(collection(db, 'users'), where('role', '==', 'business'), orderBy(documentId()), limit(40))).catch(() => ({ docs: [] })),
                getDocs(query(collection(db, 'invitations'), orderBy('createdAt', 'desc'), limit(25))).catch(() => ({ docs: [] })),
                getDocs(query(collection(db, 'private_invitations'), orderBy('createdAt', 'desc'), limit(25))).catch(() => ({ docs: [] })),
            ]);
            setAgg(statsRes && statsRes.success !== false ? statsRes : null);
            setConsumerPreview(consSnap.docs ? consSnap.docs.map((d) => ({ id: d.id, ...d.data() })) : []);
            setBusinessPreview(bizSnap.docs ? bizSnap.docs.map((d) => ({ id: d.id, ...d.data() })) : []);
            setInvitations(invSnap.docs.map((d) => ({ id: d.id, ...d.data(), type: 'public' })));
            setPrivateInvitations(privSnap.docs.map((d) => ({ id: d.id, ...d.data(), type: 'private' })));
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const allInvitations = [
        ...invitations.map((i) => ({ ...i, sortTime: toMillis(i.createdAt) })),
        ...privateInvitations.map((i) => ({ ...i, sortTime: toMillis(i.createdAt) })),
    ].sort((a, b) => (b.sortTime || 0) - (a.sortTime || 0));

    const formatDate = (ms) => (ms ? new Date(ms).toLocaleString() : '—');

    if (loading) {
        return (
            <div className="admin-loading">
                <div className="admin-spinner" />
                <p style={{ color: 'var(--admin-text-secondary)', marginTop: '1rem' }}>{t('admin_home_loading')}</p>
            </div>
        );
    }

    const tabs = [
        { id: 'overview', label: t('admin_home_tab_overview'), icon: FaShieldAlt },
        { id: 'users', label: t('admin_home_tab_users'), icon: FaUser },
        { id: 'businesses', label: t('admin_home_tab_businesses'), icon: FaStore },
        { id: 'invitations', label: t('admin_home_tab_invitations'), icon: FaEnvelope },
    ];

    return (
        <div className="admin-home">
            <div className="admin-page-header">
                <h1 className="admin-page-title">{t('admin_home_title')}</h1>
                <p className="admin-page-subtitle">{t('admin_home_subtitle')}</p>
            </div>

            <div className="admin-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                <div className="admin-card" style={{ padding: '1.25rem', borderLeft: '4px solid var(--admin-accent)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                        <FaUsersCog style={{ color: 'var(--admin-accent)', fontSize: '1.25rem' }} />
                        <span style={{ fontSize: '0.8rem', color: 'var(--admin-text-muted)', fontWeight: '600' }}>{t('admin_home_stat_team')}</span>
                    </div>
                    <div style={{ fontSize: '1.75rem', fontWeight: '800', color: 'var(--admin-text-primary)' }}>{agg?.usersTeam ?? '—'}</div>
                </div>
                <div className="admin-card" style={{ padding: '1.25rem', borderLeft: '4px solid #22c55e' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                        <FaUsers style={{ color: '#22c55e', fontSize: '1.25rem' }} />
                        <span style={{ fontSize: '0.8rem', color: 'var(--admin-text-muted)', fontWeight: '600' }}>{t('admin_home_stat_consumers')}</span>
                    </div>
                    <div style={{ fontSize: '1.75rem', fontWeight: '800', color: 'var(--admin-text-primary)' }}>{agg?.usersConsumer ?? '—'}</div>
                </div>
                <div className="admin-card" style={{ padding: '1.25rem', borderLeft: '4px solid #f59e0b' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                        <FaStore style={{ color: '#f59e0b', fontSize: '1.25rem' }} />
                        <span style={{ fontSize: '0.8rem', color: 'var(--admin-text-muted)', fontWeight: '600' }}>{t('admin_home_stat_businesses')}</span>
                    </div>
                    <div style={{ fontSize: '1.75rem', fontWeight: '800', color: 'var(--admin-text-primary)' }}>{agg?.usersBusiness ?? '—'}</div>
                </div>
                <div className="admin-card" style={{ padding: '1.25rem', borderLeft: '4px solid #8b5cf6' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                        <FaEnvelope style={{ color: '#8b5cf6', fontSize: '1.25rem' }} />
                        <span style={{ fontSize: '0.8rem', color: 'var(--admin-text-muted)', fontWeight: '600' }}>{t('admin_home_stat_invitations')}</span>
                    </div>
                    <div style={{ fontSize: '1.75rem', fontWeight: '800', color: 'var(--admin-text-primary)' }}>
                        {agg ? (agg.invitationsPublic ?? 0) + (agg.invitationsPrivate ?? 0) : allInvitations.length}
                    </div>
                </div>
            </div>

            <p style={{ fontSize: '0.85rem', color: 'var(--admin-text-muted)', marginBottom: '1rem' }}>
                <Link to="/admin/accounts" style={{ color: 'var(--admin-accent)', fontWeight: 600 }}>
                    {t('admin_home_accounts_cta')}
                </Link>
                {agg?.reportsPending != null && (
                    <>
                        {' · '}
                        <Link to="/admin/reports" style={{ color: 'var(--admin-accent)', fontWeight: 600 }}>
                            {t('admin_home_reports_pending', { count: agg.reportsPending })}
                        </Link>
                    </>
                )}
            </p>

            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                {tabs.map((x) => (
                    <button
                        key={x.id}
                        type="button"
                        className={`admin-btn ${activeTab === x.id ? 'admin-btn-primary' : 'admin-btn-secondary'}`}
                        onClick={() => setActiveTab(x.id)}
                    >
                        <x.icon style={{ marginRight: '0.5rem' }} />
                        {x.label}
                    </button>
                ))}
            </div>

            {activeTab === 'overview' && (
                <div className="admin-card" style={{ padding: 0, overflow: 'hidden' }}>
                    <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--admin-border)' }}>
                        <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '700' }}>{t('admin_home_latest_invitations')}</h2>
                        <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: 'var(--admin-text-muted)' }}>{t('admin_home_latest_invitations_hint')}</p>
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                        {allInvitations.length === 0 ? (
                            <div className="admin-empty">
                                <p className="admin-empty-text">{t('admin_home_no_invitations')}</p>
                            </div>
                        ) : (
                            <table className="admin-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr>
                                        <th style={{ textAlign: 'left', padding: '0.75rem 1rem', borderBottom: '1px solid var(--admin-border)', fontSize: '0.75rem', color: 'var(--admin-text-muted)', fontWeight: '600' }}>Type</th>
                                        <th style={{ textAlign: 'left', padding: '0.75rem 1rem', borderBottom: '1px solid var(--admin-border)', fontSize: '0.75rem', color: 'var(--admin-text-muted)', fontWeight: '600' }}>Title</th>
                                        <th style={{ textAlign: 'left', padding: '0.75rem 1rem', borderBottom: '1px solid var(--admin-border)', fontSize: '0.75rem', color: 'var(--admin-text-muted)', fontWeight: '600' }}>Created</th>
                                        <th style={{ textAlign: 'left', padding: '0.75rem 1rem', borderBottom: '1px solid var(--admin-border)', fontSize: '0.75rem', color: 'var(--admin-text-muted)', fontWeight: '600' }} />
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
                        <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '700' }}>{t('admin_home_consumers_preview')}</h2>
                        <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: 'var(--admin-text-muted)' }}>
                            {t('admin_home_preview_hint')}{' '}
                            <Link to="/admin/accounts?tab=consumers" style={{ color: 'var(--admin-accent)', fontWeight: 600 }}>
                                {t('admin_home_accounts_cta')}
                            </Link>
                        </p>
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                        {consumerPreview.length === 0 ? (
                            <div className="admin-empty">
                                <p className="admin-empty-text">{t('admin_home_no_consumers')}</p>
                            </div>
                        ) : (
                            <table className="admin-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr>
                                        <th style={{ textAlign: 'left', padding: '0.75rem 1rem', borderBottom: '1px solid var(--admin-border)', fontSize: '0.75rem', color: 'var(--admin-text-muted)', fontWeight: '600' }}>Display name</th>
                                        <th style={{ textAlign: 'left', padding: '0.75rem 1rem', borderBottom: '1px solid var(--admin-border)', fontSize: '0.75rem', color: 'var(--admin-text-muted)', fontWeight: '600' }}>Email</th>
                                        <th style={{ textAlign: 'left', padding: '0.75rem 1rem', borderBottom: '1px solid var(--admin-border)', fontSize: '0.75rem', color: 'var(--admin-text-muted)', fontWeight: '600' }}>Credits</th>
                                        <th style={{ textAlign: 'left', padding: '0.75rem 1rem', borderBottom: '1px solid var(--admin-border)', fontSize: '0.75rem', color: 'var(--admin-text-muted)', fontWeight: '600' }} />
                                    </tr>
                                </thead>
                                <tbody>
                                    {consumerPreview.map((u) => (
                                        <tr key={u.id} style={{ borderBottom: '1px solid var(--admin-border)' }}>
                                            <td style={{ padding: '0.75rem 1rem', fontWeight: '500' }}>{u.display_name || u.displayName || '—'}</td>
                                            <td style={{ padding: '0.75rem 1rem', fontSize: '0.9rem', color: 'var(--admin-text-secondary)' }}>{maskEmail(u.email)}</td>
                                            <td style={{ padding: '0.75rem 1rem', fontSize: '0.85rem', color: 'var(--admin-text-secondary)' }}>
                                                paid {Math.max(0, Math.floor(Number(u.paidCredits) || 0))} · free {Math.max(0, Math.floor(Number(u.freeCredits) || 0))}
                                            </td>
                                            <td style={{ padding: '0.75rem 1rem' }}>
                                                <button type="button" className="admin-btn admin-btn-secondary" style={{ fontSize: '0.8rem', padding: '0.35rem 0.6rem' }} onClick={() => navigate(`/profile/${u.id}`)}>
                                                    Profile
                                                </button>
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
                        <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '700' }}>{t('admin_home_business_preview')}</h2>
                        <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: 'var(--admin-text-muted)' }}>
                            {t('admin_home_preview_hint')}{' '}
                            <Link to="/admin/accounts?tab=business" style={{ color: 'var(--admin-accent)', fontWeight: 600 }}>
                                {t('admin_home_accounts_cta')}
                            </Link>
                        </p>
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                        {businessPreview.length === 0 ? (
                            <div className="admin-empty">
                                <p className="admin-empty-text">{t('admin_home_no_businesses')}</p>
                            </div>
                        ) : (
                            <table className="admin-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr>
                                        <th style={{ textAlign: 'left', padding: '0.75rem 1rem', borderBottom: '1px solid var(--admin-border)', fontSize: '0.75rem', color: 'var(--admin-text-muted)', fontWeight: '600' }}>Business</th>
                                        <th style={{ textAlign: 'left', padding: '0.75rem 1rem', borderBottom: '1px solid var(--admin-border)', fontSize: '0.75rem', color: 'var(--admin-text-muted)', fontWeight: '600' }}>Email</th>
                                        <th style={{ textAlign: 'left', padding: '0.75rem 1rem', borderBottom: '1px solid var(--admin-border)', fontSize: '0.75rem', color: 'var(--admin-text-muted)', fontWeight: '600' }}>Plan</th>
                                        <th style={{ textAlign: 'left', padding: '0.75rem 1rem', borderBottom: '1px solid var(--admin-border)', fontSize: '0.75rem', color: 'var(--admin-text-muted)', fontWeight: '600' }} />
                                    </tr>
                                </thead>
                                <tbody>
                                    {businessPreview.map((u) => (
                                        <tr key={u.id} style={{ borderBottom: '1px solid var(--admin-border)' }}>
                                            <td style={{ padding: '0.75rem 1rem', fontWeight: '500' }}>{u.businessInfo?.businessName || u.display_name || u.displayName || '—'}</td>
                                            <td style={{ padding: '0.75rem 1rem', fontSize: '0.9rem', color: 'var(--admin-text-secondary)' }}>{maskEmail(u.email)}</td>
                                            <td style={{ padding: '0.75rem 1rem', fontSize: '0.85rem', textTransform: 'capitalize' }}>{u.subscriptionTier || 'free'}</td>
                                            <td style={{ padding: '0.75rem 1rem' }}>
                                                <button type="button" className="admin-btn admin-btn-secondary" style={{ fontSize: '0.8rem', padding: '0.35rem 0.6rem' }} onClick={() => navigate(`/business/${u.id}`)}>
                                                    Profile
                                                </button>
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
                        <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '700' }}>{t('admin_home_all_invitations')}</h2>
                        <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: 'var(--admin-text-muted)' }}>{t('admin_home_invitations_manage')}</p>
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                        {allInvitations.length === 0 ? (
                            <div className="admin-empty">
                                <p className="admin-empty-text">{t('admin_home_no_invitations')}</p>
                            </div>
                        ) : (
                            <table className="admin-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr>
                                        <th style={{ textAlign: 'left', padding: '0.75rem 1rem', borderBottom: '1px solid var(--admin-border)', fontSize: '0.75rem', color: 'var(--admin-text-muted)', fontWeight: '600' }}>Type</th>
                                        <th style={{ textAlign: 'left', padding: '0.75rem 1rem', borderBottom: '1px solid var(--admin-border)', fontSize: '0.75rem', color: 'var(--admin-text-muted)', fontWeight: '600' }}>Title</th>
                                        <th style={{ textAlign: 'left', padding: '0.75rem 1rem', borderBottom: '1px solid var(--admin-border)', fontSize: '0.75rem', color: 'var(--admin-text-muted)', fontWeight: '600' }}>Created</th>
                                        <th style={{ textAlign: 'left', padding: '0.75rem 1rem', borderBottom: '1px solid var(--admin-border)', fontSize: '0.75rem', color: 'var(--admin-text-muted)', fontWeight: '600' }} />
                                    </tr>
                                </thead>
                                <tbody>
                                    {allInvitations.map((inv) => (
                                        <tr key={inv.id} style={{ borderBottom: '1px solid var(--admin-border)' }}>
                                            <td style={{ padding: '0.75rem 1rem' }}>{inv.type === 'private' ? <FaLock style={{ color: 'var(--admin-text-muted)' }} /> : <FaUtensils style={{ color: 'var(--admin-text-muted)' }} />}</td>
                                            <td style={{ padding: '0.75rem 1rem', fontWeight: '500' }}>{inv.title || inv.id}</td>
                                            <td style={{ padding: '0.75rem 1rem', fontSize: '0.85rem', color: 'var(--admin-text-secondary)' }}>{formatDate(inv.sortTime)}</td>
                                            <td style={{ padding: '0.75rem 1rem' }}>
                                                <button type="button" className="admin-btn admin-btn-secondary" style={{ fontSize: '0.8rem', padding: '0.35rem 0.6rem' }} onClick={() => navigate(inv.type === 'private' ? `/private-invitation/${inv.id}` : `/invitation/${inv.id}`)}>
                                                    View
                                                </button>
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
