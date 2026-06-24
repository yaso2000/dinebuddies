import { isValidE164 } from '../_phoneUtils.js';
import { requireAuth } from '../_auth.js';
import { completeBusinessPhoneSignup, completeBusinessEmailSignup } from '../_businessPhoneAccount.js';
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
    const standardizedPhone = String(body.standardizedPhone || '').trim();
    const email = String(body.email || authResult.claims.email || '').trim().toLowerCase();
    const claimBusinessId = body.claimBusinessId || body.businessId || null;

    if (!email) {
        return res.status(400).json({
            status: 'error',
            code: 'invalid-request',
            message: 'Email is required',
        });
    }

    const requiresPhone = Boolean(claimBusinessId || standardizedPhone);
    if (requiresPhone && !isValidE164(standardizedPhone)) {
        return res.status(400).json({
            status: 'error',
            code: 'invalid-request',
            message: 'Invalid phone number',
        });
    }

    try {
        const result = requiresPhone
            ? await completeBusinessPhoneSignup({
                  firebaseUid: authResult.uid,
                  standardizedPhone,
                  email,
                  businessInfo: body.businessInfo || {},
                  claimBusinessId,
                  referredBy: body.referredBy || null,
              })
            : await completeBusinessEmailSignup({
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
            standardizedPhone: requiresPhone ? standardizedPhone : null,
            claimedFromBusinessId: result.claimedFromBusinessId,
        });
    } catch (err) {
        const code = err && typeof err === 'object' && 'code' in err ? String(err.code) : '';
        if (code === 'phone-already-in-use') {
            return res.status(409).json({
                status: 'error',
                code: 'phone-already-in-use',
                message: 'This phone is already registered to a business',
            });
        }
        if (code === 'auth/email-already-in-use') {
            return res.status(409).json({
                status: 'error',
                code: 'auth/email-already-in-use',
                message: 'Email already in use',
            });
        }
        if (code === 'phone-mismatch' || code === 'invalid-request') {
            return res.status(400).json({
                status: 'error',
                code,
                message: 'Invalid signup session',
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
