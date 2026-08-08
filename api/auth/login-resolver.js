/**
 * POST /api/auth/login-resolver
 *
 * Body: { identifier, password?, countryCode?, action?: 'login' | 'reset' }
 *
 * login (default): phone/email → resolvedEmail for client signInWithEmailAndPassword
 * reset: same resolve for sendPasswordResetEmail
 *
 * Uses Firebase Admin (not client firebase/config).
 */
import { takeRateLimit } from '../_rateLimit.js';
import { getRequestClientIp } from '../_recaptcha.js';
import {
    resolveBusinessLoginIdentifier,
    resolveBusinessPasswordReset,
    UNIFIED_AUTH_ERROR_AR,
    AI_UNCLAIMED_CODE,
} from '../_loginResolverCore.js';

function readJsonBody(req) {
    if (req.body && typeof req.body === 'object') return req.body;
    return {};
}

function successPayload(resolved, action) {
    const resolvedEmail = resolved.loginEmail;
    return {
        status: 'success',
        resolvedEmail,
        loginEmail: resolvedEmail,
        action: action || 'login',
        standardizedPhone: resolved.standardizedPhone || null,
        message: 'تم حل الهوية بنجاح، جاري تسجيل الدخول...',
    };
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    const ip = getRequestClientIp(req);
    const rl = takeRateLimit(req, {
        key: 'login-resolver',
        limit: 40,
        windowMs: 60 * 60 * 1000,
        identifier: ip,
    });
    if (!rl.ok) {
        res.setHeader('Retry-After', String(rl.retryAfterSec));
        return res.status(429).json({ message: 'محاولات كثيرة. حاول لاحقاً' });
    }

    const body = readJsonBody(req);
    const action = String(body.action || 'login').toLowerCase();
    const identifier = String(body.identifier || '').trim();
    const countryCode = String(body.countryCode || '+20').trim() || '+20';
    const password = String(body.password || '');

    if (!identifier) {
        const msg =
            action === 'reset' ? 'يرجى إدخال البريد أو رقم الجوال' : 'جميع الحقول مطلوبة';
        return res.status(400).json({ message: msg });
    }

    if (action === 'login' && !password) {
        return res.status(400).json({ message: 'جميع الحقول مطلوبة' });
    }

    try {
        if (action === 'reset') {
            const resetResult = await resolveBusinessPasswordReset(identifier, countryCode);
            return res.status(200).json({
                status: 'success',
                resolvedEmail: resetResult.loginEmail,
                loginEmail: resetResult.loginEmail,
                genericOnly: resetResult.genericOnly,
                action: 'reset',
                message: resetResult.message,
            });
        }

        const resolved = await resolveBusinessLoginIdentifier(identifier, countryCode);

        if (resolved.status === 'error') {
            const isAi = resolved.code === AI_UNCLAIMED_CODE;
            const statusCode = isAi ? 403 : 401;
            return res.status(statusCode).json({
                status: 'error',
                code: resolved.code,
                message: resolved.message,
                businessId: resolved.businessId || null,
            });
        }

        return res.status(200).json(successPayload(resolved, 'login'));
    } catch (error) {
        console.error('Login Resolver Error:', error);
        return res.status(500).json({
            message:
                action === 'reset' ? 'خطأ في معالجة استعادة الحساب' : 'حدث خطأ في خادم حل الهوية.',
        });
    }
}
