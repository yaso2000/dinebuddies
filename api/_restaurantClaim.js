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
 * @param {{ restaurantId: string; firebaseUid: string; standardizedPhone: string }} input
 * @returns {Promise<FirebaseFirestore.DocumentData>}
 */
export async function claimRestaurantOwnershipTransaction(input) {
    ensureFirebaseAdmin();
    const db = getFirestore();
    const restaurantId = String(input.restaurantId || '').trim();
    const firebaseUid = String(input.firebaseUid || '').trim();
    const standardizedPhone = String(input.standardizedPhone || '').trim();

    if (!restaurantId || !firebaseUid || !standardizedPhone) {
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

        if (!docPhone || docPhone !== standardizedPhone) {
            throw Object.assign(new Error('PHONE_MISMATCH'), { code: 'phone-mismatch' });
        }

        tx.update(ref, {
            isClaimed: true,
            ownerId: firebaseUid,
            claimedAt: FieldValue.serverTimestamp(),
            'businessInfo.isClaimed': true,
            'businessInfo.phone_verified': true,
            'businessInfo.phone_claimed': true,
            'businessInfo.standardized_phone': standardizedPhone,
        });

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
 */
export function buildUserProfileFromClaimedRestaurant(
    restaurantData,
    restaurantId,
    firebaseUid,
    email,
    standardizedPhone
) {
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
        standardized_phone: standardizedPhone,
        isClaimed: true,
        phone_verified: true,
        phone_claimed: true,
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
