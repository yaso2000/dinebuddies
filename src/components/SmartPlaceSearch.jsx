import React, { useState, useEffect, useRef } from 'react';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '../firebase/config';
import { FaSearch, FaMapMarkerAlt, FaStore } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';
import { getSafeAvatar } from '../utils/avatarUtils';
import { parseGoogleAddressComponents } from '../utils/googlePlacesBusiness';
import { resolveCountryIso2 } from '../utils/countryIso';
import { PLACES_AUTOCOMPLETE_DEBOUNCE_MS } from '../utils/placesCostControl';
import {
    fetchCityBoundingBox,
    searchPhoton,
    filterPhotonByCityName,
    photonFeatureToVenuePayload,
    searchNominatimCities,
} from '../utils/osmPhotonSearch';
import './venue-search.css';

const SmartPlaceSearch = ({
    onSelect,
    excludeIds = [],
    searchType = 'establishment',
    cityBias = null,
    countryCode = null,
    showPartnerResults = true,
    fetchExtendedBusinessDetails = false,
}) => {
    const { t, i18n } = useTranslation();
    const isRtl = typeof i18n.dir === 'function' && i18n.dir(i18n.language) === 'rtl';
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState({ partners: [], osm: [] });
    const [showResults, setShowResults] = useState(false);
    const cityBboxRef = useRef(null);
    const wrapperRef = useRef(null);
    const searchDebounceRef = useRef(null);
    const searchGenRef = useRef(0);
    const lang = typeof i18n.language === 'string' ? i18n.language.split('-')[0] : 'en';

    const iso = resolveCountryIso2(countryCode);

    useEffect(() => {
        let cancelled = false;
        cityBboxRef.current = null;
        const lat = cityBias?.lat;
        const lng = cityBias?.lng;
        const cityName = cityBias?.city || cityBias?.name;
        if (cityName && iso && typeof cityName === 'string') {
            (async () => {
                const bbox = await fetchCityBoundingBox(cityName, iso);
                if (!cancelled) cityBboxRef.current = bbox;
            })();
        } else if (lat != null && lng != null && Number.isFinite(Number(lat)) && Number.isFinite(Number(lng))) {
            const d = 0.12;
            cityBboxRef.current = {
                minLon: Number(lng) - d,
                minLat: Number(lat) - d,
                maxLon: Number(lng) + d,
                maxLat: Number(lat) + d,
            };
        }
        return () => {
            cancelled = true;
        };
    }, [cityBias, iso]);

    useEffect(() => {
        function handleClickOutside(event) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) setShowResults(false);
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [wrapperRef]);

    useEffect(
        () => () => {
            if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
        },
        []
    );

    const executeSearch = async (text, gen) => {
        const stale = () => gen !== searchGenRef.current;
        if (text.length < 3) {
            if (!stale()) {
                setResults({ partners: [], osm: [] });
                setShowResults(false);
            }
            return;
        }
        if (stale()) return;
        setLoading(true);
        setShowResults(true);

        try {
            let partnersPromise = Promise.resolve({ docs: [] });
            if (showPartnerResults && searchType !== '(cities)' && searchType !== 'geocode') {
                const nt = text.trim().toLowerCase();
                const q = query(
                    collection(db, 'public_profiles'),
                    where('profileType', '==', 'business'),
                    where('businessPublic.isPublished', '==', true),
                    where('search.displayNameLower', '>=', nt),
                    where('search.displayNameLower', '<=', nt + '\uf8ff'),
                    limit(3)
                );
                partnersPromise = getDocs(q);
            }

            let osmPromise;
            if (searchType === '(cities)') {
                osmPromise = searchNominatimCities(text, countryCode).then((rows) =>
                    rows.map((r) => ({
                        id: r.place_id,
                        name: r.main_text,
                        address: r.secondary_text,
                        source: 'osm',
                        nominatim: r.nominatim,
                    }))
                );
            } else {
                osmPromise = (async () => {
                    const bbox = cityBboxRef.current;
                    const { features } = await searchPhoton({
                        query: text,
                        lang,
                        limit: 12,
                        bbox: bbox || undefined,
                        lat: cityBias?.lat != null ? Number(cityBias.lat) : undefined,
                        lon: cityBias?.lng != null ? Number(cityBias.lng) : undefined,
                    });
                    const cityName = cityBias?.city || cityBias?.name;
                    const list = cityName ? filterPhotonByCityName(features, cityName) : features;
                    return list.map((f, i) => {
                        const payload = photonFeatureToVenuePayload(f);
                        const p = f.properties || {};
                        const addr = [
                            [p.housenumber, p.street].filter(Boolean).join(' '),
                            p.city || p.town,
                        ]
                            .filter(Boolean)
                            .join(', ');
                        return {
                            id: payload.placeId || `osm-${i}`,
                            name: payload.name,
                            address: addr || payload.fullAddress,
                            source: 'osm',
                            photonFeature: f,
                        };
                    });
                })();
            }

            const [snap, osm] = await Promise.all([partnersPromise, osmPromise]);
            const partners = snap.docs
                .map((doc) => {
                    const d = doc.data();
                    const bi = d.businessPublic || {};
                    return {
                        id: doc.id,
                        name: d.display_name || 'Business',
                        address: bi.address || bi.city || '',
                        image: getSafeAvatar(d),
                        source: 'business',
                        businessId: doc.id,
                    };
                })
                .filter((p) => !excludeIds.includes(p.id));

            const osmFiltered = (osm || []).filter((g) => !excludeIds.includes(g.id));

            if (!stale()) setResults({ partners, osm: osmFiltered });
        } catch (e) {
            console.warn('Search error:', e);
        } finally {
            if (!stale()) setLoading(false);
        }
    };

    const handleSelect = (place) => {
        if (place.source === 'osm' && place.photonFeature) {
            const payload = photonFeatureToVenuePayload(place.photonFeature);
            if (fetchExtendedBusinessDetails) {
                const ap = parseGoogleAddressComponents(payload.addressComponents);
                onSelect({
                    ...place,
                    source: 'osm',
                    name: payload.name,
                    address: payload.fullAddress,
                    placeId: payload.placeId,
                    location: { lat: payload.lat, lng: payload.lng },
                    phone: '',
                    website: payload.website || '',
                    openingHours: null,
                    editorialSummary: '',
                    city: ap.city,
                    country: ap.country,
                    countryCode: ap.countryCode,
                    googleTypes: payload.types || [],
                });
            } else {
                onSelect({
                    ...place,
                    name: payload.name,
                    address: payload.fullAddress,
                    image: undefined,
                    photos: [],
                    location: { lat: payload.lat, lng: payload.lng },
                    placeId: payload.placeId,
                });
            }
        } else if (place.source === 'osm' && place.nominatim) {
            const lat = parseFloat(place.nominatim.lat);
            const lng = parseFloat(place.nominatim.lon);
            onSelect({
                ...place,
                name: place.name,
                address: place.address,
                location: { lat, lng },
                placeId: place.id,
            });
        } else onSelect(place);
        setInput('');
        setShowResults(false);
    };

    const skeletonStyle = {
        background: 'linear-gradient(90deg, rgba(255,255,255,0.05) 25%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.05) 75%)',
        backgroundSize: '200% 100%',
        animation: 'shimmer 1.5s infinite',
        borderRadius: '8px',
    };

    return (
        <div ref={wrapperRef} className="venue-location-picker" style={{ width: '100%' }}>
            <div style={{ position: 'relative' }}>
                <FaSearch
                    style={{
                        position: 'absolute',
                        [isRtl ? 'right' : 'left']: '12px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: '#9ca3af',
                    }}
                />
                <input
                    type="text"
                    value={input}
                    onChange={(e) => {
                        const v = e.target.value;
                        setInput(v);
                        if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
                        if (v.length < 3) {
                            searchGenRef.current += 1;
                            setResults({ partners: [], osm: [] });
                            setShowResults(false);
                            setLoading(false);
                            return;
                        }
                        searchGenRef.current += 1;
                        const gen = searchGenRef.current;
                        searchDebounceRef.current = setTimeout(() => {
                            searchDebounceRef.current = null;
                            void executeSearch(v, gen);
                        }, PLACES_AUTOCOMPLETE_DEBOUNCE_MS);
                    }}
                    placeholder={
                        fetchExtendedBusinessDetails
                            ? t('business_onboarding_google_placeholder')
                            : t('search_places_placeholder') || 'Search for restaurants, cafes…'
                    }
                    style={{
                        width: '100%',
                        padding: isRtl ? '12px 40px 12px 12px' : '12px 12px 12px 40px',
                        borderRadius: '12px',
                        border: '1px solid var(--border-color)',
                        background: 'var(--bg-input)',
                        color: 'var(--text-main)',
                        fontSize: '1rem',
                        outline: 'none',
                        boxSizing: 'border-box',
                    }}
                />
                {loading && (
                    <div
                        style={{
                            position: 'absolute',
                            [isRtl ? 'left' : 'right']: '12px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                        }}
                    >
                        <div
                            className="spinner-mini"
                            style={{
                                width: '16px',
                                height: '16px',
                                border: '2px solid #ccc',
                                borderTopColor: '#333',
                                borderRadius: '50%',
                                animation: 'spin 1s linear infinite',
                            }}
                        />
                    </div>
                )}
            </div>
            {showResults && (loading || results.partners.length > 0 || results.osm.length > 0) && (
                <div className="venue-search-dropdown">
                    {loading && (
                        <div style={{ padding: '12px' }}>
                            {[1, 2, 3, 4].map((i) => (
                                <div
                                    key={`skeleton-${i}`}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '12px',
                                        padding: '10px 0',
                                        borderBottom: i < 4 ? '1px solid var(--border-color)' : 'none',
                                    }}
                                >
                                    <div style={{ width: '40px', height: '40px', borderRadius: '8px', ...skeletonStyle }} />
                                    <div style={{ flex: 1 }}>
                                        <div style={{ width: '70%', height: '14px', marginBottom: '6px', ...skeletonStyle }} />
                                        <div style={{ width: '50%', height: '12px', ...skeletonStyle }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                    {showPartnerResults && !loading && results.partners.length > 0 && (
                        <div style={{ padding: '8px 0' }}>
                            <div className="venue-search-section-label venue-search-section-label--accent">DineBuddies Partners</div>
                            {results.partners.map((item) => (
                                <div key={item.id} onClick={() => handleSelect(item)} className="venue-search-row">
                                    <div className="venue-search-partner-thumb">
                                        <img
                                            src={item.image || 'https://via.placeholder.com/40'}
                                            alt={item.name}
                                            onError={(e) => {
                                                e.target.src = 'https://via.placeholder.com/40?text=?';
                                            }}
                                            style={{ minWidth: '100%', minHeight: '100%', objectFit: 'cover' }}
                                        />
                                    </div>
                                    <div>
                                        <div style={{ fontWeight: '600', color: 'var(--text-main)' }}>
                                            {item.name} <span style={{ color: 'var(--primary)', fontSize: '0.8em' }}>✓</span>
                                        </div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{item.address}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                    {!loading && results.osm.length > 0 && (
                        <div
                            style={{
                                padding: '8px 0',
                                borderTop: showPartnerResults && results.partners.length > 0 ? '1px solid var(--border-color)' : 'none',
                            }}
                        >
                            <div className="venue-search-section-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <FaStore /> OpenStreetMap
                            </div>
                            {results.osm.map((item) => (
                                <div key={item.id} onClick={() => handleSelect(item)} className="venue-search-row">
                                    <div className="venue-search-google-pin">
                                        <FaMapMarkerAlt />
                                    </div>
                                    <div>
                                        <div style={{ fontWeight: '600', color: 'var(--text-main)' }}>{item.name}</div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{item.address}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default SmartPlaceSearch;
