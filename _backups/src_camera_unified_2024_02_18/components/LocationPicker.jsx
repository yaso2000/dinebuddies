import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix default marker icons
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
import iconRetina from 'leaflet/dist/images/marker-icon-2x.png';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: iconRetina,
    iconUrl: icon,
    shadowUrl: iconShadow,
});

const LocationPicker = ({ onLocationSelect, initialLat, initialLng, onAddressChange }) => {
    const mapRef = useRef(null);
    const mapInstanceRef = useRef(null);
    const markerRef = useRef(null);
    const searchInputRef = useRef(null);

    const [position, setPosition] = useState(null);
    const [address, setAddress] = useState('');
    const [searching, setSearching] = useState(false);

    // Default center: Bundaberg, Australia
    const defaultCenter = [-24.8662, 152.3489];

    // Reverse Geocoding: Get address from coordinates
    const getAddressFromCoords = async (lat, lng) => {
        try {
            const response = await fetch(
                `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`
            );
            const data = await response.json();

            if (data && data.address) {
                const addr = data.address;
                const fullAddress = data.display_name || '';
                const city = addr.city || addr.town || addr.village || addr.state || '';
                const street = addr.road || addr.suburb || '';

                setAddress(fullAddress);

                // Call callback to update parent form
                if (onAddressChange) {
                    onAddressChange({
                        address: street || fullAddress,
                        city: city
                    });
                }
            }
        } catch (error) {
            console.error('Error getting address:', error);
        }
    };

    // Forward Geocoding: Search for address
    const searchAddress = async (query) => {
        if (!query || query.trim().length < 3) return;

        setSearching(true);
        try {
            const response = await fetch(
                `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`
            );
            const data = await response.json();

            if (data && data.length > 0) {
                const result = data[0];
                const lat = parseFloat(result.lat);
                const lng = parseFloat(result.lon);

                if (mapInstanceRef.current) {
                    // Move map to location
                    mapInstanceRef.current.setView([lat, lng], 15);

                    // Remove old marker
                    if (markerRef.current) {
                        mapInstanceRef.current.removeLayer(markerRef.current);
                    }

                    // Add new marker
                    markerRef.current = L.marker([lat, lng]).addTo(mapInstanceRef.current);

                    const newPos = { lat, lng };
                    setPosition(newPos);

                    // Update address
                    await getAddressFromCoords(lat, lng);

                    // Call callback
                    if (onLocationSelect) {
                        onLocationSelect(newPos);
                    }
                }
            }
        } catch (error) {
            console.error('Error searching address:', error);
        } finally {
            setSearching(false);
        }
    };

    useEffect(() => {
        // Initialize map
        if (!mapInstanceRef.current && mapRef.current) {
            const initialCenter = (initialLat && initialLng)
                ? [parseFloat(initialLat), parseFloat(initialLng)]
                : defaultCenter;

            const map = L.map(mapRef.current, {
                center: initialCenter,
                zoom: 13,
                scrollWheelZoom: true,
            });

            L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
                attribution: '&copy; <a href="https://carto.com/attributions">CARTO</a>',
                maxZoom: 19
            }).addTo(map);

            // Handle map clicks
            map.on('click', async (e) => {
                const newPos = { lat: e.latlng.lat, lng: e.latlng.lng };
                setPosition(newPos);

                // Remove old marker if exists
                if (markerRef.current) {
                    map.removeLayer(markerRef.current);
                }

                // Add new marker
                markerRef.current = L.marker([newPos.lat, newPos.lng]).addTo(map);

                // Get address for this location
                await getAddressFromCoords(newPos.lat, newPos.lng);

                // Call callback
                if (onLocationSelect) {
                    onLocationSelect(newPos);
                }
            });

            mapInstanceRef.current = map;

            // Set initial marker if coordinates provided
            if (initialLat && initialLng) {
                const lat = parseFloat(initialLat);
                const lng = parseFloat(initialLng);
                if (!isNaN(lat) && !isNaN(lng)) {
                    const pos = { lat, lng };
                    setPosition(pos);
                    markerRef.current = L.marker([lat, lng]).addTo(map);
                    // Get initial address
                    getAddressFromCoords(lat, lng);
                }
            }

            // Force resize after a short delay (fixes modal display)
            setTimeout(() => {
                map.invalidateSize();
            }, 100);
        }

        // Cleanup
        return () => {
            if (mapInstanceRef.current) {
                mapInstanceRef.current.remove();
                mapInstanceRef.current = null;
            }
        };
    }, []); // Empty dependency array - only run once

    const handleSearchSubmit = (e) => {
        e.preventDefault();
        if (searchInputRef.current) {
            searchAddress(searchInputRef.current.value);
        }
    };

    return (
        <div style={{
            height: '450px',
            borderRadius: '16px',
            overflow: 'hidden',
            border: '2px solid var(--border-color)',
            marginTop: '10px',
            marginBottom: '20px',
            position: 'relative',
            background: '#0f172a'
        }}>
            {/* Search Box */}
            <form
                onSubmit={handleSearchSubmit}
                style={{
                    position: 'absolute',
                    top: '10px',
                    left: '50px', // Start after zoom controls
                    right: '10px',
                    zIndex: 1000,
                    display: 'flex',
                    gap: '8px'
                }}
            >
                <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="🔍 Search for address or place..."
                    style={{
                        flex: 1,
                        padding: '10px 14px',
                        borderRadius: '8px',
                        border: '1px solid var(--border-color)',
                        background: 'rgba(15, 23, 42, 0.95)',
                        backdropFilter: 'blur(10px)',
                        color: 'white',
                        fontSize: '0.9rem',
                        outline: 'none'
                    }}
                    onFocus={(e) => e.target.style.borderColor = 'var(--primary)'}
                    onBlur={(e) => e.target.style.borderColor = 'var(--border-color)'}
                />
                <button
                    type="submit"
                    disabled={searching}
                    style={{
                        padding: '10px 20px',
                        borderRadius: '8px',
                        border: 'none',
                        background: 'linear-gradient(135deg, var(--primary), #f97316)',
                        color: 'white',
                        fontWeight: '700',
                        cursor: searching ? 'wait' : 'pointer',
                        fontSize: '0.9rem',
                        opacity: searching ? 0.7 : 1
                    }}
                >
                    {searching ? '...' : 'Search'}
                </button>
            </form>

            {/* Map Container */}
            <div
                ref={mapRef}
                style={{
                    height: '100%',
                    width: '100%',
                    borderRadius: '16px'
                }}
            />

            {/* Overlay Info */}
            <div style={{
                position: 'absolute',
                bottom: '0',
                left: '0',
                right: '0',
                background: 'rgba(0,0,0,0.9)',
                backdropFilter: 'blur(4px)',
                padding: '12px',
                zIndex: 1000,
                borderTop: '1px solid rgba(255,255,255,0.1)'
            }}>
                {position ? (
                    <div>
                        <div style={{ color: '#4ade80', textAlign: 'center', fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '4px' }}>
                            ✅ Location: {position.lat.toFixed(6)}, {position.lng.toFixed(6)}
                        </div>
                        {address && (
                            <div style={{ color: 'var(--text-muted)', textAlign: 'center', fontSize: '0.8rem' }}>
                                📍 {address}
                            </div>
                        )}
                    </div>
                ) : (
                    <div style={{ color: 'var(--text-muted)', textAlign: 'center', fontSize: '0.9rem' }}>
                        👇 Click on the map or search for an address
                    </div>
                )}
            </div>
        </div>
    );
};

export default LocationPicker;
