import React, { useState, useRef, useEffect } from 'react';
import { FaMapMarkerAlt, FaSearch, FaStore, FaStar, FaGlobe, FaTimes } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '../firebase/config';
import { loadGoogleMapsScript } from '../utils/loadGoogleMaps';
import LocationAutocomplete from './LocationAutocomplete';

/**
 * VenueLocationPicker
 * A drop-in replacement for LocationAutocomplete that adds a toggle
 * between searching DineBuddies registered venues and Google Places.
 *
 * Props mirror LocationAutocomplete:
 *   value, onChange, onSelect, city, countryCode, userLat, userLng, className
 *
 * When a DineBuddies venue is selected, onSelect receives the same shape as
 * LocationAutocomplete plus:
 *   { restaurantId, restaurantName, image, avatar, isDineBuddiesVenue: true }
 */
const VenueLocationPicker = ({
    value,
    onChange,
    onSelect,
    city,
    countryCode,
    userLat,
    userLng,
    className = ''
}) => {
    const { t } = useTranslation();
    const [source, setSource] = useState('dinebuddies'); // 'dinebuddies' | 'google'
    const [dbQuery, setDbQuery] = useState('');
    const [dbResults, setDbResults] = useState([]);
    const [dbLoading, setDbLoading] = useState(false);
    const [showDbDropdown, setShowDbDropdown] = useState(false);
    const wrapperRef = useRef(null);
    const debounceRef = useRef(null);

    // Pre-load Google Maps script immediately so it's ready when user switches to Google tab
    useEffect(() => {
        loadGoogleMapsScript().catch(() => { });
    }, []);

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
                setShowDbDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Search DineBuddies venues
    const searchDineBuddies = async (q) => {
        if (!q || q.length < 2) {
            setDbResults([]);
            setShowDbDropdown(false);
            return;
        }

        setDbLoading(true);
        setShowDbDropdown(true);

        try {
            const qLower = q.toLowerCase();

            // Query published business profiles
            const snap = await getDocs(
                query(
                    collection(db, 'public_profiles'),
                    where('profileType', '==', 'business'),
                    where('businessPublic.isPublished', '==', true),
                    limit(30)
                )
            );

            const results = [];
            snap.forEach(doc => {
                const data = doc.data();
                const info = data.businessPublic || {};
                const name = (data.displayName || '').toLowerCase();
                const address = (info.address || info.city || '').toLowerCase();
                const cityField = (info.city || '').toLowerCase();

                // Basic partial match filter
                if (name.includes(qLower) || address.includes(qLower) || cityField.includes(qLower)) {
                    results.push({
                        id: doc.id,
                        name: data.displayName || 'Venue',
                        address: info.address || info.city || '',
                        city: info.city || '',
                        lat: info.lat,
                        lng: info.lng,
                        image: info.coverImage || '',
                        avatar: data.avatarUrl || '',
                        businessType: info.businessType || 'Restaurant',
                        rating: null,
                    });
                }
            });

            // Sort: city match first
            if (city) {
                const cityLower = city.toLowerCase();
                results.sort((a, b) => {
                    const aMatch = a.city.toLowerCase().includes(cityLower);
                    const bMatch = b.city.toLowerCase().includes(cityLower);
                    if (aMatch && !bMatch) return -1;
                    if (!aMatch && bMatch) return 1;
                    return 0;
                });
            }

            setDbResults(results.slice(0, 10));
        } catch (err) {
            console.error('DineBuddies venue search error:', err);
            setDbResults([]);
        } finally {
            setDbLoading(false);
        }
    };

    const handleDbInput = (e) => {
        const val = e.target.value;
        setDbQuery(val);

        // Sync with parent onChange so the form value stays consistent
        onChange({ target: { value: val, name: 'location' } });

        clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => searchDineBuddies(val), 350);
    };

    const handleDbSelect = (venue) => {
        setDbQuery(venue.name);
        setShowDbDropdown(false);

        // Update parent form value
        onChange({ target: { value: venue.name, name: 'location' } });

        // Call parent onSelect with enriched data
        onSelect({
            name: venue.name,
            fullAddress: venue.address,
            lat: venue.lat,
            lng: venue.lng,
            restaurantId: venue.id,
            restaurantName: venue.name,
            image: venue.image,
            avatar: venue.avatar,
            isDineBuddiesVenue: true,
            photos: venue.image ? [venue.image] : []
        });
    };

    const clearSelection = () => {
        setDbQuery('');
        onChange({ target: { value: '', name: 'location' } });
        setDbResults([]);
        setShowDbDropdown(false);
    };

    const switchSource = (newSource) => {
        setSource(newSource);
        setDbQuery('');
        setDbResults([]);
        setShowDbDropdown(false);
        // Clear parent value too
        onChange({ target: { value: '', name: 'location' } });
    };

    return (
        <div ref={wrapperRef}>
            {/* Toggle */}
            <div style={{
                display: 'flex',
                gap: 6,
                marginBottom: 10,
                background: 'var(--bg-input)',
                borderRadius: 12,
                padding: '4px',
                border: '1px solid var(--border-color)'
            }}>
                <button
                    type="button"
                    onClick={() => switchSource('dinebuddies')}
                    style={{
                        flex: 1,
                        padding: '8px 10px',
                        borderRadius: 9,
                        border: 'none',
                        cursor: 'pointer',
                        fontWeight: 700,
                        fontSize: '0.8rem',
                        transition: 'all 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        background: source === 'dinebuddies'
                            ? 'var(--primary)'
                            : 'transparent',
                        color: source === 'dinebuddies' ? 'white' : 'var(--text-muted)'
                    }}
                >
                    <FaStore style={{ fontSize: '0.85rem' }} />
                    {t('dinbuddies_venues', 'DineBuddies Venues')}
                </button>

                <button
                    type="button"
                    onClick={() => switchSource('google')}
                    style={{
                        flex: 1,
                        padding: '8px 10px',
                        borderRadius: 9,
                        border: 'none',
                        cursor: 'pointer',
                        fontWeight: 700,
                        fontSize: '0.8rem',
                        transition: 'all 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        background: source === 'google'
                            ? 'var(--primary)'
                            : 'transparent',
                        color: source === 'google' ? 'white' : 'var(--text-muted)'
                    }}
                >
                    <FaGlobe style={{ fontSize: '0.85rem' }} />
                    {t('google_places', 'Google Places')}
                </button>
            </div>

            {/* DineBuddies search input */}
            {source === 'dinebuddies' && (
                <div style={{ position: 'relative' }}>
                    <input
                        type="text"
                        value={dbQuery}
                        onChange={handleDbInput}
                        onFocus={() => dbQuery.length >= 2 && setShowDbDropdown(true)}
                        placeholder={t('search_dineBuddies_venue', 'Search registered venues on DineBuddies...')}
                        className={`input-field ${className}`}
                        autoComplete="off"
                        style={{ paddingRight: dbQuery ? '36px' : undefined }}
                    />

                    {/* Loading spinner or clear button */}
                    <div style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)' }}>
                        {dbLoading
                            ? <FaSearch style={{ opacity: 0.4, fontSize: '0.85rem', animation: 'spin 1s linear infinite' }} />
                            : dbQuery
                                ? <FaTimes
                                    style={{ opacity: 0.5, cursor: 'pointer', fontSize: '0.85rem' }}
                                    onClick={clearSelection}
                                />
                                : null
                        }
                    </div>

                    {/* Dropdown */}
                    {showDbDropdown && (
                        <div style={{
                            position: 'absolute',
                            top: '100%',
                            left: 0,
                            right: 0,
                            background: 'var(--bg-card)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '0 0 12px 12px',
                            zIndex: 1000,
                            boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                            maxHeight: 320,
                            overflowY: 'auto'
                        }}>
                            {dbLoading && (
                                <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                    {t('searching', 'Searching...')}
                                </div>
                            )}

                            {!dbLoading && dbResults.length === 0 && dbQuery.length >= 2 && (
                                <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                    <div style={{ marginBottom: 6 }}>😕 {t('no_venues_found', 'No registered venues found')}</div>
                                    <div style={{ fontSize: '0.75rem', opacity: 0.6 }}>
                                        {t('try_google_places_hint', 'Try Google Places for unregistered venues')}
                                    </div>
                                </div>
                            )}

                            {dbResults.map(venue => (
                                <div
                                    key={venue.id}
                                    onClick={() => handleDbSelect(venue)}
                                    style={{
                                        padding: '12px 16px',
                                        cursor: 'pointer',
                                        borderBottom: '1px solid var(--border-color)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 12,
                                        transition: 'background 0.15s'
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.background = 'var(--hover-overlay)'}
                                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                >
                                    {/* Venue avatar/image */}
                                    <div style={{
                                        width: 42, height: 42, borderRadius: '10px',
                                        overflow: 'hidden', flexShrink: 0,
                                        background: 'var(--bg-input)',
                                        border: '1px solid var(--border-color)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                                    }}>
                                        {venue.avatar || venue.image
                                            ? <img
                                                src={venue.avatar || venue.image}
                                                alt={venue.name}
                                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                            />
                                            : <FaStore style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }} />
                                        }
                                    </div>

                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-main)', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {venue.name}
                                        </div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {venue.address || venue.city}
                                        </div>
                                    </div>

                                    {/* DineBuddies badge */}
                                    <div style={{
                                        fontSize: '0.6rem', background: 'var(--primary)', color: 'white',
                                        padding: '3px 7px', borderRadius: 4, fontWeight: 800,
                                        flexShrink: 0, whiteSpace: 'nowrap'
                                    }}>
                                        DB ✓
                                    </div>
                                </div>
                            ))}

                            {/* Hint to switch to Google */}
                            {!dbLoading && (
                                <div
                                    onClick={() => switchSource('google')}
                                    style={{
                                        padding: '12px 16px',
                                        cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', gap: 10,
                                        background: 'var(--bg-input)',
                                        borderTop: '1px solid var(--border-color)',
                                        transition: 'background 0.15s'
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.background = 'var(--hover-overlay)'}
                                    onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-input)'}
                                >
                                    <FaGlobe style={{ color: 'var(--text-muted)', fontSize: '1rem' }} />
                                    <div>
                                        <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-main)' }}>
                                            {t('switch_to_google', 'Search on Google Places instead')}
                                        </div>
                                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                            {t('for_unregistered_venues', 'For venues not yet on DineBuddies')}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Google Places — always mounted so service initializes immediately; shown/hidden via CSS */}
            <div style={{ display: source === 'google' ? 'block' : 'none' }}>
                <LocationAutocomplete
                    value={value}
                    onChange={onChange}
                    onSelect={onSelect}
                    city={city}
                    countryCode={countryCode}
                    userLat={userLat}
                    userLng={userLng}
                    className={className}
                />
            </div>
        </div>
    );
};

export default VenueLocationPicker;
