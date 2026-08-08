/**
 * POST /api/business-place-lookup
 * Body: { placeId }
 * Returns whether a Google Place matches an existing restaurant listing.
 */
import { applyApiCors, handleCorsPreflight } from './_cors.js';
import { loadExistingRestaurantForImport } from './_virtualBusinessIngest.js';
import { restaurantDocIsUnclaimed } from './_restaurantClaim.js';

function readJsonBody(req) {
    if (req.body && typeof req.body === 'object') return req.body;
    return {};
}

function businessDisplayName(data, docId) {
    const d = data || {};
    const bi = d.businessInfo && typeof d.businessInfo === 'object' ? d.businessInfo : {};
    return String(d.name || d.display_name || bi.businessName || docId).trim() || docId;
}

export default async function handler(req, res) {
    applyApiCors(req, res);
    if (handleCorsPreflight(req, res)) return;

    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    const body = readJsonBody(req);
    const placeId = String(body.placeId || body.googlePlaceId || '').trim();
    if (!placeId) {
        return res.status(400).json({
            status: 'error',
            code: 'invalid-place',
            message: 'placeId is required',
        });
    }

    try {
        const existing = await loadExistingRestaurantForImport(placeId);
        if (!existing) {
            return res.status(200).json({
                status: 'new_register_flow',
                placeId,
            });
        }

        const unclaimed = restaurantDocIsUnclaimed(existing.data);
        const businessName = businessDisplayName(existing.data, existing.docId);

        if (unclaimed) {
            return res.status(200).json({
                status: 'claim_flow',
                placeId,
                restaurantId: existing.docId,
                businessName,
                isClaimed: false,
            });
        }

        return res.status(200).json({
            status: 'already_claimed',
            placeId,
            restaurantId: existing.docId,
            businessName,
            isClaimed: true,
        });
    } catch (err) {
        console.error('[business-place-lookup]', err);
        return res.status(500).json({
            status: 'error',
            code: 'server-error',
            message: 'Server error',
        });
    }
}
