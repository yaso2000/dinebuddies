/**
 * Authorization helpers for createNotification.
 * Kept free of Cloud Functions wiring so unit tests can exercise policy.
 */

function asString(value) {
    return typeof value === 'string' ? value.trim() : '';
}

function invitationParticipantIds(inv) {
    const hostId = inv?.author?.id || inv?.hostId || inv?.authorId || null;
    const joined = Array.isArray(inv?.joined)
        ? inv.joined
        : (Array.isArray(inv?.joinedMembers) ? inv.joinedMembers : []);
    const invitedFriends = Array.isArray(inv?.invitedFriends) ? inv.invitedFriends : [];
    const requests = Array.isArray(inv?.requests) ? inv.requests : [];
    return {
        hostId,
        joined,
        invitedFriends,
        requests,
        members: new Set([hostId, ...joined, ...invitedFriends].filter(Boolean)),
    };
}

function conversationIdFor(a, b) {
    return [a, b].sort().join('_');
}

/**
 * @param {object} args
 * @param {FirebaseFirestore.Firestore} args.db
 * @param {string} args.senderId
 * @param {string} args.userId recipient
 * @param {string} args.type
 * @param {string} [args.invitationId]
 * @param {object} [args.metadata]
 * @param {(uid: string) => Promise<boolean>} args.isAdminUid
 */
async function canSenderTriggerNotificationType({
    db,
    senderId,
    userId,
    type,
    invitationId,
    metadata,
    isAdminUid,
}) {
    if (senderId === userId) {
        // Self-directed notifications are allowed for trusted self actions.
        return true;
    }

    if (typeof isAdminUid === 'function' && (type === 'message' || type === 'reminder' || type === 'system_announcement')) {
        if (await isAdminUid(senderId)) return true;
    }

    const meta = metadata && typeof metadata === 'object' && !Array.isArray(metadata) ? metadata : {};
    const scopedInvitationId = asString(invitationId) || asString(meta.invitationId);

    if (
        type === 'join_request' ||
        type === 'invitation_full' ||
        type === 'request_approved' ||
        type === 'invitation_accepted' ||
        type === 'invitation_rejected' ||
        type === 'invitation_cancelled' ||
        type === 'booking_cancelled' ||
        type === 'invitation_completed' ||
        type === 'booking_confirmed' ||
        type === 'invitation_updated'
    ) {
        if (!scopedInvitationId) return false;
        const invSnap = await db.collection('invitations').doc(scopedInvitationId).get();
        if (!invSnap.exists) return false;
        const inv = invSnap.data() || {};
        const { hostId, joined, requests } = invitationParticipantIds(inv);
        if (!hostId) return false;

        if (type === 'join_request') return hostId === userId && senderId !== hostId;
        if (type === 'invitation_accepted' || type === 'invitation_rejected') {
            return hostId === userId && senderId !== hostId;
        }
        if (type === 'request_approved' || type === 'invitation_full') {
            if (hostId !== senderId) return false;
            return requests.includes(userId) || joined.includes(userId);
        }
        // Host-originated lifecycle notices: recipient must be a real stakeholder.
        if (hostId !== senderId) return false;
        if (joined.includes(userId) || requests.includes(userId)) return true;
        if (inv.restaurantId && inv.restaurantId === userId) return true;
        if (inv.placeId) {
            const bizSnap = await db.collection('users').doc(userId).get();
            const placeId = bizSnap.exists ? bizSnap.data()?.businessInfo?.placeId : null;
            if (placeId && placeId === inv.placeId) return true;
        }
        return false;
    }

    // comment & like: invitation host, or verified post/story author
    if (type === 'like' || type === 'comment') {
        if (scopedInvitationId) {
            const invSnap = await db.collection('invitations').doc(scopedInvitationId).get();
            if (!invSnap.exists) return false;
            const inv = invSnap.data() || {};
            const hostId = inv.author?.id || inv.hostId || inv.authorId;
            return hostId === userId;
        }
        const postId = asString(meta.postId);
        const collectionName = asString(meta.collection || meta.collectionName);
        const allowedCollections = new Set(['communityPosts', 'featured_posts', 'stories']);
        if (!postId || !allowedCollections.has(collectionName)) return false;
        const postSnap = await db.collection(collectionName).doc(postId).get();
        if (!postSnap.exists) return false;
        const post = postSnap.data() || {};
        const authorId = post.userId || post.authorId || post.partnerId || post.author?.id || null;
        return authorId === userId;
    }

    if (type === 'private_invitation' || type === 'private_invitation_response' || type === 'system_announcement') {
        if (scopedInvitationId) {
            const privateInvSnap = await db.collection('private_invitations').doc(scopedInvitationId).get();
            if (!privateInvSnap.exists) return false;
            const inv = privateInvSnap.data() || {};
            const hostId = inv.authorId || inv.author?.id;
            const invitedFriends = Array.isArray(inv.invitedFriends) ? inv.invitedFriends : [];
            if (type === 'private_invitation') return senderId === hostId && invitedFriends.includes(userId);
            if (type === 'private_invitation_response') return userId === hostId && invitedFriends.includes(senderId);
            if (type === 'system_announcement') return userId === hostId && invitedFriends.includes(senderId);
            return false;
        }
        // Generic system announcements must be self-addressed when no scoped resource is attached.
        return type === 'system_announcement' && senderId === userId;
    }

    if (type === 'new_community_member') {
        const userSnap = await db.collection('users').doc(senderId).get();
        if (!userSnap.exists) return false;
        const joined = userSnap.data()?.joinedCommunities || [];
        return Array.isArray(joined) && joined.includes(userId);
    }

    if (type === 'community_message' || type === 'community_removed') {
        const partnerId = asString(meta.partnerId);
        if (!partnerId || partnerId !== senderId) return false;
        if (type === 'community_removed') {
            const partnerSnap = await db.collection('users').doc(partnerId).get();
            const members = partnerSnap.exists ? (partnerSnap.data()?.communityMembers || []) : [];
            return Array.isArray(members) && members.includes(userId);
        }
        // community_message: partner may notify current members only
        const partnerSnap = await db.collection('users').doc(partnerId).get();
        const members = partnerSnap.exists ? (partnerSnap.data()?.communityMembers || []) : [];
        return Array.isArray(members) && members.includes(userId);
    }

    if (type === 'follow') {
        const senderSnap = await db.collection('users').doc(senderId).get();
        if (!senderSnap.exists) return false;
        const following = senderSnap.data()?.following || [];
        return Array.isArray(following) && following.includes(userId);
    }

    if (type === 'message') {
        // DM: deterministic conversation doc must already exist for the pair.
        const convSnap = await db.collection('conversations').doc(conversationIdFor(senderId, userId)).get();
        if (convSnap.exists) {
            const participants = Array.isArray(convSnap.data()?.participants) ? convSnap.data().participants : [];
            if (participants.includes(senderId) && participants.includes(userId)) return true;
        }

        // Invitation / private invitation chat members
        if (scopedInvitationId) {
            for (const col of ['invitations', 'private_invitations']) {
                const invSnap = await db.collection(col).doc(scopedInvitationId).get();
                if (!invSnap.exists) continue;
                const { members } = invitationParticipantIds(invSnap.data() || {});
                if (members.has(senderId) && members.has(userId)) return true;
            }
        }

        // Community chat: member → partner owner only
        const partnerId = asString(meta.partnerId);
        if (partnerId && userId === partnerId && senderId !== partnerId) {
            const partnerSnap = await db.collection('users').doc(partnerId).get();
            const members = partnerSnap.exists ? (partnerSnap.data()?.communityMembers || []) : [];
            if (Array.isArray(members) && members.includes(senderId)) return true;
        }

        return false;
    }

    if (type === 'reminder') {
        if (!scopedInvitationId) return false;
        const invSnap = await db.collection('invitations').doc(scopedInvitationId).get();
        if (!invSnap.exists) return false;
        const { hostId, joined } = invitationParticipantIds(invSnap.data() || {});
        if (!hostId || hostId !== senderId) return false;
        return joined.includes(userId) || userId === hostId;
    }

    return false;
}

/**
 * Resolve a business uid for a placeId. When multiple businesses claim the same
 * placeId, prefer the earliest-created account (defeats late attribution hijacks).
 */
function pickBusinessForPlaceId(docs) {
    const matches = (docs || []).filter((d) => {
        const u = d.data() || {};
        const role = u.role || u.accountType;
        return role === 'business' || role === 'partner' || u.isBusiness === true;
    });
    if (matches.length === 0) {
        return { found: false, businessId: null, ambiguous: false, matchCount: 0 };
    }
    matches.sort((a, b) => {
        const aMs = a.data()?.createdAt?.toMillis?.() || a.createTime?.toMillis?.() || 0;
        const bMs = b.data()?.createdAt?.toMillis?.() || b.createTime?.toMillis?.() || 0;
        if (aMs !== bMs) return aMs - bMs;
        return String(a.id).localeCompare(String(b.id));
    });
    return {
        found: true,
        businessId: matches[0].id,
        ambiguous: matches.length > 1,
        matchCount: matches.length,
    };
}

module.exports = {
    canSenderTriggerNotificationType,
    pickBusinessForPlaceId,
    conversationIdFor,
    invitationParticipantIds,
};
