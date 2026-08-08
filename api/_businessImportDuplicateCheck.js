/**
 * Detect likely duplicate businesses when admin imports from Google Places.
 * Matches: placeId (exact), phone (E.164), coordinates (5-decimal), normalized address.
 */
import { getFirestore } from 'firebase-admin/firestore';
import { ensureFirebaseAdmin } from './_firebaseAdmin.js';
import { compactE164FromGoogleInternational } from './_phoneUtils.js';
import { loadExistingRestaurantForImport } from './_virtualBusinessIngest.js';

const MATCH_REASON_PRIORITY = { phone: 1, coordinates: 2, address: 3 };

export function normalizeVenueAddress(raw) {
    return String(raw || '')
        .normalize('NFKC')
        .toLowerCase()
        .replace(/[.,،؛:'"()`\-–—]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

export function coordsExactMatch(lat1, lng1, lat2, lng2, decimals = 5) {
    const aLat = Number(lat1);
    const aLng = Number(lng1);
    const bLat = Number(lat2);
    const bLng = Number(lng2);
    if (![aLat, aLng, bLat, bLng].every(Number.isFinite)) return false;
    const round = (n) => Number(n.toFixed(decimals));
    return round(aLat) === round(bLat) && round(aLng) === round(bLng);
}

function normalizeCoordinates(coords) {
    if (!coords || typeof coords !== 'object') return { lat: null, lng: null };
    const lat = Number(coords.lat);
    const lng = Number(coords.lng);
    return {
        lat: Number.isFinite(lat) ? lat : null,
        lng: Number.isFinite(lng) ? lng : null,
    };
}

function businessDisplayName(data, docId) {
    const d = data || {};
    const bi = d.businessInfo && typeof d.businessInfo === 'object' ? d.businessInfo : {};
    return String(d.name || d.display_name || bi.businessName || docId).trim() || docId;
}

/**
 * @param {FirebaseFirestore.Firestore} db
 * @param {string} docId
 * @param {string} name
 * @param {'phone'|'coordinates'|'address'} matchReason
 * @param {Record<string, unknown>} [extra]
 * @param {Map<string, object>} registry
 * @param {string} incomingPlaceId
 * @param {string|null} exactDocId
 */
function registerDuplicate(registry, docId, name, matchReason, extra, incomingPlaceId, exactDocId) {
    const id = String(docId || '').trim();
    if (!id || id === incomingPlaceId) return;
    if (exactDocId && id === exactDocId) return;

    const prev = registry.get(id);
    if (
        !prev ||
        MATCH_REASON_PRIORITY[matchReason] < MATCH_REASON_PRIORITY[prev.matchReason]
    ) {
        registry.set(id, {
            docId: id,
            name,
            matchReason,
            googlePlaceId: extra?.googlePlaceId ? String(extra.googlePlaceId) : null,
        });
    }
}

/**
 * @param {Record<string, unknown>} details Must include googlePlaceId, phone, address, coordinates
 */
export async function assessBusinessImportDuplicates(details) {
    ensureFirebaseAdmin();
    const db = getFirestore();

    const placeId = String(details.googlePlaceId || '').trim();
    const incomingPhone = compactE164FromGoogleInternational(String(details.phone || ''));
    const { lat, lng } = normalizeCoordinates(details.coordinates);
    const normAddress = normalizeVenueAddress(details.address);
    const exactMatch = placeId ? await loadExistingRestaurantForImport(placeId) : null;
    const exactDocId = exactMatch?.docId || null;

    /** @type {Map<string, { docId: string, name: string, matchReason: string, googlePlaceId: string|null }>} */
    const registry = new Map();

    if (incomingPhone) {
        const phoneQueries = [
            db.collection('restaurants').where('standardized_phone', '==', incomingPhone).limit(8),
            db
                .collection('restaurants')
                .where('businessInfo.standardized_phone', '==', incomingPhone)
                .limit(8),
        ];
        for (const q of phoneQueries) {
            const snap = await q.get();
            for (const doc of snap.docs) {
                registerDuplicate(
                    registry,
                    doc.id,
                    businessDisplayName(doc.data(), doc.id),
                    'phone',
                    { googlePlaceId: doc.data()?.googlePlaceId },
                    placeId,
                    exactDocId,
                );
            }
        }
    }

    const scanPublicProfiles = async () => {
        try {
            return await db
                .collection('public_profiles')
                .where('profileType', '==', 'business')
                .where('businessPublic.isPublished', '==', true)
                .limit(500)
                .get();
        } catch {
            return db.collection('public_profiles').where('profileType', '==', 'business').limit(500).get();
        }
    };

    const [profileSnap, restaurantSnap] = await Promise.all([
        scanPublicProfiles(),
        db.collection('restaurants').limit(500).get(),
    ]);

    for (const doc of profileSnap.docs) {
        const data = doc.data() || {};
        const info = data.businessPublic && typeof data.businessPublic === 'object' ? data.businessPublic : {};
        const name = String(data.displayName || info.businessName || doc.id).trim() || doc.id;

        if (normAddress) {
            const venueNorm = normalizeVenueAddress(info.address || '');
            if (venueNorm && venueNorm === normAddress) {
                registerDuplicate(
                    registry,
                    doc.id,
                    name,
                    'address',
                    { googlePlaceId: data.googlePlaceId },
                    placeId,
                    exactDocId,
                );
            }
        }

        if (lat != null && lng != null && info.lat != null && info.lng != null) {
            if (coordsExactMatch(lat, lng, info.lat, info.lng)) {
                registerDuplicate(
                    registry,
                    doc.id,
                    name,
                    'coordinates',
                    { googlePlaceId: data.googlePlaceId },
                    placeId,
                    exactDocId,
                );
            }
        }
    }

    for (const doc of restaurantSnap.docs) {
        const data = doc.data() || {};
        const bi = data.businessInfo && typeof data.businessInfo === 'object' ? data.businessInfo : {};
        const name = businessDisplayName(data, doc.id);
        const rLat = data.coordinates?.lat ?? bi.lat;
        const rLng = data.coordinates?.lng ?? bi.lng;

        if (normAddress) {
            const addrNorm = normalizeVenueAddress(data.address || bi.address || '');
            if (addrNorm && addrNorm === normAddress) {
                registerDuplicate(
                    registry,
                    doc.id,
                    name,
                    'address',
                    { googlePlaceId: data.googlePlaceId },
                    placeId,
                    exactDocId,
                );
            }
        }

        if (lat != null && lng != null && rLat != null && rLng != null) {
            if (coordsExactMatch(lat, lng, rLat, rLng)) {
                registerDuplicate(
                    registry,
                    doc.id,
                    name,
                    'coordinates',
                    { googlePlaceId: data.googlePlaceId },
                    placeId,
                    exactDocId,
                );
            }
        }
    }

    const duplicates = [...registry.values()].sort(
        (a, b) => MATCH_REASON_PRIORITY[a.matchReason] - MATCH_REASON_PRIORITY[b.matchReason],
    );

    return {
        exactMatch,
        duplicates,
        primaryDuplicate: duplicates[0] || null,
    };
}
