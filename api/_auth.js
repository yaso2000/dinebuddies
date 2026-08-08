import { getAuth } from 'firebase-admin/auth';
import { ensureFirebaseAdmin } from './_firebaseAdmin.js';

/**
 * Verifies a Firebase Auth ID token from `Authorization: Bearer <token>`.
 * @returns {{ ok: true, uid: string, claims: import('firebase-admin/auth').DecodedIdToken } | { ok: false, status: number, error: string, code?: string, message?: string, debugCode?: string }}
 */
export async function requireAuth(req) {
    const rawHeader = req.headers.authorization || req.headers.Authorization;
    const header = typeof rawHeader === 'string' ? rawHeader : Array.isArray(rawHeader) ? rawHeader[0] : '';

    if (!header.startsWith('Bearer ')) {
        return { ok: false, status: 401, error: 'Missing or invalid Authorization header' };
    }

    const token = header.slice('Bearer '.length).trim();
    if (!token) {
        return { ok: false, status: 401, error: 'Missing auth token' };
    }

    try {
        ensureFirebaseAdmin();
    } catch (err) {
        const detail = err instanceof Error ? err.message : String(err);
        console.error('[requireAuth] Firebase Admin not configured', detail);
        return {
            ok: false,
            status: 503,
            error: 'Server authentication is not configured',
            code: 'AUTH_NOT_CONFIGURED',
            message:
                detail.includes('private key') || detail.includes('PRIVATE KEY')
                    ? 'مفتاح Firebase Admin على Vercel غير صالح. استخدم FIREBASE_SERVICE_ACCOUNT_JSON أو أعد لصق private_key من JSON.'
                    : 'إعدادات Firebase Admin على السيرفر غير مكتملة. راجع متغيرات Vercel ثم Redeploy.',
        };
    }

    try {
        const claims = await getAuth().verifyIdToken(token);
        return { ok: true, uid: claims.uid, claims };
    } catch (err) {
        const firebaseCode = err && typeof err === 'object' && 'code' in err ? String(err.code) : '';
        console.error('[requireAuth] verifyIdToken failed', firebaseCode, err?.message || err);

        let message = 'انتهت الجلسة أو التوكن غير صالح. سجّل الخروج ثم الدخول مرة أخرى.';
        if (firebaseCode === 'auth/id-token-expired') {
            message = 'انتهت صلاحية الجلسة. سجّل الخروج ثم الدخول مرة أخرى.';
        } else if (firebaseCode === 'auth/argument-error') {
            message = 'تنسيق التوكن غير صالح. أعد تسجيل الدخول.';
        } else if (
            firebaseCode === 'auth/invalid-credential' ||
            firebaseCode === 'app/invalid-credential'
        ) {
            message =
                'مفتاح Firebase Admin على السيرفر لا يطابق مشروع التطبيق. راجع FIREBASE_PRIVATE_KEY وFIREBASE_PROJECT_ID على Vercel ثم Redeploy.';
        }

        return {
            ok: false,
            status: 401,
            error: 'Invalid or expired auth token',
            code: 'UNAUTHORIZED',
            message,
            debugCode: firebaseCode || undefined,
        };
    }
}
