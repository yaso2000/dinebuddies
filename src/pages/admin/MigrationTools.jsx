import React, { useState } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { FaRocket } from 'react-icons/fa';

const MigrationTools = () => {
    const isDevBuild = import.meta.env.DEV;
    const [migrating, setMigrating] = useState(false);
    const functions = getFunctions();
    const adminCleanupLegacyUserProfiles = httpsCallable(functions, 'adminCleanupLegacyUserProfiles');
    const adminRefreshPostsUserMetadata = httpsCallable(functions, 'adminRefreshPostsUserMetadata');
    const adminMigratePartnerRoles = httpsCallable(functions, 'adminMigratePartnerRoles');

    return (
        <div>
            {/* Header */}
            <div className="admin-page-header admin-mb-4">
                <h1 className="admin-page-title">Migration Tools</h1>
                <p className="admin-page-subtitle">One-time migration scripts for data setup</p>
            </div>

            {/* User Cleanup Migration Card (MOVED TO TOP) */}
            <div className="admin-card admin-mb-4" style={{ marginBottom: '2rem', border: '1px solid rgba(249, 115, 22, 0.3)', background: 'rgba(249, 115, 22, 0.05)' }}>
                <div className="admin-flex admin-gap-3" style={{ alignItems: 'flex-start' }}>
                    <div style={{
                        width: '3.5rem',
                        height: '3.5rem',
                        borderRadius: '0.75rem',
                        background: 'linear-gradient(135deg, #ef4444 0%, #f97316 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                    }}>
                        <FaRocket style={{ fontSize: '1.75rem', color: '#ffffff' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                        <h2 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#ffffff', marginBottom: '0.5rem' }}>
                            Fix User Profiles (Cleanup)
                        </h2>
                        <p style={{ fontSize: '0.9375rem', color: '#94a3b8', marginBottom: '1.5rem' }}>
                            <b>Priority Fix:</b> Convert all "User" names to real names (from email) and remove cartoon avatars.
                        </p>
                        {!isDevBuild && (
                            <p style={{ fontSize: '0.85rem', color: '#fca5a5', marginBottom: '1rem' }}>
                                Disabled in non-development builds.
                            </p>
                        )}

                        <button
                            onClick={async () => {
                                if (!window.confirm('This will update ALL users named "User" and remove Dicebear avatars.\n\nContinue?')) return;

                                setMigrating(true);
                                try {
                                    const res = await adminCleanupLegacyUserProfiles({ mode: 'basic', dryRun: false });
                                    const updatedCount = Number(res?.data?.updated || 0);
                                    const scanned = Number(res?.data?.scanned || 0);
                                    alert(`Migration Complete!\n\n✅ Updated: ${updatedCount} profiles\n📦 Scanned: ${scanned}`);
                                } catch (err) {
                                    alert('Failed: ' + err.message);
                                } finally {
                                    setMigrating(false);
                                }
                            }}
                            disabled={migrating || !isDevBuild}
                            className="admin-btn admin-btn-primary"
                            style={{
                                background: migrating ? '#64748b' : 'linear-gradient(135deg, #ef4444 0%, #f97316 100%)',
                                fontSize: '1rem',
                                fontWeight: '700',
                                padding: '0.75rem 2rem'
                            }}
                        >
                            {!isDevBuild ? 'Disabled (Dev only)' : (migrating ? 'Running...' : '🚀 Run Cleanup Now')}
                        </button>
                    </div>
                </div>
            </div>

            {/* Legacy plan migration removed to avoid duplication of old $39/$79 data. 
               Please use PlanManagement.jsx for sync/reset tools. */}

            {/* User Cleanup Migration Card */}
            <div className="admin-card admin-mb-4" style={{ marginTop: '2rem', borderTop: '1px solid #334155', paddingTop: '2rem' }}>
                <div className="admin-flex admin-gap-3" style={{ alignItems: 'flex-start' }}>
                    <div style={{
                        width: '3.5rem',
                        height: '3.5rem',
                        borderRadius: '0.75rem',
                        background: 'linear-gradient(135deg, #ef4444 0%, #f97316 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                    }}>
                        <FaRocket style={{ fontSize: '1.75rem', color: '#ffffff' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                        <h2 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#ffffff', marginBottom: '0.5rem' }}>
                            Fix Legacy User Profiles
                        </h2>
                        <p style={{ fontSize: '0.9375rem', color: '#94a3b8', marginBottom: '1.5rem' }}>
                            Clean up old accounts named "User" and remove cartoon avatars.
                            This will rename users based on their email and clear default avatars.
                        </p>

                        <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', flexWrap: 'wrap' }}>
                            <button
                                onClick={async () => {
                                    if (!window.confirm('This will update ALL users named "User" and remove Dicebear/Avataars.\n\nContinue?')) return;

                                    setMigrating(true);
                                    try {
                                        const res = await adminCleanupLegacyUserProfiles({ mode: 'robust', dryRun: false });
                                        const updatedCount = Number(res?.data?.updated || 0);
                                        const scanned = Number(res?.data?.scanned || 0);
                                        alert(`Migration Complete!\n\n✅ Updated: ${updatedCount} profiles\n📦 Scanned: ${scanned}`);
                                    } catch (err) {
                                        alert('Failed: ' + err.message);
                                    } finally {
                                        setMigrating(false);
                                    }
                                }}
                                disabled={migrating || !isDevBuild}
                                className="admin-btn admin-btn-primary"
                                style={{
                                    background: migrating ? '#64748b' : 'linear-gradient(135deg, #ef4444 0%, #f97316 100%)',
                                    fontSize: '0.9rem',
                                    fontWeight: '700',
                                    padding: '0.6rem 1.5rem',
                                    flex: 1
                                }}
                            >
                                {!isDevBuild ? 'Disabled (Dev only)' : (migrating ? 'Working...' : '1. Fix Profiles First')}
                            </button>

                            <button
                                onClick={async () => {
                                    if (!window.confirm('This will refresh ALL posts with the latest user names/photos.\n(Run Step 1 first!)\n\nContinue?')) return;

                                    setMigrating(true);
                                    try {
                                        const res = await adminRefreshPostsUserMetadata({ dryRun: false });
                                        const updatedCount = Number(res?.data?.updated || 0);
                                        const scanned = Number(res?.data?.scanned || 0);
                                        alert(`Posts Refreshed!\n\n✅ Updated: ${updatedCount} posts\n📦 Scanned: ${scanned}`);
                                    } catch (err) {
                                        console.error(err);
                                        alert('Failed: ' + err.message);
                                    } finally {
                                        setMigrating(false);
                                    }
                                }}
                                disabled={migrating || !isDevBuild}
                                className="admin-btn"
                                style={{
                                    background: migrating ? '#64748b' : '#3b82f6',
                                    color: 'white',
                                    fontSize: '0.9rem',
                                    fontWeight: '700',
                                    padding: '0.6rem 1.5rem',
                                    flex: 1,
                                    border: 'none',
                                    borderRadius: '0.5rem',
                                    cursor: 'pointer'
                                }}
                            >
                                {!isDevBuild ? 'Disabled (Dev only)' : (migrating ? 'Working...' : '2. Update Old Posts')}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Roles Migration ── */}
            <div className="admin-card admin-mb-4" style={{ marginTop: '2rem', border: '1px solid rgba(99,102,241,0.4)', background: 'rgba(99,102,241,0.05)' }}>
                <div className="admin-flex admin-gap-3" style={{ alignItems: 'flex-start' }}>
                    <div style={{
                        width: '3.5rem', height: '3.5rem', borderRadius: '0.75rem',
                        background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                    }}>
                        <span style={{ fontSize: '1.5rem' }}>🔑</span>
                    </div>
                    <div style={{ flex: 1 }}>
                        <h2 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#ffffff', marginBottom: '0.5rem' }}>
                            Roles Migration
                        </h2>
                        <p style={{ fontSize: '0.9375rem', color: '#94a3b8', marginBottom: '1.5rem' }}>
                            Updates all users: <code style={{ color: '#a5b4fc' }}>role: 'partner'</code> → <code style={{ color: '#a5b4fc' }}>role: 'business'</code><br />
                            Also removes the legacy <code style={{ color: '#fbbf24' }}>accountType</code> field from every user document.
                        </p>

                        <button
                            onClick={async () => {
                                if (!window.confirm('This will:\n• role: "partner" → "business"\n• Remove accountType field from all users\n\nContinue?')) return;

                                setMigrating(true);
                                try {
                                    const res = await adminMigratePartnerRoles({});
                                    const updatedRole = res?.data?.updatedRole || 0;
                                    const removedType = res?.data?.removedType || 0;
                                    alert(`✅ Roles Migration Complete!\n\nrole updated: ${updatedRole}\naccountType removed: ${removedType}\nErrors: 0`);
                                } catch (err) {
                                    alert('Failed: ' + err.message);
                                } finally {
                                    setMigrating(false);
                                }
                            }}
                            disabled={migrating}
                            className="admin-btn admin-btn-primary"
                            style={{
                                background: migrating ? '#64748b' : 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                                fontSize: '1rem', fontWeight: '700', padding: '0.75rem 2rem'
                            }}
                        >
                            {migrating ? '⏳ Running...' : '🚀 Run Roles Migration'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MigrationTools;
