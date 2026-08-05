/**
 * GET /api/business/google-claim/callback?code=...&state=...
 * OAuth redirect handler — exchanges code, stores tokens, redirects back to the app.
 */
import {
    exchangeGoogleBusinessAuthCode,
    resolveGoogleBusinessOAuthRedirectUri,
} from '../../_googleBusinessProfileOAuth.js';
import {
    loadGoogleBusinessClaimSession,
    storeGoogleBusinessClaimTokens,
} from '../../_googleBusinessClaimSessions.js';

type VercelRequest = {
    method?: string;
    query?: Record<string, string | string[] | undefined>;
    headers: Record<string, string | string[] | undefined>;
};

type VercelResponse = {
    setHeader: (name: string, value: string) => void;
    status: (code: number) => { send: (body: string) => void; end: () => void };
};

function readQueryParam(value: string | string[] | undefined) {
    if (Array.isArray(value)) return String(value[0] || '').trim();
    return String(value || '').trim();
}

function resolveAppOrigin(req: VercelRequest) {
    const fromEnv = String(process.env.VITE_PUBLIC_APP_URL || process.env.PUBLIC_APP_URL || '').trim();
    if (fromEnv) return fromEnv.replace(/\/$/, '');
    const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').trim();
    const proto = String(req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim();
    return host ? `${proto}://${host}` : 'https://www.dinebuddies.com';
}

function buildReturnRedirect(
    origin: string,
    returnPath: string,
    params: Record<string, string>,
) {
    const basePath = returnPath.startsWith('/') ? returnPath : `/${returnPath}`;
    const url = new URL(`${origin}${basePath}`);
    for (const [key, value] of Object.entries(params)) {
        url.searchParams.set(key, value);
    }
    return url.toString();
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return res.status(405).send('Method Not Allowed');
    }

    const error = readQueryParam(req.query?.error);
    const sessionId = readQueryParam(req.query?.state);
    const code = readQueryParam(req.query?.code);
    const origin = resolveAppOrigin(req);

    const session = sessionId ? await loadGoogleBusinessClaimSession(sessionId) : null;
    const returnPath = session?.returnPath || '/';

    if (error) {
        const redirect = buildReturnRedirect(origin, returnPath, {
            gbpClaim: 'error',
            gbpError: error,
            gbpSession: sessionId,
        });
        res.setHeader('Location', redirect);
        return res.status(302).end();
    }

    if (!sessionId || !code) {
        const redirect = buildReturnRedirect(origin, returnPath, {
            gbpClaim: 'error',
            gbpError: 'missing_code',
        });
        res.setHeader('Location', redirect);
        return res.status(302).end();
    }

    if (!session) {
        const redirect = buildReturnRedirect(origin, returnPath, {
            gbpClaim: 'error',
            gbpError: 'session_expired',
            gbpSession: sessionId,
        });
        res.setHeader('Location', redirect);
        return res.status(302).end();
    }

    try {
        const redirectUri = resolveGoogleBusinessOAuthRedirectUri(req);
        const tokens = await exchangeGoogleBusinessAuthCode(code, redirectUri);
        await storeGoogleBusinessClaimTokens(sessionId, tokens);

        const redirect = buildReturnRedirect(origin, session.returnPath, {
            gbpClaim: 'connected',
            gbpSession: sessionId,
        });
        res.setHeader('Location', redirect);
        return res.status(302).end();
    } catch (err) {
        console.error('[google-claim/callback]', err);
        const redirect = buildReturnRedirect(origin, session.returnPath, {
            gbpClaim: 'error',
            gbpError: 'token_exchange_failed',
            gbpSession: sessionId,
        });
        res.setHeader('Location', redirect);
        return res.status(302).end();
    }
}
