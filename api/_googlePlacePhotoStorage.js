import { randomUUID } from 'node:crypto';
import { uploadPublicStorageBuffer } from './_aiStorage.js';

/** Permanent cover URLs: Firebase token links or long-lived GCS signed read URLs — not Google CDN / proxy. */
export function isFirebaseStorageMediaUrl(url) {
    const u = String(url || '').trim();
    if (!u) return false;
    if (u.includes('firebasestorage.googleapis.com')) return true;
    if (/^https:\/\/storage\.googleapis\.com\/[^/?#]+\/[^?#]+/i.test(u)) return true;
    return false;
}

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
 * @param {string} photoName
 * @param {string} key
 */
async function downloadGooglePlacePhotoBytes(photoName, key) {
    const resource = String(photoName || '').replace(/^\/+/, '');
    if (!resource || !key) return null;

    const mediaBase = `https://places.googleapis.com/v1/${resource}/media`;
    const headers = { 'X-Goog-Api-Key': key };

    // 1) Direct image response (follow redirect)
    try {
        const direct = await fetch(`${mediaBase}?maxHeightPx=1200&maxWidthPx=1200`, {
            method: 'GET',
            headers,
            redirect: 'follow',
        });
        const contentType = direct.headers.get('content-type') || '';
        if (direct.ok && contentType.includes('image')) {
            const buffer = Buffer.from(await direct.arrayBuffer());
            if (buffer.length >= 500) {
                return { buffer, contentType };
            }
        } else {
            console.warn(
                '[downloadGooglePlacePhotoBytes] direct status',
                direct.status,
                contentType.slice(0, 40),
            );
        }
    } catch (err) {
        console.warn('[downloadGooglePlacePhotoBytes] direct fetch failed', err);
    }

    // 2) JSON photoUri then fetch bytes
    try {
        const meta = await fetch(
            `${mediaBase}?maxHeightPx=1200&maxWidthPx=1200&skipHttpRedirect=true`,
            { method: 'GET', headers },
        );
        if (!meta.ok) {
            console.warn('[downloadGooglePlacePhotoBytes] media meta status', meta.status);
        } else {
            const metaJson = await meta.json().catch(() => ({}));
            const photoUri = String(metaJson.photoUri || '').trim();
            if (photoUri) {
                const imageRes = await fetch(photoUri, {
                    redirect: 'follow',
                    headers: { 'X-Goog-Api-Key': key },
                });
                if (imageRes.ok) {
                    const contentType = imageRes.headers.get('content-type') || 'image/jpeg';
                    const buffer = Buffer.from(await imageRes.arrayBuffer());
                    if (buffer.length >= 500) {
                        return { buffer, contentType };
                    }
                } else {
                    console.warn('[downloadGooglePlacePhotoBytes] photoUri status', imageRes.status);
                }
            }
        }
    } catch (err) {
        console.warn('[downloadGooglePlacePhotoBytes] photoUri fetch failed', err);
    }

    // 3) Smaller dimensions fallback
    try {
        const small = await fetch(`${mediaBase}?maxHeightPx=800&maxWidthPx=800`, {
            method: 'GET',
            headers,
            redirect: 'follow',
        });
        const contentType = small.headers.get('content-type') || '';
        if (small.ok && contentType.includes('image')) {
            const buffer = Buffer.from(await small.arrayBuffer());
            if (buffer.length >= 500) {
                return { buffer, contentType };
            }
        }
    } catch (err) {
        console.warn('[downloadGooglePlacePhotoBytes] small fetch failed', err);
    }

    return null;
}

/**
 * @param {string} dataUrl
 * @returns {{ buffer: Buffer; mimeType: string }}
 */
export function parseImageDataUrl(dataUrl) {
    const raw = String(dataUrl || '').trim();
    const match = /^data:(image\/(?:jpeg|jpg|png|webp));base64,([A-Za-z0-9+/=]+)$/i.exec(raw);
    if (!match) {
        throw Object.assign(new Error('Invalid preview cover image data URL'), { code: 'invalid-cover-data' });
    }
    let mimeType = match[1].toLowerCase().replace('jpg', 'jpeg');
    if (mimeType === 'image/jpg') mimeType = 'image/jpeg';
    const buffer = Buffer.from(match[2], 'base64');
    if (!buffer.length || buffer.length < 500) {
        throw Object.assign(new Error('Preview cover image buffer too small'), { code: 'invalid-cover-data' });
    }
    return { buffer, mimeType };
}

/**
 * In-memory Google photo → data URL for admin preview (no Storage write).
 * @param {string} _placeId
 * @param {string} photoName
 * @returns {Promise<string | null>}
 */
export async function fetchGooglePlacePhotoAsDataUrl(_placeId, photoName) {
    const key = googlePlacesApiKey();
    const name = String(photoName || '').trim();
    if (!name || !key) return null;

    const downloaded = await downloadGooglePlacePhotoBytes(name, key);
    if (!downloaded) return null;

    const mimeType = downloaded.contentType.includes('png') ? 'image/png' : 'image/jpeg';
    return `data:${mimeType};base64,${downloaded.buffer.toString('base64')}`;
}

/**
 * Upload admin preview cover to Firebase Storage at restaurants/covers/{placeId}.jpg
 * @param {string} placeId
 * @param {string} dataUrl
 * @returns {Promise<{ url: string; path: string }>}
 */
export async function uploadRestaurantCoverFromDataUrl(placeId, dataUrl) {
    const id = String(placeId || '').trim();
    if (!id) {
        throw Object.assign(new Error('Missing placeId'), { code: 'invalid-place-id' });
    }

    const { buffer, mimeType } = parseImageDataUrl(dataUrl);
    const objectPath = `restaurants/covers/${id}.jpg`;

    const { url, path } = await uploadPublicStorageBuffer(
        objectPath,
        buffer,
        mimeType.includes('png') ? 'image/jpeg' : mimeType,
        'google_places_import',
    );

    if (!isFirebaseStorageMediaUrl(url)) {
        throw Object.assign(new Error('Upload did not return a public Storage URL'), {
            code: 'photo-storage-failed',
        });
    }

    return { url, path };
}

/**
 * Download first Google Place photo and persist to Firebase Storage.
 * Throws on failure — callers must not write Firestore until this succeeds.
 * @param {string} placeId
 * @param {string} photoName
 * @returns {Promise<{ url: string; path: string }>}
 */
export async function uploadGooglePlacePhotoToStorage(placeId, photoName) {
    const key = googlePlacesApiKey();
    const id = String(placeId || '').trim();
    const name = String(photoName || '').trim();
    if (!id || !name) {
        throw Object.assign(new Error('Missing placeId or Google photo reference'), {
            code: 'photo-storage-failed',
        });
    }
    if (!key) {
        throw Object.assign(new Error('Google Places API key not configured'), {
            code: 'places-not-configured',
        });
    }

    const downloaded = await downloadGooglePlacePhotoBytes(name, key);
    if (!downloaded) {
        throw Object.assign(new Error('Could not download Google Place photo bytes'), {
            code: 'photo-download-failed',
        });
    }

    const { buffer, contentType } = downloaded;
    const ext = contentType.includes('png') ? 'png' : 'jpg';
    const objectPath = `business_photos/${id}/google_import_${Date.now()}_${randomUUID().slice(0, 8)}.${ext}`;

    try {
        const { url, path } = await uploadPublicStorageBuffer(
            objectPath,
            buffer,
            contentType,
            'google_places_import',
        );
        if (!isFirebaseStorageMediaUrl(url)) {
            throw Object.assign(new Error('Upload did not return a Firebase Storage URL'), {
                code: 'photo-storage-failed',
            });
        }
        console.info('[uploadGooglePlacePhotoToStorage] saved', path, buffer.length, url.slice(0, 80));
        return { url, path };
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        throw Object.assign(new Error(`Firebase Storage upload failed: ${message}`), {
            code: 'photo-storage-failed',
        });
    }
}
