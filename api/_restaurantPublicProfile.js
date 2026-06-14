import { FieldValue } from 'firebase-admin/firestore';

/**
 * Build `public_profiles/{id}` projection for admin-imported `restaurants/{id}`.
 * Matches Cloud Functions `toPublicProfile` shape so /restaurants directory lists the business.
 * @param {string} restaurantId
 * @param {FirebaseFirestore.DocumentData} data
 */
export function buildPublicProfileFromRestaurant(restaurantId, data) {
    const safeId = String(restaurantId || '').trim();
    const bi = data?.businessInfo && typeof data.businessInfo === 'object' ? data.businessInfo : {};
    const displayName =
        String(data?.display_name || '').trim() ||
        String(data?.name || '').trim() ||
        String(bi.businessName || '').trim() ||
        safeId;

    const coverImage =
        String(bi.coverImage || '').trim() ||
        String(data?.photo_url || '').trim() ||
        '';

    const authEmailVerified = data?.emailVerified === true;
    const optedIntoDirectory = bi.isPublished !== false;
    const isPublished = authEmailVerified && optedIntoDirectory;

    const coords = data?.coordinates && typeof data.coordinates === 'object' ? data.coordinates : {};
    const lat =
        typeof bi.lat === 'number'
            ? bi.lat
            : typeof coords.lat === 'number'
              ? coords.lat
              : null;
    const lng =
        typeof bi.lng === 'number'
            ? bi.lng
            : typeof coords.lng === 'number'
              ? coords.lng
              : null;

    const categories = Array.isArray(data?.categories)
        ? data.categories
        : Array.isArray(bi.categories)
          ? bi.categories
          : [];

    const hours = bi.hours || null;
    const openingHours = data.openingHours || bi.openingHours || null;
    const openNow =
        typeof data.openNow === 'boolean'
            ? data.openNow
            : typeof bi.openNow === 'boolean'
              ? bi.openNow
              : null;

    return {
        uid: safeId,
        profileType: 'business',
        displayName,
        avatarUrl: coverImage || null,
        coverImageStoragePath:
            String(data.coverImageStoragePath || bi.coverImageStoragePath || '').trim() || null,
        subscriptionTier: 'free',
        accountRole: 'partner',
        searchable: true,
        search: {
            displayNameLower: displayName.trim().toLowerCase(),
        },
        businessPublic: {
            isPublished,
            businessType: String(bi.businessType || 'Restaurant').trim() || 'Restaurant',
            city: bi.city || null,
            country: bi.country || null,
            address: bi.address || data?.address || null,
            categories: Array.isArray(data?.categories)
                ? data.categories
                : Array.isArray(bi.categories)
                  ? bi.categories
                  : [],
            description: bi.description || null,
            coverImage: coverImage || null,
            coverImageStoragePath:
                String(data.coverImageStoragePath || bi.coverImageStoragePath || '').trim() || null,
            lat,
            lng,
            phone: bi.phone || data?.phone || null,
            website: bi.website || data?.website || null,
            hours,
            openingHours,
            openNow,
            brandKit: bi.brandKit || null,
            theme: bi.theme || null,
        },
        createdBy: data?.createdBy || 'admin',
        isClaimed: data?.isClaimed === true,
        isVirtual: data?.isVirtual === true,
        googlePlaceId: data?.googlePlaceId || safeId,
        sourceCollection: 'restaurants',
        updatedAt: FieldValue.serverTimestamp(),
    };
}

/**
 * @param {import('firebase-admin/firestore').Firestore} db
 * @param {string} restaurantId
 */
export async function upsertRestaurantPublicProfile(db, restaurantId) {
    const id = String(restaurantId || '').trim();
    if (!id) return null;

    const snap = await db.collection('restaurants').doc(id).get();
    if (!snap.exists) return null;

    const payload = buildPublicProfileFromRestaurant(id, snap.data() || {});
    await db.collection('public_profiles').doc(id).set(payload, { merge: false });
    return payload;
}
