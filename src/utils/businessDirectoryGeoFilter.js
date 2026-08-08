import { getScopeKey } from '../services/businessRankingService';
import { PUBLIC_INVITE_GEOFENCE_RADIUS_KM } from './invitationRules';

export const NEARBY_RADIUS_KM = 10;

export function parseBusinessLatLng(business) {
    // Avoid Number(null) === 0 (Null Island). Prefer nested coordinate shapes.
    if (business?.lat == null || business?.lng == null || business?.lat === '' || business?.lng === '') {
        const nested = business?.coordinates || business?.location;
        if (nested && typeof nested === 'object') {
            const lat = Number(nested.lat ?? nested.latitude);
            const lng = Number(nested.lng ?? nested.longitude);
            if (Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0)) {
                return { lat, lng };
            }
        }
        return null;
    }
    const lat = Number(business.lat);
    const lng = Number(business.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    if (lat === 0 && lng === 0) return null;
    return { lat, lng };
}

/** Merge GPS, reverse-geocode, and profile fields into one viewer scope. */
export function buildViewerGeoContext({ userLocation, userProfile, detectedContext } = {}) {
    const latRaw = userLocation?.lat ?? detectedContext?.latitude ?? userProfile?.coordinates?.lat;
    const lngRaw = userLocation?.lng ?? detectedContext?.longitude ?? userProfile?.coordinates?.lng;
    const lat = Number(latRaw);
    const lng = Number(lngRaw);

    const city = (
        detectedContext?.city
        || userProfile?.city
        || userProfile?.businessInfo?.city
        || ''
    ).toString().trim();

    const countryCode = (
        detectedContext?.countryCode
        || userProfile?.countryCode
        || ''
    ).toString().trim();

    const country = (
        detectedContext?.country
        || userProfile?.country
        || userProfile?.businessInfo?.country
        || countryCode
        || ''
    ).toString().trim();

    return {
        lat: Number.isFinite(lat) ? lat : null,
        lng: Number.isFinite(lng) ? lng : null,
        city,
        countryCode,
        country,
        scopeKey: getScopeKey({ city, country: countryCode || country }),
    };
}

export function canApplyBusinessLocationFilter(filterId, viewerContext, isStaff) {
    if (!filterId || filterId === 'All' || isStaff || !viewerContext) return false;

    if (filterId === 'country') {
        return Boolean(viewerContext.scopeKey.country);
    }
    if (filterId === 'city') {
        return Boolean(
            viewerContext.scopeKey.city
            || (viewerContext.lat != null && viewerContext.lng != null),
        );
    }
    if (filterId === 'nearby') {
        return viewerContext.lat != null && viewerContext.lng != null;
    }
    return false;
}

export function matchesBusinessLocationFilter(filterId, business, viewerContext, haversineKm) {
    if (!filterId || filterId === 'All') return true;
    if (!viewerContext) return false;

    const bizLatLng = parseBusinessLatLng(business);
    const bizScope = getScopeKey(business);

    switch (filterId) {
        case 'nearby': {
            if (viewerContext.lat == null || viewerContext.lng == null || !bizLatLng) return false;
            return haversineKm(
                viewerContext.lat,
                viewerContext.lng,
                bizLatLng.lat,
                bizLatLng.lng,
            ) < NEARBY_RADIUS_KM;
        }
        case 'city': {
            if (viewerContext.lat != null && viewerContext.lng != null && bizLatLng) {
                const distanceKm = haversineKm(
                    viewerContext.lat,
                    viewerContext.lng,
                    bizLatLng.lat,
                    bizLatLng.lng,
                );
                if (distanceKm <= PUBLIC_INVITE_GEOFENCE_RADIUS_KM) return true;
            }
            const viewerCity = viewerContext.scopeKey.city;
            if (viewerCity && bizScope.city) return bizScope.city === viewerCity;
            return false;
        }
        case 'country': {
            const viewerCountry = viewerContext.scopeKey.country;
            if (!viewerCountry || !bizScope.country) return false;
            return bizScope.country === viewerCountry;
        }
        default:
            return true;
    }
}
