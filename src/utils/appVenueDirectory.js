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

/**
 * Load published DineBuddies venues from `public_profiles`.
 * @param {{ queryText?: string, city?: string, countryCode?: string, scope?: 'local'|'country'|'all', userLat?: number, userLng?: number, maxResults?: number }} opts
 */
export async function searchPublishedAppVenues({
    queryText = '',
    city = '',
    countryCode = '',
    scope = 'local',
    userLat = null,
    userLng = null,
    maxResults = 12,
} = {}) {
    const qLower = String(queryText || '').trim().toLowerCase();
    const cityToken = normalizeCityToken(city);

    const snap = await getDocs(
        query(
            collection(db, 'public_profiles'),
            where('profileType', '==', 'business'),
            where('businessPublic.isPublished', '==', true),
            limit(80)
        )
    );

    const rows = [];
    snap.forEach((docSnap) => {
        const data = docSnap.data();
        const info = data.businessPublic || {};
        const name = data.displayName || info.businessName || 'Venue';
        const address = info.address || info.city || '';
        const venueCity = info.city || '';
        const row = {
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
        };

        if (qLower) {
            const hay = `${name} ${address} ${venueCity}`.toLowerCase();
            if (!hay.includes(qLower)) return;
        }

        if (scope === 'local' && cityToken && !venueMatchesCity(row, cityToken)) return;
        if (scope === 'country' && !venueMatchesCountry(row, countryCode)) return;

        rows.push(row);
    });

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
