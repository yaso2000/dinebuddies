/**
 * @typedef {import('../types/virtualBusinessPlaceholder').ImportFromGooglePreviewSuccess} ImportFromGooglePreviewSuccess
 * @typedef {import('../types/virtualBusinessPlaceholder').ImportFromGooglePublishSuccess} ImportFromGooglePublishSuccess
 * @typedef {import('../types/virtualBusinessPlaceholder').ImportFromGoogleApiError} ImportFromGoogleApiError
 */

import { resolveApiUrl } from '../utils/resolveApiUrl';

/**
 * @param {string} placeId
 * @param {string} idToken
 * @returns {Promise<{ ok: boolean; status: number; data: ImportFromGooglePreviewSuccess | ImportFromGoogleApiError }>}
 */
export async function previewBusinessFromGoogle(placeId, idToken) {
    const res = await fetch(resolveApiUrl('/api/business/import-from-google'), {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
            placeId: String(placeId || '').trim(),
            action: 'preview',
        }),
    });
    const data = await res.json().catch(() => (/** @type {ImportFromGoogleApiError} */ ({
        status: 'error',
        code: 'invalid-response',
        message: 'Invalid server response',
    })));
    return { ok: res.ok, status: res.status, data };
}

/**
 * @param {string} placeId
 * @param {string | null | undefined} previewCoverImage data URL from preview phase
 * @param {string} idToken
 * @param {{ forceCreate?: boolean }} [opts]
 * @returns {Promise<{ ok: boolean; status: number; data: ImportFromGooglePublishSuccess | ImportFromGoogleApiError }>}
 */
export async function publishBusinessFromGoogle(placeId, previewCoverImage, idToken, opts = {}) {
    const res = await fetch(resolveApiUrl('/api/business/import-from-google'), {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
            placeId: String(placeId || '').trim(),
            action: 'publish',
            ...(previewCoverImage ? { previewCoverImage: String(previewCoverImage) } : {}),
            ...(opts.forceCreate === true ? { forceCreate: true } : {}),
        }),
    });
    const data = await res.json().catch(() => (/** @type {ImportFromGoogleApiError} */ ({
        status: 'error',
        code: 'invalid-response',
        message: 'Invalid server response',
    })));
    return { ok: res.ok, status: res.status, data };
}

/** @deprecated Use previewBusinessFromGoogle + publishBusinessFromGoogle */
export async function importBusinessFromGoogle(placeId, idToken) {
    return publishBusinessFromGoogle(placeId, null, idToken);
}
