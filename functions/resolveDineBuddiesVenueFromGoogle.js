/**
 * Resolve a Google Places selection to a published DineBuddies venue when:
 * - placeId matches, OR
 * - normalized address is identical, OR
 * - coordinates match exactly (rounded).
 */

function normalizeVenueAddress(raw) {
    return String(raw || '')
        .normalize('NFKC')
        .toLowerCase()
        .replace(/[.,،؛:'"()`\-–—]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function coordsExactMatch(lat1, lng1, lat2, lng2, decimals = 5) {
    const aLat = Number(lat1);
    const aLng = Number(lng1);
    const bLat = Number(lat2);
    const bLng = Number(lng2);
    if (![aLat, aLng, bLat, bLng].every(Number.isFinite)) return false;
    const round = (n) => Number(n.toFixed(decimals));
    return round(aLat) === round(bLat) && round(aLng) === round(bLng);
}

function mapPublicProfileDoc(docSnap, matchReason) {
    const data = docSnap.data() || {};
    const info = data.businessPublic || {};
    if (data.profileType !== 'business' || info.isPublished !== true) return null;

    const displayName = String(data.displayName || info.businessName || '').trim();
    if (!displayName) return null;

    return {
        found: true,
        matchReason,
        venue: {
            restaurantId: docSnap.id,
            restaurantName: displayName,
            name: displayName,
            fullAddress: String(info.address || info.city || '').trim(),
            city: info.city || '',
            country: info.country || '',
            countryCode: info.countryCode || '',
            lat: info.lat ?? null,
            lng: info.lng ?? null,
            image: info.coverImage || data.avatarUrl || '',
            avatar: data.avatarUrl || '',
            businessType: info.businessType || 'Restaurant',
            placeId: String(data.googlePlaceId || docSnap.id || '').trim() || null,
            isDineBuddiesVenue: true,
        },
    };
}

async function tryResolveByPlaceId(db, placeId) {
    const id = String(placeId || '').trim();
    if (!id) return null;

    const profileDirect = await db.collection('public_profiles').doc(id).get();
    if (profileDirect.exists) {
        const mapped = mapPublicProfileDoc(profileDirect, 'placeId');
        if (mapped) return mapped;
    }

    const byGoogleId = await db
        .collection('public_profiles')
        .where('googlePlaceId', '==', id)
        .where('profileType', '==', 'business')
        .limit(3)
        .get();
    for (const doc of byGoogleId.docs) {
        const mapped = mapPublicProfileDoc(doc, 'placeId');
        if (mapped) return mapped;
    }

    const userSnap = await db
        .collection('users')
        .where('businessInfo.placeId', '==', id)
        .limit(5)
        .get();
    for (const userDoc of userSnap.docs) {
        const profile = await db.collection('public_profiles').doc(userDoc.id).get();
        if (profile.exists) {
            const mapped = mapPublicProfileDoc(profile, 'placeId');
            if (mapped) return mapped;
        }
    }

    const restSnap = await db.collection('restaurants').doc(id).get();
    if (restSnap.exists) {
        const profile = await db.collection('public_profiles').doc(id).get();
        if (profile.exists) {
            const mapped = mapPublicProfileDoc(profile, 'placeId');
            if (mapped) return mapped;
        }
    }

    return null;
}

async function tryResolveByAddressOrCoords(db, address, lat, lng) {
    const normGoogle = normalizeVenueAddress(address);
    const hasCoords = Number.isFinite(Number(lat)) && Number.isFinite(Number(lng));
    if (!normGoogle && !hasCoords) return null;

    const snap = await db
        .collection('public_profiles')
        .where('profileType', '==', 'business')
        .where('businessPublic.isPublished', '==', true)
        .limit(500)
        .get();

    for (const doc of snap.docs) {
        const data = doc.data() || {};
        const info = data.businessPublic || {};

        if (normGoogle) {
            const normVenue = normalizeVenueAddress(info.address || '');
            if (normVenue && normVenue === normGoogle) {
                const mapped = mapPublicProfileDoc(doc, 'address');
                if (mapped) return mapped;
            }
        }

        if (hasCoords && info.lat != null && info.lng != null) {
            if (coordsExactMatch(lat, lng, info.lat, info.lng)) {
                const mapped = mapPublicProfileDoc(doc, 'coordinates');
                if (mapped) return mapped;
            }
        }
    }

    return null;
}

/**
 * @param {FirebaseFirestore.Firestore} db
 * @param {{ placeId?: string, address?: string, lat?: number|null, lng?: number|null }} input
 */
async function resolveDineBuddiesVenueFromGoogle(db, input = {}) {
    const placeId = typeof input.placeId === 'string' ? input.placeId.trim() : '';
    const address = typeof input.address === 'string' ? input.address.trim() : '';
    const lat = input.lat ?? null;
    const lng = input.lng ?? null;

    const byPlaceId = await tryResolveByPlaceId(db, placeId);
    if (byPlaceId) return byPlaceId;

    const byAddressOrCoords = await tryResolveByAddressOrCoords(db, address, lat, lng);
    if (byAddressOrCoords) return byAddressOrCoords;

    return { found: false, matchReason: null, venue: null };
}

module.exports = {
    resolveDineBuddiesVenueFromGoogle,
    normalizeVenueAddress,
    coordsExactMatch,
};
