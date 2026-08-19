/**
 * Stage rooms for people and business hosts.
 * No credits / day pricing. Fixed 24h TTL then hard-delete Firestore + Storage
 * media + invite notifications. Business-hosted Stages require a Paid Business
 * plan; personal Stages stay free for everyone.
 * Permanent business Community Chat is separate; business Stages are ephemeral.
 */
const functions = require('firebase-functions');
const { isBusinessUserDoc, normalizeBusinessSubscriptionTier } = require('./creditsCore');

const MAX_INVITEES = 40;
const TITLE_MAX = 80;
/** Hard cap — Stages are free and always expire after 24 hours. */
const STAGE_TTL_MS = 24 * 60 * 60 * 1000;

function asTrimmedString(v) {
    return typeof v === 'string' ? v.trim() : '';
}

function isMutualFollow(hostFollowing, inviteeFollowing, hostId, inviteeId) {
    const a = Array.isArray(hostFollowing) ? hostFollowing : [];
    const b = Array.isArray(inviteeFollowing) ? inviteeFollowing : [];
    return a.includes(inviteeId) && b.includes(hostId);
}

function toMillis(value) {
    if (!value) return null;
    if (typeof value.toMillis === 'function') return value.toMillis();
    if (typeof value.toDate === 'function') return value.toDate().getTime();
    if (value instanceof Date) return value.getTime();
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}

function resolveExpiresMs(stage) {
    const exp = toMillis(stage.expiresAt);
    if (exp) return exp;
    const created = toMillis(stage.createdAt);
    if (created) return created + STAGE_TTL_MS;
    return null;
}

function isExpired(stage, nowMs = Date.now()) {
    const status = String(stage.status || 'active');
    if (status === 'ended' || status === 'expired') return true;
    const exp = resolveExpiresMs(stage);
    return Boolean(exp && exp <= nowMs);
}

/** Host-level Stage bans — blocked guests cannot join any future Stage of this host. */
function hostStageBlockedIds(hostDoc) {
    const list = Array.isArray(hostDoc?.stageBlockedUserIds) ? hostDoc.stageBlockedUserIds : [];
    return list.map(String).filter(Boolean);
}

function resolveMuteUntilTimestamp(admin, duration, stage) {
    const nowMs = Date.now();
    const key = String(duration || '').toLowerCase();
    if (key === '5m' || key === '5min' || key === 'five_minutes') {
        return admin.firestore.Timestamp.fromMillis(nowMs + 5 * 60 * 1000);
    }
    if (key === '1h' || key === '1hr' || key === 'one_hour') {
        return admin.firestore.Timestamp.fromMillis(nowMs + 60 * 60 * 1000);
    }
    if (key === 'session' || key === 'broadcast' || key === 'stage') {
        // Entire broadcast — mute lasts until this Stage expires (does not carry to future Stages).
        const exp = resolveExpiresMs(stage) || nowMs + STAGE_TTL_MS;
        return admin.firestore.Timestamp.fromMillis(exp);
    }
    return null;
}

async function ejectStageMember(db, admin, stageId, targetUid) {
    const stageRef = db.collection('stages').doc(stageId);
    await stageRef.update({
        memberIds: admin.firestore.FieldValue.arrayRemove(targetUid),
        communityMembers: admin.firestore.FieldValue.arrayRemove(targetUid),
        invitedIds: admin.firestore.FieldValue.arrayRemove(targetUid),
        communityMutedUserIds: admin.firestore.FieldValue.arrayRemove(targetUid),
        [`communityMutedUntil.${targetUid}`]: admin.firestore.FieldValue.delete(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    await db.collection('users').doc(targetUid).set(
        {
            joinedStages: admin.firestore.FieldValue.arrayRemove(stageId),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
    );
}

function haversineKm(lat1, lon1, lat2, lon2) {
    const toRad = (d) => (d * Math.PI) / 180;
    const R = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function parseCoordPair(userOrStage) {
    if (!userOrStage || typeof userOrStage !== 'object') return null;
    const lat =
        Number(userOrStage.hostLat ?? userOrStage.lat ?? userOrStage.latitude ?? userOrStage.coordinates?.lat) ||
        null;
    const lng =
        Number(userOrStage.hostLng ?? userOrStage.lng ?? userOrStage.longitude ?? userOrStage.coordinates?.lng) ||
        null;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
    return { lat, lng };
}

function hostDisplayName(host) {
    return (
        asTrimmedString(
            host?.display_name ||
                host?.displayName ||
                host?.business_name ||
                host?.businessName ||
                host?.name
        ) || 'Host'
    );
}

function hostAvatarUrl(host) {
    if (!host || typeof host !== 'object') return null;
    const candidates = [
        host.avatarUrl,
        host.avatar,
        host.avatar_url,
        host.photo_url,
        host.photoURL,
        host.userPhoto,
        host.profilePicture,
        host.logo,
        host.logoImage,
        host.businessLogoUrl,
        host.businessInfo?.logo,
        host.businessInfo?.logoImage,
        host.partnerLogo,
    ];
    for (const raw of candidates) {
        const u = asTrimmedString(raw);
        if (!u) continue;
        if (u.startsWith('http') || u.startsWith('data:image')) return u;
    }
    return null;
}

/** Prefer a fresh host profile photo; fall back to the snapshot stored on the stage. */
function resolveStageHostAvatar(stage, host) {
    return hostAvatarUrl(host) || asTrimmedString(stage?.hostAvatar) || null;
}

/** 'people' | 'business' — stored on stage; fall back to host profile. */
function resolveHostKind(stage, host) {
    const raw = asTrimmedString(stage?.hostKind || stage?.kind).toLowerCase();
    if (raw === 'business' || raw === 'business_stage') return 'business';
    if (raw === 'people' || raw === 'stage') return 'people';
    return isBusinessUserDoc(host) ? 'business' : 'people';
}

/** Business Stages are always community-members only (no public/private choice). */
function resolveVisibility(stage, hostKind) {
    if (hostKind === 'business') return 'community';
    return String(stage?.visibility || 'private').toLowerCase() === 'public'
        ? 'public'
        : 'private';
}

async function deleteQueryInBatches(db, queryRef, batchSize = 200) {
    while (true) {
        const snap = await queryRef.limit(batchSize).get();
        if (snap.empty) break;
        const batch = db.batch();
        snap.docs.forEach((d) => batch.delete(d.ref));
        await batch.commit();
        if (snap.size < batchSize) break;
    }
}

function collectStorageUrls(value, out = new Set()) {
    if (!value) return out;
    if (typeof value === 'string') {
        if (
            value.includes('firebasestorage.googleapis.com') ||
            value.startsWith('gs://') ||
            value.includes('storage.googleapis.com')
        ) {
            out.add(value);
        }
        return out;
    }
    if (Array.isArray(value)) {
        value.forEach((v) => collectStorageUrls(v, out));
        return out;
    }
    if (typeof value === 'object') {
        Object.values(value).forEach((v) => collectStorageUrls(v, out));
    }
    return out;
}

async function tryDeleteStorageUrl(admin, url) {
    if (typeof url !== 'string') return;
    try {
        let path = null;
        if (url.startsWith('gs://')) {
            path = url.replace(/^gs:\/\/[^/]+\//, '');
        } else {
            const match = url.match(/\/o\/([^?]+)/) || url.match(/storage\.googleapis\.com\/[^/]+\/(.+)$/);
            if (match) path = decodeURIComponent(match[1]);
        }
        if (!path) return;
        await admin.storage().bucket().file(path).delete({ ignoreNotFound: true });
    } catch (err) {
        functions.logger.warn('stage media delete skipped', { url, message: err.message });
    }
}

async function deleteStoragePrefix(admin, prefix) {
    if (!prefix) return;
    try {
        const bucket = admin.storage().bucket();
        const [files] = await bucket.getFiles({ prefix });
        await Promise.all(
            files.map((file) =>
                file.delete({ ignoreNotFound: true }).catch((err) => {
                    functions.logger.warn('stage prefix delete skipped', {
                        path: file.name,
                        message: err.message,
                    });
                })
            )
        );
    } catch (err) {
        functions.logger.warn('stage prefix list failed', { prefix, message: err.message });
    }
}

async function purgeStageRoom(db, admin, stageId, stageData) {
    const messagesRef = db.collection('stages').doc(stageId).collection('messages');
    const messagesSnap = await messagesRef.get();
    const mediaUrls = collectStorageUrls(stageData);
    for (const msg of messagesSnap.docs) {
        collectStorageUrls(msg.data() || {}, mediaUrls);
    }
    for (const url of mediaUrls) {
        await tryDeleteStorageUrl(admin, url);
    }
    // Any files written under stage-scoped prefixes
    await deleteStoragePrefix(admin, `stages/${stageId}/`);
    await deleteStoragePrefix(admin, `stage_media/${stageId}/`);

    await deleteQueryInBatches(db, messagesRef);
    // Invite / stage notifications
    await deleteQueryInBatches(
        db,
        db.collection('notifications').where('stageId', '==', stageId)
    );

    const memberIds = Array.isArray(stageData.memberIds)
        ? stageData.memberIds
        : Array.isArray(stageData.communityMembers)
          ? stageData.communityMembers
          : [];
    const hostId = stageData.hostId || stageData.ownerId;
    const allUids = [...new Set([hostId, ...memberIds].filter(Boolean))];

    const batch = db.batch();
    for (const uid of allUids) {
        batch.set(
            db.collection('users').doc(uid),
            {
                joinedStages: admin.firestore.FieldValue.arrayRemove(stageId),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
        );
    }
    batch.delete(db.collection('stages').doc(stageId));
    await batch.commit();
}

/**
 * @param {object} exportsObj
 * @param {{
 *   db: FirebaseFirestore.Firestore,
 *   admin: typeof import('firebase-admin'),
 *   enforceCallableRateLimit: Function,
 * }} deps
 */
function registerStageRooms(exportsObj, { db, admin, enforceCallableRateLimit }) {
    exportsObj.createStageRoom = functions
        .runWith({ timeoutSeconds: 60, memory: '256MB' })
        .https.onCall(async (data, context) => {
            if (!context.auth) {
                throw new functions.https.HttpsError('unauthenticated', 'Authentication required.');
            }

            const hostId = context.auth.uid;
            await enforceCallableRateLimit(hostId, 'create_stage_room', {
                perMinute: 6,
                perHour: 40,
                perDay: 120,
                cooldownMs: 2000,
            });

            const hostSnap = await db.collection('users').doc(hostId).get();
            if (!hostSnap.exists) {
                throw new functions.https.HttpsError('not-found', 'User not found.');
            }
            const host = hostSnap.data() || {};
            const hostIsBusiness = isBusinessUserDoc(host);
            const hostKind = hostIsBusiness ? 'business' : 'people';

            if (hostIsBusiness && normalizeBusinessSubscriptionTier(host.subscriptionTier) !== 'paid') {
                throw new functions.https.HttpsError(
                    'failed-precondition',
                    'Business Stage requires a Paid Business plan.'
                );
            }

            // One live Stage per host until it expires (or is purged).
            const hostedSnap = await db
                .collection('stages')
                .where('hostId', '==', hostId)
                .limit(20)
                .get();
            const nowMs = Date.now();
            for (const docSnap of hostedSnap.docs) {
                const existing = docSnap.data() || {};
                if (!isExpired(existing, nowMs)) {
                    throw new functions.https.HttpsError(
                        'failed-precondition',
                        'You already have an open Stage. Reopen it or wait until it expires.',
                        { existingStageId: docSnap.id }
                    );
                }
            }

            const title =
                asTrimmedString(data?.title).slice(0, TITLE_MAX) ||
                hostDisplayName(host) ||
                'Stage';

            const visibilityRaw = asTrimmedString(data?.visibility).toLowerCase();
            // Business Stages are always for community members (no public/private toggle).
            const visibility = hostIsBusiness
                ? 'community'
                : visibilityRaw === 'public'
                  ? 'public'
                  : 'private';

            const rawInvitees = Array.isArray(data?.inviteeIds) ? data.inviteeIds : [];
            const inviteeCandidates = [
                ...new Set(
                    rawInvitees
                        .map((id) => asTrimmedString(id))
                        .filter((id) => id && id !== hostId)
                ),
            ].slice(0, MAX_INVITEES);

            // Invitees are optional — Stage can open with host only.
            // Business Stages skip invitee picks at create (community-gated join).
            const hostFollowing = Array.isArray(host.following) ? host.following : [];
            const hostStageBlocked = new Set(hostStageBlockedIds(host));
            const validInvitees = [];
            if (!hostIsBusiness) {
                for (const inviteeId of inviteeCandidates) {
                    if (hostStageBlocked.has(inviteeId)) continue;
                    const snap = await db.collection('users').doc(inviteeId).get();
                    if (!snap.exists) continue;
                    const u = snap.data() || {};
                    if (isBusinessUserDoc(u)) continue;
                    const role = String(u.role || '').toLowerCase();
                    if (role === 'guest' || u.isGuest === true) continue;
                    const blocked = Array.isArray(u.blockedUserIds) ? u.blockedUserIds : [];
                    if (blocked.includes(hostId)) continue;
                    const theirFollowing = Array.isArray(u.following) ? u.following : [];
                    if (!isMutualFollow(hostFollowing, theirFollowing, hostId, inviteeId)) {
                        continue;
                    }
                    validInvitees.push(inviteeId);
                }
            }

            const memberIds = [hostId, ...validInvitees];
            const stageRef = db.collection('stages').doc();
            const stageId = stageRef.id;
            const hostName = hostDisplayName(host);
            const hostAvatar = hostAvatarUrl(host);
            const hostCoords = parseCoordPair(host);
            // Free room — no credits charged; duration is always exactly 24h (not extendable by reopen).
            const expiresAt = admin.firestore.Timestamp.fromMillis(Date.now() + STAGE_TTL_MS);

            await stageRef.set({
                kind: hostIsBusiness ? 'business_stage' : 'stage',
                hostKind,
                hostId,
                title,
                status: 'active',
                /** people: public|private; business: always community (members of the business community). */
                visibility,
                memberIds,
                invitedIds: validInvitees,
                communityMembers: memberIds,
                communityMutedUserIds: [],
                communityMutedUntil: {},
                communityBlockedUserIds: [],
                communityChatZoneTheme: 'stage',
                communityChatBannerVisible: true,
                ownerId: hostId,
                hostName,
                hostAvatar,
                ...(hostCoords
                    ? { hostLat: hostCoords.lat, hostLng: hostCoords.lng }
                    : {}),
                isFree: true,
                durationHours: 24,
                expiresAt,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });

            const batch = db.batch();
            for (const uid of memberIds) {
                batch.set(
                    db.collection('users').doc(uid),
                    {
                        joinedStages: admin.firestore.FieldValue.arrayUnion(stageId),
                        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                    },
                    { merge: true }
                );
            }
            await batch.commit();

            const notifBatch = db.batch();
            const previewTitle = title.slice(0, 120);
            const message = (
                hostIsBusiness
                    ? `${hostName} invited you to a business Stage: ${previewTitle}`
                    : `${hostName} invited you to a Stage: ${previewTitle}`
            ).slice(0, 500);
            for (const inviteeId of validInvitees) {
                const notifRef = db.collection('notifications').doc();
                notifBatch.set(notifRef, {
                    userId: inviteeId,
                    type: 'stage_invite',
                    title: hostIsBusiness ? 'Business Stage invitation' : 'Stage invitation',
                    message,
                    actionUrl: `/stage/${stageId}`,
                    stageId,
                    fromUserId: hostId,
                    fromUserName: hostName,
                    fromUserAvatar: hostAvatar,
                    senderId: hostId,
                    senderName: hostName,
                    senderAvatar: hostAvatar,
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    read: false,
                    metadata: {
                        stageId,
                        source: 'create_stage_room',
                        hostKind,
                    },
                });
            }
            await notifBatch.commit();

            functions.logger.info('createStageRoom', {
                stageId,
                hostId,
                hostKind,
                visibility,
                invitees: validInvitees.length,
            });

            return {
                success: true,
                stageId,
                hostKind,
                visibility,
                memberCount: memberIds.length,
                invitedCount: validInvitees.length,
                expiresAt: expiresAt.toDate().toISOString(),
            };
        });

    /** Host's current non-expired Stage (create/enter gate). */
    exportsObj.getMyLiveStage = functions.https.onCall(async (_data, context) => {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'Authentication required.');
        }
        const hostId = context.auth.uid;
        await enforceCallableRateLimit(hostId, 'get_my_live_stage', {
            perMinute: 40,
            perHour: 400,
            cooldownMs: 200,
        });

        const hostedSnap = await db
            .collection('stages')
            .where('hostId', '==', hostId)
            .limit(20)
            .get();
        const nowMs = Date.now();
        for (const docSnap of hostedSnap.docs) {
            const stage = docSnap.data() || {};
            if (isExpired(stage, nowMs)) continue;
            return {
                stageId: docSnap.id,
                title: asTrimmedString(stage.title) || null,
                status: String(stage.status || 'active'),
                hostKind: resolveHostKind(stage, null),
                visibility: resolveVisibility(stage, resolveHostKind(stage, null)),
                expiresAt: resolveExpiresMs(stage)
                    ? new Date(resolveExpiresMs(stage)).toISOString()
                    : null,
                memberCount: Array.isArray(stage.memberIds) ? stage.memberIds.length : 0,
            };
        }
        return { stageId: null };
    });

    /**
     * Discover live/open Stages for the mic hub:
     * filter=all|friends, optional search + viewer lat/lng for nearest-first sort.
     */
    exportsObj.listLiveStages = functions
        .runWith({ timeoutSeconds: 60, memory: '256MB' })
        .https.onCall(async (data, context) => {
            if (!context.auth) {
                throw new functions.https.HttpsError('unauthenticated', 'Authentication required.');
            }

            const uid = context.auth.uid;
            await enforceCallableRateLimit(uid, 'list_live_stages', {
                perMinute: 30,
                perHour: 300,
                cooldownMs: 250,
            });

            const filterRaw = asTrimmedString(data?.filter).toLowerCase();
            const filter = filterRaw === 'friends' ? 'friends' : 'all';
            const search = asTrimmedString(data?.search).toLowerCase().slice(0, 80);
            const viewerLat = Number(data?.lat);
            const viewerLng = Number(data?.lng);
            const hasViewerGeo =
                Number.isFinite(viewerLat) &&
                Number.isFinite(viewerLng) &&
                Math.abs(viewerLat) <= 90 &&
                Math.abs(viewerLng) <= 180;

            const viewerSnap = await db.collection('users').doc(uid).get();
            if (!viewerSnap.exists) {
                throw new functions.https.HttpsError('not-found', 'User not found.');
            }
            const viewer = viewerSnap.data() || {};
            const viewerFollowing = Array.isArray(viewer.following) ? viewer.following : [];
            const viewerFollowingSet = new Set(viewerFollowing.map(String));
            const viewerJoinedCommunities = new Set(
                (Array.isArray(viewer.joinedCommunities) ? viewer.joinedCommunities : [])
                    .map((id) => String(id))
                    .filter(Boolean)
            );
            const joinedStageIds = [
                ...new Set(
                    (Array.isArray(viewer.joinedStages) ? viewer.joinedStages : [])
                        .map((id) => asTrimmedString(id))
                        .filter(Boolean)
                ),
            ].slice(0, 40);

            const now = admin.firestore.Timestamp.now();
            const nowMs = now.toMillis();
            const byId = new Map();

            const mergeSnap = (snap) => {
                if (!snap || !snap.docs) return;
                snap.docs.forEach((d) => byId.set(d.id, d));
            };

            // Multiple scans — expiresAt-only misses legacy rooms; status-only misses soft-closed live rooms.
            const queries = [
                db.collection('stages').where('status', '==', 'active').limit(100).get(),
                db.collection('stages').where('expiresAt', '>', now).limit(100).get(),
                db.collection('stages').where('visibility', '==', 'public').limit(100).get(),
                db.collection('stages').where('hostId', '==', uid).limit(20).get(),
            ];
            const settled = await Promise.allSettled(queries);
            settled.forEach((r, idx) => {
                if (r.status === 'fulfilled') mergeSnap(r.value);
                else {
                    functions.logger.warn('listLiveStages query failed', {
                        idx,
                        message: r.reason?.message,
                    });
                }
            });

            if (joinedStageIds.length > 0) {
                for (let i = 0; i < joinedStageIds.length; i += 30) {
                    const chunk = joinedStageIds.slice(i, i + 30);
                    const refs = chunk.map((id) => db.collection('stages').doc(id));
                    const docs = await db.getAll(...refs);
                    docs.forEach((d) => {
                        if (d.exists) byId.set(d.id, d);
                    });
                }
            }

            if (byId.size === 0) {
                try {
                    mergeSnap(await db.collection('stages').limit(80).get());
                } catch (err) {
                    functions.logger.warn('listLiveStages fallback scan failed', {
                        message: err.message,
                    });
                }
            }

            const candidates = [];
            const hostIdsNeedingLookup = new Set();
            for (const docSnap of byId.values()) {
                const stage = docSnap.data() || {};
                const status = String(stage.status || 'active').toLowerCase();
                // Soft-closed rooms stay live until TTL purge; only hide hard-ended.
                if (status === 'ended' || status === 'expired') continue;
                if (isExpired(stage, nowMs)) continue;

                const hostId = String(stage.hostId || stage.ownerId || '');
                if (!hostId) continue;

                const stageHostKind = resolveHostKind(stage, null);
                const visibility = resolveVisibility(stage, stageHostKind);
                const memberIds = Array.isArray(stage.memberIds)
                    ? stage.memberIds.map(String)
                    : Array.isArray(stage.communityMembers)
                      ? stage.communityMembers.map(String)
                      : [];
                const invitedIds = Array.isArray(stage.invitedIds)
                    ? stage.invitedIds.map(String)
                    : [];
                const blockedIds = Array.isArray(stage.communityBlockedUserIds)
                    ? stage.communityBlockedUserIds.map(String)
                    : [];
                if (blockedIds.includes(uid)) continue;

                const isHost = hostId === uid;
                const isMember = memberIds.includes(uid) || invitedIds.includes(uid);
                const followsHost = viewerFollowingSet.has(hostId);
                const inBizCommunity = viewerJoinedCommunities.has(hostId);
                const discoverable =
                    isHost ||
                    isMember ||
                    (stageHostKind === 'business'
                        ? inBizCommunity
                        : visibility === 'public' || followsHost);
                if (!discoverable) continue;

                candidates.push({
                    id: docSnap.id,
                    stage,
                    hostId,
                    visibility,
                    memberIds,
                    isHost,
                    isMember: isMember || isHost,
                    followsHost,
                    status,
                });

                const hasName = Boolean(asTrimmedString(stage.hostName));
                const hasCoords = Boolean(parseCoordPair(stage));
                if (!hasName || !hasCoords) hostIdsNeedingLookup.add(hostId);
                // Always resolve host for hostKind when missing on stage.
                if (!asTrimmedString(stage.hostKind)) hostIdsNeedingLookup.add(hostId);
            }

            const hostMap = new Map();
            const hostIdList = [...hostIdsNeedingLookup];
            for (let i = 0; i < hostIdList.length; i += 30) {
                const chunk = hostIdList.slice(i, i + 30);
                const refs = chunk.map((id) => db.collection('users').doc(id));
                const hostSnaps = await db.getAll(...refs);
                hostSnaps.forEach((hSnap) => {
                    if (hSnap.exists) hostMap.set(hSnap.id, hSnap.data() || {});
                });
            }

            // Friends filter needs host.following for mutual check — fetch missing hosts.
            if (filter === 'friends') {
                const missingForFriends = [
                    ...new Set(
                        candidates
                            .filter((c) => !c.isHost)
                            .map((c) => c.hostId)
                            .filter((id) => !hostMap.has(id))
                    ),
                ];
                for (let i = 0; i < missingForFriends.length; i += 30) {
                    const chunk = missingForFriends.slice(i, i + 30);
                    const refs = chunk.map((id) => db.collection('users').doc(id));
                    const hostSnaps = await db.getAll(...refs);
                    hostSnaps.forEach((hSnap) => {
                        if (hSnap.exists) hostMap.set(hSnap.id, hSnap.data() || {});
                    });
                }
            }

            const rooms = [];
            for (const c of candidates) {
                const host = hostMap.get(c.hostId) || {};
                const hostFollowing = Array.isArray(host.following) ? host.following : [];
                const isFriend =
                    c.isHost ||
                    isMutualFollow(viewerFollowing, hostFollowing, uid, c.hostId);

                if (filter === 'friends' && !isFriend) continue;

                const title =
                    asTrimmedString(c.stage.title) ||
                    asTrimmedString(c.stage.hostName) ||
                    hostDisplayName(host) ||
                    'Stage';
                const hostName =
                    asTrimmedString(c.stage.hostName) || hostDisplayName(host);
                const hostAvatar = resolveStageHostAvatar(c.stage, host);

                if (search) {
                    const hay = `${title} ${hostName}`.toLowerCase();
                    if (!hay.includes(search)) continue;
                }

                const coords = parseCoordPair(c.stage) || parseCoordPair(host);
                let distanceKm = null;
                if (hasViewerGeo && coords) {
                    distanceKm = Math.round(
                        haversineKm(viewerLat, viewerLng, coords.lat, coords.lng) * 10
                    ) / 10;
                }

                const expiresMs = resolveExpiresMs(c.stage);
                rooms.push({
                    id: c.id,
                    title,
                    hostId: c.hostId,
                    hostName,
                    hostAvatar,
                    hostKind: resolveHostKind(c.stage, host),
                    visibility: c.visibility,
                    status: c.status || 'active',
                    memberCount: c.memberIds.length,
                    isHost: c.isHost,
                    isMember: c.isMember,
                    isFriend,
                    distanceKm,
                    expiresAt: expiresMs ? new Date(expiresMs).toISOString() : null,
                    createdAt: toMillis(c.stage.createdAt),
                });
            }

            rooms.sort((a, b) => {
                const aHas = a.distanceKm != null;
                const bHas = b.distanceKm != null;
                if (aHas !== bHas) return aHas ? -1 : 1;
                if (aHas && bHas && a.distanceKm !== b.distanceKm) {
                    return a.distanceKm - b.distanceKm;
                }
                return (b.createdAt || 0) - (a.createdAt || 0);
            });

            return {
                success: true,
                filter,
                count: rooms.length,
                stages: rooms.slice(0, 80).map(({ createdAt, ...rest }) => rest),
            };
        });

    exportsObj.setStageMembership = functions.https.onCall(async (data, context) => {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'Authentication required.');
        }

        const uid = context.auth.uid;
        let action = asTrimmedString(data?.action).toLowerCase();
        // Legacy alias: end_stage → soft close (room stays until expiresAt)
        if (action === 'end_stage') action = 'close_stage';

        /**
         * Discover/list + host gate ride on this older callable because it already has
         * roles/cloudfunctions.invoker=allUsers. New functions created without setIamPolicy
         * return HTTP 401 to browsers.
         */
        if (action === 'get_my_live') {
            await enforceCallableRateLimit(uid, 'set_stage_get_my_live', {
                perMinute: 40,
                perHour: 400,
                cooldownMs: 200,
            });
            const hostedSnap = await db
                .collection('stages')
                .where('hostId', '==', uid)
                .limit(20)
                .get();
            const nowMs = Date.now();
            for (const docSnap of hostedSnap.docs) {
                const stage = docSnap.data() || {};
                if (isExpired(stage, nowMs)) continue;
                return {
                    success: true,
                    stageId: docSnap.id,
                    title: asTrimmedString(stage.title) || null,
                    status: String(stage.status || 'active'),
                    hostKind: resolveHostKind(stage, null),
                    visibility: resolveVisibility(stage, resolveHostKind(stage, null)),
                    expiresAt: resolveExpiresMs(stage)
                        ? new Date(resolveExpiresMs(stage)).toISOString()
                        : null,
                    memberCount: Array.isArray(stage.memberIds) ? stage.memberIds.length : 0,
                };
            }
            return { success: true, stageId: null };
        }

        if (action === 'list_live') {
            await enforceCallableRateLimit(uid, 'set_stage_list_live', {
                perMinute: 30,
                perHour: 300,
                cooldownMs: 250,
            });
            const filterRaw = asTrimmedString(data?.filter).toLowerCase();
            const filter = filterRaw === 'friends' ? 'friends' : 'all';
            const search = asTrimmedString(data?.search).toLowerCase().slice(0, 80);
            const viewerLat = Number(data?.lat);
            const viewerLng = Number(data?.lng);
            const hasViewerGeo =
                Number.isFinite(viewerLat) &&
                Number.isFinite(viewerLng) &&
                Math.abs(viewerLat) <= 90 &&
                Math.abs(viewerLng) <= 180;

            const viewerSnap = await db.collection('users').doc(uid).get();
            if (!viewerSnap.exists) {
                throw new functions.https.HttpsError('not-found', 'User not found.');
            }
            const viewer = viewerSnap.data() || {};
            const viewerFollowing = Array.isArray(viewer.following) ? viewer.following : [];
            const viewerFollowingSet = new Set(viewerFollowing.map(String));
            const viewerJoinedCommunities = new Set(
                (Array.isArray(viewer.joinedCommunities) ? viewer.joinedCommunities : [])
                    .map((id) => String(id))
                    .filter(Boolean)
            );
            const joinedStageIds = [
                ...new Set(
                    (Array.isArray(viewer.joinedStages) ? viewer.joinedStages : [])
                        .map((id) => asTrimmedString(id))
                        .filter(Boolean)
                ),
            ].slice(0, 40);

            const now = admin.firestore.Timestamp.now();
            const nowMs = now.toMillis();
            const byId = new Map();
            const mergeSnap = (snap) => {
                if (!snap || !snap.docs) return;
                snap.docs.forEach((d) => byId.set(d.id, d));
            };
            const settled = await Promise.allSettled([
                db.collection('stages').where('status', '==', 'active').limit(100).get(),
                db.collection('stages').where('expiresAt', '>', now).limit(100).get(),
                db.collection('stages').where('visibility', '==', 'public').limit(100).get(),
                db.collection('stages').where('hostId', '==', uid).limit(20).get(),
            ]);
            settled.forEach((r) => {
                if (r.status === 'fulfilled') mergeSnap(r.value);
            });
            if (joinedStageIds.length > 0) {
                for (let i = 0; i < joinedStageIds.length; i += 30) {
                    const chunk = joinedStageIds.slice(i, i + 30);
                    const docs = await db.getAll(
                        ...chunk.map((id) => db.collection('stages').doc(id))
                    );
                    docs.forEach((d) => {
                        if (d.exists) byId.set(d.id, d);
                    });
                }
            }
            if (byId.size === 0) {
                try {
                    mergeSnap(await db.collection('stages').limit(80).get());
                } catch {
                    /* ignore */
                }
            }

            const candidates = [];
            const hostIdsNeedingLookup = new Set();
            for (const docSnap of byId.values()) {
                const stage = docSnap.data() || {};
                const status = String(stage.status || 'active').toLowerCase();
                if (status === 'ended' || status === 'expired') continue;
                if (isExpired(stage, nowMs)) continue;
                const hostId = String(stage.hostId || stage.ownerId || '');
                if (!hostId) continue;
                const stageHostKind = resolveHostKind(stage, null);
                const visibility = resolveVisibility(stage, stageHostKind);
                const memberIds = Array.isArray(stage.memberIds)
                    ? stage.memberIds.map(String)
                    : Array.isArray(stage.communityMembers)
                      ? stage.communityMembers.map(String)
                      : [];
                const invitedIds = Array.isArray(stage.invitedIds)
                    ? stage.invitedIds.map(String)
                    : [];
                const blockedIds = Array.isArray(stage.communityBlockedUserIds)
                    ? stage.communityBlockedUserIds.map(String)
                    : [];
                if (blockedIds.includes(uid)) continue;
                const isHost = hostId === uid;
                const isMember = memberIds.includes(uid) || invitedIds.includes(uid);
                const followsHost = viewerFollowingSet.has(hostId);
                const inBizCommunity = viewerJoinedCommunities.has(hostId);
                if (
                    !(
                        isHost ||
                        isMember ||
                        (stageHostKind === 'business'
                            ? inBizCommunity
                            : visibility === 'public' || followsHost)
                    )
                ) {
                    continue;
                }
                candidates.push({
                    id: docSnap.id,
                    stage,
                    hostId,
                    visibility,
                    memberIds,
                    isHost,
                    isMember: isMember || isHost,
                    status,
                });
                if (
                    !asTrimmedString(stage.hostName) ||
                    !parseCoordPair(stage) ||
                    !asTrimmedString(stage.hostKind)
                ) {
                    hostIdsNeedingLookup.add(hostId);
                }
            }

            const hostMap = new Map();
            const needHosts = new Set(hostIdsNeedingLookup);
            if (filter === 'friends') {
                candidates.forEach((c) => {
                    if (!c.isHost) needHosts.add(c.hostId);
                });
            }
            const hostIdList = [...needHosts];
            for (let i = 0; i < hostIdList.length; i += 30) {
                const chunk = hostIdList.slice(i, i + 30);
                const hostSnaps = await db.getAll(
                    ...chunk.map((id) => db.collection('users').doc(id))
                );
                hostSnaps.forEach((hSnap) => {
                    if (hSnap.exists) hostMap.set(hSnap.id, hSnap.data() || {});
                });
            }

            const rooms = [];
            for (const c of candidates) {
                const host = hostMap.get(c.hostId) || {};
                const hostFollowing = Array.isArray(host.following) ? host.following : [];
                const isFriend =
                    c.isHost ||
                    isMutualFollow(viewerFollowing, hostFollowing, uid, c.hostId);
                if (filter === 'friends' && !isFriend) continue;
                const title =
                    asTrimmedString(c.stage.title) ||
                    asTrimmedString(c.stage.hostName) ||
                    hostDisplayName(host) ||
                    'Stage';
                const hostName =
                    asTrimmedString(c.stage.hostName) || hostDisplayName(host);
                const hostAvatar = resolveStageHostAvatar(c.stage, host);
                if (search) {
                    const hay = `${title} ${hostName}`.toLowerCase();
                    if (!hay.includes(search)) continue;
                }
                const coords = parseCoordPair(c.stage) || parseCoordPair(host);
                let distanceKm = null;
                if (hasViewerGeo && coords) {
                    distanceKm =
                        Math.round(
                            haversineKm(viewerLat, viewerLng, coords.lat, coords.lng) * 10
                        ) / 10;
                }
                const expiresMs = resolveExpiresMs(c.stage);
                rooms.push({
                    id: c.id,
                    title,
                    hostId: c.hostId,
                    hostName,
                    hostAvatar,
                    hostKind: resolveHostKind(c.stage, host),
                    visibility: c.visibility,
                    status: c.status || 'active',
                    memberCount: c.memberIds.length,
                    isHost: c.isHost,
                    isMember: c.isMember,
                    isFriend,
                    distanceKm,
                    expiresAt: expiresMs ? new Date(expiresMs).toISOString() : null,
                    createdAt: toMillis(c.stage.createdAt),
                });
            }
            rooms.sort((a, b) => {
                const aHas = a.distanceKm != null;
                const bHas = b.distanceKm != null;
                if (aHas !== bHas) return aHas ? -1 : 1;
                if (aHas && bHas && a.distanceKm !== b.distanceKm) {
                    return a.distanceKm - b.distanceKm;
                }
                return (b.createdAt || 0) - (a.createdAt || 0);
            });
            return {
                success: true,
                filter,
                count: rooms.length,
                stages: rooms.slice(0, 80).map(({ createdAt, ...rest }) => rest),
            };
        }

        const stageId = asTrimmedString(data?.stageId);
        if (!stageId) {
            throw new functions.https.HttpsError('invalid-argument', 'stageId is required.');
        }
        if (
            ![
                'join',
                'leave',
                'remove_member',
                'mute_member',
                'unmute_member',
                'block_member',
                'close_stage',
                'reopen_stage',
            ].includes(action)
        ) {
            throw new functions.https.HttpsError('invalid-argument', 'Invalid action.');
        }

        await enforceCallableRateLimit(uid, 'set_stage_membership', {
            perMinute: 20,
            perHour: 200,
            cooldownMs: 500,
        });

        const stageRef = db.collection('stages').doc(stageId);
        const stageSnap = await stageRef.get();
        if (!stageSnap.exists) {
            throw new functions.https.HttpsError('not-found', 'Stage not found.');
        }
        const stage = stageSnap.data() || {};
        const hostId = String(stage.hostId || '');
        const memberIds = Array.isArray(stage.memberIds) ? stage.memberIds : [];
        const invitedIds = Array.isArray(stage.invitedIds) ? stage.invitedIds : [];
        const blockedIds = Array.isArray(stage.communityBlockedUserIds)
            ? stage.communityBlockedUserIds
            : [];
        const stageHostKindEarly = resolveHostKind(stage, null);
        const visibility = resolveVisibility(stage, stageHostKindEarly);

        if (isExpired(stage)) {
            throw new functions.https.HttpsError(
                'failed-precondition',
                'This Stage has expired and can no longer be changed.'
            );
        }

        if (action === 'join') {
            if (uid === hostId) {
                return { success: true, alreadyMember: true, isHost: true };
            }
            if (memberIds.includes(uid)) {
                return { success: true, alreadyMember: true };
            }
            if (blockedIds.includes(uid)) {
                throw new functions.https.HttpsError(
                    'permission-denied',
                    'You cannot join this Stage.'
                );
            }

            const userSnap = await db.collection('users').doc(uid).get();
            if (!userSnap.exists) {
                throw new functions.https.HttpsError('not-found', 'User not found.');
            }
            const user = userSnap.data() || {};
            if (isBusinessUserDoc(user)) {
                throw new functions.https.HttpsError(
                    'failed-precondition',
                    'Business accounts cannot join Stage rooms.'
                );
            }
            const role = String(user.role || '').toLowerCase();
            if (role === 'guest' || user.isGuest === true) {
                throw new functions.https.HttpsError(
                    'failed-precondition',
                    'Guest accounts cannot join Stage rooms.'
                );
            }

            if (hostId) {
                const hostSnap = await db.collection('users').doc(hostId).get();
                const hostBlocked = hostStageBlockedIds(hostSnap.exists ? hostSnap.data() : {});
                if (hostBlocked.includes(uid)) {
                    throw new functions.https.HttpsError(
                        'permission-denied',
                        'You are blocked from this host’s Stages.'
                    );
                }
            }

            const following = Array.isArray(user.following) ? user.following : [];
            const followsHost = Boolean(hostId && following.includes(hostId));
            const wasInvited = invitedIds.includes(uid);
            const stageHostKind = stageHostKindEarly;
            const joinedCommunities = Array.isArray(user.joinedCommunities)
                ? user.joinedCommunities.map(String)
                : [];
            const inBizCommunity = Boolean(hostId && joinedCommunities.includes(hostId));
            const canJoin =
                stageHostKind === 'business'
                    ? inBizCommunity || wasInvited
                    : visibility === 'public' || followsHost || wasInvited;

            if (!canJoin) {
                throw new functions.https.HttpsError(
                    'permission-denied',
                    stageHostKind === 'business'
                        ? 'This business Stage is for community members only. Join the community first.'
                        : visibility === 'private'
                          ? 'This Stage is for followers of the host only.'
                          : 'You cannot join this Stage.'
                );
            }

            if (String(stage.status || 'active') !== 'active') {
                throw new functions.https.HttpsError(
                    'failed-precondition',
                    'This Stage is closed right now.'
                );
            }

            await stageRef.update({
                memberIds: admin.firestore.FieldValue.arrayUnion(uid),
                communityMembers: admin.firestore.FieldValue.arrayUnion(uid),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            await db.collection('users').doc(uid).set(
                {
                    joinedStages: admin.firestore.FieldValue.arrayUnion(stageId),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                },
                { merge: true }
            );
            return { success: true, joined: true, visibility };
        }

        if (action === 'leave') {
            // Host leave = hard-delete the Stage for everyone.
            if (uid === hostId) {
                await purgeStageRoom(db, admin, stageId, stage);
                return { success: true, left: true, deleted: true };
            }
            if (!memberIds.includes(uid)) {
                return { success: true, alreadyLeft: true };
            }
            await stageRef.update({
                memberIds: admin.firestore.FieldValue.arrayRemove(uid),
                communityMembers: admin.firestore.FieldValue.arrayRemove(uid),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            await db.collection('users').doc(uid).set(
                {
                    joinedStages: admin.firestore.FieldValue.arrayRemove(stageId),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                },
                { merge: true }
            );
            return { success: true, left: true };
        }

        if (action === 'unmute_member') {
            const targetUid = asTrimmedString(data?.targetUid);
            if (!targetUid) {
                throw new functions.https.HttpsError('invalid-argument', 'targetUid is required.');
            }
            // Guest may clear their own expired mute; host may unmute anyone.
            if (uid !== hostId && uid !== targetUid) {
                throw new functions.https.HttpsError(
                    'permission-denied',
                    'Only the Stage host can unmute other members.'
                );
            }
            if (uid !== hostId && uid === targetUid) {
                const untilMap =
                    stage.communityMutedUntil && typeof stage.communityMutedUntil === 'object'
                        ? stage.communityMutedUntil
                        : {};
                const untilMs = toMillis(untilMap[targetUid]);
                if (untilMs && untilMs > Date.now()) {
                    throw new functions.https.HttpsError(
                        'permission-denied',
                        'Mute is still active.'
                    );
                }
            }
            await stageRef.update({
                communityMutedUserIds: admin.firestore.FieldValue.arrayRemove(targetUid),
                [`communityMutedUntil.${targetUid}`]: admin.firestore.FieldValue.delete(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            return { success: true, unmuted: true };
        }

        if (uid !== hostId) {
            throw new functions.https.HttpsError(
                'permission-denied',
                'Only the Stage host can perform this action.'
            );
        }

        if (action === 'remove_member') {
            const targetUid = asTrimmedString(data?.targetUid);
            if (!targetUid || targetUid === hostId) {
                throw new functions.https.HttpsError('invalid-argument', 'targetUid is required.');
            }
            await ejectStageMember(db, admin, stageId, targetUid);
            return { success: true, removed: true };
        }

        if (action === 'mute_member') {
            const targetUid = asTrimmedString(data?.targetUid);
            if (!targetUid || targetUid === hostId) {
                throw new functions.https.HttpsError('invalid-argument', 'targetUid is required.');
            }
            const until = resolveMuteUntilTimestamp(admin, data?.duration, stage);
            if (!until) {
                throw new functions.https.HttpsError(
                    'invalid-argument',
                    'duration must be 5m, 1h, or session.'
                );
            }
            await stageRef.update({
                communityMutedUserIds: admin.firestore.FieldValue.arrayUnion(targetUid),
                [`communityMutedUntil.${targetUid}`]: until,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            return {
                success: true,
                muted: true,
                duration: String(data?.duration || '').toLowerCase(),
                untilMs: until.toMillis(),
            };
        }

        if (action === 'block_member') {
            const targetUid = asTrimmedString(data?.targetUid);
            if (!targetUid || targetUid === hostId) {
                throw new functions.https.HttpsError('invalid-argument', 'targetUid is required.');
            }
            await ejectStageMember(db, admin, stageId, targetUid);
            await stageRef.update({
                communityBlockedUserIds: admin.firestore.FieldValue.arrayUnion(targetUid),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            // Host-level ban — blocks joining any future Stage by this host.
            await db.collection('users').doc(hostId).set(
                {
                    stageBlockedUserIds: admin.firestore.FieldValue.arrayUnion(targetUid),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                },
                { merge: true }
            );
            return { success: true, blocked: true };
        }

        if (action === 'close_stage') {
            await stageRef.update({
                status: 'closed',
                closedAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            return { success: true, closed: true };
        }

        // reopen_stage
        if (String(stage.status || '') !== 'closed') {
            return { success: true, alreadyOpen: true, status: stage.status || 'active' };
        }
        await stageRef.update({
            status: 'active',
            reopenedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return { success: true, reopened: true };
    });

    /** Hourly: hard-delete stages past expiresAt (messages, media refs, membership). */
    exportsObj.purgeExpiredStages = functions
        .runWith({ timeoutSeconds: 300, memory: '512MB' })
        .pubsub.schedule('every 1 hours')
        .onRun(async () => {
            const now = admin.firestore.Timestamp.now();
            const nowMs = now.toMillis();
            const expiredByTime = await db
                .collection('stages')
                .where('expiresAt', '<=', now)
                .limit(40)
                .get();

            // Legacy rooms without expiresAt — scan a small recent window by createdAt
            const legacyCutoff = admin.firestore.Timestamp.fromMillis(nowMs - STAGE_TTL_MS);
            const legacySnap = await db
                .collection('stages')
                .where('createdAt', '<=', legacyCutoff)
                .limit(20)
                .get();

            const byId = new Map();
            expiredByTime.docs.forEach((d) => byId.set(d.id, d));
            legacySnap.docs.forEach((d) => {
                const data = d.data() || {};
                if (!data.expiresAt && isExpired(data, nowMs)) byId.set(d.id, d);
            });

            let purged = 0;
            for (const docSnap of byId.values()) {
                try {
                    await purgeStageRoom(db, admin, docSnap.id, docSnap.data() || {});
                    purged += 1;
                } catch (err) {
                    functions.logger.error('purgeExpiredStages failed', {
                        stageId: docSnap.id,
                        message: err.message,
                    });
                }
            }

            functions.logger.info('purgeExpiredStages', {
                purged,
                scanned: byId.size,
            });
            return null;
        });
}

module.exports = { registerStageRooms, STAGE_TTL_MS, purgeStageRoom };
