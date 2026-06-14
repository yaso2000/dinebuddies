/**
 * Place Autocomplete proxy (server-side, Places API New).
 * GET /api/place-autocomplete?input=...&sessionToken=...&countryCode=au&minLat=...&businessOnly=1
 */
import { takeRateLimit } from './_rateLimit.js';
import { fetchPlaceAutocompleteWithFallback } from './_googlePlacesAutocompleteCore.js';

export default async function handler(req, res) {
    const rl = takeRateLimit(req, {
        key: 'place-autocomplete',
        limit: 40,
        windowMs: 60_000,
    });
    res.setHeader('X-RateLimit-Limit', '40');
    res.setHeader('X-RateLimit-Remaining', String(rl.remaining));
    res.setHeader('X-RateLimit-Reset', String(rl.resetAt));
    if (!rl.ok) {
        res.setHeader('Retry-After', String(rl.retryAfterSec));
        return res.status(429).json({
            status: 'RATE_LIMITED',
            predictions: [],
            error: 'Too many requests. Please slow down and try again.',
        });
    }

    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { input, countryCode, sessionToken, languageCode, minLat, minLon, maxLat, maxLon, lat, lng, radiusKm, businessOnly } =
        req.query;

    if (!input || typeof input !== 'string' || input.trim().length < 2 || !sessionToken) {
        return res.status(400).json({ error: 'Missing input (min 2 chars) or sessionToken' });
    }

    try {
        const result = await fetchPlaceAutocompleteWithFallback({
            input: input.trim(),
            sessionToken: String(sessionToken),
            languageCode: typeof languageCode === 'string' ? languageCode : 'en',
            countryCode: typeof countryCode === 'string' ? countryCode : '',
            minLat,
            minLon,
            maxLat,
            maxLon,
            centerLat: lat,
            centerLng: lng,
            radiusMeters: radiusKm != null ? Number(radiusKm) * 1000 : undefined,
            businessOnly: businessOnly === '1' || businessOnly === 'true',
        });

        res.setHeader('Access-Control-Allow-Origin', '*');

        if (!result.ok) {
            return res.status(result.status === 503 ? 503 : 502).json({
                status: 'ERROR',
                predictions: [],
                error: result.errorMessage || 'Autocomplete upstream error',
            });
        }

        return res.status(200).json({
            status: result.predictions.length ? 'OK' : 'ZERO_RESULTS',
            predictions: result.predictions,
            ...(result.errorMessage && !result.predictions.length
                ? { hint: result.errorMessage }
                : {}),
        });
    } catch (err) {
        console.error('Place autocomplete error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
