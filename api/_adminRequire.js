import { getFirestore } from 'firebase-admin/firestore';
import { requireAuth } from './_auth.js';
import { ensureFirebaseAdmin } from './_firebaseAdmin.js';

const ADMIN_PANEL_ROLES = new Set(['admin', 'moderator', 'support', 'staff']);

const DEFAULT_ADMIN_EMAILS = [
    'admin@dinebuddies.com',
    'yaser@dinebuddies.com',
    'info@dinebuddies.com.au',
    'y.abohamed@gmail.com',
];

function adminEmailAllowlist() {
    const raw = String(process.env.ADMIN_EMAILS || '').trim();
    if (!raw) return DEFAULT_ADMIN_EMAILS.map((e) => e.toLowerCase());
    return raw
        .split(',')
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean);
}

/**
 * @param {import('firebase-admin/auth').DecodedIdToken} claims
 */
async function roleFromFirestore(uid, claims) {
    const tokenRole = String(claims.role || '').toLowerCase();
    if (ADMIN_PANEL_ROLES.has(tokenRole)) return tokenRole;

    try {
        ensureFirebaseAdmin();
        const snap = await getFirestore().collection('users').doc(uid).get();
        if (!snap.exists) return tokenRole;
        const data = snap.data() || {};
        return String(data.role || '').toLowerCase();
    } catch {
        return tokenRole;
    }
}

/**
 * @returns {Promise<
 *   | { ok: true; uid: string; claims: import('firebase-admin/auth').DecodedIdToken }
 *   | { ok: false; status: number; error: string; code?: string; message?: string }
 * >}
 */
export async function requireAdminAuth(req) {
    const authResult = await requireAuth(req);
    if (!authResult.ok) return authResult;

    const email = String(authResult.claims.email || '').toLowerCase();
    if (adminEmailAllowlist().includes(email)) {
        return authResult;
    }

    const role = await roleFromFirestore(authResult.uid, authResult.claims);
    if (ADMIN_PANEL_ROLES.has(role)) {
        return authResult;
    }

    return {
        ok: false,
        status: 403,
        error: 'Admin access required',
        code: 'admin-required',
        message: 'Admin access required',
    };
}
