// @ts-nocheck
/**
 * POST /api/ai/multi-generate
 *
 * Multi-stage AI pipeline (Stage 0–3):
 * - Role-aware text generation (user vs business)
 * - Imagen cover generation with auto moderation
 * - Credits: text 10 | image 25 | invitation_bundle 30
 */
import { requireAuth } from '../_auth.js';
import { ensureFirebaseClientApp } from '../_firebaseClient.js';
import { takeRateLimit } from '../_rateLimit.js';
import { uploadInvitationAiImage, persistUserMediaLibraryItem } from '../_aiStorage.js';
import {
    buildClientDeliveredInvitationImage,
    shouldDeliverInvitationImageToClient,
} from '../_aiInvitationImageDeliver.js';
import { resolveInvitationCallerContext } from '../_aiInvitationContext.js';
import { parseAiGenerateBody } from './parseAiRequest.js';
import { refundAiCredits, spendAiCredits } from './_runAiWithCredits.js';
import { resolveCreditCost } from './aiCredits.js';
import {
    GEMINI_PROVIDER_BILLING_CODE,
    geminiProviderBillingUserMessage,
    isGeminiProviderBillingExhausted,
    normalizeGeminiProviderBillingError,
} from '../../src/utils/geminiProviderErrors.js';
import { normalizeAiOutputLanguage } from '../../src/utils/aiOutputLanguage.js';

function statusForPipelineError(result) {
    if (result.code === 'VALIDATION_ERROR' || result.code === 'MALFORMED_JSON') {
        return 400;
    }
    if (result.code === 'MODERATION_FAILED') {
        return 422;
    }
    if (result.code === 'IMAGE_GENERATION_FAILED') {
        return 422;
    }
    if (
        result.code === GEMINI_PROVIDER_BILLING_CODE ||
        isGeminiProviderBillingExhausted(result.error)
    ) {
        return 503;
    }
    if (
        result.code === 'GEMINI_API_ERROR' &&
        /\b503\b|service unavailable|unavailable|RETIRED_MODEL|\b404\b|retired|not found|permission|billing|quota/i.test(
            String(result.error || ''),
        )
    ) {
        return 503;
    }
    return 500;
}

function userMessageForPipelineError(result, outputLanguage = 'en') {
    if (
        result.code === GEMINI_PROVIDER_BILLING_CODE ||
        isGeminiProviderBillingExhausted(result.error)
    ) {
        return geminiProviderBillingUserMessage(outputLanguage);
    }
    if (result.code === 'MODERATION_FAILED') {
        return 'لم تجتز الصورة المُولَّدة فحص الاعتدال. تُسترد الكريدتات عند فشل الطلب على الخادم.';
    }
    if (result.code === 'IMAGE_GENERATION_FAILED') {
        return 'تعذّر توليد الصورة (قد يكون الوصف محظوراً). جرّب وصفاً مختلفاً.';
    }
    if (result.code === 'MALFORMED_JSON') {
        return 'تعذّر قراءة استجابة الذكاء الاصطناعي. حاول مرة أخرى بملاحظات أقصر.';
    }
    if (statusForPipelineError(result) === 503) {
        return 'خدمة توليد الصور غير متاحة حالياً. تأكد من تفعيل Firebase AI Logic وImagen في مشروعك على Google Cloud، ثم أعد النشر.';
    }
    return typeof result.error === 'string' ? result.error : 'تعذّر التوليد بالذكاء الاصطناعي.';
}

export default async function handler(req, res) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(204).end();
    }

    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST, OPTIONS');
        return res.status(405).json({
            success: false,
            error: 'Method not allowed',
            code: 'METHOD_NOT_ALLOWED',
        });
    }

    const rateLimit = takeRateLimit(req, {
        key: 'ai-multi-generate',
        limit: 15,
        windowMs: 60_000,
    });

    res.setHeader('X-RateLimit-Limit', '15');
    res.setHeader('X-RateLimit-Remaining', String(rateLimit.remaining));

    if (!rateLimit.ok) {
        res.setHeader('Retry-After', String(rateLimit.retryAfterSec));
        return res.status(429).json({
            success: false,
            error: 'Too many requests. Please try again later.',
            code: 'RATE_LIMITED',
        });
    }

    // Auth/parse helpers are JS; cast after runtime checks for the API type gate.
    const authResult = (await requireAuth(req)) as any;
    if (authResult.ok === false) {
        return res.status(authResult.status).json({
            success: false,
            error: authResult.error,
            code: authResult.code || 'UNAUTHORIZED',
            message: authResult.message,
            debugCode: authResult.debugCode,
        });
    }

    const parsed = parseAiGenerateBody(req.body) as any;
    if (parsed.ok === false) {
        return res.status(400).json({
            success: false,
            error: parsed.error,
            code: 'VALIDATION_ERROR',
            ...(Array.isArray(parsed.missing) && parsed.missing.length
                ? { missing: parsed.missing, message: parsed.message || parsed.error }
                : {}),
        });
    }

    const request = parsed;
    const creditCost = resolveCreditCost(request.generationPackage, request.postType);

    /** @type {{ freeUsed: number, paidUsed: number } | null} */
    let charged = null;
    /** @type {import('firebase-admin/firestore').DocumentReference | null} */
    let userRef = null;
    /** @type {import('firebase-admin/firestore').Firestore | null} */
    let db = null;

    try {
        const spend = await spendAiCredits(authResult.uid, {
            generationPackage: request.generationPackage,
            postType: request.postType,
            reasonSuffix: request.generationPackage,
        });

        if (!spend.ok) {
            return res.status(403).json({
                success: false,
                error: 'insufficient_credits',
                message: `رصيدك غير كافٍ. تحتاج إلى ${spend.creditCost || creditCost} كريدت لإتمام هذه العملية.`,
            });
        }

        charged = {
            freeUsed: Number(spend.freeUsed) || 0,
            paidUsed: Number(spend.paidUsed) || 0,
        };
        db = spend.db;
        userRef = spend.userRef;

        try {
            ensureFirebaseClientApp();
        } catch (clientErr) {
            await refundAiCredits(db, userRef, charged);
            const detail = clientErr instanceof Error ? clientErr.message : String(clientErr);
            console.error('[api/ai/multi-generate] firebase_client', detail);
            return res.status(503).json({
                success: false,
                error: 'ai_client_not_configured',
                code: 'AI_CLIENT_NOT_CONFIGURED',
                message:
                    'إعداد Firebase للذكاء الاصطناعي غير مكتمل على Vercel. أضف VITE_FIREBASE_API_KEY وVITE_FIREBASE_APP_ID (أو FIREBASE_API_KEY) ثم Redeploy.',
            });
        }

        const callerContext = await resolveInvitationCallerContext(
            db,
            authResult.uid,
            spend.userData,
            request.postType,
        );

        const { runMultimodalPipeline } = await import('../../src/services/GeminiService.js');

        const outputLanguage = normalizeAiOutputLanguage(request.outputLanguage);

        const pipelineResult = await runMultimodalPipeline({
            generationPackage: request.generationPackage,
            userPrompt: request.userPrompt,
            postType: request.postType,
            subType: request.subType,
            venueType: request.venueType,
            venueName: request.venueName,
            accountType: callerContext.accountType as 'user' | 'business',
            businessContext: callerContext.businessContext,
            aspectRatio: request.aspectRatio,
            designCategory: request.designCategory,
            outputLanguage,
        });

        if (pipelineResult.success === false) {
            await refundAiCredits(db, userRef, charged);
            const status = statusForPipelineError(pipelineResult);
            return res.status(status).json({
                ...pipelineResult,
                message: userMessageForPipelineError(pipelineResult, outputLanguage),
            });
        }

        const responseData = { ...pipelineResult.data };

        if (pipelineResult.pendingImage) {
            if (shouldDeliverInvitationImageToClient(request.postType, request.generationPackage)) {
                responseData.image = buildClientDeliveredInvitationImage(pipelineResult.pendingImage);
            } else {
            let uploaded;
            try {
                uploaded = await uploadInvitationAiImage(
                    authResult.uid,
                    pipelineResult.pendingImage.bytesBase64,
                    pipelineResult.pendingImage.mimeType,
                    request.postType,
                );
                try {
                    const persisted = await persistUserMediaLibraryItem(
                        authResult.uid,
                        uploaded.mediaLibraryItem,
                    );
                    if (persisted?.id) {
                        uploaded.mediaLibraryItem.id = persisted.id;
                    }
                } catch (libraryErr) {
                    console.warn(
                        '[api/ai/multi-generate] media_library_persist',
                        libraryErr instanceof Error ? libraryErr.message : libraryErr,
                    );
                }
            } catch (uploadErr) {
                const uploadDetail = uploadErr instanceof Error ? uploadErr.message : String(uploadErr);
                console.error('[api/ai/multi-generate] storage_upload', uploadDetail);
                await refundAiCredits(db, userRef, charged);
                return res.status(503).json({
                    success: false,
                    error: 'storage_upload_failed',
                    code: 'STORAGE_UPLOAD_FAILED',
                    message:
                        'تم توليد الصورة لكن فشل حفظها في Firebase Storage. تحقق من FIREBASE_STORAGE_BUCKET أو صلاحيات حساب الخدمة، ثم Redeploy.',
                    detail: uploadDetail,
                });
            }

            responseData.image = {
                url: uploaded.url,
                path: uploaded.path,
                bucket: uploaded.bucket,
                mimeType: uploaded.mimeType,
                mediaLibraryItem: uploaded.mediaLibraryItem,
                moderation: pipelineResult.pendingImage.moderation,
                imagePrompt: pipelineResult.pendingImage.imagePrompt,
            };
            }
        }

        return res.status(200).json({
            success: true,
            data: responseData,
            meta: {
                ...pipelineResult.meta,
                creditsCharged: creditCost,
                ...(request.postType === 'design_studio' && request.designCategory
                    ? {
                          designStudio: {
                              status: 'success',
                              category: request.designCategory,
                              aspect_ratio: request.aspectRatio || '1:1',
                              optimized_prompt: responseData.imagePrompt || '',
                              allow_download: true,
                          },
                      }
                    : {}),
            },
        });
    } catch (error) {
        console.error('[api/ai/multi-generate]', error);
        if (db && userRef && charged) {
            try {
                await refundAiCredits(db, userRef, charged);
            } catch (refundErr) {
                console.error('[api/ai/multi-generate] refund_failed', refundErr);
            }
        }
        const billing = normalizeGeminiProviderBillingError(error);
        if (billing) {
            return res.status(503).json({ success: false, ...billing });
        }
        const detail = error instanceof Error ? error.message : 'Internal server error';
        const isClientConfig = /firebase client config|VITE_FIREBASE/i.test(detail);
        return res.status(isClientConfig ? 503 : 500).json({
            success: false,
            error: detail,
            code: isClientConfig ? 'AI_CLIENT_NOT_CONFIGURED' : 'GEMINI_API_ERROR',
            message: isClientConfig
                ? 'إعداد Firebase للذكاء الاصطناعي غير مكتمل على الخادم.'
                : 'حدث خطأ داخلي أثناء توليد المحتوى.',
        });
    }
}
