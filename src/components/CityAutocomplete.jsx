import React, { useState, useEffect, useRef } from 'react';
import { FaSearch } from 'react-icons/fa';
import { PLACES_AUTOCOMPLETE_DEBOUNCE_MS } from '../utils/placesCostControl';
import { searchNominatimCities } from '../utils/osmPhotonSearch';

/**
 * City autocomplete via OpenStreetMap Nominatim (no Google Places).
 */
const CityAutocomplete = ({ value, onSelect, countryCode, placeholder }) => {
    const [suggestions, setSuggestions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [inputValue, setInputValue] = useState(value || '');
    const wrapperRef = useRef(null);
    const inputDebounceRef = useRef(null);
    const generationRef = useRef(0);

    useEffect(() => {
        setInputValue(value || '');
    }, [value]);

    useEffect(() => {
        function handleClickOutside(e) {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
                setShowSuggestions(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => () => {
        if (inputDebounceRef.current) clearTimeout(inputDebounceRef.current);
    }, []);

    const handleInput = (e) => {
        const val = e.target.value;
        setInputValue(val);
        if (inputDebounceRef.current) clearTimeout(inputDebounceRef.current);

        if (val.length < 2) {
            generationRef.current += 1;
            setSuggestions([]);
            setShowSuggestions(false);
            setLoading(false);
            return;
        }

        setLoading(true);
        setShowSuggestions(true);
        generationRef.current += 1;
        const gen = generationRef.current;

        inputDebounceRef.current = setTimeout(() => {
            inputDebounceRef.current = null;
            const stale = () => gen !== generationRef.current;

            if (stale()) return;
            searchNominatimCities(val, countryCode)
                .then((rows) => {
                    if (stale()) return;
                    setLoading(false);
                    setSuggestions(rows);
                })
                .catch(() => {
                    if (!stale()) {
                        setLoading(false);
                        setSuggestions([]);
                    }
                });
        }, PLACES_AUTOCOMPLETE_DEBOUNCE_MS);
    };

    const handleSelect = (s) => {
        setShowSuggestions(false);
        setInputValue(s.description);
        onSelect({ city: s.city, countryCode: s.countryCode });
    };

    return (
        <div ref={wrapperRef} style={{ position: 'relative' }}>
            <div style={{ position: 'relative' }}>
                <FaSearch
                    style={{
                        position: 'absolute',
                        left: 12,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: 'var(--text-muted)',
                        fontSize: '0.9rem',
                    }}
                />
                <input
                    type="text"
                    value={inputValue}
                    onChange={handleInput}
                    onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                    placeholder={placeholder || 'Search city…'}
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
                            onMouseEnter={(e) => {
                                e.currentTarget.style.background = 'var(--bg-input)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'transparent';
                            }}
                        >
                            <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{s.main_text}</div>
                            {s.secondary_text && (
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{s.secondary_text}</div>
                            )}
                        </li>
                    ))}
                </ul>
            )}
            {loading && (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 }}>
                    …
                </div>
            )}
        </div>
    );
};

export default CityAutocomplete;
