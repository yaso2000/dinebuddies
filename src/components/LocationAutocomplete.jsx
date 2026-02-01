import React, { useState, useEffect, useRef } from 'react';
import { FaMapMarkerAlt, FaSearch, FaStar, FaPlus } from 'react-icons/fa';
import { popularPlaces } from '../data/popularPlaces';
import { useTranslation } from 'react-i18next';

const LocationAutocomplete = ({ value, onChange, onSelect, city }) => {
    const { t, i18n } = useTranslation();
    const [suggestions, setSuggestions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const wrapperRef = useRef(null);

    // Close suggestions on click outside
    useEffect(() => {
        function handleClickOutside(event) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setShowSuggestions(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [wrapperRef]);

    const handleInput = (e) => {
        const val = e.target.value;
        onChange(e);

        if (val.length > 1) {
            setLoading(true);
            setShowSuggestions(true);

            // 1. Local Search (Instant)
            const localMatches = popularPlaces.filter(place =>
                (place.city === city || place.city === 'Any') &&
                place.name.toLowerCase().includes(val.toLowerCase())
            ).map(place => ({
                ...place,
                display_name: place.address,
                isLocal: true,
                lat: place.lat,
                lon: place.lng
            }));

            // Initial suggestions
            setSuggestions(localMatches);

            // 2. Debounce API search
            const timer = setTimeout(() => {
                const searchQuery = city ? `${val} ${city}` : val;

                fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&addressdetails=1&limit=5`, {
                    headers: { 'Accept-Language': 'ar-SA,ar;q=0.9,en;q=0.8' }
                })
                    .then(res => res.json())
                    .then(data => {
                        // Filter duplicates
                        const existingNames = new Set(localMatches.map(p => p.name));
                        const apiResults = data.filter(item => {
                            const name = item.name || item.display_name.split(',')[0];
                            return !existingNames.has(name);
                        });

                        setSuggestions([...localMatches, ...apiResults]);
                        setLoading(false);
                    })
                    .catch(() => setLoading(false));
            }, 500);

            return () => clearTimeout(timer);
        } else {
            setSuggestions([]);
            setShowSuggestions(false);
        }
    };

    const handleSelectSuggestion = (place) => {
        const name = place.name || place.display_name.split(',')[0];

        onSelect({
            name: name,
            fullAddress: place.display_name,
            lat: place.lat ? parseFloat(place.lat) : null,
            lng: place.lon ? parseFloat(place.lon) : null
        });

        setShowSuggestions(false);
    };

    const handleManualSelect = () => {
        // Allow user to use exactly what they typed
        onSelect({
            name: value,
            fullAddress: value, // No address available for manual entry
            lat: null, // No coordinates for manual entry
            lng: null
        });
        setShowSuggestions(false);
    }

    return (
        <div className="location-autocomplete" ref={wrapperRef} style={{ position: 'relative' }}>
            <input
                type="text"
                name="location"
                placeholder={t('form_location_placeholder')} // Use translation placeholder
                value={value}
                onChange={handleInput}
                required
                className="input-field"
                autoComplete="off"
            />
            {loading && (
                <div style={{ position: 'absolute', left: i18n.language === 'ar' ? '10px' : 'auto', right: i18n.language === 'ar' ? 'auto' : '10px', top: '12px', color: '#888' }}>
                    <FaSearch className="spin-animation" />
                </div>
            )}

            {showSuggestions && value.length > 1 && (
                <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    backgroundColor: '#ffffff',
                    border: '1px solid #e5e7eb',
                    borderRadius: '0 0 12px 12px',
                    zIndex: 1000,
                    boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                    maxHeight: '300px',
                    overflowY: 'auto'
                }}>
                    {/* Render found suggestions */}
                    {suggestions.map((place, index) => (
                        <div
                            key={index}
                            onClick={() => handleSelectSuggestion(place)}
                            style={{
                                padding: '12px 16px',
                                cursor: 'pointer',
                                borderBottom: '1px solid #f3f4f6',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                background: place.isLocal ? '#fffbeb' : 'white',
                                transition: 'background 0.2s'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = '#f9fafb'}
                            onMouseLeave={(e) => e.currentTarget.style.background = place.isLocal ? '#fffbeb' : 'white'}
                        >
                            {place.isLocal ? (
                                <div style={{
                                    minWidth: '32px', height: '32px', borderRadius: '50%', background: '#ffedd5',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                                }}>
                                    <FaStar style={{ color: '#f59e0b', fontSize: '1rem' }} />
                                </div>
                            ) : (
                                <div style={{
                                    minWidth: '32px', height: '32px', borderRadius: '50%', background: '#e0f2fe',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                                }}>
                                    <FaMapMarkerAlt style={{ color: '#0ea5e9', fontSize: '1rem' }} />
                                </div>
                            )}

                            <div style={{ flex: 1 }}>
                                <div style={{
                                    fontWeight: '700', fontSize: '0.95rem', color: '#111827',
                                    display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px'
                                }}>
                                    {place.name || place.display_name.split(',')[0]}
                                    {place.isLocal && (
                                        <span style={{
                                            fontSize: '0.65rem', background: '#f59e0b', color: 'white',
                                            padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold'
                                        }}>
                                            TOP
                                        </span>
                                    )}
                                </div>
                                <div style={{ fontSize: '0.8rem', color: '#6b7280', lineHeight: '1.2' }}>
                                    {place.display_name}
                                </div>
                            </div>
                        </div>
                    ))}

                    {/* Always show "Use custom location" option at the bottom */}
                    {!loading && (
                        <div
                            onClick={handleManualSelect}
                            style={{
                                padding: '12px 16px',
                                cursor: 'pointer',
                                borderTop: suggestions.length > 0 ? '2px solid #f3f4f6' : 'none',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                background: '#f0fdf4', // Light green background to distinguish
                                transition: 'background 0.2s'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = '#dcfce7'}
                            onMouseLeave={(e) => e.currentTarget.style.background = '#f0fdf4'}
                        >
                            <div style={{
                                minWidth: '32px', height: '32px', borderRadius: '50%', background: '#bbf7d0',
                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}>
                                <FaPlus style={{ color: '#16a34a', fontSize: '1rem' }} />
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: '700', fontSize: '0.95rem', color: '#111827' }}>
                                    {i18n.language === 'ar' ? `استخدم "${value}"` : `Use "${value}"`}
                                </div>
                                <div style={{ fontSize: '0.8rem', color: '#166534' }}>
                                    {i18n.language === 'ar' ? 'إضافة مكان جديد يدوياً' : 'Add manual location (no map link)'}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default LocationAutocomplete;
