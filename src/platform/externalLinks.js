/**
 * Single choke-point for leaving DineBuddies in a browser tab.
 *
 * Anti-spam policy: external http(s) opens are denied by default.
 * Explicit allow modes:
 * - business_maps: Google Maps only (paid business profile)
 * - business_delivery: delivery-app URLs on paid business profile
 * - product_share: share-sheet destinations (WhatsApp / X / Facebook / Telegram / LinkedIn)
 * - app_media: Firebase Storage / first-party media downloads
 * - system: payments / OAuth helpers / legal vendor docs (explicit)
 */

const ALLOWED_EXTERNAL_PROTOCOLS = new Set(['http:', 'https:']);

const GOOGLE_MAPS_HOSTS = new Set([
    'www.google.com',
    'google.com',
    'maps.google.com',
    'maps.app.goo.gl',
]);

const PRODUCT_SHARE_HOSTS = new Set([
    'wa.me',
    'api.whatsapp.com',
    'web.whatsapp.com',
    'www.facebook.com',
    'facebook.com',
    'm.facebook.com',
    'twitter.com',
    'www.twitter.com',
    'x.com',
    'www.x.com',
    't.me',
    'telegram.me',
    'www.linkedin.com',
    'linkedin.com',
]);

const APP_MEDIA_HOST_SUFFIXES = [
    'firebasestorage.googleapis.com',
    'firebasestorage.app',
    'appspot.com',
    'dinebuddies.com',
];

/** @typedef {'business_maps' | 'business_delivery' | 'product_share' | 'app_media' | 'system'} ExternalLinkAllow */

/**
 * @param {unknown} rawUrl
 * @returns {URL | null}
 */
export function parseExternalHttpUrl(rawUrl) {
    if (!rawUrl) return null;
    try {
        const url = new URL(String(rawUrl).trim());
        if (!ALLOWED_EXTERNAL_PROTOCOLS.has(url.protocol)) return null;
        return url;
    } catch {
        return null;
    }
}

/**
 * @param {URL} url
 */
export function isGoogleMapsUrl(url) {
    const host = String(url.hostname || '')
        .toLowerCase()
        .replace(/\.$/, '');
    if (GOOGLE_MAPS_HOSTS.has(host)) {
        if (host.includes('google.com')) {
            return url.pathname.startsWith('/maps') || url.searchParams.has('api');
        }
        return true;
    }
    return false;
}

/**
 * @param {URL} url
 */
export function isProductShareUrl(url) {
    const host = String(url.hostname || '')
        .toLowerCase()
        .replace(/\.$/, '');
    return PRODUCT_SHARE_HOSTS.has(host);
}

/**
 * @param {URL} url
 */
export function isAppMediaUrl(url) {
    const host = String(url.hostname || '')
        .toLowerCase()
        .replace(/\.$/, '');
    return APP_MEDIA_HOST_SUFFIXES.some(
        (suffix) => host === suffix || host.endsWith(`.${suffix}`)
    );
}

/**
 * @param {unknown} options
 * @returns {ExternalLinkAllow | null}
 */
function resolveAllow(options) {
    if (typeof options === 'string') return /** @type {ExternalLinkAllow} */ (options);
    if (options && typeof options === 'object') {
        return /** @type {ExternalLinkAllow | null} */ (options.allow || null);
    }
    return null;
}

/**
 * @param {unknown} rawUrl
 * @param {{ allow?: ExternalLinkAllow | null } | ExternalLinkAllow | null} [options]
 * @returns {boolean} true if a tab was opened
 */
export function openExternalUrl(rawUrl, options = null) {
    const openFn =
        typeof globalThis !== 'undefined' && typeof globalThis.open === 'function'
            ? globalThis.open
            : null;
    if (!openFn || !rawUrl) return false;

    const allow = resolveAllow(options);
    const url = parseExternalHttpUrl(rawUrl);
    if (!url) return false;
    if (!allow) return false;

    if (allow === 'business_maps') {
        if (!isGoogleMapsUrl(url)) return false;
    } else if (allow === 'business_delivery') {
        // Paid business delivery links — any http(s) URL the business saved.
    } else if (allow === 'product_share') {
        if (!isProductShareUrl(url)) return false;
    } else if (allow === 'app_media') {
        if (!isAppMediaUrl(url)) return false;
    } else if (allow === 'system') {
        // Explicit system exits (billing, OAuth helpers, legal vendor docs)
    } else {
        return false;
    }

    openFn.call(globalThis, url.href, '_blank', 'noopener,noreferrer');
    return true;
}

/** @deprecated Prefer openExternalUrl with an allow mode — always false under spam policy. */
export function canOpenArbitraryExternalUrl() {
    return false;
}
