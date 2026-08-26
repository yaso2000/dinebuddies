// Load functions/.env before any module reads process.env (e.g. Stripe).
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const path = require('path');

const admin = require('firebase-admin');
admin.initializeApp();

const { inferInviteCategory, isPrivateInviteDoc } = require('./inviteCategory');
const { registerAdminBrowseUsers } = require('./adminBrowseUsers');
const { registerAdminSearchUsers } = require('./adminSearchUsers');
const { registerAdminDashboard } = require('./adminDashboard');
const { registerProfileGiftCallables } = require('./giftCredits');
const { registerAdminMassMessaging } = require('./adminMassMessaging');
const { registerDirectorySearch } = require('./directorySearch');
const { registerConsumerAccountSearch } = require('./consumerAccountSearch');
const {
    isConsumerHiddenPublicProfile,
    isConsumerHiddenUserDoc,
    isConsumerHiddenUid,
} = require('./consumerAccountVisibility');
const { registerAffiliateReferralOnUserWrite } = require('./affiliateReferral');
const {
    incrementReferralClicks,
    syncAffiliatePendingReferralOnUserWrite,
} = require('./affiliateTracking');
const { registerAffiliateAgentProfile } = require('./affiliateAuth');
const { requestAffiliatePayout } = require('./affiliatePayouts');
const stripeModule = require('./stripe');
const paypalModule = require('./paypal');
const webhookModule = require('./webhook');
const {
    CREDIT_COSTS,
    spendCreditsInTransaction,
    isBusinessUserDoc,
    normalizeBusinessSubscriptionTier,
} = require('./creditsCore');
const {
    assertCreatorCanCreateInvitations,
    assertPublicInvitationGeofenceRule,
    resolveRestaurantGeo,
    throwInvitationRuleError,
} = require('./invitationRules');
const functions = require('firebase-functions');
const { onCall: onCallV2, HttpsError: HttpsErrorV2 } = require('firebase-functions/v2/https');
const crypto = require('crypto');
const db = admin.firestore();

const SOCIAL_INVITATION_MAX_GUESTS = 30;

/** Resolve hosted invite doc — `social_invitations` (current) or legacy `private_invitations`. */
async function resolveHostedInvitationRef(invitationId) {
    const socialRef = db.collection('social_invitations').doc(invitationId);
    const socialSnap = await socialRef.get();
    if (socialSnap.exists) {
        return { ref: socialRef, snap: socialSnap, collection: 'social_invitations' };
    }
    const legacyRef = db.collection('private_invitations').doc(invitationId);
    const legacySnap = await legacyRef.get();
    if (legacySnap.exists) {
        return { ref: legacyRef, snap: legacySnap, collection: 'private_invitations' };
    }
    return { ref: socialRef, snap: socialSnap, collection: 'social_invitations' };
}

function generatePrivateInvitationShareToken() {
    return crypto.randomBytes(24).toString('hex');
}

function normalizeShareToken(raw) {
    if (!raw || typeof raw !== 'string') return null;
    const token = raw.trim();
    if (token.length < 16 || token.length > 128 || !/^[a-zA-Z0-9_-]+$/.test(token)) return null;
    return token;
}

async function findPublishedPrivateInvitationByShareToken(token) {
    const normalized = normalizeShareToken(token);
    if (!normalized) return null;
    const snap = await db
        .collection('social_invitations')
        .where('shareToken', '==', normalized)
        .limit(1)
        .get();
    if (snap.empty) return null;
    const doc = snap.docs[0];
    const data = doc.data() || {};
    if (data.status !== 'published' || !data.publishedAt) return null;
    return { id: doc.id, ...data };
}

function buildPrivateInvitationSharePreview(inv, invitationId, inviterName) {
    return {
        invitationId,
        title: String(inv.title || '').trim(),
        description: String(inv.description || '').trim(),
        date: inv.date || '',
        time: inv.time || '',
        location: String(inv.location || '').trim(),
        venueName: String(inv.venueName || inv.restaurantName || '').trim(),
        occasionType: inv.occasionType || 'Social',
        type: inv.type || 'Private',
        inviterName: inviterName || '',
        cardFontId: inv.cardFontId || null,
        cardFrameColorId: inv.cardFrameColorId || null,
        cardBackgroundId: inv.cardBackgroundId || null,
        cardGradientId: inv.cardGradientId || null,
        cardMotionId: inv.cardMotionId || null,
        socialCardThemeColor: inv.socialCardThemeColor || null,
        socialCardShowHostAndMessage: inv.socialCardShowHostAndMessage !== false,
        socialCardTextBackdropTone: inv.socialCardTextBackdropTone || null,
        customImage: inv.customImage || inv.image || inv.cardImageUrl || null,
        videoUrl: inv.videoUrl || inv.customVideo || null,
        videoThumbnail: inv.videoThumbnail || null,
        mediaType: inv.mediaType || null,
    };
}
const { createPushMessaging } = require('./pushMessaging');
const {
    resolveCommunityOwner,
    isCommunityOwnerBusiness,
    isCommunityOwnerPublic,
    isCommunityOwnerRequester,
    collectCommunityMemberIds,
} = require('./communityOwner');
const { registerCommunityMemberBroadcast } = require('./communityMemberBroadcast');
registerCommunityMemberBroadcast(exports); // retired stub — keeps the old endpoint inert
const { sendPushToUser, registerNotificationPushTrigger } = createPushMessaging({ db, admin });
/** @param {Record<string, unknown>} inv */
function isPrivateInvitationDocForBilling(inv) {
    if (!inv || typeof inv !== 'object') return false;
    // Prefer stored inviteCategory (set on draft create) so legacy social docs
    // that still use type "Private" are not billed as 1-on-1 personal invites.
    const cat = String(inv.inviteCategory || '').toLowerCase();
    if (cat === 'social') return false;
    if (cat === 'private' || cat === 'dating') return true;
    return isPrivateInviteDoc(inv);
}

/** UTC calendar-day key, e.g. "2026-08-15". Server-computed only — never trust a client date. */
function currentUtcDayKey() {
    return new Date().toISOString().slice(0, 10);
}

const PRIVATE_INVITE_DECLINE_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

const USER_WEEKLY_PRIVATE_QUOTAS = {
    free: 0,
    pro: 2,
    vip: -1,
    paid: 0,
};
const SUPER_OWNER_UIDS = ['xTgHC1v00LZIZ6ESA9YGjGU5zW33'];
const SUPER_OWNER_EMAILS = ['admin@dinebuddies.com', 'y.abohamed@gmail.com', 'yaser@dinebuddies.com', 'info@dinebuddies.com.au'];
const ALLOWED_NOTIFICATION_TYPES = new Set([
    'join_request',
    'invitation_full',
    'request_approved',
    'social_invitation_response',
    'social_invitation',
    'new_community_member',
    'community_removed',
    'community_message',
    'stage_invite',
    'system_announcement',
    'follow',
    'invitation_accepted',
    'invitation_rejected',
    'message',
    'reminder',
    'like',
    'connect',
    'greeting',
    'comment',
    'comment_like',
    'comment_reply',
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
        if (
            type === 'invitation_cancelled' ||
            type === 'booking_cancelled' ||
            type === 'invitation_completed' ||
            type === 'booking_confirmed' ||
            type === 'invitation_updated'
        ) return hostId === senderId;
        return false;
    }

    // comment, reply, like: post-based (no invitationId) or invitation host
    if (type === 'like' || type === 'comment' || type === 'comment_like' || type === 'comment_reply') {
        if (!invitationId) return true; // post-based: always allow
        const invSnap = await db.collection('invitations').doc(invitationId).get();
        if (!invSnap.exists) return false;
        const inv = invSnap.data() || {};
        const hostId = inv.author?.id || inv.hostId || inv.authorId;
        return hostId === userId;
    }

    if (type === 'social_invitation' || type === 'social_invitation_response' || type === 'system_announcement') {
        if (invitationId) {
            const privateInvSnap = await db.collection('social_invitations').doc(invitationId).get();
            if (!privateInvSnap.exists) return false;
            const inv = privateInvSnap.data() || {};
            const hostId = inv.authorId || inv.author?.id;
            const invitedFriends = Array.isArray(inv.invitedFriends) ? inv.invitedFriends : [];
            if (type === 'social_invitation') return senderId === hostId && invitedFriends.includes(userId);
            if (type === 'social_invitation_response') return userId === hostId && invitedFriends.includes(senderId);
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
        if (typeof partnerId !== 'string' || !partnerId.trim()) return false;
        if (partnerId === senderId) return true;
        const owner = await resolveCommunityOwner(db, partnerId);
        return isCommunityOwnerRequester(owner, senderId);
    }

    if (type === 'follow') {
        const senderSnap = await db.collection('users').doc(senderId).get();
        if (!senderSnap.exists) return false;
        const following = senderSnap.data()?.following || [];
        return Array.isArray(following) && following.includes(userId);
    }

    if (type === 'connect') {
        if (metadata?.mutual !== true || metadata?.source !== 'connect') return false;
        const otherUserId = metadata?.otherUserId || metadata?.senderId;
        if (typeof otherUserId !== 'string' || !otherUserId.trim()) return false;
        const otherId = otherUserId.trim();
        if (otherId !== senderId && otherId !== userId) return false;
        const [senderSnap, recipientSnap] = await Promise.all([
            db.collection('users').doc(senderId).get(),
            db.collection('users').doc(userId).get(),
        ]);
        if (!senderSnap.exists || !recipientSnap.exists) return false;
        return hasConnectConnection(senderId, userId, senderSnap.data(), recipientSnap.data());
    }

    if (type === 'greeting') {
        const senderIdMeta = metadata?.senderId;
        if (typeof senderIdMeta !== 'string' || !senderIdMeta.trim()) return false;
        const dayKey = new Date().toISOString().slice(0, 10);
        const greetId = `${userId}_${senderIdMeta.trim()}_${dayKey}`;
        const greetSnap = await db.collection('discovery_greetings').doc(greetId).get();
        return greetSnap.exists;
    }

    if (type === 'message' || type === 'reminder') {
        return true;
    }

    return false;
}

/** Matches client AdminRoute / Firestore isAdminOrPanelStaff — staff must reach adminSearchUsers & other callables. */
const ADMIN_PANEL_ROLES = new Set(['admin', 'moderator', 'support', 'staff']);

async function assertAdminContext(context) {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Authentication required.');
    }
    const requesterUid = context.auth.uid;
    const requesterEmail = (context.auth.token.email || '').toLowerCase();
    const isSuperOwner = SUPER_OWNER_UIDS.includes(requesterUid) || SUPER_OWNER_EMAILS.includes(requesterEmail);
    if (isSuperOwner || context.auth.token.admin === true) return { requesterUid, isSuperOwner };

    const requesterDoc = await db.collection('users').doc(requesterUid).get();
    const requesterRole = requesterDoc.exists ? String(requesterDoc.data()?.role || '').toLowerCase() : '';
    if (ADMIN_PANEL_ROLES.has(requesterRole)) return { requesterUid, isSuperOwner: false };

    throw new functions.https.HttpsError('permission-denied', 'Admin privileges required.');
}

registerAdminSearchUsers(exports, { db, admin, assertAdminContext });
registerAdminBrowseUsers(exports, { db, admin, assertAdminContext });
registerAdminDashboard(exports, { db, admin, assertAdminContext });
registerProfileGiftCallables(exports);
const { registerCashoutCallables } = require('./cashout');
registerCashoutCallables(exports, { assertAdminContext });
registerAdminMassMessaging(exports, { db, admin, assertAdminContext });
registerDirectorySearch(exports, { db, admin });
registerConsumerAccountSearch(exports, { db });
const { registerBusinessPostNotify } = require('./businessPostNotify');
registerBusinessPostNotify(exports, { db, admin, enforceCallableRateLimit });
const { registerStageRooms } = require('./stageRooms');
registerStageRooms(exports, { db, admin, enforceCallableRateLimit });
const { registerAccountDeletion } = require('./accountDeletion');
registerAccountDeletion(exports, { admin, enforceCallableRateLimit });
const { registerCommunityChatDisplay } = require('./communityChatDisplay');
registerCommunityChatDisplay(exports, { db, admin, enforceCallableRateLimit });
const { registerConnectMatchNotifications } = require('./connectMatchNotifications');
registerConnectMatchNotifications(exports, {
    db,
    admin,
    resolveConnectionKindFromData,
    hasConnectConnection,
});
function asTrimmedString(value) {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

function asFiniteNumber(value) {
    // Number(null) === 0 — treat missing coords as null, never Null Island.
    if (value == null || value === '') return null;
    const num = typeof value === 'number' ? value : Number(String(value).trim());
    if (!Number.isFinite(num)) return null;
    return num;
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

function resolvePublicAccountRole(userData, uid) {
    if (isConsumerHiddenUserDoc(userData, uid)) {
        return 'admin';
    }
    return asTrimmedString(userData.role)?.toLowerCase() || 'user';
}

/** Public avatar priority: user upload → Google/Facebook OAuth → null (clients show initials). */
function pickPublicAvatarUrl(userData) {
    const candidates = [
        asTrimmedString(userData.photo_url),
        asTrimmedString(userData.photoURL),
        asTrimmedString(userData.avatar),
        asTrimmedString(userData.avatarUrl),
    ].filter(Boolean);

    const isUpload = (url) =>
        /firebasestorage\.googleapis\.com|firebasestorage\.app|\.appspot\.com\/o\/|\/v0\/b\/[^/]+\/o\//i.test(
            url
        );
    const isOAuth = (url) =>
        /^https?:\/\/lh\d+\.googleusercontent\.com\/a[-/]/i.test(url) ||
        /(?:graph|scontent)[^/]*\.facebook\.com\/|fbcdn\.net\/|platform-lookaside\.fbsbx\.com\//i.test(
            url
        );
    const isStockOrGenerated = (url) =>
        /images\.unsplash\.com\//i.test(url) ||
        url.startsWith('data:image/svg+xml') ||
        url.includes('ui-avatars.com') ||
        url.includes('dicebear');

    const uploaded = candidates.find((url) => isUpload(url) && !isStockOrGenerated(url));
    if (uploaded) return uploaded;
    const oauth = candidates.find((url) => isOAuth(url));
    if (oauth) return oauth;
    return '';
}

/** Normalized for the public avatar gender ring: 'male' | 'female' | null (unspecified). */
function normalizePublicGender(userData) {
    const raw = String(userData?.gender || '').toLowerCase().trim();
    if (raw === 'male' || raw === 'm' || raw === 'man') return 'male';
    if (raw === 'female' || raw === 'f' || raw === 'woman') return 'female';
    return null;
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
        pickPublicAvatarUrl(userData) || null;

    const locationData = userData.location && typeof userData.location === 'object' ? userData.location : {};
    const userCity = asTrimmedString(userData.city) || asTrimmedString(locationData.city);
    const userCountry =
        asTrimmedString(userData.country) ||
        asTrimmedString(userData.countryCode) ||
        asTrimmedString(locationData.country);

    const businessInfo = userData.businessInfo && typeof userData.businessInfo === 'object' ? userData.businessInfo : {};
    // Public directory listing requires BOTH: verified auth email (mirrored on users.emailVerified)
    // AND explicit opt-in businessInfo.isPublished (manual hide/vacation).
    const authEmailVerified = userData.emailVerified === true;
    const userOptedIntoDirectory = businessInfo.isPublished === true;
    const bizCoords =
        businessInfo.coordinates && typeof businessInfo.coordinates === 'object'
            ? businessInfo.coordinates
            : userData.coordinates && typeof userData.coordinates === 'object'
              ? userData.coordinates
              : {};
    const businessPublic = profileType === 'business'
        ? {
            isPublished: authEmailVerified && userOptedIntoDirectory,
            businessType: asTrimmedString(businessInfo.businessType),
            city: asTrimmedString(businessInfo.city) || asTrimmedString(userData.city),
            country:
                asTrimmedString(businessInfo.country) ||
                asTrimmedString(userData.country) ||
                asTrimmedString(userData.countryCode),
            countryCode:
                asTrimmedString(businessInfo.countryCode) ||
                asTrimmedString(userData.countryCode) ||
                null,
            address: asTrimmedString(businessInfo.address) || asTrimmedString(userData.location),
            description: asTrimmedString(businessInfo.description) || asTrimmedString(userData.bio),
            coverImage: asTrimmedString(businessInfo.coverImage),
            lat: asFiniteNumber(
                businessInfo.lat ?? bizCoords.lat ?? bizCoords.latitude ?? userData.lat
            ),
            lng: asFiniteNumber(
                businessInfo.lng ?? bizCoords.lng ?? bizCoords.longitude ?? userData.lng
            ),
            // Expose visual identity so directory cards & maps can match business profile
            brandKit: businessInfo.brandKit || null,
            theme: asTrimmedString(businessInfo.theme),
            // Directory open/closed must follow saved hours (not stale Google openNow).
            hours:
                businessInfo.hours && typeof businessInfo.hours === 'object'
                    ? businessInfo.hours
                    : null,
            openingHours:
                businessInfo.openingHours && typeof businessInfo.openingHours === 'object'
                    ? businessInfo.openingHours
                    : null,
            // Paid swipe-card special offer (title + optional image + date window).
            swipeSpecialOffer: (() => {
                const offer =
                    businessInfo.swipeSpecialOffer && typeof businessInfo.swipeSpecialOffer === 'object'
                        ? businessInfo.swipeSpecialOffer
                        : null;
                if (!offer) return null;
                const title = asTrimmedString(offer.title);
                const startDate = asTrimmedString(offer.startDate || offer.startAt);
                const endDate = asTrimmedString(offer.endDate || offer.endAt);
                if (!title || !startDate || !endDate) return null;
                return {
                    title,
                    imageUrl:
                        asTrimmedString(offer.imageUrl || offer.mediaUrl) || null,
                    startDate,
                    endDate,
                };
            })(),
            // Pointer to this business's currently-open Stage, so a profile
            // visitor can tell whether the "Enter Stage" action is live without
            // querying the (list-denied) stages collection. Written by the Stage
            // lifecycle callables; the expiry lets the client ignore a pointer
            // that has aged out before the hourly purge clears it.
            liveStageId: asTrimmedString(userData.liveStageId) || null,
            liveStageExpiresAt: asTrimmedString(userData.liveStageExpiresAt) || null,
        }
        : null;

    const tierRaw = userData.subscriptionTier;
    const subscriptionTier =
        typeof tierRaw === 'string' && tierRaw.trim()
            ? tierRaw.trim().toLowerCase()
            : 'free';

    const accountRole = resolvePublicAccountRole(userData, safeUid);
    const teamRoles = new Set(['admin', 'staff', 'support', 'moderator', 'affiliate_agent']);
    const searchable = profileType === 'user' && accountRole === 'user' && !teamRoles.has(accountRole);

    return {
        uid: safeUid,
        profileType,
        displayName,
        avatarUrl: avatarUrl || null,
        // Consumer-only field: drives the male/female/unspecified avatar ring for other viewers.
        gender: profileType === 'user' ? normalizePublicGender(userData) : null,
        subscriptionTier,
        accountRole,
        searchable,
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
        publicSnap.docs.forEach((d) => {
            if (isConsumerHiddenPublicProfile(d.data(), d.id)) return;
            rows.push(mapPublicProfileForClient(d));
        });
    }
    const byId = new Map(rows.map((row) => [row.id, row]));
    return ids.map((id) => byId.get(id) || {
        id,
        uid: id,
        displayName: 'User',
        avatarUrl: null,
        profileType: 'user',
        city: null,
        country: null,
        profileHidden: true
    });
}

/** Members without a public_profiles doc (deleted/hidden accounts). */
function isVisibleCommunityProfile(profile) {
    if (!profile?.id) return false;
    if (profile.profileHidden === true) return false;
    if (isConsumerHiddenUid(profile.id)) return false;
    return true;
}

/** Blocked list: always resolve a row for owner (public profile, users doc, or fallback). */
async function resolveBlockedMemberProfiles(db, ids) {
    if (!Array.isArray(ids) || ids.length === 0) return [];

    const profiles = await getPublicProfilesByIds(ids);
    const pubById = new Map(profiles.map((row) => [row.id, row]));

    const needsUserDoc = ids.filter((id) => {
        const pub = pubById.get(id);
        return !pub || pub.profileHidden === true;
    });

    const usersById = new Map();
    for (let i = 0; i < needsUserDoc.length; i += 10) {
        const chunk = needsUserDoc.slice(i, i + 10);
        const snaps = await db.getAll(...chunk.map((id) => db.collection('users').doc(id)));
        snaps.forEach((snap) => {
            if (snap.exists) usersById.set(snap.id, snap.data() || {});
        });
    }

    return ids.map((id) => {
        const pub = pubById.get(id);
        if (pub && pub.profileHidden !== true) {
            return { ...pub, isBlocked: true };
        }
        const user = usersById.get(id) || {};
        const displayName = String(
            user.display_name || user.displayName || user.name || pub?.displayName || ''
        ).trim();
        return {
            id,
            uid: id,
            displayName: displayName && displayName !== 'User' ? displayName : `Member ${id.slice(0, 6)}`,
            avatarUrl: user.photo_url || user.photoURL || user.avatarUrl || pub?.avatarUrl || null,
            profileType: 'user',
            city: pub?.city || null,
            country: pub?.country || null,
            isBlocked: true
        };
    });
}

// ─── Stripe Functions ───────────────────────────────────
exports.createCheckoutSession = stripeModule.createCheckoutSession;
exports.createPortalSession = stripeModule.createPortalSession;
exports.createCreditsCheckoutSession = stripeModule.createCreditsCheckoutSession;
exports.createBusinessSubscriptionCheckout = stripeModule.createBusinessSubscriptionCheckout;
exports.getStripeCommerceStatus = stripeModule.getStripeCommerceStatus;
exports.createSetupIntent = stripeModule.createSetupIntent;
exports.listPaymentMethods = stripeModule.listPaymentMethods;
exports.setDefaultPaymentMethod = stripeModule.setDefaultPaymentMethod;
exports.deletePaymentMethod = stripeModule.deletePaymentMethod;
exports.createPayPalCreditsOrder = paypalModule.createPayPalCreditsOrder;
exports.capturePayPalCreditsOrder = paypalModule.capturePayPalCreditsOrder;
exports.reconcilePayPalCreditsOrder = paypalModule.reconcilePayPalCreditsOrder;
exports.createPayPalBusinessPlanOrder = paypalModule.createPayPalBusinessPlanOrder;
exports.capturePayPalBusinessPlanOrder = paypalModule.capturePayPalBusinessPlanOrder;
exports.getPayPalCommerceStatus = paypalModule.getPayPalCommerceStatus;

const googlePlayModule = require('./googlePlayBilling');
exports.verifyGooglePlayCreditsPurchase = googlePlayModule.verifyGooglePlayCreditsPurchase;
exports.getGooglePlayCommerceStatus = googlePlayModule.getGooglePlayCommerceStatus;

const appStoreModule = require('./appStoreBilling');
exports.verifyAppleCreditsPurchase = appStoreModule.verifyAppleCreditsPurchase;
exports.verifyAppleBusinessSubscription = appStoreModule.verifyAppleBusinessSubscription;
exports.getAppleCommerceStatus = appStoreModule.getAppleCommerceStatus;

// ─── Webhook Handler ────────────────────────────────────
exports.stripeWebhook = webhookModule.stripeWebhook;

// ─── Google Place photo proxy (Hosting rewrite → /api/place-photo) ───
const { placePhoto } = require('./placePhotoProxy');
exports.placePhoto = placePhoto;

const { createPrivateInvitationSharePageHandler } = require('./privateInvitationSharePage');
exports.privateInvitationSharePage = createPrivateInvitationSharePageHandler({
    db,
    findPublishedPrivateInvitationByShareToken,
    normalizeShareToken,
});

// ─── Sync users/{uid} -> public_profiles/{uid} (backend-owned projection) ───
async function syncPublicProfileFromUserDoc(uid, afterData) {
    const publicRef = db.collection('public_profiles').doc(uid);

    if (isConsumerHiddenUserDoc(afterData, uid)) {
        await publicRef.delete().catch(() => { });
        return { deleted: true, reason: 'hidden_account' };
    }
    if (String(afterData.role || '').toLowerCase() === 'affiliate_agent') {
        await publicRef.delete().catch(() => { });
        return { deleted: true, reason: 'affiliate_agent' };
    }
    if (afterData.banned === true) {
        await publicRef.delete().catch(() => { });
        return { deleted: true, reason: 'banned' };
    }

    const mapped = toPublicProfile(afterData, uid);
    // `searchable` gates consumer member directory only — businesses use businessPublic.isPublished.
    if (mapped?.profileType === 'user' && mapped.searchable === false) {
        await publicRef.delete().catch(() => { });
        return { deleted: true, profileType: mapped?.profileType || null };
    }
    if (!mapped) {
        functions.logger.warn('Skipping public profile sync: invalid uid', { uid });
        return { skipped: true };
    }

    await publicRef.set(mapped, { merge: false });
    return {
        synced: true,
        profileType: mapped.profileType,
        businessPublic: mapped.businessPublic || null,
    };
}

exports.syncPublicProfileOnUserWrite = functions.firestore
    .document('users/{uid}')
    .onWrite(async (change, context) => {
        const uid = context.params.uid;

        // User deleted => remove public profile projection.
        if (!change.after.exists) {
            await db.collection('public_profiles').doc(uid).delete().catch(() => { });
            return null;
        }

        await syncPublicProfileFromUserDoc(uid, change.after.data() || {});
        return null;
    });

/** Business owners: force users/{uid} → public_profiles/{uid} (partners directory). */
exports.syncMyBusinessPublicProfile = functions.https.onCall(async (_data, context) => {
    if (!context.auth?.uid) {
        throw new functions.https.HttpsError('unauthenticated', 'Sign in required');
    }
    const uid = context.auth.uid;
    const userRef = db.collection('users').doc(uid);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
        throw new functions.https.HttpsError('not-found', 'User not found');
    }

    let userData = userSnap.data() || {};
    if (detectPublicProfileType(userData) !== 'business') {
        throw new functions.https.HttpsError('failed-precondition', 'Business account required');
    }

    try {
        const authUser = await admin.auth().getUser(uid);
        if (authUser.emailVerified === true && userData.emailVerified !== true) {
            await userRef.set(
                { emailVerified: true, authEmail: authUser.email || null },
                { merge: true }
            );
            userData = { ...userData, emailVerified: true };
        }
    } catch (authErr) {
        functions.logger.warn('syncMyBusinessPublicProfile auth lookup failed', { uid, authErr });
    }

    return syncPublicProfileFromUserDoc(uid, userData);
});

/**
 * After email verification in Safari (iOS often has no Auth session), mirror Auth → Firestore
 * and re-sync business public_profiles so Partners directory can show published listings.
 */
exports.mirrorEmailVerifiedFromAction = functions.https.onCall(async (data) => {
    const email = String(data?.email || '').trim().toLowerCase();
    if (!email) {
        throw new functions.https.HttpsError('invalid-argument', 'email is required');
    }

    let userRecord;
    try {
        userRecord = await admin.auth().getUserByEmail(email);
    } catch {
        throw new functions.https.HttpsError('not-found', 'No account for this email');
    }

    if (userRecord.emailVerified !== true) {
        throw new functions.https.HttpsError('failed-precondition', 'Email is not verified in Auth yet');
    }

    const uid = userRecord.uid;
    const userRef = db.collection('users').doc(uid);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
        throw new functions.https.HttpsError('not-found', 'User profile not found');
    }

    let userData = userSnap.data() || {};
    await userRef.set({ emailVerified: true, authEmail: email }, { merge: true });
    userData = { ...userData, emailVerified: true };

    if (detectPublicProfileType(userData) === 'business') {
        await syncPublicProfileFromUserDoc(uid, userData);
    }

    return { ok: true, uid, profileType: detectPublicProfileType(userData) };
});

registerAffiliateReferralOnUserWrite(exports, { db, admin });
exports.incrementReferralClicks = incrementReferralClicks;
exports.syncAffiliatePendingReferralOnUserWrite = syncAffiliatePendingReferralOnUserWrite;
exports.registerAffiliateAgentProfile = registerAffiliateAgentProfile;
exports.requestAffiliatePayout = requestAffiliatePayout;

// ─── Trigger: denormalize averageRating + reviewCount into public_profiles ───
// Fires on every create/update/delete in reviews/{reviewId}.
// Eliminates the expensive N+1 rating query from the client (InvitationContext).
exports.updateBusinessRatingOnReview = functions.firestore
    .document('reviews/{reviewId}')
    .onWrite(async (change, context) => {
        const after = change.after.exists ? change.after.data() : null;
        const before = change.before.exists ? change.before.data() : null;
        const data = after || before;
        if (!data) return null;

        // Support multiple field names for business ID
        const businessId = data.partnerId || data.profileId || data.restaurantId;
        if (!businessId) {
            functions.logger.warn('updateBusinessRatingOnReview: no businessId found', { reviewId: context.params.reviewId });
            return null;
        }

        try {
            const [restSnap, userSnap] = await Promise.all([
                db.collection('restaurants').doc(businessId).get(),
                db.collection('users').doc(businessId).get(),
            ]);
            if (!restSnap.exists && !userSnap.exists) {
                await db.collection('public_profiles').doc(businessId).delete().catch(() => { });
                return null;
            }

            // Aggregate from both field patterns in one parallel query
            const [byPartner, byProfile] = await Promise.all([
                db.collection('reviews').where('partnerId', '==', businessId).get(),
                db.collection('reviews').where('profileId', '==', businessId).get()
            ]);

            // Merge, deduplicate by doc ID
            const seen = new Set();
            let total = 0;
            let count = 0;
            for (const snap of [byPartner, byProfile]) {
                for (const doc of snap.docs) {
                    if (!seen.has(doc.id)) {
                        seen.add(doc.id);
                        total += doc.data().rating || 0;
                        count++;
                    }
                }
            }

            const averageRating = count > 0 ? Math.round((total / count) * 10) / 10 : 0;

            await db.collection('public_profiles').doc(businessId).set(
                { averageRating, reviewCount: count, ratingUpdatedAt: admin.firestore.FieldValue.serverTimestamp() },
                { merge: true }
            );

            functions.logger.info(`updateBusinessRatingOnReview: ${businessId} avg=${averageRating} count=${count}`);
        } catch (err) {
            functions.logger.error('updateBusinessRatingOnReview error:', err);
        }
        return null;
    });

/**
 * Create in-app notifications for private invitation invitees (server-side, Admin SDK).
 * Does not rely on the client callable createNotification (permissions / race / silent failures).
 */
function pickPrivateInvitationCardImageUrl(inv) {
    if (!inv || typeof inv !== 'object') return null;
    const candidates = [
        inv.cardImageUrl,
        inv.customImage,
        inv.videoThumbnail,
        inv.restaurantImage,
        inv.image
    ];
    for (const raw of candidates) {
        if (typeof raw !== 'string') continue;
        const url = raw.trim();
        if (/^https:\/\//i.test(url)) return url;
    }
    return null;
}

/** Deterministic inbox doc id — idempotent resend without composite indexes. */
function socialInvitationNotificationDocId(invitationId, inviteeId) {
    return `social_inv_${invitationId}_${inviteeId}`;
}

/** Skip invitees who already have a social_invitation notif for this invite. */
async function filterInviteesNeedingSocialInvitationNotification(invitationId, inviteeIds) {
    if (!Array.isArray(inviteeIds) || inviteeIds.length === 0) return [];
    const needing = await Promise.all(
        inviteeIds.map(async (fid) => {
            if (!fid || typeof fid !== 'string') return null;
            const snap = await db
                .collection('notifications')
                .doc(socialInvitationNotificationDocId(invitationId, fid))
                .get();
            return snap.exists ? null : fid;
        })
    );
    return needing.filter(Boolean);
}

async function sendPrivateInvitationInviteeNotifications({ uid, invitationId, inviteeIds, invPre, userRef }) {
    if (!Array.isArray(inviteeIds) || inviteeIds.length === 0) return 0;

    const hostSnap = await userRef.get();
    const hostData = hostSnap.exists ? hostSnap.data() : {};
    const hostName =
        hostData.display_name ||
        hostData.displayName ||
        invPre.author?.name ||
        'Host';
    const senderAvatar =
        hostData.avatar ||
        hostData.photo_url ||
        hostData.photoURL ||
        hostData.profilePicture ||
        hostData.userPhoto ||
        null;
    const invTitle = (invPre.title && String(invPre.title).trim()) || 'Invitation';
    const occasion = invPre.occasionType || 'Social';
    const cardImageUrl = pickPrivateInvitationCardImageUrl(invPre);
    const inviteCategory = inferInviteCategory(invPre, 'private');
    const segment = inviteCategory === 'private' ? 'private' : 'social';
    const message = `${hostName} invited you: ${invTitle}`.slice(0, 500);
    const title = (inviteCategory === 'private' ? 'Personal invitation' : 'Social invitation').slice(0, 120);
    const actionUrl = `/invitation/${segment}/${invitationId}`.slice(0, 256);

    let sent = 0;
    const chunkSize = 400;
    for (let i = 0; i < inviteeIds.length; i += chunkSize) {
        const chunk = inviteeIds.slice(i, i + chunkSize);
        const batch = db.batch();
        for (const friendId of chunk) {
            if (!friendId || typeof friendId !== 'string') continue;
            const ref = db
                .collection('notifications')
                .doc(socialInvitationNotificationDocId(invitationId, friendId));
            batch.set(ref, {
                userId: friendId,
                type: 'social_invitation',
                title,
                message,
                actionUrl,
                invitationId,
                style: null,
                status: null,
                metadata: {
                    occasionType: occasion,
                    invitationTitle: invTitle,
                    cardImageUrl: cardImageUrl || null,
                    inviteCategory,
                },
                cardImageUrl: cardImageUrl || null,
                invitationTitle: invTitle,
                fromUserId: uid,
                fromUserName: hostName,
                fromUserAvatar: senderAvatar,
                senderId: uid,
                senderName: hostName,
                senderAvatar: senderAvatar,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                read: false
            });
            sent += 1;
        }
        await batch.commit();
    }
    return sent;
}

// ─── Trusted callable: publish private invitation draft + consume credit ───
exports.publishPrivateInvitationDraft = functions.https.onCall(async (data, context) => {
    try {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'Authentication required.');
        }

        const invitationId = data?.invitationId;
        if (!invitationId || typeof invitationId !== 'string') {
            throw new functions.https.HttpsError('invalid-argument', 'invitationId is required.');
        }

        const uid = context.auth.uid;
        functions.logger.info('publishPrivateInvitationDraft:start', {
            invitationId,
            uid
        });

        const { ref: invitationRef, snap: invSnapPre } = await resolveHostedInvitationRef(invitationId);
        if (!invSnapPre.exists) {
            throw new functions.https.HttpsError('not-found', 'Private invitation draft not found.');
        }
        const invPre = invSnapPre.data() || {};
        const hostPre = invPre.authorId || invPre.author?.id;
        if (hostPre !== uid) {
            throw new functions.https.HttpsError('permission-denied', 'Only the invitation host can publish this draft.');
        }

        const userRef = db.collection('users').doc(uid);

        const hostUserSnap = await userRef.get();
        if (!hostUserSnap.exists) {
            throw new functions.https.HttpsError('not-found', 'User not found.');
        }
        const hostUser = hostUserSnap.data() || {};
        const creatorBlock = assertCreatorCanCreateInvitations(hostUser);
        if (creatorBlock) {
            throwInvitationRuleError(creatorBlock);
        }

        const rawIds = Array.isArray(invPre.invitedFriends) ? invPre.invitedFriends : [];
        functions.logger.info('publishPrivateInvitationDraft:prefilter_input', {
            invitationId,
            hostPre,
            rawInvitees: rawIds.length,
            status: invPre.status || null,
            hasPublishedAt: Boolean(invPre.publishedAt)
        });
        // Do not require host→invitee follow: personal/social invites are often sent
        // from directory/search before a follow relationship exists. Still filter
        // blocked/muted/business/guest accounts.
        const filteredFriends = [];
        for (const fid of rawIds) {
            if (!fid || typeof fid !== 'string') continue;
            const fSnap = await db.collection('users').doc(fid).get();
            if (!fSnap.exists) continue;
            const fd = fSnap.data() || {};
            const role = (fd.role || '').toLowerCase();
            if (role === 'business' || role === 'guest' || fd.isBusiness === true || fd.isGuest === true) continue;
            const blocked = Array.isArray(fd.blockedUserIds) ? fd.blockedUserIds : [];
            const muted = Array.isArray(fd.mutedUserIds) ? fd.mutedUserIds : [];
            if (blocked.includes(uid)) continue;
            if (muted.includes(uid)) continue;
            filteredFriends.push(fid);
        }
        functions.logger.info('publishPrivateInvitationDraft:prefilter_output', {
            invitationId,
            validInvitees: filteredFriends.length
        });
        if (rawIds.length > 0 && filteredFriends.length === 0) {
            throw new functions.https.HttpsError(
                'failed-precondition',
                'No valid invitees remained (blocked, muted, missing, or non-user account).'
            );
        }

        // Already published: no re-charge; still deliver any missing invitee notifications.
        if (invPre.publishedAt) {
            let existingToken = invPre.shareToken || null;
            if (!existingToken) {
                existingToken = generatePrivateInvitationShareToken();
                await invitationRef.update({
                    shareToken: existingToken,
                    externalInviteEnabled: true,
                });
            }

            let notificationsSent = 0;
            let notifyError = null;
            const inviteesForNotify = filteredFriends.length > 0
                ? filteredFriends
                : rawIds.filter((id) => typeof id === 'string');
            if (inviteesForNotify.length > 0) {
                try {
                    const needing = await filterInviteesNeedingSocialInvitationNotification(
                        invitationId,
                        inviteesForNotify
                    );
                    if (needing.length > 0) {
                        notificationsSent = await sendPrivateInvitationInviteeNotifications({
                            uid,
                            invitationId,
                            inviteeIds: needing,
                            invPre,
                            userRef,
                        });
                    }
                    functions.logger.info('publishPrivateInvitationDraft:already_published_notify', {
                        invitationId,
                        notificationsSent,
                        needing: needing.length,
                    });
                } catch (notifyErr) {
                    notifyError = notifyErr?.message || 'notify_failed';
                    functions.logger.error(
                        'publishPrivateInvitationDraft: already-published invitee notifications failed',
                        invitationId,
                        notifyErr
                    );
                }
            }

            return {
                success: true,
                alreadyPublished: true,
                chargedSource: null,
                shareToken: existingToken,
                notificationsSent,
                notifyError,
            };
        }

        await enforceCallableRateLimit(uid, 'publish_social_invitation', {
            perMinute: 8,
            perHour: 100,
            perDay: 300,
            cooldownMs: 1500, // P0: faster re-share without 429 (was 3000)
        });

        const isPrivateBillPre = isPrivateInvitationDocForBilling(invPre);
        const declineRecipientId = isPrivateBillPre && filteredFriends.length === 1 ? filteredFriends[0] : null;
        const declineDocRef = declineRecipientId
            ? db.collection('private_invite_declines').doc(`${uid}_${declineRecipientId}`)
            : null;
        const dayKey = currentUtcDayKey();
        const dailyUsageRef = db.collection('invitation_daily_usage').doc(`${uid}_${dayKey}`);

        const result = await db.runTransaction(async (tx) => {
            const [invSnap, userSnap, declineSnap, dailyUsageSnap] = await Promise.all([
                tx.get(invitationRef),
                tx.get(userRef),
                declineDocRef ? tx.get(declineDocRef) : Promise.resolve(null),
                tx.get(dailyUsageRef),
            ]);
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

            if (inv.publishedAt) {
                return { alreadyPublished: true, chargedSource: null, shareToken: inv.shareToken || null };
            }

            // Decline cooldown: recipient who declined this sender can be blocked for 7 days,
            // unless they manually unlocked it. Applies even to admin senders (safety, not billing).
            if (declineSnap && declineSnap.exists) {
                const decline = declineSnap.data() || {};
                if (!decline.unlockedAt && decline.declinedAt) {
                    const declinedAtMs = decline.declinedAt.toMillis
                        ? decline.declinedAt.toMillis()
                        : Number(decline.declinedAt) || 0;
                    if (Date.now() - declinedAtMs < PRIVATE_INVITE_DECLINE_COOLDOWN_MS) {
                        throw new functions.https.HttpsError(
                            'failed-precondition',
                            'This person previously declined your invitation and has not re-opened invites from you yet.'
                        );
                    }
                }
            }

            const currentRsvps = inv.rsvps && typeof inv.rsvps === 'object' ? inv.rsvps : {};
            const nextRsvps = {};
            filteredFriends.forEach((fid) => {
                const raw = currentRsvps[fid];
                const normalized = typeof raw === 'string' ? raw.toLowerCase() : 'pending';
                nextRsvps[fid] = normalized === 'accepted' || normalized === 'declined' ? normalized : 'pending';
            });

            const shareToken = inv.shareToken || generatePrivateInvitationShareToken();

            const isBypassUser = user.role === 'admin';
            let chargedSource = null;
            const isPrivateBill = isPrivateInvitationDocForBilling(inv);
            const dailyUsage = dailyUsageSnap.exists ? dailyUsageSnap.data() || {} : {};
            const dailyUsageField = isPrivateBill ? 'privateUsed' : 'socialUsed';
            const freeToday = !dailyUsage[dailyUsageField];

            if (!isBypassUser && freeToday) {
                chargedSource = 'daily_free';
                tx.set(dailyUsageRef, {
                    uid,
                    dayKey,
                    [dailyUsageField]: true,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                }, { merge: true });
            } else if (!isBypassUser) {
                const cost = isPrivateBill
                    ? CREDIT_COSTS.PRIVATE_INVITATION
                    : CREDIT_COSTS.SOCIAL_INVITATION;
                const accountRole = isBusinessUserDoc(user) ? 'business' : 'user';
                try {
                    spendCreditsInTransaction(tx, userRef, user, {
                        uid,
                        accountRole,
                        amount: cost,
                        type: 'social_invitation_publish',
                        reason: isPrivateBill
                            ? 'private_invitation_publish'
                            : 'social_invitation_publish',
                        relatedId: invitationId,
                        allowSavedCredits: true,
                    });
                    chargedSource = 'dine_credits';
                } catch (spendErr) {
                    if (spendErr && spendErr.code === 'INSUFFICIENT_CREDITS') {
                        throw new functions.https.HttpsError(
                            'failed-precondition',
                            'Insufficient Dine Credits. Buy credits in Settings → Dine Credits.'
                        );
                    }
                    throw spendErr;
                }
            }

            const { computeArchiveAfterFirestoreTimestamp } = require('./invitationArchiveCore');

            tx.update(invitationRef, {
                invitedFriends: filteredFriends,
                rsvps: nextRsvps,
                status: 'published',
                publishedAt: admin.firestore.FieldValue.serverTimestamp(),
                archiveAfterAt: computeArchiveAfterFirestoreTimestamp(invPre.date, invPre.time),
                shareToken,
                externalInviteEnabled: true,
            });

            return { alreadyPublished: false, chargedSource, shareToken };
        });
        functions.logger.info('publishPrivateInvitationDraft:published', {
            invitationId,
            alreadyPublished: result.alreadyPublished,
            chargedSource: result.chargedSource || null,
            finalInvitees: filteredFriends.length
        });

        let notificationsSent = 0;
        let notifyError = null;
        if (filteredFriends.length > 0) {
            try {
                const needing = result.alreadyPublished
                    ? await filterInviteesNeedingSocialInvitationNotification(invitationId, filteredFriends)
                    : filteredFriends;
                if (needing.length > 0) {
                    notificationsSent = await sendPrivateInvitationInviteeNotifications({
                        uid,
                        invitationId,
                        inviteeIds: needing,
                        invPre,
                        userRef
                    });
                }
                functions.logger.info('publishPrivateInvitationDraft notifications', {
                    invitationId,
                    notificationsSent,
                    alreadyPublished: Boolean(result.alreadyPublished),
                });
            } catch (notifyErr) {
                notifyError = notifyErr?.message || 'notify_failed';
                functions.logger.error('publishPrivateInvitationDraft: invitee notifications failed', invitationId, notifyErr);
            }
        }

        return {
            success: true,
            ...result,
            notificationsSent,
            notifyError,
            shareToken: result.shareToken || null,
        };
    } catch (err) {
        if (err instanceof functions.https.HttpsError) {
            throw err;
        }
        console.error('publishPrivateInvitationDraft unexpected error', data?.invitationId, err);
        throw new functions.https.HttpsError(
            'internal',
            err?.message || 'Publish failed unexpectedly.'
        );
    }
});

// ─── Public share link: preview (no auth) ───
exports.getPrivateInvitationSharePreview = functions.https.onCall(async (data) => {
    const token = normalizeShareToken(data?.token);
    if (!token) {
        throw new functions.https.HttpsError('invalid-argument', 'token is required.');
    }

    const inv = await findPublishedPrivateInvitationByShareToken(token);
    if (!inv) {
        throw new functions.https.HttpsError('not-found', 'Invitation not found or no longer available.');
    }

    const authorId = inv.authorId || inv.author?.id;
    let inviterName =
        inv.author?.displayName || inv.author?.display_name || inv.author?.name || '';
    if (!inviterName && authorId) {
        try {
            const authorSnap = await db.collection('users').doc(authorId).get();
            if (authorSnap.exists) {
                const author = authorSnap.data() || {};
                inviterName =
                    author.display_name || author.displayName || author.name || '';
            }
        } catch (authorErr) {
            functions.logger.warn('getPrivateInvitationSharePreview:author', authorErr);
        }
    }

    return {
        preview: buildPrivateInvitationSharePreview(inv, inv.id, inviterName),
        shareToken: token,
    };
});

// ─── Public share link: claim after sign-up (auth required) ───
exports.claimPrivateInvitationShare = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Authentication required.');
    }

    const uid = context.auth.uid;
    const token = normalizeShareToken(data?.token);
    if (!token) {
        throw new functions.https.HttpsError('invalid-argument', 'token is required.');
    }

    await enforceCallableRateLimit(uid, 'claim_social_invitation_share', {
        perMinute: 12,
        perHour: 120,
        perDay: 400,
        cooldownMs: 1500,
    });

    const inv = await findPublishedPrivateInvitationByShareToken(token);
    if (!inv) {
        throw new functions.https.HttpsError('not-found', 'Invitation not found or no longer available.');
    }

    const invitationId = inv.id;
    const invitationRef = db.collection('social_invitations').doc(invitationId);
    const hostId = inv.authorId || inv.author?.id;
    if (hostId === uid) {
        return { invitationId, alreadyHost: true, claimed: false };
    }

    const invitedFriends = Array.isArray(inv.invitedFriends) ? inv.invitedFriends : [];
    if (invitedFriends.includes(uid)) {
        return { invitationId, alreadyInvited: true, claimed: false };
    }

    if (invitedFriends.length >= SOCIAL_INVITATION_MAX_GUESTS) {
        throw new functions.https.HttpsError(
            'resource-exhausted',
            'This invitation has reached the maximum number of guests.'
        );
    }

    const userSnap = await db.collection('users').doc(uid).get();
    if (!userSnap.exists) {
        throw new functions.https.HttpsError('not-found', 'User not found.');
    }
    const user = userSnap.data() || {};
    const role = (user.role || '').toLowerCase();
    if (role === 'business' || role === 'guest' || user.isBusiness === true || user.isGuest === true) {
        throw new functions.https.HttpsError(
            'failed-precondition',
            'Only personal accounts can accept this invitation.'
        );
    }

    if (hostId) {
        const blocked = Array.isArray(user.blockedUserIds) ? user.blockedUserIds : [];
        const muted = Array.isArray(user.mutedUserIds) ? user.mutedUserIds : [];
        if (blocked.includes(hostId) || muted.includes(hostId)) {
            throw new functions.https.HttpsError(
                'permission-denied',
                'You cannot join this invitation.'
            );
        }
        const hostSnap = await db.collection('users').doc(hostId).get();
        if (hostSnap.exists) {
            const host = hostSnap.data() || {};
            const hostBlocked = Array.isArray(host.blockedUserIds) ? host.blockedUserIds : [];
            const hostMuted = Array.isArray(host.mutedUserIds) ? host.mutedUserIds : [];
            if (hostBlocked.includes(uid) || hostMuted.includes(uid)) {
                throw new functions.https.HttpsError(
                    'permission-denied',
                    'You cannot join this invitation.'
                );
            }
        }
    }

    await invitationRef.update({
        invitedFriends: admin.firestore.FieldValue.arrayUnion(uid),
        [`rsvps.${uid}`]: 'pending',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { invitationId, claimed: true };
});

// ─── Host: ensure share token exists on published invitation ───
exports.ensurePrivateInvitationShareToken = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Authentication required.');
    }

    const invitationId = data?.invitationId;
    if (!invitationId || typeof invitationId !== 'string') {
        throw new functions.https.HttpsError('invalid-argument', 'invitationId is required.');
    }

    const uid = context.auth.uid;
    const invitationRef = db.collection('social_invitations').doc(invitationId);
    const snap = await invitationRef.get();
    if (!snap.exists) {
        throw new functions.https.HttpsError('not-found', 'Invitation not found.');
    }

    const inv = snap.data() || {};
    const hostId = inv.authorId || inv.author?.id;
    if (hostId !== uid) {
        throw new functions.https.HttpsError('permission-denied', 'Only the host can share this invitation.');
    }
    if (inv.status !== 'published' || !inv.publishedAt) {
        throw new functions.https.HttpsError('failed-precondition', 'Publish the invitation before sharing.');
    }

    let shareToken = inv.shareToken || null;
    if (!shareToken) {
        shareToken = generatePrivateInvitationShareToken();
        await invitationRef.update({
            shareToken,
            externalInviteEnabled: true,
        });
    }

    return { shareToken };
});

// ─── Trusted callable: publish public invitation draft (business + city rules) ───
exports.publishPublicInvitation = functions.https.onCall(async (data, context) => {
    try {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'Authentication required.');
        }

        const invitationId = data?.invitationId;
        if (!invitationId || typeof invitationId !== 'string') {
            throw new functions.https.HttpsError('invalid-argument', 'invitationId is required.');
        }

        const uid = context.auth.uid;
        await enforceCallableRateLimit(uid, 'publish_public_invitation', {
            perMinute: 8,
            perHour: 100,
            perDay: 300,
            cooldownMs: 3000,
        });

        const invitationRef = db.collection('invitations').doc(invitationId);
        const userRef = db.collection('users').doc(uid);

        const [invSnap, userSnap] = await Promise.all([invitationRef.get(), userRef.get()]);
        if (!invSnap.exists) {
            throw new functions.https.HttpsError('not-found', 'Public invitation draft not found.');
        }
        if (!userSnap.exists) {
            throw new functions.https.HttpsError('not-found', 'User not found.');
        }

        const inv = invSnap.data() || {};
        const user = userSnap.data() || {};
        const hostId = inv.author?.id || inv.hostId || inv.authorId;
        if (hostId !== uid) {
            throw new functions.https.HttpsError('permission-denied', 'Only the invitation host can publish this draft.');
        }

        const creatorBlock = assertCreatorCanCreateInvitations(user);
        if (creatorBlock) {
            throwInvitationRuleError(creatorBlock);
        }

        if (inv.status !== 'draft' && inv.publishedAt) {
            return { success: true, alreadyPublished: true };
        }

        const creatorLat = inv.userLat ?? user.coordinates?.lat ?? null;
        const creatorLng = inv.userLng ?? user.coordinates?.lng ?? null;
        let venueLat = inv.lat ?? null;
        let venueLng = inv.lng ?? null;
        let venueCountryCode = inv.countryCode ?? null;

        if (inv.restaurantId) {
            const restaurantGeo = await resolveRestaurantGeo(db, inv.restaurantId);
            if (restaurantGeo.lat != null && venueLat == null) venueLat = restaurantGeo.lat;
            if (restaurantGeo.lng != null && venueLng == null) venueLng = restaurantGeo.lng;
            if (restaurantGeo.countryCode && !venueCountryCode) {
                venueCountryCode = restaurantGeo.countryCode;
            }
        }

        // Prefer draft GPS country (set at create/preview) over possibly stale profile country.
        const creatorCountryCode =
            inv.userCountryCode || user.countryCode || user.country || null;

        const geofenceBlock = assertPublicInvitationGeofenceRule({
            creatorCoords: { lat: creatorLat, lng: creatorLng },
            venueCoords: { lat: venueLat, lng: venueLng },
            creatorCountryCode,
            venueCountryCode,
        });
        if (geofenceBlock) {
            throwInvitationRuleError(geofenceBlock);
        }

        const { computeArchiveAfterFirestoreTimestamp } = require('./invitationArchiveCore');

        await invitationRef.update({
            status: 'active',
            publishedAt: admin.firestore.FieldValue.serverTimestamp(),
            archiveAfterAt: computeArchiveAfterFirestoreTimestamp(inv.date, inv.time),
            userCity: inv.userCity || null,
            userLat: creatorLat,
            userLng: creatorLng,
            restaurantCity: inv.restaurantCity || inv.city || null,
            lat: venueLat ?? inv.lat ?? null,
            lng: venueLng ?? inv.lng ?? null,
            inviteCategory: 'public',
        });

        return { success: true, alreadyPublished: false };
    } catch (err) {
        if (err instanceof functions.https.HttpsError) {
            throw err;
        }
        console.error('publishPublicInvitation unexpected error', data?.invitationId, err);
        throw new functions.https.HttpsError(
            'internal',
            err?.message || 'Publish failed unexpectedly.'
        );
    }
});

function areMutuallyFollowing(reqData, othData, uid, otherUserId) {
    const reqFollowing = Array.isArray(reqData?.following) ? reqData.following : [];
    const othFollowing = Array.isArray(othData?.following) ? othData.following : [];
    return reqFollowing.includes(otherUserId) && othFollowing.includes(uid);
}

function isUserOpenToDatingData(data) {
    if (!data || typeof data !== 'object') return false;
    if (data.openToDating === true) return true;
    if (data.openToDating === false) return false;
    const lookingFor = Array.isArray(data.lookingFor) ? data.lookingFor : [];
    return lookingFor.includes('dating');
}

function resolveConnectionKindFromData(a, b) {
    const aOpen = isUserOpenToDatingData(a);
    const bOpen = isUserOpenToDatingData(b);
    if (aOpen && bOpen) return 'dating';
    if (!aOpen && !bOpen) return 'friendship';
    return 'acquaintance';
}

async function hasMutualDiscoveryMatch(uid, otherUserId) {
    const [likeSnapA, likeSnapB] = await Promise.all([
        db.collection('discovery_likes').doc(`${otherUserId}_${uid}`).get(),
        db.collection('discovery_likes').doc(`${uid}_${otherUserId}`).get(),
    ]);
    if (!likeSnapA.exists || !likeSnapB.exists) return false;
    const d1 = likeSnapA.data();
    const d2 = likeSnapB.data();
    return d1?.mutual === true || d2?.mutual === true;
}

async function hasAcquaintanceConnection(uid, otherUserId, reqData, othData) {
    const reqFollowing = Array.isArray(reqData?.following) ? reqData.following : [];
    const othFollowing = Array.isArray(othData?.following) ? othData.following : [];

    if (areMutuallyFollowing(reqData, othData, uid, otherUserId)) {
        return true;
    }

    const [likeReqToOth, likeOthToReq] = await Promise.all([
        db.collection('discovery_likes').doc(`${otherUserId}_${uid}`).get(),
        db.collection('discovery_likes').doc(`${uid}_${otherUserId}`).get(),
    ]);

    const reqLikedOth = likeReqToOth.exists;
    const othLikedReq = likeOthToReq.exists;

    if (reqFollowing.includes(otherUserId) && othLikedReq) return true;
    if (othFollowing.includes(uid) && reqLikedOth) return true;
    return false;
}

async function hasConnectConnection(uid, otherUserId, reqData, othData) {
    const kind = resolveConnectionKindFromData(reqData, othData);
    if (kind === 'dating') return hasMutualDiscoveryMatch(uid, otherUserId);
    if (kind === 'friendship') return areMutuallyFollowing(reqData, othData, uid, otherUserId);
    return hasAcquaintanceConnection(uid, otherUserId, reqData, othData);
}

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

    // Deterministic conversation ID: sorted UIDs joined by "_".
    const conversationId = [uid, otherUserId].sort().join('_');
    const convRef = db.collection('conversations').doc(conversationId);

    const [existingSnap, reqSnap, othSnap] = await Promise.all([
        convRef.get(),
        db.collection('users').doc(uid).get(),
        db.collection('users').doc(otherUserId).get(),
    ]);
    const reqData = reqSnap.data() || {};
    const othData = othSnap.data() || {};
    const reqBlocked = reqData.blockedUserIds || [];
    const reqMuted = reqData.mutedUserIds || [];
    const othBlocked = othData.blockedUserIds || [];
    const othMuted = othData.mutedUserIds || [];
    if (reqBlocked.includes(otherUserId) || reqMuted.includes(otherUserId)) {
        throw new functions.https.HttpsError('failed-precondition', 'Messaging is not available with this user.');
    }
    if (othBlocked.includes(uid) || othMuted.includes(uid)) {
        throw new functions.https.HttpsError('failed-precondition', 'Messaging is not available with this user.');
    }

    const isSystemPeer = reqData.isSystemAccount === true || othData.isSystemAccount === true;
    // Complete social/professional separation: personal chat is user↔user only.
    // A business never opens (or receives) a personal conversation — business↔user
    // communication happens solely via the Business Inbox and Stage rooms. Reject
    // any business participant outright, then require a real Connect connection.
    if (isBusinessUserDoc(reqData) || isBusinessUserDoc(othData)) {
        throw new functions.https.HttpsError(
            'failed-precondition',
            'Business accounts use the Business inbox, not personal chat.'
        );
    }

    if (!isSystemPeer) {
        const hasConnection = await hasConnectConnection(uid, otherUserId, reqData, othData);
        if (!hasConnection) {
            throw new functions.https.HttpsError(
                'failed-precondition',
                'Mutual connection required to start a conversation.'
            );
        }
    }

    if (existingSnap.exists) {
        return { success: true, conversationId, created: false };
    }

    // Rate limit only when creating a new conversation (not on idempotent get).
    await enforceCallableRateLimit(uid, 'create_or_get_conversation', {
        perMinute: 20,
        perHour: 200,
        perDay: 600,
        cooldownMs: 500,
    });

    await convRef.set({
        participants: [uid, otherUserId],
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        lastMessageTime: admin.firestore.FieldValue.serverTimestamp(),
        lastMessage: null,
        unreadBy: []
    });

    return { success: true, conversationId, created: true };
});

// ─── Trusted callable: community membership (join/leave) ───────────────────
exports.setCommunityMembership = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Authentication required.');
    }

    const uid = context.auth.uid;
    const partnerId = data?.partnerId;
    const action = data?.action; // join | leave | removeMember | blockMember | unblockMember | muteMember | unmuteMember
    const memberId = data?.memberId || null;

    if (!partnerId || typeof partnerId !== 'string') {
        throw new functions.https.HttpsError('invalid-argument', 'partnerId is required.');
    }
    const allowedActions = [
        'join', 'leave', 'removeMember',
        'blockMember', 'unblockMember', 'muteMember', 'unmuteMember'
    ];
    if (!allowedActions.includes(action)) {
        throw new functions.https.HttpsError('invalid-argument', 'Invalid membership action.');
    }
    // Owner cannot join/leave their own community; moderation actions are allowed.
    if (uid === partnerId && (action === 'join' || action === 'leave')) {
        throw new functions.https.HttpsError('invalid-argument', 'Cannot change membership for own community.');
    }

    const ownerOnlyActions = ['removeMember', 'blockMember', 'unblockMember', 'muteMember', 'unmuteMember'];
    const targetUserId = ownerOnlyActions.includes(action) ? memberId : uid;
    if (!targetUserId || typeof targetUserId !== 'string') {
        throw new functions.https.HttpsError('invalid-argument', 'Valid memberId is required for this action.');
    }

    const userRef = db.collection('users').doc(targetUserId);
    const userPartnerRef = db.collection('users').doc(partnerId);
    const restaurantPartnerRef = db.collection('restaurants').doc(partnerId);
    // Admin Google imports can live only as a public_profiles projection (no
    // users/ or restaurants/ doc). Membership is user-side, so such an "orphan"
    // business must still accept joins — we confirm it is a business here.
    const publicProfilePartnerRef = db.collection('public_profiles').doc(partnerId);

    const membership = await db.runTransaction(async (tx) => {
        const [userSnap, userPartnerSnap, restaurantPartnerSnap, publicProfilePartnerSnap] = await Promise.all([
            tx.get(userRef),
            tx.get(userPartnerRef),
            tx.get(restaurantPartnerRef),
            tx.get(publicProfilePartnerRef),
        ]);

        // Prefer a real business owner doc (users business OR restaurants listing).
        // Avoid failing join when users/{id} exists but is not a business while restaurants/{id} is.
        let partnerRef = null;
        let partnerSnap = null;
        const userOwnerCandidate = userPartnerSnap.exists
            ? { source: 'users', data: userPartnerSnap.data() || {} }
            : null;
        const restaurantOwnerCandidate = restaurantPartnerSnap.exists
            ? { source: 'restaurants', data: restaurantPartnerSnap.data() || {} }
            : null;
        if (userOwnerCandidate && isCommunityOwnerBusiness(userOwnerCandidate)) {
            partnerRef = userPartnerRef;
            partnerSnap = userPartnerSnap;
        } else if (restaurantOwnerCandidate && isCommunityOwnerBusiness(restaurantOwnerCandidate)) {
            partnerRef = restaurantPartnerRef;
            partnerSnap = restaurantPartnerSnap;
        } else if (userPartnerSnap.exists) {
            partnerRef = userPartnerRef;
            partnerSnap = userPartnerSnap;
        } else if (restaurantPartnerSnap.exists) {
            partnerRef = restaurantPartnerRef;
            partnerSnap = restaurantPartnerSnap;
        }

        if (!userSnap.exists && action !== 'unblockMember') {
            throw new functions.https.HttpsError('not-found', 'User profile not found.');
        }

        // A business owns a community; it never joins someone else's. This was
        // only ever enforced by hiding buttons in the client, so any stale link
        // or direct call still went through.
        if (
            action === 'join' &&
            isCommunityOwnerBusiness({ source: 'users', data: userSnap.data() || {} })
        ) {
            throw new functions.https.HttpsError(
                'failed-precondition',
                'Business accounts own a community and cannot join another one.'
            );
        }
        // A business exists if a users/ or restaurants/ owner doc says so, OR if
        // only its public_profiles projection remains (orphaned admin import).
        const publicProfile = publicProfilePartnerSnap.exists ? (publicProfilePartnerSnap.data() || {}) : null;
        const publicIsBusiness =
            !!publicProfile &&
            (String(publicProfile.profileType || '').toLowerCase() === 'business' ||
                String(publicProfile.accountRole || '').toLowerCase() === 'business');

        if (!partnerSnap || !partnerRef) {
            // No owner doc at all — accept only when the public projection is a
            // business, and never for owner-only moderation (there is no owner doc
            // to hold blocked/muted state for an orphan).
            if (!publicIsBusiness) {
                throw new functions.https.HttpsError('not-found', 'Community owner not found.');
            }
            if (ownerOnlyActions.includes(action)) {
                throw new functions.https.HttpsError('failed-precondition', 'This community cannot be managed yet.');
            }
        } else {
            const owner = {
                source: partnerRef.path.includes('/restaurants/') ? 'restaurants' : 'users',
                data: partnerSnap.data() || {},
            };
            // Owner doc exists but is not flagged as a business: still accept if the
            // public projection confirms a business listing.
            if (!isCommunityOwnerBusiness(owner) && !publicIsBusiness) {
                throw new functions.https.HttpsError('failed-precondition', 'Target user is not a community owner.');
            }
        }

        const partner = partnerSnap ? (partnerSnap.data() || {}) : {};
        if (ownerOnlyActions.includes(action) && uid !== partnerId && uid !== String(partner.ownerId || '')) {
            throw new functions.https.HttpsError('permission-denied', 'Only the community owner can manage members.');
        }

        const userData = userSnap.data() || {};
        const joined = Array.isArray(userData.joinedCommunities) ? [...userData.joinedCommunities] : [];
        const members = Array.isArray(partner.communityMembers) ? [...partner.communityMembers] : [];
        const blocked = Array.isArray(partner.communityBlockedUserIds) ? [...partner.communityBlockedUserIds] : [];
        const muted = Array.isArray(partner.communityMutedUserIds) ? [...partner.communityMutedUserIds] : [];

        const removeFromMembership = () => {
            const j = joined.filter((id) => id !== partnerId);
            joined.splice(0, joined.length, ...j);
            const m = members.filter((id) => id !== targetUserId);
            members.splice(0, members.length, ...m);
            const mu = muted.filter((id) => id !== targetUserId);
            muted.splice(0, muted.length, ...mu);
        };

        if (action === 'join') {
            if (blocked.includes(targetUserId)) {
                throw new functions.https.HttpsError('permission-denied', 'You are blocked from joining this community.');
            }
            if (!joined.includes(partnerId)) joined.push(partnerId);
            if (!members.includes(targetUserId)) members.push(targetUserId);
        } else if (action === 'leave') {
            removeFromMembership();
        } else if (action === 'removeMember' || action === 'blockMember') {
            removeFromMembership();
            if (!blocked.includes(targetUserId)) blocked.push(targetUserId);
        } else if (action === 'unblockMember') {
            const b = blocked.filter((id) => id !== targetUserId);
            blocked.splice(0, blocked.length, ...b);
        } else if (action === 'muteMember') {
            const isActiveMember = members.includes(targetUserId) || joined.includes(partnerId);
            if (!isActiveMember) {
                throw new functions.https.HttpsError('failed-precondition', 'User is not a community member.');
            }
            if (!members.includes(targetUserId)) members.push(targetUserId);
            if (!muted.includes(targetUserId)) muted.push(targetUserId);
        } else if (action === 'unmuteMember') {
            const mu = muted.filter((id) => id !== targetUserId);
            muted.splice(0, muted.length, ...mu);
        }

        const partnerUpdates = {
            communityMembers: members,
            communityBlockedUserIds: blocked,
            communityMutedUserIds: muted
        };

        if (action !== 'unblockMember' && action !== 'muteMember' && action !== 'unmuteMember') {
            tx.update(userRef, { joinedCommunities: joined });
        }
        // Orphan businesses have no owner doc; the member cache lives only on the
        // user side (joinedCommunities) and is read back via array-contains.
        if (partnerRef) {
            tx.update(partnerRef, partnerUpdates);
        }

        return {
            isMember: joined.includes(partnerId),
            joinedCommunities: joined,
            targetUserId,
            isMuted: muted.includes(targetUserId),
            isBlocked: blocked.includes(targetUserId)
        };
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
        perMinute: 120,
        perHour: 1000,
        perDay: 5000,
        cooldownMs: 0
    });

    const owner = await resolveCommunityOwner(db, partnerId);
    if (!owner) {
        throw new functions.https.HttpsError('not-found', 'Community owner not found.');
    }
    if (!isCommunityOwnerBusiness(owner)) {
        throw new functions.https.HttpsError('failed-precondition', 'Target user is not a community owner.');
    }

    const isOwner = isCommunityOwnerRequester(owner, requesterUid);
    const isVerified = isCommunityOwnerPublic(owner);

    // If not verified, ONLY the owner can list members.
    if (!isVerified && !isOwner) {
        throw new functions.https.HttpsError('permission-denied', 'This community is not yet public.');
    }

    const memberIds = await collectCommunityMemberIds(db, partnerId, owner);
    const mutedIds = Array.isArray(owner.data?.communityMutedUserIds) ? owner.data.communityMutedUserIds : [];
    const blockedIds = Array.isArray(owner.data?.communityBlockedUserIds) ? owner.data.communityBlockedUserIds : [];

    const countSampleIds = memberIds.slice(0, Math.min(memberIds.length, 500));
    const visibleMembers = countSampleIds.length
        ? (await getPublicProfilesByIds(countSampleIds)).filter(isVisibleCommunityProfile)
        : [];
    const memberCount = visibleMembers.length;

    const blockedMembers = isOwner && blockedIds.length
        ? await resolveBlockedMemberProfiles(db, blockedIds.slice(0, limitValue))
        : [];

    if (!includeMembers || memberCount === 0) {
        return {
            success: true,
            partnerId,
            memberCount,
            members: [],
            blockedMembers
        };
    }

    const membersWithFlags = visibleMembers.slice(0, limitValue).map((member) => ({
        ...member,
        isMuted: mutedIds.includes(member.id)
    }));

    return {
        success: true,
        partnerId,
        memberCount,
        members: membersWithFlags,
        blockedMembers
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
        perMinute: 120,
        perHour: 2400,
        perDay: 12000,
        cooldownMs: 0
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

    const visibleFollowers = followers.filter((p) => p?.id && !isConsumerHiddenUid(p.id) && p.profileHidden !== true);
    const visibleFollowing = following.filter((p) => p?.id && !isConsumerHiddenUid(p.id) && p.profileHidden !== true);

    return {
        success: true,
        userId,
        followersCount: followerIds.length,
        followingCount: followingIds.length,
        followerIds: followerIdsLimited,
        followingIds: followingIdsLimited,
        followers: visibleFollowers,
        following: visibleFollowing
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

const { registerSetUserFollow } = require('./setUserFollow');
registerSetUserFollow(exports, { db, isBusinessUserDoc, enforceCallableRateLimit });

const { registerPrivateInvitationConnection } = require('./privateInvitationConnection');
registerPrivateInvitationConnection(exports, { db, isBusinessUserDoc, enforceCallableRateLimit });

const { registerSocialInvitationMembership } = require('./socialInvitationMembership');
registerSocialInvitationMembership(exports, { db, admin, enforceCallableRateLimit });

const { registerYoutubeSearch } = require('./youtubeSearch');
registerYoutubeSearch(exports, { db, admin, enforceCallableRateLimit });

const { registerYoutubeSearchSuggestions } = require('./youtubeSearchSuggestions');
registerYoutubeSearchSuggestions(exports, { enforceCallableRateLimit });

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

// ─── Trusted callable: Google place → published DineBuddies venue (exact match) ─
const { resolveDineBuddiesVenueFromGoogle } = require('./resolveDineBuddiesVenueFromGoogle');

exports.resolveDineBuddiesVenueFromGoogle = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Authentication required.');
    }

    const requesterUid = context.auth.uid;
    await enforceCallableRateLimit(requesterUid, 'resolve_db_venue_google', {
        perMinute: 40,
        perHour: 800,
        perDay: 4000,
        cooldownMs: 300,
    });

    const placeId = typeof data?.placeId === 'string' ? data.placeId.trim() : '';
    const address = typeof data?.address === 'string' ? data.address.trim() : '';
    const lat = data?.lat != null ? Number(data.lat) : null;
    const lng = data?.lng != null ? Number(data.lng) : null;

    if (!placeId && !address && (!Number.isFinite(lat) || !Number.isFinite(lng))) {
        throw new functions.https.HttpsError(
            'invalid-argument',
            'placeId or address or lat/lng is required.'
        );
    }

    const result = await resolveDineBuddiesVenueFromGoogle(db, { placeId, address, lat, lng });
    return {
        success: true,
        found: Boolean(result.found),
        matchReason: result.matchReason || null,
        venue: result.venue || null,
    };
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

    // Set both 'admin' and 'superOwner' Custom Claims for token-based rule evaluation.
    // superOwner allows the user to pass isSuperOwner() checks in firestore.rules.
    await admin.auth().setCustomUserClaims(targetUid, { admin: true, superOwner: isSuperOwner });

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

    try {
        await admin.auth().updateUser(targetUid, { disabled: banned });
    } catch (e) {
        functions.logger.warn('adminSetUserBanStatus: auth updateUser failed', targetUid, e.message);
    }

    return { success: true, targetUid, banned };
});

// ─── Trusted admin callable: system role changes ────────────────────────────
exports.adminSetUserRole = functions.https.onCall(async (data, context) => {
    const { requesterUid, isSuperOwner } = await assertAdminContext(context);

    const targetUid = data?.targetUid;
    const role = data?.role;
    const allowedRoles = ['user', 'staff', 'support', 'admin', 'business', 'affiliate_agent'];
    if (!targetUid || typeof targetUid !== 'string') {
        throw new functions.https.HttpsError('invalid-argument', 'targetUid is required.');
    }
    if (!allowedRoles.includes(role)) {
        throw new functions.https.HttpsError('invalid-argument', 'Invalid role.');
    }
    if (role === 'admin' && !isSuperOwner) {
        throw new functions.https.HttpsError('permission-denied', 'Only super owners can assign admin role.');
    }

    const targetSnap = await db.collection('users').doc(targetUid).get();
    const prior = targetSnap.exists ? targetSnap.data() : {};
    const priorRole = asTrimmedString(prior.role) || 'user';
    if (role === 'business' && priorRole !== 'business' && priorRole !== 'partner') {
        throw new functions.https.HttpsError(
            'failed-precondition',
            'Cannot promote a consumer to business via admin role. Use the business signup / billing flow.'
        );
    }
    if ((priorRole === 'business' || priorRole === 'partner') && role === 'user') {
        throw new functions.https.HttpsError(
            'failed-precondition',
            'Cannot demote a business account to consumer via this endpoint.'
        );
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
    const allowedBusinessTiers = ['free', 'paid'];

    if (!targetUid || typeof targetUid !== 'string') {
        throw new functions.https.HttpsError('invalid-argument', 'targetUid is required.');
    }
    const allowed = isBusinessUser ? allowedBusinessTiers : allowedUserTiers;
    if (!allowed.includes(subscriptionTier)) {
        throw new functions.https.HttpsError('invalid-argument', 'Invalid subscription tier.');
    }

    const updates = { subscriptionTier };
    if (isBusinessUser) {
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
    // Comprehensive avatar extraction exactly like frontend avatarUtils.js
    const senderAvatar = sender.avatar || sender.photo_url || sender.photoURL || sender.profilePicture || sender.userPhoto || sender.logo || sender.logoImage || null;

    const notifRef = db.collection('notifications').doc();
    await notifRef.set({
        userId,
        type,
        title,
        message,
        actionUrl: actionUrl || null,
        invitationId: invitationId || null,
        style: style || null,
        status: status || null,
        metadata,
        fromUserId: senderId,
        fromUserName: senderName,
        fromUserAvatar: senderAvatar,
        senderId,
        senderName,
        senderAvatar,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        read: false,
    });

    // Push is sent once by onNotificationCreated (avoid double FCM → double iOS banners).
    return { success: true, id: notifRef.id, pushDelivered: 'trigger' };
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
    const allowedTypes = new Set(['user', 'invitation', 'post', 'message', 'partner']);

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

// ─── Trusted admin callable: aggregated dashboard counts (no full collection scan on client) ─
exports.adminGetDashboardStats = functions.https.onCall(async (_data, context) => {
    await assertAdminContext(context);
    const usersCol = db.collection('users');
    const [
        totalAgg,
        userAgg,
        bizAgg,
        teamAgg,
        invPub,
        invPriv,
        repPend,
    ] = await Promise.all([
        usersCol.count().get(),
        usersCol.where('role', '==', 'user').count().get(),
        usersCol.where('role', '==', 'business').count().get(),
        usersCol.where('role', 'in', ['admin', 'staff', 'support']).count().get(),
        db.collection('invitations').count().get(),
        db.collection('social_invitations').count().get(),
        db.collection('reports').where('status', '==', 'pending').count().get(),
    ]);
    return {
        success: true,
        usersTotal: totalAgg.data().count,
        usersConsumer: userAgg.data().count,
        usersBusiness: bizAgg.data().count,
        usersTeam: teamAgg.data().count,
        invitationsPublic: invPub.data().count,
        invitationsPrivate: invPriv.data().count,
        reportsPending: repPend.data().count,
    };
});

// ─── Trusted admin callable: moderation report status ───────────────────────
exports.adminSetReportStatus = functions.https.onCall(async (data, context) => {
    await assertAdminContext(context);
    const reportId = asTrimmedString(data?.reportId);
    const status = asTrimmedString(data?.status);
    const allowed = new Set(['pending', 'resolved', 'dismissed']);
    if (!reportId || !allowed.has(status)) {
        throw new functions.https.HttpsError('invalid-argument', 'reportId and a valid status are required.');
    }
    await db.collection('reports').doc(reportId).set({
        status,
        moderationUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
        moderationUpdatedBy: context.auth.uid,
    }, { merge: true });
    return { success: true, reportId, status };
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
    const { purgeUserAccountData } = require('./accountDeletionCore');
    const stats = await purgeUserAccountData(admin, targetUid, { deleteAuthUser: true });
    const deletedItems = Object.values(stats).reduce((sum, n) => sum + (Number(n) || 0), 0);
    return { deletedItems, storageObjectsDeleted: stats.storagePrefixes || 0, stats };
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

/** Firestore batch writes are limited to 500 ops; delete in chunks. */
async function deleteAllDocsInCollection(collectionName, chunkSize = 450) {
    const colRef = db.collection(collectionName);
    let total = 0;
    for (;;) {
        const snap = await colRef.limit(chunkSize).get();
        if (snap.empty) break;
        const batch = db.batch();
        snap.docs.forEach((d) => batch.delete(d.ref));
        await batch.commit();
        total += snap.docs.length;
    }
    return total;
}

// ─── Trusted admin callable: wipe all posts/stories ─────────────────────────
exports.adminWipeCommunityContent = functions
    // 512MB: some Gen1 projects fail updating when memory is set to 1GB; 540s for large wipes.
    .runWith({ timeoutSeconds: 540, memory: '512MB' })
    .https.onCall(async (_data, context) => {
        await assertAdminContext(context);
        const deletedPosts = await deleteAllDocsInCollection('communityPosts');
        const deletedStories = await deleteAllDocsInCollection('stories');
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

exports.archiveExpiredSocialInvitations = functions.pubsub
    .schedule('every 30 minutes')
    .timeZone('UTC')
    .onRun(async () => {
        const { runArchiveExpiredSocialInvitations } = require('./invitationArchiveCore');
        try {
            await runArchiveExpiredSocialInvitations(db);
        } catch (error) {
            console.error('archiveExpiredSocialInvitations error:', error);
        }
        return null;
    });

// ─── Scheduled: Archive expired public invitations (remove live doc, keep read-only snapshot) ───
exports.archiveExpiredPublicInvitations = functions.pubsub
    .schedule('every 30 minutes')
    .timeZone('UTC')
    .onRun(async () => {
        const { runArchiveExpiredPublicInvitations } = require('./publicInvitationArchiveCore');
        try {
            await runArchiveExpiredPublicInvitations(db);
        } catch (error) {
            console.error('archiveExpiredPublicInvitations error:', error);
        }
        return null;
    });

// ─── Scheduled: Delete inactive private conversations (30 days no activity) ───
// Runs daily at 04:00 UTC.
exports.deleteInactivePrivateConversations = functions.pubsub
    .schedule('0 4 * * *')
    .timeZone('UTC')
    .onRun(async () => {
        const now = new Date();
        const cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const cutoffTs = admin.firestore.Timestamp.fromDate(cutoff);

        try {
            const inactiveSnap = await db.collection('conversations')
                .where('lastMessageTime', '<=', cutoffTs)
                .get();

            if (inactiveSnap.empty) {
                console.log('deleteInactivePrivateConversations: nothing to process.');
                return null;
            }

            console.log(`deleteInactivePrivateConversations: removing ${inactiveSnap.size} conversation(s).`);

            for (const convDoc of inactiveSnap.docs) {
                // Delete messages subcollection
                const msgsSnap = await db.collection('conversations').doc(convDoc.id).collection('messages').get();
                const batch = db.batch();
                msgsSnap.docs.forEach(d => batch.delete(d.ref));
                batch.delete(convDoc.ref);
                await batch.commit();
            }

            console.log(`deleteInactivePrivateConversations: deleted ${inactiveSnap.size} conversation(s).`);
        } catch (error) {
            console.error('deleteInactivePrivateConversations error:', error);
        }
        return null;
    });

// ─── Scheduled: Delete old community posts (30 days since creation) ───────────
// Community posts (communityPosts collection) older than 30 days are removed.
// Runs daily at 05:00 UTC.
exports.deleteOldCommunityPosts = functions.pubsub
    .schedule('0 5 * * *')
    .timeZone('UTC')
    .onRun(async () => {
        const bucket = admin.storage().bucket();
        const now = new Date();
        const cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const cutoffTs = admin.firestore.Timestamp.fromDate(cutoff);

        function extractStoragePath(url) {
            if (!url || typeof url !== 'string' || !url.includes('firebasestorage') || !url.includes('/o/')) return null;
            try { return decodeURIComponent(url.split('/o/')[1].split('?')[0]); } catch { return null; }
        }

        try {
            const oldPostsSnap = await db.collection('communityPosts')
                .where('createdAt', '<=', cutoffTs)
                .get();

            if (oldPostsSnap.empty) {
                console.log('deleteOldCommunityPosts: nothing to process.');
                return null;
            }

            console.log(`deleteOldCommunityPosts: removing ${oldPostsSnap.size} post(s).`);

            // Process in batches of 400 to stay under Firestore batch limit
            const chunks = [];
            for (let i = 0; i < oldPostsSnap.docs.length; i += 400) {
                chunks.push(oldPostsSnap.docs.slice(i, i + 400));
            }

            for (const chunk of chunks) {
                const batch = db.batch();
                for (const postDoc of chunk) {
                    const pd = postDoc.data() || {};
                    // Delete associated media files
                    const mediaUrls = [];
                    ['imageUrl', 'videoUrl', 'mediaUrl', 'image', 'video'].forEach(f => {
                        if (pd[f]) mediaUrls.push(pd[f]);
                    });
                    if (Array.isArray(pd.images)) pd.images.forEach(u => { if (u) mediaUrls.push(u); });

                    for (const url of mediaUrls) {
                        const path = extractStoragePath(url);
                        if (path) {
                            try { await bucket.file(path).delete(); }
                            catch (err) { if (err.code !== 404) console.warn('Storage delete failed:', path, err.message); }
                        }
                    }
                    batch.delete(postDoc.ref);
                }
                await batch.commit();
            }

            console.log(`deleteOldCommunityPosts: deleted ${oldPostsSnap.size} post(s).`);
        } catch (error) {
            console.error('deleteOldCommunityPosts error:', error);
        }
        return null;
    });

registerNotificationPushTrigger(exports);

/**
 * Scheduled function to delete media related to posts and chats permanently after 1 month.
 * Runs every 24 hours.
 */
exports.cleanupOldMedia = functions.pubsub.schedule('every 24 hours').onRun(async (context) => {
    const thirtyDaysAgoMillis = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const thirtyDaysAgo = admin.firestore.Timestamp.fromMillis(thirtyDaysAgoMillis);
    const bucket = admin.storage().bucket();

    // Helper to extract file path and delete from Storage
    const deleteStorageFileFromUrl = async (url) => {
        try {
            if (!url || !url.includes('firebasestorage.googleapis.com')) return;
            const encodedPath = url.split('/o/')[1].split('?')[0];
            const filePath = decodeURIComponent(encodedPath);
            await bucket.file(filePath).delete();
            functions.logger.info(`Deleted old media file: ${filePath}`);
        } catch (e) {
            if (e.code !== 404) {
                functions.logger.warn(`Error deleting media file ${url}:`, e);
            }
        }
    };

    let filesDeleted = 0;

    // 1. Delete old chat messages with media (Community Chats)
    try {
        const communitiesSnap = await db.collection('communities').get();
        for (const commDoc of communitiesSnap.docs) {
            const oldMessagesSnap = await commDoc.ref.collection('messages')
                .where('createdAt', '<', thirtyDaysAgo)
                .get();

            if (oldMessagesSnap.empty) continue;

            let msgBatch = db.batch();
            let batchCount = 0;

            for (const doc of oldMessagesSnap.docs) {
                const data = doc.data();
                if (['image', 'video', 'audio'].includes(data.type)) {
                    const fileUrl = data.text || data.audioUrl || data.imageUrl;
                    if (fileUrl && fileUrl.includes('firebasestorage')) {
                        await deleteStorageFileFromUrl(fileUrl);
                        filesDeleted++;
                    }
                    msgBatch.update(doc.ref, {
                        type: 'text',
                        text: '🚫 Media expired',
                        audioUrl: admin.firestore.FieldValue.delete(),
                        imageUrl: admin.firestore.FieldValue.delete()
                    });
                    batchCount++;
                }
                
                if (batchCount === 450) {
                    await msgBatch.commit();
                    msgBatch = db.batch();
                    batchCount = 0;
                }
            }
            if (batchCount > 0) {
                await msgBatch.commit();
            }
        }
        
        // Also clean up Invitation Chats
        const invitationsSnap = await db.collection('invitations').get();
        for (const invDoc of invitationsSnap.docs) {
            const oldMessagesSnap = await invDoc.ref.collection('messages')
                .where('createdAt', '<', thirtyDaysAgo)
                .get();

            if (oldMessagesSnap.empty) continue;

            let msgBatch = db.batch();
            let batchCount = 0;

            for (const doc of oldMessagesSnap.docs) {
                const data = doc.data();
                if (['image', 'video', 'audio'].includes(data.type)) {
                    const fileUrl = data.text || data.audioUrl || data.imageUrl;
                    if (fileUrl && fileUrl.includes('firebasestorage')) {
                        await deleteStorageFileFromUrl(fileUrl);
                        filesDeleted++;
                    }
                    msgBatch.update(doc.ref, {
                        type: 'text',
                        text: '🚫 Media expired',
                        audioUrl: admin.firestore.FieldValue.delete(),
                        imageUrl: admin.firestore.FieldValue.delete()
                    });
                    batchCount++;
                }
                
                if (batchCount === 450) {
                    await msgBatch.commit();
                    msgBatch = db.batch();
                    batchCount = 0;
                }
            }
            if (batchCount > 0) {
                await msgBatch.commit();
            }
        }

        // Also clean up Direct Conversations Chats
        const conversationsSnap = await db.collection('conversations').get();
        for (const convDoc of conversationsSnap.docs) {
            const oldMessagesSnap = await convDoc.ref.collection('messages')
                .where('createdAt', '<', thirtyDaysAgo)
                .get();

            if (oldMessagesSnap.empty) continue;

            let msgBatch = db.batch();
            let batchCount = 0;

            for (const doc of oldMessagesSnap.docs) {
                const data = doc.data();
                if (['image', 'video', 'audio'].includes(data.type)) {
                    const fileUrl = data.text || data.audioUrl || data.imageUrl;
                    if (fileUrl && fileUrl.includes('firebasestorage')) {
                        await deleteStorageFileFromUrl(fileUrl);
                        filesDeleted++;
                    }
                    msgBatch.update(doc.ref, {
                        type: 'text',
                        text: '🚫 Media expired',
                        audioUrl: admin.firestore.FieldValue.delete(),
                        imageUrl: admin.firestore.FieldValue.delete()
                    });
                    batchCount++;
                }
                
                if (batchCount === 450) {
                    await msgBatch.commit();
                    msgBatch = db.batch();
                    batchCount = 0;
                }
            }
            if (batchCount > 0) {
                await msgBatch.commit();
            }
        }
    } catch (e) {
        functions.logger.error("Error cleaning up old chat messages:", e);
    }

    // 2. Delete old community posts with media
    try {
        let postBatch = db.batch();
        let batchCount = 0;
        const oldPostsSnap = await db.collection('communityPosts')
            .where('createdAt', '<', thirtyDaysAgo)
            .get();

        for (const doc of oldPostsSnap.docs) {
            const data = doc.data();
            let updated = false;

            if (data.mediaUrl && data.mediaUrl.includes('firebasestorage')) {
                await deleteStorageFileFromUrl(data.mediaUrl);
                postBatch.update(doc.ref, { mediaUrl: admin.firestore.FieldValue.delete() });
                updated = true;
                filesDeleted++;
            }
            if (data.image && data.image.includes('firebasestorage')) {
                await deleteStorageFileFromUrl(data.image);
                postBatch.update(doc.ref, { image: admin.firestore.FieldValue.delete() });
                updated = true;
                filesDeleted++;
            }
            
            if (updated) {
                batchCount++;
            }

            if (batchCount === 450) {
                await postBatch.commit();
                postBatch = db.batch();
                batchCount = 0;
            }
        }
        if (batchCount > 0) {
            await postBatch.commit();
        }
    } catch (e) {
        functions.logger.error("Error cleaning up old community posts:", e);
    }

    functions.logger.info(`cleanupOldMedia finished. Deleted ${filesDeleted} media files.`);
    return null;
});

// ─── Scheduled: Delete Expired Stories (Runs every hour) ─────────────────────
exports.deleteExpiredStories = functions.pubsub.schedule('every 1 hours').onRun(async (context) => {
    const bucket = admin.storage().bucket();
    const now = admin.firestore.Timestamp.now();

    function extractStoragePath(url) {
        if (!url || typeof url !== 'string' || !url.includes('firebasestorage') || !url.includes('/o/')) return null;
        try { return decodeURIComponent(url.split('/o/')[1].split('?')[0]); } catch { return null; }
    }

    try {
        const expiredStoriesSnap = await db.collection('stories')
            .where('expiresAt', '<=', now)
            .get();

        if (expiredStoriesSnap.empty) {
            console.log('deleteExpiredStories: nothing to process.');
            return null;
        }

        console.log(`deleteExpiredStories: removing ${expiredStoriesSnap.size} expired story/stories.`);

        const chunks = [];
        for (let i = 0; i < expiredStoriesSnap.docs.length; i += 400) {
            chunks.push(expiredStoriesSnap.docs.slice(i, i + 400));
        }

        for (const chunk of chunks) {
            const batch = db.batch();
            for (const doc of chunk) {
                const data = doc.data();
                for (const mediaUrl of [data.url, data.posterUrl]) {
                    if (mediaUrl && mediaUrl.includes('firebasestorage')) {
                        const path = extractStoragePath(mediaUrl);
                        if (path) {
                            try { await bucket.file(path).delete(); }
                            catch (err) { if (err.code !== 404) console.warn('Storage delete failed:', path, err.message); }
                        }
                    }
                }
                // Firestore does not cascade-delete subcollections — reactions must be
                // removed explicitly or they'd be orphaned forever once the parent is gone.
                const reactionsSnap = await doc.ref.collection('reactions').get();
                for (let i = 0; i < reactionsSnap.docs.length; i += 400) {
                    const reactionsBatch = db.batch();
                    for (const reactionDoc of reactionsSnap.docs.slice(i, i + 400)) {
                        reactionsBatch.delete(reactionDoc.ref);
                    }
                    await reactionsBatch.commit();
                }
                batch.delete(doc.ref);
            }
            await batch.commit();
        }

        console.log(`deleteExpiredStories: deleted ${expiredStoriesSnap.size} story/stories.`);
    } catch (e) {
        console.error('deleteExpiredStories error:', e);
    }
        return null;
    });

const { registerPartnerNotificationInbox } = require('./partnerNotificationInbox');
registerPartnerNotificationInbox(exports, { db, admin, sendPushToUser });

const { registerFeedbackTickets } = require('./feedbackTickets');
registerFeedbackTickets(exports, { db, admin, enforceCallableRateLimit });

const { registerCompatJourney } = require('./compatJourney');
registerCompatJourney(exports, { db, admin, enforceCallableRateLimit });

const { registerReportTriage } = require('./reportTriage');
registerReportTriage(exports, { db, admin });
const { registerSupportAgent } = require('./supportAgent');
registerSupportAgent(exports, { db, admin, enforceCallableRateLimit });
const { registerGroupGames } = require('./groupGames');
registerGroupGames(exports, { db, admin, enforceCallableRateLimit });
const { registerFoodTrivia } = require('./foodTrivia');
registerFoodTrivia(exports, { db, admin, enforceCallableRateLimit });

const { registerPushDevice } = require('./pushDevice');
registerPushDevice(exports, { db, admin, sendPushToUser });

// ─── Admin: email campaigns (Resend) — see functions/adminEmailCampaign.js ─
const { registerAdminEmailCampaign } = require('./adminEmailCampaign');
registerAdminEmailCampaign({ exports, functions, db, assertAdminContext, admin });

// ─── Auth: verification email via Resend (HTML template) ───────────────────
const { registerSendVerificationEmailResend } = require('./sendVerificationEmailResend');
registerSendVerificationEmailResend({ exports, functions, db, admin });

const { registerSendPasswordResetEmailResend } = require('./sendPasswordResetEmailResend');
registerSendPasswordResetEmailResend({ exports, functions, db, admin });

// ─── Image moderation (Vision Safe Search) ───────────────────────────────────
const { registerImageModeration } = require('./imageModeration');
registerImageModeration({ exports, functions, db, admin, enforceCallableRateLimit });

// ─── Stories: remux uploaded MP4/MOV to fast-start so video reliably plays on iOS ────
const { registerStoryVideoFaststart } = require('./storyVideoFaststart');
registerStoryVideoFaststart({ exports, functions, admin });
