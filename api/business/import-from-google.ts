/**
 * POST /api/business/import-from-google
 * Body preview:  { placeId, action: 'preview' }
 * Body publish:  { placeId, action: 'publish', previewCoverImage?: string }
 *
 * Preview — Google fields + base64 cover in memory (no Storage / Firestore).
 * Publish — upload cover buffer to Storage, then write Firestore.
 */
import { applyApiCors, handleCorsPreflight } from '../_cors.js';
import { takeRateLimit } from '../_rateLimit.js';
import { requireAdminAuth } from '../_adminRequire.js';
import { fetchGooglePlaceMinimal, fetchGooglePlacePreview } from '../_googlePlacesMinimal.js';
import {
    ingestVirtualBusinessFromGoogle,
    refreshVirtualBusinessFromGoogle,
    loadExistingRestaurantForImport,
} from '../_virtualBusinessIngest.js';
import type {
    ImportFromGoogleApiError,
    ImportFromGooglePreviewSuccess,
    ImportFromGooglePublishSuccess,
} from '../../src/types/virtualBusinessPlaceholder.js';

type ImportAction = 'preview' | 'publish';

type ImportRequestBody = {
    placeId?: string;
    action?: ImportAction;
    previewCoverImage?: string;
};

type VercelRequest = {
    method?: string;
    body?: unknown;
    headers: Record<string, string | string[] | undefined>;
};

type VercelResponse = {
    setHeader: (name: string, value: string) => void;
    status: (code: number) => {
        json: (
            body:
                | ImportFromGooglePreviewSuccess
                | ImportFromGooglePublishSuccess
                | ImportFromGoogleApiError
                | { message: string },
        ) => void;
        end: () => void;
    };
};

function readJsonBody(req: VercelRequest): ImportRequestBody {
    if (req.body && typeof req.body === 'object') {
        return req.body as ImportRequestBody;
    }
    return {};
}

function buildPreviewPayload(details: Record<string, unknown>) {
    const {
        previewCoverImage: _dropPreview,
        photoError: _dropPhotoError,
        ...rest
    } = details;
    void _dropPreview;
    void _dropPhotoError;
    return rest;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    applyApiCors(req, res);
    if (handleCorsPreflight(req, res)) return;

    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    const adminAuth = await requireAdminAuth(req);
    if (!adminAuth.ok) {
        return res.status(adminAuth.status).json({
            status: 'error',
            code: adminAuth.code || 'unauthorized',
            message: adminAuth.message || adminAuth.error,
        });
    }

    const rl = takeRateLimit(req, {
        key: 'import-from-google',
        limit: 12,
        windowMs: 60_000,
        identifier: adminAuth.uid,
    });
    res.setHeader('X-RateLimit-Limit', '12');
    res.setHeader('X-RateLimit-Remaining', String(rl.remaining));
    if (!rl.ok) {
        res.setHeader('Retry-After', String(rl.retryAfterSec));
        return res.status(429).json({
            status: 'error',
            code: 'rate-limit',
            message: `Too many import requests. Wait ${rl.retryAfterSec} seconds and try again.`,
        });
    }

    const body = readJsonBody(req);
    const placeId = String(body.placeId || '').trim();
    const action: ImportAction = body.action === 'publish' ? 'publish' : 'preview';

    if (!placeId || placeId.length < 10) {
        return res.status(400).json({
            status: 'error',
            code: 'invalid-place-id',
            message: 'A valid Google placeId is required',
        });
    }

    try {
        if (action === 'preview') {
            const existing = await loadExistingRestaurantForImport(placeId);
            const previewResult = await fetchGooglePlacePreview(placeId);

            return res.status(200).json({
                status: 'ok',
                action: 'preview',
                placeId,
                preview: buildPreviewPayload(previewResult),
                previewCoverImage: previewResult.previewCoverImage,
                ...(previewResult.photoError ? { photoWarning: previewResult.photoError } : {}),
                ...(existing
                    ? { alreadyExisted: true, docId: existing.docId }
                    : {}),
            });
        }

        const previewCoverImage = String(body.previewCoverImage || '').trim();
        const existing = await loadExistingRestaurantForImport(placeId);

        const details = await fetchGooglePlaceMinimal(placeId, {
            preserveCoverUrl: existing
                ? String(
                      (existing.data?.businessInfo as { coverImage?: string } | undefined)?.coverImage ||
                          existing.data?.photo_url ||
                          '',
                  ).trim()
                : '',
            preserveCoverStoragePath: existing
                ? String(
                      existing.data?.coverImageStoragePath ||
                          (existing.data?.businessInfo as { coverImageStoragePath?: string } | undefined)
                              ?.coverImageStoragePath ||
                          '',
                  ).trim()
                : '',
            skipPhotoUpload: true,
        });

        const publishDetails = {
            ...details,
            ...(previewCoverImage ? { previewCoverImage } : {}),
        };

        if (existing) {
            const { docId, placeholder } = await refreshVirtualBusinessFromGoogle(
                publishDetails,
                existing.docId,
            );
            return res.status(200).json({
                status: 'ok',
                action: 'publish',
                docId,
                alreadyExisted: true,
                refreshed: true,
                directorySynced: true,
                placeholder,
            });
        }

        const { docId, placeholder } = await ingestVirtualBusinessFromGoogle(publishDetails);
        return res.status(200).json({
            status: 'ok',
            action: 'publish',
            docId,
            placeholder,
            directorySynced: true,
        });
    } catch (err) {
        const code =
            err && typeof err === 'object' && 'code' in err
                ? String((err as { code?: string }).code)
                : '';

        if (code === 'places-not-configured') {
            return res.status(503).json({
                status: 'error',
                code: 'places-not-configured',
                message: 'Google Places API is not configured on the server',
            });
        }
        if (code === 'google-places-failed') {
            return res.status(502).json({
                status: 'error',
                code: 'google-places-failed',
                message: err instanceof Error ? err.message : 'Google Places request failed',
            });
        }
        if (
            code === 'photo-download-failed' ||
            code === 'photo-storage-failed' ||
            code === 'invalid-cover-data'
        ) {
            return res.status(502).json({
                status: 'error',
                code,
                message:
                    err instanceof Error
                        ? err.message
                        : 'Failed to persist cover image to Firebase Storage',
            });
        }

        console.error('[import-from-google]', placeId, action, err);
        return res.status(500).json({
            status: 'error',
            code: code || 'server-error',
            message: err instanceof Error ? err.message : 'Failed to import place',
        });
    }
}
