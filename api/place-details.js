/**
 * Place Details proxy (server-side, Places API New).
 * Returns minimal fields only to reduce billable payload.
 *
 * GET /api/place-details?placeId=ChIJ...&sessionToken=...
 */
const DETAILS_URL = 'https://places.googleapis.com/v1/places';
import { takeRateLimit } from './_rateLimit.js';

function parseAddressComponents(components) {
    let city = '';
    let country = '';
    let countryCode = '';
    if (Array.isArray(components)) {
        for (const c of components) {
            const types = Array.isArray(c.types) ? c.types : [];
            if (types.includes('locality')) city = c.longText || c.shortText || '';
            if (types.includes('administrative_area_level_1') && !city) city = c.longText || c.shortText || '';
            if (types.includes('country')) {
                country = c.longText || c.shortText || '';
                countryCode = (c.shortText || '').toUpperCase().slice(0, 2);
            }
        }
    }
    return { city, country, countryCode };
}

export default async function handler(req, res) {
    const rl = takeRateLimit(req, {
        key: 'place-details',
        limit: 12,
        windowMs: 60_000,
    });
    res.setHeader('X-RateLimit-Limit', '12');
    res.setHeader('X-RateLimit-Remaining', String(rl.remaining));
    res.setHeader('X-RateLimit-Reset', String(rl.resetAt));
    if (!rl.ok) {
        res.setHeader('Retry-After', String(rl.retryAfterSec));
        return res.status(429).json({
            error: 'Too many detail requests. Please wait a bit.',
        });
    }

    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return res.status(405).json({ error: 'Method not allowed' });
    }
    const { placeId, sessionToken, languageCode, regionCode } = req.query;
    const key =
        process.env.GOOGLE_PLACES_API_KEY ||
        process.env.GOOGLE_MAPS_SERVER_KEY ||
        process.env.VITE_GOOGLE_MAPS_API_KEY ||
        process.env.GOOGLE_MAPS_API_KEY;
    if (!placeId || !key || !sessionToken) {
        return res.status(400).json({ error: 'Missing placeId/sessionToken/API key' });
    }
    const fields = 'id,displayName,formattedAddress,addressComponents';
    try {
        const params = new URLSearchParams({
            sessionToken: String(sessionToken).slice(0, 36),
        });
        if (typeof languageCode === 'string' && languageCode.trim()) params.set('languageCode', languageCode.trim());
        if (typeof regionCode === 'string' && regionCode.trim()) params.set('regionCode', regionCode.trim());

        const url = `${DETAILS_URL}/${encodeURIComponent(placeId)}?${params.toString()}`;
        const response = await fetch(url, {
            headers: {
                'X-Goog-Api-Key': key,
                'X-Goog-FieldMask': fields,
            },
        });
        const data = await response.json();
        res.setHeader('Access-Control-Allow-Origin', '*');
        if (!response.ok || !data) {
            return res.status(400).json({ error: 'Not found' });
        }
        const place = data;
        const { city, country, countryCode } = parseAddressComponents(place.addressComponents || []);
        return res.status(200).json({
            businessName: place.displayName?.text || '',
            address: place.formattedAddress || '',
            city,
            country,
            countryCode: countryCode || 'AU',
            lat: null,
            lng: null,
            placeId: place.id || placeId,
            phone: '',
            website: '',
            description: '',
            coverImage: null,
            logo: null,
            gallery: [],
            workingHours: null,
            types: [],
            addressComponents: place.addressComponents || [],
        });
    } catch (err) {
        console.error('Place details error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
