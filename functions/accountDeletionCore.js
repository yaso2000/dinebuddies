/**
 * Shared account deletion cascade: owned invites, posts, stages, chats, storage, Auth.
 * Safe to re-run (idempotent) — used by deleteMyAccount, adminDeleteUser, auth.onDelete,
 * AND the personal→business conversion in the Vercel API layer. It therefore must NOT
 * depend on firebase-functions (uses console for logging) so it stays portable.
 */
const log = {
    warn: (msg, obj) => console.warn(`[accountDeletion] ${msg}`, obj || ''),
    info: (msg, obj) => console.info(`[accountDeletion] ${msg}`, obj || ''),
    error: (msg, obj) => console.error(`[accountDeletion] ${msg}`, obj || ''),
};

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
        log.warn('accountDeletion storage prefix', { prefix, message: err.message });
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
            log.warn('accountDeletion query failed', {
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
    // stageRooms is a functions/-only module; in the API bundle it may be absent,
    // so load it defensively and fall back to a plain recursive delete of the stage.
    let purgeStageRoom = null;
    try {
        ({ purgeStageRoom } = require('./stageRooms'));
    } catch {
        purgeStageRoom = null;
    }
    let deleted = 0;
    const hostFields = ['hostId', 'ownerId', 'authorId'];
    const seen = new Set();
    for (const field of hostFields) {
        let snap;
        try {
            snap = await db.collection('stages').where(field, '==', uid).get();
        } catch (err) {
            log.warn('accountDeletion stages query', { field, message: err.message });
            continue;
        }
        for (const stageDoc of snap.docs) {
            if (seen.has(stageDoc.id)) continue;
            seen.add(stageDoc.id);
            try {
                await purgeStageRoom(db, admin, stageDoc.id, stageDoc.data() || {});
                deleted += 1;
            } catch (err) {
                log.warn('accountDeletion purgeStageRoom', {
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
        log.warn('accountDeletion conversations', { message: err.message });
        return 0;
    }
    for (const convDoc of snap.docs) {
        await tryRecursiveDelete(db, convDoc.ref);
        deleted += 1;
    }
    return deleted;
}

/**
 * Remove this uid from every OTHER user's `following` / `followers` arrays, so no
 * phantom follow edge points at the deleted account. Uses arrayRemove in batches.
 */
async function purgeFollowEdgesForUser(db, admin, uid) {
    const FieldValue = admin.firestore.FieldValue;
    let cleaned = 0;
    for (const field of ['following', 'followers']) {
        let snap;
        try {
            snap = await db.collection('users').where(field, 'array-contains', uid).get();
        } catch (err) {
            log.warn('accountDeletion follow edges', { field, message: err.message });
            continue;
        }
        for (let i = 0; i < snap.docs.length; i += 400) {
            const batch = db.batch();
            for (const d of snap.docs.slice(i, i + 400)) {
                batch.update(d.ref, { [field]: FieldValue.arrayRemove(uid) });
            }
            await batch.commit();
            cleaned += Math.min(400, snap.docs.length - i);
        }
    }
    return cleaned;
}

/** Delete docs where an ARRAY field contains the uid (e.g. legacy chats participants). */
async function deleteByArrayContains(db, collectionName, field, uid, { withMessages = false } = {}) {
    let deleted = 0;
    let snap;
    try {
        snap = await db.collection(collectionName).where(field, 'array-contains', uid).get();
    } catch (err) {
        log.warn('accountDeletion array-contains', { collectionName, field, message: err.message });
        return 0;
    }
    for (const d of snap.docs) {
        if (withMessages) await tryRecursiveDelete(db, d.ref);
        else await d.ref.delete();
        deleted += 1;
    }
    return deleted;
}

/**
 * Delete docs across ALL subcollections of a given name where field == uid
 * (e.g. a user's votes/answers left inside OTHER people's posts/games).
 * Needs a collection-group index; failure is logged and skipped, never fatal.
 */
async function deleteCollectionGroupByField(db, groupName, field, uid) {
    let deleted = 0;
    let snap;
    try {
        snap = await db.collectionGroup(groupName).where(field, '==', uid).get();
    } catch (err) {
        log.warn('accountDeletion collectionGroup', { groupName, field, message: err.message });
        return 0;
    }
    for (let i = 0; i < snap.docs.length; i += 200) {
        const batch = db.batch();
        for (const d of snap.docs.slice(i, i + 200)) batch.delete(d.ref);
        await batch.commit();
        deleted += Math.min(200, snap.docs.length - i);
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
        followEdges: 0,
        discoveryLikes: 0,
        discoveryGreetings: 0,
        comments: 0,
        likes: 0,
        businessLikes: 0,
        reviews: 0,
        suitabilityPosts: 0,
        suitabilityVotes: 0,
        groupGames: 0,
        gameAnswers: 0,
        legacyChats: 0,
        welcomeGifts: 0,
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

    // Follow edges: remove this uid from everyone else's following/followers arrays.
    stats.followEdges = await purgeFollowEdgesForUser(db, admin, uid);

    // Discovery (dating) likes + greetings — both directions.
    stats.discoveryLikes += await deleteByFieldQueries(db, 'discovery_likes', [
        ['targetUserId', uid],
        ['likerId', uid],
    ]);
    stats.discoveryGreetings += await deleteByFieldQueries(db, 'discovery_greetings', [
        ['targetUserId', uid],
        ['senderId', uid],
    ]);

    // Comments authored by the user.
    stats.comments += await deleteByFieldQueries(db, 'comments', [
        ['userId', uid],
        ['authorId', uid],
    ]);

    // Post likes authored by the user (defensive across possible field names).
    stats.likes += await deleteByFieldQueries(db, 'likes', [
        ['userId', uid],
        ['likerId', uid],
        ['uid', uid],
    ]);

    // Business likes + reviews by the user.
    stats.businessLikes += await deleteByFieldQueries(db, 'businessLikes', [
        ['userId', uid],
        ['likerId', uid],
        ['uid', uid],
    ]);
    stats.reviews += await deleteByFieldQueries(db, 'reviews', [
        ['userId', uid],
        ['authorId', uid],
        ['uid', uid],
    ]);

    // "Who suits you?" posts owned by the user (+ their votes subcollection).
    stats.suitabilityPosts += await deleteByFieldQueries(
        db,
        'suitability_posts',
        [['ownerId', uid]],
        { withMessages: true }
    );
    // Votes this user cast on OTHER people's suitability posts.
    stats.suitabilityVotes = await deleteCollectionGroupByField(db, 'votes', 'uid', uid);

    // Group games hosted by the user (+ answers subcollection).
    stats.groupGames += await deleteByFieldQueries(
        db,
        'group_games',
        [['hostId', uid]],
        { withMessages: true }
    );
    // Answers this user submitted in OTHER people's games.
    stats.gameAnswers = await deleteCollectionGroupByField(db, 'answers', 'uid', uid);

    // Legacy 1:1 chats keyed by participants array.
    stats.legacyChats = await deleteByArrayContains(db, 'chats', 'participants', uid, { withMessages: true });

    // Welcome-gift claim record (doc id = uid, plus defensive field query).
    try {
        const wgRef = db.collection('welcome_gifts_claimed').doc(uid);
        const wgSnap = await wgRef.get();
        if (wgSnap.exists) { await wgRef.delete(); stats.welcomeGifts += 1; }
    } catch (err) {
        log.warn('accountDeletion welcome gift', { message: err.message });
    }
    stats.welcomeGifts += await deleteByFieldQueries(db, 'welcome_gifts_claimed', [
        ['userId', uid],
        ['uid', uid],
    ]);

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
                log.warn('accountDeletion auth delete', { uid, message: err.message });
            }
        }
    }

    log.info('accountDeletion purge complete', { uid, stats });
    return stats;
}

module.exports = {
    purgeUserAccountData,
    deleteQueryInBatches,
};
