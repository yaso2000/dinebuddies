import { DEFAULT_RESTAURANT_COVER_PLACEHOLDER } from './_googlePlacesMinimal.constants.js';
import { verifyStorageObjectReadable } from './_aiStorage.js';
import {
    fetchGooglePlacePhotoAsDataUrl,
    isFirebaseStorageMediaUrl,
    uploadGooglePlacePhotoToStorage,
} from './_googlePlacePhotoStorage.js';
import {
    mapGoogleTypesToBusinessType,
    normalizeGooglePlaceCategories,
    regularOpeningHoursToBusinessHours,
} from './_googlePlacesHours.js';
import {
    GOOGLE_PLACE_IMPORT_FIELD_MASK,
    GOOGLE_PLACE_BUSINESS_FIELD_MASK,
    mapGooglePlaceResourceToDetails,
} from './_googlePlacesSchema.js';

const PLACES_V1 = 'https://places.googleapis.com/v1/places';

export { DEFAULT_RESTAURANT_COVER_PLACEHOLDER };
export { GOOGLE_PLACE_BUSINESS_FIELD_MASK as STRICT_FIELD_MASK };
export const STRICT_FIELD_MASK_FIELDS = GOOGLE_PLACE_BUSINESS_FIELD_MASK.split(',');

function googlePlacesApiKey() {
    return (
        process.env.GOOGLE_PLACES_API_KEY ||
        process.env.GOOGLE_MAPS_SERVER_KEY ||
        process.env.VITE_GOOGLE_MAPS_API_KEY ||
        process.env.GOOGLE_MAPS_API_KEY ||
        ''
    );
}

/**
 * @param {string} placeId
 * @param {string} fieldMask
 */
async function fetchGooglePlaceResource(placeId, fieldMask, languageCode = 'en') {
    const key = googlePlacesApiKey();
    const id = String(placeId || '').trim();
    if (!id) {
        throw Object.assign(new Error('Missing placeId'), { code: 'invalid-place-id' });
    }
    if (!key) {
        throw Object.assign(new Error('Google Places API key not configured'), {
            code: 'places-not-configured',
        });
    }

    const lang = String(languageCode || 'en').trim().slice(0, 5) || 'en';
    const url = `${PLACES_V1}/${encodeURIComponent(id)}?languageCode=${encodeURIComponent(lang)}`;
    const response = await fetch(url, {
        method: 'GET',
        headers: {
            'X-Goog-Api-Key': key,
            'X-Goog-FieldMask': fieldMask,
        },
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        const msg =
            (data && typeof data === 'object' && 'error' in data && data.error?.message) ||
            response.statusText ||
            'Google Places request failed';
        throw Object.assign(new Error(String(msg)), {
            code: 'google-places-failed',
            status: response.status,
        });
    }

    return { id, data };
}

/**
 * @param {Record<string, unknown>} data
 */
function extractPhotoName(data) {
    return Array.isArray(data.photos) &&
        data.photos[0] &&
        typeof data.photos[0] === 'object' &&
        'name' in data.photos[0]
        ? String(/** @type {{ name?: string }} */ (data.photos[0]).name || '').trim()
        : '';
}

/**
 * @param {string} placeId
 * @param {{
 *   preserveCoverUrl?: string;
 *   preserveCoverStoragePath?: string;
 *   allowPhotoFailureOnRefresh?: boolean;
 *   forcePhotoRefresh?: boolean;
 *   requirePhoto?: boolean;
 *   skipPhotoUpload?: boolean;
 * }} [options]
 */
export async function fetchGooglePlaceMinimal(placeId, options = {}) {
    const languageCode = String(options.languageCode || 'en').trim() || 'en';
    const { id, data } = await fetchGooglePlaceResource(placeId, GOOGLE_PLACE_IMPORT_FIELD_MASK, languageCode);

    const types = normalizeGooglePlaceCategories(data.types);
    const hours = regularOpeningHoursToBusinessHours(data.regularOpeningHours);
    const businessType = mapGoogleTypesToBusinessType(types);

    const base = mapGooglePlaceResourceToDetails(id, data, {
        hours,
        categories: types,
        businessType,
    });

    const preserveCoverUrl = String(options.preserveCoverUrl || '').trim();
    const preserveCoverStoragePath = String(options.preserveCoverStoragePath || '').trim();
    const allowPhotoFailureOnRefresh = options.allowPhotoFailureOnRefresh === true;
    const forcePhotoRefresh = options.forcePhotoRefresh === true;
    const requirePhoto = options.requirePhoto === true;
    const skipPhotoUpload = options.skipPhotoUpload === true;

    async function useVerifiedPreservedCover() {
        if (forcePhotoRefresh) return null;
        if (!isFirebaseStorageMediaUrl(preserveCoverUrl)) return null;
        const path = preserveCoverStoragePath || null;
        if (path) {
            const readable = await verifyStorageObjectReadable(path);
            if (readable) return { url: preserveCoverUrl, path };
        }
        return { url: preserveCoverUrl, path: path || null };
    }

    let coverImageUrl = DEFAULT_RESTAURANT_COVER_PLACEHOLDER;
    let coverImageStoragePath = null;
    let googlePhotoReference = extractPhotoName(data) || null;
    /** @type {{ code: string; message: string } | null} */
    let photoError = null;

    if (!skipPhotoUpload && googlePhotoReference) {
        try {
            const uploaded = await uploadGooglePlacePhotoToStorage(id, googlePhotoReference);
            coverImageUrl = uploaded.url;
            coverImageStoragePath = uploaded.path;
            if (!isFirebaseStorageMediaUrl(coverImageUrl)) {
                throw Object.assign(new Error('Cover image was not persisted to Firebase Storage'), {
                    code: 'photo-storage-failed',
                });
            }
        } catch (photoErr) {
            const code =
                photoErr && typeof photoErr === 'object' && 'code' in photoErr
                    ? String(/** @type {{ code?: string }} */ (photoErr).code)
                    : 'photo-storage-failed';
            const message = photoErr instanceof Error ? photoErr.message : String(photoErr);
            photoError = { code, message };

            const preserved = await useVerifiedPreservedCover();
            if (allowPhotoFailureOnRefresh && preserved) {
                coverImageUrl = preserved.url;
                coverImageStoragePath = preserved.path;
                photoError = null;
                console.warn('[fetchGooglePlaceMinimal] photo upload failed; kept previous cover', id);
            } else if (requirePhoto) {
                throw photoErr;
            } else {
                console.warn('[fetchGooglePlaceMinimal] photo upload failed; continuing with fields', id, message);
            }
        }
    } else if (!skipPhotoUpload) {
        const preserved = await useVerifiedPreservedCover();
        if (preserved) {
            coverImageUrl = preserved.url;
            coverImageStoragePath = preserved.path;
        }
    } else {
        const preserved = await useVerifiedPreservedCover();
        if (preserved) {
            coverImageUrl = preserved.url;
            coverImageStoragePath = preserved.path;
        }
    }

    return {
        ...base,
        googlePhotoReference,
        coverImageUrl,
        coverImageStoragePath,
        coverImageFromFirebase: isFirebaseStorageMediaUrl(coverImageUrl),
        previewCoverImage: null,
        photoError,
    };
}

/**
 * Fetch Google Place fields + in-memory cover preview (no Storage / Firestore).
 * @param {string} placeId
 * @param {{ languageCode?: string }} [options]
 */
export async function fetchGooglePlacePreview(placeId, options = {}) {
    const languageCode = String(options.languageCode || 'en').trim() || 'en';
    const details = await fetchGooglePlaceMinimal(placeId, { skipPhotoUpload: true, languageCode });

    let previewCoverImage = null;
    /** @type {{ code: string; message: string } | null} */
    let photoError = null;

    if (details.googlePhotoReference) {
        try {
            previewCoverImage = await fetchGooglePlacePhotoAsDataUrl(
                placeId,
                details.googlePhotoReference,
            );
            if (!previewCoverImage) {
                photoError = {
                    code: 'photo-download-failed',
                    message: 'Could not download Google Place photo bytes',
                };
            }
        } catch (err) {
            photoError = {
                code: 'photo-download-failed',
                message: err instanceof Error ? err.message : String(err),
            };
        }
    }

    return {
        ...details,
        previewCoverImage,
        photoError,
    };
}
