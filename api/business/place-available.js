/**
 * POST /api/business/place-available
 * Body: { placeId }   Header: Authorization: Bearer <firebase idToken>
 *
 * Enforces "one owner per Google place" for the business ONBOARDING/completion
 * page (which otherwise writes client-side with no collision check). Returns
 * whether the caller may take this Google placeId:
 *   - taken by ANOTHER user's business        → { available:false, reason:'taken' }
 *   - an admin-imported restaurants/{id} doc  → { available:false, reason:'imported', restaurantId }
 *   - free, or already the caller's own place  → { available:true }
 */
import { requireAuth } from '../_auth.js';
import { findExistingByGooglePlaceId } from '../_virtualBusinessIngest.js';
import { applyApiCors, handleCorsPreflight } from '../_cors.js';

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
    const uid = authResult.uid;

    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const placeId = String(body.placeId || '').trim();
    if (!placeId) {
        // No place chosen — nothing to collide with.
        return res.status(200).json({ status: 'ok', available: true });
    }

    try {
        const found = await findExistingByGooglePlaceId(placeId);
        if (!found) {
            return res.status(200).json({ status: 'ok', available: true });
        }
        if (found.collection === 'restaurants') {
            return res.status(200).json({
                status: 'ok',
                available: false,
                reason: 'imported',
                restaurantId: found.doc.id,
            });
        }
        // found in users — a business already created for this place
        if (found.doc.id === uid) {
            // The caller's own place — fine to keep editing.
            return res.status(200).json({ status: 'ok', available: true });
        }
        return res.status(200).json({ status: 'ok', available: false, reason: 'taken' });
    } catch (err) {
        console.error('[place-available]', err);
        // Fail OPEN would allow a hijack; fail CLOSED blocks a legit user. Prefer to
        // surface an error so the client can retry rather than silently allowing.
        return res.status(502).json({
            status: 'error',
            code: 'lookup-failed',
            message: 'Could not check this Google listing. Please try again.',
        });
    }
}
