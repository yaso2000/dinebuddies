import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { ensureFirebaseAdmin } from './_firebaseAdmin.js';
import {
    consumeVerifiedPendingPhone,
    lookupBusinessPhoneInUsers,
} from './_businessPhoneRegistry.js';

/**
 * إنشاء حساب Firebase Auth + مستند users/{uid} أو دمج ملف غير مُطالب به.
 * @param {{
 *   standardizedPhone: string,
 *   verificationToken: string,
 *   email: string,
 *   password: string,
 *   businessInfo: Record<string, unknown>,
 *   claimBusinessId?: string | null,
 *   referredBy?: string | null,
 * }} input
 */
export async function completeBusinessPhoneSignup(input) {
    ensureFirebaseAdmin();
    const db = getFirestore();
    const auth = getAuth();

    const standardizedPhone = String(input.standardizedPhone || '').trim();
    const verificationToken = String(input.verificationToken || '').trim();
    const email = String(input.email || '').trim().toLowerCase();
    const password = String(input.password || '');

    if (!standardizedPhone || !verificationToken || !email || password.length < 6) {
        throw Object.assign(new Error('INVALID_COMPLETE_PAYLOAD'), { code: 'invalid-request' });
    }

    const consumed = await consumeVerifiedPendingPhone(standardizedPhone, verificationToken);
    if (!consumed) {
        throw Object.assign(new Error('VERIFICATION_EXPIRED'), { code: 'verification-expired' });
    }

    const lookup = await lookupBusinessPhoneInUsers(standardizedPhone);
    if (lookup.flow === 'claimed') {
        throw Object.assign(new Error('PHONE_IN_USE'), { code: 'phone-already-in-use' });
    }

    let mergedBusinessInfo = { ...(input.businessInfo || {}) };
    const claimId = input.claimBusinessId || (lookup.flow === 'claim' ? lookup.businessId : null);

    if (claimId) {
        const claimSnap = await db.collection('users').doc(claimId).get();
        if (claimSnap.exists) {
            const claimData = claimSnap.data() || {};
            const claimBi =
                claimData.businessInfo && typeof claimData.businessInfo === 'object'
                    ? claimData.businessInfo
                    : {};
            mergedBusinessInfo = { ...claimBi, ...mergedBusinessInfo };
        }
    }

    mergedBusinessInfo.standardized_phone = standardizedPhone;
    mergedBusinessInfo.isClaimed = true;
    mergedBusinessInfo.phone_verified = true;
    mergedBusinessInfo.phone_claimed = true;
    mergedBusinessInfo.createdAt = FieldValue.serverTimestamp();
    if (!mergedBusinessInfo.phone) {
        mergedBusinessInfo.phone = standardizedPhone;
    }

    let userRecord;
    try {
        userRecord = await auth.createUser({
            email,
            password,
            displayName: String(mergedBusinessInfo.businessName || '').trim() || undefined,
        });
    } catch (err) {
        const code = err && typeof err === 'object' && 'code' in err ? String(err.code) : '';
        if (code === 'auth/email-already-exists') {
            throw Object.assign(new Error('EMAIL_IN_USE'), { code: 'auth/email-already-in-use' });
        }
        throw err;
    }

    const uid = userRecord.uid;
    const userPayload = {
        uid,
        email,
        authInfo: { email },
        accountType: 'business',
        role: 'partner',
        display_name: String(mergedBusinessInfo.businessName || '').trim() || email,
        photo_url: null,
        created_at: FieldValue.serverTimestamp(),
        last_active_time: FieldValue.serverTimestamp(),
        pendingBusinessRegistration: false,
        businessProfileSetupPending: false,
        businessInfo: mergedBusinessInfo,
        claimedFromBusinessId: claimId || null,
        followersCount: 0,
        ownedCommunities: [],
    };
    if (input.referredBy) {
        userPayload.referred_by = input.referredBy;
    }

    await db.collection('users').doc(uid).set(userPayload);

    if (claimId && claimId !== uid) {
        await db.collection('users').doc(claimId).set(
            {
                unclaimedProfileMergedInto: uid,
                mergedAt: FieldValue.serverTimestamp(),
                businessInfo: {
                    isClaimed: true,
                    phone_claimed: true,
                    standardized_phone: standardizedPhone,
                },
            },
            { merge: true }
        );
    }

    return {
        uid,
        email,
        flow: claimId ? 'claim' : 'new',
        claimedFromBusinessId: claimId || null,
    };
}
