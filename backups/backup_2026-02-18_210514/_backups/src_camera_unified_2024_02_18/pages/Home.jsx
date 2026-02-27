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


const Home = () => {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const { invitations, restaurants, currentUser, loading } = useInvitations();
    const { userProfile } = useAuth();
    const isBusinessAccount = userProfile?.accountType === 'business';

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

    // User location state
    const [userLocation, setUserLocation] = useState(null);
    const [locationError, setLocationError] = useState(null);

    // Special offers state
    // Special offers state
    const [specialOffers, setSpecialOffers] = useState([]);
    const [loadingOffers, setLoadingOffers] = useState(true);


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

    // Fetch special offers
    useEffect(() => {
        const fetchSpecialOffers = async () => {
            try {
                setLoadingOffers(true);
                const offersQuery = query(
                    collection(db, 'specialOffers'),
                    where('status', '==', 'active')
                );

                const offersSnapshot = await getDocs(offersQuery);
                const offersList = [];

                for (const offerDoc of offersSnapshot.docs) {
                    const offerData = offerDoc.data();

                    // Check if offer is not expired
                    const endDate = offerData.endDate?.toDate ? offerData.endDate.toDate() : new Date(offerData.endDate);
                    if (endDate > new Date()) {
                        // Fetch partner data
                        const partnerDoc = await getDoc(doc(db, 'users', offerData.partnerId));
                        if (partnerDoc.exists() && partnerDoc.data().subscriptionTier === 'premium') {
                            offersList.push({
                                id: offerDoc.id,
                                ...offerData,
                                partnerData: partnerDoc.data()
                            });
                        }
                    }
                }

                // Sort by creation date (newest first)
                offersList.sort((a, b) => {
                    const dateA = a.createdAt?.toDate?.() || new Date(0);
                    const dateB = b.createdAt?.toDate?.() || new Date(0);
                    return dateB - dateA;
                });

                setSpecialOffers(offersList);
            } catch (error) {
                console.error('Error fetching special offers:', error);
            } finally {
                setLoadingOffers(false);
            }
        };

        fetchSpecialOffers();
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
            const isOwn = inv.author.id === currentUser.id;

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
            if (inv.privacy === 'private') {
                if (!isOwn && !inv.invitedUserIds?.includes(currentUser.id)) return false;
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
        if (geoFilter !== 'global' && geoFilter !== 'All' && userLocation) {
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

    // OLD BROKEN LOGIC (Disabled by renaming)
    const legacy_filteredInvitations = useMemo(() => {
        return []; /*
        let filtered = safeInvitations;
        const now = new Date();

        // 1. Smart Location Filtering (Auto-Expand Logic)
        // Hierarchy: City (100km) -> Region (500km) -> Broad Country (2000km) -> Global Fallback
        const coords = userProfile?.coordinates || userLocation;

        if (coords && !searchQuery) {
            const { lat: userLat, lng: userLng } = coords;

            // Calculate distances for all invitations first
            const invitationsWithDist = filtered.map(inv => {
                let dist = null;
                if (inv.lat && inv.lng) {
                    dist = calculateDistance(userLat, userLng, inv.lat, inv.lng);
                }
                return { ...inv, dist };
            });

            // 1. Filter Logic: Manual Override vs Smart Default

            // Standard Location Filter (Matching Partner Directory)
            // If Global/All, we do nothing (show all).
            if (geoFilter !== 'global' && geoFilter !== 'All') {
                filtered = invitationsWithDist.filter(inv => {
                    if (inv.dist === null) return false;

                    switch (geoFilter) {
                        case 'nearby':
                            return inv.dist < 10;
                        case 'city':
                            return inv.dist < 50;
                        case 'country':
                            return inv.dist < 500;
                        default:
                            return true;
                    }
                });
            }


            // Logic: Level 1 (City) -> Level 2 (Region) -> Level 3 (Country) -> Level 4 (Global)

            // Level 1: City (Strict ~100km)
            const cityMatch = invitationsWithDist.filter(inv => {
                if (inv.dist !== null) return inv.dist < 100;
                if (userProfile?.city && inv.location) return inv.location.toLowerCase().includes(userProfile.city.toLowerCase());
                return false;
            });

            if (cityMatch.length > 0) {
                filtered = cityMatch;
            } else {
                // Level 2: Region (Expanded ~500km)
                const regionMatch = invitationsWithDist.filter(inv => inv.dist !== null && inv.dist < 500);

                if (regionMatch.length > 0) {
                    filtered = regionMatch;
                } else {
                    // Level 3: Country / Broad Region (~2000km)
                    const countryMatch = invitationsWithDist.filter(inv => inv.dist !== null && inv.dist < 2000);

                    if (countryMatch.length > 0) {
                        filtered = countryMatch;
                    }
                    // Level 4: Global Fallback (Show everything naturally)
                }
            }
        }
    }

        filtered = filtered.filter(inv => {
        if (!inv || !inv.author) return false;

        // 0. HIDE DRAFTS (Don't show drafts on home page)
        if (inv.status === 'draft') return false;

        // 1. OWNERSHIP (Always show mine)
        const isOwn = inv.author.id === currentUser.id;
        if (isOwn) return true;

        // 2. AUTO-CLOSE LOGIC
        // Priority 1: If manually completed, hide after 1 hour from completion
        if (inv.meetingStatus === 'completed' && inv.completedAt) {
            const completedTime = inv.completedAt.toDate ? inv.completedAt.toDate() : new Date(inv.completedAt);
            const oneHourAfterCompletion = new Date(completedTime.getTime() + 60 * 60 * 1000); // +1 hour
            if (now > oneHourAfterCompletion) return false;
            // If completed but within 1 hour, show it (with special styling)
            return true; // ← CRITICAL: Stop here, don't check scheduled time!
        }

        // Priority 2: For non-completed invitations, hide 1 hour after scheduled time
        const inviteDate = new Date(inv.date || now);
        if (!isNaN(inviteDate.getTime())) {
            const [hours, minutes] = (inv.time || "20:30").split(':');
            inviteDate.setHours(parseInt(hours) || 0, parseInt(minutes) || 0, 0);
            const expiry = new Date(inviteDate.getTime() + 60 * 60 * 1000);
            if (now > expiry) return false;
        }

        // 3. SOCIAL PRIVACY
        if (inv.privacy === 'private') {
            // Only author or invited guests can see private invitations
            if (!isOwn && !inv.invitedUserIds?.includes(currentUser.id)) return false;
        } else if (inv.privacy === 'followers' || inv.isFollowersOnly) {
            // Followers only
            const isFollowing = currentUser?.following?.includes(inv.author.id);
            if (!isOwn && !isFollowing) return false;
        }
        // Public invitations are visible to everyone


        // 4. ENHANCED SEARCH (title + location + description)
        const matchesSearch = !searchQuery ||
            (inv.title?.toLowerCase().includes(searchQuery.toLowerCase())) ||
            (inv.location?.toLowerCase().includes(searchQuery.toLowerCase())) ||
            (inv.description?.toLowerCase().includes(searchQuery.toLowerCase()));
        const matchesFilter = activeFilter === 'All' || inv.type === activeFilter;

        // Debug logging
        if (searchQuery || activeFilter !== 'All') {
            console.log('🔍 Filtering:', {
                title: inv.title,
                type: inv.type,
                activeFilter,
                matchesFilter,
                matchesSearch
            });
        }

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


    // Apply time filter
    if (timeFilter !== 'all') {
        filtered = filtered.filter(inv => {
            if (!inv.date || !inv.time) return false;

            if (!inv.date || !inv.time) return true;
            const invDate = new Date(`${inv.date}T${inv.time}`);

            if (timeFilter === 'today') {
                return invDate.toDateString() === now.toDateString();
            } else if (timeFilter === 'tomorrow') {
                const tomorrow = new Date(now);
                tomorrow.setDate(tomorrow.getDate() + 1);
                return invDate.toDateString() === tomorrow.toDateString();
            } else if (timeFilter === 'week') {
                const nextWeek = new Date(now);
                nextWeek.setDate(nextWeek.getDate() + 7);
                return invDate >= now && invDate <= nextWeek;
            }
            return true;
        });
    }

    // Apply category filter
    if (activeFilter !== 'All') {
        filtered = filtered.filter(inv => inv.category === activeFilter);
    }

    // Apply search query
    if (searchQuery) {
        const query = searchQuery.toLowerCase();
        filtered = filtered.filter(inv =>
            inv.title?.toLowerCase().includes(query) ||
            inv.restaurantName?.toLowerCase().includes(query) ||
            inv.description?.toLowerCase().includes(query) ||
            inv.location?.toLowerCase().includes(query) // Allow searching by location name too
        );
    }

    return filtered;
*/ }, []);

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

                L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(mapInstance.current);

                // If we used invitations to center, try to fit bounds perfectly
                if (!userLocation && invitationsWithCoords.length > 0) {
                    const bounds = invitationsWithCoords.map(inv => [inv.lat, inv.lng]);
                    try {
                        mapInstance.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
                    } catch (e) { console.warn("Could not fit bounds on init", e); }
                }
            }

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

                    // Get real profile picture - check multiple sources
                    const profilePic = inv.author?.photoURL ||
                        inv.author?.profilePicture ||
                        inv.author?.avatar ||
                        `https://api.dicebear.com/7.x/avataaars/svg?seed=${inv.author?.id || 'default'}`;

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

                    // Create compact popup content
                    const popupContent = `
                        <div class="compact-popup">
                            <div style="position: relative;">
                                <img src="${inv.image || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400'}" class="compact-popup-image" />
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
    }, [viewMode, userLocation, invitationsWithCoords, currentUser, t, i18n.language]);

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
                                    border: '2px solid #f59e0b', objectFit: 'cover',
                                    padding: '2px', background: 'white'
                                }}
                            />
                            <div style={{
                                position: 'absolute', bottom: '-2px', right: '-2px',
                                background: '#f59e0b', color: 'black', borderRadius: '50%',
                                width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '10px', fontWeight: 'bold', border: '2px solid white'
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
                                <span style={{ fontSize: '0.7em', background: '#f59e0b', color: 'black', padding: '1px 6px', borderRadius: '6px' }}>AD</span>
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
                            background: '#f59e0b', // Gold for business action
                            color: 'black',
                            fontWeight: '800', fontSize: '1rem', cursor: 'pointer',
                            display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px',
                            boxShadow: '0 4px 15px rgba(245, 158, 11, 0.4)'
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
                                    background: 'var(--bg-main)'
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

                {/* Special Offers Carousel */}
                {!loadingOffers && specialOffers.length > 0 && (
                    <div className="special-offers-section" style={{ marginBottom: '1.5rem', padding: '0 1.25rem' }}>
                        <h2 style={{
                            fontSize: '1.2rem',
                            fontWeight: '800',
                            marginBottom: '1rem',
                            color: 'var(--text-main)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px'
                        }}>
                            🔥 {t('special_offers', 'Special Offers')}
                            <span style={{
                                fontSize: '0.7rem',
                                fontWeight: '700',
                                background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                                color: 'white',
                                padding: '4px 8px',
                                borderRadius: '10px'
                            }}>
                                {specialOffers.length}
                            </span>
                        </h2>

                        <div style={{
                            display: 'flex',
                            justifyContent: specialOffers.length === 1 ? 'center' : 'flex-start',
                            gap: '1rem',
                            overflowX: 'auto',
                            paddingBottom: '1rem',
                            scrollbarWidth: 'thin',
                            scrollbarColor: 'var(--primary) var(--bg-card)',
                            marginLeft: '-1.25rem',
                            marginRight: '-1.25rem',
                            paddingLeft: '1.25rem',
                            paddingRight: '1.25rem'
                        }}>
                            {specialOffers.map(offer => {
                                const endDate = offer.endDate?.toDate ? offer.endDate.toDate() : new Date(offer.endDate);
                                const daysLeft = Math.ceil((endDate - new Date()) / (1000 * 60 * 60 * 24));

                                // Simple color mapping
                                const colors = {
                                    'Fire': '#f59e0b',
                                    'Royal': '#a855f7',
                                    'Ocean': '#3b82f6',
                                    'Fresh': '#10b981',
                                    'Passion': '#ef4444',
                                    'Sweet': '#ec4899'
                                };
                                const accentColor = colors[offer.colorTheme] || colors['Fire'];

                                return (
                                    <div
                                        key={offer.id}
                                        onClick={() => navigate(`/partner/${offer.partnerId}`)}
                                        style={{
                                            minWidth: '280px',
                                            maxWidth: '280px',
                                            borderRadius: '16px',
                                            overflow: 'hidden',
                                            border: `3px solid ${accentColor}`,
                                            boxShadow: `0 8px 24px ${accentColor}30`,
                                            cursor: 'pointer',
                                            transition: 'all 0.3s',
                                            background: offer.imageUrl
                                                ? `linear-gradient(to bottom, rgba(0,0,0,0.2), rgba(0,0,0,0.7)), url(${offer.imageUrl})`
                                                : `linear-gradient(135deg, ${accentColor}dd, ${accentColor})`,
                                            backgroundSize: 'cover',
                                            backgroundPosition: 'center',
                                            position: 'relative',
                                            minHeight: '220px',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            justifyContent: 'space-between',
                                            padding: '1rem'
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.transform = 'translateY(-6px)';
                                            e.currentTarget.style.boxShadow = `0 12px 36px ${accentColor}50`;
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.transform = 'translateY(0)';
                                            e.currentTarget.style.boxShadow = `0 8px 24px ${accentColor}30`;
                                        }}
                                    >
                                        {/* Top Section */}
                                        <div style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'flex-start'
                                        }}>
                                            {/* Discount Badge */}
                                            <div style={{
                                                background: 'white',
                                                color: accentColor,
                                                padding: '8px 14px',
                                                borderRadius: '10px',
                                                fontWeight: '900',
                                                fontSize: '1.3rem',
                                                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                                                lineHeight: '1'
                                            }}>
                                                {offer.discount}%
                                            </div>

                                            {/* Days Left Badge */}
                                            <div style={{
                                                background: 'rgba(0,0,0,0.6)',
                                                color: 'white',
                                                padding: '6px 10px',
                                                borderRadius: '8px',
                                                fontSize: '0.7rem',
                                                fontWeight: '700',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '4px'
                                            }}>
                                                ⏰ {daysLeft}d left
                                            </div>
                                        </div>

                                        {/* Bottom Section */}
                                        <div>
                                            {/* Title */}
                                            <div style={{
                                                fontSize: '1.1rem',
                                                fontWeight: '900',
                                                color: 'white',
                                                marginBottom: '0.4rem',
                                                textShadow: '0 2px 8px rgba(0,0,0,0.6)',
                                                lineHeight: '1.3',
                                                display: '-webkit-box',
                                                WebkitLineClamp: 2,
                                                WebkitBoxOrient: 'vertical',
                                                overflow: 'hidden'
                                            }}>
                                                {offer.title}
                                            </div>

                                            {/* Partner Name */}
                                            <div style={{
                                                fontSize: '0.8rem',
                                                fontWeight: '700',
                                                color: 'rgba(255, 255, 255, 0.95)',
                                                marginBottom: '0.5rem',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '5px',
                                                textShadow: '0 1px 4px rgba(0,0,0,0.5)'
                                            }}>
                                                <HiBuildingStorefront style={{ fontSize: '0.9rem' }} />
                                                {offer.partnerData?.businessInfo?.businessName || offer.partnerName}
                                            </div>

                                            {/* Create Invitation Button - Only for non-business users and non-guests */}
                                            {currentUser && currentUser.accountType !== 'business' && currentUser.id !== 'guest' && userProfile?.accountType !== 'guest' && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        // Navigate to create invitation page with offer data
                                                        navigate('/create', {
                                                            state: {
                                                                offerData: {
                                                                    title: offer.title,
                                                                    description: offer.description,
                                                                    image: offer.imageUrl,
                                                                    location: offer.partnerData?.businessInfo?.businessName || offer.partnerName,
                                                                    locationDetails: offer.partnerData?.businessInfo?.location || '',
                                                                    startDate: offer.startDate?.toDate ? offer.startDate.toDate() : new Date(offer.startDate),
                                                                    endDate: offer.endDate?.toDate ? offer.endDate.toDate() : new Date(offer.endDate),
                                                                    discount: offer.discount,
                                                                    menuItem: offer.menuItem,
                                                                    partnerId: offer.partnerId,
                                                                    offerId: offer.id
                                                                }
                                                            }
                                                        });
                                                    }}
                                                    style={{
                                                        width: '100%',
                                                        background: 'white',
                                                        color: accentColor,
                                                        border: 'none',
                                                        borderRadius: '10px',
                                                        padding: '10px',
                                                        fontWeight: '800',
                                                        fontSize: '0.85rem',
                                                        cursor: 'pointer',
                                                        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                                                        transition: 'all 0.2s',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        gap: '6px'
                                                    }}
                                                    onMouseEnter={(e) => {
                                                        e.stopPropagation();
                                                        e.currentTarget.style.transform = 'scale(1.05)';
                                                    }}
                                                    onMouseLeave={(e) => {
                                                        e.stopPropagation();
                                                        e.currentTarget.style.transform = 'scale(1)';
                                                    }}
                                                >
                                                    🎟️ {t('create_invitation', 'Create Invitation')}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
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
                                        onClick={() => navigate('/create')}
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
            {
                !isBusinessAccount && currentUser?.id !== 'guest' && userProfile?.accountType !== 'guest' && (
                    <div
                        onClick={() => navigate('/create')}
                        style={{
                            position: 'fixed',
                            bottom: '100px',
                            right: '25px',
                            width: '56px',
                            height: '56px',
                            borderRadius: '50%',
                            background: '#ef4444',
                            color: 'white',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 4px 15px rgba(239, 68, 68, 0.4)',
                            cursor: 'pointer',
                            zIndex: 1000,
                            border: '2px solid rgba(255,255,255,0.2)'
                        }}
                        role="button"
                        className="home-fab-btn"
                    >
                        <FaPlus size={24} />
                    </div>
                )
            }


        </div >
    );
};

export default Home;
