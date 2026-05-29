import { auth } from '../firebase/config';

const AI_GENERATE_PATH = '/api/ai/generate';
const AI_MULTI_GENERATE_PATH = '/api/ai/multi-generate';

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
        return payload;
    }

    if (response.status === 400 && payload?.code === 'VALIDATION_ERROR') {
        return {
            success: false,
            error: payload?.error || 'validation_error',
            code: 'VALIDATION_ERROR',
            message: typeof payload?.error === 'string' ? payload.error : undefined,
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
 * @param {{ venueType?: string, venueName?: string, generationPackage?: 'text' | 'image' | 'invitation_bundle', aspectRatio?: '1:1' | '9:16', inviteeId?: string, date?: string, time?: string, venueDetails?: Record<string, unknown> }} [options]
 * @returns {Promise<AIGenerateSuccess | AIGenerateFailure>}
 */
export async function generateAIContent(userPrompt, postType, subType, options = {}) {
    const trimmedPrompt = String(userPrompt || '').trim();
    if (!trimmedPrompt) {
        return { success: false, error: 'userPrompt is required', code: 'VALIDATION_ERROR' };
    }

    const user = auth.currentUser;
    if (!user) {
        return { success: false, error: 'Sign in required', code: 'UNAUTHORIZED', status: 401 };
    }

    let token;
    try {
        token = await user.getIdToken(true);
    } catch {
        return { success: false, error: 'Could not obtain auth token', code: 'UNAUTHORIZED', status: 401 };
    }

    /** @type {Record<string, unknown>} */
    const body = { userPrompt: trimmedPrompt, postType };

    if (postType === 'invitation') {
        if (!subType) {
            return {
                success: false,
                error: 'subType is required for invitation text generation',
                code: 'VALIDATION_ERROR',
            };
        }
        body.subType = subType;
        if (subType === 'public') {
            const venueType = String(options.venueType || '').trim();
            const venueName = String(options.venueName || '').trim();
            if (venueType) body.venueType = venueType;
            if (venueName) body.venueName = venueName;
        } else if (subType === 'date') {
            const inviteeId = String(options.inviteeId || '').trim();
            const date = String(options.date || '').trim();
            const time = String(options.time || '').trim();
            const venueDetails = options.venueDetails;
            if (inviteeId) body.inviteeId = inviteeId;
            if (date) body.date = date;
            if (time) body.time = time;
            if (venueDetails && typeof venueDetails === 'object') {
                body.venueDetails = venueDetails;
            }
        }
    } else if (options.generationPackage && options.generationPackage !== 'text') {
        body.generationPackage = options.generationPackage;
        if (options.aspectRatio) body.aspectRatio = options.aspectRatio;
    }

    const endpoint =
        postType === 'invitation'
            ? AI_GENERATE_PATH
            : options.generationPackage === 'image' || options.generationPackage === 'invitation_bundle'
              ? AI_MULTI_GENERATE_PATH
              : AI_GENERATE_PATH;
    let response;
    try {
        response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(body),
        });
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

    if (result.code === 'MALFORMED_JSON') {
        return t(
            'ai_malformed_response',
            'تعذّر قراءة استجابة الذكاء الاصطناعي. حاول مرة أخرى بملاحظات أقصر.'
        );
    }

    const raw = String(result.message || result.error || '');
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

    const user = auth.currentUser;
    if (!user) {
        return { success: false, error: 'Sign in required', code: 'UNAUTHORIZED', status: 401 };
    }

    let token;
    try {
        token = await user.getIdToken(true);
    } catch {
        return { success: false, error: 'Could not obtain auth token', code: 'UNAUTHORIZED', status: 401 };
    }

    const body = {
        userPrompt: trimmedPrompt,
        postType: 'invitation',
        subType,
        generationPackage: 'image',
        aspectRatio,
    };

    const venueTypeStr = String(venueType || '').trim();
    const venueNameStr = String(venueName || '').trim();
    if (venueTypeStr) body.venueType = venueTypeStr;
    if (venueNameStr) body.venueName = venueNameStr;

    let response;
    try {
        response = await fetch(AI_MULTI_GENERATE_PATH, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(body),
        });
    } catch {
        return {
            success: false,
            error: 'Network error while contacting AI service',
            code: 'GEMINI_API_ERROR',
        };
    }

    return parseAiApiResponse(response);
}
