import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import InvitationCard from '../components/InvitationCard';
import InvitationSkeleton from '../components/InvitationSkeleton';
import { useInvitations } from '../context/InvitationContext';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { FaMapMarkedAlt, FaSearch, FaBullseye, FaStar, FaCheck, FaPlus, FaExpand, FaCompress } from 'react-icons/fa';
import { HiBuildingStorefront } from 'react-icons/hi2';
import { collection, query, where, getDocs, getDoc, doc } from 'firebase/firestore';
import { db } from '../firebase/config';
import '../components/MapStyles.css';
import './HomeMobileFeed.css';
import CreateInvitationSelector from '../components/CreateInvitationSelector';
import { useTheme } from '../context/ThemeContext';
import { getSafeAvatar } from '../utils/avatarUtils';
import OffersBanner from '../components/OffersBanner';


const Home = () => {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const { invitations, restaurants, currentUser, loading } = useInvitations();
    const { userProfile } = useAuth();
    const { isDark } = useTheme();
    const isBusinessAccount = userProfile?.accountType === 'business' || userProfile?.role === 'partner';

    // Debugging to ensure we don't have posts mixing in
    useEffect(() => {
        console.log("Home Component Loaded - Enforcing Invitations Display");
        console.log("currentUser:", currentUser);
    }, [currentUser]);

    const [searchQuery, setSearchQuery] = useState('');
    const [geoFilter, setGeoFilter] = useState('global'); // 'city', 'country', 'global'
    const [activeFilter, setActiveFilter] = useState('All');
    const [locationFilter, setLocationFilter] = useState('All');
    const [timeFilter, setTimeFilter] = useState('all'); // 'all', 'today', 'week', 'soon'
    const [viewMode, setViewMode] = useState('list');
    const [showFilters, setShowFilters] = useState(false); // Controls filter visibility
    const [isFullscreen, setIsFullscreen] = useState(false); // Fullscreen mode for map
    const [showSelector, setShowSelector] = useState(false); // New: For пригласительный селектор (fixed) - Create Invitation Selector

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
                    // Default to null (world view) if location denied
                    setUserLocation(null);
                }
            );
        } else {
            setLocationError('Geolocation not supported');
            setUserLocation(null);
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
        { id: 'Bar', label: 'Bar', icon: '🍺' },
        { id: 'Night Club', label: 'Night Club', icon: '🎵' },
        { id: 'BBQ', label: 'BBQ', icon: '🔥' },
        { id: 'Directory', label: t('directory'), icon: '📖' },
    ];

    const safeInvitations = useMemo(() => Array.isArray(invitations) ? invitations : [], [invitations]);
    const safeRestaurants = useMemo(() => Array.isArray(restaurants) ? restaurants : [], [restaurants]);

    // Memoized filtered invitations
    // NEW CLEAN LOGIC - REPLACING BROKEN LEGACY LOGIC
    const filteredInvitations = useMemo(() => {
        const now = new Date();

        // 1. First Pass: Apply all non-location filters (Search, Category, Privacy, Time, etc.)
        let filtered = safeInvitations.filter(inv => {
            if (!inv || !inv.author) return false;

            // 0. HOME SPECIFIC: HIDE DRAFTS
            if (inv.status === 'draft') return false;

            // 1. HOME SPECIFIC: OWNERSHIP (Always show mine)
            const isOwn = inv.author.id === currentUser?.id;

            // 2. HOME SPECIFIC: EXPIRY LOGIC
            // Priority 1: If manually completed, hide after 1 hour
            if (inv.meetingStatus === 'completed' && inv.completedAt) {
                const completedTime = inv.completedAt.toDate ? inv.completedAt.toDate() : new Date(inv.completedAt);
                const oneHourAfterCompletion = new Date(completedTime.getTime() + 60 * 60 * 1000);
                if (now > oneHourAfterCompletion) return false;
            } else {
                // Priority 2: For non-completed, hide 1 hour after scheduled time
                const inviteDate = new Date(inv.date || now);
                if (!isNaN(inviteDate.getTime())) {
                    const [hours, minutes] = (inv.time || "20:30").split(':');
                    inviteDate.setHours(parseInt(hours) || 0, parseInt(minutes) || 0, 0);
                    const expiry = new Date(inviteDate.getTime() + 60 * 60 * 1000);
                    if (now > expiry) return false;
                }
            }

            // 3. HOME SPECIFIC: SOCIAL PRIVACY
            if (inv.privacy === 'private' || (inv.invitedFriends && inv.invitedFriends.length > 0)) {
                return false; // Hide all private (or legacy private) invitations from all feeds
            } else if (inv.privacy === 'followers' || inv.isFollowersOnly) {
                const isFollowing = currentUser?.following?.includes(inv.author.id);
                if (!isOwn && !isFollowing) return false;
            }

            // 4. SEARCH FILTER (Matching RestaurantDirectory logic)
            const matchesSearch = !searchQuery ||
                (inv.title?.toLowerCase().includes(searchQuery.toLowerCase())) ||
                (inv.location?.toLowerCase().includes(searchQuery.toLowerCase())) ||
                (inv.description?.toLowerCase().includes(searchQuery.toLowerCase()));

            // 5. CATEGORY FILTER (Matching RestaurantDirectory logic)
            const matchesCategory = activeFilter === 'All' || inv.type === activeFilter;

            return matchesSearch && matchesCategory;
        });

        // 6. LOCATION FILTER (EXACT COPY FROM RESTAURANT DIRECTORY)
        const isStaff = ['admin', 'moderator', 'support'].includes(userProfile?.role || userProfile?.accountType);

        if (geoFilter !== 'global' && geoFilter !== 'All' && userLocation && !isStaff) {
            filtered = filtered.filter(inv => {
                let distance = null;
                if (inv.lat && inv.lng) {
                    distance = calculateDistance(userLocation.lat, userLocation.lng, inv.lat, inv.lng);
                }

                if (distance === null) return false;

                switch (geoFilter) {
                    case 'nearby': return distance < 10;
                    case 'city': return distance < 50;
                    case 'country': return distance < 500;
                    default: return true;
                }
            });
        }

        // Add distance property
        if (userLocation) {
            filtered = filtered.map(inv => ({
                ...inv,
                distance: (inv.lat && inv.lng)
                    ? calculateDistance(userLocation.lat, userLocation.lng, inv.lat, inv.lng)
                    : null
            }));
        }

        return filtered;
    }, [safeInvitations, searchQuery, geoFilter, activeFilter, userLocation, currentUser]);

    // Legacy filtering logic removed.

    const premiumAds = useMemo(() => safeRestaurants.filter(r => r && r.tier === 3), [safeRestaurants]);
    const inFeedAds = useMemo(() => safeRestaurants.filter(r => r && r.tier === 2), [safeRestaurants]);

    const invitationsWithCoords = useMemo(() => {
        return filteredInvitations.filter(inv => inv.lat && inv.lng);
    }, [filteredInvitations]);

    // Map control functions
    const zoomIn = () => {
        if (mapInstance.current) {
            mapInstance.current.zoomIn();
        }
    };

    const zoomOut = () => {
        if (mapInstance.current) {
            mapInstance.current.zoomOut();
        }
    };

    const resetMapView = () => {
        if (mapInstance.current && invitationsWithCoords.length > 0) {
            const bounds = [];
            invitationsWithCoords.forEach(inv => {
                if (inv.lat && inv.lng) bounds.push([inv.lat, inv.lng]);
            });
            if (userLocation) bounds.push([userLocation.lat, userLocation.lng]);
            if (bounds.length > 0) {
                mapInstance.current.fitBounds(bounds, { padding: [50, 50] });
            }
        } else if (mapInstance.current && userLocation) {
            mapInstance.current.setView([userLocation.lat, userLocation.lng], 13);
        }
    };

    useEffect(() => {
        if (viewMode === 'map' && mapRef.current) {
            const L = window.L;
            if (!L) return;

            if (!mapInstance.current) {
                // Smart Initialization Logic:
                // 1. User Location (Most relevant)
                // 2. Center of visible invitations (Content relevant)
                // 3. World view (Neutral fallback)

                let initialLat = 0;
                let initialLng = 0;
                let initialZoom = 2; // World view

                if (userLocation) {
                    initialLat = userLocation.lat;
                    initialLng = userLocation.lng;
                    initialZoom = 13;
                } else if (invitationsWithCoords.length > 0) {
                    // Calculate center of invitations
                    const lats = invitationsWithCoords.map(i => i.lat);
                    const lngs = invitationsWithCoords.map(i => i.lng);
                    const minLat = Math.min(...lats);
                    const maxLat = Math.max(...lats);
                    const minLng = Math.min(...lngs);
                    const maxLng = Math.max(...lngs);

                    initialLat = (minLat + maxLat) / 2;
                    initialLng = (minLng + maxLng) / 2;
                    initialZoom = 10; // City/Region level view
                }

                mapInstance.current = L.map(mapRef.current, {
                    zoomControl: false,
                    attributionControl: false,
                    tap: false
                }).setView([initialLat, initialLng], initialZoom);

                if (!userLocation && invitationsWithCoords.length > 0) {
                    const bounds = invitationsWithCoords.map(inv => [inv.lat, inv.lng]);
                    try {
                        mapInstance.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
                    } catch (e) { console.warn("Could not fit bounds on init", e); }
                }
            }

            // Always ensure tiles match current theme
            mapInstance.current.eachLayer((layer) => {
                if (layer instanceof L.TileLayer) mapInstance.current.removeLayer(layer);
            });

            const tileUrl = isDark
                ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
                : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';

            L.tileLayer(tileUrl).addTo(mapInstance.current);

            // Cleanup previous markers
            mapInstance.current.eachLayer((layer) => {
                if (layer instanceof L.Marker) mapInstance.current.removeLayer(layer);
            });

            // Add user location marker
            if (userLocation) {
                const userIcon = L.divIcon({
                    className: 'user-location-marker',
                    html: `
                        <div class="user-marker-outer">
                            <div class="user-marker-pulse"></div>
                            <div class="user-marker-dot"></div>
                        </div>
                    `,
                    iconSize: [30, 30],
                    iconAnchor: [15, 15]
                });
                L.marker([userLocation.lat, userLocation.lng], { icon: userIcon })
                    .addTo(mapInstance.current)
                    .bindPopup(`<strong style="color: #8b5cf6;">📍 ${t('your_location')}</strong>`);
            }

            // Add invitation markers
            // Add invitation markers
            invitationsWithCoords.forEach(inv => {
                try {
                    if (!inv.lat || !inv.lng) return;

                    const eligibility = typeof checkEligibility === 'function' ? checkEligibility(inv) : { eligible: true, reason: '' };
                    const isOwn = inv.author?.id === currentUser?.id;

                    // Calculate distance
                    let distance = null;
                    let travelTime = null;
                    if (userLocation) {
                        distance = calculateDistance(userLocation.lat, userLocation.lng, inv.lat, inv.lng);
                        travelTime = Math.round((distance / 40) * 60);
                    }

                    // Get real profile picture using unified utility
                    const profilePic = getSafeAvatar(inv.author);

                    // Create custom marker with profile picture
                    // Color logic: Gold for own, Red for not eligible, Green for eligible
                    const markerColor = isOwn ? '#fbbf24' : (!eligibility.eligible ? '#ef4444' : '#10b981');
                    const markerIcon = L.divIcon({
                        className: 'custom-invitation-marker',
                        html: `
                            <div style="
                                width: 50px;
                                height: 50px;
                                border-radius: 50%;
                                border: 3px solid ${markerColor};
                                overflow: hidden;
                                background: white;
                                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                            ">
                                <img src="${profilePic}" 
                                     style="width: 100%; height: 100%; object-fit: cover;" 
                                     onerror="this.src='https://api.dicebear.com/7.x/avataaars/svg?seed=${inv.author?.id || 'default'}'" />
                            </div>
                        `,
                        iconSize: [50, 50],
                        iconAnchor: [25, 50]
                    });

                    // Determine correct image URL logic (matching InvitationCard.jsx priority)
                    const displayImage = (inv.mediaType === 'video' && inv.videoThumbnail)
                        ? inv.videoThumbnail
                        : (inv.customImage || inv.restaurantImage || inv.image || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400');

                    // Create compact popup content
                    const popupContent = `
                        <div class="compact-popup">
                            <div style="position: relative;">
                                <img src="${displayImage}" class="compact-popup-image" onerror="this.src='https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400'" />
                                <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; padding: 4px; background: linear-gradient(to top, rgba(0,0,0,0.6), transparent);">
                                    <span style="background: ${markerColor}; color: white; padding: 2px 6px; border-radius: 4px; font-size: 0.6rem; font-weight: 700; position: absolute; bottom: 4px; left: 4px;">${inv.type || 'Event'}</span>
                                </div>
                            </div>
                            <div class="compact-popup-body">
                                <h4 class="compact-popup-title">${inv.title}</h4>
                                <div class="compact-popup-meta">
                                    <img src="${profilePic}" style="width: 14px; height: 14px; border-radius: 50%;" />
                                    <span>${inv.author?.name || 'Unknown'}</span>
                                </div>
                                ${distance ? `
                                    <div class="compact-popup-stats">
                                        <span>📏 ${distance.toFixed(1)} km</span>
                                        <span>⏱️ ~${travelTime} min</span>
                                    </div>
                                ` : ''}
                                <div>
                                    <button onclick="window.location.href='/invitation/${inv.id}'" class="compact-popup-btn">
                                        ${!eligibility.eligible ? '⚠️ ' + (eligibility.reason ? eligibility.reason.substring(0, 15) : 'Unavailable') + '...' : t('view_details')}
                                    </button>
                                </div>
                            </div>
                        </div>
                    `;

                    L.marker([inv.lat, inv.lng], { icon: markerIcon })
                        .addTo(mapInstance.current)
                        .bindPopup(popupContent, {
                            maxWidth: 200,
                            minWidth: 180,
                            className: 'compact-leaflet-popup'
                        });
                } catch (err) {
                    console.error('Error rendering marker:', err);
                }
            });

            // Force map recalculation
            setTimeout(() => {
                if (mapInstance.current) {
                    mapInstance.current.invalidateSize();
                }
            }, 100);

            // Auto-fit bounds with delay
            setTimeout(() => {
                if (!mapInstance.current) return;

                if (invitationsWithCoords.length > 0 || userLocation) {
                    const bounds = [];
                    invitationsWithCoords.forEach(inv => {
                        if (inv.lat && inv.lng) bounds.push([inv.lat, inv.lng]);
                    });

                    // Only include user location if we have invitations, or if it's the only thing
                    if (userLocation) bounds.push([userLocation.lat, userLocation.lng]);

                    if (bounds.length > 0) {
                        try {
                            mapInstance.current.fitBounds(bounds, {
                                padding: [50, 50],
                                maxZoom: 15,
                                animate: true
                            });
                        } catch (e) {
                            console.error("Error fitting bounds:", e);
                            // Fallback to center view if fitBounds fails
                            if (userLocation) {
                                mapInstance.current.setView([userLocation.lat, userLocation.lng], 12);
                            }
                        }
                    }
                }
            }, 300);
        }
    }, [viewMode, userLocation, invitationsWithCoords, currentUser, t, i18n.language, isDark]);

    // Fix for map disappearing when switching between list and map view
    useEffect(() => {
        if (viewMode === 'map' && mapInstance.current) {
            // Small delay to ensure DOM is ready
            setTimeout(() => {
                if (mapInstance.current) {
                    mapInstance.current.invalidateSize();
                    // Re-fit bounds if we have invitations
                    if (invitationsWithCoords.length > 0 || userLocation) {
                        const bounds = [];
                        invitationsWithCoords.forEach(inv => {
                            if (inv.lat && inv.lng) bounds.push([inv.lat, inv.lng]);
                        });
                        if (userLocation) bounds.push([userLocation.lat, userLocation.lng]);
                        if (bounds.length > 0) {
                            try {
                                mapInstance.current.fitBounds(bounds, {
                                    padding: [50, 50],
                                    maxZoom: 15,
                                    animate: true
                                });
                            } catch (e) {
                                console.error("Error fitting bounds:", e);
                            }
                        }
                    }
                }
            }, 100);
        }
    }, [viewMode, invitationsWithCoords, userLocation]);

    // Handle Escape key to exit fullscreen
    useEffect(() => {
        const handleEscape = (e) => {
            if (e.key === 'Escape' && isFullscreen) {
                setIsFullscreen(false);
                setTimeout(() => {
                    if (mapInstance.current) {
                        mapInstance.current.invalidateSize();
                    }
                }, 100);
            }
        };

        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [isFullscreen]);


    // Helper functions
    const checkEligibility = (inv) => {
        if (inv.author?.id === currentUser?.id) return { eligible: true };
        if (inv.genderPreference && inv.genderPreference !== 'any' && currentUser?.gender) {
            if (currentUser.gender !== inv.genderPreference) return { eligible: false, reason: t('gender_mismatch') };
        }
        if (inv.ageRange && currentUser?.age) {
            const [minAge, maxAge] = inv.ageRange.split('-').map(Number);
            if (currentUser.age < minAge || currentUser.age > maxAge) return { eligible: false, reason: `${t('age_range_preference')}: ${inv.ageRange}` };
        }
        return { eligible: true };
    };

    const RestaurantAdCard = ({ restaurant }) => {
        if (!restaurant) return null;
        return (
            <div
                onClick={() => navigate(`/restaurant/${restaurant.id}`)}
                className="business-ad-card smart-invitation-card"
                style={{
                    // Add border gold/distinctive for business
                    border: '2px solid #f59e0b',
                    position: 'relative',
                    overflow: 'hidden',
                    cursor: 'pointer'
                }}
            >
                {/* --- 1. HEADER (Logo & Name) --- */}
                <div className="card-header" style={{
                    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20,
                    padding: '20px',
                    background: 'linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, transparent 100%)',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                    pointerEvents: 'none', border: 'none'
                }}>
                    <div className="header-host-info" style={{ display: 'flex', alignItems: 'center', gap: '10px', pointerEvents: 'auto' }}>
                        <div style={{ position: 'relative' }}>
                            <img
                                src={restaurant.image} // Use restaurant main image as logo placeholder if logo not available
                                alt={restaurant.name}
                                style={{
                                    width: '55px', height: '55px', borderRadius: '50%',
                                    border: '2px solid var(--luxury-gold)', objectFit: 'cover',
                                    padding: '2px', background: 'var(--bg-card)'
                                }}
                            />
                            <div style={{
                                position: 'absolute', bottom: '-2px', right: '-2px',
                                background: 'var(--luxury-gold)', color: 'black', borderRadius: '50%',
                                width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '10px', fontWeight: 'bold', border: '2px solid var(--bg-card)'
                            }}>
                                <FaCheck />
                            </div>
                        </div>
                        <div>
                            <div style={{
                                fontSize: '0.95rem', fontWeight: '800', color: 'white',
                                textShadow: '0 1px 3px rgba(0,0,0,0.8)',
                                display: 'flex', alignItems: 'center', gap: '6px'
                            }}>
                                {restaurant.name}
                                <span style={{ fontSize: '0.7em', background: 'var(--luxury-gold)', color: 'black', padding: '1px 6px', borderRadius: '6px' }}>AD</span>
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.9)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                <FaStar style={{ color: '#fbbf24' }} /> {restaurant.rating} • {t('partner', { defaultValue: 'Partner' })}
                            </div>
                        </div>
                    </div>
                </div>

                {/* --- 2. MEDIA (Full Background) --- */}
                < div className="card-media" style={{
                    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                    zIndex: 1
                }}>
                    <img
                        src={restaurant.image}
                        alt={restaurant.name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                    <div className="media-overlay" style={{
                        position: 'absolute', inset: 0,
                        background: 'linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.6) 30%, transparent 100%)'
                    }} />
                </div >

                {/* --- 3. FOOTER (Actions) --- */}
                < div className="card-footer" style={{
                    position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 20,
                    padding: '20px',
                    display: 'flex', flexDirection: 'column', gap: '10px',
                    pointerEvents: 'none'
                }}>
                    <div className="footer-info" style={{ pointerEvents: 'auto' }}>
                        <h3 style={{ fontSize: '1.5rem', fontWeight: '900', color: 'white', margin: '0 0 6px 0', lineHeight: 1.2, textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>
                            {restaurant.promoText || 'Special Offer Inside!'}
                        </h3>
                        {restaurant.tags && (
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                {restaurant.tags.map((tag, i) => (
                                    <span key={i} style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.8)', background: 'rgba(255,255,255,0.1)', padding: '2px 8px', borderRadius: '4px' }}>
                                        #{tag}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="footer-actions" style={{ pointerEvents: 'auto' }}>
                        <button style={{
                            width: '100%', padding: '14px', borderRadius: '30px', border: 'none',
                            background: 'var(--luxury-gold)', // Gold for business action
                            color: 'black',
                            fontWeight: '800', fontSize: '1rem', cursor: 'pointer',
                            display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px',
                            boxShadow: '0 4px 15px rgba(251, 191, 36, 0.4)'
                        }}>
                            {t('view_profile', { defaultValue: 'View Profile' })}
                        </button>
                    </div>
                </div >
            </div >
        );
    };

    const handleCategoryClick = (cat) => {
        if (cat.id === 'Directory') {
            navigate('/restaurants');
        } else {
            setActiveFilter(cat.id);
        }
    };

    // Return statement
    return (
        <div className="home-page" style={{ minHeight: '100vh', animation: 'fadeIn 0.5s ease-out' }}>

            <style>{`
                .filter-select {
                    appearance: none !important;
                    -webkit-appearance: none !important;
                    background-color: var(--bg-card, #ffffff) !important;
                    border: 1px solid var(--border-color, #e2e8f0) !important;
                    color: var(--text-main, #333333) !important;
                    padding: 0 24px 0 10px !important;
                    border-radius: 10px !important;
                    font-size: 12px !important;
                    font-weight: 500 !important;
                    height: 38px !important;
                    background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e") !important;
                    background-repeat: no-repeat !important;
                    background-position: right 8px center !important;
                    background-size: 14px !important;
                    max-width: 140px !important;
                    min-width: 80px !important;
                }
                .no-scrollbar::-webkit-scrollbar { display: none !important; }
                .no-scrollbar { -ms-overflow-style: none !important; scrollbar-width: none !important; }
                .category-icons-scroll::-webkit-scrollbar { display: none !important; }
                .category-icons-scroll { -ms-overflow-style: none !important; scrollbar-width: none !important; }
                
                @keyframes slideDown {
                    from {
                        opacity: 0;
                        max-height: 0;
                        transform: translateY(-10px);
                    }
                    to {
                        opacity: 1;
                        max-height: 100px;
                        transform: translateY(0);
                    }
                }
            `}</style>



            <div className="home-header">
                <div className="top-row">
                    {/* Compact Title */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <h2 style={{ fontSize: '1.2rem', fontWeight: '800', margin: 0, color: 'var(--text-main)' }}>
                            {t('feed_header')}
                        </h2>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div className="view-mode-toggle">
                            <button onClick={() => setViewMode('list')} className={viewMode === 'list' ? 'active' : ''}>{t('list_view')}</button>
                            <button onClick={() => setViewMode('map')} className={viewMode === 'map' ? 'active' : ''}>{t('map_view')}</button>
                        </div>
                    </div>
                </div>

                {/* Location Filter Tabs (City / Country / Global) */}

                <OffersBanner />
                {/* Filter Bar - Responsive Layout */}
                <div className="filter-bar" style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    background: 'var(--bg-card)',
                    padding: '6px 12px',
                    borderRadius: '16px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                    position: 'relative',
                    zIndex: 50
                }}>
                    <style>{`
                        .filter-select {
                            appearance: none !important;
                            -webkit-appearance: none !important;
                            background-color: var(--bg-card, #ffffff) !important;
                            border: 1px solid var(--border-color, #e2e8f0) !important;
                            color: var(--text-main, #333333) !important;
                            padding: 0 24px 0 10px !important;
                            border-radius: 10px !important;
                            font-size: 12px !important;
                            font-weight: 500 !important;
                            height: 36px !important;
                            background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e") !important;
                            background-repeat: no-repeat !important;
                            background-position: right 8px center !important;
                            background-size: 14px !important;
                            max-width: 140px !important;
                            min-width: 110px !important;
                        }
                    `}</style>

                    {/* Row 1: Search + Location Filter */}
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>

                        {/* Search Input - Always Visible */}
                        <div style={{ position: 'relative', flex: '1 1 auto' }}>
                            <FaSearch className="search-icon" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '0.85rem' }} />
                            <input
                                type="text"
                                placeholder={t('search_placeholder')}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onFocus={() => setShowFilters(true)}
                                className="search-input"
                                style={{
                                    width: '100%',
                                    padding: '8px 10px 8px 36px',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: '12px',
                                    fontSize: '0.85rem',
                                    background: 'var(--bg-input)'
                                }}
                            />
                        </div>

                        {/* Location Filter Dropdown - Restore Control */}
                        <div style={{ flex: '0 0 auto' }}>
                            <select
                                value={geoFilter}
                                onChange={(e) => setGeoFilter(e.target.value)}
                                className="filter-select"
                            >
                                <option value="All">🌍 {t('all') || 'All'}</option>
                                <option value="nearby">📍 {t('near_me') || 'Near me'}</option>
                                <option value="city">🏙️ {t('in_my_city') || 'In my city'}</option>
                                <option value="country">🗺️ {t('in_my_country') || 'In my country'}</option>
                            </select>
                        </div>
                    </div>

                    {/* Row 2: Category Icons - Show when search is focused */}
                    {showFilters && (
                        <div style={{
                            display: 'flex',
                            gap: '6px',
                            width: '100%',
                            overflowX: 'auto',
                            paddingBottom: '4px',
                            animation: 'slideDown 0.2s ease-out',
                            scrollbarWidth: 'none',
                            msOverflowStyle: 'none'
                        }}
                            className="category-icons-scroll"
                        >
                            {categories.map(cat => (
                                <button
                                    key={cat.id}
                                    onClick={() => handleCategoryClick(cat)}
                                    style={{
                                        flex: '0 0 auto',
                                        padding: '8px 12px',
                                        borderRadius: '10px',
                                        border: activeFilter === cat.id
                                            ? '2px solid var(--primary)'
                                            : '1px solid var(--border-color)',
                                        background: activeFilter === cat.id
                                            ? 'rgba(139, 92, 246, 0.1)'
                                            : 'var(--bg-card)',
                                        color: activeFilter === cat.id
                                            ? 'var(--primary)'
                                            : 'var(--text-main)',
                                        fontSize: '0.8rem',
                                        fontWeight: activeFilter === cat.id ? '700' : '500',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        whiteSpace: 'nowrap'
                                    }}
                                    onMouseEnter={(e) => {
                                        if (activeFilter !== cat.id) {
                                            e.currentTarget.style.background = 'rgba(139, 92, 246, 0.05)';
                                            e.currentTarget.style.borderColor = 'var(--primary)';
                                        }
                                    }}
                                    onMouseLeave={(e) => {
                                        if (activeFilter !== cat.id) {
                                            e.currentTarget.style.background = 'var(--bg-card)';
                                            e.currentTarget.style.borderColor = 'var(--border-color)';
                                        }
                                    }}
                                >
                                    {cat.icon && <span>{cat.icon}</span>}
                                    <span>{cat.label}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>


            {/* Map View Container - Always in DOM but hidden when not active */}
            <div
                className="map-view-container"
                style={{
                    padding: '0',
                    margin: '0',
                    width: '100%',
                    position: isFullscreen ? 'fixed' : 'relative',
                    top: isFullscreen ? 0 : 'auto',
                    left: isFullscreen ? 0 : 'auto',
                    right: isFullscreen ? 0 : 'auto',
                    bottom: isFullscreen ? 0 : 'auto',
                    zIndex: isFullscreen ? 9999 : 'auto',
                    direction: 'ltr',
                    display: viewMode === 'map' ? 'block' : 'none',
                    background: 'var(--bg-body)'
                }}
            >
                <div className="map-wrapper" style={{ borderRadius: '0', overflow: 'hidden', width: '100%', height: isFullscreen ? '100vh' : 'calc(100vh - 200px)', position: 'relative' }}>
                    <div ref={mapRef} className="responsive-map-container" style={{ width: '100%', height: '100%', minHeight: isFullscreen ? '100vh' : 'calc(100vh - 200px)', outline: 'none' }}></div>

                    {/* Zoom Controls + Fullscreen + Recenter */}
                    <div className="map-zoom-controls">
                        <button onClick={zoomIn} className="btn-map-control" title={t('zoom_in', { defaultValue: 'Zoom In' })}>                                <span style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>+</span>
                        </button>
                        <button onClick={zoomOut} className="btn-map-control" title={t('zoom_out', { defaultValue: 'Zoom Out' })}>
                            <span style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>−</span>
                        </button>
                        {/* Fullscreen Toggle Button */}
                        <button
                            onClick={() => {
                                setIsFullscreen(!isFullscreen);
                                setTimeout(() => {
                                    if (mapInstance.current) {
                                        mapInstance.current.invalidateSize();
                                    }
                                }, 100);
                            }}
                            className="btn-map-control"
                            title={isFullscreen ? t('exit_fullscreen', 'Exit Fullscreen') : t('fullscreen', 'Fullscreen')}
                        >
                            {isFullscreen ? <FaCompress /> : <FaExpand />}
                        </button>
                        {/* Recenter Button */}
                        <button onClick={resetMapView} className="btn-map-control" title={t('recenter_map', { defaultValue: 'Recenter Map' })}>
                            <FaBullseye />
                        </button>
                    </div>

                    <div className="map-discovery-badge" style={{ top: 'auto', bottom: '20px', left: '50%', transform: 'translateX(-50%)' }}>
                        <div className="pulse-dot"></div>
                        <span>{invitationsWithCoords.length} {t('active_events')}</span>
                    </div>
                </div>
            </div>


            {/* List View Container - Always in DOM but hidden when not active */}
            <div
                className="list-view-container"
                style={{
                    display: viewMode === 'list' ? 'block' : 'none'
                }}
            >

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
                    {loading ? (
                        // Show skeleton while loading
                        <>
                            {[1, 2, 3, 4, 5].map(i => (
                                <InvitationSkeleton key={i} />
                            ))}
                        </>
                    ) : filteredInvitations.length > 0 ? (
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
                        <div className="empty-state" style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '4rem 2rem',
                            textAlign: 'center',
                            minHeight: '400px'
                        }}>
                            {/* Animated Icon */}
                            <div style={{
                                fontSize: '5rem',
                                marginBottom: '1.5rem',
                                animation: 'float 3s ease-in-out infinite'
                            }}>
                                {searchQuery || activeFilter !== 'All' || locationFilter !== 'All' ? '🔍' : '🍽️'}
                            </div>

                            {/* Title */}
                            <h3 style={{
                                fontSize: '1.5rem',
                                fontWeight: '800',
                                color: 'var(--text-primary)',
                                marginBottom: '0.75rem',
                                background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                                backgroundClip: 'text'
                            }}>
                                {searchQuery || activeFilter !== 'All' || locationFilter !== 'All'
                                    ? t('no_results_found') || 'No Results Found'
                                    : t('no_invitations_yet') || 'No Invitations Yet'}
                            </h3>

                            {/* Description */}
                            <p style={{
                                fontSize: '0.95rem',
                                color: 'var(--text-muted)',
                                marginBottom: '2rem',
                                maxWidth: '400px',
                                lineHeight: '1.6'
                            }}>
                                {searchQuery || activeFilter !== 'All' || locationFilter !== 'All'
                                    ? t('try_different_filters') || 'Try adjusting your filters or search terms'
                                    : t('be_first_to_create') || 'Be the first to create an invitation and start connecting!'}
                            </p>

                            {/* Action Buttons */}
                            <div style={{
                                display: 'flex',
                                gap: '1rem',
                                flexWrap: 'wrap',
                                justifyContent: 'center'
                            }}>
                                {(searchQuery || activeFilter !== 'All' || locationFilter !== 'All') ? (
                                    <button
                                        onClick={() => {
                                            setSearchQuery('');
                                            setActiveFilter('All');
                                            setLocationFilter('All');
                                        }}
                                        style={{
                                            padding: '0.75rem 1.5rem',
                                            borderRadius: '16px',
                                            border: '2px solid var(--primary)',
                                            background: 'transparent',
                                            color: 'var(--primary)',
                                            fontSize: '0.9rem',
                                            fontWeight: '700',
                                            cursor: 'pointer',
                                            transition: 'all 0.3s ease',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.5rem'
                                        }}
                                        onMouseEnter={(e) => {
                                            e.target.style.background = 'var(--primary)';
                                            e.target.style.color = 'white';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.target.style.background = 'transparent';
                                            e.target.style.color = 'var(--primary)';
                                        }}
                                    >
                                        🔄 {t('clear_filters') || 'Clear Filters'}
                                    </button>
                                ) : !isBusinessAccount && currentUser?.id !== 'guest' && userProfile?.accountType !== 'guest' && (
                                    <button
                                        onClick={() => setShowSelector(true)}
                                        style={{
                                            padding: '0.75rem 2rem',
                                            borderRadius: '16px',
                                            border: 'none',
                                            background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
                                            color: 'white',
                                            fontSize: '0.95rem',
                                            fontWeight: '700',
                                            cursor: 'pointer',
                                            transition: 'all 0.3s ease',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.5rem',
                                            boxShadow: '0 4px 12px rgba(139, 92, 246, 0.3)'
                                        }}
                                        onMouseEnter={(e) => {
                                            e.target.style.transform = 'translateY(-2px)';
                                            e.target.style.boxShadow = '0 6px 20px rgba(139, 92, 246, 0.4)';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.target.style.transform = 'translateY(0)';
                                            e.target.style.boxShadow = '0 4px 12px rgba(139, 92, 246, 0.3)';
                                        }}
                                    >
                                        ✨ {t('create_invitation') || 'Create Invitation'}
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Create Invitation FAB - Only on invitations/home page, not for business accounts */}
            {/* Create Invitation FAB - Only on invitations/home page, not for business accounts and not for guests */}
            {/* Create Invitation FAB - Visible to all, but prompts guests sign up */}
            {!isBusinessAccount && (
                <div
                    onClick={() => {
                        if (userProfile?.accountType === 'guest' || userProfile?.isGuest) {
                            if (window.confirm(i18n.language === 'ar'
                                ? 'يجب تسجيل الدخول لإنشاء دعوة. هل تريد التسجيل الآن؟'
                                : 'You need to sign in to create an invitation. Sign up now?')) {
                                navigate('/login');
                            }
                        } else {
                            setShowSelector(true);
                        }
                    }}
                    style={{
                        position: 'fixed',
                        bottom: '100px',
                        right: '25px',
                        width: '56px',
                        height: '56px',
                        borderRadius: '18px', // More modern shape
                        background: '#ef4444',
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 8px 16px rgba(239, 68, 68, 0.4)',
                        cursor: 'pointer',
                        zIndex: 1000,
                        border: '2px solid rgba(255,255,255,0.2)'
                    }}
                    role="button"
                    className="home-fab-btn"
                >
                    <FaPlus size={24} />
                </div>
            )}


            <CreateInvitationSelector
                isOpen={showSelector}
                onClose={() => setShowSelector(false)}
            />
        </div >
    );
};

export default Home;
