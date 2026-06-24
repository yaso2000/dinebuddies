/**
 * Admin dashboard callables — moderation, credits, invitations (server-trusted).
 */
const functions = require('firebase-functions');
const { grantFreeCreditsInTransaction } = require('./creditsCore');
const { inferInviteCategory } = require('./inviteCategory');
const {
    DEMO_COUNT_MAX,
    buildDemoCityId,
    createDemoUsers,
    createDemoUser,
    wipeDemoUsers,
    deleteDemoUser,
    listDemoCitySummaries,
    listDemoUserProfiles,
} = require('./demoUsersCore');

const INVITE_PAGE_MAX = 50;
const INVITE_SCAN_MAX = 2500;
const REPORTS_PAGE_MAX = 50;
const POSTS_PAGE_MAX = 50;
const BUSINESSES_PAGE_MAX = 50;

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
                'social_invitations',
                'private',
                (_d, cat) => cat === 'private',
                startAfterId,
                pageSize
            );
        }

        if (inviteTypeFilter === 'dating') {
            return listInvitationsPage(
                db,
                'social_invitations',
                'private',
                (_d, cat) => cat === 'dating',
                startAfterId,
                pageSize
            );
        }

        const half = Math.ceil(pageSize / 2);
        const [pub, priv] = await Promise.all([
            listInvitationsPage(db, 'invitations', 'public', null, null, half),
            listInvitationsPage(db, 'social_invitations', 'private', null, null, half),
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
        const legacyKind = data?.kind === 'social' ? 'private' : 'public';
        const action = asTrimmedString(data?.action);

        if (!invitationId) {
            throw new functions.https.HttpsError('invalid-argument', 'invitationId is required.');
        }

        let col = 'invitations';
        if (inviteType === 'public') col = 'invitations';
        else if (inviteType === 'private' || inviteType === 'dating') col = 'social_invitations';
        else col = legacyKind === 'private' ? 'social_invitations' : 'invitations';
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

    function postCreatedAtIso(data) {
        const fields = ['publishedAt', 'createdAt', 'updatedAt'];
        for (const field of fields) {
            const iso = data?.[field]?.toDate?.()?.toISOString?.();
            if (iso) return iso;
        }
        return null;
    }

    function postPreviewFromData(data) {
        const title = data?.title;
        const titleText = title && typeof title === 'object' ? title.text : title;
        const desc = data?.description;
        const descText = desc && typeof desc === 'object' ? desc.text : desc;
        const content = data?.content;
        const contentTitle = content && typeof content === 'object' ? content.title : null;
        const contentDesc = content && typeof content === 'object' ? content.description : null;
        return String(
            titleText ||
            descText ||
            contentTitle ||
            contentDesc ||
            data?.text ||
            data?.caption ||
            (typeof data?.content === 'string' ? data.content : '') ||
            ''
        ).slice(0, 140);
    }

    /**
     * @param {FirebaseFirestore.Firestore} db
     * @param {string} field
     * @param {string} id
     */
    async function deleteCommunityMirrors(db, field, id) {
        const mirrors = await db.collection('communityPosts')
            .where(field, '==', id)
            .limit(50)
            .get();
        await Promise.all(mirrors.docs.map((docSnap) => docSnap.ref.delete()));
    }

    /**
     * @param {FirebaseFirestore.Firestore} db
     * @param {typeof import('firebase-admin')} admin
     * @param {string} featuredId
     */
    async function retireFeaturedPost(db, admin, featuredId) {
        try {
            await db.collection('featured_posts').doc(featuredId).delete();
        } catch {
            try {
                await db.collection('featured_posts').doc(featuredId).set(
                    { status: 'draft', updatedAt: admin.firestore.FieldValue.serverTimestamp() },
                    { merge: true }
                );
            } catch {
                /* ignore */
            }
        }
        await deleteCommunityMirrors(db, 'featuredPostId', featuredId);
    }

    /**
     * @param {FirebaseFirestore.Firestore} db
     * @param {typeof import('firebase-admin')} admin
     * @param {string} motionId
     */
    async function retireMotionPost(db, admin, motionId) {
        try {
            await db.collection('business_motion_posts').doc(motionId).delete();
        } catch {
            try {
                await db.collection('business_motion_posts').doc(motionId).set(
                    { status: 'draft', updatedAt: admin.firestore.FieldValue.serverTimestamp() },
                    { merge: true }
                );
            } catch {
                /* ignore */
            }
        }
        await deleteCommunityMirrors(db, 'motionPostId', motionId);
    }

    /**
     * Delete a feed post and related featured/motion documents (admin panel).
     * @param {FirebaseFirestore.Firestore} db
     * @param {typeof import('firebase-admin')} admin
     * @param {string} postId
     */
    async function adminDeletePostCascade(db, admin, postId) {
        const postRef = db.collection('communityPosts').doc(postId);
        const snap = await postRef.get();
        if (!snap.exists) {
            throw new functions.https.HttpsError('not-found', 'Post not found.');
        }

        const d = snap.data() || {};
        const featuredId = d.featuredPostId ? String(d.featuredPostId) : null;
        const motionId = d.motionPostId ? String(d.motionPostId) : null;

        await postRef.delete();

        if (featuredId) {
            await retireFeaturedPost(db, admin, featuredId);
        }

        if (motionId) {
            await retireMotionPost(db, admin, motionId);
        }
    }

    /**
     * @param {FirebaseFirestore.Firestore} db
     * @param {typeof import('firebase-admin')} admin
     * @param {string} rawPostId
     * @param {'community'|'featured'|'motion'|string} [hintedSource]
     */
    async function adminDeletePostAny(db, admin, rawPostId, hintedSource) {
        let postId = asTrimmedString(rawPostId);
        if (!postId) {
            throw new functions.https.HttpsError('invalid-argument', 'postId is required.');
        }
        if (postId.startsWith('motion_')) {
            postId = postId.slice('motion_'.length);
        }

        const checkOrder = ['featured', 'motion', 'community'];
        if (hintedSource && checkOrder.includes(hintedSource)) {
            const idx = checkOrder.indexOf(hintedSource);
            checkOrder.splice(idx, 1);
            checkOrder.unshift(hintedSource);
        }

        for (const source of checkOrder) {
            if (source === 'featured') {
                const snap = await db.collection('featured_posts').doc(postId).get();
                if (snap.exists) {
                    await retireFeaturedPost(db, admin, postId);
                    return { source: 'featured', postId };
                }
            }
            if (source === 'motion') {
                const snap = await db.collection('business_motion_posts').doc(postId).get();
                if (snap.exists) {
                    await retireMotionPost(db, admin, postId);
                    return { source: 'motion', postId };
                }
            }
            if (source === 'community') {
                const snap = await db.collection('communityPosts').doc(postId).get();
                if (snap.exists) {
                    await adminDeletePostCascade(db, admin, postId);
                    return { source: 'community', postId };
                }
            }
        }

        const [featuredMirrors, motionMirrors] = await Promise.all([
            db.collection('communityPosts').where('featuredPostId', '==', postId).limit(20).get(),
            db.collection('communityPosts').where('motionPostId', '==', postId).limit(20).get(),
        ]);

        if (!featuredMirrors.empty) {
            await Promise.all(featuredMirrors.docs.map((docSnap) => docSnap.ref.delete()));
            try {
                await db.collection('featured_posts').doc(postId).delete();
            } catch {
                /* canonical may already be gone */
            }
            return { source: 'featured', postId, cleanedMirrors: featuredMirrors.size };
        }

        if (!motionMirrors.empty) {
            await Promise.all(motionMirrors.docs.map((docSnap) => docSnap.ref.delete()));
            try {
                await db.collection('business_motion_posts').doc(postId).delete();
            } catch {
                /* canonical may already be gone */
            }
            return { source: 'motion', postId, cleanedMirrors: motionMirrors.size };
        }

        throw new functions.https.HttpsError('not-found', 'Post not found.');
    }

    /**
     * @param {FirebaseFirestore.Firestore} db
     * @param {string} collectionName
     * @param {string} orderField
     * @param {number} limit
     */
    async function queryPostsCollection(db, collectionName, orderField, limit) {
        let q = db.collection(collectionName).orderBy(orderField, 'desc').limit(limit);
        try {
            return await q.get();
        } catch {
            return db.collection(collectionName).limit(limit).get();
        }
    }

    function mapCommunityAdminPost(docSnap) {
        const p = docSnap.data() || {};
        const authorId =
            p.partnerId || p.authorId || p.userId || p.uid || p.author?.id || '';
        const authorName =
            p.authorName || p.author?.name || p.partnerName || p.displayName || p.businessName || '';
        return {
            id: docSnap.id,
            source: 'community',
            preview: postPreviewFromData(p) || '—',
            authorId: String(authorId),
            authorName: String(authorName).slice(0, 80),
            type: p.type || p.postType || 'post',
            status: p.status || 'published',
            createdAt: postCreatedAtIso(p),
            featuredPostId: p.featuredPostId ? String(p.featuredPostId) : null,
            motionPostId: p.motionPostId ? String(p.motionPostId) : null,
        };
    }

    function mapFeaturedAdminPost(docSnap) {
        const p = docSnap.data() || {};
        const authorId = p.partnerId || p.authorId || p.businessId || '';
        return {
            id: docSnap.id,
            source: 'featured',
            preview: postPreviewFromData(p) || '—',
            authorId: String(authorId),
            authorName: String(p.businessName || p.partnerName || '').slice(0, 80),
            type: p.type || 'elite_slide',
            status: p.status || 'published',
            createdAt: postCreatedAtIso(p),
            featuredPostId: docSnap.id,
            motionPostId: null,
        };
    }

    function mapMotionAdminPost(docSnap) {
        const p = docSnap.data() || {};
        const authorId = p.ownerId || p.businessId || p.partnerId || '';
        return {
            id: docSnap.id,
            source: 'motion',
            preview: postPreviewFromData(p) || '—',
            authorId: String(authorId),
            authorName: String(p.businessName || p.partnerName || '').slice(0, 80),
            type: p.type || p.postType || 'motion_post',
            status: p.status || 'published',
            createdAt: postCreatedAtIso(p),
            featuredPostId: null,
            motionPostId: docSnap.id,
        };
    }

    function isPostOlderThanCursor(item, cursor) {
        if (!cursor?.createdAt) return true;
        const itemTs = new Date(item.createdAt || 0).getTime();
        const cursorTs = new Date(cursor.createdAt).getTime();
        if (itemTs < cursorTs) return true;
        if (itemTs > cursorTs) return false;
        if (item.source !== cursor.source) {
            return String(item.id).localeCompare(String(cursor.id)) < 0;
        }
        return String(item.id).localeCompare(String(cursor.id)) < 0;
    }

    exportsObj.adminListPosts = functions.https.onCall(async (data, context) => {
        await assertAdminContext(context);
        const pageSize = Math.min(Math.max(Number(data?.pageSize) || 25, 1), POSTS_PAGE_MAX);
        const startAfterId = asTrimmedString(data?.startAfterId) || null;
        const startAfterSource = asTrimmedString(data?.startAfterSource) || null;
        const startAfterCreatedAt = asTrimmedString(data?.startAfterCreatedAt) || null;
        const cursor = startAfterId && startAfterSource
            ? { id: startAfterId, source: startAfterSource, createdAt: startAfterCreatedAt }
            : null;

        const scanLimit = Math.min(pageSize * 4, 200);
        const [communitySnap, featuredSnap, motionSnap] = await Promise.all([
            queryPostsCollection(db, 'communityPosts', 'createdAt', scanLimit),
            queryPostsCollection(db, 'featured_posts', 'createdAt', scanLimit),
            queryPostsCollection(db, 'business_motion_posts', 'publishedAt', scanLimit)
                .catch(() => queryPostsCollection(db, 'business_motion_posts', 'createdAt', scanLimit)),
        ]);

        const featuredIds = new Set(featuredSnap.docs.map((d) => d.id));
        const motionIds = new Set(motionSnap.docs.map((d) => d.id));

        const communityItems = communitySnap.docs
            .map(mapCommunityAdminPost)
            .filter((item) => {
                if (item.featuredPostId && featuredIds.has(item.featuredPostId)) return false;
                if (item.motionPostId && motionIds.has(item.motionPostId)) return false;
                return true;
            });

        const featuredItems = featuredSnap.docs.map(mapFeaturedAdminPost);
        const motionItems = motionSnap.docs.map(mapMotionAdminPost);

        const merged = [...communityItems, ...featuredItems, ...motionItems]
            .filter((item) => isPostOlderThanCursor(item, cursor))
            .sort((a, b) => {
                const aTs = new Date(a.createdAt || 0).getTime();
                const bTs = new Date(b.createdAt || 0).getTime();
                if (bTs !== aTs) return bTs - aTs;
                return String(b.id).localeCompare(String(a.id));
            });

        const page = merged.slice(0, pageSize);
        const hasNext = merged.length > pageSize;
        const last = page.length ? page[page.length - 1] : null;

        const items = page.map((item) => ({
            id: item.id,
            source: item.source,
            preview: item.preview,
            authorId: item.authorId,
            authorName: item.authorName,
            type: item.type,
            status: item.status,
            createdAt: item.createdAt,
        }));

        return {
            items,
            hasNext,
            lastId: last?.id || null,
            lastSource: last?.source || null,
            lastCreatedAt: last?.createdAt || null,
        };
    });

    exportsObj.adminModeratePost = functions.https.onCall(async (data, context) => {
        await assertAdminContext(context);
        const postId = asTrimmedString(data?.postId);
        const action = asTrimmedString(data?.action);
        const sourceRaw = asTrimmedString(data?.source) || 'community';
        const source = ['community', 'featured', 'motion'].includes(sourceRaw) ? sourceRaw : 'community';

        if (!postId) {
            throw new functions.https.HttpsError('invalid-argument', 'postId is required.');
        }
        if (action !== 'delete') {
            throw new functions.https.HttpsError('invalid-argument', 'action must be delete.');
        }

        await adminDeletePostAny(db, admin, postId, source);
        return { success: true, action, postId, source };
    });

    /**
     * @param {FirebaseFirestore.Firestore} db
     * @param {string} businessId
     */
    async function deleteReviewsForBusiness(db, businessId) {
        const fields = ['partnerId', 'profileId', 'restaurantId'];
        for (const field of fields) {
            let snap;
            try {
                snap = await db.collection('reviews').where(field, '==', businessId).limit(200).get();
            } catch {
                continue;
            }
            if (snap.empty) continue;
            const batch = db.batch();
            snap.docs.forEach((docSnap) => batch.delete(docSnap.ref));
            await batch.commit();
        }
    }

    /**
     * @param {FirebaseFirestore.Firestore} db
     * @param {string} businessId
     */
    async function unpublishBusinessProfile(db, admin, businessId) {
        await db.collection('public_profiles').doc(businessId).set(
            {
                profileType: 'business',
                businessPublic: { isPublished: false },
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
        );
    }

    /**
     * @param {FirebaseFirestore.Firestore} db
     * @param {typeof import('firebase-admin')} admin
     * @param {string} businessId
     */
    async function removeBusinessFromDirectory(db, admin, businessId) {
        const profileRef = db.collection('public_profiles').doc(businessId);
        try {
            await profileRef.delete();
        } catch (err) {
            functions.logger.warn('[adminDeleteBusiness] public_profiles delete failed, unpublishing', {
                businessId,
                message: err?.message || String(err),
            });
            await unpublishBusinessProfile(db, admin, businessId);
        }
    }

    /**
     * @param {FirebaseFirestore.Firestore} db
     * @param {FirebaseFirestore.DocumentSnapshot} docSnap
     */
    function mapPublicProfileAdminBusiness(docSnap) {
        const p = docSnap.data() || {};
        const info = p.businessPublic && typeof p.businessPublic === 'object' ? p.businessPublic : {};
        return {
            id: docSnap.id,
            name: String(p.displayName || info.businessName || docSnap.id).slice(0, 120),
            city: String(info.city || '').slice(0, 80),
            address: String(info.address || '').slice(0, 160),
            isVirtual: p.isVirtual === true || p.createdBy === 'admin',
            isClaimed: p.isClaimed === true,
            googlePlaceId: p.googlePlaceId || docSnap.id,
            isOrphan: true,
        };
    }

    exportsObj.adminListBusinesses = functions.https.onCall(async (data, context) => {
        await assertAdminContext(context);
        const startAfterId = asTrimmedString(data?.startAfterId) || null;
        const pageSize = Math.min(Math.max(Number(data?.pageSize) || 25, 1), BUSINESSES_PAGE_MAX);

        let q = db.collection('restaurants').orderBy('name').limit(pageSize + 1);
        if (startAfterId) {
            const cursor = await db.collection('restaurants').doc(startAfterId).get();
            if (cursor.exists) q = q.startAfter(cursor);
        }

        let snap;
        try {
            snap = await q.get();
        } catch {
            q = db.collection('restaurants').limit(pageSize + 1);
            if (startAfterId) {
                const cursor = await db.collection('restaurants').doc(startAfterId).get();
                if (cursor.exists) q = q.startAfter(cursor);
            }
            snap = await q.get();
        }

        const hasNext = snap.size > pageSize;
        const docs = snap.docs.slice(0, pageSize);

        const items = docs.map((docSnap) => {
            const r = docSnap.data() || {};
            const bi = r.businessInfo && typeof r.businessInfo === 'object' ? r.businessInfo : {};
            const name = r.name || bi.businessName || bi.name || docSnap.id;
            const city = r.city || bi.city || r.address?.city || '';
            return {
                id: docSnap.id,
                name: String(name).slice(0, 120),
                city: String(city).slice(0, 80),
                address: String(r.address || bi.address || '').slice(0, 160),
                isVirtual: r.isVirtual === true || r.createdBy === 'admin',
                isClaimed: r.isClaimed === true,
                googlePlaceId: r.googlePlaceId || r.placeId || docSnap.id,
                isOrphan: false,
            };
        });

        const listedIds = new Set(items.map((item) => item.id));
        try {
            const orphanSnap = await db.collection('public_profiles')
                .where('profileType', '==', 'business')
                .where('businessPublic.isPublished', '==', true)
                .limit(80)
                .get();
            for (const docSnap of orphanSnap.docs) {
                if (listedIds.has(docSnap.id)) continue;
                const p = docSnap.data() || {};
                if (p.sourceCollection && p.sourceCollection !== 'restaurants') continue;
                const restSnap = await db.collection('restaurants').doc(docSnap.id).get();
                if (restSnap.exists) continue;
                items.unshift(mapPublicProfileAdminBusiness(docSnap));
                listedIds.add(docSnap.id);
            }
        } catch (err) {
            functions.logger.warn('[adminListBusinesses] orphan scan failed', err?.message || err);
        }

        return { items, hasNext, lastId: items.length ? items[items.length - 1].id : null };
    });

    exportsObj.adminDeleteBusiness = functions.https.onCall(async (data, context) => {
        await assertAdminContext(context);
        const businessId = asTrimmedString(data?.businessId);
        if (!businessId) {
            throw new functions.https.HttpsError('invalid-argument', 'businessId is required.');
        }

        const restaurantRef = db.collection('restaurants').doc(businessId);
        const profileRef = db.collection('public_profiles').doc(businessId);
        const [restSnap, profileSnap] = await Promise.all([restaurantRef.get(), profileRef.get()]);

        if (!restSnap.exists && !profileSnap.exists) {
            throw new functions.https.HttpsError('not-found', 'Business not found.');
        }

        const r = restSnap.exists ? (restSnap.data() || {}) : (profileSnap.data() || {});
        const bi = r.businessInfo && typeof r.businessInfo === 'object' ? r.businessInfo : {};
        const profileInfo = profileSnap.exists
            ? ((profileSnap.data() || {}).businessPublic || {})
            : {};
        const storagePath =
            r.coverImageStoragePath ||
            bi.coverImageStoragePath ||
            profileInfo.coverImageStoragePath ||
            (profileSnap.exists ? (profileSnap.data() || {}).coverImageStoragePath : '') ||
            `restaurants/covers/${businessId}.jpg`;

        if (restSnap.exists) {
            await restaurantRef.delete();
        }

        await removeBusinessFromDirectory(db, admin, businessId);
        await deleteReviewsForBusiness(db, businessId);

        const userRef = db.collection('users').doc(businessId);
        const userSnap = await userRef.get();
        if (userSnap.exists) {
            const u = userSnap.data() || {};
            const isAdminImport =
                u.createdBy === 'admin' ||
                u.isVirtual === true ||
                u.status === 'ai-generated' ||
                String(u.googlePlaceId || '') === businessId;
            if (isAdminImport && u.isClaimed !== true) {
                await userRef.delete();
            }
        }

        try {
            const bucket = admin.storage().bucket();
            if (storagePath) {
                await bucket.file(String(storagePath)).delete({ ignoreNotFound: true });
            }
        } catch {
            /* ignore */
        }

        return { success: true, businessId, removedFromDirectory: true };
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

    exportsObj.adminListDemoUsers = functions.https.onCall(async (data, context) => {
        await assertAdminContext(context);
        const cities = await listDemoCitySummaries(db);
        const users = await listDemoUserProfiles(db, {
            demoCityId: asTrimmedString(data?.demoCityId) || undefined,
            limit: data?.limit,
        });
        return { cities, users };
    });

    exportsObj.adminListDemoUserProfiles = functions.https.onCall(async (data, context) => {
        await assertAdminContext(context);
        const users = await listDemoUserProfiles(db, {
            demoCityId: asTrimmedString(data?.demoCityId) || undefined,
            limit: data?.limit,
        });
        return { users };
    });

    exportsObj.adminCreateDemoUser = functions.https.onCall(async (data, context) => {
        const { requesterUid } = await assertAdminContext(context);
        try {
            return await createDemoUser(
                db,
                {
                    city: data?.city,
                    countryCode: data?.countryCode,
                    countryName: data?.countryName || data?.country,
                    stateName: data?.stateName || data?.state,
                    lat: data?.lat ?? data?.center?.lat,
                    lng: data?.lng ?? data?.center?.lng,
                    profile: data?.profile,
                    mediaAssets: data?.mediaAssets,
                },
                requesterUid
            );
        } catch (err) {
            throw new functions.https.HttpsError(
                'invalid-argument',
                err?.message || 'Failed to create demo user.'
            );
        }
    });

    exportsObj.adminSuggestDemoUserProfile = functions.https.onCall(async (data, context) => {
        await assertAdminContext(context);
        const city = asTrimmedString(data?.city);
        const countryCode = asTrimmedString(data?.countryCode).toUpperCase().slice(0, 2);
        const countryName = asTrimmedString(data?.countryName || data?.country);
        const stateName = asTrimmedString(data?.stateName || data?.state);
        if (!city || countryCode.length !== 2) {
            throw new functions.https.HttpsError('invalid-argument', 'city and countryCode are required.');
        }
        try {
            const { callGeminiForDemographics } = require('./demoUsersGemini');
            const rows = await callGeminiForDemographics({
                city,
                state: stateName,
                country: countryName || countryCode,
                countryCode,
                count: 1,
            });
            return { profile: rows[0] || null };
        } catch (err) {
            throw new functions.https.HttpsError(
                'invalid-argument',
                err?.message || 'Failed to suggest demo profile text.'
            );
        }
    });

    exportsObj.adminDeleteDemoUser = functions.https.onCall(async (data, context) => {
        await assertAdminContext(context);
        const uid = asTrimmedString(data?.uid);
        if (!uid) {
            throw new functions.https.HttpsError('invalid-argument', 'uid is required.');
        }
        try {
            return await deleteDemoUser(db, uid);
        } catch (err) {
            if (err?.code === 'not-found') {
                throw new functions.https.HttpsError('not-found', err.message);
            }
            throw new functions.https.HttpsError(
                'invalid-argument',
                err?.message || 'Failed to delete demo user.'
            );
        }
    });

    async function runCreateDemoUsers(data, requesterUid) {
        const aiGeneratedJson = Array.isArray(data?.aiGeneratedJson) ? data.aiGeneratedJson : null;
        const count = aiGeneratedJson
            ? aiGeneratedJson.length
            : Math.floor(Number(data?.count));
        if (!Number.isFinite(count) || count < 1 || count > DEMO_COUNT_MAX) {
            throw new functions.https.HttpsError(
                'invalid-argument',
                aiGeneratedJson
                    ? `aiGeneratedJson length must be between 1 and ${DEMO_COUNT_MAX}.`
                    : `count must be between 1 and ${DEMO_COUNT_MAX}.`
            );
        }

        try {
            return await createDemoUsers(
                db,
                {
                    count,
                    city: data?.city,
                    countryCode: data?.countryCode,
                    countryName: data?.countryName || data?.country,
                    stateName: data?.stateName || data?.state,
                    lat: data?.lat ?? data?.center?.lat,
                    lng: data?.lng ?? data?.center?.lng,
                    replaceExisting: data?.replaceExisting === true,
                    aiGeneratedJson,
                    mediaAssets: data?.mediaAssets,
                    useAi: data?.useAi !== false,
                },
                requesterUid
            );
        } catch (err) {
            if (err?.code === 'already-exists') {
                throw new functions.https.HttpsError('already-exists', err.message);
            }
            throw new functions.https.HttpsError(
                'invalid-argument',
                err?.message || 'Failed to create demo users.'
            );
        }
    }

    const demoUserFnOpts = { timeoutSeconds: 540, memory: '1GB' };

    exportsObj.adminCreateDemoUsers = functions
        .runWith(demoUserFnOpts)
        .https.onCall(async (data, context) => {
        const { requesterUid } = await assertAdminContext(context);
        return runCreateDemoUsers(data, requesterUid);
    });

    /** Alias for adminCreateDemoUsers — accepts aiGeneratedJson + center { lat, lng }. */
    exportsObj.generateDemoUsersBatch = functions
        .runWith(demoUserFnOpts)
        .https.onCall(async (data, context) => {
        const { requesterUid } = await assertAdminContext(context);
        return runCreateDemoUsers(data, requesterUid);
    });

    exportsObj.adminWipeDemoUsers = functions.https.onCall(async (data, context) => {
        await assertAdminContext(context);
        const demoCityId =
            asTrimmedString(data?.demoCityId) ||
            buildDemoCityId(data?.city, data?.countryCode);
        if (!demoCityId) {
            throw new functions.https.HttpsError('invalid-argument', 'demoCityId or city+countryCode required.');
        }
        const batchId = asTrimmedString(data?.batchId) || null;
        const result = await wipeDemoUsers(db, { demoCityId, batchId });
        return result;
    });
}

module.exports = { registerAdminDashboard };
