'use strict';

const functions = require('firebase-functions');

/**
 * GET /api/place-photo?placeId=ChIJ...&index=0
 * Proxies Google Place photos (Places API New, legacy fallback).
 */
exports.placePhoto = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Cache-Control', 'no-store');

    if (req.method !== 'GET') {
        res.set('Allow', 'GET');
        return res.status(405).json({ error: 'Method not allowed' });
    }
    return res.status(410).json({
        error: 'Place photo fetching is disabled.',
        code: 'PLACE_PHOTO_DISABLED',
    });
});
