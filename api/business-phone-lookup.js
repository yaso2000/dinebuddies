import { isValidE164 } from './_phoneUtils.js';
import { lookupBusinessPhone } from './_businessPhoneRegistry.js';
import { applyApiCors, handleCorsPreflight } from './_cors.js';

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

    const body = readJsonBody(req);
    const standardizedPhone = String(body.standardizedPhone || '').trim();

    if (!isValidE164(standardizedPhone)) {
        return res.status(400).json({
            status: 'error',
            code: 'invalid-phone',
            message: 'Invalid phone number',
        });
    }

    try {
        const lookup = await lookupBusinessPhone(standardizedPhone);

        if (lookup.flow === 'claimed') {
            return res.status(400).json({
                status: 'error',
                code: 'phone-already-in-use',
                message: 'This phone is already registered to a business',
            });
        }

        if (lookup.flow === 'claim') {
            return res.status(200).json({
                status: 'claim_flow',
                standardizedPhone,
                businessId: lookup.businessId,
                businessName: lookup.businessName || '',
                source: lookup.source || 'users',
            });
        }

        return res.status(200).json({
            status: 'new_register_flow',
            standardizedPhone,
        });
    } catch (err) {
        console.error('[business-phone-lookup]', err);
        return res.status(500).json({
            status: 'error',
            code: 'server-error',
            message: 'Server error',
        });
    }
}
