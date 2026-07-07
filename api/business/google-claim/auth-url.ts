/**
 * POST /api/business/google-claim/auth-url
 * Body: { restaurantId, googlePlaceId?, returnPath? }
 * Returns Google OAuth URL (business.manage scope) to verify GBP ownership.
 */
import { applyApiCors, handleCorsPreflight } from '../../_cors.js';
import { takeRateLimit } from '../../_rateLimit.js';
import {
    buildGoogleBusinessAuthorizationUrl,
    resolveGoogleBusinessOAuthRedirectUri,
} from '../../_googleBusinessProfileOAuth.js';
import { createGoogleBusinessClaimSession } from '../../_googleBusinessClaimSessions.js';

type VercelRequest = {
    method?: string;
    body?: unknown;
    headers: Record<string, string | string[] | undefined>;
};

type VercelResponse = {
    setHeader: (name: string, value: string) => void;
    status: (code: number) => {
        json: (body: unknown) => void;
        end: () => void;
    };
};

function readJsonBody(req: VercelRequest): {
    restaurantId?: string;
    googlePlaceId?: string;
    returnPath?: string;
    firebaseUid?: string;
} {
    if (req.body && typeof req.body === 'object') {
        return req.body as {
            restaurantId?: string;
            googlePlaceId?: string;
            returnPath?: string;
            firebaseUid?: string;
        };
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

    const rl = takeRateLimit(req, { key: 'google-claim-auth-url', limit: 20, windowMs: 60 * 60 * 1000 });
    if (!rl.ok) {
        res.setHeader('Retry-After', String(rl.retryAfterSec));
        return res.status(429).json({ status: 'error', code: 'rate-limited', message: 'Too many requests' });
    }

    const body = readJsonBody(req);
    const restaurantId = String(body.restaurantId || '').trim();
    const googlePlaceId = String(body.googlePlaceId || body.restaurantId || '').trim();
    const returnPath = String(body.returnPath || `/business/${restaurantId}`).trim();

    if (!restaurantId || !googlePlaceId) {
        return res.status(400).json({
            status: 'error',
            code: 'invalid-request',
            message: 'restaurantId and googlePlaceId are required',
        });
    }

    try {
        const redirectUri = resolveGoogleBusinessOAuthRedirectUri(req);
        const { sessionId } = await createGoogleBusinessClaimSession(
            restaurantId,
            googlePlaceId,
            returnPath,
            body.firebaseUid ? String(body.firebaseUid) : null,
        );
        const authUrl = buildGoogleBusinessAuthorizationUrl({ state: sessionId, redirectUri });

        return res.status(200).json({
            status: 'ok',
            sessionId,
            authUrl,
            scope: 'https://www.googleapis.com/auth/business.manage',
        });
    } catch (err) {
        const code = err && typeof err === 'object' && 'code' in err ? String((err as { code?: string }).code) : '';
        if (code === 'oauth-not-configured') {
            return res.status(503).json({
                status: 'error',
                code,
                message: 'Google Business OAuth is not configured on the server',
            });
        }
        console.error('[google-claim/auth-url]', err);
        return res.status(500).json({
            status: 'error',
            code: 'server-error',
            message: 'Failed to start Google Business verification',
        });
    }
}
