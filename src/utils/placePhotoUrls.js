/**
 * Google Place photos policy (client):
 * We do not request Place photo fields, generate Place photo URLs, or rely on repeated
 * Google photo fetches. Venue/gallery images must be user uploads to Firebase Storage
 * with metadata in Firestore, or neutral stock URLs for invitation UI only.
 *
 * `placePhotoProxyUrls` / `placePhotosFromGoogleDetails` remain for rare legacy paths;
 * they must not trigger billable Place Photo usage from the browser without a one-time
 * server-side fetch → Storage flow.
 */

/** Neutral stock images for invitation media suggestions when no persisted venue URLs exist. */
export const STOCK_INVITATION_SUGGESTED_IMAGES = [
    'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=500',
    'https://images.unsplash.com/photo-1559339352-11d035aa65de?w=500',
    'https://images.unsplash.com/photo-1543007630-9710e4a00a20?w=500',
    'https://images.unsplash.com/photo-1529333166437-7750a6dd5a70?w=500',
];

export function placePhotoProxyUrls(_placeId, _n = 10) {
    return [];
}

/**
 * Build display URLs from google.maps.places.PlacePhoto[] (legacy; avoid from client).
 */
export function placePhotosFromGoogleDetails(photos, max = 10) {
    if (!Array.isArray(photos) || photos.length === 0) return [];
    const out = [];
    for (let i = 0; i < Math.min(photos.length, max); i++) {
        const p = photos[i];
        try {
            if (p && typeof p.getUrl === 'function') {
                out.push(p.getUrl({ maxWidth: 1200 }));
            }
        } catch (e) {
            console.warn('[placePhotoUrls] photo.getUrl failed:', e);
        }
    }
    return out;
}

/**
 * Prefer explicit HTTPS URLs already on the selection payload (e.g. from your DB).
 * Does not resolve Google photos by placeId on the client.
 */
export function placeSelectionPhotoUrls(placeData, count = 10) {
    if (!placeData) return [];
    if (Array.isArray(placeData.photos) && placeData.photos.length > 0) {
        return placeData.photos
            .filter((url) => typeof url === 'string' && url.startsWith('http'))
            .slice(0, count);
    }
    return [];
}
