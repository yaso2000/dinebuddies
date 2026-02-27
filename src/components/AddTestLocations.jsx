import React, { useState } from 'react';
import { collection, getDocs, doc, updateDoc, query, where } from 'firebase/firestore';
import { db } from '../firebase/config';
import { FaMapMarkerAlt, FaCheck } from 'react-icons/fa';

const AddTestLocations = () => {
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState('');

    // Sample locations in Saudi Arabia (major cities)
    const sampleLocations = [
        { city: 'Riyadh', lat: 24.7136, lng: 46.6753 },
        { city: 'Jeddah', lat: 21.5433, lng: 39.1728 },
        { city: 'Mecca', lat: 21.3891, lng: 39.8579 },
        { city: 'Medina', lat: 24.5247, lng: 39.5692 },
        { city: 'Dammam', lat: 26.4207, lng: 50.0888 },
        { city: 'Khobar', lat: 26.2172, lng: 50.1971 },
        { city: 'Taif', lat: 21.2703, lng: 40.4150 },
        { city: 'Tabuk', lat: 28.3838, lng: 36.5550 },
        { city: 'Abha', lat: 18.2164, lng: 42.5053 },
        { city: 'Buraidah', lat: 26.3260, lng: 43.9750 }
    ];

    const addLocationsToBusinesses = async () => {
        setLoading(true);
        setResult('');

        try {
            // Get all business accounts
            const q = query(collection(db, 'users'), where('accountType', '==', 'business'));
            const snapshot = await getDocs(q);

            let updated = 0;
            const businesses = snapshot.docs;

            for (let i = 0; i < businesses.length; i++) {
                const business = businesses[i];
                const businessData = business.data();

                // Skip if already has location
                if (businessData.location?.latitude && businessData.location?.longitude) {
                    continue;
                }

                // Assign a random location from the list
                const randomLocation = sampleLocations[i % sampleLocations.length];

                // Add some randomness to avoid exact duplicates
                const lat = randomLocation.lat + (Math.random() - 0.5) * 0.1;
                const lng = randomLocation.lng + (Math.random() - 0.5) * 0.1;

                // Update the business document
                await updateDoc(doc(db, 'users', business.id), {
                    location: {
                        latitude: lat,
                        longitude: lng,
                        city: randomLocation.city,
                        country: 'Saudi Arabia'
                    },
                    'businessInfo.city': randomLocation.city,
                    'businessInfo.country': 'Saudi Arabia'
                });

                updated++;
            }

            setResult(`✅ Successfully added locations to ${updated} businesses!`);
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
