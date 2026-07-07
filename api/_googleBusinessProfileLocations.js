/**
 * Google Business Profile API — list managed locations and match by Google Place ID.
 * @see https://developers.google.com/my-business/reference/businessinformation/rest/v1/accounts.locations/list
 */

const ACCOUNTS_URL = 'https://mybusinessaccountmanagement.googleapis.com/v1/accounts';
const LOCATIONS_URL = 'https://mybusinessbusinessinformation.googleapis.com/v1';

const DEFAULT_READ_MASK = 'name,title,storeCode,metadata';

/**
 * @param {string} accessToken
 * @param {string} url
 */
async function gbpFetchJson(accessToken, url) {
    const res = await fetch(url, {
        headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/json',
        },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        const message =
            (data?.error?.message && String(data.error.message)) ||
            `Google Business Profile API error (${res.status})`;
        throw Object.assign(new Error(message), {
            code: 'gbp-api-error',
            status: res.status,
            details: data?.error || data,
        });
    }
    return data;
}

/**
 * @param {unknown} location
 * @returns {string}
 */
export function extractPlaceIdFromGbpLocation(location) {
    if (!location || typeof location !== 'object') return '';
    const meta = /** @type {{ metadata?: { placeId?: string }, placeId?: string }} */ (location).metadata;
    const fromMeta = meta?.placeId ? String(meta.placeId).trim() : '';
    if (fromMeta) return fromMeta;
    const top = /** @type {{ placeId?: string }} */ (location).placeId;
    return top ? String(top).trim() : '';
}

/**
 * @param {unknown} location
 * @param {string} placeId
 */
export function gbpLocationMatchesPlaceId(location, placeId) {
    const target = String(placeId || '').trim();
    if (!target) return false;
    const found = extractPlaceIdFromGbpLocation(location);
    return found === target;
}

/**
 * @typedef {{ name: string, title: string, storeCode: string | null, placeId: string | null, raw: Record<string, unknown> }} ManagedGbpLocation
 */

/**
 * List all locations the authenticated user can manage (direct + group-owned).
 * Uses accounts/-/locations wildcard to avoid per-account iteration.
 *
 * @param {string} accessToken
 * @returns {Promise<ManagedGbpLocation[]>}
 */
export async function listManagedGoogleBusinessLocations(accessToken) {
    const token = String(accessToken || '').trim();
    if (!token) {
        throw Object.assign(new Error('Missing Google Business access token'), { code: 'invalid-request' });
    }

    /** @type {ManagedGbpLocation[]} */
    const all = [];
    let pageToken = '';

    do {
        const params = new URLSearchParams({
            readMask: DEFAULT_READ_MASK,
            pageSize: '100',
        });
        if (pageToken) params.set('pageToken', pageToken);

        const url = `${LOCATIONS_URL}/accounts/-/locations?${params.toString()}`;
        const data = await gbpFetchJson(token, url);
        const locations = Array.isArray(data.locations) ? data.locations : [];

        for (const loc of locations) {
            if (!loc || typeof loc !== 'object') continue;
            const rec = /** @type {Record<string, unknown>} */ (loc);
            all.push({
                name: String(rec.name || ''),
                title: String(rec.title || ''),
                storeCode: rec.storeCode ? String(rec.storeCode) : null,
                placeId: extractPlaceIdFromGbpLocation(rec) || null,
                raw: rec,
            });
        }

        pageToken = data.nextPageToken ? String(data.nextPageToken) : '';
    } while (pageToken);

    return all;
}

/**
 * Optional: list GBP account names (for admin/debug).
 * @param {string} accessToken
 */
export async function listGoogleBusinessAccounts(accessToken) {
    const token = String(accessToken || '').trim();
    if (!token) {
        throw Object.assign(new Error('Missing Google Business access token'), { code: 'invalid-request' });
    }

    /** @type {Array<{ name: string, accountName: string, type: string | null }>} */
    const accounts = [];
    let pageToken = '';

    do {
        const params = new URLSearchParams({ pageSize: '20' });
        if (pageToken) params.set('pageToken', pageToken);
        const url = `${ACCOUNTS_URL}?${params.toString()}`;
        const data = await gbpFetchJson(token, url);
        const items = Array.isArray(data.accounts) ? data.accounts : [];
        for (const account of items) {
            if (!account || typeof account !== 'object') continue;
            const rec = /** @type {Record<string, unknown>} */ (account);
            accounts.push({
                name: String(rec.name || ''),
                accountName: String(rec.accountName || rec.name || ''),
                type: rec.type ? String(rec.type) : null,
            });
        }
        pageToken = data.nextPageToken ? String(data.nextPageToken) : '';
    } while (pageToken);

    return accounts;
}

/**
 * Check whether a Google Place ID appears in the user's managed Business Profile locations.
 *
 * @param {string} accessToken
 * @param {string} placeId
 * @returns {Promise<{ managed: boolean, matchedLocation: ManagedGbpLocation | null, locations: ManagedGbpLocation[] }>}
 */
export async function userManagesGooglePlace(accessToken, placeId) {
    const target = String(placeId || '').trim();
    if (!target) {
        throw Object.assign(new Error('placeId is required'), { code: 'invalid-request' });
    }

    const locations = await listManagedGoogleBusinessLocations(accessToken);
    const matchedLocation = locations.find((loc) => loc.placeId === target) || null;

    return {
        managed: Boolean(matchedLocation),
        matchedLocation,
        locations,
    };
}
