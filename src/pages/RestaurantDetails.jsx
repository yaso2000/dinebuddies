import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FaArrowRight, FaStar, FaMapMarkerAlt, FaPhone, FaClock, FaGlobe, FaArrowLeft } from 'react-icons/fa';
import { useInvitations } from '../context/InvitationContext';
import { useTranslation } from 'react-i18next';

const RestaurantDetails = () => {
    const { t, i18n } = useTranslation();
    const { id } = useParams();
    const navigate = useNavigate();
    const context = useInvitations();

    // Safety check for context data
    const restaurants = context?.restaurants || [];
    const currentUser = context?.currentUser || {};
    const toggleCommunity = context?.toggleCommunity || (() => { });

    const restaurant = restaurants.find(r => r && r.id === id);
    const mapRef = useRef(null);
    const mapInstance = useRef(null);

    // Initial map setup
    useEffect(() => {
        if (restaurant && mapRef.current && !mapInstance.current) {
            const L = window.L;
            if (!L) return;

            try {
                mapInstance.current = L.map(mapRef.current, {
                    zoomControl: false,
                    attributionControl: false
                }).setView([restaurant.lat || 24.7136, restaurant.lng || 46.6753], 15);

                L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(mapInstance.current);

                L.marker([restaurant.lat || 24.7136, restaurant.lng || 46.6753]).addTo(mapInstance.current);
            } catch (err) {
                console.warn("Map initialization error", err);
            }
        }

        return () => {
            if (mapInstance.current) {
                mapInstance.current.remove();
                mapInstance.current = null;
            }
        };
    }, [restaurant]);

    if (!restaurant) {
        return (
            <div className="page-container" style={{ textAlign: 'center', padding: '5rem 2rem', color: 'white' }}>
                <h2>{i18n.language === 'ar' ? 'المطعم غير موجود' : 'Restaurant not found'}</h2>
                <button onClick={() => navigate('/')} className="btn btn-primary" style={{ marginTop: '1rem' }}>{i18n.language === 'ar' ? 'العودة للرئيسية' : 'Back to Home'}</button>
            </div>
        );
    }

    const { name, type, rating, image, promoText, location, tier } = restaurant;

    return (
        <div className="restaurant-details-page" style={{ paddingBottom: '100px', animation: 'fadeIn 0.5s ease-out', minHeight: '100vh', background: 'var(--bg-body)', color: 'white' }}>
            {/* Hero Section */}
            <div style={{ position: 'relative', height: '300px', width: '100%' }}>
                <img src={image} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, var(--bg-body) 0%, transparent 70%)' }}></div>

                <button
                    onClick={() => navigate(-1)}
                    style={{ position: 'absolute', top: '20px', [i18n.language === 'ar' ? 'right' : 'left']: '20px', zIndex: 10, background: 'rgba(0,0,0,0.5)', border: 'none', color: 'white', width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                    {i18n.language === 'ar' ? <FaArrowRight /> : <FaArrowLeft />}
                </button>
            </div>

            {/* Content */}
            <div style={{ padding: '0 1.5rem', marginTop: '-40px', position: 'relative' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
                    <div>
                        <h1 style={{ fontSize: '1.8rem', fontWeight: '900' }}>{name}</h1>
                        <span style={{ color: 'var(--luxury-gold)', fontWeight: '800' }}>{type}</span>
                    </div>
                    <div style={{ background: 'rgba(251, 191, 36, 0.15)', padding: '8px 15px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '6px', border: '1px solid var(--luxury-gold)' }}>
                        <FaStar style={{ color: 'var(--luxury-gold)' }} />
                        <span style={{ color: 'var(--luxury-gold)', fontWeight: '900' }}>{rating}</span>
                    </div>
                </div>

                <p style={{ fontSize: '1rem', lineHeight: '1.6', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
                    {promoText}
                </p>

                {/* Community Join Section */}
                <div style={{ background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(244, 63, 94, 0.1) 100%)', padding: '1.5rem', borderRadius: '20px', border: '1px solid rgba(139, 92, 246, 0.3)', marginBottom: '2rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <div>
                            <h3 style={{ fontSize: '1.1rem', fontWeight: '900', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                👥 {i18n.language === 'ar' ? 'مجتمع المطعم' : 'Restaurant Community'}
                            </h3>
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                {i18n.language === 'ar' ? '1,234 عضو' : '1,234 members'}
                            </p>
                        </div>
                        <button
                            onClick={() => toggleCommunity(id)}
                            style={{
                                background: (currentUser.joinedCommunities || []).includes(id)
                                    ? 'transparent'
                                    : 'linear-gradient(135deg, var(--primary) 0%, var(--primary-hover) 100%)',
                                color: 'white',
                                border: (currentUser.joinedCommunities || []).includes(id)
                                    ? '1px solid var(--primary)'
                                    : 'none',
                                padding: '10px 20px',
                                borderRadius: '12px',
                                fontSize: '0.85rem',
                                fontWeight: '800',
                                cursor: 'pointer',
                                boxShadow: (currentUser.joinedCommunities || []).includes(id)
                                    ? 'none'
                                    : '0 4px 12px rgba(139, 92, 246, 0.3)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                            }}
                        >
                            {(currentUser.joinedCommunities || []).includes(id)
                                ? (i18n.language === 'ar' ? '✓ عضو' : '✓ Joined')
                                : (i18n.language === 'ar' ? '+ انضم' : '+ Join')}
                        </button>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.8rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ color: 'var(--primary)' }}>✓</span>
                            <span>{i18n.language === 'ar' ? 'إشعارات فورية عند نشر دعوات جديدة' : 'Instant notifications for new invitations'}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ color: 'var(--primary)' }}>✓</span>
                            <span>{i18n.language === 'ar' ? 'عروض حصرية لأعضاء المجتمع' : 'Exclusive offers for community members'}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ color: 'var(--primary)' }}>✓</span>
                            <span>{i18n.language === 'ar' ? 'أولوية في الحجوزات الجماعية' : 'Priority in group bookings'}</span>
                        </div>
                    </div>

                    {/* Community Members Avatars */}
                    <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid rgba(139, 92, 246, 0.2)' }}>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '10px' }}>
                            {i18n.language === 'ar' ? 'أعضاء المجتمع' : 'Community Members'}
                        </p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            {/* Overlapping Avatars */}
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                {[
                                    'https://api.dicebear.com/7.x/avataaars/svg?seed=Member1',
                                    'https://api.dicebear.com/7.x/avataaars/svg?seed=Member2',
                                    'https://api.dicebear.com/7.x/avataaars/svg?seed=Member3',
                                    'https://api.dicebear.com/7.x/avataaars/svg?seed=Member4',
                                    'https://api.dicebear.com/7.x/avataaars/svg?seed=Member5'
                                ].map((avatar, index) => (
                                    <div
                                        key={index}
                                        style={{
                                            width: '32px',
                                            height: '32px',
                                            borderRadius: '50%',
                                            border: '2px solid var(--bg-body)',
                                            overflow: 'hidden',
                                            marginLeft: index > 0 ? '-10px' : '0',
                                            zIndex: 5 - index,
                                            position: 'relative'
                                        }}
                                    >
                                        <img src={avatar} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                                    </div>
                                ))}
                            </div>

                            {/* Show All Button */}
                            <button
                                onClick={() => alert(i18n.language === 'ar' ? '📋 قائمة الأعضاء قيد التطوير' : '📋 Members list coming soon')}
                                style={{
                                    background: 'rgba(139, 92, 246, 0.1)',
                                    border: '1px solid rgba(139, 92, 246, 0.3)',
                                    color: 'var(--primary)',
                                    padding: '4px 10px',
                                    borderRadius: '8px',
                                    fontSize: '0.7rem',
                                    fontWeight: '700',
                                    cursor: 'pointer',
                                    whiteSpace: 'nowrap'
                                }}
                            >
                                +1,229 {i18n.language === 'ar' ? 'المزيد' : 'more'}
                            </button>
                        </div>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '2rem' }}>
                    <div style={{ background: 'var(--bg-card)', padding: '1rem', borderRadius: '15px', border: '1px solid var(--border-color)' }}>
                        <FaMapMarkerAlt style={{ color: 'var(--primary)', marginBottom: '5px' }} />
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Location</div>
                        <div style={{ fontSize: '0.8rem', fontWeight: '700' }}>{location}</div>
                    </div>
                    <div style={{ background: 'var(--bg-card)', padding: '1rem', borderRadius: '15px', border: '1px solid var(--border-color)' }}>
                        <FaClock style={{ color: 'var(--accent)', marginBottom: '5px' }} />
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Opening Hours</div>
                        <div style={{ fontSize: '0.8rem', fontWeight: '700' }}>12:00 PM - 02:00 AM</div>
                    </div>
                </div>

                <div style={{ marginBottom: '2rem' }}>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: '800', marginBottom: '1rem' }}>{i18n.language === 'ar' ? 'موقع المطعم' : 'Venue Location'}</h3>
                    <div ref={mapRef} style={{ height: '180px', width: '100%', borderRadius: '20px', border: '1px solid var(--border-color)', overflow: 'hidden' }}></div>
                </div>

                <div style={{ display: 'flex', gap: '1rem' }}>
                    <button
                        onClick={() => navigate('/create', {
                            state: {
                                fromRestaurant: true,
                                restaurantData: {
                                    name: restaurant.name,
                                    location: restaurant.location,
                                    image: restaurant.image,
                                    lat: restaurant.lat,
                                    lng: restaurant.lng,
                                    type: restaurant.type
                                }
                            }
                        })}
                        className="btn btn-primary"
                        style={{ flex: 3, height: '55px', fontSize: '1.1rem' }}
                    >
                        {t('book_venue_btn')}
                    </button>
                    <button style={{ flex: 1, background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <FaPhone />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default RestaurantDetails;
