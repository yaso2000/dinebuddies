/**
 * Unified utility for IP-based geolocation with fallbacks
 * This avoids dependency on a single service that might block/rate-limit.
 */
export const fetchIpLocation = async () => {
    // List of free services to try in order
    const services = [
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
