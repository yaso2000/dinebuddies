import { getAuth } from 'firebase/auth';

/**
 * AI headline suggestions via POST /api/generate-image (mode: headline_suggestions, Gemini only).
 * Local dev: set `VITE_DEV_VERCEL_API_ORIGIN` and use the Vite proxy, or run `vercel dev`.
 *
 * @param {Record<string, unknown>} payload — same shape as `buildInvitationAiPayload`
 * @returns {Promise<{ data: { suggestions: string[], creditsCharged?: number } }>}
 */
export async function callSuggestInvitationMessages(payload) {
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) {
        const e = new Error('Authentication required.');
        e.code = 'functions/unauthenticated';
        throw e;
    }
    const token = await user.getIdToken();

    const res = await fetch('/api/generate-image', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
            mode: 'headline_suggestions',
            ...(payload && typeof payload === 'object' ? payload : {}),
        }),
    });

    let json = {};
    try {
        json = await res.json();
    } catch {
        json = {};
    }

    if (!res.ok) {
        const e = new Error(json.message || json.error || `Request failed (${res.status})`);
        e.code = json.code || `http_${res.status}`;
        e.status = res.status;
        e.details = json;
        throw e;
    }

    return { data: json };
}
