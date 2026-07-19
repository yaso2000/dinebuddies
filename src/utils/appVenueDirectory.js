import { collection, getDocs, limit, query, where } from 'firebase/firestore';
import { db } from '../firebase/config';
import { getSafeAvatar } from './avatarUtils';
import { sortDineBuddiesVenues } from './invitationVenueSearch';

function normalizeCityToken(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .split(',')[0]
        .replace(/\b(region|city)\b/gi, '')
        .trim();
}

function venueMatchesCity(venue, cityToken) {
    if (!cityToken) return true;
    const hay = `${venue.city || ''} ${venue.address || ''}`.toLowerCase();
    return hay.includes(cityToken);
}

function venueMatchesCountry(venue, countryCode) {
    if (!countryCode) return true;
    const cc = String(countryCode).trim().toUpperCase();
    const venueCc = String(venue.countryCode || '').trim().toUpperCase();
    return !venueCc || venueCc === cc;
}

function mapPublicProfileToVenue(docSnap) {
    const data = docSnap.data() || {};
    const info = data.businessPublic || {};
    const name = data.displayName || info.businessName || 'Venue';
    const address = info.address || info.city || '';
    const venueCity = info.city || '';
    return {
        id: docSnap.id,
        businessId: docSnap.id,
        name,
        address,
        city: venueCity,
        countryCode: info.countryCode || info.country || '',
        lat: info.lat ?? null,
        lng: info.lng ?? null,
        image: info.coverImage || data.avatarUrl || getSafeAvatar(data),
        source: 'business',
        businessType: info.businessType || 'Restaurant',
        isPublished: info.isPublished === true,
    };
}

function rowMatchesQuery(row, qLower) {
    if (!qLower) return true;
    const hay = `${row.name || ''} ${row.address || ''} ${row.city || ''}`.toLowerCase();
    return hay.includes(qLower);
}

/**
 * Map already-loaded directory / favorite rows into the venue shape used by the picker.
 * @param {Array<Record<string, unknown>>|null|undefined} list
 * @param {string} queryText
 */
export function filterLoadedAppVenues(list, queryText = '') {
    const qLower = String(queryText || '').trim().toLowerCase();
    if (!Array.isArray(list) || list.length === 0) return [];

    const rows = [];
    for (const item of list) {
        if (!item || typeof item !== 'object') continue;
        const id = item.id || item.businessId || item.uid;
        if (!id) continue;
        const name = String(item.name || item.displayName || item.restaurantName || '').trim();
        if (!name) continue;
        const address = String(item.address || item.location || item.city || '').trim();
        const row = {
            id: String(id),
            businessId: String(item.businessId || id),
            name,
            address,
            city: String(item.city || '').trim(),
            countryCode: item.countryCode || item.country || '',
            lat: item.lat ?? item.coordinates?.lat ?? null,
            lng: item.lng ?? item.coordinates?.lng ?? null,
            image: item.image || item.coverImage || item.avatar || '',
            source: item.source || 'business',
            businessType: item.type || item.businessType || 'Restaurant',
        };
        if (!rowMatchesQuery(row, qLower)) continue;
        rows.push(row);
    }
    return rows;
}

async function queryPublishedByNamePrefix(prefix, maxResults) {
    const nt = String(prefix || '').trim().toLowerCase();
    if (nt.length < 2) return [];

    // Prefer published + name prefix (same pattern as SmartPlaceSearch / directorySearch).
    try {
        const snap = await getDocs(
            query(
                collection(db, 'public_profiles'),
                where('profileType', '==', 'business'),
                where('businessPublic.isPublished', '==', true),
                where('search.displayNameLower', '>=', nt),
                where('search.displayNameLower', '<=', `${nt}\uf8ff`),
                limit(Math.max(maxResults, 30))
            )
        );
        return snap.docs.map(mapPublicProfileToVenue);
    } catch (err) {
        console.warn('[appVenueDirectory] published prefix query failed, trying name-only', err?.code || err);
    }

    // Fallback when composite index (published + name) is missing.
    try {
        const snap = await getDocs(
            query(
                collection(db, 'public_profiles'),
                where('profileType', '==', 'business'),
                where('search.displayNameLower', '>=', nt),
                where('search.displayNameLower', '<=', `${nt}\uf8ff`),
                limit(Math.max(maxResults, 30))
            )
        );
        return snap.docs.map(mapPublicProfileToVenue).filter((r) => r.isPublished);
    } catch (err) {
        console.warn('[appVenueDirectory] name prefix query failed', err?.code || err);
        return null;
    }
}

async function queryPublishedSample(maxDocs = 80) {
    const snap = await getDocs(
        query(
            collection(db, 'public_profiles'),
            where('profileType', '==', 'business'),
            where('businessPublic.isPublished', '==', true),
            limit(maxDocs)
        )
    );
    return snap.docs.map(mapPublicProfileToVenue);
}

/**
 * Load published DineBuddies venues from `public_profiles`.
 * Name match first; city is used for ranking (not a hard exclude for invitation search).
 * @param {{ queryText?: string, city?: string, countryCode?: string, scope?: 'local'|'country'|'all', userLat?: number, userLng?: number, maxResults?: number, softCityFilter?: boolean }} opts
 */
export async function searchPublishedAppVenues({
    queryText = '',
    city = '',
    countryCode = '',
    scope = 'local',
    userLat = null,
    userLng = null,
    maxResults = 12,
    /** When true (invitation picker), keep out-of-city name matches and rank them lower. */
    softCityFilter = false,
} = {}) {
    const qLower = String(queryText || '').trim().toLowerCase();
    const cityToken = normalizeCityToken(city);

    let mapped = null;
    if (qLower.length >= 2) {
        mapped = await queryPublishedByNamePrefix(qLower, maxResults);
    }
    if (mapped == null) {
        mapped = await queryPublishedSample(80);
    }

    const rows = [];
    for (const row of mapped) {
        if (qLower && !rowMatchesQuery(row, qLower)) continue;

        if (scope === 'country' && !venueMatchesCountry(row, countryCode)) continue;

        if (scope === 'local' && cityToken && !venueMatchesCity(row, cityToken)) {
            if (!softCityFilter) continue;
            // Soft: keep name matches; sortDineBuddiesVenues will prefer same-city.
        }

        rows.push(row);
    }

    const ranked = sortDineBuddiesVenues(rows, city, null, userLat, userLng);
    return ranked.slice(0, maxResults);
}

export function mapAppVenueToFavoritePlace(venue) {
    return {
        id: venue.businessId || venue.id,
        businessId: venue.businessId || venue.id,
        name: venue.name,
        address: venue.address || '',
        city: venue.city || '',
        image: venue.image || '',
        source: 'business',
        location:
            venue.lat != null && venue.lng != null
                ? { lat: Number(venue.lat), lng: Number(venue.lng) }
                : null,
        visitCount: 0,
        addedAt: new Date().toISOString(),
    };
}
