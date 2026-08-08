import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { ensureFirebaseAdmin } from './_firebaseAdmin.js';
import { compactE164FromGoogleInternational } from './_phoneUtils.js';
import { getAdminOwnerUid } from './_restaurantOwnership.js';
import { DEFAULT_RESTAURANT_COVER_PLACEHOLDER } from './_googlePlacesMinimal.js';
import { buildPublicProfileFromRestaurant } from './_restaurantPublicProfile.js';
import { verifyStorageObjectReadable } from './_aiStorage.js';
import { isFirebaseStorageMediaUrl, uploadRestaurantCoverFromDataUrl } from './_googlePlacePhotoStorage.js';

/**
 * Upload preview base64 cover to Storage and merge URLs into Google details before Firestore write.
 * @param {string} placeId
 * @param {Record<string, unknown>} details
 * @returns {Promise<Record<string, unknown>>}
 */
async function applyPreviewCoverToDetails(placeId, details) {
    const dataUrl = String(details.previewCoverImage || '').trim();
    if (!dataUrl) {
        return details;
    }

    const uploaded = await uploadRestaurantCoverFromDataUrl(placeId, dataUrl);
    return {
        ...details,
        coverImageUrl: uploaded.url,
        coverImageStoragePath: uploaded.path,
        coverImageFromFirebase: true,
        previewCoverImage: undefined,
    };
}

/**
 * @param {string} placeId
 */
async function findExistingByGooglePlaceId(placeId) {
    ensureFirebaseAdmin();
    const db = getFirestore();

    const inRestaurants = await db
        .collection('restaurants')
        .where('googlePlaceId', '==', placeId)
        .limit(1)
        .get();
    if (!inRestaurants.empty) {
        return { collection: 'restaurants', doc: inRestaurants.docs[0] };
    }

    const byTopLevel = await db
        .collection('users')
        .where('googlePlaceId', '==', placeId)
        .limit(1)
        .get();
    if (!byTopLevel.empty) {
        return { collection: 'users', doc: byTopLevel.docs[0] };
    }

    const byBusinessInfo = await db
        .collection('users')
        .where('businessInfo.placeId', '==', placeId)
        .limit(1)
        .get();
    if (!byBusinessInfo.empty) {
        return { collection: 'users', doc: byBusinessInfo.docs[0] };
    }

    return null;
}

/**
 * Resolve existing admin-imported restaurant doc for a Google placeId (if any).
 * @param {string} placeId
 * @returns {Promise<{ docId: string; data: Record<string, unknown> } | null>}
 */
export async function loadExistingRestaurantForImport(placeId) {
    ensureFirebaseAdmin();
    const db = getFirestore();
    const id = String(placeId || '').trim();
    if (!id) return null;

    const direct = await db.collection('restaurants').doc(id).get();
    if (direct.exists) {
        return { docId: id, data: direct.data() || {} };
    }

    const found = await findExistingByGooglePlaceId(id);
    if (found?.collection === 'restaurants') {
        return { docId: found.doc.id, data: found.doc.data() || {} };
    }
    return null;
}

/**
 * @param {unknown} coords
 */
function normalizeCoordinates(coords) {
    if (!coords || typeof coords !== 'object') return { lat: null, lng: null };
    const lat = Number(/** @type {{ lat?: number }} */ (coords).lat);
    const lng = Number(/** @type {{ lng?: number }} */ (coords).lng);
    return {
        lat: Number.isFinite(lat) ? lat : null,
        lng: Number.isFinite(lng) ? lng : null,
    };
}

/**
 * @param {Record<string, unknown>} details
 * @param {{ isCreate?: boolean }} [opts]
 */
function buildRestaurantDocFromGoogleDetails(details, opts = {}) {
    const placeId = String(details.googlePlaceId || '').trim();
    const name = String(details.name || '').trim() || placeId;
    const phone = String(details.phone || '').trim();
    const website = String(details.website || '').trim();
    const address = String(details.address || '').trim();
    const city = String(details.city || '').trim();
    const country = String(details.country || '').trim();
    const standardizedPhone = compactE164FromGoogleInternational(phone) || null;
    const adminOwnerUid = getAdminOwnerUid();
    const { lat, lng } = normalizeCoordinates(details.coordinates);
    const openingHours = details.openingHours || null;
    const hours = details.hours || null;
    const categories = Array.isArray(details.categories) ? details.categories : [];
    const businessType = String(details.businessType || 'Restaurant').trim() || 'Restaurant';
    const googlePhotoReference = String(details.googlePhotoReference || '').trim() || null;
    const coverImageStoragePath = String(details.coverImageStoragePath || '').trim() || null;
    const coverImage =
        String(details.coverImageUrl || '').trim() || DEFAULT_RESTAURANT_COVER_PLACEHOLDER;
    const coverImageFromFirebase = isFirebaseStorageMediaUrl(coverImage);

    const restaurantDoc = {
        createdBy: 'admin',
        isClaimed: false,
        claimed: false,
        isVirtual: true,
        ownerId: adminOwnerUid,
        googlePlaceId: placeId,
        googlePhotoReference,
        coverImageStoragePath,
        coverImageFromFirebase,
        uid: placeId,
        accountType: 'business',
        role: 'partner',
        display_name: name,
        name,
        phone,
        standardized_phone: standardizedPhone,
        website,
        address,
        coordinates: { lat, lng },
        openingHours,
        openNow: details.openNow === true ? true : details.openNow === false ? false : null,
        categories,
        photo_url: coverImage || null,
        email: '',
        emailVerified: true,
        status: 'ai-generated',
        updated_at: FieldValue.serverTimestamp(),
        businessInfo: {
            businessName: name,
            businessType,
            placeId,
            phone,
            standardized_phone: standardizedPhone,
            website,
            address,
            city,
            country,
            lat,
            lng,
            hours,
            openingHours,
            categories,
            coverImage: coverImage || null,
            coverImageStoragePath,
            coverImageFromFirebase,
            isClaimed: false,
            phone_claimed: false,
            phone_verified: false,
            isPublished: true,
        },
    };

    if (opts.isCreate) {
        restaurantDoc.created_at = FieldValue.serverTimestamp();
    }

    return { placeId, adminOwnerUid, coverImage, restaurantDoc };
}

/**
 * @param {Record<string, unknown>} details
 */
function buildPlaceholderFromDetails(details, adminOwnerUid, coverImage) {
    const placeId = String(details.googlePlaceId || '').trim();
    const { lat, lng } = normalizeCoordinates(details.coordinates);
    return {
        createdBy: 'admin',
        isClaimed: false,
        claimed: false,
        isVirtual: true,
        ownerId: adminOwnerUid,
        googlePlaceId: placeId,
        coverImage: coverImage || null,
        coverImageFromFirebase: isFirebaseStorageMediaUrl(coverImage),
        coverImageStoragePath: String(details.coverImageStoragePath || '').trim() || null,
        googlePhotoReference: String(details.googlePhotoReference || '').trim() || null,
        name: String(details.name || '').trim() || placeId,
        phone: String(details.phone || '').trim(),
        website: String(details.website || '').trim(),
        address: String(details.address || '').trim(),
        coordinates: { lat, lng },
        openingHours: details.openingHours || null,
        hours: details.hours || null,
        categories: Array.isArray(details.categories) ? details.categories : [],
        status: 'ai-generated',
        collection: 'restaurants',
    };
}

/**
 * Admin Google Places import → `restaurants/{placeId}` + `public_profiles/{placeId}`.
 * @param {Record<string, unknown>} details
 */
export async function ingestVirtualBusinessFromGoogle(details) {
    ensureFirebaseAdmin();
    const db = getFirestore();

    const placeId = String(details.googlePlaceId || '').trim();
    if (!placeId) {
        throw Object.assign(new Error('Invalid placeId'), { code: 'invalid-place-id' });
    }

    const existing = await findExistingByGooglePlaceId(placeId);
    if (existing) {
        throw Object.assign(new Error('Place already imported'), {
            code: 'place-already-exists',
            docId: existing.doc.id,
            collection: existing.collection,
        });
    }

    const detailsWithCover = await applyPreviewCoverToDetails(placeId, details);

    const { placeId: docId, adminOwnerUid, coverImage, restaurantDoc } = buildRestaurantDocFromGoogleDetails(
        detailsWithCover,
        { isCreate: true },
    );

    const ref = db.collection('restaurants').doc(docId);

    console.info('[virtualBusinessIngest] create restaurants/%s', docId, {
        name: restaurantDoc.name,
        phone: restaurantDoc.phone,
        website: restaurantDoc.website,
        address: restaurantDoc.address,
        coordinates: restaurantDoc.coordinates,
        openingHours: Boolean(restaurantDoc.openingHours),
        categories: restaurantDoc.categories?.length ?? 0,
        coverImageStoragePath: restaurantDoc.coverImageStoragePath || null,
    });

    await ref.set(restaurantDoc);

    await db.collection('public_profiles').doc(docId).set(
        buildPublicProfileFromRestaurant(docId, restaurantDoc),
        { merge: false }
    );

    return {
        docId,
        placeholder: buildPlaceholderFromDetails(detailsWithCover, adminOwnerUid, coverImage),
        collection: 'restaurants',
    };
}

/**
 * Re-fetch path: update existing `restaurants/{docId}` with latest Google data + photo on Storage.
 * @param {Record<string, unknown>} details
 * @param {string} docId
 */
export async function refreshVirtualBusinessFromGoogle(details, docId) {
    ensureFirebaseAdmin();
    const db = getFirestore();
    const id = String(docId || details.googlePlaceId || '').trim();
    if (!id) {
        throw Object.assign(new Error('Invalid docId'), { code: 'invalid-place-id' });
    }

    const ref = db.collection('restaurants').doc(id);
    const snap = await ref.get();
    if (!snap.exists) {
        throw Object.assign(new Error('Restaurant not found'), { code: 'restaurant-not-found' });
    }

    const prev = snap.data() || {};
    const prevBi = prev.businessInfo && typeof prev.businessInfo === 'object' ? prev.businessInfo : {};
    const preserveCoverUrl = String(prevBi.coverImage || prev.photo_url || '').trim();
    const preserveCoverStoragePath = String(
        prev.coverImageStoragePath || prevBi.coverImageStoragePath || '',
    ).trim();

    const hasNewPreviewCover = Boolean(String(details.previewCoverImage || '').trim());
    const detailsWithCover = hasNewPreviewCover
        ? await applyPreviewCoverToDetails(id, details)
        : details;

    const { adminOwnerUid, coverImage, restaurantDoc } = buildRestaurantDocFromGoogleDetails(detailsWithCover);
    const coverImageStoragePath = restaurantDoc.coverImageStoragePath;

    const preserveReadable =
        isFirebaseStorageMediaUrl(preserveCoverUrl) &&
        preserveCoverStoragePath &&
        (await verifyStorageObjectReadable(preserveCoverStoragePath));

    if (
        !isFirebaseStorageMediaUrl(coverImage) &&
        (preserveReadable || isFirebaseStorageMediaUrl(preserveCoverUrl))
    ) {
        restaurantDoc.photo_url = preserveCoverUrl;
        restaurantDoc.coverImageStoragePath =
            preserveCoverStoragePath || restaurantDoc.coverImageStoragePath || null;
        restaurantDoc.coverImageFromFirebase = true;
        restaurantDoc.businessInfo = {
            ...restaurantDoc.businessInfo,
            coverImage: preserveCoverUrl,
            coverImageStoragePath:
                preserveCoverStoragePath || restaurantDoc.businessInfo?.coverImageStoragePath || null,
            coverImageFromFirebase: true,
        };
    } else if (coverImageStoragePath) {
        restaurantDoc.coverImageStoragePath = coverImageStoragePath;
        restaurantDoc.businessInfo = {
            ...restaurantDoc.businessInfo,
            coverImageStoragePath,
        };
    }

    const mergedCover =
        String(restaurantDoc.businessInfo?.coverImage || restaurantDoc.photo_url || '').trim() || coverImage;

    const merged = {
        ...restaurantDoc,
        createdBy: prev.createdBy || 'admin',
        isClaimed: prev.isClaimed === true,
        claimed: prev.isClaimed === true,
        ownerId: prev.ownerId || adminOwnerUid,
        created_at: prev.created_at || FieldValue.serverTimestamp(),
        businessInfo: {
            ...restaurantDoc.businessInfo,
            isClaimed: prev.isClaimed === true,
            phone_claimed: prev.businessInfo?.phone_claimed === true,
            phone_verified: prev.businessInfo?.phone_verified === true,
        },
    };

    console.info('[virtualBusinessIngest] refresh restaurants/%s', id, {
        name: merged.name,
        phone: merged.phone,
        website: merged.website,
        address: merged.address,
        coordinates: merged.coordinates,
        openingHours: Boolean(merged.openingHours),
        categories: merged.categories?.length ?? 0,
        coverImageStoragePath: merged.coverImageStoragePath || null,
    });

    await ref.set(merged, { merge: false });

    await db.collection('public_profiles').doc(id).set(
        buildPublicProfileFromRestaurant(id, merged),
        { merge: false }
    );

    return {
        docId: id,
        placeholder: buildPlaceholderFromDetails(detailsWithCover, merged.ownerId || adminOwnerUid, mergedCover),
        collection: 'restaurants',
        refreshed: true,
    };
}
