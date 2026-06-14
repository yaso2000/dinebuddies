import { normalizeUserProfile } from './userProfileNormalize';
import { openingHoursToBusinessHours } from './googlePlacesBusiness';

/**
 * @param {unknown} coords
 */
function readCoordinates(coords) {
    if (!coords || typeof coords !== 'object') return { lat: null, lng: null };
    const lat = Number(/** @type {{ lat?: number }} */ (coords).lat);
    const lng = Number(/** @type {{ lng?: number }} */ (coords).lng);
    return {
        lat: Number.isFinite(lat) ? lat : null,
        lng: Number.isFinite(lng) ? lng : null,
    };
}

/**
 * Map `restaurants/{id}` into the same shape BusinessProfile expects as `users/{id}`.
 * @param {string} docId
 * @param {Record<string, unknown>} raw
 */
export function normalizeRestaurantToBusinessProfile(docId, raw) {
    if (!raw || typeof raw !== 'object') return null;

    const bi =
        raw.businessInfo && typeof raw.businessInfo === 'object'
            ? { ...raw.businessInfo }
            : {};

    const businessName =
        String(bi.businessName || '').trim() ||
        String(raw.display_name || '').trim() ||
        String(raw.name || '').trim() ||
        docId;

    const topCoords = readCoordinates(raw.coordinates);
    const lat =
        typeof bi.lat === 'number' ? bi.lat : topCoords.lat;
    const lng =
        typeof bi.lng === 'number' ? bi.lng : topCoords.lng;

    const hours =
        bi.hours ||
        bi.openingHours ||
        openingHoursToBusinessHours(
            raw.openingHours && typeof raw.openingHours === 'object'
                ? raw.openingHours
                : null
        ) ||
        null;

    const categories = Array.isArray(raw.categories)
        ? raw.categories
        : Array.isArray(bi.categories)
          ? bi.categories
          : [];

    const payload = {
        uid: docId,
        ...raw,
        display_name: raw.display_name || businessName,
        accountType: raw.accountType || 'business',
        role: raw.role || 'partner',
        isClaimed: raw.isClaimed === true,
        claimed: raw.claimed === true || raw.isClaimed === true,
        isVirtual: raw.isVirtual === true,
        ownerId: raw.ownerId || null,
        createdBy: raw.createdBy || 'admin',
        _sourceCollection: 'restaurants',
        _profileDocId: docId,
        phone: raw.phone || bi.phone || '',
        website: raw.website || bi.website || '',
        address: raw.address || bi.address || '',
        photo_url: raw.photo_url || bi.coverImage || null,
        coverImageStoragePath: raw.coverImageStoragePath || bi.coverImageStoragePath || null,
        coordinates: topCoords.lat != null && topCoords.lng != null ? topCoords : { lat, lng },
        openNow: typeof raw.openNow === 'boolean' ? raw.openNow : null,
        businessInfo: {
            ...bi,
            businessName,
            phone: bi.phone || raw.phone || '',
            website: bi.website || raw.website || '',
            address: bi.address || raw.address || '',
            city: bi.city || raw.city || '',
            country: bi.country || raw.country || '',
            coverImage: bi.coverImage || raw.photo_url || null,
            coverImageStoragePath:
                bi.coverImageStoragePath || raw.coverImageStoragePath || null,
            lat,
            lng,
            hours,
            openingHours:
                bi.openingHours ||
                (raw.openingHours && typeof raw.openingHours === 'object' ? raw.openingHours : null),
            categories,
            isClaimed: raw.isClaimed === true,
        },
    };

    return normalizeUserProfile(payload);
}

/**
 * Admin-imported virtual restaurant (Google Places Advanced SKU ingest).
 * @param {Record<string, unknown> | null | undefined} business
 */
export function isVirtualGoogleImportProfile(business) {
    if (!business || typeof business !== 'object') return false;
    if (business._sourceCollection !== 'restaurants') return false;
    if (business.isVirtual === true) return true;
    return business.createdBy === 'admin' && business.isClaimed !== true;
}

/**
 * @param {string | null | undefined} sessionUid
 * @param {string | null | undefined} profileId
 * @param {Record<string, unknown> | null | undefined} business
 */
export function isBusinessProfileOwner(sessionUid, profileId, business) {
    if (!sessionUid || !profileId) return false;
    if (sessionUid === profileId) return true;
    if (business?.ownerId && business.ownerId === sessionUid) return true;
    return false;
}

/**
 * @param {Record<string, unknown> | null | undefined} business
 */
export function businessShowsClaimCta(business) {
    if (!business || typeof business !== 'object') return false;
    if (business._sourceCollection !== 'restaurants') return false;
    return business.isClaimed !== true;
}
