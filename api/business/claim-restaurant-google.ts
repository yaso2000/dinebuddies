/**
 * POST /api/business/claim-restaurant-google
 * Body: { restaurantId, googleClaimSessionId, email }
 * Requires Firebase ID token (email auth). Claims after Google Business Profile verification.
 */
import { applyApiCors, handleCorsPreflight } from '../_cors.js';
import { requireAuth } from '../_auth.js';
import { completeBusinessGoogleClaimSignup } from '../_businessPhoneAccount.js';
import { syncUserPublicProfile } from '../_publicProfileSync.js';

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
    googleClaimSessionId?: string;
    email?: string;
} {
    if (req.body && typeof req.body === 'object') {
        return req.body as {
            restaurantId?: string;
            googleClaimSessionId?: string;
            email?: string;
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

    const authResult = await requireAuth(req);
    if (!authResult.ok) {
        return res.status(authResult.status).json({
            status: 'error',
            code: authResult.code || 'unauthorized',
            message: authResult.message || authResult.error,
        });
    }

    const body = readJsonBody(req);
    const restaurantId = String(body.restaurantId || '').trim();
    const googleClaimSessionId = String(body.googleClaimSessionId || '').trim();
    const email = String(body.email || authResult.claims.email || '').trim().toLowerCase();

    if (!restaurantId || !googleClaimSessionId) {
        return res.status(400).json({
            status: 'error',
            code: 'invalid-request',
            message: 'restaurantId and googleClaimSessionId are required',
        });
    }

    if (!email) {
        return res.status(400).json({
            status: 'error',
            code: 'invalid-request',
            message: 'Email is required',
        });
    }

    try {
        const result = await completeBusinessGoogleClaimSignup({
            firebaseUid: authResult.uid,
            email,
            restaurantId,
            googleClaimSessionId,
        });

        try {
            await syncUserPublicProfile(result.uid);
        } catch (syncErr) {
            console.warn('[claim-restaurant-google] public_profiles sync:', syncErr);
        }

        return res.status(200).json({
            status: 'ok',
            uid: result.uid,
            restaurantId,
            flow: 'claim',
            verificationMethod: 'google_business_profile',
        });
    } catch (err) {
        const code = err && typeof err === 'object' && 'code' in err ? String((err as { code?: string }).code) : '';
        if (code === 'already-claimed') {
            return res.status(409).json({
                status: 'error',
                code,
                message: err instanceof Error ? err.message : 'Already claimed',
            });
        }
        if (
            code === 'place-not-managed' ||
            code === 'place-mismatch' ||
            code === 'session-not-found' ||
            code === 'session-not-authenticated' ||
            code === 'restaurant-not-found' ||
            code === 'invalid-request'
        ) {
            return res.status(400).json({
                status: 'error',
                code,
                message: err instanceof Error ? err.message : 'Invalid claim request',
            });
        }
        console.error('[claim-restaurant-google]', err);
        return res.status(500).json({
            status: 'error',
            code: 'server-error',
            message: 'Failed to claim business',
        });
    }
}
