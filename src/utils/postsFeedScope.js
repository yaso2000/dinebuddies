import { asUidArray } from './userSocialLists';
import { authorIdFromPost } from './feedSocialGraph';

const LOCAL_RADIUS_KM = 50;

export function haversineKm(lat1, lon1, lat2, lon2) {
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

export function normalizePlaceLabel(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ');
}

export function buildFollowingAuthorSet(currentUser, userProfile) {
    const ids = [...asUidArray(currentUser?.following), ...asUidArray(userProfile?.following)];
    return new Set(ids.filter(Boolean));
}

function coordsFromPost(post) {
    const raw =
        post?.coordinates ||
        post?.coords ||
        (post?.lat != null && post?.lng != null ? { lat: post.lat, lng: post.lng } : null);
    if (!raw) return null;
    const lat = Number(raw.lat ?? raw.latitude);
    const lng = Number(raw.lng ?? raw.longitude ?? raw.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
}

function cityMatches(postCityNorm, userCityNorm) {
    if (!postCityNorm || !userCityNorm) return false;
    return postCityNorm === userCityNorm || postCityNorm.includes(userCityNorm);
}

/**
 * @param {'all' | 'following'} audienceScope
 */
export function postMatchesAudienceScope(post, audienceScope, followingSet, viewerUid) {
    if (audienceScope !== 'following') return true;
    const authorId = authorIdFromPost(post);
    if (!authorId) return true;
    if (viewerUid && authorId === viewerUid) return true;
    return followingSet.has(authorId);
}

/**
 * @param {'global' | 'local'} geoScope
 */
export function postMatchesGeoScope(post, geoScope, { userLocation, userCityNorm, userCountryNorm, viewerUid }) {
    if (geoScope !== 'local') return true;

    const authorId = authorIdFromPost(post);
    if (viewerUid && authorId === viewerUid) return true;

    const coords = coordsFromPost(post);
    if (userLocation && coords) {
        const distance = haversineKm(userLocation.lat, userLocation.lng, coords.lat, coords.lng);
        if (distance < LOCAL_RADIUS_KM) return true;
    }

    const postCity = normalizePlaceLabel(post?.city || post?.author?.city);
    if (userCityNorm) {
        if (cityMatches(postCity, userCityNorm)) return true;
        const locationText = normalizePlaceLabel(post?.location);
        if (locationText && (locationText === userCityNorm || locationText.includes(userCityNorm))) {
            return true;
        }
        return false;
    }

    const postCountry = normalizePlaceLabel(post?.country || post?.author?.country);
    if (userCountryNorm && postCountry && postCountry === userCountryNorm) return true;

    return false;
}

/**
 * @param {object[]} posts
 * @param {{ geoScope: 'global'|'local', audienceScope: 'all'|'following', userLocation?: {lat:number,lng:number}|null, userCityNorm?: string, userCountryNorm?: string, followingSet: Set<string>, viewerUid?: string }} opts
 */
export function filterPostsByFeedScope(posts, opts) {
    const {
        geoScope,
        audienceScope,
        userLocation = null,
        userCityNorm = '',
        userCountryNorm = '',
        followingSet,
        viewerUid,
    } = opts;

    return (posts || []).filter(
        (post) =>
            postMatchesAudienceScope(post, audienceScope, followingSet, viewerUid) &&
            postMatchesGeoScope(post, geoScope, { userLocation, userCityNorm, userCountryNorm, viewerUid })
    );
}
