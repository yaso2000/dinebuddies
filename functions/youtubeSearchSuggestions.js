/**
 * Search-as-you-type suggestions for the YouTube search picker. Uses Google's
 * unofficial/undocumented "suggest" endpoint (the same one YouTube's own
 * search box calls) — it is free and does not touch the YouTube Data API's
 * billed/quota'd search.list, but it is not an officially documented or
 * supported API, so it could change or disappear without notice. Proxied
 * server-side purely to avoid a browser CORS/JSONP dance, not for a secret.
 */
const functions = require('firebase-functions');

const SUGGEST_URL = 'https://suggestqueries.google.com/complete/search';

function asTrimmedString(v) {
    return typeof v === 'string' ? v.trim() : '';
}

function registerYoutubeSearchSuggestions(exportsObj, { enforceCallableRateLimit }) {
    exportsObj.getYoutubeSearchSuggestions = functions.https.onCall(async (data, context) => {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'Authentication required.');
        }
        const uid = context.auth.uid;

        const query = asTrimmedString(data?.query).slice(0, 100);
        if (query.length < 2) {
            return { suggestions: [] };
        }

        await enforceCallableRateLimit(uid, 'youtube_search_suggestions', {
            perMinute: 30,
            perHour: 300,
            cooldownMs: 150,
        });

        const params = new URLSearchParams({ client: 'firefox', ds: 'yt', q: query });

        let response;
        try {
            response = await fetch(`${SUGGEST_URL}?${params.toString()}`);
        } catch {
            return { suggestions: [] };
        }
        if (!response.ok) {
            return { suggestions: [] };
        }

        let body;
        try {
            body = await response.json();
        } catch {
            return { suggestions: [] };
        }

        const suggestions = Array.isArray(body?.[1])
            ? body[1].filter((s) => typeof s === 'string').slice(0, 8)
            : [];
        return { suggestions };
    });
}

module.exports = { registerYoutubeSearchSuggestions };
