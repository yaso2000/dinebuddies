/**
 * Resolve business community owners from users/ or restaurants/ (Google-imported profiles).
 * Community join/chat is available for Free and Paid business listings.
 * Business Stage rooms are separate and disabled for business hosts.
 */

/**
 * @param {{ source: string; data: Record<string, unknown> } | null} owner
 */
function isCommunityOwnerBusiness(owner) {
    if (!owner?.data) return false;
    const data = owner.data;
    const role = String(data.role || data.accountType || data.accountRole || '').toLowerCase();
    if (role === 'business' || role === 'partner') return true;
    if (data.isBusiness === true) return true;
    // Any restaurants/ listing can accept community members (virtual or claimed).
    if (owner.source === 'restaurants') return true;
    return false;
}

/**
 * Prefer a doc that is a valid community owner when the same id exists in both collections.
 * @param {FirebaseFirestore.Firestore} db
 * @param {string} partnerId
 * @returns {Promise<{
 *   source: 'users' | 'restaurants';
 *   ref: FirebaseFirestore.DocumentReference;
 *   id: string;
 *   data: Record<string, unknown>;
 * } | null>}
 */
async function resolveCommunityOwner(db, partnerId) {
    const id = String(partnerId || '').trim();
    if (!id) return null;

    const userRef = db.collection('users').doc(id);
    const restaurantRef = db.collection('restaurants').doc(id);
    const [userSnap, restaurantSnap] = await Promise.all([userRef.get(), restaurantRef.get()]);

    const userOwner = userSnap.exists
        ? { source: 'users', ref: userRef, id, data: userSnap.data() || {} }
        : null;
    const restaurantOwner = restaurantSnap.exists
        ? { source: 'restaurants', ref: restaurantRef, id, data: restaurantSnap.data() || {} }
        : null;

    if (userOwner && isCommunityOwnerBusiness(userOwner)) return userOwner;
    if (restaurantOwner && isCommunityOwnerBusiness(restaurantOwner)) return restaurantOwner;
    return userOwner || restaurantOwner || null;
}

/**
 * @param {{ source: string; data: Record<string, unknown> } | null} owner
 */
function isCommunityOwnerPublic(owner) {
    if (!owner?.data) return false;
    const data = owner.data;
    if (data.emailVerified === true) return true;
    if (owner.source === 'restaurants') {
        if (data.isVirtual === true) return true;
        const bi = data.businessInfo && typeof data.businessInfo === 'object' ? data.businessInfo : {};
        if (bi.isPublished !== false) return true;
        return true;
    }
    // Published free businesses should still accept join / member lists.
    const bi = data.businessInfo && typeof data.businessInfo === 'object' ? data.businessInfo : {};
    if (bi.isPublished === true) return true;
    return false;
}

/**
 * @param {{ id: string; data: Record<string, unknown> } | null} owner
 * @param {string} requesterUid
 */
function isCommunityOwnerRequester(owner, requesterUid) {
    if (!owner || !requesterUid) return false;
    if (requesterUid === owner.id) return true;
    return String(owner.data?.ownerId || '') === requesterUid;
}

/**
 * @param {FirebaseFirestore.Firestore} db
 * @param {string} partnerId
 * @param {{ data: Record<string, unknown> }} owner
 */
async function collectCommunityMemberIds(db, partnerId, owner) {
    const ids = new Set();

    const membersSnap = await db
        .collection('users')
        .where('joinedCommunities', 'array-contains', partnerId)
        .limit(500)
        .get();
    membersSnap.docs.forEach((docSnap) => ids.add(docSnap.id));

    const onOwner = Array.isArray(owner.data.communityMembers) ? owner.data.communityMembers : [];
    onOwner.forEach((memberId) => {
        if (typeof memberId === 'string' && memberId.trim()) ids.add(memberId.trim());
    });

    return [...ids];
}

module.exports = {
    resolveCommunityOwner,
    isCommunityOwnerBusiness,
    isCommunityOwnerPublic,
    isCommunityOwnerRequester,
    collectCommunityMemberIds,
};
