/**
 * Google OAuth 2.0 for Business Profile (scope: business.manage).
 * Separate from Firebase Google sign-in — requires a dedicated OAuth client in Google Cloud.
 */

export const GOOGLE_BUSINESS_OAUTH_SCOPE = 'https://www.googleapis.com/auth/business.manage';

const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';

/**
 * @returns {{ clientId: string, clientSecret: string }}
 */
export function getGoogleBusinessOAuthCredentials() {
    const clientId = String(
        process.env.GOOGLE_BUSINESS_OAUTH_CLIENT_ID ||
            process.env.GOOGLE_OAUTH_CLIENT_ID ||
            '',
    ).trim();
    const clientSecret = String(
        process.env.GOOGLE_BUSINESS_OAUTH_CLIENT_SECRET ||
            process.env.GOOGLE_OAUTH_CLIENT_SECRET ||
            '',
    ).trim();
    if (!clientId || !clientSecret) {
        throw Object.assign(new Error('GOOGLE_BUSINESS_OAUTH_NOT_CONFIGURED'), {
            code: 'oauth-not-configured',
        });
    }
    return { clientId, clientSecret };
}

/**
 * @param {import('http').IncomingMessage & { headers?: Record<string, string | string[] | undefined> }} [req]
 */
export function resolveGoogleBusinessOAuthRedirectUri(req) {
    const fromEnv = String(process.env.GOOGLE_BUSINESS_OAUTH_REDIRECT_URI || '').trim();
    if (fromEnv) return fromEnv;
    if (!req?.headers) {
        throw Object.assign(new Error('GOOGLE_BUSINESS_OAUTH_REDIRECT_URI_REQUIRED'), {
            code: 'oauth-not-configured',
        });
    }
    const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').trim();
    const proto = String(req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim();
    if (!host) {
        throw Object.assign(new Error('GOOGLE_BUSINESS_OAUTH_REDIRECT_URI_REQUIRED'), {
            code: 'oauth-not-configured',
        });
    }
    return `${proto}://${host}/api/business/google-claim/callback`;
}

/**
 * @param {{ state: string, redirectUri: string, loginHint?: string }} input
 */
export function buildGoogleBusinessAuthorizationUrl(input) {
    const { clientId } = getGoogleBusinessOAuthCredentials();
    const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: input.redirectUri,
        response_type: 'code',
        scope: GOOGLE_BUSINESS_OAUTH_SCOPE,
        access_type: 'offline',
        include_granted_scopes: 'true',
        prompt: 'consent',
        state: input.state,
    });
    if (input.loginHint) {
        params.set('login_hint', input.loginHint);
    }
    return `${AUTH_ENDPOINT}?${params.toString()}`;
}

/**
 * @param {string} code
 * @param {string} redirectUri
 * @returns {Promise<{ accessToken: string, refreshToken: string | null, expiresIn: number | null, scope: string | null }>}
 */
export async function exchangeGoogleBusinessAuthCode(code, redirectUri) {
    const { clientId, clientSecret } = getGoogleBusinessOAuthCredentials();
    const body = new URLSearchParams({
        code: String(code || '').trim(),
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
    });

    const res = await fetch(TOKEN_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        const message =
            (data && typeof data === 'object' && 'error_description' in data
                ? String(data.error_description)
                : '') ||
            (data && typeof data === 'object' && 'error' in data ? String(data.error) : '') ||
            'Token exchange failed';
        throw Object.assign(new Error(message), { code: 'oauth-token-exchange-failed', status: res.status });
    }

    return {
        accessToken: String(data.access_token || ''),
        refreshToken: data.refresh_token ? String(data.refresh_token) : null,
        expiresIn: Number.isFinite(Number(data.expires_in)) ? Number(data.expires_in) : null,
        scope: data.scope ? String(data.scope) : null,
    };
}

/**
 * @param {string} refreshToken
 */
export async function refreshGoogleBusinessAccessToken(refreshToken) {
    const { clientId, clientSecret } = getGoogleBusinessOAuthCredentials();
    const body = new URLSearchParams({
        refresh_token: String(refreshToken || '').trim(),
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'refresh_token',
    });

    const res = await fetch(TOKEN_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw Object.assign(new Error('Failed to refresh Google Business access token'), {
            code: 'oauth-token-refresh-failed',
        });
    }
    return {
        accessToken: String(data.access_token || ''),
        expiresIn: Number.isFinite(Number(data.expires_in)) ? Number(data.expires_in) : null,
        scope: data.scope ? String(data.scope) : null,
    };
}
