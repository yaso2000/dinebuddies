import React, { useState, useRef, useEffect } from 'react';
import { FaMapMarkerAlt, FaSearch, FaStore, FaStar, FaGlobe, FaTimes } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '../firebase/config';
import LocationAutocomplete from './LocationAutocomplete';
import { sortDineBuddiesVenues } from '../utils/invitationVenueSearch';
import './venue-search.css';

/**
 * VenueLocationPicker
 * Toggle between DineBuddies registered venues and Google Places search.
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
    /** Invitation venue type (Restaurant, Cafe, …) — ranks matching partners & Google predictions. */
    invitationType,
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

    // When parent prefills `location` (offers, deep links), mirror it into the DineBuddies field.
    useEffect(() => {
        if (source !== 'dinebuddies') return;
        const v = String(value ?? '').trim();
        if (!v) return;
        setDbQuery((prev) => (String(prev ?? '').trim() === v ? prev : String(value ?? '')));
    }, [source, value]);

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

            const ranked = sortDineBuddiesVenues(results, city, undefined);
            setDbResults(ranked.slice(0, 10));
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
        <div ref={wrapperRef} className="venue-location-picker">
            {/* Toggle */}
            <div className="venue-search-segment">
                <button
                    type="button"
                    onClick={() => switchSource('dinebuddies')}
                    className={`venue-search-segment__btn${source === 'dinebuddies' ? ' venue-search-segment__btn--active' : ''}`}
                >
                    <FaStore style={{ fontSize: '0.85rem' }} />
                    {t('dinbuddies_venues', 'DineBuddies Venues')}
                </button>

                <button
                    type="button"
                    onClick={() => switchSource('google')}
                    className={`venue-search-segment__btn${source === 'google' ? ' venue-search-segment__btn--active' : ''}`}
                >
                    <FaGlobe style={{ fontSize: '0.85rem' }} />
                    {t('google_places', 'Google Places')}
                </button>
            </div>

            {source === 'google' && (
                <p style={{
                    fontSize: '0.72rem',
                    color: 'var(--text-muted)',
                    margin: '0 0 8px 0',
                    lineHeight: 1.35,
                }}>
                    {t('venue_google_search_hint', 'Search by Google Places within your detected city.')}
                </p>
            )}

            {/* DineBuddies search input */}
            {source === 'dinebuddies' && (
                <div style={{ position: 'relative' }}>
                    <input
                        type="text"
                        name="location"
                        value={dbQuery}
                        onChange={handleDbInput}
                        onFocus={() => dbQuery.length >= 2 && setShowDbDropdown(true)}
                        placeholder={t('search_dineBuddies_venue', 'Search registered venues on DineBuddies...')}
                        className={`input-field ${className}`}
                        autoComplete="off"
                        required
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
                        <div className="venue-search-dropdown venue-search-dropdown--tight">
                            {dbLoading && (
                                <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                    {t('searching', 'Searching...')}
                                </div>
                            )}

                            {!dbLoading && dbResults.length === 0 && dbQuery.length >= 2 && (
                                <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                    <div style={{ marginBottom: 6 }}>😕 {t('no_venues_found', 'No registered venues found')}</div>
                                    <div style={{ fontSize: '0.75rem', opacity: 0.6 }}>
                                        {t('try_osm_places_hint', 'Search all places (OpenStreetMap) for unregistered venues')}
                                    </div>
                                </div>
                            )}

                            {dbResults.map(venue => (
                                <div
                                    key={venue.id}
                                    onClick={() => handleDbSelect(venue)}
                                    className="venue-search-row"
                                >
                                    {/* Venue avatar/image */}
                                    <div className="venue-search-partner-thumb">
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
                                    className="venue-search-footer-hint"
                                >
                                    <FaGlobe style={{ color: 'var(--text-muted)', fontSize: '1rem' }} />
                                    <div>
                                        <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-main)' }}>
                                            {t('switch_to_google', 'Search Google Places instead')}
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

            {/* Mount Google field only when active — avoids hidden `required` input (browser "not focusable" bug). */}
            {source === 'google' && (
                <LocationAutocomplete
                    value={value}
                    onChange={onChange}
                    onSelect={onSelect}
                    city={city}
                    countryCode={countryCode}
                    userLat={userLat}
                    userLng={userLng}
                    invitationType={invitationType}
                    className={className}
                    useGooglePlacesMinimal
                />
            )}
        </div>
    );
};

export default VenueLocationPicker;
