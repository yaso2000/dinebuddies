/**
 * Consumer Stage rooms — event chat for mutual follows (not business communities).
 * Always free (no credits / day pricing). Fixed 24h TTL then hard-delete
 * Firestore + Storage media + invite notifications.
 */
const functions = require('firebase-functions');
const { isBusinessUserDoc } = require('./creditsCore');

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
            if (isBusinessUserDoc(host)) {
                throw new functions.https.HttpsError(
                    'failed-precondition',
                    'Business accounts cannot create Stage rooms.'
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
                asTrimmedString(host.display_name || host.displayName || host.name) ||
                'Stage';

            const rawInvitees = Array.isArray(data?.inviteeIds) ? data.inviteeIds : [];
            const inviteeCandidates = [
                ...new Set(
                    rawInvitees
                        .map((id) => asTrimmedString(id))
                        .filter((id) => id && id !== hostId)
                ),
            ].slice(0, MAX_INVITEES);

            if (inviteeCandidates.length === 0) {
                throw new functions.https.HttpsError(
                    'invalid-argument',
                    'Select at least one mutual follow to invite.'
                );
            }

            const hostFollowing = Array.isArray(host.following) ? host.following : [];
            const validInvitees = [];
            for (const inviteeId of inviteeCandidates) {
                const snap = await db.collection('users').doc(inviteeId).get();
                if (!snap.exists) continue;
                const u = snap.data() || {};
                if (isBusinessUserDoc(u)) continue;
                const role = String(u.role || '').toLowerCase();
                if (role === 'guest' || u.isGuest === true) continue;
                const theirFollowing = Array.isArray(u.following) ? u.following : [];
                if (!isMutualFollow(hostFollowing, theirFollowing, hostId, inviteeId)) continue;
                const blocked = Array.isArray(u.blockedUserIds) ? u.blockedUserIds : [];
                if (blocked.includes(hostId)) continue;
                validInvitees.push(inviteeId);
            }

            if (validInvitees.length === 0) {
                throw new functions.https.HttpsError(
                    'failed-precondition',
                    'No valid mutual follows remained in the selection.'
                );
            }

            const memberIds = [hostId, ...validInvitees];
            const stageRef = db.collection('stages').doc();
            const stageId = stageRef.id;
            const hostName =
                asTrimmedString(host.display_name || host.displayName || host.name) || 'Host';
            const hostAvatar =
                host.avatar || host.photo_url || host.photoURL || host.profilePicture || null;
            // Free room — no credits charged; duration is always exactly 24h (not extendable by reopen).
            const expiresAt = admin.firestore.Timestamp.fromMillis(Date.now() + STAGE_TTL_MS);

            await stageRef.set({
                kind: 'stage',
                hostId,
                title,
                status: 'active',
                memberIds,
                invitedIds: validInvitees,
                communityMembers: memberIds,
                communityMutedUserIds: [],
                communityBlockedUserIds: [],
                communityChatZoneTheme: 'stage',
                communityChatBannerVisible: true,
                ownerId: hostId,
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
            const message = `${hostName} invited you to a Stage: ${previewTitle}`.slice(0, 500);
            for (const inviteeId of validInvitees) {
                const notifRef = db.collection('notifications').doc();
                notifBatch.set(notifRef, {
                    userId: inviteeId,
                    type: 'stage_invite',
                    title: 'Stage invitation',
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
                    metadata: { stageId, source: 'create_stage_room' },
                });
            }
            await notifBatch.commit();

            functions.logger.info('createStageRoom', {
                stageId,
                hostId,
                invitees: validInvitees.length,
            });

            return {
                success: true,
                stageId,
                memberCount: memberIds.length,
                invitedCount: validInvitees.length,
                expiresAt: expiresAt.toDate().toISOString(),
            };
        });

    exportsObj.setStageMembership = functions.https.onCall(async (data, context) => {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'Authentication required.');
        }

        const uid = context.auth.uid;
        const stageId = asTrimmedString(data?.stageId);
        let action = asTrimmedString(data?.action).toLowerCase();
        if (!stageId) {
            throw new functions.https.HttpsError('invalid-argument', 'stageId is required.');
        }
        // Legacy alias: end_stage → soft close (room stays until expiresAt)
        if (action === 'end_stage') action = 'close_stage';
        if (!['leave', 'remove_member', 'close_stage', 'reopen_stage'].includes(action)) {
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

        if (isExpired(stage)) {
            throw new functions.https.HttpsError(
                'failed-precondition',
                'This Stage has expired and can no longer be changed.'
            );
        }

        if (action === 'leave') {
            if (uid === hostId) {
                throw new functions.https.HttpsError(
                    'failed-precondition',
                    'Host cannot leave — close the Stage instead.'
                );
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
            await stageRef.update({
                memberIds: admin.firestore.FieldValue.arrayRemove(targetUid),
                communityMembers: admin.firestore.FieldValue.arrayRemove(targetUid),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            await db.collection('users').doc(targetUid).set(
                {
                    joinedStages: admin.firestore.FieldValue.arrayRemove(stageId),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                },
                { merge: true }
            );
            return { success: true, removed: true };
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

module.exports = { registerStageRooms, STAGE_TTL_MS };
