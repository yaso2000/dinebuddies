import { requireAuth } from '../_auth.js';
import { completeBusinessEmailSignup } from '../_businessPhoneAccount.js';
import { syncUserPublicProfile } from '../_publicProfileSync.js';
import { applyApiCors, handleCorsPreflight } from '../_cors.js';

function readJsonBody(req) {
    if (req.body && typeof req.body === 'object') return req.body;
    return {};
}

export default async function handler(req, res) {
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
    const email = String(body.email || authResult.claims.email || '').trim().toLowerCase();

    if (!email) {
        return res.status(400).json({
            status: 'error',
            code: 'invalid-request',
            message: 'Email is required',
        });
    }

    try {
        // Business signup is email/password + Google-Place only (SMS/phone removed).
        const result = await completeBusinessEmailSignup({
            firebaseUid: authResult.uid,
            email,
            businessInfo: body.businessInfo || {},
            referredBy: body.referredBy || null,
        });

        try {
            await syncUserPublicProfile(result.uid);
        } catch (syncErr) {
            console.warn('[complete-business-signup] public_profiles sync:', syncErr?.message || syncErr);
        }

        return res.status(200).json({
            status: 'ok',
            uid: result.uid,
            email: result.email,
            flow: result.flow,
            claimedFromBusinessId: result.claimedFromBusinessId,
        });
    } catch (err) {
        const code = err && typeof err === 'object' && 'code' in err ? String(err.code) : '';
        if (code === 'auth/email-already-in-use') {
            return res.status(409).json({
                status: 'error',
                code: 'auth/email-already-in-use',
                message: 'Email already in use',
            });
        }
        if (code === 'invalid-request' || code === 'place-required') {
            return res.status(400).json({
                status: 'error',
                code,
                message:
                    code === 'place-required'
                        ? 'Select your Google Business listing to continue'
                        : 'Invalid signup session',
            });
        }
        if (code === 'place-claim-required') {
            return res.status(409).json({
                status: 'error',
                code,
                restaurantId: err?.restaurantId || null,
                message: 'This business is already listed. Claim it instead of creating a new account.',
            });
        }
        if (code === 'place-already-claimed') {
            return res.status(409).json({
                status: 'error',
                code,
                restaurantId: err?.restaurantId || null,
                message: 'This business has already been claimed.',
            });
        }
        console.error('[complete-business-signup]', err);
        return res.status(500).json({
            status: 'error',
            code: 'server-error',
            message: 'Failed to create business account',
        });
    }
}
