import { serverTimestamp } from 'firebase/firestore';
import { detectUserLocationContext } from './locationUtils';
import { stripUndefinedDeep } from './firestoreSanitize';

function coordsFromLatLng(lat, lng) {
    const la = Number(lat);
    const ln = Number(lng);
    if (!Number.isFinite(la) || !Number.isFinite(ln)) return null;
    return { lat: la, lng: ln };
}

/** Location fields from profile / business profile (no live GPS). */
export function geoFromUserProfile(userProfile) {
    if (!userProfile || typeof userProfile !== 'object') return null;

    const bi = userProfile.businessInfo || {};
    const city = String(bi.city || userProfile.city || '').trim();
    const country = String(bi.country || userProfile.country || '').trim();
    const countryCode = String(bi.countryCode || userProfile.countryCode || '').trim();
    const lat = bi.lat ?? bi.latitude ?? userProfile.coordinates?.lat;
    const lng = bi.lng ?? bi.longitude ?? userProfile.coordinates?.lng;
    const coordinates = coordsFromLatLng(lat, lng);
    const location =
        String(bi.address || userProfile.location || [city, country].filter(Boolean).join(', ')).trim() ||
        null;

    if (!city && !country && !coordinates) return null;

    return {
        location,
        city: city || null,
        country: country || null,
        countryCode: countryCode || null,
        coordinates,
        publishGeoSource: bi.city ? 'business_profile' : 'user_profile',
    };
}

/**
 * Resolve publish region in the background: GPS + reverse geocode → profile → IP.
 * @param {object|null|undefined} userProfile
 */
export async function resolvePostPublishGeo(userProfile) {
    let geo = null;

    try {
        const ctx = await detectUserLocationContext(userProfile);
        if (ctx?.success && ctx.city) {
            const location = [ctx.city, ctx.country].filter(Boolean).join(', ');
            geo = {
                location: location || null,
                city: ctx.city,
                country: ctx.country || null,
                countryCode: ctx.countryCode || null,
                coordinates: coordsFromLatLng(ctx.latitude, ctx.longitude),
                publishGeoSource: ctx.source || 'detected',
            };
        }
    } catch (err) {
        console.warn('[postPublishGeo] detectUserLocationContext failed', err);
    }

    const profileGeo = geoFromUserProfile(userProfile);
    if (!geo?.city && profileGeo?.city) {
        geo = { ...profileGeo };
    } else if (geo && !geo.city && profileGeo) {
        geo = {
            ...geo,
            city: profileGeo.city,
            country: geo.country || profileGeo.country,
            countryCode: geo.countryCode || profileGeo.countryCode,
            coordinates: geo.coordinates || profileGeo.coordinates,
            location: geo.location || profileGeo.location,
            publishGeoSource: geo.publishGeoSource || profileGeo.publishGeoSource,
        };
    }

    if (!geo) {
        return {
            location: null,
            city: null,
            country: null,
            countryCode: null,
            coordinates: null,
            publishGeoSource: 'none',
        };
    }

    return geo;
}

/** Fields to store on a post document at publish time. */
export function publishGeoFirestoreFields(geo) {
    if (!geo) return {};
    const hasGeo = Boolean(geo.city || geo.country || geo.coordinates);
    if (!hasGeo) return {};

    return stripUndefinedDeep({
        location: geo.location ?? null,
        city: geo.city ?? null,
        country: geo.country ?? null,
        countryCode: geo.countryCode ?? null,
        coordinates: geo.coordinates ?? null,
        publishGeoSource: geo.publishGeoSource ?? null,
        publishGeoAt: serverTimestamp(),
    });
}

/** Copy geo already stored on a source doc into a feed mirror payload. */
export function publishGeoFromStoredDoc(data) {
    if (!data || typeof data !== 'object') return {};
    if (!data.city && !data.coordinates) return {};

    return stripUndefinedDeep({
        location: data.location ?? null,
        city: data.city ?? null,
        country: data.country ?? null,
        countryCode: data.countryCode ?? null,
        coordinates: data.coordinates ?? null,
        publishGeoSource: data.publishGeoSource ?? null,
        publishGeoAt: data.publishGeoAt ?? null,
    });
}
