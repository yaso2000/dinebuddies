import React, { createContext, useContext, useState, useEffect } from 'react';

const LocationContext = createContext();

export const useLocation = () => {
    const context = useContext(LocationContext);
    if (!context) {
        throw new Error('useLocation must be used within a LocationProvider');
    }
    return context;
};

export const LocationProvider = ({ children }) => {
    const [currentCity, setCurrentCity] = useState(null);
    const [location, setLocation] = useState(null); // { lat, lng }
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [usingFallback, setUsingFallback] = useState(false);

    // Initialize from localStorage
    useEffect(() => {
        const savedCity = localStorage.getItem('userCity');
        const savedLocation = localStorage.getItem('userLocation');

        if (savedCity && savedLocation) {
            setCurrentCity(JSON.parse(savedCity));
            setLocation(JSON.parse(savedLocation));
            setLoading(false);
        } else {
            // Auto-detect immediately if no saved location
            detectLocation();
        }
    }, []);

    const detectLocation = () => {
        setLoading(true);
        setError(null);

        if (!navigator.geolocation) {
            console.warn('Geolocation not supported, using IP fallback');
            detectLocationFallback();
            return;
        }

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude } = position.coords;
                const newLocation = { lat: latitude, lng: longitude };

                setLocation(newLocation);
                localStorage.setItem('userLocation', JSON.stringify(newLocation));
                setUsingFallback(false);

                // Reverse Geocode to get City
                try {
                    await fetchCityName(latitude, longitude);
                } catch (err) {
                    console.error('Error fetching city name:', err);
                    setError('Failed to get city name');
                } finally {
                    setLoading(false);
                }
            },
            (err) => {
                console.error('Geolocation error:', err);
                console.log('Trying IP fallback...');
                detectLocationFallback();
            },
            { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
        );
    };

    const detectLocationFallback = async () => {
        try {
            // First try: ipapi.co
            const response = await fetch('https://ipapi.co/json/');
            const data = await response.json();

            if (data && data.latitude && data.longitude) {
                const newLocation = { lat: data.latitude, lng: data.longitude };
                setLocation(newLocation);
                setUsingFallback(true);
                localStorage.setItem('userLocation', JSON.stringify(newLocation));

                if (data.city) {
                    console.log('📍 Detected City (IP - ipapi):', data.city);
                    setCurrentCity(data.city);
                    localStorage.setItem('userCity', JSON.stringify(data.city));
                }
                return; // Success
            }
            throw new Error('primary fallback failed');
        } catch (error) {
            console.warn('Primary IP fallback failed, trying secondary...', error);
            try {
                // Secondary try: BigDataCloud (Free, no key)
                const response = await fetch('https://api.bigdatacloud.net/data/reverse-geocode-client');
                const data = await response.json();

                if (data && data.latitude && data.longitude) {
                    const newLocation = { lat: data.latitude, lng: data.longitude };
                    setLocation(newLocation);
                    setUsingFallback(true);
                    localStorage.setItem('userLocation', JSON.stringify(newLocation));

                    // Use city or locality
                    const city = data.city || data.locality || data.principalSubdivision;
                    if (city) {
                        console.log('📍 Detected City (IP - BDC):', city);
                        setCurrentCity(city);
                        localStorage.setItem('userCity', JSON.stringify(city));
                    }
                    return; // Success
                }
            } catch (err2) {
                console.error('All IP fallbacks failed:', err2);
                setError('Could not detect location. Please select manually.');
            }
        } finally {
            setLoading(false);
        }
    };

    const fetchCityName = async (lat, lng) => {
        // Wait for Google Maps API to load if not ready
        const waitForGoogleMaps = () => {
            return new Promise((resolve, reject) => {
                if (window.google && window.google.maps) {
                    resolve();
                } else {
                    let attempts = 0;
                    const interval = setInterval(() => {
                        attempts++;
                        if (window.google && window.google.maps) {
                            clearInterval(interval);
                            resolve();
                        } else if (attempts > 50) { // Timeout after ~5 seconds
                            clearInterval(interval);
                            reject(new Error('Google Maps API timeout'));
                        }
                    }, 100);
                }
            });
        };

        try {
            await waitForGoogleMaps();

            const geocoder = new window.google.maps.Geocoder();
            const latlng = { lat, lng };

            const response = await geocoder.geocode({ location: latlng });
            if (response.results && response.results[0]) {
                const addressComponents = response.results[0].address_components;

                // Try to find locality (City)
                let city = addressComponents.find(comp => comp.types.includes('locality'))?.long_name;

                // Fallback to administrative_area_level_2 (County/Region) if locality not found
                if (!city) {
                    city = addressComponents.find(comp => comp.types.includes('administrative_area_level_2'))?.long_name;
                }
                // Fallback to administrative_area_level_1 (State/Province) if earlier ones not found
                if (!city) {
                    city = addressComponents.find(comp => comp.types.includes('administrative_area_level_1'))?.long_name;
                }

                if (city) {
                    console.log('📍 Detected City:', city);
                    setCurrentCity(city);
                    localStorage.setItem('userCity', JSON.stringify(city));
                } else {
                    console.warn('City not found in address components');
                    // Optional: Set a fallback based on country or something else?
                }
            }
        } catch (error) {
            console.error('Geocoding failed:', error);
            // Don't throw, just log. We don't want to crash the app if geocoding fails.
            setError('Failed to fetch city name');
        }
    };

    const setManualLocation = (city, lat, lng) => {
        setCurrentCity(city);
        const loc = { lat, lng };
        setLocation(loc);

        localStorage.setItem('userCity', JSON.stringify(city));
        localStorage.setItem('userLocation', JSON.stringify(loc));
    };

    const value = {
        currentCity,
        location,
        loading,
        error,
        usingFallback,
        detectLocation,
        setManualLocation
    };

    return (
        <LocationContext.Provider value={value}>
            {children}
        </LocationContext.Provider>
    );
};

export default LocationContext;
