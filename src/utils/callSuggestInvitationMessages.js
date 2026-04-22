import { getAuth } from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';
import app from '../firebase/config';

/** Must match `functions/index.js` — `suggestInvitationMessages` region. */
const FUNCTIONS_REGION = 'us-central1';

/**
 * AI invitation message suggestions via Firebase Callable (Gen2, `cors: true`).
 * Avoids relying on `/api/suggest-invitation-messages` on the host (Firebase Hosting
 * has no API route → 502; Vercel-only routes do not run on Hosting).
 *
 * Returns `{ data }` like the callable client API.
 */
export async function callSuggestInvitationMessages(payload) {
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) {
        const e = new Error('Authentication required.');
        e.code = 'functions/unauthenticated';
        throw e;
    }

    const functions = getFunctions(app, FUNCTIONS_REGION);
    const suggest = httpsCallable(functions, 'suggestInvitationMessages');
    const result = await suggest(payload);
    return { data: result.data };
}
