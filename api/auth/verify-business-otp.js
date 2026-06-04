/**
 * POST /api/auth/verify-business-otp
 *
 * action (default): "verify" — التحقق من الرمز وتسجيل الجلسة المؤقتة
 * action: "complete" — إنشاء/نقل الحساب بعد التحقق (يتطلب verificationToken + email + password + businessInfo)
 */
import { randomUUID } from 'crypto';
import { takeRateLimit } from '../_rateLimit.js';
import { isValidE164 } from '../_phoneUtils.js';
import { verifyRecaptchaV3, getRequestClientIp } from '../_recaptcha.js';
import {
    lookupBusinessPhoneInUsers,
    markPendingPhoneVerified,
} from '../_businessPhoneRegistry.js';
import { completeBusinessPhoneSignup } from '../_businessPhoneAccount.js';
import { checkTwilioOTP } from '../_twilioVerify.js';
import { applyApiCors, handleCorsPreflight } from '../_cors.js';

function readJsonBody(req) {
    if (req.body && typeof req.body === 'object') return req.body;
    return {};
}

async function handleComplete(req, res, body) {
    const standardizedPhone = String(body.standardizedPhone || '').trim();
    if (!isValidE164(standardizedPhone)) {
        return res.status(400).json({
            status: 'error',
            code: 'invalid-request',
            message: 'رقم الهاتف غير صالح',
        });
    }

    try {
        const result = await completeBusinessPhoneSignup({
            standardizedPhone,
            verificationToken: body.verificationToken,
            email: body.email,
            password: body.password,
            businessInfo: body.businessInfo || {},
            claimBusinessId: body.claimBusinessId || body.businessId || null,
            referredBy: body.referredBy || null,
        });

        return res.status(200).json({
            status: 'ok',
            action: 'complete',
            uid: result.uid,
            email: result.email,
            flow: result.flow,
            standardizedPhone,
            claimedFromBusinessId: result.claimedFromBusinessId,
        });
    } catch (err) {
        const code = err && typeof err === 'object' && 'code' in err ? String(err.code) : '';
        if (code === 'phone-already-in-use') {
            return res.status(409).json({
                status: 'error',
                code: 'phone-already-in-use',
                message: 'هذا البزنس مسجل مسبقاً برقم الهاتف هذا',
            });
        }
        if (code === 'auth/email-already-in-use') {
            return res.status(409).json({
                status: 'error',
                code: 'auth/email-already-in-use',
                message: 'البريد الإلكتروني مسجل مسبقاً',
            });
        }
        if (code === 'verification-expired') {
            return res.status(400).json({
                status: 'error',
                code: 'verification-expired',
                message: 'انتهت صلاحية التحقق. أعد إرسال الرمز',
            });
        }
        if (code === 'invalid-request') {
            return res.status(400).json({
                status: 'error',
                code: 'invalid-request',
                message: 'بيانات التسجيل غير مكتملة',
            });
        }
        console.error('[verify-business-otp] complete', err);
        return res.status(500).json({
            status: 'error',
            code: 'server-error',
            message: 'حدث خطأ أثناء إنشاء الحساب',
        });
    }
}

export default async function handler(req, res) {
    applyApiCors(req, res);
    if (handleCorsPreflight(req, res)) return;

    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ status: 'error', message: 'Method not allowed' });
    }

    const body = readJsonBody(req);
    const action = String(body.action || 'verify').toLowerCase();

    if (action === 'complete') {
        return handleComplete(req, res, body);
    }

    const standardizedPhone = String(body.standardizedPhone || '').trim();
    const code = String(body.code || '').replace(/\D/g, '');

    if (!isValidE164(standardizedPhone) || code.length < 4) {
        return res.status(400).json({
            status: 'error',
            code: 'invalid-request',
            message: 'رقم الهاتف أو الرمز غير صالح',
        });
    }

    const ip = getRequestClientIp(req);
    if (body.recaptchaToken) {
        const captcha = await verifyRecaptchaV3(body.recaptchaToken, ip);
        if (!captcha.ok) {
            return res.status(403).json({
                status: 'error',
                code: 'recaptcha-failed',
                message: 'فشل التحقق الأمني',
            });
        }
    }

    const verifyRl = takeRateLimit(req, {
        key: 'verify-business-otp',
        limit: 10,
        windowMs: 15 * 60 * 1000,
        identifier: `${ip}|${standardizedPhone}`,
    });
    if (!verifyRl.ok) {
        res.setHeader('Retry-After', String(verifyRl.retryAfterSec));
        return res.status(429).json({
            status: 'error',
            code: 'rate-limit',
            message: 'محاولات كثيرة. انتظر قليلاً',
        });
    }

    try {
        const lookup = await lookupBusinessPhoneInUsers(standardizedPhone);
        if (lookup.flow === 'claimed') {
            return res.status(409).json({
                status: 'error',
                code: 'phone-already-in-use',
                message: 'هذا البزنس مسجل مسبقاً برقم الهاتف هذا',
            });
        }

        let twilioCheck;
        try {
            twilioCheck = await checkTwilioOTP(standardizedPhone, code);
        } catch (twilioErr) {
            if (twilioErr.message === 'TWILIO_NOT_CONFIGURED') {
                return res.status(503).json({
                    status: 'error',
                    code: 'sms-not-configured',
                    message: 'خدمة التحقق غير مفعّلة',
                });
            }
            throw twilioErr;
        }

        if (twilioCheck.status !== 'approved') {
            return res.status(400).json({
                status: 'error',
                code: 'invalid-code',
                message: 'رمز التحقق غير صحيح',
            });
        }

        const verificationToken = randomUUID();
        await markPendingPhoneVerified(standardizedPhone, verificationToken);

        const payload = {
            status: 'ok',
            action: 'verify',
            standardizedPhone,
            verificationToken,
            flow: lookup.flow === 'claim' ? 'claim' : 'new',
        };
        if (lookup.flow === 'claim') {
            payload.businessId = lookup.businessId;
            payload.businessName = lookup.businessName || '';
        }
        return res.status(200).json(payload);
    } catch (err) {
        console.error('[verify-business-otp]', err);
        return res.status(500).json({
            status: 'error',
            code: 'server-error',
            message: 'حدث خطأ. حاول مرة أخرى',
        });
    }
}
