import { getFunctions, httpsCallable } from 'firebase/functions';
import app from '../firebase/config';

/**
 * @param {{ query: string, filter?: 'all'|'live'|'music' }} args
 * @returns {Promise<{ ok: true, results: Array<{ id: string, title: string, channelTitle: string, thumbnailUrl: string, isLive: boolean }> } | { ok: false, quotaExhausted: boolean, message: string }>}
 */
export async function searchYoutubeVideos({ query, filter = 'all' }) {
    const fn = httpsCallable(getFunctions(app, 'us-central1'), 'searchYoutube');
    try {
        const result = await fn({ query, filter });
        return { ok: true, results: result?.data?.results || [] };
    } catch (err) {
        const quotaExhausted = err?.message === 'daily_search_budget_exhausted';
        return { ok: false, quotaExhausted, message: err?.message || 'search_failed' };
    }
}

/**
 * @param {{ query: string }} args
 * @returns {Promise<string[]>}
 */
export async function getYoutubeSearchSuggestions({ query }) {
    const fn = httpsCallable(getFunctions(app, 'us-central1'), 'getYoutubeSearchSuggestions');
    try {
        const result = await fn({ query });
        return Array.isArray(result?.data?.suggestions) ? result.data.suggestions : [];
    } catch {
        return [];
    }
}
