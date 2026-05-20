/**
 * Consumer search — single path: Cloud Function (Admin SDK on server).
 * Do not query Firestore from the browser for account search.
 */
import { getFunctions, httpsCallable } from 'firebase/functions';
import app from '../firebase/config';
import { normalizeSearchQuery } from '../utils/searchQueryNormalize';

const REGION = 'us-central1';

export async function searchAccounts(rawTerm) {
    const term = normalizeSearchQuery(rawTerm);
    if (!term) {
        return { businesses: [], users: [] };
    }

    const fn = httpsCallable(getFunctions(app, REGION), 'consumerAccountSearch');
    const { data } = await fn({ term });

    return {
        businesses: Array.isArray(data?.businesses) ? data.businesses : [],
        users: Array.isArray(data?.users) ? data.users : [],
    };
}
