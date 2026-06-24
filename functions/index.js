// Load functions/.env before any module reads process.env (e.g. Stripe).
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const path = require('path');

const admin = require('firebase-admin');
admin.initializeApp();

const { inferInviteCategory } = require('./inviteCategory');
const { registerAdminBrowseUsers } = require('./adminBrowseUsers');
const { registerAdminSearchUsers } = require('./adminSearchUsers');
const { registerAdminDashboard } = require('./adminDashboard');
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
const { sendPushToUser, registerNotificationPushTrigger } = createPushMessaging({ db, admin });
/** @param {Record<string, unknown>} inv */
function isPrivateInvitationDocForBilling(inv) {
    if (!inv || typeof inv !== 'object') return false;
    const occasionLc = String(inv.occasionType || inv.type || '')
        .trim()
        .toLowerCase();
    return (
        inv.type === 'Private' ||
        occasionLc === 'private' ||
        (inv.privateInvitationPreference != null && inv.privateInvitationPreference !== false)
    );
}

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
    'system_announcement',
    'follow',
    'invitation_accepted',
    'invitation_rejected',
    'message',
    'reminder',
    'like',
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
        return typeof partnerId === 'string' && partnerId === senderId;
    }

    if (type === 'follow') {
        const senderSnap = await db.collection('users').doc(senderId).get();
        if (!senderSnap.exists) return false;
        const following = senderSnap.data()?.following || [];
        return Array.isArray(following) && following.includes(userId);
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
registerAdminMassMessaging(exports, { db, admin, assertAdminContext });
registerDirectorySearch(exports, { db, admin });
registerConsumerAccountSearch(exports, { db });
const { registerBusinessPostNotify } = require('./businessPostNotify');
registerBusinessPostNotify(exports, { db, admin, enforceCallableRateLimit });
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

function resolvePublicAccountRole(userData, uid) {
    if (isConsumerHiddenUserDoc(userData, uid)) {
        return 'admin';
    }
    return asTrimmedString(userData.role)?.toLowerCase() || 'user';
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
    // Public directory listing requires BOTH: verified auth email (mirrored on users.emailVerified)
    // AND explicit opt-in businessInfo.isPublished (manual hide/vacation).
    const authEmailVerified = userData.emailVerified === true;
    const userOptedIntoDirectory = businessInfo.isPublished === true;
    const businessPublic = profileType === 'business'
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
            // Expose visual identity so directory cards & maps can match business profile
            brandKit: businessInfo.brandKit || null,
            theme: asTrimmedString(businessInfo.theme)
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
            const ref = db.collection('notifications').doc();
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

        if (invPre.publishedAt) {
            // Idempotent path: return existing token — no rate limit, no Dine Credits charge.
            let existingToken = invPre.shareToken || null;
            if (!existingToken) {
                existingToken = generatePrivateInvitationShareToken();
                await invitationRef.update({
                    shareToken: existingToken,
                    externalInviteEnabled: true,
                });
            }
            return { success: true, alreadyPublished: true, chargedSource: null, shareToken: existingToken };
        }

        await enforceCallableRateLimit(uid, 'publish_social_invitation', {
            perMinute: 8,
            perHour: 100,
            perDay: 300,
            cooldownMs: 1500, // P0: faster re-share without 429 (was 3000)
        });

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

            if (inv.publishedAt) {
                return { alreadyPublished: true, chargedSource: null };
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

            if (!isBypassUser) {
                const cost = isPrivateInvitationDocForBilling(inv)
                    ? CREDIT_COSTS.PRIVATE_INVITATION
                    : CREDIT_COSTS.PRIVATE_INVITATION;
                const accountRole = isBusinessUserDoc(user) ? 'business' : 'user';
                try {
                    spendCreditsInTransaction(tx, userRef, user, {
                        uid,
                        accountRole,
                        amount: cost,
                        type: 'social_invitation_publish',
                        reason: isPrivateInvitationDocForBilling(inv)
                            ? 'private_invitation_publish'
                            : 'social_invitation_publish',
                        relatedId: invitationId,
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
        if (!result.alreadyPublished && filteredFriends.length > 0) {
            try {
                notificationsSent = await sendPrivateInvitationInviteeNotifications({
                    uid,
                    invitationId,
                    inviteeIds: filteredFriends,
                    invPre,
                    userRef
                });
                functions.logger.info('publishPrivateInvitationDraft notifications', {
                    invitationId,
                    notificationsSent
                });
            } catch (notifyErr) {
                functions.logger.error('publishPrivateInvitationDraft: invitee notifications failed', invitationId, notifyErr);
            }
        }

        return {
            success: true,
            ...result,
            notificationsSent,
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

        const geofenceBlock = assertPublicInvitationGeofenceRule({
            creatorCoords: { lat: creatorLat, lng: creatorLng },
            venueCoords: { lat: venueLat, lng: venueLng },
            creatorCountryCode: user.countryCode,
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

async function hasMutualDiscoveryMatch(uid, otherUserId) {
    const [likeSnapA, likeSnapB] = await Promise.all([
        db.collection('discovery_likes').doc(`${otherUserId}_${uid}`).get(),
        db.collection('discovery_likes').doc(`${uid}_${otherUserId}`).get(),
    ]);
    if (!likeSnapA.exists || !likeSnapB.exists) return false;
    return likeSnapA.data()?.mutual === true && likeSnapB.data()?.mutual === true;
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

    await enforceCallableRateLimit(uid, 'create_or_get_conversation', {
        perMinute: 20,
        perHour: 200,
        perDay: 600,
        cooldownMs: 500
    });

    // Deterministic conversation ID: sorted UIDs joined by "_".
    // Guarantees a single document per pair without a query scan.
    const conversationId = [uid, otherUserId].sort().join('_');
    const convRef = db.collection('conversations').doc(conversationId);
    const existingSnap = await convRef.get();

    if (existingSnap.exists) {
        return { success: true, conversationId, created: false };
    }

    const [reqSnap, othSnap] = await Promise.all([
        db.collection('users').doc(uid).get(),
        db.collection('users').doc(otherUserId).get()
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
    if (!isSystemPeer) {
        let hasMutualConnection = areMutuallyFollowing(reqData, othData, uid, otherUserId);
        if (!hasMutualConnection) {
            hasMutualConnection = await hasMutualDiscoveryMatch(uid, otherUserId);
        }
        if (!hasMutualConnection) {
            throw new functions.https.HttpsError(
                'failed-precondition',
                'Mutual connection required to start a conversation.'
            );
        }
    }

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

    const membership = await db.runTransaction(async (tx) => {
        const [userSnap, userPartnerSnap] = await Promise.all([
            tx.get(userRef),
            tx.get(userPartnerRef),
        ]);

        let partnerRef = userPartnerRef;
        let partnerSnap = userPartnerSnap;
        if (!partnerSnap.exists) {
            partnerRef = restaurantPartnerRef;
            partnerSnap = await tx.get(partnerRef);
        }

        if (!userSnap.exists && action !== 'unblockMember') {
            throw new functions.https.HttpsError('not-found', 'User profile not found.');
        }
        if (!partnerSnap.exists) {
            throw new functions.https.HttpsError('not-found', 'Community owner not found.');
        }

        const owner = {
            source: partnerRef.path.includes('/restaurants/') ? 'restaurants' : 'users',
            data: partnerSnap.data() || {},
        };
        if (!isCommunityOwnerBusiness(owner)) {
            throw new functions.https.HttpsError('failed-precondition', 'Target user is not a community owner.');
        }

        const partner = partnerSnap.data() || {};
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
        tx.update(partnerRef, partnerUpdates);

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
    const userRef = db.collection('users').doc(targetUid);
    const userSnap = await userRef.get();
    if (!userSnap.exists) return { deletedItems: 0 };

    let deletedItems = 0;
    const relatedCollections = ['communityPosts', 'stories', 'invitations', 'social_invitations', 'notifications', 'partner_notifications'];

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

    let storageObjectsDeleted = 0;
    try {
        const bucket = admin.storage().bucket();
        const prefixes = [
            `users/${targetUid}/`,
            `chat_images/${targetUid}/`,
            `chat_files/${targetUid}/`,
            `voice_messages/${targetUid}/`,
        ];
        for (const prefix of prefixes) {
            try {
                await bucket.deleteFiles({ prefix, force: true });
                storageObjectsDeleted += 1;
            } catch (e) {
                functions.logger.warn('adminDeleteUserCascade storage prefix', prefix, e.message);
            }
        }
    } catch (e) {
        functions.logger.warn('adminDeleteUserCascade storage', e.message);
    }

    try {
        await admin.auth().deleteUser(targetUid);
    } catch (e) {
        // Firestore deletion is primary; auth user may already be removed.
    }

    return { deletedItems, storageObjectsDeleted };
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

// ─── Scheduled: Archive + delete expired invitation chats (1 day post-endDate) ───
// Runs daily at 03:00 UTC. Invitations whose endDate/date is > 1 day ago
// get archived (stats only) then their Firestore doc + Storage files are removed.
exports.archiveAndDeleteExpiredInvitationChats = functions.pubsub
    .schedule('0 3 * * *')
    .timeZone('UTC')
    .onRun(async () => {
        console.log('archiveAndDeleteExpiredInvitationChats: disabled — use invitationArchiveCore schedulers.');
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
                if (data.url && data.url.includes('firebasestorage')) {
                    const path = extractStoragePath(data.url);
                    if (path) {
                        try { await bucket.file(path).delete(); }
                        catch (err) { if (err.code !== 404) console.warn('Storage delete failed:', path, err.message); }
                    }
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
