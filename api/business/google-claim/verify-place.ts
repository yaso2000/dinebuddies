/**
 * POST /api/business/google-claim/verify-place
 * Body: { sessionId, placeId? }
 * Uses stored OAuth tokens to confirm the user manages the target Google Place ID.
 */
import { applyApiCors, handleCorsPreflight } from '../../_cors.js';
import { takeRateLimit } from '../../_rateLimit.js';
import { userManagesGooglePlace } from '../../_googleBusinessProfileLocations.js';
import {
    loadGoogleBusinessClaimSession,
    markGoogleBusinessClaimVerified,
} from '../../_googleBusinessClaimSessions.js';

type VercelRequest = {
    method?: string;
    body?: unknown;
    headers: Record<string, string | string[] | undefined>;
};

type VercelResponse = {
    setHeader: (name: string, value: string) => void;
    status: (code: number) => { json: (body: unknown) => void; end: () => void };
};

function readJsonBody(req: VercelRequest): { sessionId?: string; placeId?: string } {
    if (req.body && typeof req.body === 'object') {
        return req.body as { sessionId?: string; placeId?: string };
    }
    return {};
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    applyApiCors(req, res);
    if (handleCorsPreflight(req, res)) return;

    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    const rl = takeRateLimit(req, { key: 'google-claim-verify', limit: 30, windowMs: 60 * 60 * 1000 });
    if (!rl.ok) {
        res.setHeader('Retry-After', String(rl.retryAfterSec));
        return res.status(429).json({ status: 'error', code: 'rate-limited', message: 'Too many requests' });
    }

    const body = readJsonBody(req);
    const sessionId = String(body.sessionId || '').trim();
    if (!sessionId) {
        return res.status(400).json({
            status: 'error',
            code: 'invalid-request',
            message: 'sessionId is required',
        });
    }

    const session = await loadGoogleBusinessClaimSession(sessionId);
    if (!session) {
        return res.status(404).json({
            status: 'error',
            code: 'session-not-found',
            message: 'Verification session expired or not found',
        });
    }

    if (!session.accessToken) {
        return res.status(400).json({
            status: 'error',
            code: 'session-not-authenticated',
            message: 'Complete Google sign-in first',
        });
    }

    const placeId = String(body.placeId || session.googlePlaceId || session.restaurantId || '').trim();
    if (!placeId) {
        return res.status(400).json({
            status: 'error',
            code: 'invalid-request',
            message: 'placeId is required',
        });
    }

    try {
        const result = await userManagesGooglePlace(session.accessToken, placeId);

        if (result.managed && result.matchedLocation) {
            await markGoogleBusinessClaimVerified(sessionId, {
                placeId,
                matchedLocationName: result.matchedLocation.name,
                matchedLocationTitle: result.matchedLocation.title,
            });
        }

        return res.status(200).json({
            status: 'ok',
            managed: result.managed,
            placeId,
            matchedLocation: result.matchedLocation,
            locationCount: result.locations.length,
        });
    } catch (err) {
        console.error('[google-claim/verify-place]', err);
        return res.status(502).json({
            status: 'error',
            code: 'gbp-api-error',
            message: err instanceof Error ? err.message : 'Google Business Profile API failed',
        });
    }
}
