import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { ensureFirebaseAdmin } from './_firebaseAdmin.js';
import { lookupBusinessPhoneInUsers } from './_businessPhoneRegistry.js';

/**
 * @param {string | null | undefined} phone
 */
function normalizeAuthPhone(phone) {
    const s = String(phone || '').trim();
    if (!s) return '';
    return s.startsWith('+') ? s : `+${s.replace(/\D/g, '')}`;
}

/**
 * Finalize business Firestore profile after Firebase Phone Auth (+ email link on client).
 * @param {{
 *   firebaseUid: string,
 *   standardizedPhone: string,
 *   email: string,
 *   businessInfo: Record<string, unknown>,
 *   claimBusinessId?: string | null,
 *   referredBy?: string | null,
 * }} input
 */
export async function completeBusinessPhoneSignup(input) {
    ensureFirebaseAdmin();
    const db = getFirestore();
    const auth = getAuth();

    const firebaseUid = String(input.firebaseUid || '').trim();
    const standardizedPhone = String(input.standardizedPhone || '').trim();
    const email = String(input.email || '').trim().toLowerCase();

    if (!firebaseUid || !standardizedPhone || !email) {
        throw Object.assign(new Error('INVALID_COMPLETE_PAYLOAD'), { code: 'invalid-request' });
    }

    const userRecord = await auth.getUser(firebaseUid);
    const accountPhone = normalizeAuthPhone(userRecord.phoneNumber);
    if (!accountPhone || accountPhone !== standardizedPhone) {
        throw Object.assign(new Error('PHONE_MISMATCH'), { code: 'phone-mismatch' });
    }

    const accountEmail = String(userRecord.email || '').trim().toLowerCase();
    if (accountEmail && accountEmail !== email) {
        throw Object.assign(new Error('EMAIL_MISMATCH'), { code: 'invalid-request' });
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

    if (!accountEmail) {
        try {
            await auth.updateUser(firebaseUid, {
                email,
                emailVerified: false,
                displayName: String(mergedBusinessInfo.businessName || '').trim() || undefined,
            });
        } catch (err) {
            const code = err && typeof err === 'object' && 'code' in err ? String(err.code) : '';
            if (code === 'auth/email-already-exists') {
                throw Object.assign(new Error('EMAIL_IN_USE'), { code: 'auth/email-already-in-use' });
            }
            throw err;
        }
    }

    const userPayload = {
        uid: firebaseUid,
        email,
        authInfo: { email },
        accountType: 'business',
        role: 'partner',
        display_name: String(mergedBusinessInfo.businessName || '').trim() || email,
        photo_url: userRecord.photoURL || null,
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

    await db.collection('users').doc(firebaseUid).set(userPayload, { merge: true });

    if (claimId && claimId !== firebaseUid) {
        await db.collection('users').doc(claimId).set(
            {
                unclaimedProfileMergedInto: firebaseUid,
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
        uid: firebaseUid,
        email,
        flow: claimId ? 'claim' : 'new',
        claimedFromBusinessId: claimId || null,
    };
}
