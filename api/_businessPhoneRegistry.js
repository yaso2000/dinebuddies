import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { ensureFirebaseAdmin } from './_firebaseAdmin.js';
import { e164ToDocKey } from './_phoneUtils.js';

const PENDING_COLLECTION = 'business_phone_pending';
const PENDING_TTL_MS = 30 * 60 * 1000;

/**
 * @typedef {'new' | 'claim' | 'claimed'} PhoneLookupFlow
 * @typedef {{ flow: PhoneLookupFlow, businessId?: string, businessName?: string }} PhoneLookupResult
 */

/**
 * Whether an existing users/{id} doc is an unclaimed scraped/AI business profile.
 * @param {FirebaseFirestore.DocumentData | undefined} data
 */
export function isUnclaimedBusinessProfile(data) {
    if (!data || typeof data !== 'object') return false;
    const bi = data.businessInfo;
    if (bi && typeof bi === 'object' && bi.isClaimed === false) return true;
    if (data.pendingBusinessRegistration === true) return true;
    if (bi && typeof bi === 'object') {
        if (bi.unclaimed === true) return true;
        if (bi.createdBy === 'scraped' || bi.createdBy === 'ai' || bi.createdBy === 'import') return true;
        if (bi.phone_claimed === false) return true;
    }
    const role = String(data.role || '').toLowerCase();
    const at = String(data.accountType || '').toLowerCase();
    const isBiz = role === 'business' || role === 'partner' || at === 'business';
    if (isBiz && !String(data.email || '').trim()) return true;
    return false;
}

/**
 * @param {FirebaseFirestore.DocumentData | undefined} data
 */
export function isClaimedBusinessProfile(data) {
    if (!data || typeof data !== 'object') return false;
    const bi = data.businessInfo;
    if (bi && typeof bi === 'object') {
        if (bi.isClaimed === true) return true;
        if (bi.isClaimed === false) return false;
    }
    if (data.businessInfo?.phone_claimed === true) return true;
    if (data.businessInfo?.phone_verified === true) return true;
    if (isUnclaimedBusinessProfile(data)) return false;
    const role = String(data.role || '').toLowerCase();
    const at = String(data.accountType || '').toLowerCase();
    if (
        (role === 'business' || role === 'partner' || at === 'business') &&
        data.pendingBusinessRegistration !== true
    ) {
        return true;
    }
    return false;
}

/**
 * @param {string} standardizedE164
 * @returns {Promise<PhoneLookupResult>}
 */
export async function lookupBusinessPhoneInUsers(standardizedE164) {
    ensureFirebaseAdmin();
    const db = getFirestore();
    const snap = await db
        .collection('users')
        .where('businessInfo.standardized_phone', '==', standardizedE164)
        .limit(5)
        .get();

    if (snap.empty) {
        return { flow: 'new' };
    }

    for (const doc of snap.docs) {
        const data = doc.data();
        if (isClaimedBusinessProfile(data)) {
            return { flow: 'claimed' };
        }
    }

    const first = snap.docs[0];
    const data = first.data();
    const bi = data.businessInfo || {};
    return {
        flow: 'claim',
        businessId: first.id,
        businessName: bi.businessName || data.display_name || '',
    };
}

/**
 * Reserve phone for OTP flow (new signups).
 * @param {string} standardizedE164
 * @param {{ claimBusinessId?: string }} [opts]
 */
export async function upsertPendingBusinessPhone(standardizedE164, opts = {}) {
    ensureFirebaseAdmin();
    const db = getFirestore();
    const key = e164ToDocKey(standardizedE164);
    const ref = db.collection(PENDING_COLLECTION).doc(key);
    const expiresAt = new Date(Date.now() + PENDING_TTL_MS);
    await ref.set(
        {
            standardized_phone: standardizedE164,
            status: 'pending_otp',
            claimBusinessId: opts.claimBusinessId || null,
            updatedAt: FieldValue.serverTimestamp(),
            expiresAt,
        },
        { merge: true }
    );
    return key;
}

/**
 * @param {string} standardizedE164
 * @param {string} verificationToken
 */
export async function markPendingPhoneVerified(standardizedE164, verificationToken) {
    ensureFirebaseAdmin();
    const db = getFirestore();
    const key = e164ToDocKey(standardizedE164);
    const ref = db.collection(PENDING_COLLECTION).doc(key);
    const expiresAt = new Date(Date.now() + PENDING_TTL_MS);
    await ref.set(
        {
            standardized_phone: standardizedE164,
            status: 'verified',
            verificationToken,
            verifiedAt: FieldValue.serverTimestamp(),
            expiresAt,
        },
        { merge: true }
    );
}

/**
 * @param {string} standardizedE164
 * @param {string} verificationToken
 * @returns {Promise<boolean>}
 */
export async function consumeVerifiedPendingPhone(standardizedE164, verificationToken) {
    ensureFirebaseAdmin();
    const db = getFirestore();
    const key = e164ToDocKey(standardizedE164);
    const ref = db.collection(PENDING_COLLECTION).doc(key);
    const snap = await ref.get();
    if (!snap.exists) return false;
    const data = snap.data() || {};
    if (data.status !== 'verified') return false;
    if (data.verificationToken !== verificationToken) return false;
    const exp = data.expiresAt?.toDate?.() || data.expiresAt;
    if (exp && new Date(exp) < new Date()) return false;
    await ref.set(
        {
            status: 'consumed',
            consumedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
    );
    return true;
}
