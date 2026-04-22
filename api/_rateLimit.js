/**
 * Lightweight in-memory rate limiter for Vercel serverless routes.
 * Best-effort protection: limits requests per IP + route in a time window.
 */

const buckets = new Map();

function getClientIp(req) {
    const xf = req.headers['x-forwarded-for'];
    if (typeof xf === 'string' && xf.trim()) return xf.split(',')[0].trim();
    const xr = req.headers['x-real-ip'];
    if (typeof xr === 'string' && xr.trim()) return xr.trim();
    return 'unknown';
}

function pruneExpired(nowMs) {
    for (const [k, v] of buckets.entries()) {
        if (v.resetAt <= nowMs) buckets.delete(k);
    }
}

/**
 * @param {import('http').IncomingMessage & { headers: Record<string, string | string[] | undefined> }} req
 * @param {{ key: string, limit: number, windowMs: number }} opts
 */
export function takeRateLimit(req, opts) {
    const now = Date.now();
    pruneExpired(now);

    const ip = getClientIp(req);
    const rk = `${opts.key}:${ip}`;
    const existing = buckets.get(rk);

    if (!existing || existing.resetAt <= now) {
        const next = { count: 1, resetAt: now + opts.windowMs };
        buckets.set(rk, next);
        return {
            ok: true,
            remaining: Math.max(0, opts.limit - 1),
            resetAt: next.resetAt,
            retryAfterSec: Math.ceil(opts.windowMs / 1000),
        };
    }

    if (existing.count >= opts.limit) {
        return {
            ok: false,
            remaining: 0,
            resetAt: existing.resetAt,
            retryAfterSec: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
        };
    }

    existing.count += 1;
    return {
        ok: true,
        remaining: Math.max(0, opts.limit - existing.count),
        resetAt: existing.resetAt,
        retryAfterSec: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
}

