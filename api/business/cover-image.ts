/**
 * GET /api/business/cover-image?placeId=ChIJ...
 * Public cover for admin-imported businesses.
 * Streams image bytes (same-origin) so <img> tags work without Storage CORS/token issues.
 * Optional ?redirect=1 returns 302 to the persisted download URL instead.
 */
import { applyApiCors, handleCorsPreflight } from '../_cors.js';
import { ensureFirebaseAdmin } from '../_firebaseAdmin.js';
import {
    downloadStorageObjectBuffer,
    resolveBusinessCoverObjectPath,
    resolveBusinessCoverPublicUrl,
} from '../_businessCoverResolve.js';

import type { BusinessCoverImageErrorResponse } from '../../src/types/businessCoverImage.js';

type VercelRequest = {
    method?: string;
    query?: Record<string, string | string[] | undefined>;
    headers: Record<string, string | string[] | undefined>;
};

type VercelResponse = {
    setHeader: (name: string, value: string) => void;
    redirect: (status: number, url: string) => void;
    status: (code: number) => {
        json: (body: BusinessCoverImageErrorResponse | { error: string }) => void;
        send: (body: Buffer) => void;
        end: () => void;
    };
};

function readQueryParam(req: VercelRequest, key: string): string {
    const raw = req.query?.[key];
    if (Array.isArray(raw)) return String(raw[0] || '').trim();
    return String(raw || '').trim();
}

function readPlaceId(req: VercelRequest): string {
    return readQueryParam(req, 'placeId');
}

async function streamRemoteImageUrl(
    res: VercelResponse,
    url: string,
): Promise<boolean> {
    try {
        const imageRes = await fetch(url, { redirect: 'follow' });
        if (!imageRes.ok) return false;
        const buffer = Buffer.from(await imageRes.arrayBuffer());
        if (buffer.length < 500) return false;
        res.setHeader('Content-Type', imageRes.headers.get('content-type') || 'image/jpeg');
        res.status(200).send(buffer);
        return true;
    } catch {
        return false;
    }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    applyApiCors(req, res);
    res.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');

    if (handleCorsPreflight(req, res)) return;

    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return res.status(405).json({ error: 'method_not_allowed' });
    }

    const placeId = readPlaceId(req);
    if (!placeId || placeId.length < 8) {
        return res.status(400).json({ error: 'invalid_place_id' });
    }

    const forceRedirect = readQueryParam(req, 'redirect') === '1';

    try {
        ensureFirebaseAdmin();

        const objectPath = await resolveBusinessCoverObjectPath(placeId, { allowRepair: true });
        if (objectPath) {
            const { buffer, contentType } = await downloadStorageObjectBuffer(objectPath);
            if (buffer?.length) {
                res.setHeader('Content-Type', contentType || 'image/jpeg');
                return res.status(200).send(buffer);
            }
        }

        const publicUrl = await resolveBusinessCoverPublicUrl(placeId, { allowRepair: false });
        if (publicUrl) {
            if (forceRedirect) {
                return res.redirect(302, publicUrl);
            }
            const streamed = await streamRemoteImageUrl(res, publicUrl);
            if (streamed) return;
        }

        return res.status(404).json({ error: 'cover_not_found' });
    } catch (err) {
        console.error('[cover-image]', placeId, err instanceof Error ? err.message : err);
        return res.status(404).json({ error: 'cover_not_found' });
    }
}
