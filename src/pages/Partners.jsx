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
    const [viewMode, setViewMode] = useState('list');
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
        <div className="home-page" style={{ minHeight: '100vh', paddingBottom: '100px', animation: 'fadeIn 0.5s ease-out' }}>
            {/* Header Area matching Home.jsx */}
            <div className="home-header">
                <div className="top-row">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                        <button
                            className="back-btn"
                            onClick={() => navigate(-1)}
                            style={{ width: '40px', height: '40px' }}
                        >
                            <FaArrowLeft />
                        </button>
                        <h1 className="header-title">Partners</h1>
                    </div>
                    {/* View Mode Toggle */}
                    <div className="view-mode-toggle">
                        <button onClick={() => setViewMode('list')} className={viewMode === 'list' ? 'active' : ''}>List</button>
                        <button onClick={() => setViewMode('map')} className={viewMode === 'map' ? 'active' : ''}>Map</button>
                    </div>
                </div>

                {/* Unified Search & Filter Row */}
                <div className="search-container" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                        <input
                            type="text"
                            placeholder="Search partners..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="search-input"
                        />
                        <FaSearch className="search-icon" />
                    </div>
                    <select
                        value={filterType}
                        onChange={(e) => setFilterType(e.target.value)}
                        style={{
                            background: 'var(--bg-card)',
                            color: 'white',
                            border: '1px solid var(--border-color)',
                            borderRadius: '16px',
                            height: '50px',
                            padding: '0 16px',
                            minWidth: '90px',
                            fontSize: '0.75rem',
                            fontWeight: '600',
                            outline: 'none',
                            cursor: 'pointer'
                        }}
                    >
                        {businessTypes.map(type => (
                            <option key={type} value={type}>
                                {type}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Content Area */}
            <div style={{ padding: '0 1.25rem' }}>
                {/* Debug Info */}

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

                {/* Business Cards Grid or Map */}
                {!loading && filteredBusinesses.length > 0 && (
                    <>
                        {viewMode === 'map' ? (
                            <div style={{
                                height: '600px',
                                background: 'var(--bg-card)',
                                borderRadius: '24px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                border: '1px solid var(--border-color)',
                                flexDirection: 'column',
                                gap: '1rem'
                            }}>
                                <div style={{ fontSize: '3rem' }}>🗺️</div>
                                <h3 style={{ color: 'var(--text-muted)' }}>Map View Available Soon</h3>
                                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>We are populating business locations.</p>
                            </div>
                        ) : (
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
                    </>
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
