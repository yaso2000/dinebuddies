/**
 * GET  /api/ai/auth-check — admin env loaded on server (no secret values).
 * POST /api/ai/auth-check — verify Bearer token (same as /api/ai/generate auth).
 */
import { requireAuth } from '../_auth.js';
import { getFirebaseAdminCertConfig, ensureFirebaseAdmin } from '../_firebaseAdmin.js';

export default async function handler(req, res) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(204).end();
    }

    if (req.method === 'GET') {
        try {
            const cfg = getFirebaseAdminCertConfig();
            ensureFirebaseAdmin();
            return res.status(200).json({
                success: true,
                adminConfigured: true,
                adminInitialized: true,
                adminProjectId: cfg.projectId,
                hasPrivateKeyId: Boolean(cfg.privateKeyId),
                usesServiceAccountJson: Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_JSON),
            });
        } catch (e) {
            const message = e instanceof Error ? e.message : 'Admin not configured';
            return res.status(503).json({
                success: false,
                adminConfigured: false,
                adminInitialized: false,
                error: message,
                code: 'AUTH_NOT_CONFIGURED',
            });
        }
    }

    if (req.method !== 'POST') {
        res.setHeader('Allow', 'GET, POST, OPTIONS');
        return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    const auth = await requireAuth(req);
    if (!auth.ok) {
        let adminProjectId = null;
        try {
            adminProjectId = getFirebaseAdminCertConfig().projectId;
        } catch {
            /* ignore */
        }
        return res.status(auth.status).json({
            success: false,
            error: auth.error,
            code: auth.code || 'UNAUTHORIZED',
            message: auth.message,
            debugCode: auth.debugCode,
            adminProjectId,
        });
    }

    ensureFirebaseAdmin();
    return res.status(200).json({
        success: true,
        uid: auth.uid,
        adminProjectId: getFirebaseAdminCertConfig().projectId,
    });
}
