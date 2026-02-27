/**
 * Unified utility for IP-based geolocation with fallbacks
 * This avoids dependency on a single service that might block/rate-limit.
 */
export const fetchIpLocation = async () => {
    // List of free services to try in order
    const services = [
        {
            name: 'bigdatacloud',
            url: 'https://api.bigdatacloud.net/data/reverse-geocode-client',
            map: (d) => ({
                success: !!d.city || !!d.locality,
                city: d.city || d.locality || d.principalSubdivision || '',
                country_code: d.countryCode,
                latitude: d.latitude,
                longitude: d.longitude
            })
        },
        {
            name: 'ipapi.co',
            url: 'https://ipapi.co/json/',
            map: (d) => ({
                success: !d.error,
                city: d.city,
                country_code: d.country_code,
                latitude: d.latitude,
                longitude: d.longitude
            })
        },
        {
            name: 'ipinfo.io',
            url: 'https://ipinfo.io/json', // Note: might require token for some, but basic works
            map: (d) => {
                const [lat, lng] = (d.loc || '0,0').split(',');
                return {
                    success: !!d.city,
                    city: d.city,
                    country_code: d.country,
                    latitude: parseFloat(lat),
                    longitude: parseFloat(lng)
                };
            }
        },
    ];

    for (const service of services) {
        try {
            console.log(`🌐 Trying IP-location service: ${service.name}...`);
            const response = await fetch(service.url, { timeout: 3000 });
            if (!response.ok) continue;

            const data = await response.json();
            const normalized = service.map(data);

            if (normalized.success) {
                console.log(`✅ IP Location found via ${service.name}:`, normalized.city);
                return normalized;
            }
        } catch (error) {
            console.warn(`⚠️ ${service.name} failed:`, error.message);
        }
    }

    console.error('❌ All IP-location services failed.');
    return { success: false };
};

/**
 * Geocodes an address to coordinates using Nominatim.
 */
export const geocode = async (address) => {
    try {
        if (!address) return { success: false, error: 'no_address' };

        // Quietly bypass if we know Nominatim is blocked or if on production domain
        if (typeof window !== 'undefined') {
            const isProd = window.location.hostname.includes('dinebuddies.com');
            const isSessionBlocked = sessionStorage.getItem('NOMINATIM_BLOCKED') === 'true';

            if (isProd || isSessionBlocked) {
                return { success: false, error: 'nominatim_blocked' };
            }
        }

        console.log(`🔍 Geocoding address: ${address}...`);

        // Append a random cache buster to avoid 403 from some networks
        const cacheBuster = Math.floor(Math.random() * 1000000);
        const response = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=5&accept-language=en&cb=${cacheBuster}`,
            {
                headers: {
                    'Accept-Language': 'en'
                }
            }
        );

        if (response.status === 403 || !response.ok) {
            if (typeof window !== 'undefined') sessionStorage.setItem('NOMINATIM_BLOCKED', 'true');
            return { success: false, error: 'nominatim_blocked' };
        }

        const data = await response.json();
        if (data && data.length > 0) {
            return {
                success: true,
                results: data.map(item => ({
                    lat: parseFloat(item.lat),
                    lng: parseFloat(item.lon),
                    displayName: item.display_name,
                    raw: item
                }))
            };
        }
        return { success: false, error: 'no_results' };
    } catch (error) {
        console.warn('⚠️ Geocode failed:', error.message);
        // Treat generic fetch failures on prod as blocks to avoid noise
        if (typeof window !== 'undefined' && window.location.hostname.includes('dinebuddies.com')) {
            sessionStorage.setItem('NOMINATIM_BLOCKED', 'true');
        }
        return { success: false, error: error.message };
    }
};

/**
 * Reverse geocodes coordinates to an address using Nominatim.
 * Falls back to IP location if Nominatim fails or is blocked.
 */
export const reverseGeocode = async (lat, lng) => {
    try {
        // Quietly bypass if we know Nominatim is blocked or if on production domain
        if (typeof window !== 'undefined') {
            const isProd = window.location.hostname.includes('dinebuddies.com');
            const isSessionBlocked = sessionStorage.getItem('NOMINATIM_BLOCKED') === 'true';

            if (isProd || isSessionBlocked) {
                return { success: false, error: 'nominatim_blocked' };
            }
        }

        console.log(`🔍 Reverse geocoding: ${lat}, ${lng}...`);

        // Append a random cache buster to avoid 403 from some networks
        const cacheBuster = Math.floor(Math.random() * 1000000);
        const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=en&cb=${cacheBuster}`,
            {
                headers: {
                    'Accept-Language': 'en'
                }
            }
        );

        if (response.status === 403 || !response.ok) {
            console.warn('⚠️ Nominatim reverse geocode blocked or failed. Returning blocked status.');
            if (typeof window !== 'undefined') sessionStorage.setItem('NOMINATIM_BLOCKED', 'true');
            return { success: false, error: 'nominatim_blocked' };
        }

        const data = await response.json();
        if (data && data.display_name) {
            const city = data.address.city || data.address.town || data.address.village || data.address.suburb || '';
            const country = data.address.country || '';

            return {
                success: true,
                fullLocation: data.display_name,
                city,
                country,
                raw: data.address
            };
        }
        return { success: false, error: 'no_results' };
    } catch (error) {
        console.warn('⚠️ Nominatim reverse geocode rejected or failed. Trying fallback...');
        if (typeof window !== 'undefined' && window.location.hostname.includes('dinebuddies.com')) {
            sessionStorage.setItem('NOMINATIM_BLOCKED', 'true');
        }

        // Fallback to BigDataCloud if Nominatim is blocked or failed
        console.log(`🌐 Trying BigDataCloud fallback for reverse geocoding: ${lat}, ${lng}...`);
        try {
            const fallbackResponse = await fetch(
                `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`
            );
            if (fallbackResponse.ok) {
                const d = await fallbackResponse.json();
                console.log(`✅ Reverse geocode found via BigDataCloud:`, d.city || d.locality);
                return {
                    success: true,
                    fullLocation: `${d.city || d.locality}, ${d.principalSubdivision || ''}, ${d.countryName || ''}`.replace(/^, /, ''),
                    city: d.city || d.locality || '',
                    country: d.countryName || '',
                    raw: d
                };
            }
        } catch (fallbackError) {
            console.error('❌ Reverse geocode fallback failed:', fallbackError.message);
        }

        return { success: false, error: error.message };
    }
};
