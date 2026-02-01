import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaArrowLeft, FaPhone, FaMapMarkerAlt, FaClock, FaEdit, FaGlobe, FaShareAlt, FaEnvelope, FaInstagram, FaTwitter, FaFacebook } from 'react-icons/fa';
import { HiBuildingStorefront } from 'react-icons/hi2';
import { useAuth } from '../context/AuthContext';
import SimpleMap from '../components/SimpleMap';

const BusinessProfile = () => {
    const navigate = useNavigate();
    const { currentUser, userProfile } = useAuth();
    const [activeTab, setActiveTab] = useState('about');

    if (!userProfile || userProfile.accountType !== 'business') {
        return (
            <div className="page-container" style={{ padding: '2rem', textAlign: 'center' }}>
                <HiBuildingStorefront style={{ fontSize: '4rem', color: 'var(--primary)', marginBottom: '1rem' }} />
                <h2>This account is not a business account</h2>
                <button onClick={() => navigate('/')} className="btn btn-primary" style={{ marginTop: '1.5rem' }}>
                    Back to Home
                </button>
            </div>
        );
    }

    const businessInfo = userProfile.businessInfo || {};
    const hasBasicInfo = businessInfo.businessName;

    if (!hasBasicInfo) {
        return (
            <div className="page-container" style={{ padding: '2rem', textAlign: 'center' }}>
                <HiBuildingStorefront style={{ fontSize: '4rem', color: 'var(--primary)', marginBottom: '1rem' }} />
                <h2>Complete Your Business Profile</h2>
                <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>
                    Set up your business profile to start receiving invitations and connecting with customers.
                </p>
                <button onClick={() => navigate('/edit-business-profile')} className="btn btn-primary">
                    <FaEdit /> Set Up Profile
                </button>
            </div>
        );
    }

    const formatTime = (time) => {
        if (!time) return '';
        const [hours, minutes] = time.split(':');
        const hour = parseInt(hours);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour % 12 || 12;
        return `${displayHour}:${minutes} ${ampm}`;
    };

    const getDayStatus = (dayKey) => {
        const hours = businessInfo.workingHours?.[dayKey];
        if (!hours || !hours.isOpen) return 'Closed';
        return `${formatTime(hours.open)} - ${formatTime(hours.close)}`;
    };

    const shareProfile = async () => {
        const url = `${window.location.origin}/partner/${currentUser.uid}`;
        if (navigator.share) {
            try {
                await navigator.share({
                    title: businessInfo.businessName,
                    text: businessInfo.tagline || 'Check out my business!',
                    url: url
                });
            } catch (err) {
                console.log('Share cancelled');
            }
        } else {
            navigator.clipboard.writeText(url);
            alert('Profile link copied to clipboard!');
        }
    };

    return (
        <div className="page-container" style={{ paddingBottom: '2rem', background: 'var(--bg-body)' }}>
            {/* Header */}
            <header className="app-header sticky-header-glass">
                <button className="back-btn" onClick={() => navigate(-1)}>
                    <FaArrowLeft style={{ transform: 'rotate(180deg)' }} />
                </button>
                <h3 style={{ fontSize: '1rem', fontWeight: '800', margin: 0 }}>
                    Business Profile
                </h3>
                <button className="back-btn" onClick={() => navigate('/edit-business-profile')}>
                    <FaEdit />
                </button>
            </header>

            {/* Cover & Logo */}
            <div style={{ position: 'relative', marginBottom: '3rem' }}>
                {/* Cover Image */}
                <div style={{
                    height: '200px',
                    overflow: 'hidden',
                    background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.3), rgba(236, 72, 153, 0.3))'
                }}>
                    {businessInfo.coverImage && (
                        <img
                            src={businessInfo.coverImage}
                            alt="Cover"
                            style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover',
                                objectPosition: 'center'
                            }}
                        />
                    )}
                </div>

                {/* Logo */}
                <div style={{
                    position: 'absolute',
                    bottom: '-40px',
                    left: '1.5rem',
                    width: '100px',
                    height: '100px',
                    borderRadius: '20px',
                    border: '4px solid var(--bg-body)',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                    overflow: 'hidden',
                    background: 'linear-gradient(135deg, var(--primary), #f97316)'
                }}>
                    {businessInfo.logoImage ? (
                        <img
                            src={businessInfo.logoImage}
                            alt="Logo"
                            style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover',
                                objectPosition: 'center'
                            }}
                        />
                    ) : (
                        <div style={{
                            width: '100%',
                            height: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '2.5rem'
                        }}>
                            🏪
                        </div>
                    )}
                </div>
            </div>

            {/* Business Info */}
            <div style={{ padding: '0 1.5rem', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1rem' }}>
                    <div style={{ flex: 1 }}>
                        <h1 style={{ fontSize: '1.5rem', fontWeight: '800', marginBottom: '0.5rem' }}>
                            {businessInfo.businessName}
                        </h1>
                        {businessInfo.tagline && (
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginBottom: '0.5rem' }}>
                                {businessInfo.tagline}
                            </p>
                        )}
                        <span style={{
                            display: 'inline-block',
                            padding: '4px 12px',
                            background: 'rgba(139, 92, 246, 0.1)',
                            border: '1px solid rgba(139, 92, 246, 0.3)',
                            borderRadius: '8px',
                            fontSize: '0.85rem',
                            color: 'var(--primary)',
                            fontWeight: '600'
                        }}>
                            {businessInfo.businessType}
                        </span>
                    </div>
                    <button
                        onClick={shareProfile}
                        style={{
                            background: 'var(--bg-card)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '12px',
                            padding: '10px',
                            color: 'white',
                            cursor: 'pointer',
                            fontSize: '1.2rem'
                        }}
                    >
                        <FaShareAlt />
                    </button>
                </div>

                {/* Quick Contact Info */}
                <div style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '16px',
                    padding: '1rem',
                    display: 'grid',
                    gap: '12px'
                }}>
                    {businessInfo.phone && (
                        <a href={`tel:${businessInfo.phone}`} style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            color: 'white',
                            textDecoration: 'none',
                            padding: '8px',
                            borderRadius: '8px',
                            transition: 'background 0.2s'
                        }}
                            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(139, 92, 246, 0.1)'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                        >
                            <FaPhone style={{ color: 'var(--primary)', fontSize: '1.1rem' }} />
                            <span>{businessInfo.phone}</span>
                        </a>
                    )}

                    {businessInfo.email && (
                        <a href={`mailto:${businessInfo.email}`} style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            color: 'white',
                            textDecoration: 'none',
                            padding: '8px',
                            borderRadius: '8px',
                            transition: 'background 0.2s'
                        }}
                            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(139, 92, 246, 0.1)'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                        >
                            <FaEnvelope style={{ color: 'var(--primary)', fontSize: '1.1rem' }} />
                            <span>{businessInfo.email}</span>
                        </a>
                    )}

                    {businessInfo.website && (
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            color: 'var(--text-secondary)',
                            padding: '8px',
                            borderRadius: '8px'
                        }}>
                            <FaGlobe style={{ color: 'var(--primary)', fontSize: '1.1rem' }} />
                            <span style={{ fontSize: '0.9rem' }}>{businessInfo.website}</span>
                        </div>
                    )}

                    {(businessInfo.address || businessInfo.city) && (
                        <div style={{
                            display: 'flex',
                            alignItems: 'start',
                            gap: '12px',
                            padding: '8px'
                        }}>
                            <FaMapMarkerAlt style={{ color: 'var(--primary)', fontSize: '1.1rem', marginTop: '2px' }} />
                            <div>
                                {businessInfo.address && <div>{businessInfo.address}</div>}
                                {businessInfo.city && <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{businessInfo.city}</div>}
                            </div>
                        </div>
                    )}
                </div>

                {/* Social Media - Display Only */}
                {(businessInfo.socialMedia?.instagram || businessInfo.socialMedia?.twitter || businessInfo.socialMedia?.facebook) && (
                    <div style={{
                        display: 'flex',
                        gap: '12px',
                        marginTop: '1rem',
                        justifyContent: 'center'
                    }}>
                        {businessInfo.socialMedia.instagram && (
                            <div style={{
                                background: 'linear-gradient(135deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)',
                                padding: '12px',
                                borderRadius: '12px',
                                color: 'white',
                                fontSize: '1.3rem',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                opacity: 0.7
                            }}>
                                <FaInstagram />
                            </div>
                        )}
                        {businessInfo.socialMedia.twitter && (
                            <div style={{
                                background: '#1DA1F2',
                                padding: '12px',
                                borderRadius: '12px',
                                color: 'white',
                                fontSize: '1.3rem',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                opacity: 0.7
                            }}>
                                <FaTwitter />
                            </div>
                        )}
                        {businessInfo.socialMedia.facebook && (
                            <div style={{
                                background: '#4267B2',
                                padding: '12px',
                                borderRadius: '12px',
                                color: 'white',
                                fontSize: '1.3rem',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                opacity: 0.7
                            }}>
                                <FaFacebook />
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Tabs */}
            <div style={{
                display: 'flex',
                gap: '6px',
                padding: '0 1rem',
                marginBottom: '1.5rem',
                overflowX: 'auto',
                WebkitOverflowScrolling: 'touch'
            }}>
                {['about', 'services', 'hours', 'location'].map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        style={{
                            padding: '10px 18px',
                            background: activeTab === tab
                                ? 'linear-gradient(135deg, var(--primary), #f97316)'
                                : 'var(--bg-card)',
                            border: activeTab === tab
                                ? '1px solid var(--primary)'
                                : '1px solid var(--border-color)',
                            borderRadius: '12px',
                            color: 'white',
                            cursor: 'pointer',
                            fontWeight: activeTab === tab ? '700' : '600',
                            fontSize: '0.85rem',
                            whiteSpace: 'nowrap',
                            transition: 'all 0.3s ease',
                            textTransform: 'capitalize',
                            boxShadow: activeTab === tab
                                ? '0 4px 12px rgba(139, 92, 246, 0.3)'
                                : 'none',
                            transform: activeTab === tab ? 'translateY(-2px)' : 'none'
                        }}
                        onMouseEnter={(e) => {
                            if (activeTab !== tab) {
                                e.currentTarget.style.background = 'rgba(139, 92, 246, 0.1)';
                                e.currentTarget.style.borderColor = 'var(--primary)';
                            }
                        }}
                        onMouseLeave={(e) => {
                            if (activeTab !== tab) {
                                e.currentTarget.style.background = 'var(--bg-card)';
                                e.currentTarget.style.borderColor = 'var(--border-color)';
                            }
                        }}
                    >
                        {tab}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            <div style={{ padding: '0 1.5rem' }}>
                {/* About Tab */}
                {activeTab === 'about' && (
                    <div>
                        <h3 style={{ fontSize: '1.1rem', fontWeight: '800', marginBottom: '1rem' }}>About</h3>
                        {businessInfo.description ? (
                            <p style={{ color: 'var(--text-muted)', lineHeight: '1.6' }}>
                                {businessInfo.description}
                            </p>
                        ) : (
                            <p style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                No description added yet.
                            </p>
                        )}
                    </div>
                )}

                {/* Services Tab */}
                {activeTab === 'services' && (
                    <div>
                        <h3 style={{ fontSize: '1.1rem', fontWeight: '800', marginBottom: '1rem' }}>Services & Menu</h3>
                        {businessInfo.services && businessInfo.services.length > 0 ? (
                            <div style={{ display: 'grid', gap: '12px' }}>
                                {businessInfo.services.map((service, index) => (
                                    <div key={index} style={{
                                        background: 'var(--bg-card)',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: '12px',
                                        padding: '1rem'
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.5rem' }}>
                                            <h4 style={{ fontSize: '1rem', fontWeight: '700', margin: 0 }}>
                                                {service.name}
                                            </h4>
                                            <span style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--primary)' }}>
                                                {service.price} {service.currency || 'SAR'}
                                            </span>
                                        </div>
                                        {service.description && (
                                            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                                                {service.description}
                                            </p>
                                        )}
                                        {service.category && (
                                            <span style={{
                                                display: 'inline-block',
                                                padding: '4px 8px',
                                                background: 'rgba(139, 92, 246, 0.1)',
                                                border: '1px solid rgba(139, 92, 246, 0.3)',
                                                borderRadius: '6px',
                                                fontSize: '0.75rem',
                                                color: 'var(--primary)'
                                            }}>
                                                {service.category}
                                            </span>
                                        )}
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
                        <h3 style={{ fontSize: '1.1rem', fontWeight: '800', marginBottom: '1rem' }}>Working Hours</h3>
                        <div style={{ display: 'grid', gap: '12px' }}>
                            {['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'].map(day => (
                                <div key={day} style={{
                                    background: 'var(--bg-card)',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: '12px',
                                    padding: '1rem',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center'
                                }}>
                                    <span style={{ fontWeight: '700', textTransform: 'capitalize' }}>{day}</span>
                                    <span style={{ color: 'var(--text-muted)' }}>{getDayStatus(day)}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Location Tab */}
                {activeTab === 'location' && (
                    <div>
                        <h3 style={{ fontSize: '1.1rem', fontWeight: '800', marginBottom: '1rem' }}>Location</h3>

                        {/* Address Info */}
                        <div style={{
                            background: 'var(--bg-card)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '12px',
                            padding: '1rem',
                            marginBottom: '1rem'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'start', gap: '12px' }}>
                                <FaMapMarkerAlt style={{ color: 'var(--primary)', fontSize: '1.2rem', marginTop: '2px' }} />
                                <div>
                                    {businessInfo.address && (
                                        <div style={{ fontWeight: '600', marginBottom: '4px' }}>
                                            {businessInfo.address}
                                        </div>
                                    )}
                                    {businessInfo.city && (
                                        <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                                            {businessInfo.city}
                                        </div>
                                    )}
                                    {businessInfo.lat && businessInfo.lng && (
                                        <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '4px' }}>
                                            {businessInfo.lat.toFixed(6)}, {businessInfo.lng.toFixed(6)}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Map */}
                        {businessInfo.lat && businessInfo.lng && (
                            <div style={{
                                height: '300px',
                                borderRadius: '16px',
                                overflow: 'hidden',
                                border: '2px solid var(--border-color)',
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
                )}
            </div>
        </div>
    );
};

export default BusinessProfile;
