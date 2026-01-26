import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useInvitations } from '../context/InvitationContext';
import { useTranslation } from 'react-i18next';
import { FaSearch, FaMapMarkedAlt, FaBullseye, FaStar, FaStore, FaInfoCircle } from 'react-icons/fa';

const RestaurantDirectory = () => {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const context = useInvitations();

    // Safety check for context
    const restaurants = context?.restaurants || [];

    const [searchQuery, setSearchQuery] = useState('');
    const [cityFilter, setCityFilter] = useState('All');
    const [viewMode, setViewMode] = useState('list');

    const mapRef = useRef(null);
    const mapInstance = useRef(null);

    const cities = [
        { id: 'All', label: i18n.language === 'ar' ? 'الكل' : 'All' },
        { id: 'الرياض', label: i18n.language === 'ar' ? 'الرياض' : 'Riyadh' },
        { id: 'جدة', label: i18n.language === 'ar' ? 'جدة' : 'Jeddah' },
        { id: 'الخبر', label: i18n.language === 'ar' ? 'الخبر' : 'Khobar' },
    ];

    const filteredRestaurants = useMemo(() => {
        return restaurants.filter(res => {
            if (!res) return false;
            const matchesSearch = !searchQuery ||
                (res.name?.toLowerCase().includes(searchQuery.toLowerCase())) ||
                (res.type?.toLowerCase().includes(searchQuery.toLowerCase()));
            const matchesCity = cityFilter === 'All' || (res.location && res.location.includes(cityFilter));
            return matchesSearch && matchesCity;
        });
    }, [restaurants, searchQuery, cityFilter]);

    const resetMapView = () => {
        const L = window.L;
        if (mapInstance.current && L) {
            const validRes = filteredRestaurants.filter(r => r.lat && r.lng);
            if (validRes.length > 0) {
                const latLngs = validRes.map(r => [r.lat, r.lng]);
                mapInstance.current.flyToBounds(latLngs, { padding: [50, 50], duration: 1.5 });
            } else {
                mapInstance.current.flyTo([24.7136, 46.6753], 6, { duration: 1.5 });
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
                }).setView([24.7136, 46.6753], 6);
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
                                    <img src="${res.image}" class="avatar-marker-image" />
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
                                ${i18n.language === 'ar' ? 'فتح الملف التجاري' : 'Open Profile'}
                            </button>
                        </div>
                    `;

                    L.marker([res.lat, res.lng], { icon: bizIcon })
                        .addTo(mapInstance.current)
                        .bindPopup(popupContent, { className: 'premium-popup' })
                        .on('popupopen', () => {
                            const btn = document.getElementById(`res-popup-btn-${res.id}`);
                            if (btn) btn.onclick = () => navigate(`/restaurant/${res.id}`);
                        });
                }
            });

            if (filteredRestaurants.length > 0) {
                const latLngs = filteredRestaurants.filter(r => r.lat && r.lng).map(r => [r.lat, r.lng]);
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

        // Mock community members - friends first, then others
        const communityMembers = [
            { id: 'user_1', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sultan', isFriend: true },
            { id: 'user_2', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Noura', isFriend: true },
            { id: 'member_1', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Member1', isFriend: false },
            { id: 'member_2', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Member2', isFriend: false },
            { id: 'member_3', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Member3', isFriend: false }
        ];

        return (
            <div
                style={{
                    background: 'var(--bg-card)',
                    borderRadius: '20px',
                    overflow: 'hidden',
                    marginBottom: '1.25rem',
                    border: '1px solid var(--border-color)',
                    cursor: 'pointer',
                    position: 'relative'
                }}
            >
                <div onClick={() => navigate(`/restaurant/${res.id}`)} style={{ position: 'relative', height: '160px' }}>
                    <img src={res.image} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt={res.name} />

                    {/* Rating Badge */}
                    <div style={{ position: 'absolute', top: '12px', right: '12px', background: 'rgba(0,0,0,0.6)', padding: '5px 12px', borderRadius: '10px', color: 'var(--luxury-gold)', fontWeight: '900', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <FaStar /> {res.rating}
                    </div>

                    {/* Profile Info Button */}
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/partner/${res.id}`);
                        }}
                        style={{
                            position: 'absolute',
                            top: '12px',
                            left: '12px',
                            background: 'rgba(139, 92, 246, 0.85)',
                            backdropFilter: 'blur(10px)',
                            border: 'none',
                            color: 'white',
                            width: '36px',
                            height: '36px',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            transition: 'all 0.3s ease',
                            boxShadow: '0 4px 12px rgba(139, 92, 246, 0.4)',
                            fontSize: '1rem'
                        }}
                        title={i18n.language === 'ar' ? 'عرض الملف الكامل' : 'View Full Profile'}
                    >
                        <FaInfoCircle />
                    </button>
                </div>

                <div style={{ padding: '1.25rem' }}>
                    <div onClick={() => navigate(`/restaurant/${res.id}`)}>
                        <h3 style={{ fontSize: '1.2rem', fontWeight: '900', color: 'white', marginBottom: '0.25rem' }}>{res.name}</h3>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>{res.type} • {res.location}</p>
                    </div>

                    {/* Community Section */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '0.75rem', borderTop: '1px solid var(--border-color)' }}>
                        {/* Members Avatars */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                {communityMembers.map((member, index) => (
                                    <div
                                        key={member.id}
                                        style={{
                                            width: '28px',
                                            height: '28px',
                                            borderRadius: '50%',
                                            border: member.isFriend ? '2px solid var(--primary)' : '2px solid var(--bg-body)',
                                            overflow: 'hidden',
                                            marginLeft: index > 0 ? '-8px' : '0',
                                            zIndex: 5 - index,
                                            position: 'relative'
                                        }}
                                    >
                                        <img src={member.avatar} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                                    </div>
                                ))}
                            </div>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                                +1,229
                            </span>
                        </div>

                        {/* Join Button */}
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                toggleCommunity(res.id);
                            }}
                            style={{
                                background: isJoined ? 'transparent' : 'var(--primary)',
                                border: isJoined ? '1px solid var(--primary)' : 'none',
                                color: 'white',
                                padding: '6px 14px',
                                borderRadius: '10px',
                                fontSize: '0.7rem',
                                fontWeight: '800',
                                cursor: 'pointer',
                                whiteSpace: 'nowrap',
                                transition: 'all 0.2s'
                            }}
                        >
                            {isJoined
                                ? (i18n.language === 'ar' ? '✓ عضو' : '✓ Joined')
                                : (i18n.language === 'ar' ? '+ انضم' : '+ Join')}
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="directory-page" style={{ paddingBottom: '100px', animation: 'fadeIn 0.5s ease-out', minHeight: '100vh' }}>
            <div style={{ padding: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <h1 style={{ fontSize: '1.6rem', fontWeight: '900' }}>{i18n.language === 'ar' ? 'دليل الشركاء' : 'Partner Directory'}</h1>
                    <div style={{ background: 'var(--bg-card)', padding: '4px', borderRadius: '50px', display: 'flex', border: '1px solid var(--border-color)' }}>
                        <button onClick={() => setViewMode('list')} style={{ padding: '6px 16px', borderRadius: '50px', background: viewMode === 'list' ? 'var(--luxury-gold)' : 'transparent', color: viewMode === 'list' ? 'black' : 'white', border: 'none' }}>قائمة</button>
                        <button onClick={() => setViewMode('map')} style={{ padding: '6px 16px', borderRadius: '50px', background: viewMode === 'map' ? 'var(--luxury-gold)' : 'transparent', color: viewMode === 'map' ? 'black' : 'white', border: 'none' }}>خريطة</button>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
                    <input
                        type="text"
                        placeholder={i18n.language === 'ar' ? 'بحث عن مطعم..' : 'Search venues..'}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="input-field"
                        style={{ flex: 1, borderRadius: '12px' }}
                    />
                    <select
                        value={cityFilter}
                        onChange={(e) => setCityFilter(e.target.value)}
                        style={{ background: 'var(--bg-card)', color: 'white', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '0 10px' }}
                    >
                        {cities.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
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
                        {filteredRestaurants.length === 0 && <p style={{ textAlign: 'center', opacity: 0.5 }}>{i18n.language === 'ar' ? 'لا يوجد نتائج' : 'No results'}</p>}
                    </div>
                )}
            </div>
        </div>
    );
};

export default RestaurantDirectory;
