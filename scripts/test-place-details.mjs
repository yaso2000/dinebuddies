import assert from 'node:assert/strict';
import handler from '../api/place-details.js';

const originalFetch = globalThis.fetch;
const originalApiKey = process.env.GOOGLE_PLACES_API_KEY;
let requestedFieldMask;

globalThis.fetch = async (_url, options) => {
    requestedFieldMask = options.headers['X-Goog-FieldMask'];
    return {
        ok: true,
        json: async () => ({
            id: 'test-place',
            displayName: { text: 'Test Venue' },
            formattedAddress: '1 Test Street',
            addressComponents: [],
            location: {
                latitude: -33.8688,
                longitude: 151.2093,
            },
        }),
    };
};
process.env.GOOGLE_PLACES_API_KEY = 'test-key';

const response = {
    statusCode: 200,
    body: null,
    setHeader() {},
    status(code) {
        this.statusCode = code;
        return this;
    },
    json(body) {
        this.body = body;
        return this;
    },
};

try {
    await handler({
        method: 'GET',
        headers: { 'x-real-ip': `place-details-test-${Date.now()}` },
        query: {
            placeId: 'test-place',
            sessionToken: 'test-session',
        },
    }, response);

    assert.equal(response.statusCode, 200);
    assert.match(requestedFieldMask, /(?:^|,)location(?:,|$)/);
    assert.equal(response.body.lat, -33.8688);
    assert.equal(response.body.lng, 151.2093);
    console.log('Place details coordinates test passed');
} finally {
    globalThis.fetch = originalFetch;
    if (originalApiKey === undefined) {
        delete process.env.GOOGLE_PLACES_API_KEY;
    } else {
        process.env.GOOGLE_PLACES_API_KEY = originalApiKey;
    }
}
