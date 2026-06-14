import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { ensureFirebaseAdmin } from './_firebaseAdmin.js';
import { bucketCandidates, downloadStorageObjectBuffer } from './_aiStorage.js';
import { uploadGooglePlacePhotoToStorage } from './_googlePlacePhotoStorage.js';
import { isFirebaseStorageMediaUrl } from './_googlePlacePhotoStorage.js';
import { upsertRestaurantPublicProfile } from './_restaurantPublicProfile.js';

/**
 * @param {unknown} value
 */
function trimUrl(value) {
    return String(value || '').trim();
}

/**
 * First persisted Storage download URL on a restaurant or public_profiles document.
 * @param {Record<string, unknown> | null | undefined} data
 * @returns {string | null}
 */
export function extractPersistedCoverUrlFromDoc(data) {
    if (!data || typeof data !== 'object') return null;

    const bi = data.businessInfo && typeof data.businessInfo === 'object' ? data.businessInfo : {};
    const bp =
        data.businessPublic && typeof data.businessPublic === 'object' ? data.businessPublic : {};

    const candidates = [
        bi.coverImage,
        data.photo_url,
        data.coverImage,
        data.avatarUrl,
        bp.coverImage,
    ];

    for (const candidate of candidates) {
        const url = trimUrl(candidate);
        if (url && isFirebaseStorageMediaUrl(url)) {
            return url;
        }
    }

    return null;
}

/**
 * Load persisted public cover URL from Firestore (restaurants, then public_profiles).
 * Optionally repairs from Google photo reference when missing.
 * @param {string} placeId
 * @param {{ allowRepair?: boolean }} [opts]
 * @returns {Promise<string | null>}
 */
export async function resolveBusinessCoverPublicUrl(placeId, opts = {}) {
    const id = String(placeId || '').trim();
    if (!id) return null;

    ensureFirebaseAdmin();
    const db = getFirestore();

    const restaurantSnap = await db.collection('restaurants').doc(id).get();
    /** @type {Record<string, unknown> | null} */
    let restaurant = restaurantSnap.exists ? restaurantSnap.data() || {} : null;

    if (restaurant) {
        const fromRestaurant = extractPersistedCoverUrlFromDoc(restaurant);
        if (fromRestaurant) return fromRestaurant;
    }

    const publicSnap = await db.collection('public_profiles').doc(id).get();
    if (publicSnap.exists) {
        const fromPublic = extractPersistedCoverUrlFromDoc(publicSnap.data() || {});
        if (fromPublic) return fromPublic;
    }

    if (opts.allowRepair !== false && restaurant) {
        const repairedPath = await repairCoverFromGoogleReference(id, restaurant);
        if (repairedPath) {
            const refreshed = await db.collection('restaurants').doc(id).get();
            if (refreshed.exists) {
                return extractPersistedCoverUrlFromDoc(refreshed.data() || {});
            }
        }
    }

    return null;
}

/**
 * @param {import('@google-cloud/storage').File[]} files
 */
function pickNewestStorageFile(files) {
    if (!Array.isArray(files) || files.length === 0) return null;
    const sorted = [...files].sort((a, b) => {
        const aTime = new Date(a.metadata?.updated || a.metadata?.timeCreated || 0).getTime();
        const bTime = new Date(b.metadata?.updated || b.metadata?.timeCreated || 0).getTime();
        return aTime - bTime;
    });
    return sorted[sorted.length - 1]?.name || null;
}

/**
 * Decode object path from a Firebase Storage download URL.
 * @param {string} url
 */
export function storagePathFromFirebaseUrl(url) {
    const raw = String(url || '').trim();
    if (!raw.includes('firebasestorage.googleapis.com')) return null;
    const match = raw.match(/\/o\/([^?]+)/);
    if (!match?.[1]) return null;
    try {
        return decodeURIComponent(match[1]);
    } catch {
        return null;
    }
}

/**
 * @param {Record<string, unknown> | null | undefined} data
 */
function coverPathsFromDoc(data) {
    if (!data || typeof data !== 'object') return [];
    const bi = data.businessInfo && typeof data.businessInfo === 'object' ? data.businessInfo : {};
    const bp =
        data.businessPublic && typeof data.businessPublic === 'object' ? data.businessPublic : {};

    const paths = [
        data.coverImageStoragePath,
        bi.coverImageStoragePath,
        bp.coverImageStoragePath,
        storagePathFromFirebaseUrl(data.photo_url),
        storagePathFromFirebaseUrl(data.avatarUrl),
        storagePathFromFirebaseUrl(bi.coverImage),
        storagePathFromFirebaseUrl(bp.coverImage),
    ];

    const placeId = String(data.googlePlaceId || data.uid || bi.placeId || '').trim();
    if (placeId) {
        paths.push(`restaurants/covers/${placeId}.jpg`);
    }

    return [...new Set(paths.map((p) => String(p || '').trim()).filter(Boolean))];
}

/**
 * @param {string} placeId
 */
async function listStoragePrefix(placeId) {
    ensureFirebaseAdmin();
    const storage = getStorage();
    const prefix = `business_photos/${placeId}/`;

    for (const name of bucketCandidates()) {
        const bucket = name ? storage.bucket(name) : storage.bucket();
        try {
            const [files] = await bucket.getFiles({ prefix, maxResults: 25 });
            const newest = pickNewestStorageFile(files);
            if (newest) return newest;
        } catch (err) {
            console.warn(
                '[businessCoverResolve] list failed',
                name || '(default)',
                err instanceof Error ? err.message : err,
            );
        }
    }
    return null;
}

/**
 * @param {string} placeId
 * @param {string} objectPath
 */
async function persistCoverPath(placeId, objectPath, coverUrl) {
    ensureFirebaseAdmin();
    const db = getFirestore();
    /** @type {Record<string, unknown>} */
    const patch = {
        coverImageStoragePath: objectPath,
        coverImageFromFirebase: true,
        updated_at: FieldValue.serverTimestamp(),
        'businessInfo.coverImageStoragePath': objectPath,
        'businessInfo.coverImageFromFirebase': true,
    };
    if (coverUrl) {
        patch.photo_url = coverUrl;
        patch['businessInfo.coverImage'] = coverUrl;
    }
    await db.collection('restaurants').doc(placeId).set(patch, { merge: true });
    try {
        await upsertRestaurantPublicProfile(db, placeId);
    } catch (err) {
        console.warn('[businessCoverResolve] public profile sync failed', placeId, err);
    }
}

/**
 * Re-download Google Place photo and persist to Storage when import data is incomplete.
 * @param {string} placeId
 * @param {Record<string, unknown>} restaurant
 */
async function repairCoverFromGoogleReference(placeId, restaurant) {
    const photoRef = String(restaurant.googlePhotoReference || '').trim();
    if (!photoRef) return null;
    try {
        const uploaded = await uploadGooglePlacePhotoToStorage(placeId, photoRef);
        await persistCoverPath(placeId, uploaded.path, uploaded.url);
        console.info('[businessCoverResolve] repaired from Google photo', placeId, uploaded.path);
        return uploaded.path;
    } catch (err) {
        console.warn(
            '[businessCoverResolve] repair failed',
            placeId,
            err instanceof Error ? err.message : err,
        );
        return null;
    }
}

/**
 * Resolve Storage object path for a business cover image.
 * @param {string} placeId
 * @param {{ allowRepair?: boolean }} [opts]
 */
export async function resolveBusinessCoverObjectPath(placeId, opts = {}) {
    const id = String(placeId || '').trim();
    if (!id) return null;

    ensureFirebaseAdmin();
    const db = getFirestore();

    /** @type {Record<string, unknown> | null} */
    let restaurant = null;

    const restaurantSnap = await db.collection('restaurants').doc(id).get();
    if (restaurantSnap.exists) {
        restaurant = restaurantSnap.data() || {};
        for (const path of coverPathsFromDoc(restaurant)) {
            return path;
        }
    }

    const publicSnap = await db.collection('public_profiles').doc(id).get();
    if (publicSnap.exists) {
        for (const path of coverPathsFromDoc(publicSnap.data() || {})) {
            return path;
        }
    }

    const listed = await listStoragePrefix(id);
    if (listed) {
        if (restaurantSnap.exists) {
            await persistCoverPath(id, listed, null);
        }
        return listed;
    }

    if (opts.allowRepair !== false && restaurant) {
        return repairCoverFromGoogleReference(id, restaurant);
    }

    return null;
}

export { downloadStorageObjectBuffer };
