import { asUidArray } from './userSocialLists';
import { authorIdFromPost, getPostTimestamp } from './feedSocialGraph';

const LOCAL_RADIUS_KM = 50;
const COUNTRY_RADIUS_KM = 500;

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

function countryMatches(postCountryNorm, userCountryNorm, postCountryCode, userCountryCode) {
    if (userCountryCode && postCountryCode && userCountryCode === postCountryCode) return true;
    if (userCountryNorm && postCountryNorm && postCountryNorm === userCountryNorm) return true;
    return false;
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
 * @param {'global' | 'country' | 'city' | 'local'} geoScope — `local` kept for legacy callers (= city)
 */
export function postMatchesGeoScope(post, geoScope, {
    userLocation,
    userCityNorm,
    userCountryNorm,
    userCountryCode = '',
    viewerUid
}) {
    const scope = geoScope === 'local' ? 'city' : geoScope;
    if (scope === 'global') return true;

    const authorId = authorIdFromPost(post);
    if (viewerUid && authorId === viewerUid) return true;

    const postCity = normalizePlaceLabel(post?.city || post?.author?.city);
    const postCountry = normalizePlaceLabel(post?.country || post?.author?.country);
    const locationText = normalizePlaceLabel(post?.location);
    const postCountryCode = String(post?.countryCode || post?.author?.countryCode || '')
        .trim()
        .toLowerCase();
    const viewerCountryCode = String(userCountryCode || '').trim().toLowerCase();
    const coords = coordsFromPost(post);

    if (scope === 'city') {
        if (userCityNorm) {
            if (cityMatches(postCity, userCityNorm)) return true;
            if (locationText && (locationText === userCityNorm || locationText.includes(userCityNorm))) {
                return true;
            }
        }
        if (userLocation && coords) {
            const distance = haversineKm(userLocation.lat, userLocation.lng, coords.lat, coords.lng);
            if (distance < LOCAL_RADIUS_KM) return true;
        }
        return false;
    }

    if (scope === 'country') {
        if (countryMatches(postCountry, userCountryNorm, postCountryCode, viewerCountryCode)) return true;
        if (userCountryNorm && locationText && locationText.includes(userCountryNorm)) return true;
        if (userLocation && coords) {
            const distance = haversineKm(userLocation.lat, userLocation.lng, coords.lat, coords.lng);
            if (distance < COUNTRY_RADIUS_KM) return true;
        }
        return false;
    }

    return true;
}

/**
 * @param {object[]} posts
 * @param {{ geoScope: 'global'|'country'|'city'|'local', audienceScope: 'all'|'following', userLocation?: {lat:number,lng:number}|null, userCityNorm?: string, userCountryNorm?: string, userCountryCode?: string, followingSet: Set<string>, viewerUid?: string }} opts
 */
export function filterPostsByFeedScope(posts, opts) {
    const {
        geoScope,
        audienceScope,
        userLocation = null,
        userCityNorm = '',
        userCountryNorm = '',
        userCountryCode = '',
        followingSet,
        viewerUid,
    } = opts;

    return (posts || []).filter(
        (post) =>
            postMatchesAudienceScope(post, audienceScope, followingSet, viewerUid) &&
            postMatchesGeoScope(post, geoScope, {
                userLocation,
                userCityNorm,
                userCountryNorm,
                userCountryCode,
                viewerUid
            })
    );
}

/** Lower is closer: 0 = same city / within local radius, 1 = same country / within country radius, 2 = everywhere else. */
function geoTierAndDistance(post, { userLocation, userCityNorm, userCountryNorm, userCountryCode }) {
    const postCity = normalizePlaceLabel(post?.city || post?.author?.city);
    const postCountry = normalizePlaceLabel(post?.country || post?.author?.country);
    const postCountryCode = String(post?.countryCode || post?.author?.countryCode || '')
        .trim()
        .toLowerCase();
    const coords = coordsFromPost(post);
    const km = userLocation && coords ?
        haversineKm(userLocation.lat, userLocation.lng, coords.lat, coords.lng) :
        null;

    if (userCityNorm && cityMatches(postCity, userCityNorm)) return { tier: 0, km: km ?? 0 };
    if (km != null && km < LOCAL_RADIUS_KM) return { tier: 0, km };
    if (countryMatches(postCountry, userCountryNorm, postCountryCode, userCountryCode)) {
        return { tier: 1, km: km ?? LOCAL_RADIUS_KM };
    }
    if (km != null && km < COUNTRY_RADIUS_KM) return { tier: 1, km };
    return { tier: 2, km: km ?? Infinity };
}

/**
 * Default feed order: people the viewer follows first, then everyone else ranked
 * by geographic closeness (same city, then same country, then the rest), newest
 * first as the final tiebreaker within each group.
 * @param {object[]} posts
 * @param {{ followingSet: Set<string>, viewerUid?: string, userLocation?: {lat:number,lng:number}|null, userCityNorm?: string, userCountryNorm?: string, userCountryCode?: string }} opts
 */
export function rankPostsByFriendsThenGeo(posts, opts) {
    const { followingSet, viewerUid } = opts;

    return (posts || [])
        .map((post) => {
            const authorId = authorIdFromPost(post);
            const isSelf = Boolean(viewerUid && authorId && authorId === viewerUid);
            const isFriend = isSelf || Boolean(authorId && followingSet?.has(authorId));
            const { tier, km } = geoTierAndDistance(post, opts);
            return { post, isFriend, tier, km, ts: getPostTimestamp(post) };
        })
        .sort((a, b) => {
            if (a.isFriend !== b.isFriend) return a.isFriend ? -1 : 1;
            if (a.tier !== b.tier) return a.tier - b.tier;
            if (a.km !== b.km) return a.km - b.km;
            return b.ts - a.ts;
        })
        .map((row) => row.post);
}
