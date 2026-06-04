import { executeRecaptchaV3, isRecaptchaConfigured } from './recaptchaV3';

/** Production API when Vite dev has no serverless routes (quick path for OTP). */
const PRODUCTION_API_ORIGIN = 'https://www.dinebuddies.com';

function resolveApiUrl(path) {
    const custom = String(import.meta.env.VITE_API_ORIGIN || '').trim().replace(/\/$/, '');
    if (custom) return `${custom}${path}`;
    if (import.meta.env.DEV) return `${PRODUCTION_API_ORIGIN}${path}`;
    return path;
}

async function postJson(path, body) {
    const payload = { ...body };
    if (isRecaptchaConfigured()) {
        const action = path.includes('verify') ? 'verify_business_otp' : 'send_business_otp';
        try {
            payload.recaptchaToken = await executeRecaptchaV3(action);
        } catch (recaptchaErr) {
            console.warn('[businessPhoneOtpApi] reCAPTCHA skipped', recaptchaErr);
        }
    }

    const url = resolveApiUrl(path);

    let res;
    try {
        res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
    } catch (networkErr) {
        return {
            ok: false,
            status: 0,
            data: {
                code: 'network-error',
                message:
                    'تعذر الاتصال بالخادم. جرّب https://www.dinebuddies.com أو شغّل npm run dev:vercel',
            },
        };
    }

    const text = await res.text();
    let data = {};
    try {
        data = text ? JSON.parse(text) : {};
    } catch {
        const isHtml = /^\s*</.test(text);
        return {
            ok: false,
            status: res.status,
            data: {
                code: 'invalid-api-response',
                message: isHtml
                    ? 'مسار API غير متاح (استخدم الإنتاج أو npm run dev:vercel مع .env)'
                    : 'استجابة غير متوقعة من الخادم',
            },
        };
    }
    return { ok: res.ok, status: res.status, data };
}

/**
 * @param {{ standardizedPhone: string, countryCode?: string, rawPhone?: string }} params
 */
export async function sendBusinessOtp(params) {
    return postJson('/api/send-business-otp', params);
}

/**
 * @param {{ standardizedPhone: string, code: string }} params
 */
export async function verifyBusinessOtp(params) {
    return postJson('/api/verify-business-otp', { action: 'verify', ...params });
}

/**
 * إنشاء/نقل حساب المنشأة بعد التحقق من الهاتف (Firebase Admin على السيرفر).
 */
export async function completeBusinessSignup(params) {
    return postJson('/api/verify-business-otp', { action: 'complete', ...params });
}
