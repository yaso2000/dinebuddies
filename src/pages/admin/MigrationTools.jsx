import React, { useState } from 'react';
import { migratePlansToFirestore } from '../../utils/migratePlans';
import { FaDatabase, FaCheckCircle, FaExclamationTriangle, FaRocket } from 'react-icons/fa';

const MigrationTools = () => {
    const [migrating, setMigrating] = useState(false);
    const [result, setResult] = useState(null);

    const handleMigrate = async () => {
        if (!window.confirm('This will migrate the 3 existing plans to Firestore.\n\nContinue?')) {
            return;
        }

        setMigrating(true);
        setResult(null);

        try {
            const migrationResult = await migratePlansToFirestore();
            setResult(migrationResult);
        } catch (error) {
            setResult({
                success: false,
                message: error.message
            });
        } finally {
            setMigrating(false);
        }
    };

    return (
        <div>
            {/* Header */}
            <div className="admin-page-header admin-mb-4">
                <h1 className="admin-page-title">Migration Tools</h1>
                <p className="admin-page-subtitle">One-time migration scripts for data setup</p>
            </div>

            {/* Plan Migration Card */}
            <div className="admin-card admin-mb-4">
                <div className="admin-flex admin-gap-3" style={{ alignItems: 'flex-start' }}>
                    <div style={{
                        width: '3.5rem',
                        height: '3.5rem',
                        borderRadius: '0.75rem',
                        background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                    }}>
                        <FaDatabase style={{ fontSize: '1.75rem', color: '#ffffff' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                        <h2 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#ffffff', marginBottom: '0.5rem' }}>
                            Migrate Subscription Plans
                        </h2>
                        <p style={{ fontSize: '0.9375rem', color: '#94a3b8', marginBottom: '1.5rem' }}>
                            Move the 3 existing subscription plans from code to Firestore.
                            This needs to be done once before using the Plan Builder.
                        </p>

                        {/* What will be migrated */}
                        <div className="admin-card" style={{ background: '#0f172a', marginBottom: '1.5rem' }}>
                            <h3 style={{ fontSize: '1rem', fontWeight: '600', color: '#ffffff', marginBottom: '0.75rem' }}>
                                What will be migrated:
                            </h3>
                            <div style={{ display: 'grid', gap: '0.5rem' }}>
                                <div className="admin-flex admin-gap-2" style={{ alignItems: 'center', color: '#22c55e' }}>
                                    <FaCheckCircle />
                                    <span style={{ color: '#cbd5e1' }}>Free Plan ($0/month)</span>
                                </div>
                                <div className="admin-flex admin-gap-2" style={{ alignItems: 'center', color: '#22c55e' }}>
                                    <FaCheckCircle />
                                    <span style={{ color: '#cbd5e1' }}>Pro Plan ($39/month)</span>
                                </div>
                                <div className="admin-flex admin-gap-2" style={{ alignItems: 'center', color: '#22c55e' }}>
                                    <FaCheckCircle />
                                    <span style={{ color: '#cbd5e1' }}>Premium Plan ($79/month)</span>
                                </div>
                            </div>
                        </div>

                        {/* Migration Button */}
                        <button
                            onClick={handleMigrate}
                            disabled={migrating}
                            className="admin-btn admin-btn-primary"
                            style={{
                                background: migrating ? '#64748b' : 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                                fontSize: '1rem',
                                fontWeight: '700',
                                padding: '0.75rem 2rem'
                            }}
                        >
                            <FaRocket />
                            {migrating ? 'Migrating...' : 'Run Migration'}
                        </button>
                    </div>
                </div>

                {/* Result */}
                {result && (
                    <div style={{
                        marginTop: '1.5rem',
                        padding: '1rem',
                        borderRadius: '0.75rem',
                        background: result.success ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                        border: `1px solid ${result.success ? '#22c55e' : '#ef4444'}`
                    }}>
                        <div className="admin-flex admin-gap-2" style={{ alignItems: 'flex-start' }}>
                            {result.success ? (
                                <FaCheckCircle style={{ color: '#22c55e', fontSize: '1.25rem', marginTop: '0.25rem' }} />
                            ) : (
                                <FaExclamationTriangle style={{ color: '#ef4444', fontSize: '1.25rem', marginTop: '0.25rem' }} />
                            )}
                            <div style={{ flex: 1 }}>
                                <h3 style={{
                                    fontSize: '1.125rem',
                                    fontWeight: '700',
                                    color: result.success ? '#22c55e' : '#ef4444',
                                    marginBottom: '0.5rem'
                                }}>
                                    {result.success ? 'Migration Successful!' : 'Migration Failed'}
                                </h3>
                                <p style={{ fontSize: '0.875rem', color: '#cbd5e1', marginBottom: '0.75rem' }}>
                                    {result.message}
                                </p>

                                {result.success && result.plans && (
                                    <div>
                                        <p style={{ fontSize: '0.875rem', fontWeight: '600', color: '#ffffff', marginBottom: '0.5rem' }}>
                                            Migrated Plans:
                                        </p>
                                        <div style={{ display: 'grid', gap: '0.25rem' }}>
                                            {result.plans.map((plan, idx) => (
                                                <div key={idx} style={{ fontSize: '0.875rem', color: '#94a3b8' }}>
                                                    • {plan.name} (ID: {plan.id})
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Important Notes */}
            <div className="admin-card" style={{
                background: 'rgba(245, 158, 11, 0.1)',
                border: '1px solid #f59e0b'
            }}>
                <div className="admin-flex admin-gap-2 admin-mb-3" style={{ alignItems: 'center' }}>
                    <FaExclamationTriangle style={{ color: '#f59e0b', fontSize: '1.5rem' }} />
                    <h3 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#f59e0b', margin: 0 }}>
                        Important Notes
                    </h3>
                </div>
                <ul style={{ display: 'grid', gap: '0.5rem', fontSize: '0.9375rem', color: '#cbd5e1', paddingLeft: '1.5rem' }}>
                    <li>This migration should only be run <strong style={{ color: '#ffffff' }}>once</strong></li>
                    <li>After migration, plans will be managed from <strong style={{ color: '#ffffff' }}>/admin/plans</strong></li>
                    <li>The PricingPage will automatically fetch from Firestore</li>
                    <li>You can create/edit/delete plans from the admin panel</li>
                    <li>Running this multiple times will create duplicate plans</li>
                </ul>
            </div>
        </div>
    );
};

export default MigrationTools;
