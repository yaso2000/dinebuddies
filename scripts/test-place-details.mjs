import assert from 'node:assert/strict';
import handler from '../api/place-details.js';

const originalFetch = globalThis.fetch;
const originalEnv = process.env.GOOGLE_PLACES_API_KEY;
let requestedFieldMask = '';

globalThis.fetch = async (_url, options = {}) => {
    requestedFieldMask = options.headers?.['X-Goog-FieldMask'] || '';
    return {
        ok: true,
        async json() {
            return {
                id: 'place_123',
                displayName: { text: 'Coordinate Cafe' },
                formattedAddress: '1 Test Street, Sydney NSW, Australia',
                location: { latitude: -33.8688, longitude: 151.2093 },
                addressComponents: [
                    { longText: 'Sydney', shortText: 'Sydney', types: ['locality'] },
                    { longText: 'Australia', shortText: 'AU', types: ['country'] },
                ],
            };
        },
    };
};
process.env.GOOGLE_PLACES_API_KEY = 'test-key';

const response = {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(name, value) {
        this.headers[name] = value;
    },
    status(code) {
        this.statusCode = code;
        return this;
    },
    json(payload) {
        this.body = payload;
        return this;
    },
};

try {
    await handler(
        {
            method: 'GET',
            headers: { 'x-real-ip': 'place-details-test' },
            query: { placeId: 'place_123', sessionToken: 'session-token' },
        },
        response
    );

    assert.equal(response.statusCode, 200);
    assert.ok(requestedFieldMask.split(',').includes('location'), 'Place details must request geometry');
    assert.equal(response.body.lat, -33.8688);
    assert.equal(response.body.lng, 151.2093);
    assert.equal(response.body.placeId, 'place_123');
    console.log('place details coordinate assertions passed');
} finally {
    globalThis.fetch = originalFetch;
    if (originalEnv === undefined) {
        delete process.env.GOOGLE_PLACES_API_KEY;
    } else {
        process.env.GOOGLE_PLACES_API_KEY = originalEnv;
    }
}
