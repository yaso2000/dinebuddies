import { getRuntime } from '../platform/runtime';
import { PRODUCTION_API_ORIGIN } from './resolveApiUrl';

/**
 * Absolute origin for building shareable/public URLs (invitation links, post
 * links, share-card link bars, image proxy calls). Inside the Capacitor native
 * app, `window.location.origin` is the local WebView host (https://localhost),
 * not the real public site, so links built from it are unreachable/wrong once
 * shared off-device — always use the production domain there instead.
 */
export function getAppOrigin() {
    if (getRuntime().isNative) return PRODUCTION_API_ORIGIN;
    if (typeof window !== 'undefined' && window.location?.origin) return window.location.origin;
    return PRODUCTION_API_ORIGIN;
}
