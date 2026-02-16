import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { useInvitations } from '../context/InvitationContext';
import { FaUsers, FaSearch, FaArrowLeft, FaTrash } from 'react-icons/fa';
import { HiBuildingStorefront } from 'react-icons/hi2';
import EmptyState from '../components/EmptyState';

const MyCommunities = () => {
    const navigate = useNavigate();
    const { currentUser, userProfile } = useAuth();
    const { leaveCommunity } = useInvitations();
    const [communities, setCommunities] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    // Redirect guests to login & business accounts to their dashboard
    useEffect(() => {
        if (userProfile?.accountType === 'guest' || userProfile?.role === 'guest') {
            navigate('/login');
        } else if (userProfile?.accountType === 'business') {
            navigate('/business-dashboard'); // Or '/my-community' if that's their dedicated page
        }
    }, [userProfile, navigate]);

    useEffect(() => {
        if (currentUser && currentUser.uid) {
            fetchMyCommunities();
        }
    }, [currentUser]);

    const fetchMyCommunities = async () => {
        try {
            setLoading(true);

            // Get user's joined communities
            const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
            const joinedCommunities = userDoc.data()?.joinedCommunities || [];
            const lastReadTimestamps = userDoc.data()?.communityLastRead || {};

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

                        // Fetch unread messages count
                        const messagesRef = collection(db, 'communities', partnerId, 'messages');
                        let lastReadTime = new Date(0);
                        const rawLastRead = lastReadTimestamps[partnerId];

                        if (rawLastRead) {
                            if (typeof rawLastRead.toDate === 'function') {
                                lastReadTime = rawLastRead.toDate();
                            } else if (rawLastRead instanceof Date) {
                                lastReadTime = rawLastRead;
                            } else {
                                const d = new Date(rawLastRead);
                                if (!isNaN(d.getTime())) {
                                    lastReadTime = d;
                                }
                            }
                        }

                        // Get all messages after last read
                        const messagesSnapshot = await getDocs(messagesRef);
                        let unreadCount = 0;
                        let lastMessage = null;
                        let lastMessageTime = null;

                        messagesSnapshot.forEach((msgDoc) => {
                            const msgData = msgDoc.data();
                            const msgTime = msgData.createdAt?.toDate() || new Date(0);

                            // Count unread messages (not from current user)
                            if (msgTime > lastReadTime && msgData.senderId !== currentUser.uid) {
                                unreadCount++;
                            }

                            // Track last message
                            if (!lastMessageTime || msgTime > lastMessageTime) {
                                lastMessageTime = msgTime;
                                lastMessage = msgData.text || msgData.message || '';
                            }
                        });

                        return {
                            id: partnerId,
                            name: businessInfo.businessName || data.display_name || data.name || 'Business',
                            logo: businessInfo.logoImage || data.photo_url || data.photoURL,
                            cover: businessInfo.coverImage || data.cover_url || data.coverImage,
                            type: businessInfo.businessType || data.business_type || 'Restaurant',
                            location: businessInfo.city || businessInfo.address || data.city || data.address || '',
                            memberCount: data.communityMembers?.length || 0,
                            unreadCount: unreadCount,
                            lastMessage: lastMessage ? (lastMessage.length > 40 ? lastMessage.substring(0, 40) + '...' : lastMessage) : null
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

    const handleLeaveCommunity = async (partnerId, communityName) => {
        if (window.confirm(`Are you sure you want to leave ${communityName}?`)) {
            try {
                const success = await leaveCommunity(partnerId);
                if (success) {
                    // Update list locally
                    setCommunities(prev => prev.filter(c => c.id !== partnerId));
                }
            } catch (error) {
                console.error("Error leaving community:", error);
            }
        }
    };

    const filteredCommunities = communities.filter(community =>
        community.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Guest check - Don't render anything for guests
    const isGuest = userProfile?.accountType === 'guest' || userProfile?.role === 'guest';
    if (isGuest) {
        return null; // Redirect will happen via useEffect
    }

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
            {/* Minimal Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '12px 12px 2px' }}>
                <button
                    onClick={() => navigate(-1)}
                    style={{
                        background: 'none',
                        border: 'none',
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        fontSize: '1.1rem',
                        cursor: 'pointer',
                        padding: '4px'
                    }}
                >
                    <FaArrowLeft />
                </button>
                <h2 style={{ fontSize: '1.2rem', fontWeight: '800', margin: 0 }}>My Communities</h2>
            </div>

            {/* Search Bar */}
            <div style={{ padding: '6px 12px 12px' }}>
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
            <div style={{ padding: '0 12px' }}>
                {filteredCommunities.length === 0 ? (
                    <EmptyState
                        icon={FaUsers}
                        title={searchQuery ? 'No communities found' : 'No communities yet'}
                        message={searchQuery ? 'Try a different search' : 'Join communities from partner profiles'}
                        actionText={!searchQuery ? 'Explore Partners' : null}
                        onAction={!searchQuery ? () => navigate('/restaurants') : null}
                        variant="primary"
                    />
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
                                    color: 'white',
                                    fontWeight: 'bold',
                                    flexShrink: 0
                                }}>
                                    {community.logo ? '' : (community.name ? community.name.charAt(0).toUpperCase() : '🏪')}
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

                                {/* Actions Row */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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

                                    {/* Delete/Leave Button */}
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleLeaveCommunity(community.id, community.name);
                                        }}
                                        style={{
                                            background: 'rgba(239, 68, 68, 0.1)',
                                            color: '#ef4444',
                                            border: 'none',
                                            borderRadius: '8px',
                                            width: '32px',
                                            height: '32px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s',
                                            zIndex: 10
                                        }}
                                        title="Leave Community"
                                    >
                                        <FaTrash size={14} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default MyCommunities;
