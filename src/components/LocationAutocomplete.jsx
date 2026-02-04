import React, { useState, useEffect, useRef } from 'react';
import { FaMapMarkerAlt, FaSearch, FaStar, FaPlus, FaStore } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';

const LocationAutocomplete = ({ value, onChange, onSelect, city, countryCode, userLat, userLng }) => {
    const { t, i18n } = useTranslation();
    const [suggestions, setSuggestions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const wrapperRef = useRef(null);
    const autocompleteService = useRef(null);
    const placesService = useRef(null);

    // Initialize Google Places API
    useEffect(() => {
        if (window.google && window.google.maps && window.google.maps.places) {
            autocompleteService.current = new window.google.maps.places.AutocompleteService();

            // Create a dummy div for PlacesService (required by Google API)
            const dummyDiv = document.createElement('div');
            placesService.current = new window.google.maps.places.PlacesService(dummyDiv);
        } else {
            console.warn('Google Maps API not loaded. Add script to index.html');
        }
    }, []);

    // Determine language based on country code
    const getLanguageForCountry = (code) => {
        if (!code) return 'en';

        const countryLanguageMap = {
            // Arabic-speaking countries
            'SA': 'ar', 'AE': 'ar', 'EG': 'ar', 'IQ': 'ar', 'JO': 'ar',
            'KW': 'ar', 'LB': 'ar', 'OM': 'ar', 'QA': 'ar', 'SY': 'ar',
            'YE': 'ar', 'BH': 'ar', 'DZ': 'ar', 'MA': 'ar', 'TN': 'ar',
            'LY': 'ar', 'SD': 'ar', 'MR': 'ar', 'SO': 'ar', 'DJ': 'ar',

            // Chinese-speaking
            'CN': 'zh', 'TW': 'zh', 'HK': 'zh', 'MO': 'zh',

            // Spanish-speaking
            'ES': 'es', 'MX': 'es', 'AR': 'es', 'CO': 'es', 'CL': 'es',
            'PE': 'es', 'VE': 'es', 'EC': 'es', 'GT': 'es', 'CU': 'es',

            // French-speaking
            'FR': 'fr', 'BE': 'fr', 'CH': 'fr', 'CA': 'fr',

            // German-speaking
            'DE': 'de', 'AT': 'de',

            // Japanese
            'JP': 'ja',

            // Korean
            'KR': 'ko',

            // Russian
            'RU': 'ru',

            // Portuguese
            'PT': 'pt', 'BR': 'pt',

            // Italian
            'IT': 'it',
        };

        return countryLanguageMap[code] || 'en';
    };

    const searchLanguage = getLanguageForCountry(countryCode);

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

        if (val.length > 2) {
            setLoading(true);
            setShowSuggestions(true);

            // Use Google Places Autocomplete API
            if (autocompleteService.current) {
                const request = {
                    input: val,
                    // Removed types restriction to allow both establishments AND addresses
                    // This enables searching for: restaurants, cafes, stores, streets, buildings, landmarks
                    componentRestrictions: countryCode ? { country: countryCode.toLowerCase() } : undefined,
                    language: searchLanguage
                };

                // Add location bias if user coordinates are available
                if (userLat && userLng && window.google && window.google.maps) {
                    request.location = new window.google.maps.LatLng(userLat, userLng);
                    request.radius = 50000; // 50km radius
                    console.log('📍 Using location bias:', { lat: userLat, lng: userLng });
                }

                autocompleteService.current.getPlacePredictions(request, (predictions, status) => {
                    console.log('🔍 Google Places Response:', { status, predictionsCount: predictions?.length, city });

                    if (status === window.google.maps.places.PlacesServiceStatus.OK && predictions) {
                        // Soft filtering: Sort by city match instead of removing
                        let sortedPredictions = predictions;

                        if (city) {
                            const cityLower = city.toLowerCase();
                            sortedPredictions = [...predictions].sort((a, b) => {
                                const aMatches = a.description.toLowerCase().includes(cityLower);
                                const bMatches = b.description.toLowerCase().includes(cityLower);

                                // City matches come first
                                if (aMatches && !bMatches) return -1;
                                if (!aMatches && bMatches) return 1;
                                return 0;
                            });

                            console.log('✅ Sorted results (city matches first):', sortedPredictions.length);
                        }

                        setSuggestions(sortedPredictions.map(p => ({
                            place_id: p.place_id,
                            name: p.structured_formatting.main_text,
                            address: p.structured_formatting.secondary_text,
                            full_description: p.description,
                            types: p.types,
                            matchesCity: city ? p.description.toLowerCase().includes(city.toLowerCase()) : false
                        })));
                    } else {
                        setSuggestions([]);
                    }
                    setLoading(false);
                });
            } else {
                // Fallback to OpenStreetMap if Google API not available
                const searchQuery = city ? `${val} ${city}` : val;

                fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&addressdetails=1&limit=5`, {
                    headers: { 'Accept-Language': searchLanguage }
                })
                    .then(res => res.json())
                    .then(data => {
                        setSuggestions(data.map(item => ({
                            name: item.name || item.display_name.split(',')[0],
                            address: item.display_name,
                            lat: parseFloat(item.lat),
                            lng: parseFloat(item.lon),
                            fallback: true
                        })));
                        setLoading(false);
                    })
                    .catch(() => {
                        setLoading(false);
                        setSuggestions([]);
                    });
            }
        } else {
            setSuggestions([]);
            setShowSuggestions(false);
        }
    };

    const handleSelectSuggestion = (place) => {
        if (place.fallback) {
            // OpenStreetMap result
            onSelect({
                name: place.name,
                fullAddress: place.address,
                lat: place.lat,
                lng: place.lng
            });
            setShowSuggestions(false);
        } else {
            // Google Places result - Get full details
            if (placesService.current && place.place_id) {
                placesService.current.getDetails(
                    {
                        placeId: place.place_id,
                        fields: ['name', 'formatted_address', 'geometry', 'place_id', 'types']
                    },
                    (placeDetails, status) => {
                        if (status === window.google.maps.places.PlacesServiceStatus.OK && placeDetails) {
                            onSelect({
                                name: placeDetails.name,
                                fullAddress: placeDetails.formatted_address,
                                lat: placeDetails.geometry.location.lat(),
                                lng: placeDetails.geometry.location.lng(),
                                placeId: placeDetails.place_id,
                                types: placeDetails.types
                            });
                        }
                    }
                );
            }
            setShowSuggestions(false);
        }
    };

    const handleManualSelect = () => {
        onSelect({
            name: value,
            fullAddress: value,
            lat: null,
            lng: null
        });
        setShowSuggestions(false);
    };

    const getPlaceIcon = (types) => {
        if (!types) return <FaMapMarkerAlt />;

        if (types.includes('restaurant') || types.includes('food')) {
            return <FaStore style={{ color: '#f59e0b' }} />;
        }
        if (types.includes('cafe')) {
            return <FaStore style={{ color: '#8b5cf6' }} />;
        }
        return <FaMapMarkerAlt style={{ color: '#0ea5e9' }} />;
    };

    return (
        <div className="location-autocomplete" ref={wrapperRef} style={{ position: 'relative' }}>
            <input
                type="text"
                name="location"
                placeholder={city ? `${t('form_location_placeholder')} in ${city}` : t('form_location_placeholder')}
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

            {showSuggestions && value.length > 2 && (
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
                    maxHeight: '350px',
                    overflowY: 'auto'
                }}>
                    {suggestions.length === 0 && !loading && (
                        <div style={{ padding: '20px', textAlign: 'center', color: '#6b7280' }}>
                            {city ? `${t('no_results_found')} in ${city}` : t('no_results_found')}
                        </div>
                    )}

                    {suggestions.map((place, index) => (
                        <div
                            key={index}
                            onClick={() => handleSelectSuggestion(place)}
                            style={{
                                padding: '14px 16px',
                                cursor: 'pointer',
                                borderBottom: '1px solid #f3f4f6',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                background: 'white',
                                transition: 'background 0.2s'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = '#f9fafb'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
                        >
                            <div style={{
                                minWidth: '36px', height: '36px', borderRadius: '50%',
                                background: place.fallback ? '#e0f2fe' : '#fef3c7',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '1.1rem'
                            }}>
                                {getPlaceIcon(place.types)}
                            </div>

                            <div style={{ flex: 1 }}>
                                <div style={{
                                    fontWeight: '700', fontSize: '0.95rem', color: '#111827',
                                    marginBottom: '3px'
                                }}>
                                    {place.name}
                                </div>
                                <div style={{ fontSize: '0.8rem', color: '#6b7280', lineHeight: '1.3' }}>
                                    {place.address || place.full_description}
                                </div>
                            </div>

                            {place.matchesCity && (
                                <div style={{
                                    fontSize: '0.65rem', background: '#8b5cf6', color: 'white',
                                    padding: '3px 8px', borderRadius: '4px', fontWeight: 'bold',
                                    marginRight: '4px'
                                }}>
                                    {city}
                                </div>
                            )}

                            {!place.fallback && (
                                <div style={{
                                    fontSize: '0.65rem', background: '#10b981', color: 'white',
                                    padding: '3px 8px', borderRadius: '4px', fontWeight: 'bold'
                                }}>
                                    GOOGLE
                                </div>
                            )}
                        </div>
                    ))}

                    {/* Manual entry option */}
                    {!loading && (
                        <div
                            onClick={handleManualSelect}
                            style={{
                                padding: '14px 16px',
                                cursor: 'pointer',
                                borderTop: suggestions.length > 0 ? '2px solid #f3f4f6' : 'none',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                background: '#f0fdf4',
                                transition: 'background 0.2s'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = '#dcfce7'}
                            onMouseLeave={(e) => e.currentTarget.style.background = '#f0fdf4'}
                        >
                            <div style={{
                                minWidth: '36px', height: '36px', borderRadius: '50%', background: '#bbf7d0',
                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}>
                                <FaPlus style={{ color: '#16a34a', fontSize: '1rem' }} />
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: '700', fontSize: '0.95rem', color: '#111827' }}>
                                    {t('use_location', { value })}
                                </div>
                                <div style={{ fontSize: '0.8rem', color: '#166534' }}>
                                    {t('add_manual_location')}
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
