import { auth } from '../firebase/config';
import { unwrapAiResponseData } from '../utils/aiContentFieldMapper';
import { buildDatingAiGenerateBody } from '../utils/datingAiRequestPayload';
import { enforceCardStructureTextLimits, normalizeCardStructure } from '../utils/cardStructure';
import {
    GEMINI_PROVIDER_BILLING_CODE,
    geminiProviderBillingUserMessage,
    isGeminiProviderBillingExhausted,
} from '../utils/geminiProviderErrors.js';

const AI_GENERATE_PATH = '/api/ai/generate';
const AI_MULTI_GENERATE_PATH = '/api/ai/multi-generate';

/** Obtain Bearer token; refresh only when needed or after 401 retry. */
async function getAuthBearerToken(forceRefresh = false) {
    const user = auth.currentUser;
    if (!user) return null;
    try {
        return await user.getIdToken(forceRefresh);
    } catch (err) {
        console.warn('[generateAIContent] getIdToken failed', err);
        if (!forceRefresh) {
            try {
                return await user.getIdToken(true);
            } catch {
                return null;
            }
        }
        return null;
    }
}

async function postAiJson(endpoint, body, token, { timeoutMs = 120000 } = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(body),
            signal: controller.signal,
        });
    } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
            throw new Error('AI_REQUEST_TIMEOUT');
        }
        throw err;
    } finally {
        clearTimeout(timer);
    }
}

/**
 * @typedef {'regular_post' | 'featured_post' | 'animated_post' | 'invitation' | 'magic_cover'} AIGeneratePostType
 * @typedef {'public' | 'private' | 'date'} AIInvitationSubType
 *
 * @typedef {{ success: true, data: Record<string, unknown>, meta?: Record<string, unknown> }} AIGenerateSuccess
 * @typedef {{
 *   success: false,
 *   error: string,
 *   code?: string,
 *   message?: string,
 *   status?: number,
 * }} AIGenerateFailure
 */

/**
 * Parse JSON AI API responses (shared by text + image endpoints).
 * @param {Response} response
 * @returns {Promise<AIGenerateSuccess | AIGenerateFailure>}
 */
async function parseAiApiResponse(response) {
    const responseText = await response.text();
    let payload;
    try {
        payload = responseText ? JSON.parse(responseText) : null;
    } catch {
        const snippet = responseText.replace(/\s+/g, ' ').trim().slice(0, 120);
        const hint =
            response.status === 404 || snippet.startsWith('<!DOCTYPE') || snippet.startsWith('<html')
                ? 'تأكد أنك تستخدم الدومين المنشور مع /api (أعد النشر إن لزم).'
                : `HTTP ${response.status}`;
        return {
            success: false,
            error: 'Invalid server response',
            code: 'GEMINI_API_ERROR',
            message: `استجابة غير صالحة من السيرفر (${hint}).`,
            status: response.status,
        };
    }

    if (payload && typeof payload === 'object' && payload.success === true) {
        return {
            ...payload,
            data: unwrapAiResponseData(payload.data),
        };
    }

    if (response.status === 400 && payload?.code === 'VALIDATION_ERROR') {
        return {
            success: false,
            error: payload?.error || 'validation_error',
            code: 'VALIDATION_ERROR',
            message:
                typeof payload?.message === 'string'
                    ? payload.message
                    : typeof payload?.error === 'string'
                      ? payload.error
                      : undefined,
            missing: Array.isArray(payload?.missing) ? payload.missing : undefined,
            status: 400,
        };
    }

    if (response.status === 400 && payload?.code === 'MALFORMED_JSON') {
        return {
            success: false,
            error: payload?.error || 'malformed_json',
            code: 'MALFORMED_JSON',
            message: typeof payload?.message === 'string' ? payload.message : undefined,
            status: 400,
        };
    }

    if (response.status === 403 && payload?.error === 'insufficient_credits') {
        return {
            success: false,
            error: 'insufficient_credits',
            code: 'INSUFFICIENT_CREDITS',
            message:
                payload.message ||
                'رصيدك غير كافٍ. تحتاج إلى المزيد من الكريدت لإتمام هذه العملية.',
            status: 403,
        };
    }

    if (response.status === 401) {
        return {
            success: false,
            error: payload?.error || 'unauthorized',
            code: payload?.code || 'UNAUTHORIZED',
            message:
                payload?.message ||
                'انتهت جلسة تسجيل الدخول أو التوكن غير صالح. سجّل الخروج ثم الدخول مرة أخرى.',
            status: 401,
        };
    }

    if (response.status === 503) {
        return {
            success: false,
            error: payload?.error || 'service_unavailable',
            code: payload?.code || 'SERVICE_UNAVAILABLE',
            message:
                payload?.message ||
                'خدمة الذكاء الاصطناعي غير متاحة حالياً على الخادم. حاول لاحقاً أو راجع إعدادات Vercel.',
            status: 503,
            detail: typeof payload?.detail === 'string' ? payload.detail : undefined,
        };
    }

    if (response.status === 422 || payload?.code === 'MODERATION_FAILED') {
        return {
            success: false,
            error: payload?.error || 'moderation_failed',
            code: 'MODERATION_FAILED',
            message: typeof payload?.message === 'string' ? payload.message : undefined,
            status: 422,
        };
    }

    return {
        success: false,
        error: payload?.error || payload?.message || `Request failed (${response.status})`,
        code: payload?.code || 'GEMINI_API_ERROR',
        message: typeof payload?.message === 'string' ? payload.message : undefined,
        status: response.status,
    };
}

/**
 * Text-only AI generation — always POST /api/ai/generate (10 credits for invitations).
 *
 * @param {string} userPrompt
 * @param {AIGeneratePostType} postType
 * @param {AIInvitationSubType} [subType]
 * @param {{ venueType?: string, venueName?: string, generationPackage?: 'text' | 'image' | 'invitation_bundle', aspectRatio?: '1:1' | '9:16', inviteeId?: string, inviteeName?: string, date?: string, time?: string, venueId?: string, address?: string, city?: string, country?: string, lat?: number, lng?: number, venueDetails?: Record<string, unknown>, datingContext?: import('../utils/datingAiRequestPayload.js').DatingAiContext, cardStructure?: string }} [options]
 * @returns {Promise<AIGenerateSuccess | AIGenerateFailure>}
 */
export async function generateAIContent(userPrompt, postType, subType, options = {}) {
    const trimmedPrompt = String(userPrompt || '').trim();
    if (!trimmedPrompt) {
        return { success: false, error: 'userPrompt is required', code: 'VALIDATION_ERROR' };
    }

    if (!auth.currentUser) {
        return { success: false, error: 'Sign in required', code: 'UNAUTHORIZED', status: 401 };
    }

    let token = await getAuthBearerToken(false);
    if (!token) {
        return { success: false, error: 'Could not obtain auth token', code: 'UNAUTHORIZED', status: 401 };
    }

    /** @type {Record<string, unknown>} */
    let body;

    if (postType === 'invitation' && subType === 'date') {
        const datingContext = options.datingContext || {
            inviteeId: options.inviteeId,
            inviteeName: options.inviteeName,
            date: options.date,
            time: options.time,
            venueType: options.venueType,
            venueName: options.venueName,
            venueId: options.venueId,
            address: options.address,
            city: options.city,
            country: options.country,
            lat: options.lat,
            lng: options.lng,
            venueDetails: options.venueDetails,
        };

        const datingPayload = buildDatingAiGenerateBody(trimmedPrompt, datingContext);

        if (!datingPayload.ok) {
            console.warn('[generateAIContent] dating payload incomplete', {
                context: datingContext,
                missing: datingPayload.missing,
            });
            return {
                success: false,
                error: datingPayload.error || 'dating_context_incomplete',
                code: 'VALIDATION_ERROR',
                message: 'dating_context_incomplete',
                missing: datingPayload.missing,
            };
        }

        body = datingPayload.body;
    } else {
        body = { userPrompt: trimmedPrompt, postType };

        if (postType === 'invitation') {
            if (!subType) {
                return {
                    success: false,
                    error: 'subType is required for invitation text generation',
                    code: 'VALIDATION_ERROR',
                };
            }
            body.subType = subType;
            if (options.cardStructure) {
                body.cardStructure = normalizeCardStructure(options.cardStructure);
            }
            if (subType === 'public') {
                const venueType = String(options.venueType || '').trim();
                const venueName = String(options.venueName || '').trim();
                if (venueType) body.venueType = venueType;
                if (venueName) body.venueName = venueName;
            }
        } else if (options.generationPackage && options.generationPackage !== 'text') {
            body.generationPackage = options.generationPackage;
            if (options.aspectRatio) body.aspectRatio = options.aspectRatio;
        }

    }

    const endpoint =
        postType === 'invitation'
            ? AI_GENERATE_PATH
            : options.generationPackage === 'image' || options.generationPackage === 'invitation_bundle'
              ? AI_MULTI_GENERATE_PATH
              : AI_GENERATE_PATH;

    console.log('=== CRITICAL OUTGOING AI PAYLOAD ===', { endpoint, body });

    let response;
    try {
        response = await postAiJson(endpoint, body, token);
        if (response.status === 401) {
            token = await getAuthBearerToken(true);
            if (token) {
                response = await postAiJson(endpoint, body, token);
            }
        }
    } catch {
        return {
            success: false,
            error: 'Network error while contacting AI service',
            code: 'GEMINI_API_ERROR',
        };
    }

    return parseAiApiResponse(response);
}

/** @param {AIGenerateFailure} result */
export function isInsufficientCreditsError(result) {
    return (
        result &&
        result.success === false &&
        (result.code === 'INSUFFICIENT_CREDITS' || result.error === 'insufficient_credits')
    );
}

/**
 * User-facing AI error text (hides raw JSON.parse / SDK noise).
 * @param {AIGenerateFailure} result
 * @param {(key: string, fallback?: string) => string} t
 */
export function formatAiErrorMessage(result, t) {
    if (!result || result.success !== false) {
        return t('ai_generate_failed', 'تعذّر التوليد بالذكاء الاصطناعي. حاول مرة أخرى.');
    }

    if (
        result.code === GEMINI_PROVIDER_BILLING_CODE ||
        isGeminiProviderBillingExhausted(result.message || result.error)
    ) {
        return t('ai_gemini_billing_exhausted', geminiProviderBillingUserMessage('ar'));
    }

    if (result.code === 'MALFORMED_JSON') {
        return t(
            'ai_malformed_response',
            'تعذّر قراءة استجابة الذكاء الاصطناعي. حاول مرة أخرى بملاحظات أقصر.'
        );
    }

    if (result.code === 'VALIDATION_ERROR') {
        if (
            result.error === 'dating_context_incomplete' ||
            (Array.isArray(result.missing) && result.missing.length > 0)
        ) {
            return t(
                'dating_ai_all_fields_required',
                'يرجى ملء جميع الحقول أولاً لتخصيص الدعوة.'
            );
        }
        const validationMsg = [result.message, result.error]
            .filter((v) => typeof v === 'string' && v.trim())
            .join(' — ');
        if (validationMsg) return validationMsg;
    }

    const raw = String(result.message || result.error || '').trim();
    if (raw === 'undefined' || raw === 'null') {
        return t('ai_generate_failed', 'تعذّر التوليد بالذكاء الاصطناعي. حاول مرة أخرى.');
    }
    if (/unterminated string|malformed json|unexpected token|not valid json/i.test(raw)) {
        return t(
            'ai_malformed_response',
            'تعذّر قراءة استجابة الذكاء الاصطناعي. حاول مرة أخرى بملاحظات أقصر.'
        );
    }

    if (result.code === 'IMAGE_GENERATION_FAILED' || /imagen|image generation|no image/i.test(raw)) {
        return t(
            'ai_image_generation_failed',
            'تعذّر توليد الصورة. جرّب وصفاً مختلفاً أو تحقق من إعدادات Imagen على الخادم.'
        );
    }

    if (
        result.code === 'STORAGE_UPLOAD_FAILED' ||
        result.code === 'AI_CLIENT_NOT_CONFIGURED' ||
        result.code === 'SERVICE_UNAVAILABLE' ||
        result.status === 503
    ) {
        return (
            result.message ||
            t(
                'ai_service_unavailable',
                'خدمة توليد الصور غير متاحة حالياً. راجع إعدادات Firebase AI وStorage على Vercel.'
            )
        );
    }

    return (
        raw ||
        t('ai_generate_failed', 'تعذّر التوليد بالذكاء الاصطناعي. حاول مرة أخرى.')
    );
}

/**
 * Invitation Magic Cover — image-only via POST /api/ai/multi-generate (25 credits).
 * Never used for text; call only from MagicCoverGeneratePanel / media gallery.
 *
 * @param {{
 *   userPrompt: string,
 *   subType: 'public' | 'private' | 'date',
 *   venueType?: string,
 *   venueName?: string,
 *   aspectRatio?: '1:1' | '9:16',
 * }} params
 * @returns {Promise<AIGenerateSuccess | AIGenerateFailure>}
 */
export async function generateAIMagicCover({
    userPrompt,
    subType,
    venueType,
    venueName,
    aspectRatio = '1:1',
}) {
    const trimmedPrompt = String(userPrompt || '').trim();
    if (!trimmedPrompt) {
        return { success: false, error: 'userPrompt is required', code: 'VALIDATION_ERROR' };
    }

    if (!subType) {
        return {
            success: false,
            error: 'subType is required for invitation cover generation',
            code: 'VALIDATION_ERROR',
        };
    }

    if (!auth.currentUser) {
        return { success: false, error: 'Sign in required', code: 'UNAUTHORIZED', status: 401 };
    }

    let token = await getAuthBearerToken(false);
    if (!token) {
        return { success: false, error: 'Could not obtain auth token', code: 'UNAUTHORIZED', status: 401 };
    }

    const body = {
        userPrompt: trimmedPrompt.slice(0, 2000),
        postType: 'invitation',
        subType,
        generationPackage: 'image',
        aspectRatio,
    };

    const venueTypeStr = String(venueType || '').trim();
    const venueNameStr = String(venueName || '').trim();
    if (venueTypeStr) body.venueType = venueTypeStr;
    if (venueNameStr) body.venueName = venueNameStr;

    console.log('=== CRITICAL OUTGOING AI PAYLOAD ===', { endpoint: AI_MULTI_GENERATE_PATH, body });

    let response;
    try {
        response = await postAiJson(AI_MULTI_GENERATE_PATH, body, token, { timeoutMs: 180000 });
        if (response.status === 401) {
            token = await getAuthBearerToken(true);
            if (token) {
                response = await postAiJson(AI_MULTI_GENERATE_PATH, body, token, { timeoutMs: 180000 });
            }
        }
    } catch (err) {
        if (err instanceof Error && err.message === 'AI_REQUEST_TIMEOUT') {
            return {
                success: false,
                error: 'request_timeout',
                code: 'AI_REQUEST_TIMEOUT',
                message:
                    'انتهت مهلة انتظار توليد الصورة. قد يكون التوليد ما زال جارياً على الخادم — انتظر ثم حاول مرة أخرى.',
                status: 408,
            };
        }
        return {
            success: false,
            error: 'Network error while contacting AI service',
            code: 'GEMINI_API_ERROR',
        };
    }

    return parseAiApiResponse(response);
}

/**
 * AI Design Studio — standalone image generation (25 credits).
 *
 * @param {{
 *   userPrompt: string,
 *   designCategory: import('../constants/aiDesignStudioCategories.js').AiDesignStudioCategoryId,
 *   aspectRatio?: '1:1' | '9:16' | '16:9',
 * }} params
 * @returns {Promise<AIGenerateSuccess | AIGenerateFailure>}
 */
export async function generateAIDesignStudioImage({ userPrompt, designCategory, aspectRatio = '1:1' }) {
    const trimmedPrompt = String(userPrompt || '').trim();
    if (!trimmedPrompt) {
        return { success: false, error: 'userPrompt is required', code: 'VALIDATION_ERROR' };
    }

    if (!designCategory) {
        return {
            success: false,
            error: 'designCategory is required',
            code: 'VALIDATION_ERROR',
        };
    }

    if (!auth.currentUser) {
        return { success: false, error: 'Sign in required', code: 'UNAUTHORIZED', status: 401 };
    }

    let token = await getAuthBearerToken(false);
    if (!token) {
        return { success: false, error: 'Could not obtain auth token', code: 'UNAUTHORIZED', status: 401 };
    }

    const body = {
        userPrompt: trimmedPrompt.slice(0, 2000),
        postType: 'design_studio',
        generationPackage: 'image',
        designCategory,
        aspectRatio,
    };

    let response;
    try {
        response = await postAiJson(AI_MULTI_GENERATE_PATH, body, token, { timeoutMs: 180000 });
        if (response.status === 401) {
            token = await getAuthBearerToken(true);
            if (token) {
                response = await postAiJson(AI_MULTI_GENERATE_PATH, body, token, { timeoutMs: 180000 });
            }
        }
    } catch (err) {
        if (err instanceof Error && err.message === 'AI_REQUEST_TIMEOUT') {
            return {
                success: false,
                error: 'request_timeout',
                code: 'AI_REQUEST_TIMEOUT',
                message:
                    'انتهت مهلة انتظار توليد الصورة. قد يكون التوليد ما زال جارياً على الخادم — انتظر ثم حاول مرة أخرى.',
                status: 408,
            };
        }
        return {
            success: false,
            error: 'Network error while contacting AI service',
            code: 'GEMINI_API_ERROR',
        };
    }

    return parseAiApiResponse(response);
}
