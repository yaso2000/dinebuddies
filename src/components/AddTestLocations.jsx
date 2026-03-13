import React, { useState } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { FaMapMarkerAlt, FaCheck } from 'react-icons/fa';

const AddTestLocations = () => {
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState('');

    const addLocationsToBusinesses = async () => {
        setLoading(true);
        setResult('');

        try {
            const functions = getFunctions();
            const callable = httpsCallable(functions, 'adminAddTestLocationsToBusinesses');
            const response = await callable({ dryRun: false });
            const updated = Number(response?.data?.updated || 0);
            const scanned = Number(response?.data?.scanned || 0);
            setResult(`✅ Successfully added locations to ${updated} businesses (scanned ${scanned})!`);
        } catch (error) {
            console.error('Error adding locations:', error);
            setResult(`❌ Error: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            position: 'fixed',
            bottom: '2rem',
            right: '2rem',
            background: 'var(--bg-card)',
            padding: '1.5rem',
            borderRadius: '16px',
            border: '1px solid var(--border-color)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
            zIndex: 9999,
            minWidth: '300px'
        }}>
            <h3 style={{
                fontSize: '1rem',
                fontWeight: '700',
                marginBottom: '1rem',
                color: 'var(--text-primary)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
            }}>
                <FaMapMarkerAlt style={{ color: 'var(--primary)' }} />
                Add Test Locations
            </h3>

            <p style={{
                fontSize: '0.85rem',
                color: 'var(--text-secondary)',
                marginBottom: '1rem'
            }}>
                This will add random locations in Saudi Arabia to businesses that don't have locations yet.
            </p>

            <button
                onClick={addLocationsToBusinesses}
                disabled={loading}
                style={{
                    width: '100%',
                    padding: '0.75rem',
                    background: loading ? 'var(--bg-body)' : 'linear-gradient(135deg, var(--primary), #f97316)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '12px',
                    fontSize: '0.95rem',
                    fontWeight: '600',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    opacity: loading ? 0.6 : 1
                }}
            >
                {loading ? (
                    <>
                        <div style={{
                            width: '16px',
                            height: '16px',
                            border: '2px solid white',
                            borderTopColor: 'transparent',
                            borderRadius: '50%',
                            animation: 'spin 0.8s linear infinite'
                        }} />
                        Adding...
                    </>
                ) : (
                    <>
                        <FaCheck />
                        Add Locations
                    </>
                )}
            </button>

            {result && (
                <div style={{
                    marginTop: '1rem',
                    padding: '0.75rem',
                    background: result.includes('✅') ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                    border: `1px solid ${result.includes('✅') ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                    borderRadius: '8px',
                    fontSize: '0.85rem',
                    color: result.includes('✅') ? '#22c55e' : '#ef4444'
                }}>
                    {result}
                </div>
            )}

            <style>{`
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
};

export default AddTestLocations;
