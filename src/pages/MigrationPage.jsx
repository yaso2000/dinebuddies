import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import migrateBusinessAccounts from '../utils/migrateBusinessAccounts';

const MigrationPage = () => {
    const navigate = useNavigate();
    const [running, setRunning] = useState(false);
    const [result, setResult] = useState(null);
    const [logs, setLogs] = useState([]);

    // Override console.log to capture logs
    const originalLog = console.log;
    const captureLog = (...args) => {
        const message = args.map(arg =>
            typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
        ).join(' ');
        setLogs(prev => [...prev, message]);
        originalLog(...args);
    };

    const runMigration = async () => {
        setRunning(true);
        setLogs([]);
        setResult(null);

        // Capture console logs
        console.log = captureLog;

        try {
            const migrationResult = await migrateBusinessAccounts();
            setResult(migrationResult);
        } catch (error) {
            setResult({
                success: false,
                error: error.message
            });
        } finally {
            // Restore original console.log
            console.log = originalLog;
            setRunning(false);
        }
    };

    return (
        <div style={{
            minHeight: '100vh',
            background: 'var(--bg-body)',
            padding: '2rem'
        }}>
            <div style={{
                maxWidth: '900px',
                margin: '0 auto'
            }}>
                {/* Header */}
                <div style={{
                    background: 'var(--card-bg)',
                    padding: '2rem',
                    borderRadius: '16px',
                    marginBottom: '2rem',
                    border: '1px solid var(--border-color)'
                }}>
                    <h1 style={{
                        fontSize: '2rem',
                        fontWeight: '900',
                        marginBottom: '0.5rem',
                        background: 'linear-gradient(135deg, var(--primary), #f97316)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent'
                    }}>
                        🔄 Business Account Migration
                    </h1>
                    <p style={{
                        color: 'var(--text-muted)',
                        fontSize: '0.95rem',
                        marginBottom: '1.5rem'
                    }}>
                        This will migrate existing business accounts to use display_name and photo_url fields.
                    </p>

                    {/* Warning */}
                    <div style={{
                        background: 'rgba(251, 191, 36, 0.1)',
                        border: '1px solid #fbbf24',
                        borderRadius: '12px',
                        padding: '1rem',
                        marginBottom: '1.5rem'
                    }}>
                        <div style={{
                            display: 'flex',
                            gap: '0.75rem',
                            alignItems: 'flex-start'
                        }}>
                            <span style={{ fontSize: '1.5rem' }}>⚠️</span>
                            <div>
                                <div style={{ fontWeight: '700', marginBottom: '0.25rem', color: '#fbbf24' }}>
                                    Important
                                </div>
                                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                    This migration will:
                                    <ul style={{ marginTop: '0.5rem', paddingLeft: '1.5rem' }}>
                                        <li>Move businessInfo.businessName → display_name</li>
                                        <li>Move businessInfo.logoImage → photo_url</li>
                                        <li>Delete duplicate fields from businessInfo</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Button */}
                    <button
                        onClick={runMigration}
                        disabled={running}
                        style={{
                            width: '100%',
                            padding: '1rem',
                            background: running
                                ? 'var(--bg-body)'
                                : 'linear-gradient(135deg, var(--primary), #f97316)',
                            border: 'none',
                            borderRadius: '12px',
                            color: 'white',
                            fontSize: '1rem',
                            fontWeight: '700',
                            cursor: running ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.5rem',
                            transition: 'transform 0.2s'
                        }}
                        onMouseEnter={(e) => {
                            if (!running) e.currentTarget.style.transform = 'scale(1.02)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'scale(1)';
                        }}
                    >
                        {running ? (
                            <>
                                <div style={{
                                    width: '20px',
                                    height: '20px',
                                    border: '3px solid white',
                                    borderTop: '3px solid transparent',
                                    borderRadius: '50%',
                                    animation: 'spin 1s linear infinite'
                                }} />
                                Running Migration...
                            </>
                        ) : (
                            <>
                                🚀 Run Migration
                            </>
                        )}
                    </button>
                </div>

                {/* Results */}
                {result && (
                    <div style={{
                        background: 'var(--card-bg)',
                        padding: '2rem',
                        borderRadius: '16px',
                        marginBottom: '2rem',
                        border: `2px solid ${result.success ? '#10b981' : '#ef4444'}`
                    }}>
                        <h2 style={{
                            fontSize: '1.5rem',
                            fontWeight: '800',
                            marginBottom: '1rem',
                            color: result.success ? '#10b981' : '#ef4444'
                        }}>
                            {result.success ? '✅ Migration Complete!' : '❌ Migration Failed'}
                        </h2>

                        {result.success && (
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                                gap: '1rem',
                                marginTop: '1.5rem'
                            }}>
                                <div style={{
                                    background: 'var(--bg-body)',
                                    padding: '1rem',
                                    borderRadius: '12px',
                                    textAlign: 'center'
                                }}>
                                    <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📊</div>
                                    <div style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--primary)' }}>
                                        {result.total}
                                    </div>
                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                        Total Accounts
                                    </div>
                                </div>

                                <div style={{
                                    background: 'var(--bg-body)',
                                    padding: '1rem',
                                    borderRadius: '12px',
                                    textAlign: 'center'
                                }}>
                                    <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>✅</div>
                                    <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#10b981' }}>
                                        {result.migrated}
                                    </div>
                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                        Migrated
                                    </div>
                                </div>

                                <div style={{
                                    background: 'var(--bg-body)',
                                    padding: '1rem',
                                    borderRadius: '12px',
                                    textAlign: 'center'
                                }}>
                                    <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⏭️</div>
                                    <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#fbbf24' }}>
                                        {result.skipped}
                                    </div>
                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                        Skipped
                                    </div>
                                </div>

                                <div style={{
                                    background: 'var(--bg-body)',
                                    padding: '1rem',
                                    borderRadius: '12px',
                                    textAlign: 'center'
                                }}>
                                    <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>❌</div>
                                    <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#ef4444' }}>
                                        {result.errors}
                                    </div>
                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                        Errors
                                    </div>
                                </div>
                            </div>
                        )}

                        {result.error && (
                            <div style={{
                                background: 'rgba(239, 68, 68, 0.1)',
                                padding: '1rem',
                                borderRadius: '12px',
                                marginTop: '1rem',
                                color: '#ef4444',
                                fontFamily: 'monospace'
                            }}>
                                {result.error}
                            </div>
                        )}
                    </div>
                )}

                {/* Logs */}
                {logs.length > 0 && (
                    <div style={{
                        background: 'var(--card-bg)',
                        padding: '2rem',
                        borderRadius: '16px',
                        border: '1px solid var(--border-color)'
                    }}>
                        <h3 style={{
                            fontSize: '1.2rem',
                            fontWeight: '800',
                            marginBottom: '1rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem'
                        }}>
                            📋 Migration Logs
                        </h3>
                        <div style={{
                            background: '#1e1e1e',
                            padding: '1.5rem',
                            borderRadius: '12px',
                            maxHeight: '400px',
                            overflowY: 'auto',
                            fontFamily: 'monospace',
                            fontSize: '0.85rem',
                            color: '#d4d4d4'
                        }}>
                            {logs.map((log, index) => (
                                <div key={index} style={{ marginBottom: '0.25rem' }}>
                                    {log}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Back Button */}
                <button
                    onClick={() => navigate('/business-dashboard')}
                    style={{
                        marginTop: '2rem',
                        padding: '0.75rem 1.5rem',
                        background: 'var(--bg-body)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '12px',
                        color: 'var(--text-primary)',
                        fontSize: '0.95rem',
                        fontWeight: '600',
                        cursor: 'pointer'
                    }}
                >
                    ← Back to Dashboard
                </button>
            </div>
        </div>
    );
};

export default MigrationPage;
