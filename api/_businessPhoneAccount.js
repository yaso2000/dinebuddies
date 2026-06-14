import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { ensureFirebaseAdmin } from './_firebaseAdmin.js';
import { lookupBusinessPhone } from './_businessPhoneRegistry.js';
import {
    claimRestaurantOwnershipTransaction,
    buildUserProfileFromClaimedRestaurant,
} from './_restaurantClaim.js';

/**
 * @param {string | null | undefined} phone
 */
function normalizeAuthPhone(phone) {
    const s = String(phone || '').trim();
    if (!s) return '';
    return s.startsWith('+') ? s : `+${s.replace(/\D/g, '')}`;
}

/**
 * @param {import('firebase-admin/firestore').Firestore} db
 * @param {string} claimId
 */
async function resolveClaimSource(db, claimId) {
    const restaurantSnap = await db.collection('restaurants').doc(claimId).get();
    if (restaurantSnap.exists) {
        return { source: 'restaurants', snap: restaurantSnap };
    }
    const userSnap = await db.collection('users').doc(claimId).get();
    if (userSnap.exists) {
        return { source: 'users', snap: userSnap };
    }
    return { source: null, snap: null };
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

    const lookup = await lookupBusinessPhone(standardizedPhone);
    if (lookup.flow === 'claimed') {
        const claimId = input.claimBusinessId || null;
        if (claimId) {
            const { source, snap } = await resolveClaimSource(db, claimId);
            if (source === 'restaurants' && snap?.exists) {
                const data = snap.data() || {};
                if (data.isClaimed === true && data.ownerId === firebaseUid) {
                    /* allow idempotent finalize for same owner */
                } else if (data.isClaimed === true && data.ownerId !== firebaseUid) {
                    throw Object.assign(new Error('PHONE_IN_USE'), { code: 'phone-already-in-use' });
                }
            } else if (source === 'users' && snap?.exists) {
                const data = snap.data() || {};
                if (data.businessInfo?.isClaimed === true && claimId !== firebaseUid) {
                    throw Object.assign(new Error('PHONE_IN_USE'), { code: 'phone-already-in-use' });
                }
            } else {
                throw Object.assign(new Error('PHONE_IN_USE'), { code: 'phone-already-in-use' });
            }
        } else {
            throw Object.assign(new Error('PHONE_IN_USE'), { code: 'phone-already-in-use' });
        }
    }

    let mergedBusinessInfo = { ...(input.businessInfo || {}) };
    const claimId = input.claimBusinessId || (lookup.flow === 'claim' ? lookup.businessId : null);
    let claimedFromRestaurantId = null;

    if (claimId) {
        const { source, snap } = await resolveClaimSource(db, claimId);
        if (source === 'restaurants' && snap?.exists) {
            const preData = snap.data() || {};
            const docPhone =
                String(preData.standardized_phone || '').trim() ||
                String(preData.businessInfo?.standardized_phone || '').trim();
            if (docPhone && docPhone !== standardizedPhone) {
                throw Object.assign(new Error('PHONE_MISMATCH'), { code: 'phone-mismatch' });
            }
            const claimData = await claimRestaurantOwnershipTransaction({
                restaurantId: claimId,
                firebaseUid,
                standardizedPhone,
            });
            const userPayload = buildUserProfileFromClaimedRestaurant(
                claimData,
                claimId,
                firebaseUid,
                email,
                standardizedPhone
            );
            mergedBusinessInfo = { ...userPayload.businessInfo, ...mergedBusinessInfo };
            claimedFromRestaurantId = claimId;

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

            const userPayloadOut = {
                ...userPayload,
                businessInfo: mergedBusinessInfo,
                created_at: FieldValue.serverTimestamp(),
                last_active_time: FieldValue.serverTimestamp(),
            };
            if (input.referredBy) {
                userPayloadOut.referred_by = input.referredBy;
            }

            await db.collection('users').doc(firebaseUid).set(userPayloadOut, { merge: true });

            return {
                uid: firebaseUid,
                email,
                flow: 'claim',
                claimedFromBusinessId: claimId,
                claimedFromRestaurantId,
            };
        }

        if (source === 'users' && snap?.exists) {
            const claimData = snap.data() || {};
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
                isClaimed: true,
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
        claimedFromRestaurantId,
    };
}

/**
 * New business registration via email/password only (no SMS OTP).
 * Phone verification is reserved for claiming published restaurant profiles.
 * @param {{
 *   firebaseUid: string,
 *   email: string,
 *   businessInfo: Record<string, unknown>,
 *   referredBy?: string | null,
 * }} input
 */
export async function completeBusinessEmailSignup(input) {
    ensureFirebaseAdmin();
    const db = getFirestore();
    const auth = getAuth();

    const firebaseUid = String(input.firebaseUid || '').trim();
    const email = String(input.email || '').trim().toLowerCase();

    if (!firebaseUid || !email) {
        throw Object.assign(new Error('INVALID_COMPLETE_PAYLOAD'), { code: 'invalid-request' });
    }

    const userRecord = await auth.getUser(firebaseUid);
    const accountEmail = String(userRecord.email || '').trim().toLowerCase();
    if (!accountEmail || accountEmail !== email) {
        throw Object.assign(new Error('EMAIL_MISMATCH'), { code: 'invalid-request' });
    }

    const mergedBusinessInfo = { ...(input.businessInfo || {}) };
    mergedBusinessInfo.isClaimed = true;
    mergedBusinessInfo.phone_verified = false;
    mergedBusinessInfo.phone_claimed = false;
    if ('standardized_phone' in mergedBusinessInfo) {
        delete mergedBusinessInfo.standardized_phone;
    }
    mergedBusinessInfo.createdAt = FieldValue.serverTimestamp();

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
        claimedFromBusinessId: null,
        followersCount: 0,
        ownedCommunities: [],
    };
    if (input.referredBy) {
        userPayload.referred_by = input.referredBy;
    }

    await db.collection('users').doc(firebaseUid).set(userPayload, { merge: true });

    return {
        uid: firebaseUid,
        email,
        flow: 'new',
        claimedFromBusinessId: null,
        claimedFromRestaurantId: null,
    };
}
