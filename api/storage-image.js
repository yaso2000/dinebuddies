import { requireAuth } from './_auth.js';
import { downloadStorageObjectBuffer } from './_aiStorage.js';

const AI_STORAGE_PATH =
    /^(invitations|ai-design-studio|community-posts|featured_posts|business-motion)\/([A-Za-z0-9_-]+)\/ai_\d+_[a-f0-9-]+\.(png|jpe?g|webp)$/i;

/**
 * Authenticated fallback when Firebase token download URLs 404 in the browser.
 * GET /api/storage-image?path=invitations/{uid}/ai_....png&bucket=dinebuddies.firebasestorage.app
 */
export default async function handler(req, res) {
    if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
        return res.status(204).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'method_not_allowed' });
    }

    const authResult = await requireAuth(req);
    if (!authResult.ok) {
        return res.status(authResult.status).json({
            error: authResult.error,
            code: authResult.code,
            message: authResult.message,
        });
    }

    const objectPath = String(req.query?.path || '').trim();
    const match = AI_STORAGE_PATH.exec(objectPath);
    if (!match) {
        return res.status(400).json({ error: 'invalid_path' });
    }

    const ownerUid = match[2];
    if (ownerUid !== authResult.uid) {
        return res.status(403).json({ error: 'forbidden' });
    }

    const preferredBucket = String(req.query?.bucket || '').trim();

    try {
        const { buffer, contentType } = await downloadStorageObjectBuffer(objectPath, {
            preferredBucket: preferredBucket || undefined,
        });
        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'private, max-age=120');
        res.setHeader('Access-Control-Allow-Origin', '*');
        return res.status(200).send(buffer);
    } catch (err) {
        const detail = err instanceof Error ? err.message : String(err);
        console.error('[api/storage-image]', detail);
        return res.status(404).json({ error: 'not_found', detail });
    }
}
