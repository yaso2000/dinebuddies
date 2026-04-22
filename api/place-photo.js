/**
 * Proxies Google Place photos (server-side key). Disabled in production when no server key is set.
 * GET /api/place-photo?placeId=...&index=0
 */
import { createRequire } from 'module';
import path from 'path';

const require = createRequire(import.meta.url);

/** Vercel sometimes omits `req.query`; merge query string from `req.url`. */
function readQuery(req) {
    const q = req.query && typeof req.query === 'object' ? { ...req.query } : {};
    if (!q.placeId && req.url) {
        try {
            const u = new URL(req.url, 'http://localhost');
            const pid = u.searchParams.get('placeId');
            if (pid) q.placeId = pid;
            const idx = u.searchParams.get('index');
            if (idx !== null && idx !== undefined) q.index = idx;
        } catch (_) {
            /* ignore */
        }
    }
    return q;
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-store');

    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return res.status(405).json({ error: 'Method not allowed' });
    }

    return res.status(410).json({
        error: 'Google Place photo fetching is permanently disabled for cost control.',
        code: 'PLACE_PHOTO_DISABLED'
    });
}
