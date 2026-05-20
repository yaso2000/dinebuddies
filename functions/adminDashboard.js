/**
 * Admin dashboard callables — moderation, credits, invitations (server-trusted).
 */
const functions = require('firebase-functions');
const { grantFreeCreditsInTransaction } = require('./creditsCore');
const { inferInviteCategory } = require('./inviteCategory');

const INVITE_PAGE_MAX = 50;
const INVITE_SCAN_MAX = 2500;
const REPORTS_PAGE_MAX = 50;

function asTrimmedString(v) {
    return typeof v === 'string' ? v.trim() : '';
}

/**
 * @param {FirebaseFirestore.Firestore} db
 * @param {string} col
 * @param {'public'|'private'} collectionKind
 * @param {(d: Record<string, unknown>, cat: string) => boolean} predicate
 * @param {string|null} startAfterId
 * @param {number} pageSize
 */
async function listInvitationsPage(db, col, collectionKind, predicate, startAfterId, pageSize) {
    const need = pageSize + 1;
    const items = [];
    let cursor = startAfterId;
    let scanned = 0;
    const batch = 50;

    while (items.length < need && scanned < INVITE_SCAN_MAX) {
        let q = db.collection(col).orderBy('createdAt', 'desc').limit(batch);
        if (cursor) {
            const c = await db.collection(col).doc(cursor).get();
            if (c.exists) q = q.startAfter(c);
            else cursor = null;
        }
        const snap = await q.get();
        if (snap.empty) break;
        scanned += snap.size;

        for (const docSnap of snap.docs) {
            cursor = docSnap.id;
            const d = docSnap.data() || {};
            const inviteType = inferInviteCategory(d, collectionKind);
            if (predicate && !predicate(d, inviteType)) continue;

            const createdAt = d.createdAt?.toDate?.()?.toISOString?.() || null;
            const title = d.title || d.occasionType || d.type || docSnap.id;
            const hostId = d.authorId || d.author?.id || d.hostId || '';
            const hostName = d.creatorName || d.author?.name || d.hostName || '';
            items.push({
                id: docSnap.id,
                inviteType,
                collection: col,
                title: String(title).slice(0, 120),
                hostId,
                hostName: String(hostName).slice(0, 80),
                createdAt,
                expired: d.expired === true,
                adminBlocked: d.adminBlocked === true,
                reported: d.reported === true,
            });
            if (items.length >= need) break;
        }
        if (snap.size < batch) break;
    }

    const hasNext = items.length > pageSize;
    const page = items.slice(0, pageSize);
    return {
        items: page,
        hasNext,
        lastId: page.length ? page[page.length - 1].id : null,
    };
}

/**
 * @param {FirebaseFirestore.Firestore} db
 * @param {typeof import('firebase-admin')} admin
 * @param {(ctx: import('firebase-functions').https.CallableContext) => Promise<{requesterUid: string}>} assertAdminContext
 */
function registerAdminDashboard(exportsObj, { db, admin, assertAdminContext }) {
    exportsObj.adminSetUserFreezeStatus = functions.https.onCall(async (data, context) => {
        await assertAdminContext(context);
        const targetUid = asTrimmedString(data?.targetUid);
        const frozen = data?.frozen === true;
        if (!targetUid) {
            throw new functions.https.HttpsError('invalid-argument', 'targetUid is required.');
        }

        const updates = {
            frozen,
            frozenAt: frozen ? admin.firestore.FieldValue.serverTimestamp() : null,
            frozenBy: frozen ? context.auth.uid : null,
        };

        if (frozen) {
            const days = Number(data?.freezeDays);
            if (Number.isFinite(days) && days > 0 && days <= 365) {
                const until = new Date();
                until.setDate(until.getDate() + Math.floor(days));
                updates.frozenUntil = admin.firestore.Timestamp.fromDate(until);
            } else {
                updates.frozenUntil = null;
            }
        } else {
            updates.frozenUntil = null;
        }

        await db.collection('users').doc(targetUid).set(updates, { merge: true });
        return { success: true, targetUid, frozen };
    });

    exportsObj.adminGrantFreeCredits = functions.https.onCall(async (data, context) => {
        const { requesterUid } = await assertAdminContext(context);
        const targetUid = asTrimmedString(data?.targetUid);
        const amount = Math.floor(Number(data?.amount));
        const note = asTrimmedString(data?.note).slice(0, 200);

        if (!targetUid) {
            throw new functions.https.HttpsError('invalid-argument', 'targetUid is required.');
        }
        if (!Number.isFinite(amount) || amount <= 0 || amount > 50000) {
            throw new functions.https.HttpsError('invalid-argument', 'amount must be between 1 and 50000.');
        }

        const userRef = db.collection('users').doc(targetUid);
        let freeAfter = 0;

        await db.runTransaction(async (tx) => {
            const snap = await tx.get(userRef);
            if (!snap.exists) {
                throw new functions.https.HttpsError('not-found', 'User not found.');
            }
            const d = snap.data() || {};
            const result = grantFreeCreditsInTransaction(tx, userRef, d, targetUid, amount, {
                reason: note ? `admin_grant:${note}` : 'admin_grant',
                adminUid: requesterUid,
            });
            freeAfter = result.freeCreditsAfter;
        });

        return { success: true, targetUid, amount, freeCredits: freeAfter };
    });

    exportsObj.adminListInvitations = functions.https.onCall(async (data, context) => {
        await assertAdminContext(context);
        const inviteTypeFilter = asTrimmedString(data?.inviteType) || 'all';
        const allowedTypes = new Set(['all', 'public', 'private', 'dating']);
        if (!allowedTypes.has(inviteTypeFilter)) {
            throw new functions.https.HttpsError('invalid-argument', 'Invalid inviteType filter.');
        }

        const startAfterId = asTrimmedString(data?.startAfterId) || null;
        const pageSize = Math.min(Math.max(Number(data?.pageSize) || 25, 1), INVITE_PAGE_MAX);

        if (inviteTypeFilter === 'public') {
            return listInvitationsPage(
                db,
                'invitations',
                'public',
                (_d, cat) => cat === 'public',
                startAfterId,
                pageSize
            );
        }

        if (inviteTypeFilter === 'private') {
            return listInvitationsPage(
                db,
                'private_invitations',
                'private',
                (_d, cat) => cat === 'private',
                startAfterId,
                pageSize
            );
        }

        if (inviteTypeFilter === 'dating') {
            return listInvitationsPage(
                db,
                'private_invitations',
                'private',
                (_d, cat) => cat === 'dating',
                startAfterId,
                pageSize
            );
        }

        const half = Math.ceil(pageSize / 2);
        const [pub, priv] = await Promise.all([
            listInvitationsPage(db, 'invitations', 'public', null, null, half),
            listInvitationsPage(db, 'private_invitations', 'private', null, null, half),
        ]);
        const merged = [...pub.items, ...priv.items].sort((a, b) => {
            const ta = a.createdAt ? Date.parse(a.createdAt) : 0;
            const tb = b.createdAt ? Date.parse(b.createdAt) : 0;
            return tb - ta;
        });
        const items = merged.slice(0, pageSize);
        return {
            items,
            hasNext: pub.hasNext || priv.hasNext,
            lastId: items.length ? items[items.length - 1].id : null,
        };
    });

    exportsObj.adminModerateInvitation = functions.https.onCall(async (data, context) => {
        await assertAdminContext(context);
        const invitationId = asTrimmedString(data?.invitationId);
        const inviteType = asTrimmedString(data?.inviteType);
        const legacyKind = data?.kind === 'private' ? 'private' : 'public';
        const action = asTrimmedString(data?.action);

        if (!invitationId) {
            throw new functions.https.HttpsError('invalid-argument', 'invitationId is required.');
        }

        let col = 'invitations';
        if (inviteType === 'public') col = 'invitations';
        else if (inviteType === 'private' || inviteType === 'dating') col = 'private_invitations';
        else col = legacyKind === 'private' ? 'private_invitations' : 'invitations';
        const ref = db.collection(col).doc(invitationId);
        const snap = await ref.get();
        if (!snap.exists) {
            throw new functions.https.HttpsError('not-found', 'Invitation not found.');
        }

        const now = admin.firestore.FieldValue.serverTimestamp();
        const moderator = context.auth.uid;

        if (action === 'delete') {
            await ref.delete();
            return { success: true, action, invitationId };
        }

        if (action === 'block') {
            await ref.set({
                adminBlocked: true,
                adminBlockedAt: now,
                adminBlockedBy: moderator,
            }, { merge: true });
            return { success: true, action, invitationId };
        }

        if (action === 'republish') {
            await ref.set({
                adminBlocked: false,
                adminBlockedAt: null,
                adminBlockedBy: null,
                expired: false,
                republishedAt: now,
                republishedBy: moderator,
            }, { merge: true });
            return { success: true, action, invitationId };
        }

        throw new functions.https.HttpsError('invalid-argument', 'action must be delete, block, or republish.');
    });

    exportsObj.adminListReports = functions.https.onCall(async (data, context) => {
        await assertAdminContext(context);
        const status = asTrimmedString(data?.status) || 'pending';
        const allowedStatus = new Set(['pending', 'resolved', 'dismissed', 'all']);
        if (!allowedStatus.has(status)) {
            throw new functions.https.HttpsError('invalid-argument', 'Invalid status filter.');
        }

        const startAfterId = asTrimmedString(data?.startAfterId) || null;
        const pageSize = Math.min(Math.max(Number(data?.pageSize) || 25, 1), REPORTS_PAGE_MAX);

        let q;
        if (status === 'all') {
            q = db.collection('reports').orderBy('timestamp', 'desc');
        } else {
            q = db.collection('reports').where('status', '==', status).orderBy('timestamp', 'desc');
        }
        q = q.limit(pageSize + 1);
        if (startAfterId) {
            const cursor = await db.collection('reports').doc(startAfterId).get();
            if (cursor.exists) {
                q = q.startAfter(cursor);
            }
        }

        let snap;
        try {
            snap = await q.get();
        } catch (e) {
            if (status !== 'all') {
                q = db.collection('reports').where('status', '==', status).limit(pageSize + 1);
                snap = await q.get();
            } else {
                throw e;
            }
        }

        const hasNext = snap.size > pageSize;
        const docs = snap.docs.slice(0, pageSize);

        const items = docs.map((docSnap) => {
            const r = docSnap.data() || {};
            const ts = r.timestamp?.toDate?.()?.toISOString?.() || r.createdAt?.toDate?.()?.toISOString?.() || null;
            return {
                id: docSnap.id,
                type: r.type || 'unknown',
                targetId: r.targetId || '',
                targetName: r.targetName || '',
                reason: r.reason || '',
                details: (r.details || '').slice(0, 300),
                status: r.status || 'pending',
                reporterId: r.reporterId || '',
                reporterName: r.reporterName || '',
                createdAt: ts,
            };
        });

        return { items, hasNext, lastId: items.length ? items[items.length - 1].id : null };
    });
}

module.exports = { registerAdminDashboard };
