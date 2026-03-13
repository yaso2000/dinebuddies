import React, { useState, useEffect, useRef } from 'react';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '../firebase/config';
import { FaSearch, FaMapMarkerAlt, FaStore, FaGoogle } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';
import { getSafeAvatar } from '../utils/avatarUtils';
import { loadGoogleMapsScript } from '../utils/loadGoogleMaps';

const SmartPlaceSearch = ({ onSelect, excludeIds = [], searchType = 'establishment', cityBias = null }) => {
    const { t } = useTranslation();
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState({ partners: [], google: [] });
    const [showResults, setShowResults] = useState(false);

    // Google Places Service
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
                if (!cancelled) console.warn('Google Maps API not available. Place search will show partners only.');
            });
        return () => { cancelled = true; };
    }, []);

    // Handle click outside to close
    useEffect(() => {
        function handleClickOutside(event) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setShowResults(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [wrapperRef]);

    const handleSearch = async (text) => {
        setInput(text);
        if (text.length < 3) {
            setResults({ partners: [], google: [] });
            setShowResults(false);
            return;
        }

        setLoading(true);
        setShowResults(true);

        try {
            // 1. FireStore Search (Partners) - Only if NOT searching for cities
            let partnersPromise = Promise.resolve({ docs: [] });

            if (searchType !== '(cities)' && searchType !== 'geocode') {
                const normalizedText = text.trim().toLowerCase();
                const partnersQuery = query(
                    collection(db, 'public_profiles'),
                    where('profileType', '==', 'business'),
                    where('businessPublic.isPublished', '==', true),
                    where('search.displayNameLower', '>=', normalizedText),
                    where('search.displayNameLower', '<=', normalizedText + '\uf8ff'),
                    limit(3)
                );
                partnersPromise = getDocs(partnersQuery);
            }

            // 2. Google Search Promise
            const googlePromise = new Promise((resolve) => {
                if (!autocompleteService.current) return resolve([]);

                const request = {
                    input: text,
                    types: searchType === '(cities)' ? ['(cities)'] : (searchType === 'geocode' ? ['geocode'] : ['establishment', 'geocode']),
                };

                // Apply City Bias if available
                if (cityBias && cityBias.lat && cityBias.lng && window.google) {
                    request.location = new window.google.maps.LatLng(cityBias.lat, cityBias.lng);
                    request.radius = 50000; // 50km radius
                    console.log("📍 Applying City Bias:", cityBias);
                }

                autocompleteService.current.getPlacePredictions(request, (predictions, status) => {
                    if (status === window.google.maps.places.PlacesServiceStatus.OK && predictions) {
                        resolve(predictions.map(p => ({
                            id: p.place_id,
                            name: p.structured_formatting.main_text,
                            address: p.structured_formatting.secondary_text,
                            source: 'google',
                            types: p.types,
                            place_id: p.place_id
                        })));
                    } else {
                        resolve([]);
                    }
                });
            });

            const [partnersSnapshot, googleResults] = await Promise.all([
                partnersPromise,
                googlePromise
            ]);

            const partners = partnersSnapshot.docs
                .map(doc => {
                    const data = doc.data();
                    const business = data.businessPublic || {};
                    return {
                        id: doc.id,
                        name: data.displayName || 'Business',
                        address: business.address || business.city || '',
                        image: data.avatarUrl || getSafeAvatar({}),
                        source: 'business',
                        businessId: doc.id
                    };
                })
                .filter(p => !excludeIds.includes(p.id));

            setResults({
                partners,
                google: googleResults.filter(g => !excludeIds.includes(g.place_id))
            });

        } catch (error) {
            console.error('Search error:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSelect = async (place) => {
        // If it's a google place, we might want to get more details (like lat/lng or photo)
        if (place.source === 'google' && placesService.current) {
            placesService.current.getDetails({
                placeId: place.place_id,
                fields: ['name', 'formatted_address', 'geometry', 'photos', 'url']
            }, (placeDetails, status) => {
                if (status === window.google.maps.places.PlacesServiceStatus.OK) {



                    const photos = placeDetails.photos?.map(p => p.getUrl({ maxWidth: 400 })) || [];
                    const photoUrl = photos.length > 0 ? photos[0] : null;

                    const enrichedPlace = {
                        ...place,
                        name: placeDetails.name,
                        address: placeDetails.formatted_address,
                        image: photoUrl,
                        photos: photos,
                        location: {
                            lat: placeDetails.geometry.location.lat(),
                            lng: placeDetails.geometry.location.lng()
                        },
                        googleUrl: placeDetails.url
                    };

                    onSelect(enrichedPlace);
                } else {
                    // Fallback to basic info
                    onSelect(place);
                }
            });
        } else {
            onSelect(place);
        }

        setInput('');
        setShowResults(false);
    };

    const skeletonStyle = {
        background: 'linear-gradient(90deg, rgba(255,255,255,0.05) 25%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.05) 75%)',
        backgroundSize: '200% 100%',
        animation: 'shimmer 1.5s infinite',
        borderRadius: '8px'
    };

    return (
        <div ref={wrapperRef} style={{ position: 'relative', width: '100%' }}>
            <div style={{ position: 'relative' }}>
                <FaSearch style={{
                    position: 'absolute',
                    left: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#9ca3af'
                }} />

                <input
                    type="text"
                    value={input}
                    onChange={(e) => handleSearch(e.target.value)}
                    placeholder={t('search_places_placeholder') || "Search for restaurants, cafes..."}
                    style={{
                        width: '100%',
                        padding: '12px 12px 12px 40px',
                        borderRadius: '12px',
                        border: '1px solid var(--border-color)',
                        background: 'var(--bg-card)',
                        color: 'var(--text-primary)',
                        fontSize: '1rem',
                        outline: 'none'
                    }}
                />

                {loading && (
                    <div style={{
                        position: 'absolute',
                        right: '12px',
                        top: '50%',
                        transform: 'translateY(-50%)'
                    }}>
                        <div className="spinner-mini" style={{
                            width: '16px', height: '16px', border: '2px solid #ccc', borderTopColor: '#333', borderRadius: '50%', animation: 'spin 1s linear infinite'
                        }}></div>
                    </div>
                )}
            </div>

            {/* Dropdown: show when results are visible OR while loading (skeleton rows) */}
            {showResults && (loading || results.partners.length > 0 || results.google.length > 0) && (
                <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    marginTop: '8px',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '12px',
                    boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                    zIndex: 1000,
                    maxHeight: '400px',
                    overflowY: 'auto'
                }}>
                    {/* Skeleton rows while loading */}
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
                                        borderBottom: i < 4 ? '1px solid var(--border-color)' : 'none'
                                    }}
                                >
                                    <div style={{
                                        width: '40px',
                                        height: '40px',
                                        borderRadius: '8px',
                                        ...skeletonStyle
                                    }} />
                                    <div style={{ flex: 1 }}>
                                        <div style={{ width: '70%', height: '14px', marginBottom: '6px', ...skeletonStyle }} />
                                        <div style={{ width: '50%', height: '12px', ...skeletonStyle }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Partners Section */}
                    {!loading && results.partners.length > 0 && (
                        <div style={{ padding: '8px 0' }}>
                            <div style={{
                                padding: '4px 12px',
                                fontSize: '0.75rem',
                                fontWeight: '700',
                                color: 'var(--luxury-gold)',
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px'
                            }}>
                                DineBuddies Partners
                            </div>
                            {results.partners.map((item) => (
                                <div
                                    key={item.id}
                                    onClick={() => handleSelect(item)}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '12px',
                                        padding: '10px 12px',
                                        cursor: 'pointer',
                                        transition: 'background 0.2s',
                                        borderBottom: '1px solid rgba(0,0,0,0.05)'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-body)'}
                                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                >
                                    <div style={{
                                        width: '40px', height: '40px', borderRadius: '8px',
                                        backgroundImage: `url(${item.image || 'https://via.placeholder.com/40'})`,
                                        backgroundSize: 'cover', backgroundPosition: 'center',
                                        border: '1px solid var(--luxury-gold)'
                                    }}></div>
                                    <div>
                                        <div style={{ fontWeight: '600', color: 'var(--text-primary)' }}>
                                            {item.name} <span style={{ color: 'var(--primary)', fontSize: '0.8em' }}>✓</span>
                                        </div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                            {item.address}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Google Section */}
                    {!loading && results.google.length > 0 && (
                        <div style={{ padding: '8px 0', borderTop: results.partners.length > 0 ? '1px solid var(--border-color)' : 'none' }}>
                            <div style={{
                                padding: '4px 12px',
                                fontSize: '0.75rem',
                                fontWeight: '700',
                                color: '#9ca3af',
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px',
                                display: 'flex', alignItems: 'center', gap: '6px'
                            }}>
                                <FaGoogle /> Google Places
                            </div>
                            {results.google.map((item) => (
                                <div
                                    key={item.id}
                                    onClick={() => handleSelect(item)}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '12px',
                                        padding: '10px 12px',
                                        cursor: 'pointer',
                                        transition: 'background 0.2s'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-body)'}
                                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                >
                                    <div style={{
                                        minWidth: '32px', height: '32px', borderRadius: '50%',
                                        background: '#f3f4f6', color: '#6b7280',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                                    }}>
                                        <FaMapMarkerAlt />
                                    </div>
                                    <div>
                                        <div style={{ fontWeight: '600', color: 'var(--text-primary)' }}>
                                            {item.name}
                                        </div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                            {item.address}
                                        </div>
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
