/**
 * Server-side invitation rule helpers (mirrors src/utils/invitationRules.ts).
 */

const functions = require('firebase-functions');

const INVITATION_ERROR_CODES = {
    BUSINESS_CANNOT_CREATE: 'business-accounts-cannot-create-invitations',
    PUBLIC_MUST_BE_LOCAL: 'public-invite-must-be-local',
    LOCATION_NOT_DETERMINED: 'location-not-determined',
};

const PUBLIC_INVITE_GEOFENCE_RADIUS_KM = 30;

const PUBLIC_INVITE_GEOFENCE_ERROR_MESSAGE =
    'Sorry, public invitations are restricted to your current local area (within a 30 km radius).';

const LOCATION_NOT_DETERMINED_ERROR_MESSAGE =
    'Your location could not be determined. Enable GPS/location access to create a public invitation.';

const VENUE_LOCATION_NOT_DETERMINED_ERROR_MESSAGE =
    'Venue location could not be determined. Select a place with valid map coordinates.';

function parseLatLng(pair) {
    // Avoid Number(null) === 0 (Null Island) which falsely fails the 30 km gate.
    if (pair?.lat == null || pair?.lng == null || pair?.lat === '' || pair?.lng === '') {
        return null;
    }
    const lat = Number(pair.lat);
    const lng = Number(pair.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
    if (lat === 0 && lng === 0) return null;
    return { lat, lng };
}

function haversineKm(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
            Math.cos((lat2 * Math.PI) / 180) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function distanceBetweenCoords(a, b) {
    const p1 = parseLatLng(a);
    const p2 = parseLatLng(b);
    if (!p1 || !p2) return null;
    return haversineKm(p1.lat, p1.lng, p2.lat, p2.lng);
}

function normalizeCountryCode(raw) {
    const s = String(raw ?? '')
        .trim()
        .toUpperCase();
    // Only treat real ISO-3166 alpha-2 as comparable (avoid "AU" vs "AUSTRALIA").
    return /^[A-Z]{2}$/.test(s) ? s : '';
}

function crossesInternationalBorder(creatorCountryCode, venueCountryCode) {
    const creator = normalizeCountryCode(creatorCountryCode);
    const venue = normalizeCountryCode(venueCountryCode);
    if (!creator || !venue) return false;
    return creator !== venue;
}

function evaluatePublicInviteGeofence(input, radiusKm = PUBLIC_INVITE_GEOFENCE_RADIUS_KM) {
    if (!parseLatLng(input.creatorCoords) || !parseLatLng(input.venueCoords)) {
        return false;
    }

    if (crossesInternationalBorder(input.creatorCountryCode, input.venueCountryCode)) {
        return false;
    }

    const distanceKm = distanceBetweenCoords(input.creatorCoords, input.venueCoords);
    if (distanceKm == null) return false;

    return distanceKm <= radiusKm;
}

function assertPublicInvitationGeofenceRule(input) {
    if (!parseLatLng(input.creatorCoords)) {
        return {
            code: INVITATION_ERROR_CODES.LOCATION_NOT_DETERMINED,
            message: LOCATION_NOT_DETERMINED_ERROR_MESSAGE,
        };
    }

    if (!parseLatLng(input.venueCoords)) {
        return {
            code: INVITATION_ERROR_CODES.LOCATION_NOT_DETERMINED,
            message: VENUE_LOCATION_NOT_DETERMINED_ERROR_MESSAGE,
        };
    }

    if (crossesInternationalBorder(input.creatorCountryCode, input.venueCountryCode)) {
        return {
            code: INVITATION_ERROR_CODES.PUBLIC_MUST_BE_LOCAL,
            message: PUBLIC_INVITE_GEOFENCE_ERROR_MESSAGE,
        };
    }

    const distanceKm = distanceBetweenCoords(input.creatorCoords, input.venueCoords);
    if (distanceKm == null || distanceKm > PUBLIC_INVITE_GEOFENCE_RADIUS_KM) {
        return {
            code: INVITATION_ERROR_CODES.PUBLIC_MUST_BE_LOCAL,
            message: PUBLIC_INVITE_GEOFENCE_ERROR_MESSAGE,
        };
    }

    return null;
}

function isBusinessUserDoc(d) {
    if (!d) return false;
    const role = String(d.role || '').toLowerCase();
    if (d.isBusiness === true) return true;
    if (role === 'business' || role === 'partner') return true;
    if (String(d.accountType || '').toLowerCase() === 'business') return true;
    if (d.businessInfo && typeof d.businessInfo === 'object' && Object.keys(d.businessInfo).length > 0) {
        return true;
    }
    if (d.pendingBusinessRegistration === true) return true;
    return false;
}

function isCreatorBlockedFromInvitations(user) {
    if (!user) return true;
    if (user.isVirtual === true) return true;
    if (user.isGuest === true) return true;
    return isBusinessUserDoc(user);
}

function assertCreatorCanCreateInvitations(user) {
    if (isCreatorBlockedFromInvitations(user)) {
        return {
            code: INVITATION_ERROR_CODES.BUSINESS_CANNOT_CREATE,
            message: 'Business accounts cannot create social or private invites.',
        };
    }
    return null;
}

function asSafeCoord(value) {
    if (value == null || value === '') return null;
    const n = typeof value === 'number' ? value : Number(String(value).trim());
    return Number.isFinite(n) ? n : null;
}

function coordsFromBusinessLike(info, fallback = {}) {
    const nested = info?.coordinates || info?.location || info?.geo || fallback.coordinates || {};
    const pair = parseLatLng({
        lat: info?.lat ?? nested.lat ?? nested.latitude ?? fallback.lat,
        lng: info?.lng ?? nested.lng ?? nested.longitude ?? fallback.lng,
    });
    return {
        lat: pair?.lat ?? null,
        lng: pair?.lng ?? null,
        countryCode: info?.countryCode || info?.country || fallback.countryCode || null,
    };
}

async function resolveRestaurantGeo(db, restaurantId) {
    const id = String(restaurantId || '').trim();
    if (!id) return { lat: null, lng: null, countryCode: null };

    const profileSnap = await db.collection('public_profiles').doc(id).get();
    if (profileSnap.exists) {
        const data = profileSnap.data() || {};
        const info = data.businessPublic || {};
        return coordsFromBusinessLike(info, {
            lat: asSafeCoord(data.lat),
            lng: asSafeCoord(data.lng),
            countryCode: data.countryCode || null,
        });
    }

    const restSnap = await db.collection('restaurants').doc(id).get();
    if (restSnap.exists) {
        const data = restSnap.data() || {};
        return coordsFromBusinessLike(data, {
            countryCode: data.countryCode || null,
        });
    }

    return { lat: null, lng: null, countryCode: null };
}

function throwInvitationRuleError(ruleError) {
    const httpCode = ruleError.code === INVITATION_ERROR_CODES.BUSINESS_CANNOT_CREATE
        ? 'permission-denied'
        : 'failed-precondition';
    throw new functions.https.HttpsError(httpCode, ruleError.message, { reason: ruleError.code });
}

module.exports = {
    INVITATION_ERROR_CODES,
    PUBLIC_INVITE_GEOFENCE_RADIUS_KM,
    PUBLIC_INVITE_GEOFENCE_ERROR_MESSAGE,
    parseLatLng,
    haversineKm,
    distanceBetweenCoords,
    evaluatePublicInviteGeofence,
    isCreatorBlockedFromInvitations,
    assertCreatorCanCreateInvitations,
    assertPublicInvitationGeofenceRule,
    resolveRestaurantGeo,
    throwInvitationRuleError,
};
