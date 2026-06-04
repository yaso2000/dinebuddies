/** @deprecated Use POST /api/auth/login-resolver { action: 'login'|'reset', identifier } */
import { takeRateLimit } from '../_rateLimit.js';
import { getRequestClientIp } from '../_recaptcha.js';
import { resolveBusinessLoginIdentifier, UNIFIED_AUTH_ERROR_AR } from '../_loginResolverCore.js';

function readJsonBody(req) {
    if (req.body && typeof req.body === 'object') return req.body;
    return {};
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    const ip = getRequestClientIp(req);
    const rl = takeRateLimit(req, {
        key: 'resolve-business-login',
        limit: 30,
        windowMs: 60 * 60 * 1000,
        identifier: ip,
    });
    if (!rl.ok) {
        res.setHeader('Retry-After', String(rl.retryAfterSec));
        return res.status(429).json({ message: 'محاولات كثيرة. حاول لاحقاً' });
    }

    const body = readJsonBody(req);
    const identifier = String(body.identifier || body.standardizedPhone || '').trim();
    const countryCode = String(body.countryCode || '+20').trim() || '+20';

    if (!identifier) {
        return res.status(400).json({ message: 'أدخل البريد أو رقم الجوال' });
    }

    try {
        const resolved = await resolveBusinessLoginIdentifier(identifier, countryCode);
        if (resolved.status === 'error') {
            return res.status(resolved.code === 'ai-unclaimed' ? 403 : 401).json({
                loginEmail: null,
                code: resolved.code,
                message: resolved.message,
            });
        }
        return res.status(200).json({ loginEmail: resolved.loginEmail });
    } catch (err) {
        console.error('[resolve-business-login]', err);
        return res.status(500).json({ message: UNIFIED_AUTH_ERROR_AR });
    }
}
