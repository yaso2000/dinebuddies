/**
 * Place Autocomplete proxy (server-side).
 * Use on production to bypass HTTP referrer restrictions - the request to Google
 * comes from Vercel, not the browser.
 *
 * GET /api/place-autocomplete?input=...&countryCode=au&lat=...&lng=...
 */
const AUTOCOMPLETE_URL = 'https://maps.googleapis.com/maps/api/place/autocomplete/json';

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return res.status(405).json({ error: 'Method not allowed' });
    }
    const { input, countryCode, lat, lng } = req.query;
    const key = process.env.VITE_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
    if (!input || typeof input !== 'string' || input.trim().length < 2 || !key) {
        return res.status(400).json({ error: 'Missing input (min 2 chars) or API key' });
    }
    try {
        const params = new URLSearchParams({
            input: input.trim(),
            types: 'establishment',
            language: 'en',
            key,
        });
        if (countryCode && typeof countryCode === 'string') {
            params.set('components', `country:${countryCode.toLowerCase().slice(0, 2)}`);
        }
        const numLat = parseFloat(lat);
        const numLng = parseFloat(lng);
        if (!isNaN(numLat) && !isNaN(numLng)) {
            params.set('location', `${numLat},${numLng}`);
            params.set('radius', '50000');
        }
        const url = `${AUTOCOMPLETE_URL}?${params.toString()}`;
        const response = await fetch(url);
        const data = await response.json();
        res.setHeader('Access-Control-Allow-Origin', '*');
        if (data.status === 'OK' && Array.isArray(data.predictions)) {
            return res.status(200).json({
                status: 'OK',
                predictions: data.predictions.map((p) => ({
                    place_id: p.place_id,
                    description: p.description,
                    structured_formatting: p.structured_formatting,
                })),
            });
        }
        if (data.status === 'ZERO_RESULTS') {
            return res.status(200).json({ status: 'ZERO_RESULTS', predictions: [] });
        }
        return res.status(200).json({ status: data.status || 'ERROR', predictions: [] });
    } catch (err) {
        console.error('Place autocomplete error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
