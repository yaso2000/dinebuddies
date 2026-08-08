import { resolveApiUrl } from '../utils/resolveApiUrl';

/**
 * Start Google Business Profile OAuth (business.manage scope).
 * @param {{ restaurantId: string, googlePlaceId?: string, returnPath?: string }} params
 */
export async function startGoogleBusinessClaimAuth(params) {
    const res = await fetch(resolveApiUrl('/api/business/google-claim/auth-url'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
}

/**
 * Verify the user manages the target Google Place ID via stored OAuth session.
 * @param {{ sessionId: string, placeId?: string }} params
 */
export async function verifyGoogleBusinessPlace(params) {
    const res = await fetch(resolveApiUrl('/api/business/google-claim/verify-place'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            sessionId: params.sessionId,
            placeId: params.placeId,
        }),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
}

/**
 * List managed GBP locations for a session (optional UI/debug).
 * @param {string} sessionId
 */
export async function fetchGoogleBusinessManagedLocations(sessionId) {
    const q = new URLSearchParams({ sessionId: String(sessionId || '') });
    const res = await fetch(resolveApiUrl(`/api/business/google-claim/managed-locations?${q}`));
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
}

/**
 * Finalize restaurant claim after Google Business Profile verification.
 * @param {{ restaurantId: string, googleClaimSessionId: string, email: string }} params
 * @param {string} idToken Firebase ID token (email/password or Google sign-in)
 */
export async function finalizeGoogleBusinessClaim(params, idToken) {
    const res = await fetch(resolveApiUrl('/api/business/claim-restaurant-google'), {
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

/**
 * Read Google claim callback params from the current URL.
 * @param {URLSearchParams} searchParams
 */
export function readGoogleBusinessClaimCallback(searchParams) {
    const gbpClaim = searchParams.get('gbpClaim');
    const gbpSession = searchParams.get('gbpSession');
    const gbpError = searchParams.get('gbpError');
    return {
        gbpClaim,
        gbpSession: gbpSession || '',
        gbpError: gbpError || '',
        isConnected: gbpClaim === 'connected' && Boolean(gbpSession),
        isError: gbpClaim === 'error',
    };
}
