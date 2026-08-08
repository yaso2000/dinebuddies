import {
    haversineKm,
    normalizePlaceLabel,
} from './postsFeedScope';
import { getUserDocLatLng } from './userDocCoords';

/** @typedef {'all' | 'male' | 'female'} DirectoryGenderFilter */
/** @typedef {'global' | 'country' | 'city'} DirectoryGeoScope */
/** @typedef {'country' | 'region' | 'city' | 'point'} DirectoryPlaceScope */

function cityMatches(memberCityNorm, userCityNorm) {
    if (!memberCityNorm || !userCityNorm) return false;
    return memberCityNorm === userCityNorm || memberCityNorm.includes(userCityNorm) || userCityNorm.includes(memberCityNorm);
}

function countryMatches(memberCountryNorm, userCountryNorm, memberCountryCode, userCountryCode) {
    if (userCountryCode && memberCountryCode && userCountryCode === memberCountryCode) return true;
    if (userCountryNorm && memberCountryNorm && memberCountryNorm === userCountryNorm) return true;
    return false;
}

function memberLatLng(user) {
    const fromDoc = getUserDocLatLng(user);
    if (fromDoc) return fromDoc;
    const lat = Number(user?.lat ?? user?.latitude);
    const lng = Number(user?.lng ?? user?.longitude ?? user?.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
}

/** Distance in km between origin and member, or null if either side lacks coords. */
export function getMemberDistanceKm(user, userLocation) {
    if (!userLocation) return null;
    const viewerLat = Number(userLocation.lat);
    const viewerLng = Number(userLocation.lng);
    if (!Number.isFinite(viewerLat) || !Number.isFinite(viewerLng)) return null;
    const coords = memberLatLng(user);
    if (!coords) return null;
    return haversineKm(viewerLat, viewerLng, coords.lat, coords.lng);
}

/** Nearest first; members without coords go last (stable among themselves). */
export function sortDirectoryUsersByDistance(users, userLocation) {
    if (!users?.length) return users || [];
    if (!userLocation) return users;
    return [...users].sort((a, b) => {
        const da = getMemberDistanceKm(a, userLocation);
        const db = getMemberDistanceKm(b, userLocation);
        if (da == null && db == null) return 0;
        if (da == null) return 1;
        if (db == null) return -1;
        if (da === db) return 0;
        return da - db;
    });
}

/** @param {DirectoryGenderFilter} genderFilter */
export function memberMatchesGenderFilter(user, genderFilter) {
    if (!genderFilter || genderFilter === 'all') return true;
    return String(user?.gender || '').trim().toLowerCase() === genderFilter;
}

/**
 * Infer how precise a Google (or OSM) place selection is.
 * @param {object | null | undefined} place
 * @returns {DirectoryPlaceScope}
 */
export function inferDirectoryPlaceScope(place) {
    if (!place) return 'point';
    const typeSet = new Set();
    for (const c of place.addressComponents || []) {
        for (const t of c.types || []) typeSet.add(t);
    }
    for (const t of place.types || []) typeSet.add(t);

    const hasLocality =
        typeSet.has('locality') ||
        typeSet.has('postal_town') ||
        typeSet.has('sublocality') ||
        typeSet.has('sublocality_level_1');
    const hasRegion = typeSet.has('administrative_area_level_1');
    const hasCountry = typeSet.has('country');
    const city = String(place.city || '').trim();
    const country = String(place.country || place.countryCode || '').trim();

    if (hasCountry && !hasLocality && !hasRegion && !city) return 'country';
    if (hasRegion && !hasLocality) return 'region';
    if (city || hasLocality) return 'city';
    if (country) return 'country';
    return 'point';
}

/**
 * Match members against a place picked from Google Maps autocomplete.
 */
export function memberMatchesSelectedPlace(user, place) {
    if (!place) return true;

    const scope = place.scope || inferDirectoryPlaceScope(place);
    const memberCity = normalizePlaceLabel(user?.city);
    const memberCountry = normalizePlaceLabel(user?.country);
    const memberCountryCode = String(user?.countryCode || user?.country_code || '')
        .trim()
        .toLowerCase();
    const placeCity = normalizePlaceLabel(place.city);
    const placeCountry = normalizePlaceLabel(place.country);
    const placeCountryCode = String(place.countryCode || place.country_code || '')
        .trim()
        .toLowerCase();

    const coords = memberLatLng(user);
    const placeLat = Number(place.lat);
    const placeLng = Number(place.lng);
    const hasPlaceCoords = Number.isFinite(placeLat) && Number.isFinite(placeLng);
    const radiusKm = scope === 'country' ? 500 : scope === 'region' ? 200 : 50;

    if (scope === 'country') {
        if (countryMatches(memberCountry, placeCountry, memberCountryCode, placeCountryCode)) {
            return true;
        }
        if (hasPlaceCoords && coords) {
            return haversineKm(placeLat, placeLng, coords.lat, coords.lng) < radiusKm;
        }
        return false;
    }

    if (placeCity && cityMatches(memberCity, placeCity)) {
        if (placeCountry || placeCountryCode) {
            if (countryMatches(memberCountry, placeCountry, memberCountryCode, placeCountryCode)) {
                return true;
            }
        } else {
            return true;
        }
    }

    if (hasPlaceCoords && coords) {
        return haversineKm(placeLat, placeLng, coords.lat, coords.lng) < radiusKm;
    }

    return false;
}

/**
 * Geo scope for member directory — viewer-relative (kept for other callers).
 */
export function memberMatchesGeoScope(user, geoScope, {
    userCityNorm = '',
    userCountryNorm = '',
    userCountryCode = '',
    userLocation = null,
} = {}) {
    const scope = geoScope === 'local' ? 'city' : geoScope;
    if (!scope || scope === 'global') return true;

    const memberCity = normalizePlaceLabel(user?.city);
    const memberCountry = normalizePlaceLabel(user?.country);
    const memberCountryCode = String(user?.countryCode || user?.country_code || '')
        .trim()
        .toLowerCase();
    const viewerCountryCode = String(userCountryCode || '').trim().toLowerCase();

    const coords = memberLatLng(user);
    const hasCoords = Boolean(coords);

    if (scope === 'city') {
        if (userCityNorm && cityMatches(memberCity, userCityNorm)) return true;
        if (userLocation && hasCoords) {
            const distance = haversineKm(userLocation.lat, userLocation.lng, coords.lat, coords.lng);
            if (distance < 50) return true;
        }
        return false;
    }

    if (scope === 'country') {
        if (countryMatches(memberCountry, userCountryNorm, memberCountryCode, viewerCountryCode)) {
            return true;
        }
        if (userLocation && hasCoords) {
            const distance = haversineKm(userLocation.lat, userLocation.lng, coords.lat, coords.lng);
            if (distance < 500) return true;
        }
        return false;
    }

    return true;
}

/** @param {object[]} users */
export function filterDirectoryUsers(users, {
    genderFilter = 'all',
    geoScope = 'global',
    selectedPlace = null,
    userCityNorm = '',
    userCountryNorm = '',
    userCountryCode = '',
    userLocation = null,
} = {}) {
    const filtered = (users || []).filter((user) => {
        if (!memberMatchesGenderFilter(user, genderFilter)) return false;
        if (selectedPlace) return memberMatchesSelectedPlace(user, selectedPlace);
        return memberMatchesGeoScope(user, geoScope, {
            userCityNorm,
            userCountryNorm,
            userCountryCode,
            userLocation,
        });
    });

    const sortOrigin =
        selectedPlace &&
        Number.isFinite(Number(selectedPlace.lat)) &&
        Number.isFinite(Number(selectedPlace.lng))
            ? { lat: Number(selectedPlace.lat), lng: Number(selectedPlace.lng) }
            : userLocation;

    return sortDirectoryUsersByDistance(filtered, sortOrigin);
}

export function directoryHasActiveFilters({
    genderFilter = 'all',
    geoScope = 'global',
    selectedPlace = null,
} = {}) {
    return (
        genderFilter !== 'all' ||
        Boolean(selectedPlace) ||
        (geoScope !== 'global' && geoScope !== 'All')
    );
}
