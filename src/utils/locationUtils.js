/**
 * Unified utility for IP-based geolocation with fallbacks
 * This avoids dependency on a single service that might block/rate-limit.
 */

// Names that are states/regions, not cities — do not use as "city" when from IP/reverse-geocode
const STATE_NAMES = new Set([
    'queensland', 'new south wales', 'victoria', 'western australia', 'south australia',
    'tasmania', 'northern territory', 'australian capital territory', 'act',
    'england', 'scotland', 'wales', 'northern ireland', 'ontario', 'quebec', 'british columbia',
    'california', 'texas', 'new york', 'florida', 'washington', 'alberta', 'bavaria'
]);

function isLikelyStateOrRegion(name) {
    if (!name || typeof name !== 'string') return true;
    const n = name.trim().toLowerCase();
    return STATE_NAMES.has(n) || n.includes('region') || n.includes('state') || n.length > 20;
}

/** Best city label from reverse-geocode payload — never use state/province as city. */
export function pickCityFromReverseGeocode(d) {
    if (!d || typeof d !== 'object') return '';
    const candidates = [
        d.city,
        d.locality,
        d.localityInfo?.localityName,
        d.localityInfo?.adminName,
    ].filter(Boolean);
    for (const raw of candidates) {
        const label = String(raw).trim();
        if (label && !isLikelyStateOrRegion(label)) return label;
    }
    return '';
}

export const fetchIpLocation = async () => {
    // List of free services to try in order
    const services = [
        {
            name: 'bigdatacloud',
            url: 'https://api.bigdatacloud.net/data/reverse-geocode-client',
            map: (d) => {
                let city = d.city || d.locality || '';
                if (!city && d.principalSubdivision && !isLikelyStateOrRegion(d.principalSubdivision)) {
                    city = d.principalSubdivision;
                }
                return {
                    success: !!city,
                    city,
                    country_code: d.countryCode,
                    latitude: d.latitude,
                    longitude: d.longitude
                };
            }
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
            const response = await fetch(service.url, { timeout: 3000 });
            if (!response.ok) continue;

            const data = await response.json();
            const normalized = service.map(data);

            if (normalized.success) {
                return normalized;
            }
        } catch (error) {
            console.warn(`⚠️ ${service.name} failed:`, error.message);
        }
    }

    console.error('❌ All IP-location services failed.');
    return { success: false };
};

/** Approximate bounding box around a coordinate (km). Used for local place search bias. */
export function bboxFromCoords(lat, lng, radiusKm = 35) {
    const la = Number(lat);
    const ln = Number(lng);
    const r = Number(radiusKm);
    if (!Number.isFinite(la) || !Number.isFinite(ln) || !Number.isFinite(r) || r <= 0) return null;
    const latDelta = r / 111;
    const lngDelta = r / (111 * Math.max(0.2, Math.cos((la * Math.PI) / 180)));
    return {
        minLat: la - latDelta,
        maxLat: la + latDelta,
        minLon: ln - lngDelta,
        maxLon: ln + lngDelta,
    };
}

function readCurrentPosition(options) {
    return new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, options);
    });
}

/**
 * Live device GPS only — no profile, IP, or cached coordinates.
 * Used for public invitation geofencing (source of truth for creator position).
 */
export async function detectLiveUserGps() {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
        return { success: false, code: 'unsupported' };
    }

    try {
        let pos;
        try {
            pos = await readCurrentPosition({
                enableHighAccuracy: true,
                timeout: 15000,
                maximumAge: 0,
            });
        } catch {
            pos = await readCurrentPosition({
                enableHighAccuracy: false,
                timeout: 15000,
                maximumAge: 120000,
            });
        }

        const latitude = pos.coords.latitude;
        const longitude = pos.coords.longitude;

        let city = '';
        let country = '';
        let countryCode = '';

        try {
            const res = await fetch(
                `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`,
            );
            if (res.ok) {
                const d = await res.json();
                city = pickCityFromReverseGeocode(d);
                country = d.countryName || '';
                countryCode = d.countryCode || '';
            }
        } catch {
            /* GPS coords are sufficient; city label is optional */
        }

        return {
            success: true,
            source: 'gps',
            latitude,
            longitude,
            accuracy: pos.coords.accuracy,
            city,
            country,
            countryCode,
        };
    } catch (err) {
        const code =
            err?.code === 1 ? 'denied' : err?.code === 3 ? 'timeout' : 'unavailable';
        return { success: false, code };
    }
}

/**
 * Unified city discovery for general UI (non-invitation flows).
 * Order: live GPS + reverse geocode -> profile fallback -> IP fallback.
 */
export const detectUserLocationContext = async (userProfile = null) => {
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
        try {
            const pos = await new Promise((resolve, reject) =>
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                    timeout: 6000,
                    maximumAge: 0
                })
            );
            const { latitude, longitude } = pos.coords;
            const res = await fetch(
                `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
            );
            if (res.ok) {
                const d = await res.json();
                const city = pickCityFromReverseGeocode(d);
                if (city) {
                    return {
                        success: true,
                        source: 'gps',
                        city,
                        country: d.countryName || '',
                        countryCode: d.countryCode || '',
                        latitude,
                        longitude
                    };
                }
            }
        } catch {
            // Continue to profile/IP fallbacks.
        }
    }

    if (userProfile?.city && !isLikelyStateOrRegion(userProfile.city)) {
        return {
            success: true,
            source: 'profile',
            city: userProfile.city,
            country: userProfile.country || '',
            countryCode: userProfile.countryCode || '',
            latitude: userProfile.coordinates?.lat ?? null,
            longitude: userProfile.coordinates?.lng ?? null
        };
    }

    const ip = await fetchIpLocation();
    if (ip.success) {
        return {
            success: true,
            source: 'ip',
            city: ip.city || '',
            country: '',
            countryCode: ip.country_code || '',
            latitude: ip.latitude ?? null,
            longitude: ip.longitude ?? null
        };
    }

    return { success: false, source: 'none' };
};

/**
 * Geocodes an address to coordinates using Nominatim.
 */
export const geocode = async (address) => {
    try {
        if (!address) return { success: false, error: 'no_address' };

        // Same policy on every hostname: only skip when this session already marked Nominatim blocked.
        if (typeof window !== 'undefined') {
            const isSessionBlocked = sessionStorage.getItem('NOMINATIM_BLOCKED') === 'true';
            if (isSessionBlocked) {
                return { success: false, error: 'nominatim_blocked' };
            }
        }

        console.log(`🔍 Geocoding address: ${address}...`);

        // Append a random cache buster to avoid 403 from some networks
        const cacheBuster = Math.floor(Math.random() * 1000000);
        const { nominatimHeaders } = await import('./osmPhotonSearch');
        const response = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=5&accept-language=en&cb=${cacheBuster}`,
            { headers: nominatimHeaders() }
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
        if (typeof window !== 'undefined') {
            sessionStorage.setItem('NOMINATIM_BLOCKED', 'true');
        }
        return { success: false, error: error.message };
    }
};

/**
 * Geocode for map display — Nominatim first, then Photon (no API key, works when Nominatim is blocked).
 */
export const geocodeAddress = async (address) => {
    const nominatim = await geocode(address);
    if (nominatim.success) return nominatim;

    try {
        const q = encodeURIComponent(String(address || '').trim());
        if (!q) return nominatim;

        const res = await fetch(`https://photon.komoot.io/api/?q=${q}&limit=1&lang=en`);
        if (!res.ok) return nominatim;

        const data = await res.json();
        const feature = data?.features?.[0];
        const coords = feature?.geometry?.coordinates;
        if (!Array.isArray(coords) || coords.length < 2) return nominatim;

        const lat = parseFloat(coords[1]);
        const lng = parseFloat(coords[0]);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return nominatim;

        return {
            success: true,
            source: 'photon',
            results: [{
                lat,
                lng,
                displayName: feature.properties?.name || address,
                raw: feature,
            }],
        };
    } catch (err) {
        console.warn('Photon geocode failed:', err?.message || err);
        return nominatim;
    }
};

/**
 * Reverse geocodes coordinates to an address using Nominatim.
 * Falls back to IP location if Nominatim fails or is blocked.
 */
export const reverseGeocode = async (lat, lng) => {
    try {
        if (typeof window !== 'undefined') {
            const isSessionBlocked = sessionStorage.getItem('NOMINATIM_BLOCKED') === 'true';
            if (isSessionBlocked) {
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
        if (typeof window !== 'undefined') {
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

/** Pull a city-like token from a comma-separated address when `city` field is missing. */
export function extractCityTokenFromAddress(address) {
    const raw = String(address ?? '').trim();
    if (!raw) return '';
    const parts = raw.split(',').map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 2) {
        const candidate = parts[parts.length - 2] || parts[parts.length - 1] || '';
        return candidate.replace(/\b[A-Z]{2,3}\s*\d{4,5}\b/gi, '').replace(/\b\d{4,5}\b/g, '').trim();
    }
    return parts[0] || '';
}
