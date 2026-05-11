/**
 * @param {string | null | undefined} raw
 * @returns {string | null} pathname-only internal path safe for post-login redirects
 */
export function sanitizeNextPath(raw) {
    if (raw == null || typeof raw !== 'string') return null;
    const t = raw.trim();
    if (!t.startsWith('/') || t.startsWith('//')) return null;
    if (/[\r\n<>]/.test(t)) return null;
    const pathOnly = t.split('?')[0].split('#')[0];
    if (!pathOnly || pathOnly.length > 200) return null;
    return pathOnly;
}
