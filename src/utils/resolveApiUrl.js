const PRODUCTION_API_ORIGIN = 'https://www.dinebuddies.com';

/**
 * Resolve `/api/...` for fetch in browser (same-origin prod, proxied or absolute in dev).
 * @param {string} path must start with /
 */
export function resolveApiUrl(path) {
    const p = String(path || '').startsWith('/') ? path : `/${path}`;
    const custom = String(import.meta.env.VITE_API_ORIGIN || '').trim().replace(/\/$/, '');
    if (custom) return `${custom}${p}`;
    if (import.meta.env.DEV) return p;
    return p;
}

export { PRODUCTION_API_ORIGIN };
