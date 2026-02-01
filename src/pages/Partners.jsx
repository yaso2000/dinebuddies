import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config';
import { FaArrowLeft, FaSearch, FaFilter } from 'react-icons/fa';
import { HiBuildingStorefront } from 'react-icons/hi2';
import { useNavigate } from 'react-router-dom';
import BusinessCard from '../components/BusinessCard';
import { useAuth } from '../context/AuthContext';

const Partners = () => {
    const navigate = useNavigate();
    const { currentUser, userProfile } = useAuth();
    const [businesses, setBusinesses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState('All');
    const [showDebug, setShowDebug] = useState(true); // Always show debug info

    const businessTypes = [
        'All',
        'Restaurant',
        'Cafe',
        'Hotel',
        'Activity Center',
        'Salon',
        'Gym',
        'Event Hall',
        'Other'
    ];

    useEffect(() => {
        fetchBusinesses();
    }, []);

    const fetchBusinesses = async () => {
        try {
            setLoading(true);
            console.log('Fetching business accounts...');

            const q = query(
                collection(db, 'users'),
                where('accountType', '==', 'business')
            );

            const querySnapshot = await getDocs(q);
            const businessList = [];

            console.log('Query returned', querySnapshot.size, 'documents');

            querySnapshot.forEach((doc) => {
                const data = doc.data();
                const info = data.businessInfo;

                // Only show published businesses
                // strict check: info?.isPublished === true
                // PERMISSIVE CHECK for legacy data: allow if undefined
                if (info && (info.isPublished === true || info.isPublished === undefined)) {
                    console.log('Business found (Published/Legacy):', doc.id, info.businessName);
                    businessList.push({
                        uid: doc.id,
                        ...data
                    });
                } else {
                    console.log('Business found (Skipped/Unpublished):', doc.id);
                }
            });

            // Sort by creation date (newest first)
            businessList.sort((a, b) => {
                const dateA = a.businessInfo?.createdAt?.toDate?.() || new Date(0);
                const dateB = b.businessInfo?.createdAt?.toDate?.() || new Date(0);
                return dateB - dateA;
            });

            console.log('Total businesses found:', businessList.length);
            setBusinesses(businessList);
        } catch (error) {
            console.error('Error fetching businesses:', error);
            alert('Error loading partners: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    // Filter businesses
    const filteredBusinesses = businesses.filter(business => {
        const info = business.businessInfo || {};
        const matchesSearch = !searchTerm ||
            info.businessName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            info.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            info.city?.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesType = filterType === 'All' || info.businessType === filterType;

        return matchesSearch && matchesType;
    });

    return (
        <div className="page-container" style={{ paddingBottom: '100px' }}>
            {/* Header */}
            <header className="app-header sticky-header-glass">
                <button className="back-btn" onClick={() => navigate(-1)}>
                    <FaArrowLeft style={{ transform: 'rotate(180deg)' }} />
                </button>
                <div style={{ flex: 1, textAlign: 'center' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: '800', margin: 0 }}>Partners</h3>
                </div>
                <button
                    className="back-btn"
                    onClick={fetchBusinesses}
                    title="Refresh"
                >
                    🔄
                </button>
            </header>

            {/* Hero Banner */}
            <div style={{
                background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.2), rgba(236, 72, 153, 0.2))',
                border: '1px solid rgba(139, 92, 246, 0.3)',
                borderRadius: '0 0 32px 32px',
                padding: '2rem 1.5rem',
                marginTop: '-1rem',
                textAlign: 'center',
                marginBottom: '2rem'
            }}>
                <HiBuildingStorefront style={{
                    fontSize: '3rem',
                    color: 'var(--primary)',
                    marginBottom: '0.75rem'
                }} />
                <h1 style={{
                    fontSize: '1.8rem',
                    fontWeight: '900',
                    marginBottom: '0.5rem',
                    color: 'white'
                }}>
                    Our Partners
                </h1>
                <p style={{
                    fontSize: '0.95rem',
                    color: 'var(--text-secondary)',
                    marginBottom: '0'
                }}>
                    Discover amazing restaurants, cafes, and activities
                </p>
                <div style={{
                    display: 'inline-block',
                    marginTop: '1rem',
                    padding: '8px 20px',
                    background: 'rgba(139, 92, 246, 0.2)',
                    border: '1px solid rgba(139, 92, 246, 0.3)',
                    borderRadius: '20px',
                    fontSize: '0.85rem',
                    fontWeight: '600',
                    color: 'var(--primary)'
                }}>
                    {businesses.length} Partners
                </div>
            </div>

            {/* DEBUG INFO - Remove this after testing */}
            {showDebug && (
                <div style={{
                    margin: '0 1.5rem 2rem',
                    padding: '1.5rem',
                    background: 'linear-gradient(135deg, rgba(255, 107, 107, 0.1), rgba(255, 193, 7, 0.1))',
                    border: '2px solid rgba(255, 193, 7, 0.5)',
                    borderRadius: '16px'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '800' }}>🔍 Debug Info</h3>
                        <button
                            onClick={() => setShowDebug(false)}
                            style={{
                                background: 'transparent',
                                border: '1px solid var(--border-color)',
                                borderRadius: '8px',
                                color: 'white',
                                padding: '6px 12px',
                                cursor: 'pointer',
                                fontSize: '0.8rem'
                            }}
                        >
                            Hide
                        </button>
                    </div>

                    <div style={{ fontSize: '0.9rem', lineHeight: '1.8' }}>
                        <p><strong>Your UID:</strong> {currentUser?.uid || '❌ Not logged in'}</p>
                        <p><strong>Your Email:</strong> {currentUser?.email || 'N/A'}</p>
                        <p><strong>Account Type:</strong> <span style={{
                            padding: '4px 12px',
                            background: userProfile?.accountType === 'business' ? 'rgba(81, 207, 102, 0.2)' : 'rgba(255, 107, 107, 0.2)',
                            border: `1px solid ${userProfile?.accountType === 'business' ? '#51cf66' : '#ff6b6b'}`,
                            borderRadius: '8px',
                            fontWeight: '700'
                        }}>
                            {userProfile?.accountType || 'undefined'}
                        </span></p>
                        <p><strong>Business Name:</strong> {userProfile?.businessInfo?.businessName || 'N/A'}</p>
                        <p><strong>Businesses Found:</strong> {businesses.length}</p>

                        {userProfile?.accountType !== 'business' && (
                            <div style={{
                                marginTop: '1rem',
                                padding: '1rem',
                                background: 'rgba(255, 107, 107, 0.2)',
                                border: '1px solid #ff6b6b',
                                borderRadius: '8px'
                            }}>
                                ❌ <strong>Your account is NOT a business account!</strong>
                                <br />
                                <button
                                    onClick={() => navigate('/convert-to-business')}
                                    style={{
                                        marginTop: '0.75rem',
                                        padding: '10px 20px',
                                        background: 'var(--primary)',
                                        border: 'none',
                                        borderRadius: '8px',
                                        color: 'white',
                                        cursor: 'pointer',
                                        fontWeight: '600'
                                    }}
                                >
                                    Convert Now
                                </button>
                            </div>
                        )}

                        {businesses.length === 0 && (
                            <div style={{
                                marginTop: '1rem',
                                padding: '1rem',
                                background: 'rgba(255, 193, 7, 0.2)',
                                border: '1px solid #ffc107',
                                borderRadius: '8px'
                            }}>
                                ⚠️ <strong>No business accounts found in database!</strong>
                                <br />
                                <small>Check console (F12) for query results</small>
                            </div>
                        )}
                    </div>
                </div>
            )}

            <div style={{ padding: '0 1.5rem' }}>
                {/* Search Bar */}
                <div style={{
                    position: 'relative',
                    marginBottom: '1.5rem'
                }}>
                    <FaSearch style={{
                        position: 'absolute',
                        left: '16px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: 'var(--text-muted)',
                        fontSize: '1rem'
                    }} />
                    <input
                        type="text"
                        placeholder="Search partners..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{
                            width: '100%',
                            padding: '14px 16px 14px 48px',
                            background: 'var(--bg-card)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '16px',
                            color: 'white',
                            fontSize: '0.95rem',
                            outline: 'none'
                        }}
                    />
                </div>

                {/* Filter Tabs */}
                <div style={{
                    display: 'flex',
                    gap: '8px',
                    overflowX: 'auto',
                    marginBottom: '2rem',
                    paddingBottom: '4px'
                }}>
                    {businessTypes.map(type => (
                        <button
                            key={type}
                            onClick={() => setFilterType(type)}
                            style={{
                                padding: '10px 20px',
                                background: filterType === type ? 'var(--primary)' : 'transparent',
                                border: filterType === type ? 'none' : '1px solid var(--border-color)',
                                borderRadius: '12px',
                                color: 'white',
                                fontWeight: '700',
                                fontSize: '0.85rem',
                                whiteSpace: 'nowrap',
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                        >
                            {type}
                        </button>
                    ))}
                </div>

                {/* Loading State */}
                {loading && (
                    <div style={{
                        textAlign: 'center',
                        padding: '4rem 2rem',
                        color: 'var(--text-muted)'
                    }}>
                        <div style={{
                            width: '50px',
                            height: '50px',
                            border: '4px solid var(--border-color)',
                            borderTop: '4px solid var(--primary)',
                            borderRadius: '50%',
                            animation: 'spin 1s linear infinite',
                            margin: '0 auto 1rem'
                        }} />
                        <p>Loading partners...</p>
                    </div>
                )}

                {/* Empty State */}
                {!loading && filteredBusinesses.length === 0 && (
                    <div style={{
                        textAlign: 'center',
                        padding: '4rem 2rem',
                        color: 'var(--text-muted)'
                    }}>
                        <HiBuildingStorefront style={{ fontSize: '4rem', marginBottom: '1rem', opacity: 0.3 }} />
                        <h3 style={{ fontSize: '1.2rem', fontWeight: '700', marginBottom: '0.5rem' }}>
                            No partners found
                        </h3>
                        <p style={{ fontSize: '0.9rem' }}>
                            {searchTerm || filterType !== 'All'
                                ? 'Try adjusting your search or filter'
                                : 'Be the first to become a partner!'}
                        </p>
                    </div>
                )}

                {/* Business Cards Grid */}
                {!loading && filteredBusinesses.length > 0 && (
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                        gap: '1.5rem',
                        marginBottom: '2rem'
                    }}>
                        {filteredBusinesses.map(business => (
                            <BusinessCard key={business.uid} business={business} />
                        ))}
                    </div>
                )}
            </div>

            {/* Floating Add Button (for business accounts) */}
            <style>{`
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
};

export default Partners;
