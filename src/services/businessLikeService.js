/**
 * Single unified business-like system for the entire app.
 * One user action = one business like. It controls:
 * - heart active state (businessLikes doc existence)
 * - like count (users/{businessId}.businessInfo.profileLikes)
 * - businessLikes/{businessId}_{userId} document
 * - user.favoritePlaces (derived storage, updated in same action)
 */
import { doc, getDoc, increment, runTransaction, serverTimestamp, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';

const BUSINESS_LIKES_COLLECTION = 'businessLikes';

export function getBusinessLikeDocId(businessId, userId) {
    return `${businessId}_${userId}`;
}

export function getBusinessLikeRef(businessId, userId) {
    return doc(db, BUSINESS_LIKES_COLLECTION, getBusinessLikeDocId(businessId, userId));
}

export function getBusinessRef(businessId) {
    return doc(db, 'users', businessId);
}

/**
 * Increment business profile share count. Best-effort; does not throw.
 * Call after a successful share (e.g. navigator.share or clipboard copy).
 */
export async function incrementBusinessShareCount(businessId) {
    if (!businessId) return;
    const businessRef = getBusinessRef(businessId);
    try {
        const snap = await getDoc(businessRef);
        if (snap.exists()) await updateDoc(businessRef, { 'businessInfo.profileShares': increment(1) });
    } catch (err) {
        console.warn('[share] profileShares increment failed', { businessId, err });
    }
}

/**
 * Increment business total invitations count (cumulative). Never decremented when invitations are deleted/completed.
 * Call when a new invitation is created that is linked to this business (restaurantId / hostId / partnerId).
 * So the business does not lose ranking points when invitations are removed after completion.
 */
export async function incrementBusinessInvitationCount(businessId) {
    if (!businessId) return;
    const businessRef = getBusinessRef(businessId);
    try {
        const snap = await getDoc(businessRef);
        if (snap.exists()) await updateDoc(businessRef, { 'businessInfo.totalInvitations': increment(1) });
    } catch (err) {
        console.warn('[invitations] totalInvitations increment failed', { businessId, err });
    }
}

/**
 * Single source of truth for heart state: subscribe to businessLikes doc existence.
 */
export function subscribeBusinessLiked(businessId, userId, onUpdate) {
    if (!businessId || !userId) {
        onUpdate(false);
        return () => {};
    }
    const likeRef = getBusinessLikeRef(businessId, userId);
    const unsubscribe = onSnapshot(likeRef, (snap) => {
        onUpdate(snap.exists());
    }, () => onUpdate(false));
    return unsubscribe;
}

/**
 * Optional business info when adding a like (used to add entry to favoritePlaces).
 * @typedef {{ businessId: string, name: string, image?: string, address?: string, city?: string }} BusinessInfoForFavorite
 */

/**
 * Single unified toggle: businessLikes + profileLikes + favoritePlaces.
 * Use this everywhere in the app for business heart. No separate favorite logic.
 * @param {string} businessId
 * @param {string} userId - current user uid
 * @param {boolean} currentlyLiked - true if user has already liked (we will unlike)
 * @param {BusinessInfoForFavorite} [businessInfoForFavorite] - required when currentlyLiked is false (when adding like)
 */
export async function toggleBusinessLike(businessId, userId, currentlyLiked, businessInfoForFavorite) {
    if (!businessId || !userId) {
        console.warn('[like] toggleBusinessLike: missing businessId or userId', { businessId, userId });
        return;
    }

    const likeRef = getBusinessLikeRef(businessId, userId);
    const businessRef = getBusinessRef(businessId);
    const userRef = doc(db, 'users', userId);

    // 1) Like doc only in transaction. Rules allow create/delete only (no update), so we must
    //    read first and only set() when doc does not exist (otherwise set() = update = denied).
    try {
        await runTransaction(db, async (transaction) => {
            const likeSnap = await transaction.get(likeRef);
            const likeExists = likeSnap.exists();

            if (currentlyLiked) {
                if (likeExists) transaction.delete(likeRef);
            } else {
                if (!likeExists) {
                    transaction.set(likeRef, {
                        businessId: String(businessId),
                        userId: String(userId),
                        createdAt: serverTimestamp()
                    });
                }
            }
        });
    } catch (err) {
        console.warn('[like] transaction failed', { businessId, userId, currentlyLiked, code: err?.code, message: err?.message, err });
        throw err;
    }

    // 2) Business like count + user favoritePlaces are independent — run in parallel after transaction
    await Promise.all([
        (async () => {
            try {
                const businessSnap = await getDoc(businessRef);
                if (businessSnap.exists()) {
                    const delta = currentlyLiked ? -1 : 1;
                    await updateDoc(businessRef, { 'businessInfo.profileLikes': increment(delta) });
                }
            } catch (countErr) {
                console.warn('[like] profileLikes count update failed (like still saved)', {
                    businessId,
                    code: countErr?.code,
                    message: countErr?.message
                });
            }
        })(),
        (async () => {
            try {
                const userSnap = await getDoc(userRef);
                const currentPlaces = userSnap.exists() ? (userSnap.data().favoritePlaces || []).slice() : [];

                if (currentlyLiked) {
                    const next = currentPlaces.filter((p) => (p.businessId || p.id) !== businessId);
                    await updateDoc(userRef, { favoritePlaces: next });
                } else if (businessInfoForFavorite) {
                    const already = currentPlaces.some((p) => (p.businessId || p.id) === businessId);
                    if (!already) {
                        const entry = {
                            businessId,
                            name: businessInfoForFavorite.name || '',
                            image: businessInfoForFavorite.image,
                            address: businessInfoForFavorite.address || '',
                            city: businessInfoForFavorite.city || '',
                            source: 'business',
                            addedAt: new Date().toISOString()
                        };
                        await updateDoc(userRef, { favoritePlaces: [...currentPlaces, entry] });
                    }
                }
            } catch (err) {
                console.warn('[like] favoritePlaces sync failed (like still succeeded)', err);
            }
        })()
    ]);
}
