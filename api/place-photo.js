/**
 * Fetch Place Photo from Google Places API (server-side, no CORS).
 * Use when client has PhotoService URLs that return 403 when proxied.
 *
 * GET /api/place-photo?placeId=ChIJ...&index=0
 * Returns: image binary (or 404/500)
 */
const PLACES_DETAILS = 'https://maps.googleapis.com/maps/api/place/details/json';
const PLACES_PHOTO = 'https://maps.googleapis.com/maps/api/place/photo';

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return res.status(405).json({ error: 'Method not allowed' });
    }
    const { placeId, index = '0' } = req.query;
    const key = process.env.VITE_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
    if (!placeId || !key) {
        return res.status(400).json({ error: 'Missing placeId or API key' });
    }
    const idx = Math.max(0, parseInt(index, 10) || 0);
    try {
        const detailsRes = await fetch(
            `${PLACES_DETAILS}?place_id=${encodeURIComponent(placeId)}&fields=photos&key=${key}`
        );
        const details = await detailsRes.json();
        if (details.status !== 'OK' || !details.result?.photos?.length) {
            return res.status(404).json({ error: 'No photos found' });
        }
        const photo = details.result.photos[idx] || details.result.photos[0];
        const ref = photo?.photo_reference;
        if (!ref) return res.status(404).json({ error: 'No photo reference' });
        const photoUrl = `${PLACES_PHOTO}?maxwidth=1200&photo_reference=${encodeURIComponent(ref)}&key=${key}`;
        const imgRes = await fetch(photoUrl, { redirect: 'follow' });
        if (!imgRes.ok) {
            return res.status(502).json({ error: 'Failed to fetch photo from Google' });
        }
        const contentType = imgRes.headers.get('content-type') || 'image/jpeg';
        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'public, max-age=86400');
        res.setHeader('Access-Control-Allow-Origin', '*');
        const buffer = await imgRes.arrayBuffer();
        return res.status(200).send(Buffer.from(buffer));
    } catch (err) {
        console.error('Place photo error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
