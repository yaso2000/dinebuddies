/**
 * Resolve invitation venue coordinates from all known Firestore / UI shapes.
 * Some legacy or imported docs only have `coordinates` or GeoPoint-like fields.
 */

function toFiniteCoord(v) {
    if (v == null || v === '') return null;
    const n = typeof v === 'number' ? v : parseFloat(String(v).trim());
    return Number.isFinite(n) ? n : null;
}

function isValidLatLng(lat, lng) {
    return (
        lat != null &&
        lng != null &&
        lat >= -90 &&
        lat <= 90 &&
        lng >= -180 &&
        lng <= 180
    );
}

/**
 * @returns {{ lat: number, lng: number } | null}
 */
export function getInvitationLatLng(inv) {
    if (!inv || typeof inv !== 'object') return null;

    let lat = toFiniteCoord(inv.lat);
    let lng = toFiniteCoord(inv.lng);
    if (isValidLatLng(lat, lng)) return { lat, lng };

    const c = inv.coordinates;
    if (c && typeof c === 'object') {
        lat = toFiniteCoord(c.lat ?? c.latitude);
        lng = toFiniteCoord(c.lng ?? c.longitude);
        if (isValidLatLng(lat, lng)) return { lat, lng };
    }

    const gp = inv.location ?? inv.geo ?? inv.venueLocation;
    if (gp && typeof gp === 'object') {
        lat = toFiniteCoord(gp.latitude ?? gp._latitude ?? gp.lat);
        lng = toFiniteCoord(gp.longitude ?? gp._longitude ?? gp.lng);
        if (isValidLatLng(lat, lng)) return { lat, lng };
    }

    return null;
}

export function enrichInvitationCoords(inv) {
    const coords = getInvitationLatLng(inv);
    if (!coords) return { ...inv };
    return { ...inv, lat: coords.lat, lng: coords.lng };
}

/**
 * Resolve venue pin before save: keep explicit lat/lng, else geocode location + city + country.
 * @returns {Promise<{ lat: number | null, lng: number | null, geocoded: boolean }>}
 */
export async function resolveVenueCoordinates({
    lat,
    lng,
    location,
    city,
    country,
} = {}) {
    const resolvedLat = toFiniteCoord(lat);
    const resolvedLng = toFiniteCoord(lng);
    if (isValidLatLng(resolvedLat, resolvedLng)) {
        return { lat: resolvedLat, lng: resolvedLng, geocoded: false };
    }

    const { geocode } = await import('./locationUtils');
    const parts = [location, city, country]
        .map((v) => (v == null ? '' : String(v).trim()))
        .filter(Boolean);
    if (!parts.length) {
        return { lat: null, lng: null, geocoded: false };
    }

    const result = await geocode(parts.join(', '));
    if (result.success && result.results?.[0]) {
        const hit = result.results[0];
        const geoLat = toFiniteCoord(hit.lat);
        const geoLng = toFiniteCoord(hit.lng);
        if (isValidLatLng(geoLat, geoLng)) {
            return { lat: geoLat, lng: geoLng, geocoded: true };
        }
    }

    return { lat: null, lng: null, geocoded: false };
}
