/**
 * Place Autocomplete proxy (server-side, Places API New).
 * Minimal response fields and city bounds restriction for better cost control.
 *
 * GET /api/place-autocomplete?input=...&sessionToken=...&countryCode=sa&minLat=...&minLon=...&maxLat=...&maxLon=...
 */
const AUTOCOMPLETE_URL = 'https://places.googleapis.com/v1/places:autocomplete';
import { takeRateLimit } from './_rateLimit.js';

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
    const { input, countryCode, sessionToken, languageCode, minLat, minLon, maxLat, maxLon } = req.query;
    const key =
        process.env.GOOGLE_PLACES_API_KEY ||
        process.env.GOOGLE_MAPS_SERVER_KEY ||
        process.env.VITE_GOOGLE_MAPS_API_KEY ||
        process.env.GOOGLE_MAPS_API_KEY;
    if (!input || typeof input !== 'string' || input.trim().length < 2 || !key || !sessionToken) {
        return res.status(400).json({ error: 'Missing input/sessionToken/API key' });
    }
    try {
        const payload = {
            input: input.trim(),
            sessionToken: String(sessionToken).slice(0, 36),
            languageCode: typeof languageCode === 'string' && languageCode.trim() ? languageCode.trim() : 'ar',
            includeQueryPredictions: false,
        };
        if (countryCode && typeof countryCode === 'string') {
            payload.includedRegionCodes = [countryCode.toLowerCase().slice(0, 2)];
        }
        const loLat = Number(minLat);
        const loLon = Number(minLon);
        const hiLat = Number(maxLat);
        const hiLon = Number(maxLon);
        if (
            Number.isFinite(loLat) &&
            Number.isFinite(loLon) &&
            Number.isFinite(hiLat) &&
            Number.isFinite(hiLon)
        ) {
            payload.locationRestriction = {
                rectangle: {
                    low: { latitude: loLat, longitude: loLon },
                    high: { latitude: hiLat, longitude: hiLon },
                },
            };
        }
        const response = await fetch(AUTOCOMPLETE_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': key,
                'X-Goog-FieldMask': 'suggestions.placePrediction.placeId,suggestions.placePrediction.text.text',
            },
            body: JSON.stringify(payload),
        });
        const data = await response.json();
        res.setHeader('Access-Control-Allow-Origin', '*');
        const suggestions = Array.isArray(data?.suggestions) ? data.suggestions : [];
        if (response.ok) {
            return res.status(200).json({
                status: 'OK',
                predictions: suggestions
                    .map((s) => s?.placePrediction)
                    .filter(Boolean)
                    .map((p) => ({
                        place_id: p.placeId,
                        description: p.text?.text || '',
                        structured_formatting: {
                            main_text: p.text?.text || '',
                            secondary_text: '',
                        },
                    })),
            });
        }
        return res.status(502).json({
            status: 'ERROR',
            predictions: [],
            error: data?.error?.message || data?.error || 'Autocomplete upstream error',
        });
    } catch (err) {
        console.error('Place autocomplete error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
