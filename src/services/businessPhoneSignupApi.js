import { resolveApiUrl } from '../utils/resolveApiUrl';

/**
 * @param {string} standardizedPhone E.164
 */
export async function lookupBusinessPhone(standardizedPhone) {
    const res = await fetch(resolveApiUrl('/api/business-phone-lookup'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ standardizedPhone }),
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
