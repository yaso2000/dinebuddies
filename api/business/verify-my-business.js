/**
 * POST /api/business/verify-my-business
 * Body: { sessionId }   Header: Authorization: Bearer <firebase idToken>
 *
 * Grants the "Google Business verified" badge to the caller's OWN business when
 * the Google account that completed the business.manage OAuth (stored on the
 * claim session) actually manages the business's Google Place. The flag is set
 * SERVER-SIDE (never trusted from the client) so the badge is a real signal.
 * Unverified businesses are allowed — they simply do not get the badge.
 */
import { requireAuth } from '../_auth.js';
import { ensureFirebaseAdmin } from '../_firebaseAdmin.js';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { loadGoogleBusinessClaimSession } from '../_googleBusinessClaimSessions.js';
import { userManagesGooglePlace } from '../_googleBusinessProfileLocations.js';
import { syncUserPublicProfile } from '../_publicProfileSync.js';
import { applyApiCors, handleCorsPreflight } from '../_cors.js';

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
    const uid = authResult.uid;

    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const sessionId = String(body.sessionId || '').trim();
    if (!sessionId) {
        return res.status(400).json({ status: 'error', code: 'invalid-request', message: 'sessionId is required' });
    }

    const session = await loadGoogleBusinessClaimSession(sessionId);
    if (!session) {
        return res.status(404).json({ status: 'error', code: 'session-not-found', message: 'Verification session expired or not found.' });
    }
    if (!session.accessToken) {
        return res.status(400).json({ status: 'error', code: 'session-not-authenticated', message: 'Complete Google sign-in first.' });
    }
    // The session is stamped with the initiating user at auth-url time — it must
    // belong to the caller so one user cannot borrow another's verified session.
    if (session.firebaseUid && session.firebaseUid !== uid) {
        return res.status(403).json({ status: 'error', code: 'session-mismatch', message: 'This verification session belongs to a different account.' });
    }

    ensureFirebaseAdmin();
    const db = getFirestore();
    const userRef = db.collection('users').doc(uid);
    const snap = await userRef.get();
    const u = snap.exists ? snap.data() || {} : {};
    const businessInfo = u.businessInfo && typeof u.businessInfo === 'object' ? u.businessInfo : {};

    const role = String(u.role || u.accountType || '').toLowerCase();
    const isBusiness =
        role === 'business' || role === 'partner' || String(u.accountType || '').toLowerCase() === 'business';
    if (!isBusiness) {
        return res.status(403).json({ status: 'error', code: 'not-a-business', message: 'Only a business account can be verified.' });
    }

    const placeId = String(businessInfo.placeId || session.googlePlaceId || '').trim();
    if (!placeId) {
        return res.status(400).json({
            status: 'error',
            code: 'no-place',
            message: 'Your business has no Google location to verify. Add your Google Business listing first.',
        });
    }

    try {
        const result = await userManagesGooglePlace(session.accessToken, placeId);
        const verified = !!(result.managed && result.matchedLocation);
        const now = FieldValue.serverTimestamp();

        if (verified) {
            await userRef.set(
                {
                    businessInfo: {
                        google_business_verified: true,
                        google_business_verified_email: session.verifiedGoogleEmail || null,
                        google_business_verified_at: now,
                    },
                },
                { merge: true }
            );
        } else {
            await userRef.set({ businessInfo: { google_business_verified: false } }, { merge: true });
        }

        // Mirror onto the public profile so the badge shows to visitors too.
        try {
            await syncUserPublicProfile(uid);
        } catch (syncErr) {
            console.warn('[verify-my-business] public profile sync:', syncErr?.message || syncErr);
        }

        return res.status(200).json({
            status: 'ok',
            verified,
            verifiedGoogleEmail: verified ? session.verifiedGoogleEmail || null : null,
        });
    } catch (err) {
        console.error('[verify-my-business]', err);
        return res.status(502).json({
            status: 'error',
            code: 'gbp-api-error',
            message: err instanceof Error ? err.message : 'Google Business Profile API failed',
        });
    }
}
