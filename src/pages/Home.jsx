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
    const [searchQuery, setSearchQuery] = useState('');
    const [activeFilter, setActiveFilter] = useState('All');
    const [viewMode, setViewMode] = useState('list');

    const mapRef = useRef(null);
    const mapInstance = useRef(null);
    const markersLayer = useRef(null);

    const categories = [
        { id: 'All', label: t('filter_all'), icon: null },
        { id: 'Restaurant', label: t('type_restaurant'), icon: '🍴' },
        { id: 'Cafe', label: t('type_cafe'), icon: '☕' },
        { id: 'Cinema', label: t('type_cinema'), icon: '🎬' },
        { id: 'Sports', label: t('type_sports'), icon: '⚽' },
        { id: 'Directory', label: i18n.language === 'ar' ? 'دليل الشركاء' : 'Directory', icon: '📖' },
    ];

    const safeInvitations = useMemo(() => Array.isArray(invitations) ? invitations : [], [invitations]);
    const safeRestaurants = useMemo(() => Array.isArray(restaurants) ? restaurants : [], [restaurants]);

    const filteredInvitations = useMemo(() => {
        const now = new Date();
        return safeInvitations.filter(inv => {
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
            const isFollowing = currentUser.following?.includes(inv.author.id);
            const canView = !inv.isFollowersOnly || isFollowing;
            if (!canView) return false;

            // 4. SEARCH
            const matchesSearch = !searchQuery ||
                (inv.title?.toLowerCase().includes(searchQuery.toLowerCase())) ||
                (inv.location?.toLowerCase().includes(searchQuery.toLowerCase()));
            const matchesFilter = activeFilter === 'All' || inv.type === activeFilter;

            return matchesSearch && matchesFilter;
        });
    }, [safeInvitations, searchQuery, activeFilter, currentUser]);

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
                invitationsWithCoords.forEach(inv => {
                    const avatarIcon = L.divIcon({
                        className: 'leaflet-avatar-icon',
                        html: `
                            <div class="avatar-marker-outer" style="cursor: pointer">
                                <div class="avatar-marker-ring"></div>
                                <div class="avatar-marker-frame">
                                    <img src="${inv.author?.avatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=fallback'}" class="avatar-marker-image" />
                                </div>
                            </div>
                        `,
                        iconSize: [45, 45],
                        iconAnchor: [22, 22]
                    });

                    const popupContent = `
                        <div style="min-width:180px; font-family: 'Tajawal', sans-serif; text-align: ${i18n.language === 'ar' ? 'right' : 'left'}">
                            <img src="${inv.image || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400'}" style="width:100%; height:90px; object-fit:cover; border-radius:12px; margin-bottom:12px;" />
                            <h4 style="margin:0 0 5px 0; color:#1e293b; font-size:1rem; font-weight:900;">${inv.title}</h4>
                            <p style="margin:0 0 5px 0; color:#64748b; font-size:0.8rem; font-weight:700;">${inv.author?.name}</p>
                            <button id="inv-popup-btn-${inv.id}" style="width:100%; padding:10px; background:var(--primary); color:white; border:none; border-radius:10px; cursor:pointer; font-weight:900; font-size:0.85rem; margin-top: 10px">
                                ${i18n.language === 'ar' ? 'عرض التفاصيل' : 'View Details'}
                            </button>
                        </div>
                    `;
                    L.marker([inv.lat, inv.lng], { icon: avatarIcon })
                        .addTo(markersLayer.current)
                        .bindPopup(popupContent, { className: 'premium-popup' })
                        .on('popupopen', () => {
                            const btn = document.getElementById(`inv-popup-btn-${inv.id}`);
                            if (btn) btn.onclick = () => navigate(`/invitation/${inv.id}`);
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
                        <button onClick={() => setViewMode('list')} className={viewMode === 'list' ? 'active' : ''}>{i18n.language === 'ar' ? 'قائمة' : 'List'}</button>
                        <button onClick={() => setViewMode('map')} className={viewMode === 'map' ? 'active' : ''}>{i18n.language === 'ar' ? 'خريطة' : 'Map'}</button>
                    </div>
                </div>

                <div className="search-container">
                    <input type="text" placeholder={t('search_placeholder')} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="search-input" />
                    <FaSearch className="search-icon" />
                </div>
            </div>

            <div className="categories-scroller hide-scrollbar">
                {categories.map(cat => (
                    <button
                        key={cat.id}
                        onClick={() => handleCategoryClick(cat)}
                        className={`category-pill ${activeFilter === cat.id ? 'active' : ''}`}
                    >
                        {cat.label}
                    </button>
                ))}
            </div>

            {viewMode === 'map' ? (
                <div className="map-view-container">
                    <div className="map-wrapper">
                        <div ref={mapRef} className="leaflet-container-home"></div>
                        <button onClick={resetMapView} className="btn-recenter"><FaBullseye /></button>

                        <div className="map-discovery-badge">
                            <div className="pulse-dot"></div>
                            <span>{invitationsWithCoords.length} {i18n.language === 'ar' ? 'دعوات نشطة' : 'Active events'}</span>
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
                        {filteredInvitations.length === 0 ? (
                            <div className="empty-state">
                                <p>{i18n.language === 'ar' ? 'لا يوجد دعوات تطابق بحثك حالياً..' : 'No invitations found matching your search..'}</p>
                            </div>
                        ) : (
                            filteredInvitations.map((inv, index) => {
                                const elements = [<InvitationCard key={inv.id} invitation={inv} />];
                                if ((index + 1) % 3 === 0 && inFeedAds.length > 0) {
                                    const ad = inFeedAds[(Math.floor(index / 3)) % inFeedAds.length];
                                    elements.push(<RestaurantAdCard key={`ad-${index}`} restaurant={ad} />);
                                }
                                return elements;
                            })
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default Home;
