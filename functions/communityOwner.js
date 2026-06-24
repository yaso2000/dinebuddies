/**
 * Resolve business community owners from users/ or restaurants/ (Google-imported profiles).
 */

/**
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
    const userSnap = await userRef.get();
    if (userSnap.exists) {
        return { source: 'users', ref: userRef, id, data: userSnap.data() || {} };
    }

    const restaurantRef = db.collection('restaurants').doc(id);
    const restaurantSnap = await restaurantRef.get();
    if (restaurantSnap.exists) {
        return { source: 'restaurants', ref: restaurantRef, id, data: restaurantSnap.data() || {} };
    }

    return null;
}

/**
 * @param {{ source: string; data: Record<string, unknown> } | null} owner
 */
function isCommunityOwnerBusiness(owner) {
    if (!owner?.data) return false;
    const data = owner.data;
    const role = String(data.role || data.accountType || '').toLowerCase();
    if (role === 'business' || role === 'partner') return true;
    if (data.isBusiness === true) return true;
    if (owner.source === 'restaurants') {
        if (data.isVirtual === true) return true;
        if (String(data.accountType || '').toLowerCase() === 'business') return true;
    }
    return false;
}

/**
 * @param {{ source: string; data: Record<string, unknown> } | null} owner
 */
function isCommunityOwnerPublic(owner) {
    if (!owner?.data) return false;
    const data = owner.data;
    if (data.emailVerified === true) return true;
    if (owner.source === 'restaurants' && data.isVirtual === true) return true;
    const bi = data.businessInfo && typeof data.businessInfo === 'object' ? data.businessInfo : {};
    if (owner.source === 'restaurants' && bi.isPublished !== false) return true;
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
