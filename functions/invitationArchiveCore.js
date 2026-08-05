/**
 * Cheap invitation archive: Firestore metadata per user + one shared thumbnail in Storage.
 * Host + guests each get `users/{uid}/invitation_archives/{invitationId}` (read-only).
 */
const admin = require('firebase-admin');
const { inferInviteCategory } = require('./inviteCategory');

const ARCHIVE_GRACE_MS = 24 * 60 * 60 * 1000;
const THUMB_PREFIX = 'invitation-archives/thumbs';

function computeEventEndDate(date, time = '20:30') {
    const base = date ? new Date(date) : new Date();
    if (Number.isNaN(base.getTime())) return new Date();

    const [hoursRaw, minutesRaw] = String(time || '20:30').split(':');
    const hours = parseInt(hoursRaw, 10);
    const minutes = parseInt(minutesRaw, 10);
    base.setHours(Number.isFinite(hours) ? hours : 20, Number.isFinite(minutes) ? minutes : 30, 0, 0);
    return base;
}

function computeArchiveAfterDate(date, time = '20:30') {
    return new Date(computeEventEndDate(date, time).getTime() + ARCHIVE_GRACE_MS);
}

function computeArchiveAfterFirestoreTimestamp(date, time) {
    return admin.firestore.Timestamp.fromDate(computeArchiveAfterDate(date, time));
}

function extractStoragePath(url) {
    if (!url || typeof url !== 'string' || !url.includes('firebasestorage') || !url.includes('/o/')) {
        return null;
    }
    try {
        return decodeURIComponent(url.split('/o/')[1].split('?')[0]);
    } catch {
        return null;
    }
}

function isFirebaseStorageUrl(url) {
    return typeof url === 'string' && url.includes('firebasestorage.googleapis.com');
}

function buildArchiveThumbnailUrl(bucketName, destPath) {
    return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(destPath)}?alt=media`;
}

function isPublicInvitationDoc(inv) {
    if (!inv || typeof inv !== 'object') return false;
    if (inv.privacy === 'private') return false;
    if (inv.type === 'Social' || inv.type === 'Private') return false;
    if (inv.status === 'draft') return false;
    return true;
}

function isDueForArchive(inv, nowMs, { allowDraft = false } = {}) {
    if (!inv || typeof inv !== 'object') return false;
    if (!allowDraft && inv.status === 'draft') return false;

    if (inv.archiveAfterAt?.toMillis) {
        return inv.archiveAfterAt.toMillis() <= nowMs;
    }
    return computeArchiveAfterDate(inv.date, inv.time).getTime() <= nowMs;
}

function resolveArchiveKind(collectionName, invData) {
    if (collectionName === 'invitations') return 'public';
    const cat = inferInviteCategory(invData, 'private');
    return cat === 'private' ? 'private' : 'social';
}

function resolveParticipants(invData, kind) {
    const hostId = String(
        invData.author?.id || invData.authorId || invData.hostId || ''
    ).trim();
    const guestIds = new Set();

    if (kind === 'public') {
        (Array.isArray(invData.joined) ? invData.joined : []).forEach((uid) => {
            const id = String(uid || '').trim();
            if (id && id !== hostId) guestIds.add(id);
        });
    } else {
        (Array.isArray(invData.invitedFriends) ? invData.invitedFriends : []).forEach((uid) => {
            const id = String(uid || '').trim();
            if (id && id !== hostId) guestIds.add(id);
        });
        const rsvps = invData.rsvps && typeof invData.rsvps === 'object' ? invData.rsvps : {};
        Object.entries(rsvps).forEach(([uid, status]) => {
            const id = String(uid || '').trim();
            if (!id || id === hostId) return;
            const s = String(status || '').toLowerCase();
            if (s === 'accepted' || s === 'going' || s === 'yes' || s === true) {
                guestIds.add(id);
            }
        });
    }

    return { hostId, guestIds: [...guestIds] };
}

function getMessageMediaUrls(data) {
    if (!data) return [];
    const urls = [];
    ['imageUrl', 'audioUrl', 'fileUrl'].forEach((field) => {
        const value = data[field];
        if (value && isFirebaseStorageUrl(value)) urls.push(value);
    });
    if (data.attachment?.url && isFirebaseStorageUrl(data.attachment.url)) {
        urls.push(data.attachment.url);
    }
    return urls;
}

function collectDeletableMediaUrls(invData, keepThumbnailUrl) {
    const urls = [];
    const fields = [
        'customImage',
        'customVideo',
        'image',
        'restaurantImage',
        'cardImageUrl',
        'videoThumbnail',
        'listThumbnailUrl',
    ];
    fields.forEach((field) => {
        const value = invData[field];
        if (!value || typeof value !== 'string') return;
        if (keepThumbnailUrl && value === keepThumbnailUrl) return;
        if (isFirebaseStorageUrl(value)) urls.push(value);
    });
    return [...new Set(urls)];
}

/**
 * One small thumb per invitation (shared by all user archive docs).
 */
async function resolveArchiveThumbnail(bucket, invId, invData) {
    const pathsToDelete = [];
    const listThumb = invData.listThumbnailUrl || invData.videoThumbnail || invData.cardImageUrl || null;
    if (listThumb && isFirebaseStorageUrl(listThumb)) {
        return { thumbnailUrl: listThumb, storagePathsToDelete: pathsToDelete };
    }
    if (listThumb && !isFirebaseStorageUrl(listThumb)) {
        return { thumbnailUrl: listThumb, storagePathsToDelete: pathsToDelete };
    }

    const mainImage =
        invData.customImage ||
        invData.image ||
        invData.restaurantImage ||
        invData.cardImageUrl ||
        null;
    const mainPath = extractStoragePath(mainImage);
    if (!mainPath) {
        return { thumbnailUrl: null, storagePathsToDelete: pathsToDelete };
    }

    const ext = mainPath.includes('.') ? mainPath.split('.').pop() : 'jpg';
    const destPath = `${THUMB_PREFIX}/${invId}.${ext}`;
    try {
        await bucket.file(mainPath).copy(bucket.file(destPath));
        pathsToDelete.push(mainPath);
        return {
            thumbnailUrl: buildArchiveThumbnailUrl(bucket.name, destPath),
            storagePathsToDelete: pathsToDelete,
        };
    } catch (err) {
        console.warn('Archive thumb copy failed', invId, err.message);
        return { thumbnailUrl: mainImage, storagePathsToDelete: [] };
    }
}

function buildUserArchiveDoc({
    invitationId,
    role,
    kind,
    invData,
    thumbnailUrl,
    hostId,
    eventEndAt,
}) {
    const endDate = computeEventEndDate(invData.date, invData.time);
    return {
        invitationId,
        role,
        kind,
        title: invData.title || null,
        startDate: invData.date || null,
        startTime: invData.time || null,
        endAt: eventEndAt || admin.firestore.Timestamp.fromDate(endDate),
        archivedAt: admin.firestore.FieldValue.serverTimestamp(),
        thumbnailUrl: thumbnailUrl || null,
        hostId,
        hostName: invData.author?.name || invData.authorName || null,
        location: invData.location || invData.venueName || null,
        readOnly: true,
        privacy: kind === 'public' ? 'public' : 'private',
        isArchived: true,
    };
}

async function writeUserArchiveEntries(db, { invitationId, hostId, guestIds, basePayload }) {
    if (!hostId) return;

    let batch = db.batch();
    let ops = 0;

    const commitIfNeeded = async (force = false) => {
        if (ops === 0) return;
        if (force || ops >= 400) {
            await batch.commit();
            batch = db.batch();
            ops = 0;
        }
    };

    const hostRef = db.collection('users').doc(hostId).collection('invitation_archives').doc(invitationId);
    batch.set(hostRef, { ...basePayload, role: 'host' }, { merge: false });
    ops += 1;

    for (const guestId of guestIds) {
        if (!guestId || guestId === hostId) continue;
        const guestRef = db
            .collection('users')
            .doc(guestId)
            .collection('invitation_archives')
            .doc(invitationId);
        batch.set(guestRef, { ...basePayload, role: 'guest' }, { merge: false });
        ops += 1;
        if (ops >= 400) await commitIfNeeded(true);
    }

    await commitIfNeeded(true);
}

/**
 * @param {FirebaseFirestore.Firestore} db
 * @param {import('@google-cloud/storage').Bucket} bucket
 * @param {FirebaseFirestore.QueryDocumentSnapshot} invDoc
 * @param {{ collectionName: string, kind?: string }} opts
 */
async function archiveExpiredInvitation(db, bucket, invDoc, opts) {
    const invId = invDoc.id;
    const invData = invDoc.data() || {};
    const collectionName = opts.collectionName || 'invitations';
    const kind = opts.kind || resolveArchiveKind(collectionName, invData);
    const { hostId, guestIds } = resolveParticipants(invData, kind);

    if (!hostId) {
        console.warn('archiveExpiredInvitation: missing hostId', invId, collectionName);
        return false;
    }

    const userArchiveRef = db
        .collection('users')
        .doc(hostId)
        .collection('invitation_archives')
        .doc(invId);
    const existingUserArchive = await userArchiveRef.get();

    const messagesSnap = await db.collection(collectionName).doc(invId).collection('messages').get();
    const { thumbnailUrl, storagePathsToDelete } = await resolveArchiveThumbnail(bucket, invId, invData);

    const eventEndAt =
        invData.archiveAfterAt ||
        admin.firestore.Timestamp.fromDate(computeArchiveAfterDate(invData.date, invData.time));

    const basePayload = buildUserArchiveDoc({
        invitationId: invId,
        role: 'host',
        kind,
        invData,
        thumbnailUrl,
        hostId,
        eventEndAt,
    });

    if (!existingUserArchive.exists) {
        await writeUserArchiveEntries(db, {
            invitationId: invId,
            hostId,
            guestIds,
            basePayload,
        });
    } else if (guestIds.length > 0) {
        await writeUserArchiveEntries(db, {
            invitationId: invId,
            hostId,
            guestIds,
            basePayload: existingUserArchive.data() || basePayload,
        });
    }

    const legacyArchiveRef = db.collection('invitation_archives').doc(invId);
    if (!(await legacyArchiveRef.get()).exists) {
        await legacyArchiveRef.set({
            ...basePayload,
            source: `${kind}_expired`,
            invitationId: invId,
            joinedCount: guestIds.length,
        });
    }

    const deleteUrls = collectDeletableMediaUrls(invData, thumbnailUrl);
    messagesSnap.docs.forEach((docSnap) => {
        deleteUrls.push(...getMessageMediaUrls(docSnap.data()));
    });

    const paths = [
        ...new Set([
            ...deleteUrls.map(extractStoragePath).filter(Boolean),
            ...storagePathsToDelete,
        ]),
    ];
    const keepPath = extractStoragePath(thumbnailUrl);
    for (const path of paths) {
        if (keepPath && path === keepPath) continue;
        if (path.startsWith(`${THUMB_PREFIX}/`)) continue;
        try {
            await bucket.file(path).delete();
        } catch (err) {
            if (err.code !== 404) console.warn('Storage delete failed:', path, err.message);
        }
    }

    const batch = db.batch();
    messagesSnap.docs.forEach((docSnap) => batch.delete(docSnap.ref));
    batch.delete(invDoc.ref);
    await batch.commit();
    return true;
}

/**
 * @param {FirebaseFirestore.Firestore} db
 * @param {string} collectionName
 * @param {(inv: Record<string, unknown>) => boolean} [predicate]
 */
async function runArchiveDueInvitations(db, collectionName, predicate) {
    const bucket = admin.storage().bucket();
    const nowMs = Date.now();
    const cutoffTs = admin.firestore.Timestamp.fromMillis(nowMs);
    const processed = new Set();
    let count = 0;

    try {
        const dueSnap = await db
            .collection(collectionName)
            .where('archiveAfterAt', '<=', cutoffTs)
            .limit(40)
            .get();

        for (const invDoc of dueSnap.docs) {
            const invData = invDoc.data() || {};
            if (predicate && !predicate(invData)) continue;
            if (!isDueForArchive(invData, nowMs)) continue;
            const kind = resolveArchiveKind(collectionName, invData);
            await archiveExpiredInvitation(db, bucket, invDoc, { collectionName, kind });
            processed.add(invDoc.id);
            count += 1;
        }
    } catch (err) {
        console.warn(`runArchiveDueInvitations indexed scan failed (${collectionName})`, err.message);
    }

    const legacySnap = await db.collection(collectionName).limit(120).get();
    for (const invDoc of legacySnap.docs) {
        if (processed.has(invDoc.id)) continue;
        const invData = invDoc.data() || {};
        if (invData.archiveAfterAt) continue;
        if (predicate && !predicate(invData)) continue;
        if (!isDueForArchive(invData, nowMs)) continue;
        const kind = resolveArchiveKind(collectionName, invData);
        await archiveExpiredInvitation(db, bucket, invDoc, { collectionName, kind });
        count += 1;
    }

    console.log(`runArchiveDueInvitations(${collectionName}): archived ${count} invitation(s).`);
    return count;
}

async function runArchiveExpiredPublicInvitations(db) {
    return runArchiveDueInvitations(db, 'invitations', isPublicInvitationDoc);
}

async function runArchiveExpiredSocialInvitations(db) {
    let count = 0;
    count += await runArchiveDueInvitations(
        db,
        'social_invitations',
        (inv) => inv.status === 'published' || inv.publishedAt
    );
    count += await runArchiveDueInvitations(
        db,
        'private_invitations',
        (inv) => inv.status === 'published' || inv.publishedAt
    );
    return count;
}

module.exports = {
    ARCHIVE_GRACE_MS,
    computeEventEndDate,
    computeArchiveAfterDate,
    computeArchiveAfterFirestoreTimestamp,
    runArchiveExpiredPublicInvitations,
    runArchiveExpiredSocialInvitations,
    archiveExpiredInvitation,
    isDueForArchive,
    isPublicInvitationDoc,
};
