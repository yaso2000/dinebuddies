/**
 * Same-origin proxy for Firebase Callable `suggestInvitationMessages`.
 * Browsers often hit CORS/preflight failures calling *.cloudfunctions.net directly;
 * this route runs on the web origin (Vercel) and forwards server-to-server (no CORS).
 *
 * POST /api/suggest-invitation-messages
 * Headers: Authorization: Bearer <Firebase ID token>
 * Body: { "data": <payload> } (Firebase callable shape)
 *
 * Env:
 * - VITE_FIREBASE_PROJECT_ID or FIREBASE_PROJECT_ID (default: dinebuddies)
 * - FIREBASE_FUNCTIONS_REGION (default: us-central1)
 * - SUGGEST_INVITATION_MESSAGES_URL — optional full override for Gen2 Cloud Run URL
 */

function callableUrl() {
    if (process.env.SUGGEST_INVITATION_MESSAGES_URL) {
        return String(process.env.SUGGEST_INVITATION_MESSAGES_URL).trim();
    }
    const project =
        process.env.VITE_FIREBASE_PROJECT_ID ||
        process.env.FIREBASE_PROJECT_ID ||
        'dinebuddies';
    const region = process.env.FIREBASE_FUNCTIONS_REGION || 'us-central1';
    return `https://${region}-${project}.cloudfunctions.net/suggestInvitationMessages`;
}

function mapFirebaseErrorStatus(status) {
    const s = String(status || '').toUpperCase();
    if (s === 'UNAUTHENTICATED') return 401;
    if (s === 'INVALID_ARGUMENT') return 400;
    if (s === 'FAILED_PRECONDITION') return 412;
    if (s === 'RESOURCE_EXHAUSTED') return 429;
    return 500;
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(204).end();
    }
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST, OPTIONS');
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !String(authHeader).startsWith('Bearer ')) {
        return res.status(401).json({
            message: 'Authentication required.',
            code: 'functions/unauthenticated'
        });
    }

    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const payload = body.data !== undefined ? body.data : body;

    const url = callableUrl();
    try {
        const upstream = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: authHeader
            },
            body: JSON.stringify({ data: payload })
        });

        const text = await upstream.text();
        let json;
        try {
            json = text ? JSON.parse(text) : {};
        } catch {
            return res.status(502).json({
                message: 'Invalid response from suggestion service',
                code: 'functions/internal'
            });
        }

        if (json.error) {
            const st = json.error.status || 'INTERNAL';
            const http = mapFirebaseErrorStatus(st);
            return res.status(http).json({
                message: json.error.message || 'Suggestion service error',
                code: `functions/${String(st).toLowerCase().replace(/_/g, '-')}`
            });
        }

        if (!upstream.ok) {
            return res.status(upstream.status >= 400 ? upstream.status : 502).json({
                message: json.message || upstream.statusText || 'Upstream error',
                code: 'functions/internal'
            });
        }

        return res.status(200).json({ result: json.result });
    } catch (e) {
        console.error('[suggest-invitation-messages proxy]', e);
        return res.status(500).json({
            message: e?.message || 'Proxy error',
            code: 'functions/internal'
        });
    }
}
