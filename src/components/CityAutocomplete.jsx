import React, { useState, useEffect, useRef } from 'react';
import { FaSearch } from 'react-icons/fa';
import { loadGoogleMapsScript } from '../utils/loadGoogleMaps';

/**
 * City-only autocomplete using Google Places (cities).
 * Only returns cities that exist on Google Maps — no free-text to avoid fake cities.
 */
const CityAutocomplete = ({ value, onSelect, countryCode, placeholder }) => {
    const [suggestions, setSuggestions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [inputValue, setInputValue] = useState(value || '');
    const wrapperRef = useRef(null);
    const autocompleteService = useRef(null);
    const placesService = useRef(null);

    useEffect(() => {
        setInputValue(value || '');
    }, [value]);

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
            .catch(() => {});
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

    const handleInput = (e) => {
        const val = e.target.value;
        setInputValue(val);
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
                types: ['(cities)'],
                language: 'en',
            };
            if (countryCode) {
                request.componentRestrictions = { country: countryCode.toLowerCase() };
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

    const handleSelect = (s) => {
        setShowSuggestions(false);
        setInputValue(s.description);
        if (!placesService.current || !s.place_id) return;
        placesService.current.getDetails(
            {
                placeId: s.place_id,
                fields: ['address_components', 'formatted_address'],
            },
            (place, status) => {
                if (status !== window.google.maps.places.PlacesServiceStatus.OK || !place?.address_components) {
                    return;
                }
                let city = '';
                let countryCodeOut = '';
                for (const c of place.address_components) {
                    if (c.types.includes('locality')) city = c.long_name;
                    if (c.types.includes('administrative_area_level_1') && !city) city = c.long_name;
                    if (c.types.includes('country')) countryCodeOut = (c.short_name || '').toUpperCase().slice(0, 2);
                }
                if (city) {
                    onSelect({ city, countryCode: countryCodeOut });
                }
            }
        );
    };

    const hasGoogle = !!window.google?.maps?.places;

    return (
        <div ref={wrapperRef} style={{ position: 'relative' }}>
            <div style={{ position: 'relative' }}>
                <FaSearch style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '0.9rem' }} />
                <input
                    type="text"
                    value={inputValue}
                    onChange={handleInput}
                    onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                    placeholder={placeholder || 'Search city on Google Maps...'}
                    disabled={!hasGoogle}
                    autoComplete="off"
                    style={{
                        width: '100%',
                        padding: '0.6rem 0.8rem 0.6rem 2.5rem',
                        background: 'var(--bg-input)',
                        border: '1px solid var(--border-color)',
                        borderRadius: 10,
                        color: 'var(--text-main)',
                        fontSize: '0.9rem',
                    }}
                />
            </div>
            {showSuggestions && suggestions.length > 0 && (
                <ul
                    style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        margin: 0,
                        marginTop: 4,
                        padding: 0,
                        listStyle: 'none',
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border-color)',
                        borderRadius: 10,
                        maxHeight: 220,
                        overflowY: 'auto',
                        zIndex: 50,
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    }}
                >
                    {suggestions.map((s) => (
                        <li
                            key={s.place_id}
                            onClick={() => handleSelect(s)}
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
            {!hasGoogle && (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 }}>
                    City search requires Google Maps.
                </div>
            )}
        </div>
    );
};

export default CityAutocomplete;
