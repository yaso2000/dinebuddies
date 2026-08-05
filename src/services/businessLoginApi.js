import { looksLikeEmail } from '../utils/parseLoginIdentifier';

export const BUSINESS_LOGIN_INVALID_MSG_AR =
    'البريد الإلكتروني، رقم الجوال، أو كلمة المرور غير صحيحة.';
export const BUSINESS_LOGIN_INVALID_MSG_EN =
    'Invalid email, phone number, or password.';

export const BUSINESS_AI_UNCLAIMED_MSG_AR =
    'هذا الحساب منشأ تلقائياً بالذكاء الاصطناعي. يرجى الضغط على "استعادة الحساب وتوثيقه عبر SMS" أولاً لتتمكن من تعيين كلمة مرور والدخول.';
export const BUSINESS_AI_UNCLAIMED_MSG_EN =
    'This account was created automatically by AI. Use "Recover & verify via SMS" first to set a password and sign in.';

export const RESET_GENERIC_SUCCESS_AR =
    'إذا كان الحساب موجوداً، فقد أرسلنا رابط الاستعادة.';
export const RESET_GENERIC_SUCCESS_EN =
    'If an account exists, we sent a reset link.';

export const AI_UNCLAIMED_CODES = new Set(['unclaimed-ai-profile', 'ai-unclaimed']);

function pickResolvedEmail(data) {
    const em = data?.resolvedEmail || data?.loginEmail;
    return typeof em === 'string' && em.includes('@') ? em.trim().toLowerCase() : null;
}

function isAiUnclaimedCode(code) {
    return AI_UNCLAIMED_CODES.has(String(code || ''));
}

async function callLoginResolver(action, params) {
    const res = await fetch('/api/business-login-resolver', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            action,
            identifier: params.identifier,
            password: params.password,
            countryCode: params.countryCode || '+20',
        }),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
}

export async function resolveBusinessLoginForSignIn(identifier, password, countryCode = '+20') {
    const { ok, data } = await callLoginResolver('login', {
        identifier: String(identifier || '').trim(),
        password,
        countryCode,
    });

    if (isAiUnclaimedCode(data?.code)) {
        throw {
            code: 'unclaimed-ai-profile',
            message: data.message || BUSINESS_AI_UNCLAIMED_MSG_EN,
            businessId: data.businessId,
        };
    }

    const resolved = pickResolvedEmail(data);
    if (!ok || !resolved) {
        throw {
            code: 'auth-failed',
            message: data?.message || BUSINESS_LOGIN_INVALID_MSG_EN,
        };
    }

    return resolved;
}

/**
 * @returns {Promise<{ email: string | null, genericOnly: boolean, message: string }>}
 */
export async function requestBusinessPasswordReset(identifier, countryCode = '+20') {
    const id = String(identifier || '').trim();
    if (!id) {
        throw { code: 'invalid-input', message: 'Please enter your email or mobile number' };
    }

    const { ok, data } = await callLoginResolver('reset', { identifier: id, countryCode });

    if (!ok) {
        throw {
            code: 'reset-failed',
            message: data?.message || 'Could not process password reset',
        };
    }

    const message = data?.message || RESET_GENERIC_SUCCESS_EN;
    const genericOnly = data?.genericOnly === true || !pickResolvedEmail(data);

    return {
        email: pickResolvedEmail(data),
        genericOnly,
        message,
    };
}

/** @deprecated — use requestBusinessPasswordReset */
export async function resolveBusinessEmailForPasswordReset(identifier, countryCode = '+20') {
    const result = await requestBusinessPasswordReset(identifier, countryCode);
    if (result.genericOnly || !result.email) {
        const err = new Error(result.message);
        err.code = 'reset-generic-only';
        err.message = result.message;
        throw err;
    }
    return result.email;
}
