/**
 * In-app YouTube search (videos / live / music), proxied server-side so the
 * YouTube Data API key never reaches the client. The Data API's free daily
 * quota is shared across every user of the app (10,000 units/day, 100 units
 * per search call — ~100 searches/day total), so on top of the usual
 * per-user rate limit this enforces a hard daily budget cutoff and fails
 * gracefully with a distinct error code the client can turn into "search is
 * unavailable right now, paste the link instead" rather than a broken UI.
 *
 * Results for non-live queries are cached in Firestore so repeated/popular
 * searches across all users are served for free without touching Google's
 * quota at all — the 90/day cap becomes ~90 *unique* queries per cache
 * window, not 90 searches total. Live results are never cached since
 * "is this stream live right now" goes stale within minutes.
 */
const functions = require('firebase-functions');
const crypto = require('node:crypto');

const YOUTUBE_SEARCH_URL = 'https://www.googleapis.com/youtube/v3/search';
const DAILY_BUDGET_CAP = 90;
const MAX_RESULTS = 25;
const VALID_FILTERS = new Set(['all', 'live', 'music']);
const MUSIC_CATEGORY_ID = '10';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function asTrimmedString(v) {
    return typeof v === 'string' ? v.trim() : '';
}

function cacheKeyFor(filter, query) {
    const normalized = query.toLowerCase().trim().replace(/\s+/g, ' ');
    return crypto.createHash('sha1').update(`${filter}:${normalized}`).digest('hex');
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

        const cacheable = filter !== 'live';
        const cacheRef = cacheable
            ? db.collection('youtube_search_cache').doc(cacheKeyFor(filter, query))
            : null;

        if (cacheRef) {
            const cacheSnap = await cacheRef.get();
            if (cacheSnap.exists) {
                const cached = cacheSnap.data();
                const cachedAtMs = cached?.cachedAt?.toMillis?.() || 0;
                if (Array.isArray(cached?.results) && Date.now() - cachedAtMs < CACHE_TTL_MS) {
                    return { results: cached.results, cached: true };
                }
            }
        }

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

        if (cacheRef) {
            cacheRef
                .set({ results, cachedAt: admin.firestore.FieldValue.serverTimestamp() })
                .catch(() => {});
        }

        return { results };
    });
}

module.exports = { registerYoutubeSearch };
