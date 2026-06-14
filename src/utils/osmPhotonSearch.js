/**
 * Venue search without Google Places: Photon (OSM) + Nominatim (city bbox / cities).
 * Photon: https://photon.komoot.io — no API key.
 * Nominatim: https://nominatim.openstreetmap.org — usage policy: identify app + cache + rate limit.
 */

const PHOTON_API = 'https://photon.komoot.io/api/';
const NOMINATIM = 'https://nominatim.openstreetmap.org';

/** Required by Nominatim; set a stable contact in production if you self-host or scale up. */
export function nominatimHeaders() {
    return {
        Accept: 'application/json',
        'Accept-Language': typeof navigator !== 'undefined' ? (navigator.language || 'en') : 'en',
        'User-Agent': 'DineBuddies/1.0 (venue search; https://dinebuddies.app)',
    };
}

const cityBboxCache = new Map();

/**
 * @returns {Promise<{ minLon: number, minLat: number, maxLon: number, maxLat: number } | null>}
 */
export async function fetchCityBoundingBox(city, countryCode, stateOrRegion) {
    const c = String(city || '').trim();
    const cc = String(countryCode || '').trim().toUpperCase().slice(0, 2);
    const region = String(stateOrRegion || '').trim();
    if (c.length < 2 || cc.length !== 2) return null;

    const key = `${c.toLowerCase()}\u001f${cc}\u001f${region.toLowerCase()}`;
    if (cityBboxCache.has(key)) return cityBboxCache.get(key);

    try {
        const queryParts = [c, region].filter(Boolean).join(', ');
        const url = `${NOMINATIM}/search?format=json&q=${encodeURIComponent(queryParts)}&countrycodes=${cc.toLowerCase()}&limit=1&addressdetails=0`;
        const res = await fetch(url, { headers: nominatimHeaders() });
        if (!res.ok) return null;
        const data = await res.json();
        const item = data?.[0];
        const bb = item?.boundingbox;
        if (!Array.isArray(bb) || bb.length < 4) return null;
        const south = parseFloat(bb[0]);
        const north = parseFloat(bb[1]);
        const west = parseFloat(bb[2]);
        const east = parseFloat(bb[3]);
        if (![south, north, west, east].every(Number.isFinite)) return null;
        const bbox = { minLon: west, minLat: south, maxLon: east, maxLat: north };
        cityBboxCache.set(key, bbox);
        return bbox;
    } catch {
        return null;
    }
}

/**
 * @param {object} p
 * @returns {Array<{ long_name: string, short_name: string, types: string[] }>}
 */
export function buildOsmSyntheticAddressComponents(p, countryCodeHint) {
    const cc = String(p.countrycode || countryCodeHint || '').toUpperCase().slice(0, 2);
    const arr = [];
    const locality =
        p.city || p.town || p.village || p.district || p.municipality || p.county || '';
    if (locality) {
        arr.push({ long_name: locality, short_name: '', types: ['locality'] });
    }
    if (p.country) {
        arr.push({ long_name: p.country, short_name: cc || '', types: ['country'] });
    }
    return arr;
}

/**
 * Map Photon/OSM tags to Google-like types for UI icons.
 * @param {Record<string, unknown>} p - feature.properties
 */
export function photonPropertiesToTypes(p) {
    const types = [];
    const amenity = p.amenity;
    const shop = p.shop;
    if (amenity === 'restaurant' || amenity === 'cafe' || amenity === 'fast_food' || amenity === 'food_court') {
        types.push('restaurant');
    }
    if (amenity === 'bar' || amenity === 'pub' || amenity === 'biergarten') types.push('bar');
    if (amenity === 'nightclub') types.push('night_club');
    if (shop === 'mall' || shop === 'department_store') types.push('shopping_mall');
    if (!types.length) types.push('establishment');
    return types;
}

function formatPhotonAddress(p) {
    const line = [
        [p.housenumber, p.street].filter(Boolean).join(' '),
        p.city || p.town || p.district || p.village,
        p.state,
        p.postcode,
        p.country,
    ]
        .filter(Boolean)
        .join(', ');
    return line || p.name || '';
}

/**
 * @param {GeoJSON.Feature} feature
 */
export function photonFeatureToVenuePayload(feature) {
    const coords = feature?.geometry?.coordinates;
    const lon = Array.isArray(coords) ? coords[0] : null;
    const lat = Array.isArray(coords) ? coords[1] : null;
    const p = feature.properties || {};
    const name = p.name || p.street || formatPhotonAddress(p) || 'Place';
    const fullAddress = formatPhotonAddress(p) || name;
    const osmType = p.osm_type || 'node';
    const osmId = p.osm_id;
    const placeId = osmId != null ? `osm:${osmType}:${osmId}` : null;

    return {
        name,
        fullAddress,
        addressComponents: buildOsmSyntheticAddressComponents(p, ''),
        lat,
        lng: lon,
        placeId,
        types: photonPropertiesToTypes(p),
        photos: [],
        phone: '',
        website: typeof p.website === 'string' ? p.website : '',
        openingHours: null,
        editorialSummary: '',
        rating: null,
        userRatingsTotal: null,
        priceLevel: null,
        businessStatus: null,
    };
}

/**
 * @param {object} opts
 * @param {string} opts.query
 * @param {string} [opts.lang]
 * @param {number} [opts.limit]
 * @param {{ minLon: number, minLat: number, maxLon: number, maxLat: number } | null} [opts.bbox]
 * @param {number} [opts.lat] proximity bias
 * @param {number} [opts.lon]
 */
export async function searchPhoton(opts) {
    const q = String(opts.query || '').trim();
    if (q.length < 2) return { features: [] };

    const limit = Math.min(Math.max(Number(opts.limit) || 12, 1), 24);
    const params = new URLSearchParams({
        q,
        limit: String(limit),
        lang: opts.lang || 'en',
    });
    const bbox = opts.bbox;
    if (bbox && [bbox.minLon, bbox.minLat, bbox.maxLon, bbox.maxLat].every(Number.isFinite)) {
        params.set('bbox', `${bbox.minLon},${bbox.minLat},${bbox.maxLon},${bbox.maxLat}`);
    }
    if (opts.lat != null && opts.lon != null && Number.isFinite(opts.lat) && Number.isFinite(opts.lon)) {
        params.set('lat', String(opts.lat));
        params.set('lon', String(opts.lon));
    }

    const url = `${PHOTON_API}?${params.toString()}`;
    const res = await fetch(url);
    if (!res.ok) return { features: [] };
    const data = await res.json();
    const features = Array.isArray(data?.features) ? data.features : [];
    return { features };
}

/**
 * Prefer results whose locality matches the user's city (substring match).
 * @param {GeoJSON.Feature[]} features
 * @param {string} cityName
 */
export function filterPhotonByCityName(features, cityName) {
    if (!cityName || !String(cityName).trim()) return features;
    const cl = cityName.toLowerCase().trim();
    const scored = features.map((f) => {
        const p = f.properties || {};
        const locality = (p.city || p.town || p.village || p.district || '').toLowerCase();
        const match = locality.includes(cl) || cl.includes(locality);
        return { f, match };
    });
    const good = scored.filter((s) => s.match).map((s) => s.f);
    return good.length ? good : features;
}

/**
 * City search (Nominatim) — replaces Google Places "(cities)".
 * @param {string} query
 * @param {string} [countryCode] ISO2
 */
export async function searchNominatimCities(query, countryCode, stateOrRegion) {
    const q = String(query || '').trim();
    if (q.length < 2) return [];

    const cc = countryCode ? String(countryCode).toUpperCase().slice(0, 2).toLowerCase() : '';
    const region = String(stateOrRegion || '').trim();
    const url = new URL(`${NOMINATIM}/search`);
    url.searchParams.set('format', 'json');
    url.searchParams.set('q', region ? `${q}, ${region}` : q);
    url.searchParams.set('limit', '10');
    url.searchParams.set('addressdetails', '1');
    if (cc) url.searchParams.set('countrycodes', cc);

    const res = await fetch(url.toString(), { headers: nominatimHeaders() });
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data)) return [];

    const mapped = data
        .filter((item) => {
            const t = item.type || '';
            const cls = item.class || '';
            if (cls === 'place') {
                return ['city', 'town', 'village', 'municipality', 'suburb', 'hamlet', 'locality'].includes(t);
            }
            return cls === 'boundary' && t === 'administrative';
        })
        .map((item) => {
            const addr = item.address || {};
            const city =
                addr.city ||
                addr.town ||
                addr.village ||
                addr.municipality ||
                addr.suburb ||
                item.name ||
                '';
            const countryCodeOut = (addr.country_code || '').toUpperCase().slice(0, 2);
            return {
                place_id: `nominatim:${item.place_id}`,
                description: item.display_name,
                main_text: city || item.name,
                secondary_text: item.display_name,
                nominatim: item,
                city,
                countryCode: countryCodeOut,
            };
        });

    if (mapped.length) return mapped;

    return data.slice(0, 8).map((item) => {
        const addr = item.address || {};
        const city =
            addr.city ||
            addr.town ||
            addr.village ||
            addr.municipality ||
            addr.suburb ||
            item.name ||
            '';
        const countryCodeOut = (addr.country_code || '').toUpperCase().slice(0, 2);
        return {
            place_id: `nominatim:${item.place_id}`,
            description: item.display_name,
            main_text: city || item.name,
            secondary_text: item.display_name,
            nominatim: item,
            city,
            countryCode: countryCodeOut,
        };
    });
}

/**
 * Resolve a city pick to lat/lng + suggested radius km from bbox (admin / filters).
 */
export function nominatimCityToLatLngRadius(nominatimItem) {
    if (!nominatimItem) return null;
    const lat = parseFloat(nominatimItem.lat);
    const lon = parseFloat(nominatimItem.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

    let radiusKm = 35;
    const bb = nominatimItem.boundingbox;
    if (Array.isArray(bb) && bb.length >= 4) {
        const south = parseFloat(bb[0]);
        const north = parseFloat(bb[1]);
        const west = parseFloat(bb[2]);
        const east = parseFloat(bb[3]);
        if ([south, north, west, east].every(Number.isFinite)) {
            const R = 6371;
            const toRad = (d) => (d * Math.PI) / 180;
            const dLat = toRad(north - south);
            const dLng = toRad(east - west);
            const a =
                Math.sin(dLat / 2) ** 2 +
                Math.cos(toRad(south)) * Math.cos(toRad(north)) * Math.sin(dLng / 2) ** 2;
            const diag = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            radiusKm = Math.min(100, Math.max(12, (diag / 2) * 1.15));
        }
    }
    return { lat, lng: lon, radiusKm: Math.round(radiusKm) };
}
