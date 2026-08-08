'use strict';

const PLACES_V1 = 'https://places.googleapis.com/v1';
const PLACES_DETAILS = 'https://maps.googleapis.com/maps/api/place/details/json';
const PLACES_PHOTO = 'https://maps.googleapis.com/maps/api/place/photo';

/**
 * @param {string} placeId
 * @param {number} idx
 * @param {string} key
 * @returns {Promise<{ buffer: ArrayBuffer, contentType: string }|{ fetchError: { status: number, body: unknown } }|null>}
 */
async function fetchViaPlacesApiNew(placeId, idx, key, referer = '') {
    // Docs use the raw place id in the path (no encoding). Encoding can break some ids.
    const detailsUrl = `${PLACES_V1}/places/${placeId}?key=${encodeURIComponent(key)}`;
    const detailsRes = await fetch(detailsUrl, {
        headers: {
            'X-Goog-Api-Key': key,
            'X-Goog-FieldMask': 'id,photos',
            ...(referer ? { 'Referer': referer } : {}),
        },
    });
    let data;
    try {
        data = await detailsRes.json();
    } catch {
        return { fetchError: { status: detailsRes.status, body: 'invalid_json' } };
    }
    if (!detailsRes.ok) {
        return { fetchError: { status: detailsRes.status, body: data } };
    }
    if (data.error) {
        return { fetchError: { status: detailsRes.status || 400, body: data.error } };
    }
    const photos = data.photos;
    if (!Array.isArray(photos) || photos.length === 0) return null;
    const photo = photos[idx] || photos[0];
    const photoName = photo?.name;
    if (!photoName || typeof photoName !== 'string') return null;
    const mediaUrl = `${PLACES_V1}/${photoName}/media?maxWidthPx=1200&maxHeightPx=1200&key=${encodeURIComponent(key)}`;
    const imgRes = await fetch(mediaUrl, {
        redirect: 'follow',
        headers: { 
            'X-Goog-Api-Key': key,
            ...(referer ? { 'Referer': referer } : {}),
        },
    });
    if (!imgRes.ok) return null;
    const contentType = imgRes.headers.get('content-type') || 'image/jpeg';
    const buffer = await imgRes.arrayBuffer();
    return { buffer, contentType };
}

async function fetchViaLegacy(placeId, idx, key, referer = '') {
    const detailsRes = await fetch(
        `${PLACES_DETAILS}?place_id=${encodeURIComponent(placeId)}&fields=photos&key=${key}`,
        { headers: { ...(referer ? { 'Referer': referer } : {}) } }
    );
    const details = await detailsRes.json();
    if (details.status !== 'OK' || !details.result?.photos?.length) return null;
    const photo = details.result.photos[idx] || details.result.photos[0];
    const ref = photo?.photo_reference;
    if (!ref) return null;
    const photoUrl = `${PLACES_PHOTO}?maxwidth=1200&photo_reference=${encodeURIComponent(ref)}&key=${key}`;
    const imgRes = await fetch(photoUrl, { 
        redirect: 'follow',
        headers: { ...(referer ? { 'Referer': referer } : {}) }
    });
    if (!imgRes.ok) return null;
    const contentType = imgRes.headers.get('content-type') || 'image/jpeg';
    const buffer = await imgRes.arrayBuffer();
    return { buffer, contentType };
}

/**
 * @param {string} placeId
 * @param {string|number} index
 * @param {string} key
 * @returns {Promise<{ buffer: ArrayBuffer, contentType: string }|null>}
 */
async function fetchPlacePhotoBuffer(placeId, index, key, referer = '') {
    const idx = Math.max(0, parseInt(String(index), 10) || 0);
    const fromNew = await fetchViaPlacesApiNew(placeId, idx, key, referer);
    if (fromNew && fromNew.buffer) return fromNew;
    return fetchViaLegacy(placeId, idx, key, referer);
}

/**
 * Like fetchPlacePhotoBuffer but returns Google error details when Places API (New) rejects the request.
 * @returns {Promise<
 *   | { ok: true, buffer: ArrayBuffer, contentType: string }
 *   | { ok: false, status: number, error: string, google?: unknown }
 * >}
 */
function googleErrorMessage(body) {
    if (!body || typeof body !== 'object') return typeof body === 'string' ? body : null;
    const inner = body.error && typeof body.error === 'object' ? body.error : body;
    if (inner && typeof inner.message === 'string') return inner.message;
    return null;
}

async function fetchPlacePhotoBufferDetailed(placeId, index, key, referer = '') {
    const idx = Math.max(0, parseInt(String(index), 10) || 0);
    const fromNew = await fetchViaPlacesApiNew(placeId, idx, key, referer);
    if (fromNew && fromNew.buffer) {
        return { ok: true, buffer: fromNew.buffer, contentType: fromNew.contentType };
    }
    const newApiFailure = fromNew && fromNew.fetchError ? fromNew.fetchError : null;
    const legacy = await fetchViaLegacy(placeId, idx, key, referer);
    if (legacy) return { ok: true, buffer: legacy.buffer, contentType: legacy.contentType };
    if (newApiFailure) {
        const g = newApiFailure.body;
        const msg = googleErrorMessage(g) || `HTTP ${newApiFailure.status}`;
        return {
            ok: false,
            status: newApiFailure.status >= 400 && newApiFailure.status < 600 ? newApiFailure.status : 502,
            error: msg,
            google: g,
        };
    }
    return { ok: false, status: 404, error: 'No photos found for this place (new + legacy).' };
}

module.exports = { fetchPlacePhotoBuffer, fetchPlacePhotoBufferDetailed };
