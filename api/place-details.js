/**
 * Place Details proxy (server-side).
 * Returns full place info in the same format as fetchPlaceDetails.
 * Use when Maps JS API isn't available (e.g. referrer restrictions on production).
 *
 * GET /api/place-details?placeId=ChIJ...
 */
const DETAILS_URL = 'https://maps.googleapis.com/maps/api/place/details/json';

function parseAddressComponents(components) {
    let city = '';
    let country = '';
    let countryCode = '';
    if (Array.isArray(components)) {
        for (const c of components) {
            if (c.types?.includes('locality')) city = c.long_name || '';
            if (c.types?.includes('administrative_area_level_1') && !city) city = c.long_name || '';
            if (c.types?.includes('country')) {
                country = c.long_name || '';
                countryCode = (c.short_name || '').toUpperCase().slice(0, 2);
            }
        }
    }
    return { city, country, countryCode };
}

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return res.status(405).json({ error: 'Method not allowed' });
    }
    const { placeId } = req.query;
    const key = process.env.VITE_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
    if (!placeId || !key) {
        return res.status(400).json({ error: 'Missing placeId or API key' });
    }
    const fields = 'name,formatted_address,address_components,geometry,place_id,formatted_phone_number,international_phone_number,website,url,photos,opening_hours,types';
    try {
        const url = `${DETAILS_URL}?place_id=${encodeURIComponent(placeId)}&fields=${fields}&key=${key}`;
        const response = await fetch(url);
        const data = await response.json();
        res.setHeader('Access-Control-Allow-Origin', '*');
        if (data.status !== 'OK' || !data.result) {
            return res.status(data.status === 'ZERO_RESULTS' ? 404 : 400).json({ error: data.status || 'Not found' });
        }
        const place = data.result;
        const { city, country, countryCode } = parseAddressComponents(place.address_components || []);
        const loc = place.geometry?.location || {};
        const lat = typeof loc.lat === 'number' ? loc.lat : null;
        const lng = typeof loc.lng === 'number' ? loc.lng : null;
        const photoUrls = [];
        if (place.photos?.length) {
            for (let i = 0; i < Math.min(place.photos.length, 10); i++) {
                photoUrls.push(`/api/place-photo?placeId=${encodeURIComponent(placeId)}&index=${i}`);
            }
        }
        let workingHours = null;
        if (place.opening_hours?.weekday_text?.length) {
            const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            workingHours = {};
            place.opening_hours.weekday_text.forEach((text, i) => {
                workingHours[days[i]] = {
                    isOpen: !String(text || '').toLowerCase().includes('closed'),
                    text: String(text || ''),
                };
            });
        }
        return res.status(200).json({
            businessName: place.name || '',
            address: place.formatted_address || '',
            city,
            country,
            countryCode: countryCode || 'AU',
            lat,
            lng,
            placeId: place.place_id || placeId,
            phone: place.formatted_phone_number || place.international_phone_number || '',
            website: place.website || place.url || '',
            description: '',
            coverImage: photoUrls[0] || null,
            logo: photoUrls[0] || null,
            gallery: photoUrls,
            workingHours,
            types: place.types || [],
        });
    } catch (err) {
        console.error('Place details error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
