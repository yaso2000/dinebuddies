import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FaCog, FaDatabase, FaBroom, FaBullhorn, FaCode } from 'react-icons/fa';

const AdminSystemTools = () => {
    const navigate = useNavigate();

    const tools = [
        { title: 'Database migrations', desc: 'Role migrations, schema updates', icon: FaDatabase, path: '/admin/migration' },
        { title: 'Orphan cleanup', desc: 'Clean orphaned posts and stories', icon: FaBroom, path: null },
        { title: 'Rebuild search index', desc: 'Re-index search when ready', icon: FaCode, path: null },
        { title: 'System announcements', desc: 'Platform-wide announcements', icon: FaBullhorn, path: null },
    ];

    return (
        <div>
            <div className="admin-page-header">
                <h1 className="admin-page-title">System Tools</h1>
                <p className="admin-page-subtitle">Technical admin tools and migrations.</p>
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
        </div>
    );
};

export default AdminSystemTools;
