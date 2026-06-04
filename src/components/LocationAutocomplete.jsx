import React, { useState, useEffect, useRef, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { FaMapMarkerAlt, FaSearch, FaStore } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';
import { geocode } from '../utils/locationUtils';
import { resolveCountryIso2 } from '../utils/countryIso';
import { PLACES_AUTOCOMPLETE_DEBOUNCE_MS } from '../utils/placesCostControl';
import {
    fetchCityBoundingBox,
    searchPhoton,
    filterPhotonByCityName,
    photonFeatureToVenuePayload,
} from '../utils/osmPhotonSearch';
import './venue-search.css';

const PHOTON_CACHE_MAX = 64;
const photonCache = new Map();

function newPlacesSessionToken() {
    // Places API (New): URL-safe token, max 36 chars.
    const bytes = new Uint8Array(18);
    if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
        crypto.getRandomValues(bytes);
    } else {
        for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
    }
    const raw = btoa(String.fromCharCode(...bytes));
    return raw.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '').slice(0, 36);
}

function makePhotonCacheKey(input, iso2, city, userLat, userLng, hasBbox) {
    const t = String(input || '').trim().toLowerCase();
    return [
        t,
        (iso2 || '').toUpperCase(),
        (city || '').trim().toLowerCase(),
        userLat != null ? String(userLat) : '',
        userLng != null ? String(userLng) : '',
        hasBbox ? '1' : '0',
    ].join('\u001f');
}

function cachePhoton(key, features) {
    if (photonCache.size >= PHOTON_CACHE_MAX) {
        const first = photonCache.keys().next().value;
        if (first !== undefined) photonCache.delete(first);
    }
    photonCache.set(key, features);
}

const LocationAutocomplete = ({
    value,
    onChange,
    onSelect,
    city,
    countryCode,
    userLat,
    userLng,
    className = '',
    style = {},
    inputStyle = {},
    placeholder: placeholderProp,
    'aria-label': ariaLabelProp,
    useGooglePlacesMinimal = false,
}) => {
    const { t, i18n } = useTranslation();
    const [suggestions, setSuggestions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [dropdownFixed, setDropdownFixed] = useState(null);
    const wrapperRef = useRef(null);
    const inputRef = useRef(null);
    const dropdownPortalRef = useRef(null);
    const cityBboxRef = useRef(null);
    const placesInputDebounceRef = useRef(null);
    const placesGenerationRef = useRef(0);
    const placesSearchRunIdRef = useRef(0);
    const sessionTokenRef = useRef(newPlacesSessionToken());

    const countryIsoResolved = resolveCountryIso2(countryCode);
    const lang = typeof i18n.language === 'string' ? i18n.language.split('-')[0] : 'en';

    useEffect(() => {
        let cancelled = false;
        cityBboxRef.current = null;
        const c = String(city || '').trim();
        const iso = countryIsoResolved;
        if (c.length < 2 || !iso) return undefined;

        (async () => {
            const bbox = await fetchCityBoundingBox(c, iso);
            if (!cancelled) cityBboxRef.current = bbox;
        })();
        return () => {
            cancelled = true;
        };
    }, [city, countryIsoResolved]);

    const updateDropdownPosition = useCallback(() => {
        const open = showSuggestions && String(value || '').trim().length >= 3;
        if (!open) {
            setDropdownFixed(null);
            return;
        }
        const el = inputRef.current || wrapperRef.current;
        if (!el?.getBoundingClientRect) return;
        const r = el.getBoundingClientRect();
        const gap = 4;
        setDropdownFixed({
            top: r.bottom + gap,
            left: r.left,
            width: Math.max(r.width, 200),
        });
    }, [showSuggestions, value]);

    useLayoutEffect(() => {
        updateDropdownPosition();
    }, [updateDropdownPosition, suggestions, loading]);

    useEffect(() => {
        const open = showSuggestions && String(value || '').trim().length >= 3;
        if (!open) {
            setDropdownFixed(null);
            return undefined;
        }
        updateDropdownPosition();
        const onScrollOrResize = () => updateDropdownPosition();
        window.addEventListener('scroll', onScrollOrResize, true);
        window.addEventListener('resize', onScrollOrResize);
        return () => {
            window.removeEventListener('scroll', onScrollOrResize, true);
            window.removeEventListener('resize', onScrollOrResize);
        };
    }, [showSuggestions, value, updateDropdownPosition]);

    useEffect(() => {
        function handleClickOutside(event) {
            const t = event.target;
            if (wrapperRef.current?.contains(t)) return;
            if (dropdownPortalRef.current?.contains(t)) return;
            setShowSuggestions(false);
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => () => {
        if (placesInputDebounceRef.current) clearTimeout(placesInputDebounceRef.current);
    }, []);

    const rotateSessionToken = useCallback(() => {
        sessionTokenRef.current = newPlacesSessionToken();
    }, []);

    const searchGoogleAutocomplete = useCallback(
        async ({ trimmedInput, bbox, isStale }) => {
            const params = new URLSearchParams({
                input: trimmedInput,
                sessionToken: sessionTokenRef.current,
                languageCode: lang,
            });
            if (countryIsoResolved) params.set('countryCode', countryIsoResolved);
            if (bbox?.minLat != null && bbox?.minLon != null && bbox?.maxLat != null && bbox?.maxLon != null) {
                params.set('minLat', String(bbox.minLat));
                params.set('minLon', String(bbox.minLon));
                params.set('maxLat', String(bbox.maxLat));
                params.set('maxLon', String(bbox.maxLon));
            }
            const response = await fetch(`/api/place-autocomplete?${params.toString()}`);
            const data = await response.json();
            if (isStale()) return;
            if (!response.ok) {
                throw new Error(data?.error || 'Google autocomplete request failed');
            }
            const predictions = Array.isArray(data?.predictions) ? data.predictions : [];
            setSuggestions(
                predictions.map((p) => ({
                    source: 'google',
                    placeId: p.place_id,
                    name: p.structured_formatting?.main_text || p.description || '',
                    address: p.structured_formatting?.secondary_text || p.description || '',
                    full_description: p.description || '',
                    types: [],
                }))
            );
            setLoading(false);
        },
        [countryIsoResolved, lang]
    );

    const handleInput = (e) => {
        const val = e.target.value;
        onChange(e);

        if (placesInputDebounceRef.current) clearTimeout(placesInputDebounceRef.current);

        if (val.length < 3) {
            placesGenerationRef.current += 1;
            placesSearchRunIdRef.current += 1;
            setSuggestions([]);
            setShowSuggestions(false);
            setLoading(false);
            if (useGooglePlacesMinimal && val.length === 0) rotateSessionToken();
            return;
        }

        setLoading(true);
        setShowSuggestions(true);
        placesGenerationRef.current += 1;
        const generation = placesGenerationRef.current;

        placesInputDebounceRef.current = setTimeout(() => {
            placesInputDebounceRef.current = null;
            placesSearchRunIdRef.current += 1;
            const searchRunId = placesSearchRunIdRef.current;
            const isStale = () =>
                searchRunId !== placesSearchRunIdRef.current || generation !== placesGenerationRef.current;

            const trimmedInput = String(val).trim();
            const bbox = cityBboxRef.current;
            const cacheKey = makePhotonCacheKey(
                trimmedInput,
                countryIsoResolved,
                city,
                userLat,
                userLng,
                !!bbox
            );

            const runPhoton = async () => {
                if (useGooglePlacesMinimal) {
                    await searchGoogleAutocomplete({ trimmedInput, bbox, isStale });
                    return;
                }
                let features;
                if (photonCache.has(cacheKey)) {
                    features = photonCache.get(cacheKey) ?? [];
                } else {
                    const { features: raw } = await searchPhoton({
                        query: trimmedInput,
                        lang,
                        limit: 14,
                        bbox: bbox || undefined,
                        lat: userLat != null ? Number(userLat) : undefined,
                        lon: userLng != null ? Number(userLng) : undefined,
                    });
                    features = city ? filterPhotonByCityName(raw, city) : raw;
                    cachePhoton(cacheKey, features);
                }

                if (isStale()) return;

                if (features.length) {
                    setSuggestions(
                        features.map((f) => {
                            const payload = photonFeatureToVenuePayload(f);
                            const p = f.properties || {};
                            const addrLine = [
                                [p.housenumber, p.street].filter(Boolean).join(' '),
                                p.city || p.town,
                            ]
                                .filter(Boolean)
                                .join(', ');
                            return {
                                source: 'osm',
                                name: payload.name,
                                address: addrLine || p.country || '',
                                full_description: addrLine || payload.name,
                                types: payload.types,
                                photonFeature: f,
                            };
                        })
                    );
                    setLoading(false);
                    return;
                }

                const geoQuery = city ? `${trimmedInput}, ${city}` : trimmedInput;
                const result = await geocode(geoQuery);
                if (isStale()) return;
                if (result.success && result.results?.length) {
                    setSuggestions(
                        result.results.map((item) => ({
                            fallback: true,
                            name: item.raw?.name || item.displayName.split(',')[0],
                            address: item.displayName,
                            lat: item.lat,
                            lng: item.lng,
                        }))
                    );
                } else {
                    setSuggestions([]);
                }
                setLoading(false);
            };

            runPhoton().catch((err) => {
                console.error('[LocationAutocomplete] OSM search failed:', err);
                if (!isStale()) {
                    setSuggestions([]);
                    setLoading(false);
                }
            });
        }, PLACES_AUTOCOMPLETE_DEBOUNCE_MS);
    };

    const handleSelectSuggestion = async (place) => {
        if (useGooglePlacesMinimal && place.source === 'google' && place.placeId) {
            setLoading(true);
            try {
                const params = new URLSearchParams({
                    placeId: place.placeId,
                    sessionToken: sessionTokenRef.current,
                    languageCode: lang,
                });
                if (countryIsoResolved) params.set('regionCode', countryIsoResolved);
                const response = await fetch(`/api/place-details?${params.toString()}`);
                const data = await response.json();
                if (!response.ok) throw new Error(data?.error || 'Google details request failed');
                onSelect({
                    name: data.businessName || place.name || '',
                    fullAddress: data.address || place.full_description || place.address || '',
                    city: data.city || '',
                    country: data.country || '',
                    countryCode: data.countryCode || '',
                    lat: data.lat ?? null,
                    lng: data.lng ?? null,
                    placeId: data.placeId || place.placeId,
                    types: [],
                    addressComponents: data.addressComponents || [],
                    photos: [],
                    rating: null,
                    userRatingsTotal: null,
                    priceLevel: null,
                    phone: '',
                    website: '',
                    openingHours: null,
                    businessStatus: null,
                    editorialSummary: '',
                });
                setShowSuggestions(false);
                setLoading(false);
                rotateSessionToken();
                return;
            } catch (err) {
                console.error('[LocationAutocomplete] Google details failed:', err);
                setLoading(false);
            }
        }
        if (place.fallback) {
            onSelect({
                name: place.name,
                fullAddress: place.address,
                lat: place.lat,
                lng: place.lng,
                placeId: null,
                types: [],
                addressComponents: [],
                photos: [],
                rating: null,
                userRatingsTotal: null,
                priceLevel: null,
                phone: '',
                website: '',
                openingHours: null,
                businessStatus: null,
                editorialSummary: '',
            });
            setShowSuggestions(false);
            return;
        }
        if (place.photonFeature) {
            onSelect(photonFeatureToVenuePayload(place.photonFeature));
        }
        setShowSuggestions(false);
    };

    const defaultInputStyle = {
        width: '100%',
        padding: '12px 12px 12px 1rem',
        background: 'var(--bg-input)',
        border: '1px solid var(--border-color)',
        borderRadius: '12px',
        color: 'var(--text-main)',
        fontSize: '1rem',
        outline: 'none',
        boxSizing: 'border-box',
    };

    const getIconForTypes = (types) => {
        if (!types) return <FaMapMarkerAlt />;
        const t = new Set(types);
        if (t.has('night_club')) return <FaStore style={{ color: '#ec4899' }} />;
        if (t.has('bar')) return <FaStore style={{ color: '#a855f7' }} />;
        if (t.has('restaurant')) return <FaStore style={{ color: '#f59e0b' }} />;
        return <FaMapMarkerAlt style={{ color: '#0ea5e9' }} />;
    };

    const isRtl = typeof i18n.dir === 'function' && i18n.dir(i18n.language) === 'rtl';
    const spinnerEdge = isRtl ? 'right' : 'left';

    return (
        <div
            className={`location-autocomplete venue-location-picker ${className}`}
            ref={wrapperRef}
            style={{ position: 'relative', width: '100%', ...style }}
        >
            <input
                ref={inputRef}
                type="text"
                name="location"
                placeholder={
                    placeholderProp ||
                    (city ? t('form_location_placeholder_with_city', { city }) : t('form_location_placeholder'))
                }
                aria-label={ariaLabelProp || undefined}
                value={value}
                onChange={handleInput}
                required
                style={{
                    ...defaultInputStyle,
                    ...inputStyle,
                    ...(loading ? { paddingInlineStart: '2.5rem' } : {}),
                }}
                autoComplete="off"
            />
            {loading && (
                <div style={{ position: 'absolute', [spinnerEdge]: '12px', top: '14px', color: '#9ca3af' }}>
                    <FaSearch className="spin-animation" style={{ fontSize: '0.9rem' }} />
                </div>
            )}
            {showSuggestions &&
                value.trim().length >= 3 &&
                typeof document !== 'undefined' &&
                document.body &&
                dropdownFixed
                ? createPortal(
                      <div
                          ref={dropdownPortalRef}
                          className="venue-search-dropdown venue-search-dropdown--portal"
                          style={{
                              top: dropdownFixed.top,
                              left: dropdownFixed.left,
                              width: dropdownFixed.width,
                          }}
                          role="listbox"
                          aria-label={t('search_places_placeholder', 'Search places')}
                      >
                          {loading && suggestions.length === 0 && (
                              <div style={{ padding: '14px 16px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                                  {t('searching')}
                              </div>
                          )}
                          {!loading && suggestions.length === 0 && (
                              <div style={{ padding: '14px 16px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                  {t('location_no_results')}
                              </div>
                          )}
                          {suggestions.map((place, index) => (
                              <div
                                  key={index}
                                  role="option"
                                  onClick={() => handleSelectSuggestion(place)}
                                  className="venue-search-row"
                              >
                                  <div className="venue-search-icon">{getIconForTypes(place.types)}</div>
                                  <div style={{ flex: 1 }}>
                                      <div
                                          style={{
                                              fontWeight: '700',
                                              fontSize: '0.95rem',
                                              color: 'var(--text-main)',
                                              marginBottom: '3px',
                                          }}
                                      >
                                          {place.name}
                                      </div>
                                      <div
                                          style={{
                                              fontSize: '0.8rem',
                                              color: 'var(--text-secondary)',
                                              lineHeight: '1.3',
                                          }}
                                      >
                                          {place.address || place.full_description}
                                      </div>
                                  </div>
                              </div>
                          ))}
                      </div>,
                      document.body
                  )
                : null}
        </div>
    );
};

export default LocationAutocomplete;
