import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { FaUsers, FaSearch, FaArrowLeft } from 'react-icons/fa';
import { HiBuildingStorefront } from 'react-icons/hi2';

const MyCommunities = () => {
    const navigate = useNavigate();
    const { currentUser } = useAuth();
    const [communities, setCommunities] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        if (currentUser) {
            fetchMyCommunities();
        }
    }, [currentUser]);

    const fetchMyCommunities = async () => {
        try {
            setLoading(true);

            // Get user's joined communities
            const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
            const joinedCommunities = userDoc.data()?.joinedCommunities || [];

            if (joinedCommunities.length === 0) {
                setCommunities([]);
                setLoading(false);
                return;
            }

            // Fetch each community's details
            const communitiesData = await Promise.all(
                joinedCommunities.map(async (partnerId) => {
                    const partnerDoc = await getDoc(doc(db, 'users', partnerId));
                    if (partnerDoc.exists() && partnerDoc.data().accountType === 'business') {
                        const data = partnerDoc.data();
                        const businessInfo = data.businessInfo || {};

                        return {
                            id: partnerId,
                            name: businessInfo.businessName || 'Business',
                            logo: businessInfo.logoImage,
                            cover: businessInfo.coverImage,
                            type: businessInfo.businessType || 'Restaurant',
                            location: businessInfo.city || businessInfo.address,
                            memberCount: data.communityMembers?.length || 0,
                            // TODO: Add unread count and last message
                            unreadCount: 0,
                            lastMessage: null
                        };
                    }
                    return null;
                })
            );

            setCommunities(communitiesData.filter(c => c !== null));
        } catch (error) {
            console.error('Error fetching communities:', error);
        } finally {
            setLoading(false);
        }
    };

    const filteredCommunities = communities.filter(community =>
        community.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (loading) {
        return (
            <div className="page-container" style={{ padding: '2rem', textAlign: 'center' }}>
                <div style={{
                    width: '50px',
                    height: '50px',
                    border: '4px solid var(--border-color)',
                    borderTop: '4px solid var(--primary)',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite',
                    margin: '0 auto 1rem'
                }} />
                <p style={{ color: 'var(--text-muted)' }}>Loading communities...</p>
            </div>
        );
    }

    return (
        <div className="page-container" style={{ paddingBottom: '100px' }}>
            {/* Header */}
            <header className="app-header sticky-header-glass">
                <button className="back-btn" onClick={() => navigate('/')}>
                    <FaArrowLeft style={{ transform: 'rotate(180deg)' }} />
                </button>
                <div style={{ flex: 1, textAlign: 'center' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: '800', margin: 0 }}>
                        My Communities
                    </h3>
                </div>
                <div style={{ width: '40px' }}></div>
            </header>

            {/* Search Bar */}
            <div style={{ padding: '1rem 1.5rem' }}>
                <div style={{
                    position: 'relative',
                    background: 'var(--bg-card)',
                    borderRadius: '12px',
                    border: '1px solid var(--border-color)'
                }}>
                    <FaSearch style={{
                        position: 'absolute',
                        left: '1rem',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: 'var(--text-muted)',
                        fontSize: '0.9rem'
                    }} />
                    <input
                        type="text"
                        placeholder="Search communities..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={{
                            width: '100%',
                            padding: '12px 1rem 12px 3rem',
                            background: 'transparent',
                            border: 'none',
                            color: 'white',
                            fontSize: '0.95rem',
                            outline: 'none'
                        }}
                    />
                </div>
            </div>

            {/* Communities List */}
            <div style={{ padding: '0 1.5rem' }}>
                {filteredCommunities.length === 0 ? (
                    <div style={{
                        textAlign: 'center',
                        padding: '3rem 1rem',
                        color: 'var(--text-muted)'
                    }}>
                        <FaUsers style={{ fontSize: '4rem', marginBottom: '1rem', opacity: 0.3 }} />
                        <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>
                            {searchQuery ? 'No communities found' : 'No communities yet'}
                        </h3>
                        <p style={{ fontSize: '0.9rem' }}>
                            {searchQuery ? 'Try a different search' : 'Join communities from partner profiles'}
                        </p>
                        {!searchQuery && (
                            <button
                                onClick={() => navigate('/partners')}
                                style={{
                                    marginTop: '1.5rem',
                                    padding: '12px 24px',
                                    background: 'linear-gradient(135deg, var(--primary), #f97316)',
                                    border: 'none',
                                    borderRadius: '12px',
                                    color: 'white',
                                    fontWeight: '700',
                                    cursor: 'pointer'
                                }}
                            >
                                Explore Partners
                            </button>
                        )}
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {filteredCommunities.map(community => (
                            <div
                                key={community.id}
                                onClick={() => navigate(`/community/${community.id}`)}
                                style={{
                                    background: 'var(--bg-card)',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: '16px',
                                    padding: '1rem',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    display: 'flex',
                                    gap: '1rem',
                                    alignItems: 'center'
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.background = 'rgba(139, 92, 246, 0.1)';
                                    e.currentTarget.style.borderColor = 'var(--primary)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.background = 'var(--bg-card)';
                                    e.currentTarget.style.borderColor = 'var(--border-color)';
                                }}
                            >
                                {/* Logo */}
                                <div style={{
                                    width: '60px',
                                    height: '60px',
                                    borderRadius: '12px',
                                    background: community.logo
                                        ? `url(${community.logo})`
                                        : 'linear-gradient(135deg, var(--primary), #f97316)',
                                    backgroundSize: 'cover',
                                    backgroundPosition: 'center',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '1.5rem',
                                    flexShrink: 0
                                }}>
                                    {!community.logo && '🏪'}
                                </div>

                                {/* Info */}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <h3 style={{
                                        fontSize: '1rem',
                                        fontWeight: '800',
                                        marginBottom: '4px',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap'
                                    }}>
                                        {community.name}
                                    </h3>
                                    <p style={{
                                        fontSize: '0.85rem',
                                        color: 'var(--text-muted)',
                                        marginBottom: '4px'
                                    }}>
                                        {community.memberCount} members
                                    </p>
                                    {community.lastMessage && (
                                        <p style={{
                                            fontSize: '0.8rem',
                                            color: 'var(--text-secondary)',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap'
                                        }}>
                                            {community.lastMessage}
                                        </p>
                                    )}
                                </div>

                                {/* Unread Badge */}
                                {community.unreadCount > 0 && (
                                    <div style={{
                                        minWidth: '24px',
                                        height: '24px',
                                        borderRadius: '12px',
                                        background: 'var(--primary)',
                                        color: 'white',
                                        fontSize: '0.75rem',
                                        fontWeight: '700',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        padding: '0 6px'
                                    }}>
                                        {community.unreadCount > 99 ? '99+' : community.unreadCount}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default MyCommunities;
