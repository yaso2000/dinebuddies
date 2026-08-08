/**
 * Shared account deletion cascade: owned invites, posts, stages, chats, storage, Auth.
 * Safe to re-run (idempotent) — used by deleteMyAccount, adminDeleteUser, and auth.onDelete.
 */
const functions = require('firebase-functions');

async function deleteQueryInBatches(db, queryRef, batchSize = 200) {
    let deleted = 0;
    while (true) {
        const snap = await queryRef.limit(batchSize).get();
        if (snap.empty) break;
        const batch = db.batch();
        snap.docs.forEach((d) => batch.delete(d.ref));
        await batch.commit();
        deleted += snap.size;
        if (snap.size < batchSize) break;
    }
    return deleted;
}

async function deleteStoragePrefix(admin, prefix) {
    if (!prefix) return 0;
    try {
        const bucket = admin.storage().bucket();
        await bucket.deleteFiles({ prefix, force: true });
        return 1;
    } catch (err) {
        functions.logger.warn('accountDeletion storage prefix', { prefix, message: err.message });
        return 0;
    }
}

async function tryRecursiveDelete(db, ref) {
    if (typeof db.recursiveDelete === 'function') {
        await db.recursiveDelete(ref);
        return;
    }
    // Fallback: delete known messages subcollection then the doc.
    try {
        await deleteQueryInBatches(db, ref.collection('messages'));
    } catch {
        /* no messages subcollection */
    }
    const snap = await ref.get();
    if (snap.exists) await ref.delete();
}

/**
 * Delete all docs matching any of the field equality queries (union by doc id).
 */
async function deleteByFieldQueries(db, collectionName, fieldValues, { withMessages = false } = {}) {
    const seen = new Set();
    let deleted = 0;
    for (const [field, value] of fieldValues) {
        if (value == null || value === '') continue;
        let snap;
        try {
            snap = await db.collection(collectionName).where(field, '==', value).get();
        } catch (err) {
            functions.logger.warn('accountDeletion query failed', {
                collectionName,
                field,
                message: err.message,
            });
            continue;
        }
        for (const docSnap of snap.docs) {
            if (seen.has(docSnap.id)) continue;
            seen.add(docSnap.id);
            if (withMessages) {
                await tryRecursiveDelete(db, docSnap.ref);
            } else {
                await docSnap.ref.delete();
            }
            deleted += 1;
        }
    }
    return deleted;
}

async function purgeOwnedStages(db, admin, uid) {
    const { purgeStageRoom } = require('./stageRooms');
    let deleted = 0;
    const hostFields = ['hostId', 'ownerId', 'authorId'];
    const seen = new Set();
    for (const field of hostFields) {
        let snap;
        try {
            snap = await db.collection('stages').where(field, '==', uid).get();
        } catch (err) {
            functions.logger.warn('accountDeletion stages query', { field, message: err.message });
            continue;
        }
        for (const stageDoc of snap.docs) {
            if (seen.has(stageDoc.id)) continue;
            seen.add(stageDoc.id);
            try {
                await purgeStageRoom(db, admin, stageDoc.id, stageDoc.data() || {});
                deleted += 1;
            } catch (err) {
                functions.logger.warn('accountDeletion purgeStageRoom', {
                    stageId: stageDoc.id,
                    message: err.message,
                });
                await tryRecursiveDelete(db, stageDoc.ref);
                deleted += 1;
            }
        }
    }
    return deleted;
}

async function purgeConversationsForUser(db, uid) {
    let deleted = 0;
    let snap;
    try {
        snap = await db.collection('conversations').where('participants', 'array-contains', uid).get();
    } catch (err) {
        functions.logger.warn('accountDeletion conversations', { message: err.message });
        return 0;
    }
    for (const convDoc of snap.docs) {
        await tryRecursiveDelete(db, convDoc.ref);
        deleted += 1;
    }
    return deleted;
}

async function purgeUserAccountData(admin, uid, { deleteAuthUser = true } = {}) {
    const db = admin.firestore();
    const stats = {
        invitations: 0,
        socialInvitations: 0,
        privateInvitations: 0,
        communityPosts: 0,
        featuredPosts: 0,
        motionPosts: 0,
        stories: 0,
        notifications: 0,
        partnerNotifications: 0,
        stages: 0,
        restaurants: 0,
        conversations: 0,
        legacyArchives: 0,
        userDoc: 0,
        publicProfile: 0,
        storagePrefixes: 0,
        authUser: 0,
    };

    if (!uid || typeof uid !== 'string') {
        return stats;
    }

    // Public / classic invitations (author.id | hostId | authorId)
    stats.invitations += await deleteByFieldQueries(
        db,
        'invitations',
        [
            ['author.id', uid],
            ['hostId', uid],
            ['authorId', uid],
        ],
        { withMessages: true }
    );

    stats.socialInvitations += await deleteByFieldQueries(
        db,
        'social_invitations',
        [
            ['authorId', uid],
            ['hostId', uid],
            ['author.id', uid],
        ],
        { withMessages: true }
    );

    stats.privateInvitations += await deleteByFieldQueries(
        db,
        'private_invitations',
        [
            ['authorId', uid],
            ['hostId', uid],
            ['author.id', uid],
        ],
        { withMessages: true }
    );

    stats.communityPosts += await deleteByFieldQueries(db, 'communityPosts', [
        ['authorId', uid],
        ['partnerId', uid],
        ['userId', uid],
        ['uid', uid],
    ]);

    stats.featuredPosts += await deleteByFieldQueries(db, 'featured_posts', [
        ['authorId', uid],
        ['partnerId', uid],
        ['userId', uid],
    ]);

    stats.motionPosts += await deleteByFieldQueries(db, 'business_motion_posts', [
        ['authorId', uid],
        ['partnerId', uid],
        ['userId', uid],
    ]);

    stats.stories += await deleteByFieldQueries(db, 'stories', [
        ['authorId', uid],
        ['userId', uid],
        ['uid', uid],
    ]);

    // Top-level legacy archives (per-user archives live under users/{uid}/… and go with recursive user delete)
    stats.legacyArchives += await deleteByFieldQueries(db, 'invitation_archives', [
        ['authorId', uid],
        ['hostId', uid],
        ['userId', uid],
    ]);

    stats.notifications += await deleteByFieldQueries(db, 'notifications', [
        ['userId', uid],
        ['toUserId', uid],
        ['recipientId', uid],
        ['fromUserId', uid],
        ['senderId', uid],
        ['uid', uid],
    ]);

    stats.partnerNotifications += await deleteByFieldQueries(db, 'partner_notifications', [
        ['partnerId', uid],
        ['userId', uid],
        ['toUserId', uid],
        ['fromUserId', uid],
    ]);

    stats.stages = await purgeOwnedStages(db, admin, uid);

    stats.restaurants += await deleteByFieldQueries(
        db,
        'restaurants',
        [
            ['ownerId', uid],
            ['claimedBy', uid],
            ['partnerId', uid],
        ],
        { withMessages: true }
    );

    stats.conversations = await purgeConversationsForUser(db, uid);

    // Storage owned by this user
    const prefixes = [
        `users/${uid}/`,
        `avatars/${uid}/`,
        `profiles/${uid}/`,
        `chat_images/${uid}/`,
        `chat_files/${uid}/`,
        `voice_messages/${uid}/`,
        `communityPosts/${uid}/`,
        `featured_posts/${uid}/`,
        `business_motion_posts/${uid}/`,
        `stories/${uid}/`,
        `invitations/${uid}/`,
        `social_invitations/${uid}/`,
        `stages/${uid}/`,
        `ai/${uid}/`,
    ];
    for (const prefix of prefixes) {
        stats.storagePrefixes += await deleteStoragePrefix(admin, prefix);
    }

    // public_profiles + users (subcollections: invitation_archives, friends, devices, etc.)
    const publicRef = db.collection('public_profiles').doc(uid);
    const publicSnap = await publicRef.get();
    if (publicSnap.exists) {
        await publicRef.delete();
        stats.publicProfile = 1;
    }

    const userRef = db.collection('users').doc(uid);
    const userSnap = await userRef.get();
    if (userSnap.exists) {
        await tryRecursiveDelete(db, userRef);
        stats.userDoc = 1;
    }

    if (deleteAuthUser) {
        try {
            await admin.auth().deleteUser(uid);
            stats.authUser = 1;
        } catch (err) {
            if (err?.code !== 'auth/user-not-found') {
                functions.logger.warn('accountDeletion auth delete', { uid, message: err.message });
            }
        }
    }

    functions.logger.info('accountDeletion purge complete', { uid, stats });
    return stats;
}

module.exports = {
    purgeUserAccountData,
    deleteQueryInBatches,
};
