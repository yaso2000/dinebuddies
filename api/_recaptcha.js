/**
 * Google reCAPTCHA v3 siteverify.
 * @param {string} token
 * @param {string} [remoteIp]
 * @returns {Promise<{ ok: boolean, score?: number, error?: string }>}
 */
export async function verifyRecaptchaV3(token, remoteIp) {
    const secret = String(process.env.RECAPTCHA_SECRET_KEY || '').trim();
    if (!secret) {
        console.warn('[recaptcha] RECAPTCHA_SECRET_KEY not set — skipping verification');
        return { ok: true, score: 1 };
    }

    const response = String(token || '').trim();
    if (!response) {
        return { ok: false, error: 'Missing reCAPTCHA token' };
    }

    const body = new URLSearchParams({
        secret,
        response,
    });
    if (remoteIp && remoteIp !== 'unknown') {
        body.set('remoteip', remoteIp);
    }

    try {
        const res = await fetch('https://www.google.com/recaptcha/api/siteverify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: body.toString(),
        });
        const data = await res.json();
        if (!data.success) {
            return { ok: false, error: 'spam-detected', code: 'spam-detected' };
        }
        const minScore = Number(process.env.RECAPTCHA_MIN_SCORE || '0.5');
        const score = typeof data.score === 'number' ? data.score : 0;
        if (score < minScore) {
            return { ok: false, error: 'spam-detected', code: 'spam-detected', score };
        }
        return { ok: true, score };
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[recaptcha] siteverify error', msg);
        return { ok: false, error: 'reCAPTCHA service unavailable' };
    }
}

function getClientIp(req) {
    const xf = req.headers['x-forwarded-for'];
    if (typeof xf === 'string' && xf.trim()) return xf.split(',')[0].trim();
    const xr = req.headers['x-real-ip'];
    if (typeof xr === 'string' && xr.trim()) return xr.trim();
    return 'unknown';
}

export { getClientIp as getRequestClientIp };
