/**
 * POST /api/ai/generate
 *
 * Authenticated AI generation with credit enforcement.
 * Credits: text 10 | image (magic_cover) 25 | invitation_bundle 30
 *
 * For the full multi-stage pipeline prefer POST /api/ai/multi-generate with generationPackage.
 */
import { requireAuth } from '../_auth.js';
import { ensureFirebaseAdmin } from '../_firebaseAdmin.js';
import { ensureFirebaseClientApp } from '../_firebaseClient.js';
import { takeRateLimit } from '../_rateLimit.js';
import { uploadInvitationAiImage, persistUserMediaLibraryItem } from '../_aiStorage.js';
import { resolveInvitationCallerContext } from '../_aiInvitationContext.js';
import { resolveDatingInvitationPersonalization } from '../_datingAiPersonalization.js';
import { parseAiGenerateBody } from './parseAiRequest.js';
import { refundAiCredits, spendAiCredits } from './_runAiWithCredits.js';
import { resolveCreditCost } from './aiCredits.js';
import type { DocumentReference, Firestore } from 'firebase-admin/firestore';

import type { GenerateContentResult } from '../../src/services/GeminiService.js';

type AuthDenied = {
    ok: false;
    status: number;
    error: string;
    code?: string;
    message?: string;
    debugCode?: string;
};

function statusForServiceError(result: Extract<GenerateContentResult, { success: false }>): number {
    if (result.code === 'VALIDATION_ERROR' || result.code === 'MALFORMED_JSON') {
        return 400;
    }
    if (
        result.code === 'GEMINI_API_ERROR' &&
        /\b503\b|service unavailable|unavailable|RETIRED_MODEL|\b404\b|retired/i.test(result.error)
    ) {
        return 503;
    }
    return 500;
}

function statusForPipelineError(result: { code?: string; error?: string }) {
    if (result.code === 'VALIDATION_ERROR' || result.code === 'MALFORMED_JSON') {
        return 400;
    }
    if (result.code === 'MODERATION_FAILED') {
        return 422;
    }
    if (
        result.code === 'GEMINI_API_ERROR' &&
        /\b503\b|service unavailable|unavailable|RETIRED_MODEL|\b404\b|retired/i.test(result.error || '')
    ) {
        return 503;
    }
    return 500;
}

export default async function handler(req: any, res: any) {
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
        key: 'ai-generate',
        limit: 20,
        windowMs: 60_000,
    });

    res.setHeader('X-RateLimit-Limit', '20');
    res.setHeader('X-RateLimit-Remaining', String(rateLimit.remaining));
    res.setHeader('X-RateLimit-Reset', String(rateLimit.resetAt));

    if (!rateLimit.ok) {
        res.setHeader('Retry-After', String(rateLimit.retryAfterSec));
        return res.status(429).json({
            success: false,
            error: 'Too many requests. Please try again later.',
            code: 'RATE_LIMITED',
        });
    }

    const authResult = await requireAuth(req);
    if (authResult.ok === false) {
        const denied = authResult as AuthDenied;
        return res.status(denied.status).json({
            success: false,
            error: denied.error,
            code: denied.code || 'UNAUTHORIZED',
            message: denied.message,
            debugCode: denied.debugCode,
        });
    }

    const body = req.body as Record<string, unknown>;
    const legacyPostType = typeof body?.postType === 'string' ? body.postType : '';
    const parsed = parseAiGenerateBody({
        ...body,
        generationPackage:
            body.generationPackage ||
            (legacyPostType === 'magic_cover' ? 'image' : body.generationPackage),
        postType: legacyPostType === 'magic_cover' ? 'invitation' : body.postType,
    });

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
    const creditCost = resolveCreditCost(request.generationPackage, legacyPostType);

    let charged: { freeUsed: number; paidUsed: number } | null = null;
    let db: Firestore | null = null;
    let userRef: DocumentReference | null = null;

    try {
        ensureFirebaseAdmin();
        const spend = await spendAiCredits(authResult.uid, {
            generationPackage: request.generationPackage,
            postType: legacyPostType || request.postType,
            reasonSuffix: legacyPostType || request.generationPackage,
        });

        if (!spend.ok) {
            return res.status(403).json({
                success: false,
                error: 'insufficient_credits',
                message: `رصيدك غير كافٍ. تحتاج إلى ${spend.creditCost || creditCost} كريدت لإتمام هذه العملية.`,
            });
        }

        charged = { freeUsed: spend.freeUsed, paidUsed: spend.paidUsed };
        db = spend.db;
        userRef = spend.userRef;

        try {
            ensureFirebaseClientApp();
        } catch (clientErr) {
            await refundAiCredits(db, userRef, charged);
            const detail = clientErr instanceof Error ? clientErr.message : String(clientErr);
            console.error('[api/ai/generate] firebase_client', detail);
            return res.status(503).json({
                success: false,
                error: 'ai_client_not_configured',
                code: 'AI_CLIENT_NOT_CONFIGURED',
                message:
                    'إعداد Firebase للذكاء الاصطناعي غير مكتمل على Vercel. أضف VITE_FIREBASE_API_KEY وVITE_FIREBASE_APP_ID ثم Redeploy.',
            });
        }

        const callerContext = await resolveInvitationCallerContext(
            db,
            authResult.uid,
            spend.userData,
            request.postType,
        );

        const usesPipeline =
            request.generationPackage === 'image' ||
            request.generationPackage === 'invitation_bundle';

        if (usesPipeline) {
            const { runMultimodalPipeline } = await import('../../src/services/GeminiService.js');
            const pipelineResult = await runMultimodalPipeline({
                generationPackage: request.generationPackage,
                userPrompt: request.userPrompt,
                postType: request.postType,
                subType: request.subType,
                venueType: request.venueType,
                venueName: request.venueName,
                accountType: callerContext.accountType,
                businessContext: callerContext.businessContext,
                aspectRatio: request.aspectRatio,
            });

            if (pipelineResult.success === false) {
                await refundAiCredits(db, userRef, charged);
                return res.status(statusForPipelineError(pipelineResult)).json(pipelineResult);
            }

            const responseData = { ...pipelineResult.data };

            if (pipelineResult.pendingImage) {
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
                            '[api/ai/generate] media_library_persist',
                            libraryErr instanceof Error ? libraryErr.message : libraryErr,
                        );
                    }
                } catch (uploadErr) {
                    const uploadDetail = uploadErr instanceof Error ? uploadErr.message : String(uploadErr);
                    console.error('[api/ai/generate] storage_upload', uploadDetail);
                    await refundAiCredits(db, userRef, charged);
                    return res.status(503).json({
                        success: false,
                        error: 'storage_upload_failed',
                        code: 'STORAGE_UPLOAD_FAILED',
                        message:
                            'تم توليد الصورة لكن فشل حفظها في Firebase Storage. تحقق من FIREBASE_STORAGE_BUCKET ثم Redeploy.',
                        detail: uploadDetail,
                    });
                }
                responseData.image = {
                    url: uploaded.url,
                    mimeType: uploaded.mimeType,
                    mediaLibraryItem: uploaded.mediaLibraryItem,
                    moderation: pipelineResult.pendingImage.moderation,
                    imagePrompt: pipelineResult.pendingImage.imagePrompt,
                };
            }

            return res.status(200).json({
                success: true,
                data: responseData,
                meta: {
                    ...pipelineResult.meta,
                    creditsCharged: creditCost,
                },
            });
        }

        const { generateContent } = await import('../../src/services/GeminiService.js');

        /** @type {import('../../src/services/GeminiService.js').DatingInvitationContext | undefined} */
        let datingContext;
        if (request.subType === 'date') {
            datingContext = await resolveDatingInvitationPersonalization(
                db,
                authResult.uid,
                spend.userData || {},
                {
                    inviteeId: request.inviteeId || '',
                    date: request.date || '',
                    time: request.time || '',
                    venueDetails: request.venueDetails,
                },
            );
        }

        const result = await generateContent({
            userPrompt: request.userPrompt,
            postType: request.postType,
            subType: request.subType,
            venueType: request.venueType,
            venueName: request.venueName,
            accountType: callerContext.accountType,
            businessContext: callerContext.businessContext,
            datingContext,
            cardStructure: request.cardStructure || 'modern_minimal',
        });

        if (result.success === false) {
            await refundAiCredits(db, userRef, charged);
            return res.status(statusForServiceError(result)).json(result);
        }

        return res.status(200).json({
            ...result,
            meta: {
                creditsCharged: creditCost,
            },
        });
    } catch (error) {
        console.error('[api/ai/generate]', error);
        if (db && userRef && charged) {
            try {
                await refundAiCredits(db, userRef, charged);
            } catch (e) {
                console.error('[api/ai/generate] refund_failed', e);
            }
        }
        return res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Internal server error',
            code: 'GEMINI_API_ERROR',
        });
    }
}
