import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FaArrowRight, FaStar, FaMapMarkerAlt, FaPhone, FaClock, FaGlobe, FaArrowLeft } from 'react-icons/fa';
import { useInvitations } from '../context/InvitationContext';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import RestaurantRating from '../components/RestaurantRating';
import CreateInvitationSelector from '../components/CreateInvitationSelector';

const RestaurantDetails = () => {
    const { t, i18n } = useTranslation();
    const { id } = useParams();
    const navigate = useNavigate();
    const context = useInvitations();
    const { userProfile, isGuest } = useAuth();
    const isBusinessAccount = userProfile?.isBusiness || false;
    const [isSelectorOpen, setIsSelectorOpen] = useState(false);

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
                }).setView([restaurant.lat || -33.8688, restaurant.lng || 151.2093], 15);

                L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(mapInstance.current);

                L.marker([restaurant.lat || -33.8688, restaurant.lng || 151.2093]).addTo(mapInstance.current);
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
                <h2>{t('restaurant_not_found')}</h2>
                <button onClick={() => navigate('/')} className="btn btn-primary" style={{ marginTop: '1rem' }}>{t('back_to_home')}</button>
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
                        <h1 style={{ fontSize: '1.8rem', fontWeight: '900', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {name}
                            {restaurant.isVerified && <FaCheckCircle style={{ color: '#3b82f6', fontSize: '1.2rem' }} title="Verified Business" />}
                        </h1>
                        <span style={{ color: 'var(--luxury-gold)', fontWeight: '800' }}>{type} • {restaurant.businessInfo?.priceLevel || '$$'}</span>
                    </div>
                    <div style={{ background: 'rgba(251, 191, 36, 0.15)', padding: '8px 15px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '6px', border: '1px solid var(--luxury-gold)' }}>
                        <FaStar style={{ color: 'var(--luxury-gold)' }} />
                        <span style={{ color: 'var(--luxury-gold)', fontWeight: '900' }}>{Number(rating || 0).toFixed(1)}</span>
                    </div>
                </div>

                <p style={{ fontSize: '1rem', lineHeight: '1.6', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
                    {restaurant.businessInfo?.description || promoText}
                </p>



                {/* FEATURES LIST */}
                {restaurant.businessInfo?.features && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '1.5rem' }}>
                        {restaurant.businessInfo.features.map((feature, idx) => (
                            <span key={idx} style={{
                                background: 'rgba(255,255,255,0.1)',
                                padding: '6px 12px',
                                borderRadius: '20px',
                                fontSize: '0.8rem',
                                border: '1px solid rgba(255,255,255,0.2)'
                            }}>
                                ✨ {feature}
                            </span>
                        ))}
                    </div>
                )}

                {/* Community Join Section */}
                <div style={{ background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(244, 63, 94, 0.1) 100%)', padding: '1.5rem', borderRadius: '20px', border: '1px solid rgba(139, 92, 246, 0.3)', marginBottom: '2rem' }}>
                    {/* ... (Existing Community Code) ... */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <div>
                            <h3 style={{ fontSize: '1.1rem', fontWeight: '900', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                👥 {t('restaurant_community')}
                            </h3>
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                {t('members_count', { count: restaurant.followersCount || '100+' })}
                            </p>
                        </div>
                        {!isBusinessAccount && (
                            <button
                                onClick={() => {
                                    if (isGuest || !currentUser?.id) {
                                        navigate('/login');
                                        return;
                                    }
                                    toggleCommunity(restaurant?.ownerId || id);
                                }}
                                style={{
                                    background: (currentUser?.joinedCommunities || []).some(jId => jId === id || jId === restaurant?.ownerId)
                                        ? 'transparent'
                                        : 'linear-gradient(135deg, var(--primary) 0%, var(--primary-hover) 100%)',
                                    color: 'white',
                                    border: (currentUser?.joinedCommunities || []).some(jId => jId === id || jId === restaurant?.ownerId)
                                        ? '1px solid var(--primary)'
                                        : 'none',
                                    padding: '10px 20px',
                                    borderRadius: '12px',
                                    fontSize: '0.85rem',
                                    fontWeight: '800',
                                    cursor: 'pointer',
                                    boxShadow: (currentUser?.joinedCommunities || []).some(jId => jId === id || jId === restaurant?.ownerId)
                                        ? 'none'
                                        : '0 4px 12px rgba(139, 92, 246, 0.3)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px'
                                }}
                            >
                                {(currentUser?.joinedCommunities || []).some(jId => jId === id || jId === restaurant?.ownerId)
                                    ? t('member_joined')
                                    : t('join_plus')}
                            </button>
                        )}
                    </div>
                    {/* ... (Rest of existing community code) ... */}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '2rem' }}>
                    <div style={{ background: 'var(--bg-card)', padding: '1rem', borderRadius: '15px', border: '1px solid var(--border-color)' }}>
                        <FaMapMarkerAlt style={{ color: 'var(--primary)', marginBottom: '5px' }} />
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Location</div>
                        <div style={{ fontSize: '0.8rem', fontWeight: '700' }}>{restaurant.businessInfo?.address || location}</div>
                    </div>
                    <div style={{ background: 'var(--bg-card)', padding: '1rem', borderRadius: '15px', border: '1px solid var(--border-color)' }}>
                        <FaClock style={{ color: 'var(--accent)', marginBottom: '5px' }} />
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Today's Hours</div>
                        <div style={{ fontSize: '0.8rem', fontWeight: '700' }}>
                            {(() => {
                                const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
                                const today = days[new Date().getDay()];
                                return restaurant.businessInfo?.openingHours?.[today] || '10:00 AM - 10:00 PM';
                            })()}
                        </div>
                    </div>
                </div>

                <div style={{ marginBottom: '2rem' }}>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: '800', marginBottom: '1rem' }}>{t('venue_location')}</h3>
                    <div ref={mapRef} style={{ height: '180px', width: '100%', borderRadius: '20px', border: '1px solid var(--border-color)', overflow: 'hidden' }}></div>
                </div>


                {/* Rating Section */}
                <RestaurantRating
                    restaurant={restaurant}
                    currentUser={currentUser}
                    submitRestaurantRating={context?.submitRestaurantRating}
                />

                <div style={{ display: 'flex', gap: '1rem' }}>
                    {!isBusinessAccount && (
                        <button
                            onClick={() => {
                                if (isGuest || !currentUser?.id) {
                                    navigate('/login');
                                    return;
                                }
                                setIsSelectorOpen(true);
                            }}
                            className="btn btn-primary"
                            style={{ flex: 3, height: '55px', fontSize: '1.1rem' }}
                        >
                            {t('book_venue_btn')}
                        </button>
                    )}
                    <button style={{ flex: isBusinessAccount ? 1 : undefined, background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <FaPhone />
                    </button>
                </div>
            </div>

            {/* Invitation Type Selector Modal */}
            <CreateInvitationSelector
                isOpen={isSelectorOpen}
                onClose={() => setIsSelectorOpen(false)}
                navigationState={{
                    fromRestaurant: true,
                    restaurantData: {
                        name: restaurant.name,
                        location: restaurant.location,
                        image: restaurant.image,
                        lat: restaurant.lat,
                        lng: restaurant.lng,
                        type: restaurant.type
                    }
                }}
            />
        </div>
    );
};

export default RestaurantDetails;
