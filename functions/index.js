const admin = require('firebase-admin');
admin.initializeApp();

const stripeModule = require('./stripe');
const webhookModule = require('./webhook');
const functions = require('firebase-functions');
const db = admin.firestore();

const MONTHLY_PRIVATE_QUOTAS = {
    pro: 4,
    premium: 10,
    vip: 10
};
const USER_WEEKLY_PRIVATE_QUOTAS = {
    free: 0,
    pro: 2,
    vip: -1
};
const SUPER_OWNER_UIDS = ['xTgHC1v00LZIZ6ESA9YGjGU5zW33'];
const SUPER_OWNER_EMAILS = ['admin@dinebuddies.com', 'y.abohamed@gmail.com', 'yaser@dinebuddies.com', 'info@dinebuddies.com.au'];
const ALLOWED_NOTIFICATION_TYPES = new Set([
    'join_request',
    'invitation_full',
    'request_approved',
    'private_invitation_response',
    'private_invitation',
    'new_community_member',
    'community_removed',
    'community_message',
    'system_announcement',
    'follow',
    'invitation_accepted',
    'invitation_rejected',
    'message',
    'reminder',
    'like',
    'comment',
    'invitation_cancelled',
    'booking_cancelled',
    'invitation_completed',
    'booking_confirmed',
    'invitation_updated'
]);
const ALLOWED_PARTNER_NOTIFICATION_TYPES = new Set(['new_booking']);
const NOTIFICATION_ALLOWED_KEYS = new Set([
    'userId',
    'type',
    'title',
    'message',
    'actionUrl',
    'invitationId',
    'style',
    'status',
    'metadata'
]);
const PARTNER_NOTIFICATION_ALLOWED_KEYS = new Set([
    'restaurantId',
    'type',
    'title',
    'message',
    'invitationId',
    'date',
    'time',
    'guestsNeeded'
]);
const REPORT_ALLOWED_KEYS = new Set([
    'type',
    'targetId',
    'targetName',
    'reason',
    'details',
    'metadata'
]);

function assertAllowedKeys(data, allowedKeys, label) {
    const payload = data && typeof data === 'object' ? data : {};
    const unknownKeys = Object.keys(payload).filter((key) => !allowedKeys.has(key));
    if (unknownKeys.length > 0) {
        throw new functions.https.HttpsError(
            'invalid-argument',
            `${label} contains unsupported fields: ${unknownKeys.join(', ')}`
        );
    }
}

function normalizeNotificationPayload(data) {
    const payload = data && typeof data === 'object' ? data : {};
    const type = typeof payload.type === 'string' ? payload.type.trim() : '';
    const title = typeof payload.title === 'string' ? payload.title.trim() : '';
    const message = typeof payload.message === 'string' ? payload.message.trim() : '';
    const actionUrl = typeof payload.actionUrl === 'string' ? payload.actionUrl.trim() : '';
    const invitationId = typeof payload.invitationId === 'string' ? payload.invitationId.trim() : '';
    const style = typeof payload.style === 'string' ? payload.style.trim() : '';
    const status = typeof payload.status === 'string' ? payload.status.trim() : '';
    const userId = typeof payload.userId === 'string' ? payload.userId.trim() : '';
    const metadata = payload.metadata && typeof payload.metadata === 'object' && !Array.isArray(payload.metadata)
        ? payload.metadata
        : {};
    return { type, title, message, actionUrl, invitationId, style, status, userId, metadata };
}

async function enforceCallableRateLimit(uid, bucket, limits = {}) {
    const ref = db.collection('_rate_limits').doc(`${bucket}_${uid}`);
    const now = Date.now();
    const minuteWindowMs = 60 * 1000;
    const hourWindowMs = 60 * 60 * 1000;
    const dayWindowMs = 24 * 60 * 60 * 1000;
    const perMinute = Number.isFinite(limits.perMinute) ? Number(limits.perMinute) : null;
    const perHour = Number.isFinite(limits.perHour) ? Number(limits.perHour) : null;
    const perDay = Number.isFinite(limits.perDay) ? Number(limits.perDay) : null;
    const cooldownMs = Number.isFinite(limits.cooldownMs) ? Number(limits.cooldownMs) : 0;

    await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        const current = snap.exists ? (snap.data() || {}) : {};

        const lastCallAt = Number(current.lastCallAt || 0);
        const minuteWindowStart = Number(current.minuteWindowStart || 0);
        const hourWindowStart = Number(current.hourWindowStart || 0);
        const dayWindowStart = Number(current.dayWindowStart || 0);

        const minuteCount = (now - minuteWindowStart > minuteWindowMs) ? 0 : Number(current.minuteCount || 0);
        const hourCount = (now - hourWindowStart > hourWindowMs) ? 0 : Number(current.hourCount || 0);
        const dayCount = (now - dayWindowStart > dayWindowMs) ? 0 : Number(current.dayCount || 0);

        if (cooldownMs > 0 && lastCallAt > 0 && (now - lastCallAt) < cooldownMs) {
            throw new functions.https.HttpsError(
                'resource-exhausted',
                'Please wait a moment before trying again.'
            );
        }
        if ((perMinute !== null && minuteCount >= perMinute) || (perHour !== null && hourCount >= perHour) || (perDay !== null && dayCount >= perDay)) {
            throw new functions.https.HttpsError(
                'resource-exhausted',
                'Rate limit exceeded. Please try again later.'
            );
        }

        tx.set(ref, {
            uid,
            bucket,
            lastCallAt: now,
            minuteWindowStart: (now - minuteWindowStart > minuteWindowMs) ? now : minuteWindowStart,
            minuteCount: minuteCount + 1,
            hourWindowStart: (now - hourWindowStart > hourWindowMs) ? now : hourWindowStart,
            hourCount: hourCount + 1,
            dayWindowStart: (now - dayWindowStart > dayWindowMs) ? now : dayWindowStart,
            dayCount: dayCount + 1,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
    });
}

async function enforceNotificationRateLimit(uid, scope, limits) {
    await enforceCallableRateLimit(uid, `notifications_${scope}`, limits);
}

async function canSenderTriggerNotificationType({ senderId, userId, type, invitationId, metadata }) {
    if (senderId === userId) {
        // Self-directed notifications are allowed for trusted self actions.
        return true;
    }

    if (
        type === 'join_request' ||
        type === 'invitation_full' ||
        type === 'request_approved' ||
        type === 'invitation_accepted' ||
        type === 'invitation_rejected' ||
        type === 'like' ||
        type === 'comment' ||
        type === 'invitation_cancelled' ||
        type === 'booking_cancelled' ||
        type === 'invitation_completed' ||
        type === 'booking_confirmed' ||
        type === 'invitation_updated'
    ) {
        if (!invitationId) return false;
        const invSnap = await db.collection('invitations').doc(invitationId).get();
        if (!invSnap.exists) return false;
        const inv = invSnap.data() || {};
        const hostId = inv.author?.id || inv.hostId || inv.authorId;
        if (type === 'join_request') return hostId === userId && senderId !== hostId;
        if (type === 'request_approved' || type === 'invitation_full') return hostId === senderId;
        if (type === 'invitation_accepted' || type === 'invitation_rejected') return hostId === userId && senderId !== hostId;
        if (type === 'like' || type === 'comment') return hostId === userId;
        if (
            type === 'invitation_cancelled' ||
            type === 'booking_cancelled' ||
            type === 'invitation_completed' ||
            type === 'booking_confirmed' ||
            type === 'invitation_updated'
        ) return hostId === senderId;
        return false;
    }

    if (type === 'private_invitation' || type === 'private_invitation_response' || type === 'system_announcement') {
        if (invitationId) {
            const privateInvSnap = await db.collection('private_invitations').doc(invitationId).get();
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
        const partnerId = metadata?.partnerId;
        return typeof partnerId === 'string' && partnerId === senderId;
    }

    if (type === 'follow') {
        const senderSnap = await db.collection('users').doc(senderId).get();
        if (!senderSnap.exists) return false;
        const following = senderSnap.data()?.following || [];
        return Array.isArray(following) && following.includes(userId);
    }

    if (type === 'message' || type === 'reminder') {
        return true;
    }

    return false;
}

async function assertAdminContext(context) {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Authentication required.');
    }
    const requesterUid = context.auth.uid;
    const requesterEmail = (context.auth.token.email || '').toLowerCase();
    const isSuperOwner = SUPER_OWNER_UIDS.includes(requesterUid) || SUPER_OWNER_EMAILS.includes(requesterEmail);
    if (isSuperOwner || context.auth.token.admin === true) return { requesterUid, isSuperOwner };

    const requesterDoc = await db.collection('users').doc(requesterUid).get();
    const requesterRole = requesterDoc.exists ? requesterDoc.data()?.role : null;
    if (requesterRole === 'admin') return { requesterUid, isSuperOwner: false };

    throw new functions.https.HttpsError('permission-denied', 'Admin privileges required.');
}

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
    if (role === 'business' || role === 'partner' || accountType === 'business') return 'business';
    return 'user';
}

// Shared mapper for sync trigger + backfill (phase-1 schema only).
function toPublicProfile(userDocData, uid) {
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
    const userCity = asTrimmedString(userData.city) || asTrimmedString(locationData.city);
    const userCountry =
        asTrimmedString(userData.country) ||
        asTrimmedString(userData.countryCode) ||
        asTrimmedString(locationData.country);

    const businessInfo = userData.businessInfo && typeof userData.businessInfo === 'object' ? userData.businessInfo : {};
    const businessPublic = profileType === 'business'
        ? {
            isPublished: businessInfo.isPublished !== false,
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
            // Expose visual identity so directory cards & maps can match business profile
            brandKit: businessInfo.brandKit || null,
            theme: asTrimmedString(businessInfo.theme)
        }
        : null;

    return {
        uid: safeUid,
        profileType,
        displayName,
        avatarUrl: avatarUrl || null,
        search: {
            displayNameLower: displayName.trim().toLowerCase()
        },
        userPublic: profileType === 'user'
            ? {
                city: userCity || null,
                country: userCountry || null
            }
            : null,
        businessPublic,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
}

function mapPublicProfileForClient(docSnap) {
    const p = docSnap.data() || {};
    const profileType = p.profileType || 'user';
    const city = profileType === 'business'
        ? p?.businessPublic?.city || null
        : p?.userPublic?.city || null;
    const country = profileType === 'business'
        ? p?.businessPublic?.country || null
        : p?.userPublic?.country || null;

    return {
        id: docSnap.id,
        uid: docSnap.id,
        displayName: p.displayName || 'User',
        avatarUrl: p.avatarUrl || null,
        profileType,
        city,
        country
    };
}

async function getPublicProfilesByIds(ids) {
    if (!Array.isArray(ids) || ids.length === 0) return [];
    const chunks = [];
    for (let i = 0; i < ids.length; i += 10) {
        chunks.push(ids.slice(i, i + 10));
    }

    const rows = [];
    for (const chunk of chunks) {
        const publicSnap = await db.collection('public_profiles')
            .where(admin.firestore.FieldPath.documentId(), 'in', chunk)
            .get();
        publicSnap.docs.forEach((d) => rows.push(mapPublicProfileForClient(d)));
    }
    const byId = new Map(rows.map((row) => [row.id, row]));
    return ids.map((id) => byId.get(id) || {
        id,
        uid: id,
        displayName: 'User',
        avatarUrl: null,
        profileType: 'user',
        city: null,
        country: null
    });
}

// ─── Stripe Functions ───────────────────────────────────
exports.createCheckoutSession = stripeModule.createCheckoutSession;
exports.createPortalSession = stripeModule.createPortalSession;

// ─── Webhook Handler ────────────────────────────────────
exports.stripeWebhook = webhookModule.stripeWebhook;

// ─── Sync users/{uid} -> public_profiles/{uid} (backend-owned projection) ───
exports.syncPublicProfileOnUserWrite = functions.firestore
    .document('users/{uid}')
    .onWrite(async (change, context) => {
        const uid = context.params.uid;
        const publicRef = db.collection('public_profiles').doc(uid);

        // User deleted => remove public profile projection.
        if (!change.after.exists) {
            await publicRef.delete().catch(() => { });
            return null;
        }

        const mapped = toPublicProfile(change.after.data(), uid);
        if (!mapped) {
            functions.logger.warn('Skipping public profile sync: invalid uid', { uid });
            return null;
        }

        await publicRef.set(mapped, { merge: false });
        return null;
    });

// ─── Trusted callable: publish private invitation draft + consume credit ───
exports.publishPrivateInvitationDraft = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Authentication required.');
    }

    const invitationId = data?.invitationId;
    if (!invitationId || typeof invitationId !== 'string') {
        throw new functions.https.HttpsError('invalid-argument', 'invitationId is required.');
    }

    const uid = context.auth.uid;
    await enforceCallableRateLimit(uid, 'publish_private_invitation', {
        perMinute: 8,
        perHour: 100,
        perDay: 300,
        cooldownMs: 3000
    });
    const invitationRef = db.collection('private_invitations').doc(invitationId);
    const userRef = db.collection('users').doc(uid);

    const result = await db.runTransaction(async (tx) => {
        const [invSnap, userSnap] = await Promise.all([tx.get(invitationRef), tx.get(userRef)]);
        if (!invSnap.exists) {
            throw new functions.https.HttpsError('not-found', 'Private invitation draft not found.');
        }
        if (!userSnap.exists) {
            throw new functions.https.HttpsError('not-found', 'User not found.');
        }

        const inv = invSnap.data() || {};
        const user = userSnap.data() || {};
        const hostId = inv.authorId || inv.author?.id;

        if (hostId !== uid) {
            throw new functions.https.HttpsError('permission-denied', 'Only the invitation host can publish this draft.');
        }

        // Idempotent publish: do not double charge.
        if (inv.publishedAt) {
            return { alreadyPublished: true, chargedSource: null };
        }

        const isBypassUser = user.role === 'admin';
        let chargedSource = null;

        if (!isBypassUser) {
            const tier = user.subscriptionTier || 'free';
            const quota = MONTHLY_PRIVATE_QUOTAS[tier] || 0;
            const now = new Date();
            const currentMonth = `${now.getFullYear()}-${now.getMonth() + 1}`;

            let usedThisMonth = user.usedPrivateCreditsThisMonth || 0;
            const lastResetMonth = user.lastPrivateResetMonth || '';
            if (quota > 0 && lastResetMonth !== currentMonth) {
                usedThisMonth = 0;
                tx.update(userRef, {
                    usedPrivateCreditsThisMonth: 0,
                    lastPrivateResetMonth: currentMonth
                });
            }

            const purchasedCredits = user.purchasedPrivateCredits || 0;
            if (quota > 0 && usedThisMonth < quota) {
                tx.update(userRef, {
                    usedPrivateCreditsThisMonth: usedThisMonth + 1,
                    lastPrivateResetMonth: currentMonth
                });
                chargedSource = 'monthly';
            } else if (purchasedCredits > 0) {
                tx.update(userRef, {
                    purchasedPrivateCredits: purchasedCredits - 1
                });
                chargedSource = 'purchased';
            } else {
                throw new functions.https.HttpsError('failed-precondition', 'No private invitation credits remaining.');
            }
        }

        tx.update(invitationRef, {
            status: admin.firestore.FieldValue.delete(),
            publishedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        return { alreadyPublished: false, chargedSource };
    });

    return { success: true, ...result };
});

// ─── Trusted callable: create/get conversation with anti-spam limits ────────
exports.createOrGetConversation = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Authentication required.');
    }

    const uid = context.auth.uid;
    const otherUserId = typeof data?.otherUserId === 'string' ? data.otherUserId.trim() : '';
    if (!otherUserId) {
        throw new functions.https.HttpsError('invalid-argument', 'otherUserId is required.');
    }
    if (otherUserId === uid) {
        throw new functions.https.HttpsError('invalid-argument', 'Cannot create a conversation with yourself.');
    }

    await enforceCallableRateLimit(uid, 'create_or_get_conversation', {
        perMinute: 20,
        perHour: 200,
        perDay: 600,
        cooldownMs: 500
    });

    // Allow conversation between any two distinct UIDs; do not require the other user
    // to have a Firestore users doc (new accounts or delayed profile creation would otherwise block chat).

    const existingSnap = await db.collection('conversations')
        .where('participants', 'array-contains', uid)
        .limit(200)
        .get();

    const existing = existingSnap.docs.find((docSnap) => {
        const convo = docSnap.data() || {};
        const participants = Array.isArray(convo.participants) ? convo.participants : [];
        return participants.includes(otherUserId);
    });

    if (existing) {
        return { success: true, conversationId: existing.id, created: false };
    }

    const newConvo = await db.collection('conversations').add({
        participants: [uid, otherUserId],
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        lastMessageTime: admin.firestore.FieldValue.serverTimestamp(),
        lastMessage: null,
        unreadBy: []
    });

    return { success: true, conversationId: newConvo.id, created: true };
});

// ─── Trusted callable: community membership (join/leave) ───────────────────
exports.setCommunityMembership = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Authentication required.');
    }

    const uid = context.auth.uid;
    const partnerId = data?.partnerId;
    const action = data?.action; // 'join' | 'leave' | 'removeMember'
    const memberId = data?.memberId || null;

    if (!partnerId || typeof partnerId !== 'string') {
        throw new functions.https.HttpsError('invalid-argument', 'partnerId is required.');
    }
    if (!['join', 'leave', 'removeMember'].includes(action)) {
        throw new functions.https.HttpsError('invalid-argument', 'action must be join, leave, or removeMember.');
    }
    if (uid === partnerId && action !== 'removeMember') {
        throw new functions.https.HttpsError('invalid-argument', 'Cannot change membership for own community.');
    }

    const targetUserId = action === 'removeMember' ? memberId : uid;
    if (!targetUserId || typeof targetUserId !== 'string') {
        throw new functions.https.HttpsError('invalid-argument', 'Valid memberId is required for removeMember action.');
    }

    const userRef = db.collection('users').doc(targetUserId);
    const partnerRef = db.collection('users').doc(partnerId);

    const membership = await db.runTransaction(async (tx) => {
        const [userSnap, partnerSnap] = await Promise.all([tx.get(userRef), tx.get(partnerRef)]);
        if (!userSnap.exists) {
            throw new functions.https.HttpsError('not-found', 'User profile not found.');
        }
        if (!partnerSnap.exists) {
            throw new functions.https.HttpsError('not-found', 'Community owner not found.');
        }

        const partner = partnerSnap.data() || {};
        const partnerRole = partner.role || partner.accountType;
        if (!['business', 'partner'].includes(partnerRole)) {
            throw new functions.https.HttpsError('failed-precondition', 'Target user is not a community owner.');
        }

        const userData = userSnap.data() || {};
        if (action === 'removeMember' && uid !== partnerId) {
            throw new functions.https.HttpsError('permission-denied', 'Only the community owner can remove members.');
        }

        const joined = Array.isArray(userData.joinedCommunities) ? [...userData.joinedCommunities] : [];
        const members = Array.isArray(partner.communityMembers) ? [...partner.communityMembers] : [];

        if (action === 'join') {
            if (!joined.includes(partnerId)) joined.push(partnerId);
            if (!members.includes(targetUserId)) members.push(targetUserId);
        } else {
            const j = joined.filter((id) => id !== partnerId);
            joined.splice(0, joined.length, ...j);
            const m = members.filter((id) => id !== targetUserId);
            members.splice(0, members.length, ...m);
        }

        tx.update(userRef, { joinedCommunities: joined });
        tx.update(partnerRef, { communityMembers: members });

        return { isMember: joined.includes(partnerId), joinedCommunities: joined, targetUserId };
    });

    return { success: true, ...membership };
});

// ─── Trusted callable: list community members (public projection) ────────────
exports.listCommunityMembers = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Authentication required.');
    }

    const requesterUid = context.auth.uid;
    const partnerId = typeof data?.partnerId === 'string' ? data.partnerId.trim() : '';
    const includeMembers = data?.includeMembers !== false;
    const requestedLimit = Number(data?.limit);
    const limitValue = Number.isFinite(requestedLimit)
        ? Math.max(1, Math.min(200, Math.floor(requestedLimit)))
        : 50;

    if (!partnerId) {
        throw new functions.https.HttpsError('invalid-argument', 'partnerId is required.');
    }

    await enforceCallableRateLimit(requesterUid, 'list_community_members', {
        perMinute: 60,
        perHour: 1000,
        perDay: 5000,
        cooldownMs: 500
    });

    const partnerSnap = await db.collection('users').doc(partnerId).get();
    if (!partnerSnap.exists) {
        throw new functions.https.HttpsError('not-found', 'Community owner not found.');
    }
    const partner = partnerSnap.data() || {};
    const partnerRole = partner.role || partner.accountType;
    if (!['business', 'partner'].includes(partnerRole)) {
        throw new functions.https.HttpsError('failed-precondition', 'Target user is not a community owner.');
    }

    const membersSnap = await db.collection('users')
        .where('joinedCommunities', 'array-contains', partnerId)
        .limit(500)
        .get();
    const memberIds = membersSnap.docs.map((d) => d.id);
    const memberCount = memberIds.length;

    if (!includeMembers || memberCount === 0) {
        return { success: true, partnerId, memberCount, members: [] };
    }

    const selectedIds = memberIds.slice(0, limitValue);
    const ordered = await getPublicProfilesByIds(selectedIds);

    return {
        success: true,
        partnerId,
        memberCount,
        members: ordered
    };
});

// ─── Trusted callable: followers/following via public profiles ───────────────
exports.listUserNetwork = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Authentication required.');
    }

    const requesterUid = context.auth.uid;
    const userId = typeof data?.userId === 'string' && data.userId.trim()
        ? data.userId.trim()
        : requesterUid;
    const includeFollowers = data?.includeFollowers !== false;
    const includeFollowing = data?.includeFollowing !== false;
    const requestedLimit = Number(data?.limit);
    const limitValue = Number.isFinite(requestedLimit)
        ? Math.max(1, Math.min(200, Math.floor(requestedLimit)))
        : 100;

    await enforceCallableRateLimit(requesterUid, 'list_user_network', {
        perMinute: 60,
        perHour: 1200,
        perDay: 6000,
        cooldownMs: 300
    });

    const userSnap = await db.collection('users').doc(userId).get();
    if (!userSnap.exists) {
        throw new functions.https.HttpsError('not-found', 'User not found.');
    }
    const userData = userSnap.data() || {};
    const followingIds = Array.isArray(userData.following) ? userData.following : [];

    let followerIds = [];
    if (includeFollowers) {
        const followersSnap = await db.collection('users')
            .where('following', 'array-contains', userId)
            .limit(500)
            .get();
        followerIds = followersSnap.docs.map((d) => d.id);
    }

    const followerIdsLimited = followerIds.slice(0, limitValue);
    const followingIdsLimited = followingIds.slice(0, limitValue);

    const [followers, following] = await Promise.all([
        includeFollowers ? getPublicProfilesByIds(followerIdsLimited) : Promise.resolve([]),
        includeFollowing ? getPublicProfilesByIds(followingIdsLimited) : Promise.resolve([])
    ]);

    return {
        success: true,
        userId,
        followersCount: followerIds.length,
        followingCount: followingIds.length,
        followerIds: followerIdsLimited,
        followingIds: followingIdsLimited,
        followers,
        following
    };
});

exports.getFollowerCount = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Authentication required.');
    }
    const requesterUid = context.auth.uid;
    const userId = typeof data?.userId === 'string' && data.userId.trim()
        ? data.userId.trim()
        : requesterUid;

    await enforceCallableRateLimit(requesterUid, 'get_follower_count', {
        perMinute: 120,
        perHour: 3000,
        perDay: 15000,
        cooldownMs: 150
    });

    const followersSnap = await db.collection('users')
        .where('following', 'array-contains', userId)
        .limit(500)
        .get();

    return { success: true, userId, followersCount: followersSnap.size };
});

// ─── Trusted callable: resolve business uid by placeId ───────────────────────
exports.lookupBusinessByPlaceId = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Authentication required.');
    }

    const requesterUid = context.auth.uid;
    const placeId = typeof data?.placeId === 'string' ? data.placeId.trim() : '';
    if (!placeId) {
        throw new functions.https.HttpsError('invalid-argument', 'placeId is required.');
    }

    await enforceCallableRateLimit(requesterUid, 'lookup_business_place', {
        perMinute: 60,
        perHour: 1500,
        perDay: 8000,
        cooldownMs: 250
    });

    const businessSnap = await db.collection('users')
        .where('businessInfo.placeId', '==', placeId)
        .limit(5)
        .get();

    const businessDoc = businessSnap.docs.find((d) => {
        const u = d.data() || {};
        const role = u.role || u.accountType;
        return role === 'business' || role === 'partner' || u.isBusiness === true;
    });

    if (!businessDoc) {
        return { success: true, found: false, businessId: null };
    }

    return { success: true, found: true, businessId: businessDoc.id };
});

// ─── Trusted admin callable: add test locations to businesses ────────────────
exports.adminAddTestLocationsToBusinesses = functions.https.onCall(async (data, context) => {
    await assertAdminContext(context);

    const dryRun = data?.dryRun === true;
    const sampleLocations = [
        { city: 'Riyadh', lat: 24.7136, lng: 46.6753 },
        { city: 'Jeddah', lat: 21.5433, lng: 39.1728 },
        { city: 'Mecca', lat: 21.3891, lng: 39.8579 },
        { city: 'Medina', lat: 24.5247, lng: 39.5692 },
        { city: 'Dammam', lat: 26.4207, lng: 50.0888 },
        { city: 'Khobar', lat: 26.2172, lng: 50.1971 },
        { city: 'Taif', lat: 21.2703, lng: 40.4150 },
        { city: 'Tabuk', lat: 28.3838, lng: 36.5550 },
        { city: 'Abha', lat: 18.2164, lng: 42.5053 },
        { city: 'Buraidah', lat: 26.3260, lng: 43.9750 }
    ];

    const usersSnap = await db.collection('users')
        .where('role', 'in', ['business', 'partner'])
        .limit(500)
        .get();

    let scanned = 0;
    let updated = 0;
    let writeBatch = db.batch();
    let writesInBatch = 0;

    for (let i = 0; i < usersSnap.docs.length; i++) {
        const docSnap = usersSnap.docs[i];
        scanned += 1;
        const userData = docSnap.data() || {};
        const locationObj = userData.location && typeof userData.location === 'object' ? userData.location : {};
        const hasCoords = Number.isFinite(Number(locationObj.latitude)) && Number.isFinite(Number(locationObj.longitude));
        if (hasCoords) continue;

        const randomLocation = sampleLocations[i % sampleLocations.length];
        const lat = randomLocation.lat + (Math.random() - 0.5) * 0.1;
        const lng = randomLocation.lng + (Math.random() - 0.5) * 0.1;

        if (!dryRun) {
            const ref = db.collection('users').doc(docSnap.id);
            writeBatch.update(ref, {
                location: {
                    latitude: lat,
                    longitude: lng,
                    city: randomLocation.city,
                    country: 'Saudi Arabia'
                },
                'businessInfo.city': randomLocation.city,
                'businessInfo.country': 'Saudi Arabia'
            });
            writesInBatch += 1;
            if (writesInBatch >= 400) {
                await writeBatch.commit();
                writeBatch = db.batch();
                writesInBatch = 0;
            }
        }
        updated += 1;
    }

    if (!dryRun && writesInBatch > 0) {
        await writeBatch.commit();
    }

    return {
        success: true,
        dryRun,
        scanned,
        updated
    };
});

// ─── Trusted callable: admin promotion (super-owner only) ──────────────────
exports.grantAdminRole = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Authentication required.');
    }

    const requesterUid = context.auth.uid;
    const requesterEmail = (context.auth.token.email || '').toLowerCase();
    const isSuperOwner = SUPER_OWNER_UIDS.includes(requesterUid) || SUPER_OWNER_EMAILS.includes(requesterEmail);
    if (!isSuperOwner) {
        throw new functions.https.HttpsError('permission-denied', 'Only super owners can grant admin role.');
    }

    const targetUid = data?.targetUid || requesterUid;
    if (!targetUid || typeof targetUid !== 'string') {
        throw new functions.https.HttpsError('invalid-argument', 'targetUid is required.');
    }

    await db.collection('users').doc(targetUid).set({
        role: 'admin',
        accountType: 'admin',
        adminGrantedAt: admin.firestore.FieldValue.serverTimestamp(),
        adminGrantedBy: requesterUid
    }, { merge: true });

    // Keep auth-claim authorization path as primary trust boundary.
    await admin.auth().setCustomUserClaims(targetUid, { admin: true });

    return { success: true, targetUid };
});

// ─── Trusted admin callable: moderation ban/unban ───────────────────────────
exports.adminSetUserBanStatus = functions.https.onCall(async (data, context) => {
    await assertAdminContext(context);

    const targetUid = data?.targetUid;
    const banned = data?.banned === true;
    if (!targetUid || typeof targetUid !== 'string') {
        throw new functions.https.HttpsError('invalid-argument', 'targetUid is required.');
    }

    await db.collection('users').doc(targetUid).set({
        banned,
        bannedAt: banned ? admin.firestore.FieldValue.serverTimestamp() : null
    }, { merge: true });

    return { success: true, targetUid, banned };
});

// ─── Trusted admin callable: system role changes ────────────────────────────
exports.adminSetUserRole = functions.https.onCall(async (data, context) => {
    const { requesterUid, isSuperOwner } = await assertAdminContext(context);

    const targetUid = data?.targetUid;
    const role = data?.role;
    const allowedRoles = ['user', 'staff', 'support', 'admin', 'business'];
    if (!targetUid || typeof targetUid !== 'string') {
        throw new functions.https.HttpsError('invalid-argument', 'targetUid is required.');
    }
    if (!allowedRoles.includes(role)) {
        throw new functions.https.HttpsError('invalid-argument', 'Invalid role.');
    }
    if (role === 'admin' && !isSuperOwner) {
        throw new functions.https.HttpsError('permission-denied', 'Only super owners can assign admin role.');
    }

    await db.collection('users').doc(targetUid).set({
        role,
        accountType: role === 'admin' ? 'admin' : admin.firestore.FieldValue.delete()
    }, { merge: true });

    if (role === 'admin') {
        const targetUser = await admin.auth().getUser(targetUid);
        const currentClaims = targetUser.customClaims || {};
        await admin.auth().setCustomUserClaims(targetUid, { ...currentClaims, admin: true });
    } else if (targetUid !== requesterUid) {
        // Keep self-claims stable for currently signed-in caller in this request.
        const targetUser = await admin.auth().getUser(targetUid);
        const currentClaims = targetUser.customClaims || {};
        await admin.auth().setCustomUserClaims(targetUid, { ...currentClaims, admin: false });
    }

    return { success: true, targetUid, role };
});

// ─── Trusted admin callable: subscription tier changes ──────────────────────
exports.adminSetUserSubscriptionTier = functions.https.onCall(async (data, context) => {
    await assertAdminContext(context);
    const targetUid = data?.targetUid;
    const subscriptionTier = data?.subscriptionTier;
    const isBusinessUser = data?.isBusinessUser === true;
    const allowedUserTiers = ['free', 'pro', 'vip'];
    const allowedBusinessTiers = ['free', 'professional', 'elite'];

    if (!targetUid || typeof targetUid !== 'string') {
        throw new functions.https.HttpsError('invalid-argument', 'targetUid is required.');
    }
    const allowed = isBusinessUser ? allowedBusinessTiers : allowedUserTiers;
    if (!allowed.includes(subscriptionTier)) {
        throw new functions.https.HttpsError('invalid-argument', 'Invalid subscription tier.');
    }

    const updates = { subscriptionTier };
    if (!isBusinessUser) {
        updates.weeklyPrivateQuota = USER_WEEKLY_PRIVATE_QUOTAS[subscriptionTier] ?? 0;
        updates.usedPrivateCreditsThisWeek = 0;
    }

    await db.collection('users').doc(targetUid).set(updates, { merge: true });
    return { success: true, targetUid, updates };
});

// ─── Trusted admin callable: cancel user subscription ───────────────────────
exports.adminCancelUserSubscription = functions.https.onCall(async (data, context) => {
    await assertAdminContext(context);
    const targetUid = data?.targetUid;
    if (!targetUid || typeof targetUid !== 'string') {
        throw new functions.https.HttpsError('invalid-argument', 'targetUid is required.');
    }

    await db.collection('users').doc(targetUid).set({
        subscription: {
            active: false,
            status: 'canceled',
            canceledAt: admin.firestore.FieldValue.serverTimestamp()
        }
    }, { merge: true });

    return { success: true, targetUid };
});

// ─── Trusted admin callable: business limits overrides ──────────────────────
exports.adminUpdateBusinessLimits = functions.https.onCall(async (data, context) => {
    await assertAdminContext(context);
    const targetUid = data?.targetUid;
    const customLimits = data?.customLimits || {};
    const customLimitsExpiry = data?.customLimitsExpiry || {};
    const adminNotes = data?.adminNotes || '';

    if (!targetUid || typeof targetUid !== 'string') {
        throw new functions.https.HttpsError('invalid-argument', 'targetUid is required.');
    }

    await db.collection('users').doc(targetUid).set({
        businessInfo: {
            customLimits,
            customLimitsExpiry,
            adminNotes,
            lastAdminUpdate: admin.firestore.FieldValue.serverTimestamp()
        }
    }, { merge: true });

    return { success: true, targetUid };
});

// ─── Trusted callable: consume premium offer credit ─────────────────────────
exports.consumeOfferCredit = functions.https.onCall(async (_data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Authentication required.');
    }
    const uid = context.auth.uid;
    const userRef = db.collection('users').doc(uid);

    const result = await db.runTransaction(async (tx) => {
        const userSnap = await tx.get(userRef);
        if (!userSnap.exists) {
            throw new functions.https.HttpsError('not-found', 'User profile not found.');
        }
        const user = userSnap.data() || {};
        const tier = (user.subscriptionTier || 'free').toLowerCase();
        const isElite = tier === 'elite';

        if (isElite) return { consumed: false, remaining: null };

        const credits = user.offerCredits || 0;
        if (credits <= 0) {
            throw new functions.https.HttpsError('failed-precondition', 'No offer credits remaining.');
        }
        tx.update(userRef, { offerCredits: credits - 1 });
        return { consumed: true, remaining: credits - 1 };
    });

    return { success: true, ...result };
});

// ─── Trusted admin callable: migrate legacy partner roles ───────────────────
exports.adminMigratePartnerRoles = functions.https.onCall(async (_data, context) => {
    await assertAdminContext(context);

    const usersSnap = await db.collection('users').get();
    let updatedRole = 0;
    let removedType = 0;

    const batch = db.batch();
    usersSnap.docs.forEach((userDoc) => {
        const data = userDoc.data() || {};
        const updates = {};
        if (data.role === 'partner') {
            updates.role = 'business';
            updatedRole++;
        }
        if (data.accountType !== undefined) {
            updates.accountType = admin.firestore.FieldValue.delete();
            removedType++;
        }
        if (Object.keys(updates).length > 0) {
            batch.update(userDoc.ref, updates);
        }
    });

    await batch.commit();
    return { success: true, updatedRole, removedType };
});

// ─── Trusted admin callable: cleanup legacy user profiles ────────────────────
exports.adminCleanupLegacyUserProfiles = functions.https.onCall(async (data, context) => {
    await assertAdminContext(context);
    const mode = data?.mode === 'basic' ? 'basic' : 'robust';
    const dryRun = data?.dryRun === true;

    const usersSnap = await db.collection('users').limit(5000).get();
    let scanned = 0;
    let updated = 0;

    let writeBatch = db.batch();
    let writesInBatch = 0;

    for (const userDoc of usersSnap.docs) {
        scanned += 1;
        const user = userDoc.data() || {};
        const updates = {};

        const currentName = typeof user.display_name === 'string' ? user.display_name.trim() : '';
        const basicNeedsNameFix = !user.display_name || user.display_name === 'User';
        const robustNeedsNameFix = !currentName || currentName.toLowerCase() === 'user';
        const shouldFixName = mode === 'basic' ? basicNeedsNameFix : robustNeedsNameFix;

        if (shouldFixName) {
            if (typeof user.email === 'string' && user.email.includes('@')) {
                const emailName = user.email.split('@')[0] || 'Member';
                updates.display_name = emailName.charAt(0).toUpperCase() + emailName.slice(1);
            } else {
                updates.display_name = 'Member';
            }
        }

        const photo = typeof user.photo_url === 'string' ? user.photo_url : '';
        const hasLegacyAvatar = mode === 'basic'
            ? photo.includes('dicebear')
            : (photo.includes('dicebear') || photo.includes('avataaars'));
        if (hasLegacyAvatar) {
            updates.photo_url = '';
        }

        if (Object.keys(updates).length === 0) continue;
        updated += 1;

        if (!dryRun) {
            writeBatch.set(db.collection('users').doc(userDoc.id), updates, { merge: true });
            writesInBatch += 1;
            if (writesInBatch >= 400) {
                await writeBatch.commit();
                writeBatch = db.batch();
                writesInBatch = 0;
            }
        }
    }

    if (!dryRun && writesInBatch > 0) {
        await writeBatch.commit();
    }

    return { success: true, mode, dryRun, scanned, updated, errors: 0 };
});

// ─── Trusted admin callable: refresh post metadata from user profiles ────────
exports.adminRefreshPostsUserMetadata = functions.https.onCall(async (data, context) => {
    await assertAdminContext(context);
    const dryRun = data?.dryRun === true;

    const postsSnap = await db.collection('posts').limit(5000).get();
    let scanned = 0;
    let updated = 0;
    let skippedNoUser = 0;

    const userIds = Array.from(new Set(
        postsSnap.docs
            .map((d) => d.data()?.userId)
            .filter((id) => typeof id === 'string' && id.trim().length > 0)
    ));

    const userMap = new Map();
    for (let i = 0; i < userIds.length; i += 10) {
        const chunk = userIds.slice(i, i + 10);
        const usersChunkSnap = await db.collection('users')
            .where(admin.firestore.FieldPath.documentId(), 'in', chunk)
            .get();
        usersChunkSnap.docs.forEach((docSnap) => {
            const user = docSnap.data() || {};
            userMap.set(docSnap.id, {
                userName: user.display_name || 'Member',
                userPhoto: user.photo_url || user.photoURL || ''
            });
        });
    }

    let writeBatch = db.batch();
    let writesInBatch = 0;

    for (const postDoc of postsSnap.docs) {
        scanned += 1;
        const post = postDoc.data() || {};
        const userId = post.userId;
        if (!userId || !userMap.has(userId)) {
            skippedNoUser += 1;
            continue;
        }

        const profile = userMap.get(userId);
        const nextUserName = profile.userName;
        const nextUserPhoto = profile.userPhoto;
        const changed = post.userName !== nextUserName || (post.userPhoto || '') !== nextUserPhoto;
        if (!changed) continue;

        updated += 1;
        if (!dryRun) {
            writeBatch.update(db.collection('posts').doc(postDoc.id), {
                userName: nextUserName,
                userPhoto: nextUserPhoto
            });
            writesInBatch += 1;
            if (writesInBatch >= 400) {
                await writeBatch.commit();
                writeBatch = db.batch();
                writesInBatch = 0;
            }
        }
    }

    if (!dryRun && writesInBatch > 0) {
        await writeBatch.commit();
    }

    return { success: true, dryRun, scanned, updated, skippedNoUser, errors: 0 };
});

// ─── Trusted callable: create partner notification ───────────────────────────
exports.createPartnerNotification = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Authentication required.');
    }
    assertAllowedKeys(data, PARTNER_NOTIFICATION_ALLOWED_KEYS, 'Partner notification payload');

    const senderId = context.auth.uid;
    const restaurantId = typeof data?.restaurantId === 'string' ? data.restaurantId.trim() : '';
    const type = typeof data?.type === 'string' ? data.type.trim() : '';
    const title = typeof data?.title === 'string' ? data.title.trim() : '';
    const message = typeof data?.message === 'string' ? data.message.trim() : '';
    const invitationId = typeof data?.invitationId === 'string' ? data.invitationId.trim() : '';
    const date = typeof data?.date === 'string' ? data.date.trim() : '';
    const time = typeof data?.time === 'string' ? data.time.trim() : '';
    const guestsNeeded = Number.isFinite(data?.guestsNeeded) ? Number(data.guestsNeeded) : null;

    if (!restaurantId) {
        throw new functions.https.HttpsError('invalid-argument', 'restaurantId is required.');
    }
    if (!title || !message || !type) {
        throw new functions.https.HttpsError('invalid-argument', 'title and message are required.');
    }
    if (!ALLOWED_PARTNER_NOTIFICATION_TYPES.has(type)) {
        throw new functions.https.HttpsError('permission-denied', `Unsupported partner notification type: ${type}`);
    }
    if (title.length > 120 || message.length > 500) {
        throw new functions.https.HttpsError('invalid-argument', 'Notification title/message too long.');
    }
    if (type === 'new_booking') {
        if (!invitationId) {
            throw new functions.https.HttpsError('invalid-argument', 'invitationId is required for new_booking notifications.');
        }
        const invSnap = await db.collection('invitations').doc(invitationId).get();
        if (!invSnap.exists) {
            throw new functions.https.HttpsError('not-found', 'Invitation not found.');
        }
        const inv = invSnap.data() || {};
        const hostId = inv.author?.id || inv.hostId || inv.authorId;
        if (hostId !== senderId || inv.restaurantId !== restaurantId) {
            throw new functions.https.HttpsError('permission-denied', 'Caller is not allowed to create this partner notification.');
        }
    }
    await enforceNotificationRateLimit(senderId, 'partner', { perMinute: 30, perDay: 600 });

    await db.collection('partner_notifications').add({
        restaurantId,
        type,
        title,
        message,
        invitationId: invitationId || null,
        date: date || null,
        time: time || null,
        guestsNeeded: guestsNeeded || null,
        senderId,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        read: false
    });

    return { success: true };
});

// ─── Trusted callable: create user notification ──────────────────────────────
exports.createNotification = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Authentication required.');
    }
    assertAllowedKeys(data, NOTIFICATION_ALLOWED_KEYS, 'Notification payload');

    const senderId = context.auth.uid;
    const {
        userId,
        type,
        title,
        message,
        actionUrl,
        invitationId,
        style,
        status,
        metadata
    } = normalizeNotificationPayload(data);

    if (!userId) {
        throw new functions.https.HttpsError('invalid-argument', 'userId is required.');
    }
    if (!type || !title || !message) {
        throw new functions.https.HttpsError('invalid-argument', 'title and message are required.');
    }
    if (!ALLOWED_NOTIFICATION_TYPES.has(type)) {
        throw new functions.https.HttpsError('permission-denied', `Unsupported notification type: ${type}`);
    }
    if (title.length > 120 || message.length > 500) {
        throw new functions.https.HttpsError('invalid-argument', 'Notification title/message too long.');
    }
    if (actionUrl && actionUrl.length > 256) {
        throw new functions.https.HttpsError('invalid-argument', 'actionUrl is too long.');
    }
    if (Object.keys(metadata).length > 20) {
        throw new functions.https.HttpsError('invalid-argument', 'metadata contains too many keys.');
    }
    const isAllowedEvent = await canSenderTriggerNotificationType({
        senderId,
        userId,
        type,
        invitationId,
        metadata
    });
    if (!isAllowedEvent) {
        throw new functions.https.HttpsError('permission-denied', 'Caller is not allowed to trigger this notification event.');
    }
    await enforceNotificationRateLimit(senderId, 'user', { perMinute: 60, perDay: 1000 });

    const senderSnap = await db.collection('users').doc(senderId).get();
    const sender = senderSnap.exists ? senderSnap.data() : {};
    const senderName = sender.display_name || sender.displayName || context.auth.token.email || 'User';
    const senderAvatar = sender.photo_url || sender.photoURL || null;

    await db.collection('notifications').add({
        userId,
        type,
        title,
        message,
        actionUrl: actionUrl || null,
        invitationId: invitationId || null,
        style: style || null,
        status: status || null,
        metadata,
        // Trusted sender identity (server-populated)
        fromUserId: senderId,
        fromUserName: senderName,
        fromUserAvatar: senderAvatar,
        senderId,
        senderName,
        senderAvatar,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        read: false
    });

    return { success: true };
});

// ─── Trusted callable: create report with anti-spam limits ───────────────────
exports.createReport = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Authentication required.');
    }
    assertAllowedKeys(data, REPORT_ALLOWED_KEYS, 'Report payload');

    const reporterId = context.auth.uid;
    await enforceCallableRateLimit(reporterId, 'create_report', {
        perMinute: 3,
        perHour: 25,
        perDay: 60,
        cooldownMs: 5000
    });

    const type = typeof data?.type === 'string' ? data.type.trim() : '';
    const targetId = typeof data?.targetId === 'string' ? data.targetId.trim() : '';
    const targetName = typeof data?.targetName === 'string' ? data.targetName.trim() : '';
    const reason = typeof data?.reason === 'string' ? data.reason.trim() : '';
    const details = typeof data?.details === 'string' ? data.details.trim() : '';
    const metadata = data?.metadata && typeof data.metadata === 'object' && !Array.isArray(data.metadata)
        ? data.metadata
        : {};
    const allowedTypes = new Set(['user', 'invitation', 'message', 'partner']);

    if (!type || !allowedTypes.has(type)) {
        throw new functions.https.HttpsError('invalid-argument', 'Invalid report type.');
    }
    if (!targetId) {
        throw new functions.https.HttpsError('invalid-argument', 'targetId is required.');
    }
    if (!reason || reason.length > 120) {
        throw new functions.https.HttpsError('invalid-argument', 'A valid report reason is required.');
    }
    if (details.length > 1000) {
        throw new functions.https.HttpsError('invalid-argument', 'Report details are too long.');
    }
    if (Object.keys(metadata).length > 20) {
        throw new functions.https.HttpsError('invalid-argument', 'Report metadata contains too many keys.');
    }

    const reporterSnap = await db.collection('users').doc(reporterId).get();
    const reporter = reporterSnap.exists ? reporterSnap.data() : {};
    const reporterName = reporter.display_name || reporter.displayName || context.auth.token.email || 'User';

    const reportRef = await db.collection('reports').add({
        type,
        targetId,
        targetName: targetName || null,
        reason,
        details: details || '',
        metadata,
        reporterId,
        reporterName,
        status: 'pending',
        timestamp: admin.firestore.FieldValue.serverTimestamp()
    });

    return { success: true, reportId: reportRef.id };
});

// ─── Temporary admin callable: one-time public_profiles backfill ─────────────
exports.adminBackfillPublicProfiles = functions.https.onCall(async (data, context) => {
    await assertAdminContext(context);

    const dryRun = data?.dryRun === true;
    const startAfterUid = asTrimmedString(data?.startAfterUid);
    const requestedBatchSize = Number(data?.batchSize);
    const batchSize = Number.isFinite(requestedBatchSize)
        ? Math.max(1, Math.min(300, Math.floor(requestedBatchSize)))
        : 200;

    let q = db.collection('users')
        .orderBy(admin.firestore.FieldPath.documentId())
        .limit(batchSize);
    if (startAfterUid) {
        q = q.startAfter(startAfterUid);
    }

    const snap = await q.get();
    const writeBatch = dryRun ? null : db.batch();
    let scanned = 0;
    let mapped = 0;
    let skipped = 0;
    const errors = [];

    snap.docs.forEach((userDoc) => {
        scanned++;
        const projected = toPublicProfile(userDoc.data(), userDoc.id);
        if (!projected) {
            skipped++;
            errors.push({ uid: userDoc.id, reason: 'invalid_uid' });
            return;
        }
        mapped++;
        if (!dryRun) {
            writeBatch.set(db.collection('public_profiles').doc(userDoc.id), projected, { merge: false });
        }
    });

    if (!dryRun && mapped > 0) {
        await writeBatch.commit();
    }

    const nextCursor = snap.docs.length > 0 ? snap.docs[snap.docs.length - 1].id : null;
    const hasMore = snap.docs.length === batchSize;
    return {
        success: true,
        dryRun,
        scanned,
        mapped,
        skipped,
        errors,
        batchSize,
        startAfterUid: startAfterUid || null,
        nextCursor,
        hasMore
    };
});

async function adminDeleteUserCascade(targetUid) {
    const userRef = db.collection('users').doc(targetUid);
    const userSnap = await userRef.get();
    if (!userSnap.exists) return { deletedItems: 0 };

    let deletedItems = 0;
    const relatedCollections = ['communityPosts', 'stories', 'invitations', 'private_invitations', 'notifications', 'partner_notifications'];

    for (const colName of relatedCollections) {
        const snap = await db.collection(colName).get();
        const batch = db.batch();
        let batchDeletes = 0;

        snap.docs.forEach((d) => {
            const data = d.data() || {};
            const authorId = data.partnerId || data.authorId || data.userId || data.uid || data.fromUserId || data.senderId || data.reporterId || data.restaurantId || data.author?.id;
            if (authorId === targetUid || data.userId === targetUid) {
                batch.delete(d.ref);
                batchDeletes++;
                deletedItems++;
            }
        });

        if (batchDeletes > 0) await batch.commit();
    }

    await userRef.delete();
    deletedItems++;

    try {
        await admin.auth().deleteUser(targetUid);
    } catch (e) {
        // Firestore deletion is primary; auth user may already be removed.
    }

    return { deletedItems };
}

// ─── Trusted admin callable: delete user (destructive) ──────────────────────
exports.adminDeleteUser = functions.https.onCall(async (data, context) => {
    const { isSuperOwner } = await assertAdminContext(context);
    const targetUid = data?.targetUid;
    if (!targetUid || typeof targetUid !== 'string') {
        throw new functions.https.HttpsError('invalid-argument', 'targetUid is required.');
    }
    const targetSnap = await db.collection('users').doc(targetUid).get();
    const target = targetSnap.exists ? targetSnap.data() : {};
    if ((target.role === 'admin' || target.accountType === 'admin') && !isSuperOwner) {
        throw new functions.https.HttpsError('permission-denied', 'Only super owners can delete admin users.');
    }
    const result = await adminDeleteUserCascade(targetUid);
    return { success: true, targetUid, ...result };
});

// ─── Trusted admin callable: delete partner (destructive) ───────────────────
exports.adminDeletePartner = functions.https.onCall(async (data, context) => {
    await assertAdminContext(context);
    const targetUid = data?.targetUid;
    if (!targetUid || typeof targetUid !== 'string') {
        throw new functions.https.HttpsError('invalid-argument', 'targetUid is required.');
    }

    const targetSnap = await db.collection('users').doc(targetUid).get();
    const target = targetSnap.exists ? targetSnap.data() : {};
    if (target.role !== 'business') {
        throw new functions.https.HttpsError('failed-precondition', 'Target user is not a business partner.');
    }

    const result = await adminDeleteUserCascade(targetUid);
    return { success: true, targetUid, ...result };
});

// ─── Trusted admin callable: clean orphan posts/stories ─────────────────────
exports.adminCleanOrphanContent = functions.https.onCall(async (_data, context) => {
    await assertAdminContext(context);
    const usersSnap = await db.collection('users').get();
    const validUserIds = new Set(usersSnap.docs.map((d) => d.id));

    let deletedPosts = 0;
    let deletedStories = 0;

    const postsSnap = await db.collection('communityPosts').get();
    const postBatch = db.batch();
    postsSnap.docs.forEach((d) => {
        const data = d.data() || {};
        const aid = data.partnerId || data.author?.id || data.authorId || data.userId || data.uid;
        if (aid && !validUserIds.has(aid)) {
            postBatch.delete(d.ref);
            deletedPosts++;
        }
    });
    if (deletedPosts > 0) await postBatch.commit();

    const storiesSnap = await db.collection('stories').get();
    const storyBatch = db.batch();
    storiesSnap.docs.forEach((d) => {
        const data = d.data() || {};
        const aid = data.userId || data.uid || data.authorId || data.author?.id;
        if (aid && !validUserIds.has(aid)) {
            storyBatch.delete(d.ref);
            deletedStories++;
        }
    });
    if (deletedStories > 0) await storyBatch.commit();

    return { success: true, deletedPosts, deletedStories };
});

// ─── Trusted admin callable: wipe all posts/stories ─────────────────────────
exports.adminWipeCommunityContent = functions.https.onCall(async (_data, context) => {
    await assertAdminContext(context);
    let deletedPosts = 0;
    let deletedStories = 0;

    const postsSnap = await db.collection('communityPosts').get();
    const postBatch = db.batch();
    postsSnap.docs.forEach((d) => {
        postBatch.delete(d.ref);
        deletedPosts++;
    });
    if (deletedPosts > 0) await postBatch.commit();

    const storiesSnap = await db.collection('stories').get();
    const storyBatch = db.batch();
    storiesSnap.docs.forEach((d) => {
        storyBatch.delete(d.ref);
        deletedStories++;
    });
    if (deletedStories > 0) await storyBatch.commit();

    return { success: true, deletedPosts, deletedStories };
});

// ─── Scheduled: Reset weekly private invitation credits ─
// Runs every Monday at 00:00 UTC
exports.resetWeeklyPrivateCredits = functions.pubsub
    .schedule('0 0 * * 1') // Mon 00:00 UTC
    .timeZone('UTC')
    .onRun(async () => {
        const db = admin.firestore();
        console.log('⏰ Running weekly private credits reset...');

        try {
            // Find all users who have a weekly quota (i.e. paid plan)
            const snapshot = await db.collection('users')
                .where('weeklyPrivateQuota', '>', 0)
                .get();

            if (snapshot.empty) {
                console.log('No users to reset.');
                return null;
            }

            const batch = db.batch();
            let count = 0;

            snapshot.forEach(doc => {
                batch.update(doc.ref, {
                    usedPrivateCreditsThisWeek: 0,
                    weeklyResetAt: admin.firestore.FieldValue.serverTimestamp()
                });
                count++;
            });

            await batch.commit();
            console.log(`✅ Reset usedPrivateCreditsThisWeek for ${count} users.`);
        } catch (error) {
            console.error('❌ Error resetting weekly credits:', error);
        }

        return null;
    });

// ─── Scheduled: Delete expired invitations (completed 24+ hours ago) ─
// Deletes Firestore doc + messages subcollection + all associated Storage files (cost-efficient: by path, no list)
// Runs every hour
exports.deleteExpiredInvitations = functions.pubsub
    .schedule('every 1 hours')
    .timeZone('UTC')
    .onRun(async () => {
        const db = admin.firestore();
        const bucket = admin.storage().bucket();

        const now = admin.firestore.Timestamp.now();
        const twentyFourHoursAgo = new Date(now.toMillis() - 24 * 60 * 60 * 1000);
        const cutoff = admin.firestore.Timestamp.fromDate(twentyFourHoursAgo);

        function extractStoragePath(url) {
            if (!url || typeof url !== 'string' || !url.includes('firebasestorage') || !url.includes('/o/')) return null;
            try {
                const part = url.split('/o/')[1];
                if (!part) return null;
                return decodeURIComponent(part.split('?')[0]);
            } catch (e) {
                return null;
            }
        }

        function getInvitationMediaUrls(data) {
            if (!data) return [];
            const urls = [];
            ['customImage', 'customVideo', 'videoThumbnail', 'image', 'restaurantImage'].forEach(f => {
                if (data[f] && typeof data[f] === 'string' && data[f].includes('firebasestorage')) urls.push(data[f]);
            });
            return urls;
        }

        function getMessageMediaUrls(data) {
            if (!data) return [];
            const urls = [];
            ['imageUrl', 'audioUrl', 'fileUrl'].forEach(f => {
                if (data[f] && typeof data[f] === 'string' && data[f].includes('firebasestorage')) urls.push(data[f]);
            });
            if (data.attachment && data.attachment.url && typeof data.attachment.url === 'string' && data.attachment.url.includes('firebasestorage')) {
                urls.push(data.attachment.url);
            }
            return urls;
        }

        try {
            const expiredSnap = await db.collection('invitations')
                .where('meetingStatus', '==', 'completed')
                .where('completedAt', '<=', cutoff)
                .get();

            if (expiredSnap.empty) {
                console.log('deleteExpiredInvitations: no expired invitations.');
                return null;
            }

            console.log(`deleteExpiredInvitations: found ${expiredSnap.size} expired invitation(s).`);

            for (const invDoc of expiredSnap.docs) {
                const invId = invDoc.id;
                const invData = invDoc.data();
                const messagesSnap = await db.collection('invitations').doc(invId).collection('messages').get();

                const urls = [...getInvitationMediaUrls(invData)];
                messagesSnap.docs.forEach(d => urls.push(...getMessageMediaUrls(d.data())));

                const paths = [...new Set(urls)].map(extractStoragePath).filter(Boolean);
                for (const path of paths) {
                    try {
                        await bucket.file(path).delete();
                    } catch (err) {
                        if (err.code !== 404) console.warn('Storage delete failed:', path, err.message);
                    }
                }

                const batch = db.batch();
                messagesSnap.docs.forEach(d => batch.delete(d.ref));
                batch.delete(invDoc.ref);
                await batch.commit();
            }

            console.log(`deleteExpiredInvitations: deleted ${expiredSnap.size} invitation(s) and their Storage files.`);
        } catch (error) {
            console.error('deleteExpiredInvitations error:', error);
        }

        return null;
    });
