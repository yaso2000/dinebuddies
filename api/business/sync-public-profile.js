import { requireAuth } from '../_auth.js';
import { applyApiCors, handleCorsPreflight } from '../_cors.js';
import { syncUserPublicProfile } from '../_publicProfileSync.js';

export default async function handler(req, res) {
    applyApiCors(req, res);
    if (handleCorsPreflight(req, res)) return;

    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    const authResult = await requireAuth(req);
    if (!authResult.ok) {
        return res.status(authResult.status).json({
            status: 'error',
            code: authResult.code || 'unauthorized',
            message: authResult.message || authResult.error,
        });
    }

    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const targetUid = String(body.uid || authResult.uid).trim();
    if (targetUid !== authResult.uid) {
        return res.status(403).json({
            status: 'error',
            code: 'forbidden',
            message: 'You can only sync your own business profile',
        });
    }

    try {
        const result = await syncUserPublicProfile(targetUid);
        return res.status(200).json({ status: 'ok', ...result });
    } catch (err) {
        const code = err?.code || 'server-error';
        if (code === 'not-found') {
            return res.status(404).json({ status: 'error', code, message: 'Business user not found' });
        }
        console.error('[sync-public-profile]', err);
        return res.status(500).json({
            status: 'error',
            code: 'server-error',
            message: 'Failed to sync public profile',
        });
    }
}
