import { getScopeKey } from '../services/businessRankingService';
import { PUBLIC_INVITE_GEOFENCE_RADIUS_KM } from './invitationRules';

export const NEARBY_RADIUS_KM = 10;

export function parseBusinessLatLng(business) {
    if (!business || typeof business !== 'object') return null;
    // Coordinates live under several shapes across the data set. Check them all
    // (top-level, nested coordinate objects, and the businessInfo sub-doc) so the
    // list view sorts nearest-first exactly like the swipe deck — which also reads
    // businessInfo.lat/lng. Missing that branch left many businesses with a null
    // distance, so the list fell back to raw Firestore order ("erratic").
    const info = business.businessInfo;
    const candidates = [
        business,
        business.coordinates,
        business.location,
        info,
        info?.coordinates,
        info?.location,
    ];
    for (const c of candidates) {
        if (!c || typeof c !== 'object') continue;
        const lat = Number(c.lat ?? c.latitude);
        const lng = Number(c.lng ?? c.longitude);
        // Avoid Number(null) === 0 (Null Island) and unset fields.
        if (Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0)) {
            return { lat, lng };
        }
    }
    return null;
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
