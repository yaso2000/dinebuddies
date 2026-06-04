/**
 * POST /api/auth/send-business-otp
 * Body: { standardizedPhone, recaptchaToken, countryCode?, rawPhone? }
 */
import { takeRateLimit } from '../_rateLimit.js';
import { formatToE164, isValidE164 } from '../_phoneUtils.js';
import { verifyRecaptchaV3, getRequestClientIp } from '../_recaptcha.js';
import { lookupBusinessPhoneInUsers, upsertPendingBusinessPhone } from '../_businessPhoneRegistry.js';
import { sendTwilioOTP } from '../_twilioVerify.js';
import { applyApiCors, handleCorsPreflight } from '../_cors.js';

function readJsonBody(req) {
    if (req.body && typeof req.body === 'object') return req.body;
    return {};
}

function mapTwilioError(res, err) {
    if (err?.message === 'TWILIO_NOT_CONFIGURED') {
        return res.status(503).json({
            status: 'error',
            code: 'sms-not-configured',
            message: 'خدمة الرسائل غير مفعّلة على السيرفر',
        });
    }
    console.error('[send-business-otp] Twilio', {
        code: err?.code,
        status: err?.status,
        message: err?.message,
        moreInfo: err?.moreInfo,
    });
    const trialHint =
        err?.code === 60203 || /not verified/i.test(String(err?.message || ''))
            ? 'أضف الرقم في Twilio → Verified caller IDs (حساب Trial).'
            : undefined;
    return res.status(502).json({
        status: 'error',
        code: 'sms-failed',
        message: trialHint || 'تعذر إرسال رمز التحقق',
        twilioCode: err?.code || null,
    });
}

export default async function handler(req, res) {
    applyApiCors(req, res);
    if (handleCorsPreflight(req, res)) return;

    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    const body = readJsonBody(req);
    let standardizedPhone = String(body.standardizedPhone || '').trim();
    if (!standardizedPhone && body.countryCode && body.rawPhone) {
        standardizedPhone = formatToE164(body.countryCode, body.rawPhone);
    }

    if (!standardizedPhone) {
        return res.status(400).json({ message: 'رقم الهاتف الموحد مطلوب' });
    }

    if (!isValidE164(standardizedPhone)) {
        return res.status(400).json({
            status: 'error',
            code: 'invalid-phone',
            message: 'رقم الهاتف غير صالح',
        });
    }

    const ip = getRequestClientIp(req);

    const phoneMinute = takeRateLimit(req, {
        key: 'send-business-otp-phone',
        limit: 1,
        windowMs: 60_000,
        identifier: standardizedPhone,
    });
    if (!phoneMinute.ok) {
        res.setHeader('Retry-After', String(phoneMinute.retryAfterSec));
        return res.status(429).json({
            status: 'error',
            code: 'rate-limit-phone',
            message: 'انتظر دقيقة قبل إعادة إرسال الرمز',
            retryAfterSec: phoneMinute.retryAfterSec,
        });
    }

    const hourCombined = takeRateLimit(req, {
        key: 'send-business-otp-hour',
        limit: 3,
        windowMs: 60 * 60 * 1000,
        identifier: `${ip}|${standardizedPhone}`,
    });
    if (!hourCombined.ok) {
        res.setHeader('Retry-After', String(hourCombined.retryAfterSec));
        return res.status(429).json({
            status: 'error',
            code: 'rate-limit-hour',
            message: 'تم تجاوز عدد المحاولات. حاول لاحقاً',
            retryAfterSec: hourCombined.retryAfterSec,
        });
    }

    const captcha = await verifyRecaptchaV3(body.recaptchaToken, ip);
    if (!captcha.ok) {
        return res.status(403).json({
            status: 'error',
            code: 'spam-detected',
            message: 'فشل التحقق الأمني من البوتات',
        });
    }

    try {
        const lookup = await lookupBusinessPhoneInUsers(standardizedPhone);

        if (lookup.flow === 'claimed') {
            return res.status(400).json({
                status: 'error',
                code: 'phone-already-in-use',
                message: 'هذا البزنس مسجل مسبقاً ومحجوز برقم الهاتف هذا.',
            });
        }

        if (lookup.flow === 'claim') {
            await upsertPendingBusinessPhone(standardizedPhone, {
                claimBusinessId: lookup.businessId,
            });
            try {
                await sendTwilioOTP(standardizedPhone);
            } catch (twilioErr) {
                return mapTwilioError(res, twilioErr);
            }
            return res.status(200).json({
                status: 'claim_flow',
                standardizedPhone,
                businessId: lookup.businessId,
                businessName: lookup.businessName || '',
                message:
                    'البزنس منشأ مسبقاً بالـ AI، يرجى إدخال الكود المستلم لتأكيد ملكيتك له.',
            });
        }

        await upsertPendingBusinessPhone(standardizedPhone);
        try {
            await sendTwilioOTP(standardizedPhone);
        } catch (twilioErr) {
            return mapTwilioError(res, twilioErr);
        }

        return res.status(200).json({
            status: 'new_register_flow',
            standardizedPhone,
            message: 'تم إرسال كود التحقق بنجاح برقم الهاتف الجديد.',
        });
    } catch (error) {
        console.error('Error in send-otp API:', error);
        return res.status(500).json({ message: 'حدث خطأ في الخادم أثناء إرسال الكود.' });
    }
}
