import adminNs from 'firebase-admin';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { ensureFirebaseAdmin } from './_firebaseAdmin.js';
// Shared, backend-agnostic deletion cascade (also used by Cloud Functions).
import accountDeletionCore from '../functions/accountDeletionCore.js';
import {
    claimRestaurantOwnershipTransaction,
    buildUserProfileFromClaimedRestaurant,
    restaurantDocIsUnclaimed,
} from './_restaurantClaim.js';
import {
    loadGoogleBusinessClaimSession,
} from './_googleBusinessClaimSessions.js';
import { userManagesGooglePlace } from './_googleBusinessProfileLocations.js';
import { loadExistingRestaurantForImport, findExistingByGooglePlaceId } from './_virtualBusinessIngest.js';

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
    const placeId = String(mergedBusinessInfo.placeId || mergedBusinessInfo.googlePlaceId || '').trim();
    if (!placeId) {
        throw Object.assign(new Error('PLACE_REQUIRED'), { code: 'place-required' });
    }

    // Avoid duplicate profiles when the venue is already listed (claimed or not).
    const existingRestaurant = await loadExistingRestaurantForImport(placeId);
    if (existingRestaurant) {
        if (restaurantDocIsUnclaimed(existingRestaurant.data)) {
            throw Object.assign(new Error('PLACE_CLAIM_REQUIRED'), {
                code: 'place-claim-required',
                restaurantId: existingRestaurant.docId,
            });
        }
        throw Object.assign(new Error('PLACE_ALREADY_CLAIMED'), {
            code: 'place-already-claimed',
            restaurantId: existingRestaurant.docId,
        });
    }

    // A Google place already owned by ANOTHER account (a user-created business,
    // not an admin-imported restaurant) must never be taken over — one owner per
    // Google listing. The rightful owner keeps it; a second signup is rejected.
    const existingOwner = await findExistingByGooglePlaceId(placeId);
    if (
        existingOwner &&
        existingOwner.collection === 'users' &&
        existingOwner.doc.id !== firebaseUid
    ) {
        throw Object.assign(new Error('PLACE_ALREADY_CLAIMED'), {
            code: 'place-already-claimed',
            restaurantId: existingOwner.doc.id,
        });
    }

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
        isProfileComplete: true,
        registrationIntent: null,
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

/**
 * Claim an admin-imported restaurant after Google Business Profile ownership verification.
 * @param {{
 *   firebaseUid: string;
 *   email: string;
 *   restaurantId: string;
 *   googleClaimSessionId: string;
 *   referredBy?: string | null,
 * }} input
 */
export async function completeBusinessGoogleClaimSignup(input) {
    ensureFirebaseAdmin();
    const db = getFirestore();
    const auth = getAuth();

    const firebaseUid = String(input.firebaseUid || '').trim();
    const email = String(input.email || '').trim().toLowerCase();
    const restaurantId = String(input.restaurantId || '').trim();
    const sessionId = String(input.googleClaimSessionId || '').trim();
    // Explicit opt-in (frontend shows a destructive-action confirmation): allow a
    // personal account to CONVERT into a business by purging its personal data first.
    const convertPersonal = input.convertPersonal === true;

    if (!firebaseUid || !email || !restaurantId || !sessionId) {
        throw Object.assign(new Error('INVALID_COMPLETE_PAYLOAD'), { code: 'invalid-request' });
    }

    const session = await loadGoogleBusinessClaimSession(sessionId);
    if (!session) {
        throw Object.assign(new Error('SESSION_NOT_FOUND'), { code: 'session-not-found' });
    }
    if (session.restaurantId !== restaurantId) {
        throw Object.assign(new Error('SESSION_RESTAURANT_MISMATCH'), { code: 'invalid-request' });
    }

    const userRecord = await auth.getUser(firebaseUid);
    const accountEmail = String(userRecord.email || '').trim().toLowerCase();
    if (!accountEmail || accountEmail !== email) {
        throw Object.assign(new Error('EMAIL_MISMATCH'), { code: 'invalid-request' });
    }

    // Business and personal accounts never mix — reject if this Firebase user is already a
    // genuine personal profile (the frontend always creates/uses a dedicated business account
    // for a claim, but a direct API call must not be able to convert someone's personal account).
    let willConvertPersonal = false;
    const existingUserSnap = await db.collection('users').doc(firebaseUid).get();
    if (existingUserSnap.exists) {
        const existingData = existingUserSnap.data() || {};
        const roleLc = String(existingData.role || '').toLowerCase();
        const accountTypeLc = String(existingData.accountType || '').toLowerCase();
        const hasBusinessInfoDoc =
            existingData.businessInfo &&
            typeof existingData.businessInfo === 'object' &&
            Object.keys(existingData.businessInfo).length > 0;
        const isExistingBusiness =
            roleLc === 'business' || roleLc === 'partner' || accountTypeLc === 'business' || hasBusinessInfoDoc;
        if (!isExistingBusiness) {
            // Personal account: convert only with explicit opt-in; otherwise keep the
            // hard separation guard (a direct API call must not silently convert someone).
            if (!convertPersonal) {
                throw Object.assign(new Error('PERSONAL_ACCOUNT_CANNOT_CLAIM'), {
                    code: 'personal-account-cannot-claim',
                });
            }
            willConvertPersonal = true;
        }
    }

    if (!session.placeVerified || session.verifiedPlaceId !== session.googlePlaceId) {
        const accessToken = session.accessToken;
        if (!accessToken) {
            throw Object.assign(new Error('SESSION_NOT_AUTHENTICATED'), { code: 'session-not-authenticated' });
        }
        const check = await userManagesGooglePlace(accessToken, session.googlePlaceId);
        if (!check.managed) {
            throw Object.assign(new Error('PLACE_NOT_MANAGED'), { code: 'place-not-managed' });
        }
    }

    if (!session.accessToken) {
        throw Object.assign(new Error('SESSION_NOT_AUTHENTICATED'), { code: 'session-not-authenticated' });
    }

    const restaurantSnap = await db.collection('restaurants').doc(restaurantId).get();
    if (!restaurantSnap.exists) {
        throw Object.assign(new Error('RESTAURANT_NOT_FOUND'), { code: 'restaurant-not-found' });
    }
    const preData = restaurantSnap.data() || {};
    const docPlaceId = String(preData.googlePlaceId || restaurantId).trim();
    if (docPlaceId !== session.googlePlaceId) {
        throw Object.assign(new Error('PLACE_MISMATCH'), { code: 'place-mismatch' });
    }

    const docPhone =
        String(preData.standardized_phone || '').trim() ||
        String(preData.businessInfo?.standardized_phone || '').trim() ||
        String(preData.businessInfo?.phone || '').trim() ||
        String(preData.phone || '').trim();

    // Personal→business conversion. Ownership + restaurant are now fully verified, so
    // this is the last safe point to permanently delete the personal account's data
    // (keeping the Google login). Purging deletes users/{uid}, so the claim below
    // recreates it as a clean business profile with no stale consumer fields. We check
    // the listing is still unclaimed first, so we never purge on a request the claim
    // transaction would reject.
    if (willConvertPersonal) {
        if (!restaurantDocIsUnclaimed(preData)) {
            throw Object.assign(new Error('ALREADY_CLAIMED'), {
                code: 'already-claimed',
                restaurantId,
            });
        }
        await accountDeletionCore.purgeUserAccountData(adminNs, firebaseUid, { deleteAuthUser: false });
    }

    const claimData = await claimRestaurantOwnershipTransaction({
        restaurantId,
        firebaseUid,
        standardizedPhone: docPhone,
        verificationMethod: 'google_business_profile',
    });

    const userPayload = buildUserProfileFromClaimedRestaurant(
        claimData,
        restaurantId,
        firebaseUid,
        email,
        docPhone,
        { verificationMethod: 'google_business_profile' }
    );

    const userPayloadOut = {
        ...userPayload,
        businessInfo: {
            ...userPayload.businessInfo,
            google_business_verified: true,
            googleClaimSessionId: sessionId,
            // Permanent audit record of who verified GBP admin access — independent of the
            // business account's own login email, which may legitimately differ (see
            // completeBusinessGoogleClaimSignup's personal-account guard above for why).
            verifiedGoogleAdminEmail: session.verifiedGoogleEmail || null,
        },
        claimVerificationMethod: 'google_business_profile',
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
        claimedFromBusinessId: restaurantId,
        claimedFromRestaurantId: restaurantId,
        verificationMethod: 'google_business_profile',
    };
}
