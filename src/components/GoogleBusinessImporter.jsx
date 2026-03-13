import React, { useState, useEffect, useRef } from 'react';
import { FaGoogle, FaSearch, FaSpinner, FaCheck, FaTimes } from 'react-icons/fa';
import { loadGoogleMapsScript } from '../utils/loadGoogleMaps';
import { fetchPlaceDetails, extractPlaceIdFromUrl } from '../utils/googleBusinessService';

/**
 * Import business data from Google Business (via Places API).
 * User can search by business name or paste a Google Maps URL.
 *
 * Note: Menu data is not available from the Places API.
 */
const GoogleBusinessImporter = ({ onImport, onCancel, onUseAnyway, importError, city, countryCode, userLat, userLng }) => {
    const [mode, setMode] = useState('search'); // 'search' | 'url'
    const [searchInput, setSearchInput] = useState('');
    const [urlInput, setUrlInput] = useState('');
    const [suggestions, setSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [fetchingDetails, setFetchingDetails] = useState(false);
    const autocompleteService = useRef(null);
    const placesService = useRef(null);
    const wrapperRef = useRef(null);

    useEffect(() => {
        let cancelled = false;
        loadGoogleMapsScript()
            .then(() => {
                if (cancelled || typeof window === 'undefined') return;
                if (window.google?.maps?.places) {
                    autocompleteService.current = new window.google.maps.places.AutocompleteService();
                    const dummyDiv = document.createElement('div');
                    placesService.current = new window.google.maps.places.PlacesService(dummyDiv);
                }
            })
            .catch(() => {
                if (!cancelled) setError('Google Maps is not available');
            });
        return () => { cancelled = true; };
    }, []);

    useEffect(() => {
        function handleClickOutside(e) {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
                setShowSuggestions(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSearchInput = (e) => {
        const val = e.target.value;
        setSearchInput(val);
        setError('');
        if (val.length < 2) {
            setSuggestions([]);
            setShowSuggestions(false);
            return;
        }
        setLoading(true);
        setShowSuggestions(true);
        if (autocompleteService.current) {
            const request = {
                input: val,
                types: ['establishment'],
                componentRestrictions: countryCode ? { country: countryCode.toLowerCase() } : undefined,
                language: 'en',
            };
            if (userLat && userLng) {
                request.location = new window.google.maps.LatLng(userLat, userLng);
                request.radius = 50000;
            }
            autocompleteService.current.getPlacePredictions(request, (predictions, status) => {
                setLoading(false);
                if (status === window.google.maps.places.PlacesServiceStatus.OK && predictions) {
                    setSuggestions(predictions.map((p) => ({
                        place_id: p.place_id,
                        description: p.description,
                        main_text: p.structured_formatting?.main_text,
                        secondary_text: p.structured_formatting?.secondary_text,
                    })));
                } else {
                    setSuggestions([]);
                }
            });
        } else {
            setLoading(false);
            setSuggestions([]);
        }
    };

    const fetchAndImport = async (placeId) => {
        if (!placesService.current) {
            setError('Google Places not ready');
            return;
        }
        setFetchingDetails(true);
        setError('');
        try {
            const data = await fetchPlaceDetails(placeId, placesService.current);
            onImport(data);
        } catch (err) {
            setError(err.message || 'Failed to fetch business details');
        } finally {
            setFetchingDetails(false);
        }
    };

    const handleSelectSuggestion = (s) => {
        setShowSuggestions(false);
        setSearchInput(s.description);
        fetchAndImport(s.place_id);
    };

    const handleImportFromUrl = () => {
        const placeId = extractPlaceIdFromUrl(urlInput);
        if (!placeId) {
            setError('Could not find Place ID in URL. Paste a Google Maps link to your business.');
            return;
        }
        fetchAndImport(placeId);
    };

    const hasGoogle = !!window.google?.maps?.places;

    return (
        <div
            ref={wrapperRef}
            style={{
                padding: '1rem',
                background: 'var(--bg-input)',
                borderRadius: '12px',
                border: '1px solid var(--border-color)',
                marginBottom: '1rem',
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '0.75rem' }}>
                <FaGoogle style={{ color: '#4285F4', fontSize: '1.2rem' }} />
                <span style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.95rem' }}>
                    Find your business on Google
                </span>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                Search by name or paste your Google Maps link. We will fill in the name, address, phone, opening hours, cover image, logo, and gallery when available.
            </p>
            <p style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: '600', marginBottom: '0.75rem' }}>
                👆 Click a result below to load details and continue.
            </p>

            {!hasGoogle && (
                <div style={{ padding: '0.75rem', background: 'rgba(239,68,68,0.1)', borderRadius: 8, fontSize: '0.85rem', color: '#ef4444', marginBottom: '0.75rem' }}>
                    Google Maps is not loaded. Check your API key and try again.
                </div>
            )}

            {error && (
                <div style={{ padding: '0.6rem', background: 'rgba(239,68,68,0.1)', borderRadius: 8, fontSize: '0.85rem', color: '#ef4444', marginBottom: '0.75rem' }}>
                    {error}
                </div>
            )}

            {importError && (
                <div style={{ padding: '0.75rem', background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.4)', borderRadius: 8, fontSize: '0.85rem', color: 'var(--text-main)', marginBottom: '0.75rem' }}>
                    <p style={{ margin: '0 0 0.5rem 0' }}>{importError}</p>
                    {onUseAnyway && (
                        <button
                            type="button"
                            onClick={onUseAnyway}
                            style={{
                                padding: '0.5rem 1rem',
                                background: 'var(--primary)',
                                border: 'none',
                                borderRadius: 8,
                                color: 'white',
                                fontWeight: 600,
                                fontSize: '0.85rem',
                                cursor: 'pointer',
                                marginTop: 4,
                            }}
                        >
                            Use this business anyway →
                        </button>
                    )}
                </div>
            )}

            <div style={{ display: 'flex', gap: 6, marginBottom: '0.75rem' }}>
                <button
                    type="button"
                    onClick={() => { setMode('search'); setError(''); setSuggestions([]); }}
                    style={{
                        padding: '6px 12px',
                        borderRadius: 8,
                        border: mode === 'search' ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                        background: mode === 'search' ? 'rgba(99,102,241,0.1)' : 'transparent',
                        color: mode === 'search' ? 'var(--primary)' : 'var(--text-secondary)',
                        fontWeight: 600,
                        fontSize: '0.85rem',
                        cursor: 'pointer',
                    }}
                >
                    Search
                </button>
                <button
                    type="button"
                    onClick={() => { setMode('url'); setError(''); setSuggestions([]); }}
                    style={{
                        padding: '6px 12px',
                        borderRadius: 8,
                        border: mode === 'url' ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                        background: mode === 'url' ? 'rgba(99,102,241,0.1)' : 'transparent',
                        color: mode === 'url' ? 'var(--primary)' : 'var(--text-secondary)',
                        fontWeight: 600,
                        fontSize: '0.85rem',
                        cursor: 'pointer',
                    }}
                >
                    Paste Link
                </button>
            </div>

            {mode === 'search' && (
                <div style={{ position: 'relative' }}>
                    <div style={{ position: 'relative' }}>
                        <FaSearch style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '0.9rem' }} />
                        <input
                            type="text"
                            value={searchInput}
                            onChange={handleSearchInput}
                            onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                            placeholder="Search your business name..."
                            disabled={!hasGoogle || fetchingDetails}
                            style={{
                                width: '100%',
                                padding: '0.7rem 1rem 0.7rem 2.5rem',
                                background: 'var(--bg-card)',
                                border: '1px solid var(--border-color)',
                                borderRadius: 10,
                                color: 'var(--text-main)',
                                fontSize: '0.9rem',
                            }}
                        />
                        {loading && <FaSpinner style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', animation: 'spin 1s linear infinite', color: 'var(--text-muted)' }} />}
                    </div>
                    {showSuggestions && suggestions.length > 0 && (
                        <ul
                            style={{
                                position: 'absolute',
                                top: '100%',
                                left: 0,
                                right: 0,
                                margin: 0,
                                padding: 0,
                                listStyle: 'none',
                                background: 'var(--bg-card)',
                                border: '1px solid var(--border-color)',
                                borderRadius: 10,
                                marginTop: 4,
                                maxHeight: 220,
                                overflowY: 'auto',
                                zIndex: 50,
                                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                            }}
                        >
                            {suggestions.map((s) => (
                                <li
                                    key={s.place_id}
                                    onClick={() => handleSelectSuggestion(s)}
                                    style={{
                                        padding: '0.6rem 1rem',
                                        cursor: 'pointer',
                                        borderBottom: '1px solid var(--border-color)',
                                        fontSize: '0.9rem',
                                    }}
                                    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-input)'; }}
                                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                                >
                                    <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{s.main_text}</div>
                                    {s.secondary_text && <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{s.secondary_text}</div>}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}

            {mode === 'url' && (
                <div style={{ display: 'flex', gap: 8 }}>
                    <input
                        type="url"
                        value={urlInput}
                        onChange={(e) => { setUrlInput(e.target.value); setError(''); }}
                        placeholder="https://www.google.com/maps/place/..."
                        disabled={!hasGoogle || fetchingDetails}
                        style={{
                            flex: 1,
                            padding: '0.7rem 1rem',
                            background: 'var(--bg-card)',
                            border: '1px solid var(--border-color)',
                            borderRadius: 10,
                            color: 'var(--text-main)',
                            fontSize: '0.9rem',
                        }}
                    />
                    <button
                        type="button"
                        onClick={handleImportFromUrl}
                        disabled={!urlInput.trim() || !hasGoogle || fetchingDetails}
                        style={{
                            padding: '0.7rem 1rem',
                            background: 'var(--primary)',
                            border: 'none',
                            borderRadius: 10,
                            color: 'white',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                        }}
                    >
                        {fetchingDetails ? <FaSpinner style={{ animation: 'spin 1s linear infinite' }} /> : <FaGoogle />}
                        Fetch
                    </button>
                </div>
            )}

            {fetchingDetails && (
                <div style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <FaSpinner style={{ animation: 'spin 1s linear infinite' }} />
                    Fetching business details...
                </div>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: '0.75rem' }}>
                {onCancel && (
                    <button
                        type="button"
                        onClick={onCancel}
                        style={{
                            padding: '6px 12px',
                            background: 'transparent',
                            border: '1px solid var(--border-color)',
                            borderRadius: 8,
                            color: 'var(--text-secondary)',
                            fontSize: '0.85rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                        }}
                    >
                        <FaTimes /> Cancel
                    </button>
                )}
            </div>
        </div>
    );
};

export default GoogleBusinessImporter;
