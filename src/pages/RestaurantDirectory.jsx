import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useInvitations } from '../context/InvitationContext';
import { useTranslation } from 'react-i18next';
import { FaSearch, FaMapMarkedAlt, FaBullseye, FaStar, FaStore, FaInfoCircle } from 'react-icons/fa';



const RestaurantDirectory = () => {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const context = useInvitations();

    // Get restaurants from context
    const restaurants = context?.restaurants || [];

    const [searchQuery, setSearchQuery] = useState('');
    const [locationFilter, setLocationFilter] = useState('All');
    const [viewMode, setViewMode] = useState('list');
    const [userLocation, setUserLocation] = useState(null);

    const mapRef = useRef(null);
    const mapInstance = useRef(null);

    // Get user's location
    useEffect(() => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    setUserLocation({
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    });
                },
                (error) => {
                    console.log('Location access denied:', error);
                }
            );
        }
    }, []);

    // Calculate distance between two points (Haversine formula)
    const calculateDistance = (lat1, lon1, lat2, lon2) => {
        const R = 6371; // Earth's radius in km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c; // Distance in km
    };

    const locationFilters = [
        { id: 'All', label: t('all'), icon: '🌍' },
        { id: 'nearby', label: t('near_me'), icon: '📍' },
        { id: 'city', label: t('in_my_city'), icon: '🏙️' },
        { id: 'country', label: t('in_my_country'), icon: '🗺️' }
    ];

    const filteredRestaurants = useMemo(() => {
        let filtered = restaurants.filter(res => {
            if (!res) return false;
            const matchesSearch = !searchQuery ||
                (res.name?.toLowerCase().includes(searchQuery.toLowerCase())) ||
                (res.type?.toLowerCase().includes(searchQuery.toLowerCase()));
            return matchesSearch;
        });

        // Apply location filter
        if (locationFilter !== 'All' && userLocation) {
            filtered = filtered.filter(res => {
                if (!res.lat || !res.lng) return false;

                const distance = calculateDistance(
                    userLocation.lat,
                    userLocation.lng,
                    res.lat,
                    res.lng
                );

                switch (locationFilter) {
                    case 'nearby':
                        return distance < 10; // Within 10km
                    case 'city':
                        return distance < 50; // Within 50km (approximate city range)
                    case 'country':
                        return distance < 500; // Within 500km (approximate country range)
                    default:
                        return true;
                }
            });
        }

        return filtered;
    }, [restaurants, searchQuery, locationFilter, userLocation]);

    const resetMapView = () => {
        const L = window.L;
        if (mapInstance.current && L) {
            const validRes = filteredRestaurants.filter(r => r.lat && r.lng);
            if (validRes.length > 0) {
                const latLngs = validRes.map(r => [r.lat, r.lng]);
                mapInstance.current.flyToBounds(latLngs, { padding: [50, 50], duration: 1.5 });
            } else {
                mapInstance.current.flyTo([-24.8662, 152.3489], 13, { duration: 1.5 });
            }
        }
    };

    useEffect(() => {
        if (viewMode === 'map' && mapRef.current) {
            const L = window.L;
            if (!L) return;

            if (!mapInstance.current) {
                mapInstance.current = L.map(mapRef.current, {
                    zoomControl: false,
                    attributionControl: false,
                    tap: false
                }).setView([-24.8662, 152.3489], 13);
                L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(mapInstance.current);
            }

            // Cleanup previous markers if any
            mapInstance.current.eachLayer((layer) => {
                if (layer instanceof L.Marker) mapInstance.current.removeLayer(layer);
            });

            filteredRestaurants.forEach(res => {
                if (res?.lat && res?.lng) {
                    const bizIcon = L.divIcon({
                        className: 'leaflet-biz-icon',
                        html: `
                            <div class="biz-marker-outer" style="cursor: pointer">
                                <div class="biz-marker-ring"></div>
                                <div class="biz-marker-frame">
                                    <img src="${res.logoImage || res.image}" class="avatar-marker-image" />
                                </div>
                            </div>
                        `,
                        iconSize: [45, 45],
                        iconAnchor: [22, 22]
                    });

                    const popupContent = `
                        <div style="min-width:180px; font-family: 'Tajawal', sans-serif; text-align: ${i18n.language === 'ar' ? 'right' : 'left'}">
                            <img src="${res.image}" style="width:100%; height:100px; object-fit:cover; border-radius:12px; margin-bottom:12px;" />
                            <h4 style="margin:0 0 5px 0; color:#1e293b; font-size:1rem; font-weight:900;">${res.name}</h4>
                            <p style="margin:0 0 15px 0; color:#64748b; font-size:0.8rem;">${res.location}</p>
                            <button id="res-popup-btn-${res.id}" style="width:100%; padding:12px; background:var(--luxury-gold); color:black; border:none; border-radius:10px; cursor:pointer; font-weight:900; font-size:0.85rem;">
                                ${t('open_profile')}
                            </button>
                        </div>
                    `;

                    L.marker([res.lat, res.lng], { icon: bizIcon })
                        .addTo(mapInstance.current)
                        .bindPopup(popupContent, { className: 'premium-popup' })
                        .on('popupopen', () => {
                            const btn = document.getElementById(`res-popup-btn-${res.id}`);
                            if (btn) btn.onclick = () => navigate(`/partner/${res.id}`);
                        });
                }
            });

            const validMarkers = filteredRestaurants.filter(r => r.lat && r.lng);
            if (validMarkers.length > 0) {
                const latLngs = validMarkers.map(r => [r.lat, r.lng]);
                mapInstance.current.flyToBounds(latLngs, { padding: [60, 60], maxZoom: 12 });
            }
        }

        return () => {
            if (viewMode !== 'map' && mapInstance.current) {
                mapInstance.current.remove();
                mapInstance.current = null;
            }
        };
    }, [viewMode, filteredRestaurants, i18n.language, navigate]);

    const RestaurantCard = ({ res }) => {
        if (!res) return null;

        const currentUser = context?.currentUser || {};
        const toggleCommunity = context?.toggleCommunity || (() => { });
        const isJoined = (currentUser.joinedCommunities || []).includes(res.id);
        const isOwner = currentUser.id === res.ownerId || (currentUser.ownedRestaurants || []).includes(res.id);

        const handleShare = async (e) => {
            e.stopPropagation();
            const shareUrl = `${window.location.origin}/partner/${res.id}`;
            if (navigator.share) {
                try {
                    await navigator.share({
                        title: res.name,
                        text: `Check out ${res.name} on DineBuddies!`,
                        url: shareUrl
                    });
                } catch (err) { console.error('Share failed:', err); }
            } else {
                navigator.clipboard.writeText(shareUrl);
                alert(t('link_copied'));
            }
        };

        const handleCreateInvite = (e) => {
            e.stopPropagation();
            // Store selected restaurant in session/local storage or pass via state
            // The Create page should check for this state
            navigate('/create', { state: { selectedRestaurant: res } });
        };

        // Community members (empty for now - will be fetched from Firestore in future)
        const communityMembers = [];

        return (
            <div
                className="restaurant-card"
                style={{
                    background: 'var(--bg-card)',
                    borderRadius: '24px',
                    overflow: 'hidden',
                    marginBottom: '1.5rem',
                    border: '1px solid var(--border-color)',
                    cursor: 'pointer',
                    position: 'relative',
                    boxShadow: '0 10px 30px rgba(0,0,0,0.2)'
                }}
                onClick={() => navigate(`/partner/${res.id}`)}
            >
                {/* Image & Header */}
                <div style={{ position: 'relative', height: '220px' }}>
                    <img src={res.image} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt={res.name} />

                    {/* Gradient Overlay */}
                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.9), transparent)' }}></div>

                    {/* Share Button (Top Right) */}
                    <button
                        onClick={handleShare}
                        style={{
                            position: 'absolute',
                            top: '15px',
                            right: '15px',
                            width: '40px',
                            height: '40px',
                            borderRadius: '50%',
                            background: 'rgba(255,255,255,0.1)',
                            backdropFilter: 'blur(8px)',
                            border: '1px solid rgba(255,255,255,0.2)',
                            color: 'white',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            fontSize: '1.1rem'
                        }}
                    >
                        <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>
                    </button>

                    {/* Content inside Image */}
                    <div style={{ position: 'absolute', bottom: '20px', left: '20px', right: '20px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                            <div>
                                <h2 style={{ fontSize: '1.5rem', fontWeight: '900', color: 'white', marginBottom: '5px', textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>{res.name}</h2>
                                <p style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.8)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                    <FaMapMarkedAlt size={12} /> {res.location}
                                </p>
                            </div>
                            <div style={{ background: 'var(--luxury-gold)', color: 'black', padding: '6px 12px', borderRadius: '12px', fontWeight: '800', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <FaStar /> {Number(res.rating || 0).toFixed(1)}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Body Actions */}
                <div style={{ padding: '20px' }}>

                    {/* Create Invite Button - Hidden for Owner */}
                    {!isOwner && (
                        <button
                            onClick={handleCreateInvite}
                            style={{
                                width: '100%',
                                padding: '14px',
                                background: 'var(--primary)',
                                color: 'white',
                                border: 'none',
                                borderRadius: '16px',
                                fontSize: '1rem',
                                fontWeight: 'bold',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '10px',
                                marginBottom: '20px',
                                cursor: 'pointer',
                                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
                            }}
                        >
                            <FaStore />
                            {t('host_invitation_here')}
                        </button>
                    )}

                    {/* Community Row */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{ display: 'flex' }}>
                                {communityMembers.map((m, i) => (
                                    <img
                                        key={m.id}
                                        src={m.avatar}
                                        alt=""
                                        style={{ width: '30px', height: '30px', borderRadius: '50%', border: '2px solid var(--bg-card)', marginLeft: i > 0 ? '-10px' : 0 }}
                                    />
                                ))}
                            </div>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>+200 {t('members')}</span>
                        </div>

                        {isOwner ? (
                            <span style={{
                                background: 'rgba(255,255,255,0.1)',
                                color: 'var(--luxury-gold)',
                                padding: '6px 14px',
                                borderRadius: '20px',
                                fontSize: '0.75rem',
                                fontWeight: 'bold'
                            }}>
                                {t('owner')}
                            </span>
                        ) : (
                            <button
                                onClick={(e) => { e.stopPropagation(); toggleCommunity(res.id); }}
                                style={{
                                    background: isJoined ? 'transparent' : 'white',
                                    color: isJoined ? 'var(--text-muted)' : 'black',
                                    border: isJoined ? '1px solid var(--border-color)' : 'none',
                                    padding: '8px 16px',
                                    borderRadius: '20px',
                                    fontWeight: '700',
                                    fontSize: '0.85rem',
                                    cursor: 'pointer'
                                }}
                            >
                                {isJoined ? t('joined') : t('join')}
                            </button>
                        )}
                    </div>

                </div>
            </div>
        );
    };

    return (
        <div className="directory-page" style={{ paddingBottom: '100px', minHeight: '100vh' }}>
            <div style={{ padding: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <h1 style={{ fontSize: '1.6rem', fontWeight: '900' }}>{t('partner_directory')}</h1>
                    <div style={{ background: 'var(--bg-card)', padding: '4px', borderRadius: '50px', display: 'flex', border: '1px solid var(--border-color)' }}>
                        <button onClick={() => setViewMode('list')} style={{ padding: '6px 16px', borderRadius: '50px', background: viewMode === 'list' ? 'var(--luxury-gold)' : 'transparent', color: viewMode === 'list' ? 'black' : 'white', border: 'none' }}>{t('list')}</button>
                        <button onClick={() => setViewMode('map')} style={{ padding: '6px 16px', borderRadius: '50px', background: viewMode === 'map' ? 'var(--luxury-gold)' : 'transparent', color: viewMode === 'map' ? 'black' : 'white', border: 'none' }}>{t('map')}</button>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
                    <input
                        type="text"
                        placeholder={t('search_venues')}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="input-field"
                        style={{ flex: 1, borderRadius: '12px' }}
                    />
                    <select
                        value={locationFilter}
                        onChange={(e) => setLocationFilter(e.target.value)}
                        style={{ background: 'var(--bg-card)', color: 'white', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '0 10px', minWidth: '140px' }}
                    >
                        {locationFilters.map(f => (
                            <option key={f.id} value={f.id}>
                                {f.icon} {f.label}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            <div style={{ padding: '0 1.5rem' }}>
                {viewMode === 'map' ? (
                    <div style={{ position: 'relative', height: '500px', width: '100%', borderRadius: '25px', overflow: 'hidden', border: '2px solid var(--border-color)' }}>
                        <div ref={mapRef} style={{ height: '100%', width: '100%', background: '#0f172a' }}></div>
                        <button onClick={resetMapView} className="btn-recenter"><FaBullseye /></button>
                    </div>
                ) : (
                    <div className="restaurant-list">
                        {filteredRestaurants.map(res => <RestaurantCard key={res.id} res={res} />)}
                        {filteredRestaurants.length === 0 && <p style={{ textAlign: 'center', opacity: 0.5 }}>{t('no_results')}</p>}
                    </div>
                )}
            </div>
        </div>
    );
};

export default RestaurantDirectory;
