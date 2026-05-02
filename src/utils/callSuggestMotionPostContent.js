import { getAuth } from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';
import app from '../firebase/config';

/** Must match `functions/index.js` — `suggestMotionPostContent` region. */
const FUNCTIONS_REGION = 'us-central1';

/**
 * Business motion post copy + design suggestions via callable `suggestMotionPostContent` (charges Dine Credits server-side).
 * Server loads business profile from Firestore; client sends type, prompt, tone, language, optional imageUrl.
 *
 * @param {{ type: string, prompt: string, tone: string, language: string, imageUrl?: string }} payload
 * @returns {Promise<Record<string, unknown>>} Text fields plus themeId, animation, formatSuggestion, overlayStrength, etc.
 */
export async function callSuggestMotionPostContent(payload) {
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) {
        const e = new Error('Authentication required.');
        e.code = 'functions/unauthenticated';
        throw e;
    }

    const functions = getFunctions(app, FUNCTIONS_REGION);
    const suggest = httpsCallable(functions, 'suggestMotionPostContent');
    const result = await suggest(payload);
    return result.data;
}
