import {
    haversineKm,
    normalizePlaceLabel,
} from './postsFeedScope';

/** @typedef {'all' | 'male' | 'female'} DirectoryGenderFilter */
/** @typedef {'global' | 'country' | 'city'} DirectoryGeoScope */

function cityMatches(memberCityNorm, userCityNorm) {
    if (!memberCityNorm || !userCityNorm) return false;
    return memberCityNorm === userCityNorm || memberCityNorm.includes(userCityNorm);
}

function countryMatches(memberCountryNorm, userCountryNorm, memberCountryCode, userCountryCode) {
    if (userCountryCode && memberCountryCode && userCountryCode === memberCountryCode) return true;
    if (userCountryNorm && memberCountryNorm && memberCountryNorm === userCountryNorm) return true;
    return false;
}

/** @param {DirectoryGenderFilter} genderFilter */
export function memberMatchesGenderFilter(user, genderFilter) {
    if (!genderFilter || genderFilter === 'all') return true;
    return String(user?.gender || '').trim().toLowerCase() === genderFilter;
}

/**
 * Geo scope for member directory — same scopes as posts feed (global / country / city).
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

    const lat = Number(user?.lat ?? user?.latitude);
    const lng = Number(user?.lng ?? user?.longitude ?? user?.lon);
    const hasCoords = Number.isFinite(lat) && Number.isFinite(lng);

    if (scope === 'city') {
        if (userCityNorm && cityMatches(memberCity, userCityNorm)) return true;
        if (userLocation && hasCoords) {
            const distance = haversineKm(userLocation.lat, userLocation.lng, lat, lng);
            if (distance < 50) return true;
        }
        return false;
    }

    if (scope === 'country') {
        if (countryMatches(memberCountry, userCountryNorm, memberCountryCode, viewerCountryCode)) {
            return true;
        }
        if (userLocation && hasCoords) {
            const distance = haversineKm(userLocation.lat, userLocation.lng, lat, lng);
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
    userCityNorm = '',
    userCountryNorm = '',
    userCountryCode = '',
    userLocation = null,
} = {}) {
    return (users || []).filter(
        (user) =>
            memberMatchesGenderFilter(user, genderFilter) &&
            memberMatchesGeoScope(user, geoScope, {
                userCityNorm,
                userCountryNorm,
                userCountryCode,
                userLocation,
            })
    );
}

export function directoryHasActiveFilters({ genderFilter = 'all', geoScope = 'global' } = {}) {
    return genderFilter !== 'all' || (geoScope !== 'global' && geoScope !== 'All');
}
