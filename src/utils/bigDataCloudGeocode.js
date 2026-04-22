/**
 * Helpers for BigDataCloud client-side reverse-geocode responses.
 * @see https://www.bigdatacloud.com/packages/reverse-geocoding
 */

/**
 * When false: signup / onboarding skip GPS + reverse-geocode + IP fallback (no permission prompt,
 * no external geocode calls on mount). Users still fill location via venue search
 * (LocationAutocomplete, OSM Photon + Nominatim) and country/city fields manually.
 */
export const ENABLE_BACKGROUND_AREA_DETECT = true;

/** Browser geolocation: avoid indefinite hang; allow a recent cached position. */
export const GEOLOCATION_OPTIONS = {
    enableHighAccuracy: false,
    timeout: 20000,
    maximumAge: 300000,
};

function normalizeCountryCode(code, fallback = '') {
    const raw = String(code || '').trim().toUpperCase().slice(0, 2);
    if (raw.length === 2) return raw;
    const fb = String(fallback || '').trim().toUpperCase().slice(0, 2);
    return fb.length === 2 ? fb : '';
}

function getCurrentPositionAsync(options = GEOLOCATION_OPTIONS) {
    return new Promise((resolve, reject) => {
        if (!navigator?.geolocation) {
            reject(new Error('Geolocation unavailable'));
            return;
        }
        navigator.geolocation.getCurrentPosition(resolve, reject, options);
    });
}

/**
 * City/locality label from `reverse-geocode-client` JSON.
 * Many areas omit `city` but set `locality`, `village`, or nested `localityInfo`.
 * @param {Record<string, unknown>|null|undefined} data
 * @returns {string}
 */
export function cityFromBigDataCloudReverseClient(data) {
    if (!data || typeof data !== 'object') return '';
    const li = data.localityInfo;
    const nested =
        li && typeof li === 'object'
            ? String(li.name || li.city || li.locality || '').trim()
            : '';
    const order = [
        data.city,
        data.locality,
        data.village,
        data.borough,
        data.suburb,
        nested,
        data.principalSubdivision,
        data.county,
        data.state,
    ];
    for (const c of order) {
        const s = c == null ? '' : String(c).trim();
        if (s) return s;
    }
    return '';
}

/**
 * ISO 3166-1 alpha-2 from `reverse-geocode-client` JSON.
 * @param {Record<string, unknown>|null|undefined} data
 * @param {string} [fallback]
 * @returns {string} two-letter code or '' if unknown
 */
export function countryCodeFromBigDataCloudReverseClient(data, fallback = '') {
    const raw = String(data?.countryCode ?? '').trim().toUpperCase();
    if (raw.length === 2) return raw;
    const fb = String(fallback || '').trim().toUpperCase().slice(0, 2);
    return fb.length === 2 ? fb : '';
}

/**
 * Detect city/country in background with a resilient fallback chain:
 * 1) Browser GPS + BigDataCloud reverse geocode
 * 2) IP geolocation fallback when GPS or reverse-geocode fails
 */
export async function detectCityCountryInBackground({
    defaultCountryCode = 'AU',
    geolocationOptions = GEOLOCATION_OPTIONS,
} = {}) {
    let lat = null;
    let lng = null;

    try {
        const position = await getCurrentPositionAsync(geolocationOptions);
        lat = position?.coords?.latitude ?? null;
        lng = position?.coords?.longitude ?? null;

        if (lat != null && lng != null) {
            const response = await fetch(
                `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`
            );
            if (response.ok) {
                const data = await response.json();
                const city = cityFromBigDataCloudReverseClient(data);
                const countryCode = countryCodeFromBigDataCloudReverseClient(data, defaultCountryCode);
                const countryName = String(data?.countryName || '').trim();

                if (city || countryCode) {
                    return { city, countryCode, countryName, lat, lng, source: 'gps_reverse' };
                }
            }
        }
    } catch {
        // Fall through to IP fallback.
    }

    try {
        const { fetchIpLocation } = await import('./locationUtils');
        const ipData = await fetchIpLocation();
        const city = String(ipData?.city || '').trim();
        const countryCode = normalizeCountryCode(ipData?.country_code, defaultCountryCode);
        const ipLat = Number.isFinite(ipData?.latitude) ? ipData.latitude : null;
        const ipLng = Number.isFinite(ipData?.longitude) ? ipData.longitude : null;

        if (city || countryCode) {
            return {
                city,
                countryCode,
                countryName: '',
                lat: lat ?? ipLat,
                lng: lng ?? ipLng,
                source: 'ip_fallback',
            };
        }
    } catch {
        // Keep silent; caller can decide UI behavior.
    }

    return {
        city: '',
        countryCode: normalizeCountryCode('', defaultCountryCode),
        countryName: '',
        lat,
        lng,
        source: 'none',
    };
}
