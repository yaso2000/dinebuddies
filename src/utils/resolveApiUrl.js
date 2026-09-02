import { getRuntime } from '../platform/runtime';

const PRODUCTION_API_ORIGIN = 'https://www.dinebuddies.com';

/**
 * Resolve `/api/...` for fetch in browser (same-origin prod, proxied or absolute in dev).
 * @param {string} path must start with /
 */
export function resolveApiUrl(path) {
    const p = String(path || '').startsWith('/') ? path : `/${path}`;
    const custom = String(import.meta.env.VITE_API_ORIGIN || '').trim().replace(/\/$/, '');
    if (custom) return `${custom}${p}`;
    // Native (Capacitor) runs from a local origin (https://localhost), so a relative
    // `/api/...` would hit the bundled files, not the server, and every API call fails.
    // Always target the production API there.
    if (getRuntime().isNative) return `${PRODUCTION_API_ORIGIN}${p}`;
    if (import.meta.env.DEV) return p;
    return p;
}

export { PRODUCTION_API_ORIGIN };
