/**
 * Build public referral URLs for affiliate agents (Phase 2).
 * Prefer VITE_PUBLIC_APP_URL in production so links match the canonical domain.
 */

export function getAppOrigin() {
    const env =
        typeof import.meta !== 'undefined' &&
        import.meta.env &&
        import.meta.env.VITE_PUBLIC_APP_URL;
    if (env && String(env).trim()) {
        return String(env).trim().replace(/\/+$/, '');
    }
    if (typeof window !== 'undefined' && window.location?.origin) {
        return window.location.origin;
    }
    return '';
}

/** Canonical host for shared invite links (matches Cloud Function PUBLIC_APP_ORIGIN). */
export function getCanonicalReferralAppOrigin() {
    const env =
        typeof import.meta !== 'undefined' &&
        import.meta.env &&
        import.meta.env.VITE_PUBLIC_APP_URL;
    if (env && String(env).trim()) {
        return String(env).trim().replace(/\/+$/, '');
    }
    return 'https://dinebuddies.com';
}

/**
 * @param {string} agentCode — e.g. AGENT-X7K2M (stored on users.referral_code)
 * @returns {string} Full URL with /join?ref=…
 */
export function getReferralLink(agentCode) {
    const base = getCanonicalReferralAppOrigin();
    const code = String(agentCode || '').trim().toUpperCase();
    const path = code ? `/join?ref=${encodeURIComponent(code)}` : '/join';
    if (base) return `${base}${path}`;
    return path;
}
