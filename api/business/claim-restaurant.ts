/**
 * POST /api/business/claim-restaurant
 * Body: { restaurantId, standardizedPhone, email }
 * Requires Firebase ID token (phone auth). Runs ownership transaction on restaurants/{id}.
 */
import { applyApiCors, handleCorsPreflight } from '../_cors.js';
import { requireAuth } from '../_auth.js';
import { isValidE164 } from '../_phoneUtils.js';
import { completeBusinessPhoneSignup } from '../_businessPhoneAccount.js';
import type { ClaimRestaurantApiError, ClaimRestaurantApiSuccess } from '../../src/types/virtualBusinessPlaceholder.js';

type VercelRequest = {
    method?: string;
    body?: unknown;
    headers: Record<string, string | string[] | undefined>;
};

type VercelResponse = {
    setHeader: (name: string, value: string) => void;
    status: (code: number) => {
        json: (body: ClaimRestaurantApiSuccess | ClaimRestaurantApiError | { message: string }) => void;
        end: () => void;
    };
};

function readJsonBody(req: VercelRequest): {
    restaurantId?: string;
    standardizedPhone?: string;
    email?: string;
} {
    if (req.body && typeof req.body === 'object') {
        return req.body as { restaurantId?: string; standardizedPhone?: string; email?: string };
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
    const standardizedPhone = String(body.standardizedPhone || '').trim();
    const email = String(body.email || authResult.claims.email || '').trim().toLowerCase();

    if (!restaurantId) {
        return res.status(400).json({
            status: 'error',
            code: 'invalid-request',
            message: 'restaurantId is required',
        });
    }

    if (!isValidE164(standardizedPhone)) {
        return res.status(400).json({
            status: 'error',
            code: 'invalid-request',
            message: 'Invalid phone number',
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
        const result = await completeBusinessPhoneSignup({
            firebaseUid: authResult.uid,
            standardizedPhone,
            email,
            businessInfo: {},
            claimBusinessId: restaurantId,
        });

        const payload: ClaimRestaurantApiSuccess = {
            status: 'ok',
            uid: result.uid,
            restaurantId,
            flow: 'claim',
        };
        return res.status(200).json(payload);
    } catch (err) {
        const code = err && typeof err === 'object' && 'code' in err ? String((err as { code?: string }).code) : '';
        if (code === 'already-claimed' || code === 'phone-already-in-use') {
            return res.status(409).json({
                status: 'error',
                code,
                message: err instanceof Error ? err.message : 'Already claimed',
            });
        }
        if (code === 'phone-mismatch' || code === 'restaurant-not-found' || code === 'invalid-request') {
            return res.status(400).json({
                status: 'error',
                code,
                message: err instanceof Error ? err.message : 'Invalid claim request',
            });
        }
        console.error('[claim-restaurant]', err);
        return res.status(500).json({
            status: 'error',
            code: 'server-error',
            message: 'Failed to claim business',
        });
    }
}
