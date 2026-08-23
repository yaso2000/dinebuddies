/**
 * In-app YouTube search (videos / live / music), proxied server-side so the
 * YouTube Data API key never reaches the client. The Data API's free daily
 * quota is shared across every user of the app (10,000 units/day, 100 units
 * per search call — ~100 searches/day total), so on top of the usual
 * per-user rate limit this enforces a hard daily budget cutoff and fails
 * gracefully with a distinct error code the client can turn into "search is
 * unavailable right now, paste the link instead" rather than a broken UI.
 */
const functions = require('firebase-functions');

const YOUTUBE_SEARCH_URL = 'https://www.googleapis.com/youtube/v3/search';
const DAILY_BUDGET_CAP = 90;
const MAX_RESULTS = 25;
const VALID_FILTERS = new Set(['all', 'live', 'music']);
const MUSIC_CATEGORY_ID = '10';

function asTrimmedString(v) {
    return typeof v === 'string' ? v.trim() : '';
}

async function reserveDailySearchBudget(db, admin) {
    const dayKey = new Date().toISOString().slice(0, 10);
    const ref = db.collection('_rate_limits').doc(`youtube_search_daily_${dayKey}`);
    await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        const count = snap.exists ? Number(snap.data()?.count || 0) : 0;
        if (count >= DAILY_BUDGET_CAP) {
            throw new functions.https.HttpsError(
                'resource-exhausted',
                'daily_search_budget_exhausted'
            );
        }
        tx.set(
            ref,
            { count: count + 1, updatedAt: admin.firestore.FieldValue.serverTimestamp() },
            { merge: true }
        );
    });
}

function registerYoutubeSearch(exportsObj, { db, admin, enforceCallableRateLimit }) {
    exportsObj.searchYoutube = functions.https.onCall(async (data, context) => {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'Authentication required.');
        }
        const uid = context.auth.uid;

        const query = asTrimmedString(data?.query).slice(0, 100);
        if (!query) {
            throw new functions.https.HttpsError('invalid-argument', 'query is required.');
        }
        const filter = VALID_FILTERS.has(data?.filter) ? data.filter : 'all';

        await enforceCallableRateLimit(uid, 'search_youtube', {
            perMinute: 6,
            perHour: 30,
            cooldownMs: 1000,
        });

        const apiKey = process.env.YOUTUBE_API_KEY;
        if (!apiKey) {
            throw new functions.https.HttpsError('failed-precondition', 'YouTube search is not configured.');
        }

        await reserveDailySearchBudget(db, admin);

        const params = new URLSearchParams({
            key: apiKey,
            part: 'snippet',
            type: 'video',
            maxResults: String(MAX_RESULTS),
            q: query,
            safeSearch: 'moderate',
        });
        if (filter === 'live') {
            params.set('eventType', 'live');
        } else if (filter === 'music') {
            params.set('videoCategoryId', MUSIC_CATEGORY_ID);
        }

        let response;
        try {
            response = await fetch(`${YOUTUBE_SEARCH_URL}?${params.toString()}`);
        } catch (err) {
            throw new functions.https.HttpsError('unavailable', 'Could not reach YouTube.');
        }

        let body;
        try {
            body = await response.json();
        } catch {
            throw new functions.https.HttpsError('internal', 'Invalid response from YouTube.');
        }

        if (!response.ok) {
            const message = body?.error?.message || `HTTP ${response.status}`;
            throw new functions.https.HttpsError('internal', `YouTube search failed: ${message}`);
        }

        const items = Array.isArray(body.items) ? body.items : [];
        const results = items
            .filter((item) => item?.id?.videoId)
            .map((item) => ({
                id: item.id.videoId,
                title: item.snippet?.title || '',
                channelTitle: item.snippet?.channelTitle || '',
                thumbnailUrl:
                    item.snippet?.thumbnails?.medium?.url ||
                    item.snippet?.thumbnails?.default?.url ||
                    '',
                isLive: item.snippet?.liveBroadcastContent === 'live',
                publishedAt: item.snippet?.publishedAt || null,
            }));

        return { results };
    });
}

module.exports = { registerYoutubeSearch };
