import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import InvitationCard from '../components/InvitationCard';
import { useInvitations } from '../context/InvitationContext';
import { useTranslation } from 'react-i18next';
import { FaMapMarkedAlt, FaSearch, FaBullseye, FaStar } from 'react-icons/fa';

const Home = () => {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const { invitations, restaurants, currentUser } = useInvitations();

    // Debugging to ensure we don't have posts mixing in
    useEffect(() => {
        console.log("Home Component Loaded - Enforcing Invitations Display");
        console.log("currentUser:", currentUser);
    }, [currentUser]);

    const [searchQuery, setSearchQuery] = useState('');
    const [activeFilter, setActiveFilter] = useState('All');
    const [locationFilter, setLocationFilter] = useState('All');
    const [viewMode, setViewMode] = useState('list');

    // User location state
    const [userLocation, setUserLocation] = useState(null);
    const [locationError, setLocationError] = useState(null);

    const mapRef = useRef(null);
    const mapInstance = useRef(null);
    const markersLayer = useRef(null);

    // Calculate distance between two points (Haversine formula)
    const calculateDistance = (lat1, lon1, lat2, lon2) => {
        const R = 6371; // Earth's radius in km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c; // Distance in km
    };

    // Get user location on component mount
    useEffect(() => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    setUserLocation({
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    });
                    setLocationError(null);
                },
                (error) => {
                    console.log('Location access denied or unavailable:', error);
                    setLocationError(error.message);
                    // Default to Riyadh if location denied
                    setUserLocation({ lat: 24.7136, lng: 46.6753 });
                }
            );
        } else {
            setLocationError('Geolocation not supported');
            setUserLocation({ lat: 24.7136, lng: 46.6753 });
        }
    }, []);

    const locationFilters = [
        { id: 'All', label: t('all'), icon: '🌍' },
        { id: 'nearby', label: t('near_me'), icon: '📍' },
        { id: 'city', label: t('in_my_city'), icon: '🏙️' },
        { id: 'country', label: t('in_my_country'), icon: '🗺️' }
    ];

    const categories = [
        { id: 'All', label: t('filter_all'), icon: null },
        { id: 'Restaurant', label: t('type_restaurant'), icon: '🍴' },
        { id: 'Cafe', label: t('type_cafe'), icon: '☕' },
        { id: 'Cinema', label: t('type_cinema'), icon: '🎬' },
        { id: 'Sports', label: t('type_sports'), icon: '⚽' },
        { id: 'Directory', label: t('directory'), icon: '📖' },
    ];

    const safeInvitations = useMemo(() => Array.isArray(invitations) ? invitations : [], [invitations]);
    const safeRestaurants = useMemo(() => Array.isArray(restaurants) ? restaurants : [], [restaurants]);

    const filteredInvitations = useMemo(() => {
        const now = new Date();
        let filtered = safeInvitations.filter(inv => {
            if (!inv || !inv.author) return false;

            // 1. OWNERSHIP (Always show mine)
            const isOwn = inv.author.id === currentUser.id;
            if (isOwn) return true;

            // 2. AUTO-CLOSE (Hide 1 hour after time)
            const inviteDate = new Date(inv.date || now);
            if (!isNaN(inviteDate.getTime())) {
                const [hours, minutes] = (inv.time || "20:30").split(':');
                inviteDate.setHours(parseInt(hours) || 0, parseInt(minutes) || 0, 0);
                const expiry = new Date(inviteDate.getTime() + 60 * 60 * 1000);
                if (now > expiry) return false;
            }

            // 3. SOCIAL PRIVACY
            const isFollowing = currentUser?.following?.includes(inv.author.id);
            const canView = !inv.isFollowersOnly || isFollowing;
            if (!canView) return false;


            // 4. ENHANCED SEARCH (title + location + description)
            const matchesSearch = !searchQuery ||
                (inv.title?.toLowerCase().includes(searchQuery.toLowerCase())) ||
                (inv.location?.toLowerCase().includes(searchQuery.toLowerCase())) ||
                (inv.description?.toLowerCase().includes(searchQuery.toLowerCase()));
            const matchesFilter = activeFilter === 'All' || inv.type === activeFilter;

            return matchesSearch && matchesFilter;
        });

        // Calculate distance for each invitation FIRST (before filtering)
        if (userLocation) {
            filtered = filtered.map(inv => ({
                ...inv,
                distance: inv.lat && inv.lng
                    ? calculateDistance(userLocation.lat, userLocation.lng, inv.lat, inv.lng)
                    : null
            }));
        }

        // Apply quick location filter AFTER distance calculation
        if (locationFilter !== 'All' && userLocation) {
            filtered = filtered.filter(inv => {
                if (!inv.lat || !inv.lng || inv.distance === null) return false;

                switch (locationFilter) {
                    case 'nearby':
                        return inv.distance < 10; // Within 10km
                    case 'city':
                        return inv.distance < 50; // Within 50km
                    case 'country':
                        return inv.distance < 500; // Within 500km
                    default:
                        return true;
                }
            });
        }

        // Sort by distance (closest first) if location available
        if (userLocation) {
            filtered.sort((a, b) => {
                if (a.distance === null) return 1;
                if (b.distance === null) return -1;
                return a.distance - b.distance;
            });
        }

        return filtered;
    }, [safeInvitations, searchQuery, activeFilter, currentUser, userLocation, locationFilter]);

    const premiumAds = useMemo(() => safeRestaurants.filter(r => r && r.tier === 3), [safeRestaurants]);
    const inFeedAds = useMemo(() => safeRestaurants.filter(r => r && r.tier === 2), [safeRestaurants]);

    const invitationsWithCoords = useMemo(() => filteredInvitations.filter(inv => inv && inv.lat && inv.lng), [filteredInvitations]);

    const resetMapView = () => {
        const L = window.L;
        if (mapInstance.current && L && invitationsWithCoords.length > 0) {
            const latLngs = invitationsWithCoords.map(inv => [inv.lat, inv.lng]);
            mapInstance.current.flyToBounds(latLngs, { padding: [50, 50], duration: 1.5 });
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
                    tap: false // Improve mobile responsiveness
                }).setView([24.7136, 46.6753], 6);
                L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(mapInstance.current);
                markersLayer.current = L.layerGroup().addTo(mapInstance.current);
                setTimeout(() => { if (mapInstance.current) mapInstance.current.invalidateSize(); }, 250);
            }

            if (markersLayer.current) {
                markersLayer.current.clearLayers();

                // Add user location marker with pulse animation
                if (userLocation) {
                    const userIcon = L.divIcon({
                        className: 'leaflet-user-location-icon',
                        html: `
                            <div class="user-location-marker" style="position: relative;">
                                <div class="user-location-pulse"></div>
                                <div class="user-location-pulse" style="animation-delay: 0.5s;"></div>
                                <div class="user-location-avatar">
                                    <img src="${currentUser?.avatar || currentUser?.photoURL || 'https://api.dicebear.com/7.x/avataaars/svg?seed=user'}" 
                                         style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;" />
                                </div>
                            </div>
                        `,
                        iconSize: [50, 50],
                        iconAnchor: [25, 25]
                    });

                    L.marker([userLocation.lat, userLocation.lng], { icon: userIcon })
                        .addTo(markersLayer.current)
                        .bindPopup(`
                            <div style="text-align: center; font-family: 'Tajawal', sans-serif; padding: 5px;">
                                <strong style="color: var(--primary);">📍 ${t('your_location')}</strong>
                            </div>
                        `, { className: 'premium-popup' });
                }


                invitationsWithCoords.forEach(inv => {
                    // Check eligibility
                    const checkEligibility = () => {
                        if (inv.author?.id === currentUser?.id) return { eligible: true };

                        if (inv.genderPreference && inv.genderPreference !== 'any' && currentUser?.gender) {
                            if (currentUser.gender !== inv.genderPreference) {
                                return { eligible: false, reason: t('gender_mismatch') };
                            }
                        }

                        if (inv.ageRange && currentUser?.age) {
                            const [minAge, maxAge] = inv.ageRange.split('-').map(Number);
                            if (currentUser.age < minAge || currentUser.age > maxAge) {
                                return { eligible: false, reason: `${t('age_range_preference')}: ${inv.ageRange}` };
                            }
                        }

                        return { eligible: true };
                    };
                    const eligibility = checkEligibility();
                    const isOwn = inv.author?.id === currentUser?.id;

                    // Determine pulse color based on status
                    const pulseColor = isOwn ? '#fbbf24' : (eligibility.eligible ? '#10b981' : '#ef4444');

                    const avatarIcon = L.divIcon({
                        className: 'leaflet-avatar-icon',
                        html: `
                            <div class="avatar-marker-outer" style="cursor: pointer; ${!eligibility.eligible ? 'opacity: 0.6;' : ''}">
                                <div class="avatar-marker-pulse" style="
                                    position: absolute;
                                    width: 100%;
                                    height: 100%;
                                    border-radius: 50%;
                                    background: ${pulseColor};
                                    opacity: 0.6;
                                    animation: marker-pulse 2s ease-out infinite;
                                "></div>
                                <div class="avatar-marker-pulse" style="
                                    position: absolute;
                                    width: 100%;
                                    height: 100%;
                                    border-radius: 50%;
                                    background: ${pulseColor};
                                    opacity: 0.6;
                                    animation: marker-pulse 2s ease-out infinite;
                                    animation-delay: 1s;
                                "></div>
                                <div class="avatar-marker-ring"></div>
                                <div class="avatar-marker-frame">
                                    <img src="${inv.author?.avatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=fallback'}" class="avatar-marker-image" />
                                </div>
                            </div>
                        `,
                        iconSize: [45, 45],
                        iconAnchor: [22, 22]
                    });

                    // Calculate distance and time if user location is available
                    let distanceInfo = '';
                    if (userLocation && inv.lat && inv.lng) {
                        const distance = calculateDistance(userLocation.lat, userLocation.lng, inv.lat, inv.lng);
                        const travelTime = Math.round((distance / 40) * 60);

                        distanceInfo = `
                            <div style="background: rgba(16, 185, 129, 0.1); padding: 8px; border-radius: 8px; margin: 10px 0; border: 1px solid rgba(16, 185, 129, 0.3);">
                                <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                                    <span style="color: #10b981; font-size: 0.85rem; font-weight: 700;">📏 ${t('distance')}:</span>
                                    <span style="color: white; font-weight: 900;">${distance.toFixed(1)} km</span>
                                </div>
                                <div style="display: flex; justify-content: space-between;">
                                    <span style="color: #10b981; font-size: 0.85rem; font-weight: 700;">⏱️ ${t('travel_time')}:</span>
                                    <span style="color: white; font-weight: 900;">~${travelTime} ${t('minutes')}</span>
                                </div>
                            </div>
                        `;
                    }

                    // Eligibility warning
                    const eligibilityWarning = !eligibility.eligible ? `
                        <div style="background: rgba(239, 68, 68, 0.15); padding: 8px; border-radius: 8px; margin: 10px 0; border: 1px solid rgba(239, 68, 68, 0.3);">
                            <span style="color: #ef4444; font-size: 0.8rem; font-weight: 700;">⚠️ ${eligibility.reason}</span>
                        </div>
                    ` : '';

                    const popupContent = `
                        <div style="min-width:200px; font-family: 'Tajawal', sans-serif; text-align: ${i18n.language === 'ar' ? 'right' : 'left'}; background-color: #1e293b; color: white; padding: 5px; border-radius: 8px;">
                            <img src="${inv.image || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400'}" style="width:100%; height:90px; object-fit:cover; border-radius:12px; margin-bottom:12px;" />
                            <h4 style="margin:0 0 5px 0; color:#f8fafc; font-size:1rem; font-weight:900;">${inv.title}</h4>
                            <p style="margin:0 0 5px 0; color:#cbd5e1; font-size:0.8rem; font-weight:700;">${inv.author?.name}</p>
                            ${distanceInfo}
                            ${eligibilityWarning}
                            <button id="inv-popup-btn-${inv.id}" style="width:100%; padding:10px; background:${!eligibility.eligible ? 'rgba(55, 65, 81, 0.8)' : 'var(--primary)'}; color:${!eligibility.eligible ? '#d1d5db' : 'white'}; border:none; border-radius:10px; cursor:${!eligibility.eligible ? 'not-allowed' : 'pointer'}; font-weight:900; font-size:0.85rem; margin-top: 10px">
                                ${!eligibility.eligible ? eligibility.reason : t('view_details')}
                            </button>
                        </div>
                    `;
                    L.marker([inv.lat, inv.lng], { icon: avatarIcon })
                        .addTo(markersLayer.current)
                        .bindPopup(popupContent, { className: 'premium-popup' })
                        .on('popupopen', () => {
                            const btn = document.getElementById(`inv-popup-btn-${inv.id}`);
                            if (btn && eligibility.eligible) btn.onclick = () => navigate(`/invitation/${inv.id}`);
                        });
                });

                if (invitationsWithCoords.length > 0) {
                    const latLngs = invitationsWithCoords.map(inv => [inv.lat, inv.lng]);
                    mapInstance.current.fitBounds(latLngs, { padding: [70, 70], maxZoom: 13, animate: true });
                }
            }
        }

        return () => {
            if (viewMode !== 'map' && mapInstance.current) {
                mapInstance.current.remove();
                mapInstance.current = null;
                markersLayer.current = null;
            }
        };
    }, [viewMode, invitationsWithCoords, i18n.language, navigate]);

    const RestaurantAdCard = ({ restaurant }) => {
        if (!restaurant) return null;
        return (
            <div
                onClick={() => navigate(`/restaurant/${restaurant.id}`)}
                className="restaurant-ad-card"
            >
                <div className="ad-badge">PROMOTED</div>
                <img src={restaurant.image} className="ad-image" alt="" />
                <div className="ad-content">
                    <div className="ad-header">
                        <h4 className="ad-title">{restaurant.name}</h4>
                        <div className="ad-rating"><FaStar /> {restaurant.rating}</div>
                    </div>
                    <p className="ad-promo">{restaurant.promoText}</p>
                </div>
            </div>
        );
    };

    const handleCategoryClick = (cat) => {
        if (cat.id === 'Directory') {
            navigate('/restaurants');
        } else {
            setActiveFilter(cat.id);
        }
    };

    return (
        <div className="home-page" style={{ minHeight: '100vh', animation: 'fadeIn 0.5s ease-out' }}>
            <div className="home-header">
                <div className="top-row">
                    <h1 className="header-title">{t('feed_header')}</h1>
                    <div className="view-mode-toggle">
                        <button onClick={() => setViewMode('list')} className={viewMode === 'list' ? 'active' : ''}>{t('list_view')}</button>
                        <button onClick={() => setViewMode('map')} className={viewMode === 'map' ? 'active' : ''}>{t('map_view')}</button>
                    </div>
                </div>

                <div className="search-container" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                        <input type="text" placeholder={t('search_placeholder')} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="search-input" />
                        <FaSearch className="search-icon" />
                    </div>
                    <select
                        value={locationFilter}
                        onChange={(e) => setLocationFilter(e.target.value)}
                        style={{
                            background: 'var(--bg-card)',
                            color: 'white',
                            border: '1px solid var(--border-color)',
                            borderRadius: '8px',
                            padding: '8px 10px',
                            minWidth: '90px',
                            fontSize: '0.75rem',
                            fontWeight: '600'
                        }}
                    >
                        {locationFilters.map(f => (
                            <option key={f.id} value={f.id}>
                                {f.icon} {f.label}
                            </option>
                        ))}
                    </select>
                </div>
            </div>



            {viewMode === 'map' ? (
                <div className="map-view-container">
                    <div className="map-wrapper">
                        <div ref={mapRef} className="leaflet-container-home"></div>
                        <button onClick={resetMapView} className="btn-recenter"><FaBullseye /></button>

                        <div className="map-discovery-badge">
                            <div className="pulse-dot"></div>
                            <span>{invitationsWithCoords.length} {t('active_events')}</span>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="list-view-container">
                    {premiumAds.length > 0 && (
                        <div className="promo-banner" onClick={() => navigate(`/restaurant/${premiumAds[0].id}`)}>
                            <span className="promo-badge">HOT DEAL</span>
                            <div className="promo-overlay"></div>
                            <img src={premiumAds[0].image} className="promo-bg" alt="" />
                            <div className="promo-text-layer">
                                <h3 className="promo-title">{premiumAds[0].name}</h3>
                                <p className="promo-desc">{premiumAds[0].promoText}</p>
                                <button className="btn btn-sm btn-white">Explore Now</button>
                            </div>
                        </div>
                    )}

                    <div className="feed-list">
                        {filteredInvitations.length > 0 ? (
                            <>
                                {filteredInvitations.map((inv, idx) => {
                                    const shouldShowAd = inFeedAds.length > 0 && idx > 0 && idx % 4 === 0;
                                    const adIndex = Math.floor(idx / 4) % inFeedAds.length;
                                    return (
                                        <React.Fragment key={inv.id}>
                                            <InvitationCard invitation={inv} />
                                            {shouldShowAd && <RestaurantAdCard restaurant={inFeedAds[adIndex]} />}
                                        </React.Fragment>
                                    );
                                })}
                            </>
                        ) : (
                            <div className="empty-state">
                                <p>{t('no_invitations')}</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default Home;
