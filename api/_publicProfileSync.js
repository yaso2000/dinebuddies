import { FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { ensureFirebaseAdmin } from './_firebaseAdmin.js';

const TEAM_ROLES = new Set(['admin', 'staff', 'support', 'moderator', 'affiliate_agent']);

function asTrimmedString(value) {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

function asFiniteNumber(value) {
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
}

function detectPublicProfileType(userData) {
    const role = asTrimmedString(userData?.role);
    const accountType = asTrimmedString(userData?.accountType);
    const businessInfo =
        userData?.businessInfo && typeof userData.businessInfo === 'object' ? userData.businessInfo : {};
    const hasBizInfo = Object.keys(businessInfo).length > 0;
    const regIntent = String(userData?.registrationIntent || '').toLowerCase() === 'business';
    if (
        role === 'business' ||
        role === 'partner' ||
        accountType === 'business' ||
        hasBizInfo ||
        regIntent
    ) {
        return 'business';
    }
    return 'user';
}

function shouldDeletePublicProfile(mapped) {
    if (!mapped) return true;
    if (mapped.profileType === 'user' && mapped.searchable === false) return true;
    return false;
}

/** Keep in sync with functions/index.js `toPublicProfile`. */
export function toPublicProfileFromUserDoc(userDocData, uid) {
    const userData = userDocData && typeof userDocData === 'object' ? userDocData : {};
    const safeUid = asTrimmedString(uid);
    if (!safeUid) return null;

    const profileType = detectPublicProfileType(userData);
    const displayName =
        asTrimmedString(userData.display_name) ||
        asTrimmedString(userData.displayName) ||
        asTrimmedString(userData.name) ||
        'User';
    const avatarUrl =
        asTrimmedString(userData.photo_url) ||
        asTrimmedString(userData.photoURL) ||
        asTrimmedString(userData.avatar);

    const locationData = userData.location && typeof userData.location === 'object' ? userData.location : {};
    const businessInfo = userData.businessInfo && typeof userData.businessInfo === 'object' ? userData.businessInfo : {};
    const authEmailVerified = userData.emailVerified === true;
    const userOptedIntoDirectory = businessInfo.isPublished === true;
    const businessPublic =
        profileType === 'business'
            ? {
                  isPublished: authEmailVerified && userOptedIntoDirectory,
                  businessType: asTrimmedString(businessInfo.businessType),
                  city: asTrimmedString(businessInfo.city) || asTrimmedString(userData.city),
                  country:
                      asTrimmedString(businessInfo.country) ||
                      asTrimmedString(userData.country) ||
                      asTrimmedString(userData.countryCode),
                  address: asTrimmedString(businessInfo.address) || asTrimmedString(userData.location),
                  description: asTrimmedString(businessInfo.description) || asTrimmedString(userData.bio),
                  coverImage: asTrimmedString(businessInfo.coverImage),
                  lat: asFiniteNumber(businessInfo.lat ?? userData.lat),
                  lng: asFiniteNumber(businessInfo.lng ?? userData.lng),
                  brandKit: businessInfo.brandKit || null,
                  theme: asTrimmedString(businessInfo.theme),
                  hours:
                      businessInfo.hours && typeof businessInfo.hours === 'object'
                          ? businessInfo.hours
                          : null,
                  openingHours:
                      businessInfo.openingHours && typeof businessInfo.openingHours === 'object'
                          ? businessInfo.openingHours
                          : null,
              }
            : null;

    const tierRaw = userData.subscriptionTier;
    const subscriptionTier =
        typeof tierRaw === 'string' && tierRaw.trim() ? tierRaw.trim().toLowerCase() : 'free';
    const accountRole = asTrimmedString(userData.role)?.toLowerCase() || 'user';
    const searchable = profileType === 'user' && accountRole === 'user' && !TEAM_ROLES.has(accountRole);

    return {
        uid: safeUid,
        profileType,
        displayName,
        avatarUrl: avatarUrl || null,
        subscriptionTier,
        accountRole,
        searchable,
        search: {
            displayNameLower: displayName.trim().toLowerCase(),
        },
        userPublic:
            profileType === 'user'
                ? {
                      city: asTrimmedString(userData.city) || asTrimmedString(locationData.city) || null,
                      country:
                          asTrimmedString(userData.country) ||
                          asTrimmedString(userData.countryCode) ||
                          asTrimmedString(locationData.country) ||
                          null,
                  }
                : null,
        businessPublic,
        updatedAt: FieldValue.serverTimestamp(),
    };
}

/**
 * Mirror users/{uid} → public_profiles/{uid} (same rules as syncPublicProfileOnUserWrite).
 * @param {string} uid
 */
export async function syncUserPublicProfile(uid) {
    ensureFirebaseAdmin();
    const db = getFirestore();
    const auth = getAuth();
    const safeUid = asTrimmedString(uid);
    if (!safeUid) {
        throw Object.assign(new Error('INVALID_UID'), { code: 'invalid-request' });
    }

    const userRef = db.collection('users').doc(safeUid);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
        throw Object.assign(new Error('USER_NOT_FOUND'), { code: 'not-found' });
    }

    let userData = userSnap.data() || {};

    if (userData.banned === true || String(userData.role || '').toLowerCase() === 'affiliate_agent') {
        await db.collection('public_profiles').doc(safeUid).delete().catch(() => {});
        return { uid: safeUid, deleted: true, reason: 'hidden_account' };
    }

    try {
        const authUser = await auth.getUser(safeUid);
        if (authUser.emailVerified === true && userData.emailVerified !== true) {
            await userRef.set(
                { emailVerified: true, authEmail: authUser.email || null },
                { merge: true }
            );
            userData = { ...userData, emailVerified: true };
        }
    } catch {
        /* ignore auth lookup errors */
    }

    const mapped = toPublicProfileFromUserDoc(userData, safeUid);
    const publicRef = db.collection('public_profiles').doc(safeUid);

    if (shouldDeletePublicProfile(mapped)) {
        await publicRef.delete().catch(() => {});
        return { uid: safeUid, deleted: true, profileType: mapped?.profileType || null };
    }

    await publicRef.set(mapped, { merge: false });
    return {
        uid: safeUid,
        synced: true,
        profileType: mapped.profileType,
        businessPublic: mapped.businessPublic || null,
    };
}
