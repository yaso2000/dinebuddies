/**
 * Admin mass messaging — system chat threads + FCM via notifications collection.
 */
const functions = require('firebase-functions');
const { runAdminBrowseUsers, matchesRoleFilter } = require('./adminBrowseUsers');

const MAX_TARGETS = 500;
const MESSAGE_MAX_LEN = 4000;
const SUPPORT_DISPLAY_NAME = 'DineBuddies';
const SUPPORT_SENDER_NAME = 'DineBuddies Support';
const DEFAULT_SUPPORT_UID = 'xTgHC1v00LZIZ6ESA9YGjGU5zW33';

const AUDIENCE_MAP = {
    all: 'all',
    user: 'user',
    business: 'business',
    affiliate_agent: 'affiliate_agent',
    id: 'id',
};

function asTrimmedString(v) {
    return typeof v === 'string' ? v.trim() : '';
}

function conversationIdFor(uidA, uidB) {
    return [uidA, uidB].sort().join('_');
}

/**
 * @param {FirebaseFirestore.Firestore} db
 */
async function resolveSupportSenderUid(db) {
    try {
        const snap = await db.collection('app_settings').doc('messaging').get();
        const uid = asTrimmedString(snap.data()?.supportUid);
        if (uid) return uid;
    } catch (_) {
        /* use default */
    }
    return DEFAULT_SUPPORT_UID;
}

/**
 * @param {FirebaseFirestore.Firestore} db
 * @param {typeof import('firebase-admin')} admin
 */
async function ensureSupportAccount(db, admin, supportUid) {
    await db.collection('users').doc(supportUid).set(
        {
            display_name: SUPPORT_DISPLAY_NAME,
            displayName: SUPPORT_DISPLAY_NAME,
            isSystemAccount: true,
            role: 'support',
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
    );
}

/**
 * @param {FirebaseFirestore.Firestore} db
 * @param {typeof import('firebase-admin')} admin
 */
async function deliverSystemMessage(db, admin, { targetUid, supportUid, text, campaignId }) {
    const conversationId = conversationIdFor(targetUid, supportUid);
    const convRef = db.collection('conversations').doc(conversationId);
    const convSnap = await convRef.get();
    const preview = text.length > 200 ? `${text.slice(0, 197)}…` : text;

    if (!convSnap.exists) {
        await convRef.set({
            participants: [targetUid, supportUid].sort(),
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            lastMessageTime: admin.firestore.FieldValue.serverTimestamp(),
            lastMessage: null,
            unreadBy: [],
            isSupportThread: true,
            supportDisplayName: SUPPORT_DISPLAY_NAME,
        });
    }

    const msgRef = convRef.collection('messages').doc();
    await msgRef.set({
        senderId: supportUid,
        text,
        type: 'system',
        isSystemMessage: true,
        senderName: SUPPORT_SENDER_NAME,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        status: 'sent',
        reactions: {},
        campaignId: campaignId || null,
    });

    await convRef.set(
        {
            lastMessage: preview,
            lastMessageTime: admin.firestore.FieldValue.serverTimestamp(),
            unreadBy: admin.firestore.FieldValue.arrayUnion(targetUid),
            supportDisplayName: SUPPORT_DISPLAY_NAME,
            isSupportThread: true,
        },
        { merge: true }
    );

    await db.collection('notifications').add({
        userId: targetUid,
        type: 'message',
        title: SUPPORT_DISPLAY_NAME,
        message: `${SUPPORT_SENDER_NAME}: ${preview}`,
        actionUrl: `/chat/${supportUid}`,
        fromUserId: supportUid,
        fromUserName: SUPPORT_SENDER_NAME,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        read: false,
        metadata: { campaignId: campaignId || null, isSystemMessage: true },
    });
}

/**
 * @param {FirebaseFirestore.Firestore} db
 * @param {typeof import('firebase-admin')} admin
 */
async function resolveTargetUids(db, admin, { audience, targetUid }) {
    if (audience === 'id') {
        const uid = asTrimmedString(targetUid);
        if (!uid) {
            throw new functions.https.HttpsError('invalid-argument', 'targetUid is required for ID audience.');
        }
        const snap = await db.collection('users').doc(uid).get();
        if (!snap.exists) {
            throw new functions.https.HttpsError('not-found', 'User not found.');
        }
        return [uid];
    }

    const roleFilter = AUDIENCE_MAP[audience] || 'all';
    if (roleFilter === 'id') {
        throw new functions.https.HttpsError('invalid-argument', 'Invalid audience.');
    }

    const uids = [];
    let cursor = null;
    let guard = 0;
    while (uids.length < MAX_TARGETS && guard < 80) {
        guard += 1;
        const page = await runAdminBrowseUsers(db, admin, {
            roleFilter,
            startAfterId: cursor,
            pageSize: 100,
            bannedOnly: false,
        });
        for (const row of page.users || []) {
            if (row.id && !uids.includes(row.id)) uids.push(row.id);
            if (uids.length >= MAX_TARGETS) break;
        }
        if (!page.hasNext) break;
        cursor = page.lastId;
    }
    return uids;
}

function registerAdminMassMessaging(exportsObj, { db, admin, assertAdminContext }) {
    exportsObj.adminSendMassMessage = functions
        .runWith({ timeoutSeconds: 540, memory: '512MB' })
        .https.onCall(async (data, context) => {
            const { requesterUid } = await assertAdminContext(context);
            const audience = asTrimmedString(data?.audience) || 'all';
            if (!Object.prototype.hasOwnProperty.call(AUDIENCE_MAP, audience)) {
                throw new functions.https.HttpsError('invalid-argument', 'Invalid audience filter.');
            }

            const text = asTrimmedString(data?.message);
            if (!text || text.length > MESSAGE_MAX_LEN) {
                throw new functions.https.HttpsError(
                    'invalid-argument',
                    `message is required (max ${MESSAGE_MAX_LEN} chars).`
                );
            }

            const supportUid = await resolveSupportSenderUid(db);
            await ensureSupportAccount(db, admin, supportUid);

            const targetUids = await resolveTargetUids(db, admin, {
                audience,
                targetUid: data?.targetUid,
            });

            if (targetUids.length === 0) {
                throw new functions.https.HttpsError('failed-precondition', 'No matching recipients.');
            }
            if (targetUids.length > MAX_TARGETS) {
                throw new functions.https.HttpsError(
                    'resource-exhausted',
                    `Too many recipients (${targetUids.length}). Max ${MAX_TARGETS}.`
                );
            }

            const campaignRef = db.collection('admin_announcements').doc();
            const campaignId = campaignRef.id;
            const now = admin.firestore.FieldValue.serverTimestamp();

            await campaignRef.set({
                message: text,
                audience,
                targetUid: audience === 'id' ? asTrimmedString(data?.targetUid) : null,
                targetCount: targetUids.length,
                sentCount: 0,
                failedCount: 0,
                status: 'sending',
                adminUid: requesterUid,
                supportUid,
                createdAt: now,
            });

            let sentCount = 0;
            let failedCount = 0;
            const failures = [];

            for (const uid of targetUids) {
                if (uid === supportUid) continue;
                try {
                    const userSnap = await db.collection('users').doc(uid).get();
                    const userData = userSnap.exists ? userSnap.data() : {};
                    if (userData?.banned === true || userData?.frozen === true) {
                        continue;
                    }
                    if (audience !== 'all' && audience !== 'id') {
                        const roleKey = AUDIENCE_MAP[audience];
                        if (!matchesRoleFilter(userData, roleKey)) continue;
                    }
                    await deliverSystemMessage(db, admin, {
                        targetUid: uid,
                        supportUid,
                        text,
                        campaignId,
                    });
                    sentCount += 1;
                } catch (err) {
                    failedCount += 1;
                    if (failures.length < 8) {
                        failures.push({ uid, error: err?.message || 'send_failed' });
                    }
                }
            }

            await campaignRef.set(
                {
                    sentCount,
                    failedCount,
                    status: failedCount > 0 && sentCount === 0 ? 'failed' : 'completed',
                    completedAt: admin.firestore.FieldValue.serverTimestamp(),
                    failures,
                },
                { merge: true }
            );

            return {
                success: true,
                campaignId,
                targetCount: targetUids.length,
                sentCount,
                failedCount,
                supportUid,
            };
        });

    exportsObj.adminListAnnouncements = functions.https.onCall(async (data, context) => {
        await assertAdminContext(context);
        const pageSize = Math.min(Math.max(Number(data?.pageSize) || 20, 1), 50);
        const snap = await db
            .collection('admin_announcements')
            .orderBy('createdAt', 'desc')
            .limit(pageSize)
            .get();

        const items = snap.docs.map((docSnap) => {
            const d = docSnap.data() || {};
            return {
                id: docSnap.id,
                message: String(d.message || '').slice(0, 500),
                audience: d.audience || 'all',
                targetCount: Number(d.targetCount) || 0,
                sentCount: Number(d.sentCount) || 0,
                failedCount: Number(d.failedCount) || 0,
                status: d.status || 'unknown',
                adminUid: d.adminUid || '',
                createdAt: d.createdAt?.toDate?.()?.toISOString?.() || null,
            };
        });

        return { items };
    });
}

module.exports = { registerAdminMassMessaging, resolveSupportSenderUid, SUPPORT_DISPLAY_NAME };
