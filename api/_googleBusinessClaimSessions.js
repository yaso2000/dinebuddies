import { randomUUID } from 'node:crypto';
import { FieldValue, getFirestore, Timestamp } from 'firebase-admin/firestore';
import { ensureFirebaseAdmin } from './_firebaseAdmin.js';

const COLLECTION = 'google_business_claim_sessions';
const SESSION_TTL_MS = 30 * 60 * 1000;

/**
 * @typedef {Object} GoogleBusinessClaimSession
 * @property {string} sessionId
 * @property {string} restaurantId
 * @property {string} googlePlaceId
 * @property {string} returnPath
 * @property {string | null} firebaseUid
 * @property {string | null} accessToken
 * @property {string | null} refreshToken
 * @property {Date | null} tokenExpiresAt
 * @property {boolean} placeVerified
 * @property {string | null} verifiedPlaceId
 * @property {string | null} matchedLocationName
 * @property {string | null} matchedLocationTitle
 * @property {Date} expiresAt
 */

/**
 * @param {string} restaurantId
 * @param {string} googlePlaceId
 * @param {string} returnPath
 * @param {string | null} [firebaseUid]
 */
export async function createGoogleBusinessClaimSession(restaurantId, googlePlaceId, returnPath, firebaseUid = null) {
    ensureFirebaseAdmin();
    const db = getFirestore();
    const sessionId = randomUUID();
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

    const doc = {
        sessionId,
        restaurantId: String(restaurantId || '').trim(),
        googlePlaceId: String(googlePlaceId || '').trim(),
        returnPath: String(returnPath || '/').trim() || '/',
        firebaseUid: firebaseUid ? String(firebaseUid) : null,
        accessToken: null,
        refreshToken: null,
        tokenExpiresAt: null,
        placeVerified: false,
        verifiedPlaceId: null,
        matchedLocationName: null,
        matchedLocationTitle: null,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        expiresAt: Timestamp.fromDate(expiresAt),
    };

    await db.collection(COLLECTION).doc(sessionId).set(doc);
    return { sessionId, expiresAt };
}

/**
 * @param {string} sessionId
 * @returns {Promise<GoogleBusinessClaimSession | null>}
 */
export async function loadGoogleBusinessClaimSession(sessionId) {
    ensureFirebaseAdmin();
    const db = getFirestore();
    const id = String(sessionId || '').trim();
    if (!id) return null;

    const snap = await db.collection(COLLECTION).doc(id).get();
    if (!snap.exists) return null;
    const data = snap.data() || {};

    const exp = data.expiresAt?.toDate?.() || data.expiresAt;
    if (exp && new Date(exp) < new Date()) {
        return null;
    }

    return {
        sessionId: id,
        restaurantId: String(data.restaurantId || ''),
        googlePlaceId: String(data.googlePlaceId || ''),
        returnPath: String(data.returnPath || '/'),
        firebaseUid: data.firebaseUid ? String(data.firebaseUid) : null,
        accessToken: data.accessToken ? String(data.accessToken) : null,
        refreshToken: data.refreshToken ? String(data.refreshToken) : null,
        tokenExpiresAt: data.tokenExpiresAt?.toDate?.() || data.tokenExpiresAt || null,
        placeVerified: data.placeVerified === true,
        verifiedPlaceId: data.verifiedPlaceId ? String(data.verifiedPlaceId) : null,
        matchedLocationName: data.matchedLocationName ? String(data.matchedLocationName) : null,
        matchedLocationTitle: data.matchedLocationTitle ? String(data.matchedLocationTitle) : null,
        expiresAt: exp ? new Date(exp) : new Date(Date.now() + SESSION_TTL_MS),
    };
}

/**
 * @param {string} sessionId
 * @param {{ accessToken: string, refreshToken?: string | null, expiresIn?: number | null }} tokens
 */
export async function storeGoogleBusinessClaimTokens(sessionId, tokens) {
    ensureFirebaseAdmin();
    const db = getFirestore();
    const id = String(sessionId || '').trim();
    if (!id) throw Object.assign(new Error('INVALID_SESSION'), { code: 'invalid-request' });

    const tokenExpiresAt =
        tokens.expiresIn != null && Number.isFinite(tokens.expiresIn)
            ? Timestamp.fromDate(new Date(Date.now() + tokens.expiresIn * 1000))
            : null;

    await db.collection(COLLECTION).doc(id).set(
        {
            accessToken: String(tokens.accessToken || ''),
            refreshToken: tokens.refreshToken ? String(tokens.refreshToken) : null,
            tokenExpiresAt,
            updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
    );
}

/**
 * @param {string} sessionId
 * @param {{ placeId: string, matchedLocationName?: string | null, matchedLocationTitle?: string | null }} verified
 */
export async function markGoogleBusinessClaimVerified(sessionId, verified) {
    ensureFirebaseAdmin();
    const db = getFirestore();
    const id = String(sessionId || '').trim();
    if (!id) throw Object.assign(new Error('INVALID_SESSION'), { code: 'invalid-request' });

    await db.collection(COLLECTION).doc(id).set(
        {
            placeVerified: true,
            verifiedPlaceId: String(verified.placeId || ''),
            matchedLocationName: verified.matchedLocationName ? String(verified.matchedLocationName) : null,
            matchedLocationTitle: verified.matchedLocationTitle ? String(verified.matchedLocationTitle) : null,
            updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
    );
}

/**
 * @param {GoogleBusinessClaimSession} session
 */
export function assertGoogleBusinessClaimSessionReady(session) {
    if (!session) {
        throw Object.assign(new Error('SESSION_NOT_FOUND'), { code: 'session-not-found' });
    }
    if (!session.accessToken) {
        throw Object.assign(new Error('SESSION_NOT_AUTHENTICATED'), { code: 'session-not-authenticated' });
    }
    if (!session.placeVerified) {
        throw Object.assign(new Error('PLACE_NOT_VERIFIED'), { code: 'place-not-verified' });
    }
}
