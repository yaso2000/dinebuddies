import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaDatabase, FaBullhorn, FaCode, FaExclamationTriangle } from 'react-icons/fa';
import { adminSecurityService } from '../../services/adminSecurityService';

const AdminSystemTools = () => {
    const navigate = useNavigate();
    const [cleaningOrphans, setCleaningOrphans] = useState(false);
    const [wipingAll, setWipingAll] = useState(false);

    const tools = [
        { title: 'Database migrations', desc: 'Role migrations, schema updates', icon: FaDatabase, path: '/admin/migration' },
        { title: 'Rebuild search index', desc: 'Re-index search when ready', icon: FaCode, path: null },
        { title: 'System announcements', desc: 'Platform-wide announcements', icon: FaBullhorn, path: null },
    ];

    const handleCleanOrphans = async () => {
        if (!window.confirm('Scan and delete orphaned posts and stories?')) return;
        setCleaningOrphans(true);
        try {
            const res = await adminSecurityService.cleanOrphanContent();
            alert(`Cleaned ${res?.deletedPosts || 0} posts + ${res?.deletedStories || 0} stories.`);
        } catch (err) {
            alert('Error: ' + (err?.message || err));
        } finally {
            setCleaningOrphans(false);
        }
    };

    const handleWipeAllPosts = async () => {
        if (!window.confirm('Delete ALL posts and stories for the whole platform? This cannot be undone.')) return;
        if (window.prompt('Type DELETE ALL to confirm') !== 'DELETE ALL') return;
        setWipingAll(true);
        try {
            const res = await adminSecurityService.wipeCommunityContent();
            alert(`Wiped: ${res?.deletedPosts || 0} posts + ${res?.deletedStories || 0} stories.`);
        } catch (err) {
            alert('Error: ' + (err?.message || err));
        } finally {
            setWipingAll(false);
        }
    };

    return (
        <div>
            <div className="admin-page-header">
                <h1 className="admin-page-title">System Tools</h1>
                <p className="admin-page-subtitle">
                    Technical maintenance. Dangerous actions below affect the entire feed — not individual users.
                </p>
            </div>

            <div className="admin-grid admin-grid-2">
                {tools.map((t) => (
                    <div key={t.title} className="admin-card" style={{ cursor: t.path ? 'pointer' : 'default' }} onClick={() => t.path && navigate(t.path)}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <div style={{ width: '3rem', height: '3rem', borderRadius: 'var(--admin-radius-sm)', background: 'var(--admin-bg-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <t.icon style={{ color: 'var(--admin-text-secondary)' }} />
                            </div>
                            <div>
                                <h3 style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--admin-text-primary)', margin: '0 0 0.25rem 0' }}>{t.title}</h3>
                                <p style={{ fontSize: '0.875rem', color: 'var(--admin-text-muted)', margin: 0 }}>{t.desc}</p>
                                {!t.path && <span style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted)' }}>Coming soon</span>}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="admin-mt-4">
                <button type="button" className="admin-btn admin-btn-secondary" onClick={() => navigate('/admin/migration')}>
                    Open Migration Tools
                </button>
            </div>

            <div className="admin-card admin-mt-4" style={{ borderColor: 'rgba(239, 68, 68, 0.35)', background: 'rgba(239, 68, 68, 0.06)' }}>
                <h2 style={{ fontSize: '1.05rem', fontWeight: 800, margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--admin-text-primary)' }}>
                    <FaExclamationTriangle style={{ color: '#f87171' }} aria-hidden />
                    Community feed content
                </h2>
                <p style={{ fontSize: '0.875rem', color: 'var(--admin-text-muted)', marginBottom: '1rem' }}>
                    These call Cloud Functions and affect <strong>all users</strong>’ posts/stories. Use for maintenance or emergencies — not day-to-day user moderation (use feed moderation when built).
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
                    <button
                        type="button"
                        className="admin-btn admin-btn-danger"
                        disabled={cleaningOrphans || wipingAll}
                        onClick={handleCleanOrphans}
                    >
                        {cleaningOrphans ? 'Cleaning…' : 'Clean orphaned posts & stories'}
                    </button>
                    <button
                        type="button"
                        style={{
                            padding: '0.5rem 1rem',
                            borderRadius: 'var(--admin-radius-sm)',
                            border: 'none',
                            fontWeight: 700,
                            cursor: wipingAll || cleaningOrphans ? 'not-allowed' : 'pointer',
                            background: '#b91c1c',
                            color: '#fff',
                            opacity: wipingAll || cleaningOrphans ? 0.6 : 1,
                        }}
                        disabled={wipingAll || cleaningOrphans}
                        onClick={handleWipeAllPosts}
                    >
                        {wipingAll ? 'Wiping…' : 'Delete ALL posts & stories'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AdminSystemTools;
