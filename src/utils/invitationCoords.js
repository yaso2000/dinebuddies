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
