/**
 * Same coordinate resolution as src/utils/userDocCoords.js (CommonJS for Cloud Functions).
 */

function toFinite(v) {
    if (v == null || v === '') return null;
    const n = typeof v === 'number' ? v : parseFloat(String(v).trim());
    return Number.isFinite(n) ? n : null;
}

function valid(lat, lng) {
    return (
        lat != null &&
        lng != null &&
        lat >= -90 &&
        lat <= 90 &&
        lng >= -180 &&
        lng <= 180
    );
}

function getUserDocLatLng(u) {
    if (!u || typeof u !== 'object') return null;

    const coords = u.coordinates;
    if (coords && typeof coords === 'object') {
        const lat = toFinite(coords.lat ?? coords.latitude);
        const lng = toFinite(coords.lng ?? coords.longitude);
        if (valid(lat, lng)) return { lat, lng };
    }

    const uLat = toFinite(u.userLat);
    const uLng = toFinite(u.userLng);
    if (valid(uLat, uLng)) return { lat: uLat, lng: uLng };

    const loc = u.location;
    if (loc && typeof loc === 'object') {
        const lat = toFinite(loc.latitude ?? loc._latitude ?? loc.lat);
        const lng = toFinite(loc.longitude ?? loc._longitude ?? loc.lng);
        if (valid(lat, lng)) return { lat, lng };
    }

    const bi = u.businessInfo;
    if (bi && typeof bi === 'object') {
        const lat = toFinite(bi.lat ?? bi.location?.latitude);
        const lng = toFinite(bi.lng ?? bi.location?.longitude);
        if (valid(lat, lng)) return { lat, lng };
    }

    return null;
}

module.exports = { getUserDocLatLng };
