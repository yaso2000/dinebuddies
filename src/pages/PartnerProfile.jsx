import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config';
import { FaArrowLeft, FaPhone, FaMapMarkerAlt, FaClock, FaGlobe, FaShareAlt, FaUserPlus, FaUsers } from 'react-icons/fa';
import { HiBuildingStorefront } from 'react-icons/hi2';
import SimpleMap from '../components/SimpleMap';
import { useAuth } from '../context/AuthContext';
import { joinCommunity, leaveCommunity, isCommunityMember, getCommunityMemberCount } from '../utils/communityHelpers';
import { ServiceIcon } from '../utils/serviceIcons.jsx';
import CommunityManagement from '../components/CommunityManagement';

const PartnerProfile = () => {
    const { partnerId } = useParams();
    const navigate = useNavigate();
    const { currentUser, userProfile } = useAuth();
    const [partner, setPartner] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('about');
    const [isMember, setIsMember] = useState(false);
    const [memberCount, setMemberCount] = useState(0);
    const [joiningCommunity, setJoiningCommunity] = useState(false);
    const [activeInvitationsCount, setActiveInvitationsCount] = useState(0);

    const days = [
        { key: 'sunday', label: 'Sunday' },
        { key: 'monday', label: 'Monday' },
        { key: 'tuesday', label: 'Tuesday' },
        { key: 'wednesday', label: 'Wednesday' },
        { key: 'thursday', label: 'Thursday' },
        { key: 'friday', label: 'Friday' },
        { key: 'saturday', label: 'Saturday' }
    ];

    useEffect(() => {
        fetchPartner();
    }, [partnerId]);

    useEffect(() => {
        const loadAllData = async () => {
            if (currentUser && partnerId) {
                // Fetch all data in parallel
                await Promise.all([
                    checkMembership(),
                    fetchMemberCount(),
                    fetchActiveInvitations()
                ]);
            }
        };

        loadAllData();
    }, [currentUser, partnerId, partner]);

    const fetchPartner = async () => {
        try {
            setLoading(true);
            const docRef = doc(db, 'users', partnerId);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists() && docSnap.data().accountType === 'business') {
                setPartner({ uid: docSnap.id, ...docSnap.data() });
            } else {
                console.error('Partner not found or not a business account');
            }
        } catch (error) {
            console.error('Error fetching partner:', error);
        } finally {
            setLoading(false);
        }
    };

    const checkMembership = async () => {
        const memberStatus = await isCommunityMember(currentUser.uid, partnerId);
        setIsMember(memberStatus);
    };

    const fetchMemberCount = async () => {
        console.log('📊 Fetching member count for:', partnerId);
        const count = await getCommunityMemberCount(partnerId);
        console.log('✅ Member count:', count);
        setMemberCount(count);
    };

    const fetchActiveInvitations = async () => {
        try {
            console.log('📋 Fetching active invitations for:', partnerId);
            const invitationsRef = collection(db, 'invitations');
            const q = query(
                invitationsRef,
                where('restaurantId', '==', partnerId)
            );
            const snapshot = await getDocs(q);

            // Filter for active invitations (not expired)
            const now = new Date();
            const activeInvitations = snapshot.docs.filter(doc => {
                const data = doc.data();
                const inviteDate = new Date(`${data.date}T${data.time}`);
                return inviteDate > now;
            });

            console.log('✅ Active invitations count:', activeInvitations.length);
            setActiveInvitationsCount(activeInvitations.length);
        } catch (error) {
            console.error('❌ Error fetching active invitations:', error);
            setActiveInvitationsCount(0);
        }
    };


    const handleJoinCommunity = async () => {
        if (!currentUser) {
            navigate('/login');
            return;
        }

        setJoiningCommunity(true);
        try {
            if (isMember) {
                await leaveCommunity(currentUser.uid, partnerId);
                setIsMember(false);
                setMemberCount(prev => prev - 1);
            } else {
                await joinCommunity(currentUser.uid, partnerId);
                setIsMember(true);
                setMemberCount(prev => prev + 1);
            }
            // Re-check membership to ensure consistency
            await checkMembership();
            await fetchMemberCount();
        } catch (error) {
            console.error('Error toggling community membership:', error);
            // Revert state on error
            await checkMembership();
            await fetchMemberCount();
        } finally {
            setJoiningCommunity(false);
        }
    };

    const handleCreateInvitation = () => {
        if (!currentUser) {
            navigate('/login');
            return;
        }

        const businessInfo = partner.businessInfo || {};

        // Navigate to create invitation with pre-filled data
        navigate('/create', {
            state: {
                prefilledData: {
                    restaurantName: businessInfo.businessName,
                    restaurantImage: businessInfo.coverImage,
                    location: businessInfo.address,
                    city: businessInfo.city,
                    lat: businessInfo.lat,
                    lng: businessInfo.lng
                }
            }
        });
    };

    const handleBookInvitation = () => {
        if (!currentUser) {
            navigate('/login');
            return;
        }

        // Navigate to partner's community/invitations page
        navigate(`/partner/${partnerId}/invitations`);
    };

    const formatTime = (time) => {
        if (!time) return '';
        const [hours, minutes] = time.split(':');
        const hour = parseInt(hours);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour % 12 || 12;
        return `${displayHour}:${minutes} ${ampm}`;
    };

    const handleShare = async () => {
        const shareData = {
            title: businessInfo.businessName || 'Business Profile',
            text: `Check out ${businessInfo.businessName || 'this business'} on DineBuddies!`,
            url: window.location.href
        };

        try {
            if (navigator.share) {
                await navigator.share(shareData);
            } else {
                await navigator.clipboard.writeText(window.location.href);
                alert('Link copied!');
            }
        } catch (err) {
            console.error('Error sharing:', err);
        }
    };

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
                <p style={{ color: 'var(--text-muted)' }}>Loading...</p>
            </div>
        );
    }

    if (!partner) {
        return (
            <div className="page-container" style={{ padding: '2rem', textAlign: 'center' }}>
                <HiBuildingStorefront style={{ fontSize: '4rem', color: 'var(--primary)', marginBottom: '1rem' }} />
                <h2>Partner not found</h2>
                <button onClick={() => navigate('/partners')} className="btn btn-primary" style={{ marginTop: '1.5rem' }}>
                    Back to Partners
                </button>
            </div>
        );
    }

    const businessInfo = partner.businessInfo || {};

    return (
        <div className="page-container" style={{ paddingBottom: '100px' }}>
            {/* Header */}
            <header className="app-header sticky-header-glass">
                <button className="back-btn" onClick={() => navigate('/partners')}>
                    <FaArrowLeft style={{ transform: 'rotate(180deg)' }} />
                </button>
                <div style={{ flex: 1, textAlign: 'center' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: '800', margin: 0 }}>
                        {businessInfo.businessType || 'Business'}
                    </h3>
                </div>
                <div style={{ width: '40px' }}></div>
            </header>

            {/* Same content as BusinessProfile but without Edit button */}
            {/* Cover Image */}
            <div style={{
                position: 'relative',
                width: '100%',
                height: '250px',
                background: businessInfo.coverImage
                    ? `url(${businessInfo.coverImage})`
                    : 'linear-gradient(135deg, rgba(139, 92, 246, 0.3), rgba(236, 72, 153, 0.3))',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                marginTop: '-1rem'
            }}>
                <div style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.7) 100%)'
                }} />

                {/* Logo */}
                <div style={{
                    position: 'absolute',
                    bottom: '-40px',
                    left: '1.5rem',
                    width: '100px',
                    height: '100px',
                    background: businessInfo.logoImage
                        ? `url(${businessInfo.logoImage})`
                        : 'linear-gradient(135deg, var(--primary), #f97316)',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    borderRadius: '20px',
                    border: '4px solid var(--bg-body)',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '2.5rem'
                }}>
                    {!businessInfo.logoImage && '🏪'}
                </div>
            </div>

            {/* Business Info */}
            <div style={{
                padding: '3rem 1.5rem 1.5rem',
                borderBottom: '1px solid var(--border-color)'
            }}>
                <h1 style={{
                    fontSize: '1.8rem',
                    fontWeight: '900',
                    marginBottom: '0.5rem',
                    color: 'white'
                }}>
                    {businessInfo.businessName || 'Business Name'}
                </h1>

                {businessInfo.tagline && (
                    <p style={{
                        fontSize: '0.95rem',
                        color: 'var(--text-secondary)',
                        marginBottom: '0.75rem',
                        fontStyle: 'italic'
                    }}>
                        {businessInfo.tagline}
                    </p>
                )}

                <div style={{
                    display: 'inline-block',
                    padding: '6px 16px',
                    background: 'rgba(139, 92, 246, 0.2)',
                    border: '1px solid rgba(139, 92, 246, 0.3)',
                    borderRadius: '20px',
                    fontSize: '0.85rem',
                    fontWeight: '600',
                    color: 'var(--primary)',
                    marginBottom: '1.25rem'
                }}>
                    {businessInfo.businessType || 'Restaurant'}
                </div>

                {/* Social Media */}
                {businessInfo.socialMedia && (Object.values(businessInfo.socialMedia).some(v => v)) && (
                    <div style={{
                        display: 'flex',
                        gap: '12px',
                        marginBottom: '1.25rem',
                        flexWrap: 'wrap'
                    }}>
                        {businessInfo.socialMedia.instagram && (
                            <div style={{
                                padding: '8px 16px',
                                background: 'rgba(225, 48, 108, 0.1)',
                                border: '1px solid rgba(225, 48, 108, 0.3)',
                                borderRadius: '12px',
                                color: '#E1306C',
                                fontSize: '0.85rem',
                                fontWeight: '600',
                                opacity: 0.7
                            }}>
                                📷 {businessInfo.socialMedia.instagram}
                            </div>
                        )}
                    </div>
                )}

                {/* Action Buttons */}
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    marginTop: '1rem'
                }}>
                    {/* Join Community Button - Only show if not the owner */}
                    {currentUser?.uid !== partnerId ? (
                        <button
                            onClick={handleJoinCommunity}
                            disabled={joiningCommunity}
                            style={{
                                padding: '14px',
                                background: isMember
                                    ? 'var(--bg-card)'
                                    : 'linear-gradient(135deg, var(--primary), #f97316)',
                                border: isMember ? '1px solid var(--border-color)' : 'none',
                                borderRadius: '12px',
                                color: 'white',
                                fontWeight: '700',
                                fontSize: '0.95rem',
                                cursor: joiningCommunity ? 'not-allowed' : 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px',
                                transition: 'all 0.2s',
                                opacity: joiningCommunity ? 0.6 : 1
                            }}
                        >
                            <FaUsers />
                            {joiningCommunity
                                ? 'Processing...'
                                : isMember
                                    ? `Joined (${memberCount} members)`
                                    : `Join Community (${memberCount} members)`
                            }
                        </button>
                    ) : (
                        <div style={{
                            padding: '14px',
                            background: 'var(--bg-card)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '12px',
                            color: 'var(--text-primary)',
                            fontWeight: '700',
                            fontSize: '0.95rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px'
                        }}>
                            <FaUsers />
                            Your Community ({memberCount} members)
                        </div>
                    )}

                    {/* Create Invitation Button - Only for non-owners */}
                    {currentUser?.uid !== partnerId ? (
                        <button
                            onClick={handleCreateInvitation}
                            style={{
                                padding: '14px',
                                background: 'var(--bg-card)',
                                border: '1px solid var(--border-color)',
                                borderRadius: '12px',
                                color: 'white',
                                fontWeight: '700',
                                fontSize: '0.9rem',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px',
                                transition: 'all 0.2s'
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
                            <FaUserPlus />
                            Create Invitation Here
                        </button>
                    ) : (
                        <div style={{
                            padding: '14px',
                            background: 'var(--bg-card)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '12px',
                            color: 'var(--text-primary)',
                            fontWeight: '700',
                            fontSize: '0.95rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px'
                        }}>
                            <FaUserPlus />
                            {activeInvitationsCount} Active Invitation{activeInvitationsCount !== 1 ? 's' : ''}
                        </div>
                    )}
                </div>
            </div>

            {/* Tabs - Same as BusinessProfile */}
            <div style={{
                display: 'flex',
                gap: '8px',
                padding: '1rem 1.5rem',
                borderBottom: '1px solid var(--border-color)',
                overflowX: 'auto',
                WebkitOverflowScrolling: 'touch'
            }}>
                {['about', 'services', 'hours', 'contact'].map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        style={{
                            padding: '10px 20px',
                            background: activeTab === tab ? 'var(--primary)' : 'transparent',
                            border: activeTab === tab ? 'none' : '1px solid var(--border-color)',
                            color: 'white',
                            borderRadius: '12px',
                            cursor: 'pointer',
                            fontWeight: '700',
                            fontSize: '0.85rem',
                            whiteSpace: 'nowrap',
                            transition: 'all 0.2s'
                        }}
                    >
                        {tab === 'about' ? 'About' : tab === 'services' ? 'Services' : tab === 'hours' ? 'Hours' : 'Contact'}
                    </button>
                ))}
            </div>

            {/* Content - Copy from BusinessProfile */}
            <div style={{ padding: '1.5rem' }}>
                {activeTab === 'about' && (
                    <div>
                        <h3 style={{ fontSize: '1.2rem', fontWeight: '800', marginBottom: '1rem' }}>
                            About the Business
                        </h3>
                        {businessInfo.description ? (
                            <p style={{
                                color: 'var(--text-secondary)',
                                lineHeight: '1.8',
                                fontSize: '0.95rem'
                            }}>
                                {businessInfo.description}
                            </p>
                        ) : (
                            <p style={{ color: 'var(--text-muted)' }}>No description available</p>
                        )}
                    </div>
                )}

                {/* Services Tab */}
                {activeTab === 'services' && (
                    <div>
                        <h3 style={{ fontSize: '1.2rem', fontWeight: '800', marginBottom: '1rem' }}>
                            Services & Menu
                        </h3>
                        {businessInfo.services && businessInfo.services.length > 0 ? (
                            <div style={{ display: 'grid', gap: '12px' }}>
                                {businessInfo.services.map((service, index) => (
                                    <div key={index} style={{
                                        background: 'var(--bg-card)',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: '16px',
                                        overflow: 'hidden',
                                        transition: 'transform 0.2s, box-shadow 0.2s'
                                    }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.transform = 'translateY(-2px)';
                                            e.currentTarget.style.boxShadow = '0 8px 20px rgba(139, 92, 246, 0.2)';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.transform = 'translateY(0)';
                                            e.currentTarget.style.boxShadow = 'none';
                                        }}>
                                        <div style={{ display: 'flex', gap: '1rem' }}>
                                            {/* Icon or Image */}
                                            <div style={{
                                                width: '100px',
                                                minWidth: '100px',
                                                height: '100px',
                                                background: service.image
                                                    ? `url(${service.image})`
                                                    : 'linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(244, 63, 94, 0.1) 100%)',
                                                backgroundSize: 'cover',
                                                backgroundPosition: 'center',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                borderRight: '1px solid var(--border-color)'
                                            }}>
                                                {!service.image && service.icon && (
                                                    <ServiceIcon iconId={service.icon} size={40} />
                                                )}
                                                {!service.image && !service.icon && (
                                                    <span style={{ fontSize: '2.5rem' }}>🍽️</span>
                                                )}
                                            </div>

                                            {/* Content */}
                                            <div style={{ flex: 1, padding: '1rem' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.5rem' }}>
                                                    <h4 style={{ fontSize: '1.05rem', fontWeight: '800', margin: 0 }}>
                                                        {service.name}
                                                    </h4>
                                                    <span style={{
                                                        fontSize: '1.2rem',
                                                        fontWeight: '900',
                                                        color: 'var(--primary)',
                                                        whiteSpace: 'nowrap',
                                                        marginLeft: '1rem'
                                                    }}>
                                                        {service.price} {service.currency || 'SAR'}
                                                    </span>
                                                </div>
                                                {service.description && (
                                                    <p style={{
                                                        color: 'var(--text-muted)',
                                                        fontSize: '0.85rem',
                                                        marginBottom: '0.75rem',
                                                        lineHeight: '1.5'
                                                    }}>
                                                        {service.description}
                                                    </p>
                                                )}
                                                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                                    {service.category && (
                                                        <span style={{
                                                            display: 'inline-block',
                                                            padding: '4px 10px',
                                                            background: 'rgba(139, 92, 246, 0.15)',
                                                            border: '1px solid rgba(139, 92, 246, 0.3)',
                                                            borderRadius: '8px',
                                                            fontSize: '0.75rem',
                                                            fontWeight: '600',
                                                            color: 'var(--primary)'
                                                        }}>
                                                            {service.category}
                                                        </span>
                                                    )}
                                                    {service.isPopular && (
                                                        <span style={{
                                                            display: 'inline-block',
                                                            padding: '4px 10px',
                                                            background: 'rgba(251, 191, 36, 0.15)',
                                                            border: '1px solid rgba(251, 191, 36, 0.3)',
                                                            borderRadius: '8px',
                                                            fontSize: '0.75rem',
                                                            fontWeight: '600',
                                                            color: '#f59e0b'
                                                        }}>
                                                            ⭐ Popular
                                                        </span>
                                                    )}
                                                    {service.isNew && (
                                                        <span style={{
                                                            display: 'inline-block',
                                                            padding: '4px 10px',
                                                            background: 'rgba(16, 185, 129, 0.15)',
                                                            border: '1px solid rgba(16, 185, 129, 0.3)',
                                                            borderRadius: '8px',
                                                            fontSize: '0.75rem',
                                                            fontWeight: '600',
                                                            color: '#10b981'
                                                        }}>
                                                            🆕 New
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                No services added yet.
                            </p>
                        )}
                    </div>
                )}

                {/* Hours Tab */}
                {activeTab === 'hours' && (
                    <div>
                        <h3 style={{ fontSize: '1.2rem', fontWeight: '800', marginBottom: '1rem' }}>
                            Working Hours
                        </h3>
                        <div style={{ display: 'grid', gap: '12px' }}>
                            {days.map(day => {
                                const hours = businessInfo.workingHours?.[day.key];
                                const isOpen = hours?.isOpen;
                                return (
                                    <div key={day.key} style={{
                                        background: 'var(--bg-card)',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: '12px',
                                        padding: '1rem',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center'
                                    }}>
                                        <span style={{ fontWeight: '700', textTransform: 'capitalize' }}>{day.label}</span>
                                        <span style={{ color: isOpen ? 'var(--text-secondary)' : 'var(--text-muted)' }}>
                                            {isOpen ? `${formatTime(hours.open)} - ${formatTime(hours.close)}` : 'Closed'}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Contact Tab */}
                {activeTab === 'contact' && (
                    <div>
                        <h3 style={{ fontSize: '1.2rem', fontWeight: '800', marginBottom: '1rem' }}>
                            Contact Information
                        </h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {businessInfo.phone && (
                                <div style={{
                                    background: 'var(--bg-card)',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: '12px',
                                    padding: '1.25rem',
                                    display: 'flex', alignItems: 'center', gap: '1rem'
                                }}>
                                    <div style={{ width: '50px', height: '50px', borderRadius: '12px', background: 'rgba(34,197,94,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#22c55e', fontSize: '1.3rem' }}><FaPhone /></div>
                                    <div><div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Phone</div><div style={{ fontWeight: '700' }}>{businessInfo.phone}</div></div>
                                </div>
                            )}
                            {businessInfo.address && (
                                <div style={{
                                    background: 'var(--bg-card)',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: '12px',
                                    padding: '1.25rem',
                                    display: 'flex', alignItems: 'center', gap: '1rem'
                                }}>
                                    <div style={{ width: '50px', height: '50px', borderRadius: '12px', background: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444', fontSize: '1.3rem' }}><FaMapMarkerAlt /></div>
                                    <div><div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Address</div><div style={{ fontWeight: '700' }}>{businessInfo.address} {businessInfo.city && `, ${businessInfo.city}`}</div></div>
                                </div>
                            )}

                            {/* Embedded Map */}
                            {businessInfo.lat && businessInfo.lng && (
                                <div style={{
                                    height: '300px',
                                    borderRadius: '16px',
                                    overflow: 'hidden',
                                    border: '2px solid var(--border-color)',
                                    marginTop: '1rem',
                                    position: 'relative',
                                    zIndex: 0
                                }}>
                                    <SimpleMap
                                        lat={businessInfo.lat}
                                        lng={businessInfo.lng}
                                        businessName={businessInfo.businessName}
                                        address={businessInfo.address}
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Community Management - Only visible to partner owner */}
                {(() => {
                    const userId = currentUser?.uid || userProfile?.id;
                    const isOwner = userId === partnerId;
                    const isBusiness = userProfile?.accountType === 'business';
                    const shouldShow = isOwner && isBusiness;

                    console.log('🔍 Community Management Visibility Check:', {
                        userId,
                        partnerId,
                        isOwner,
                        accountType: userProfile?.accountType,
                        isBusiness,
                        shouldShow
                    });

                    return shouldShow;
                })() && (
                        <CommunityManagement
                            partnerId={partnerId}
                            partnerName={businessInfo?.businessName || 'Business'}
                            currentUserId={currentUser?.uid || userProfile?.id}
                        />
                    )}

            </div>
        </div>
    );
};

export default PartnerProfile;
