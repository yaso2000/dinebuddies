/**
 * GET /api/business/google-claim/managed-locations?sessionId=...
 * Returns Business Profile locations for an authenticated claim session (debug / UI picker).
 */
import { applyApiCors, handleCorsPreflight } from '../../_cors.js';
import { takeRateLimit } from '../../_rateLimit.js';
import { listManagedGoogleBusinessLocations } from '../../_googleBusinessProfileLocations.js';
import { loadGoogleBusinessClaimSession } from '../../_googleBusinessClaimSessions.js';

type VercelRequest = {
    method?: string;
    query?: Record<string, string | string[] | undefined>;
    headers: Record<string, string | string[] | undefined>;
};

type VercelResponse = {
    setHeader: (name: string, value: string) => void;
    status: (code: number) => { json: (body: unknown) => void; end: () => void };
};

function readQueryParam(value: string | string[] | undefined) {
    if (Array.isArray(value)) return String(value[0] || '').trim();
    return String(value || '').trim();
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    applyApiCors(req, res);
    if (handleCorsPreflight(req, res)) return;

    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    const rl = takeRateLimit(req, { key: 'google-claim-locations', limit: 30, windowMs: 60 * 60 * 1000 });
    if (!rl.ok) {
        res.setHeader('Retry-After', String(rl.retryAfterSec));
        return res.status(429).json({ status: 'error', code: 'rate-limited', message: 'Too many requests' });
    }

    const sessionId = readQueryParam(req.query?.sessionId);
    if (!sessionId) {
        return res.status(400).json({
            status: 'error',
            code: 'invalid-request',
            message: 'sessionId is required',
        });
    }

    const session = await loadGoogleBusinessClaimSession(sessionId);
    if (!session?.accessToken) {
        return res.status(404).json({
            status: 'error',
            code: 'session-not-found',
            message: 'Verification session expired or not authenticated',
        });
    }

    try {
        const locations = await listManagedGoogleBusinessLocations(session.accessToken);
        return res.status(200).json({
            status: 'ok',
            sessionId,
            locations,
        });
    } catch (err) {
        console.error('[google-claim/managed-locations]', err);
        return res.status(502).json({
            status: 'error',
            code: 'gbp-api-error',
            message: err instanceof Error ? err.message : 'Google Business Profile API failed',
        });
    }
}
