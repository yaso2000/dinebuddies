import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { ensureFirebaseAdmin } from './_firebaseAdmin.js';

/**
 * @param {FirebaseFirestore.DocumentData | undefined} data
 */
export function restaurantDocIsUnclaimed(data) {
    if (!data || typeof data !== 'object') return false;
    return data.isClaimed !== true;
}

/**
 * Firestore transaction: flip ownership on restaurants/{restaurantId}.
 * @param {{
 *   restaurantId: string;
 *   firebaseUid: string;
 *   standardizedPhone?: string;
 *   verificationMethod?: 'phone' | 'google_business_profile';
 *   skipPhoneMatch?: boolean;
 * }} input
 * @returns {Promise<FirebaseFirestore.DocumentData>}
 */
export async function claimRestaurantOwnershipTransaction(input) {
    ensureFirebaseAdmin();
    const db = getFirestore();
    const restaurantId = String(input.restaurantId || '').trim();
    const firebaseUid = String(input.firebaseUid || '').trim();
    const standardizedPhone = String(input.standardizedPhone || '').trim();
    const verificationMethod = input.verificationMethod === 'google_business_profile'
        ? 'google_business_profile'
        : 'phone';
    const skipPhoneMatch =
        verificationMethod === 'google_business_profile' || input.skipPhoneMatch === true;

    if (!restaurantId || !firebaseUid) {
        throw Object.assign(new Error('INVALID_CLAIM_PAYLOAD'), { code: 'invalid-request' });
    }
    if (!skipPhoneMatch && !standardizedPhone) {
        throw Object.assign(new Error('INVALID_CLAIM_PAYLOAD'), { code: 'invalid-request' });
    }

    const ref = db.collection('restaurants').doc(restaurantId);

    const claimedData = await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists) {
            throw Object.assign(new Error('RESTAURANT_NOT_FOUND'), { code: 'restaurant-not-found' });
        }
        const data = snap.data() || {};
        if (data.isClaimed === true) {
            throw Object.assign(new Error('ALREADY_CLAIMED'), { code: 'already-claimed' });
        }

        const docPhone =
            String(data.standardized_phone || '').trim() ||
            String(data.businessInfo?.standardized_phone || '').trim() ||
            String(data.businessInfo?.phone || '').trim() ||
            String(data.phone || '').trim();

        if (!skipPhoneMatch && (!docPhone || docPhone !== standardizedPhone)) {
            throw Object.assign(new Error('PHONE_MISMATCH'), { code: 'phone-mismatch' });
        }

        const phoneToStore = standardizedPhone || docPhone || '';

        const updatePayload = {
            isClaimed: true,
            ownerId: firebaseUid,
            claimedAt: FieldValue.serverTimestamp(),
            'businessInfo.isClaimed': true,
            'businessInfo.phone_verified': skipPhoneMatch ? false : true,
            'businessInfo.phone_claimed': skipPhoneMatch ? false : true,
        };
        if (phoneToStore) {
            updatePayload['businessInfo.standardized_phone'] = phoneToStore;
        }
        if (skipPhoneMatch) {
            updatePayload['businessInfo.google_business_verified'] = true;
            updatePayload.claimVerificationMethod = 'google_business_profile';
        }

        tx.update(ref, updatePayload);

        return data;
    });

    return claimedData;
}

/**
 * @param {FirebaseFirestore.DocumentData} restaurantData
 * @param {string} restaurantId
 * @param {string} firebaseUid
 * @param {string} email
 * @param {string} standardizedPhone
 * @param {{ verificationMethod?: 'phone' | 'google_business_profile' }} [opts]
 */
export function buildUserProfileFromClaimedRestaurant(
    restaurantData,
    restaurantId,
    firebaseUid,
    email,
    standardizedPhone,
    opts = {}
) {
    const googleVerified = opts.verificationMethod === 'google_business_profile';
    const bi =
        restaurantData.businessInfo && typeof restaurantData.businessInfo === 'object'
            ? { ...restaurantData.businessInfo }
            : {};

    const businessName =
        String(bi.businessName || '').trim() ||
        String(restaurantData.display_name || '').trim() ||
        String(restaurantData.name || '').trim() ||
        email;

    const mergedBusinessInfo = {
        ...bi,
        businessName,
        standardized_phone: standardizedPhone || bi.standardized_phone || restaurantData.standardized_phone || '',
        isClaimed: true,
        phone_verified: !googleVerified,
        phone_claimed: !googleVerified,
        google_business_verified: googleVerified,
        phone: bi.phone || restaurantData.phone || standardizedPhone,
        placeId: bi.placeId || restaurantData.googlePlaceId || restaurantId,
        website: bi.website || restaurantData.website || '',
        address: bi.address || restaurantData.address || '',
        lat:
            typeof bi.lat === 'number'
                ? bi.lat
                : typeof restaurantData.coordinates?.lat === 'number'
                  ? restaurantData.coordinates.lat
                  : null,
        lng:
            typeof bi.lng === 'number'
                ? bi.lng
                : typeof restaurantData.coordinates?.lng === 'number'
                  ? restaurantData.coordinates.lng
                  : null,
        hours: bi.hours || null,
        categories: Array.isArray(bi.categories)
            ? bi.categories
            : Array.isArray(restaurantData.categories)
              ? restaurantData.categories
              : [],
    };

    return {
        uid: firebaseUid,
        email,
        authInfo: { email },
        accountType: 'business',
        role: 'partner',
        display_name: businessName,
        photo_url: restaurantData.photo_url || null,
        pendingBusinessRegistration: false,
        businessProfileSetupPending: true,
        businessInfo: mergedBusinessInfo,
        claimedFromRestaurantId: restaurantId,
        createdBy: restaurantData.createdBy || 'admin',
        followersCount: 0,
        ownedCommunities: [],
        emailVerified: false,
    };
}
