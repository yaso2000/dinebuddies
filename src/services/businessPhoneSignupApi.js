import { resolveApiUrl } from '../utils/resolveApiUrl';

// Business signup / claim now uses Google Place + Google Business Profile only.
// The SMS/phone lookup was removed.

/**
 * @param {string} placeId Google Place ID
 */
export async function lookupBusinessPlace(placeId) {
    const res = await fetch(resolveApiUrl('/api/business-place-lookup'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ placeId }),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
}

/**
 * @param {object} params
 * @param {string} idToken Firebase ID token after phone (+ email link) auth
 */
export async function finalizeBusinessSignup(params, idToken) {
    const res = await fetch(resolveApiUrl('/api/complete-business-signup'), {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify(params),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
}
