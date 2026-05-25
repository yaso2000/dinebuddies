const functions = require('firebase-functions');
const { normalizeBusinessSubscriptionTier } = require('./creditsCore');

/**
 * Server-side batch notifications when a business publishes a post.
 */
function registerBusinessPostNotify(exports, { db, admin, enforceCallableRateLimit }) {
    exports.notifyBusinessPostPublished = functions.https.onCall(async (data, context) => {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'Authentication required.');
        }

        const businessId = context.auth.uid;
        const featuredPostId =
            typeof data?.featuredPostId === 'string' ? data.featuredPostId.trim() : '';
        const motionPostId = typeof data?.motionPostId === 'string' ? data.motionPostId.trim() : '';
        const communityPostId =
            typeof data?.communityPostId === 'string' ? data.communityPostId.trim() : '';
        const titlePreview = typeof data?.title === 'string' ? data.title.trim().slice(0, 200) : '';
        const notifyMembers = data?.notifyMembers !== false;

        if (!featuredPostId && !motionPostId) {
            throw new functions.https.HttpsError(
                'invalid-argument',
                'featuredPostId or motionPostId is required.'
            );
        }

        const postKey = featuredPostId ? `featured_${featuredPostId}` : `motion_${motionPostId}`;

        await enforceCallableRateLimit(businessId, 'notify_business_post', {
            perMinute: 10,
            perHour: 60,
            perDay: 200,
            cooldownMs: 3000,
        });

        const bizSnap = await db.collection('users').doc(businessId).get();
        if (!bizSnap.exists) {
            throw new functions.https.HttpsError('not-found', 'Business account not found.');
        }
        const biz = bizSnap.data() || {};
        const role = String(biz.role || biz.accountType || '').toLowerCase();
        const isBusiness =
            role === 'business' || role === 'partner' || biz.isBusiness === true;
        if (!isBusiness) {
            throw new functions.https.HttpsError('permission-denied', 'Only business accounts can notify on publish.');
        }

        if (featuredPostId) {
            const fpSnap = await db.collection('featured_posts').doc(featuredPostId).get();
            if (!fpSnap.exists) {
                throw new functions.https.HttpsError('not-found', 'Featured post not found.');
            }
            const fp = fpSnap.data() || {};
            if (String(fp.partnerId || '') !== businessId) {
                throw new functions.https.HttpsError('permission-denied', 'Not your featured post.');
            }
            if (fp.status === 'draft') {
                throw new functions.https.HttpsError('failed-precondition', 'Post is not published.');
            }
        }

        if (motionPostId) {
            const mpSnap = await db.collection('business_motion_posts').doc(motionPostId).get();
            if (!mpSnap.exists) {
                throw new functions.https.HttpsError('not-found', 'Motion post not found.');
            }
            const mp = mpSnap.data() || {};
            if (String(mp.ownerId || '') !== businessId && String(mp.businessId || '') !== businessId) {
                throw new functions.https.HttpsError('permission-denied', 'Not your motion post.');
            }
            if (mp.status !== 'published') {
                throw new functions.https.HttpsError('failed-precondition', 'Post is not published.');
            }
        }

        const logRef = db.collection('_business_post_notify_log').doc(`${businessId}_${postKey}`);
        const logSnap = await logRef.get();
        if (logSnap.exists) {
            return {
                success: true,
                skipped: true,
                reason: 'already_notified',
                sent: Number(logSnap.data()?.sent || 0),
            };
        }

        const bi = biz.businessInfo && typeof biz.businessInfo === 'object' ? biz.businessInfo : {};
        const businessName =
            String(bi.businessName || biz.display_name || biz.displayName || biz.name || 'Business').trim() ||
            'Business';

        const tier = normalizeBusinessSubscriptionTier(biz.subscriptionTier);
        const stripeActive =
            String(biz.stripeSubscriptionStatus || biz.subscriptionStatus || '').toLowerCase() ===
            'active';
        const includeMembers =
            notifyMembers && (tier === 'paid' || stripeActive);

        const recipientIds = new Set();

        const followersSnap = await db
            .collection('users')
            .where('following', 'array-contains', businessId)
            .limit(500)
            .get();
        for (const d of followersSnap.docs) {
            if (d.id !== businessId) recipientIds.add(d.id);
        }

        if (includeMembers) {
            const membersSnap = await db
                .collection('users')
                .where('joinedCommunities', 'array-contains', businessId)
                .limit(500)
                .get();
            for (const d of membersSnap.docs) {
                if (d.id !== businessId) recipientIds.add(d.id);
            }
        }

        const headline =
            titlePreview ||
            (featuredPostId ? 'New featured post' : 'New post from Smart Post Studio');
        const message = `${businessName}: ${headline}`.slice(0, 500);
        const notifTitle = 'New post'.slice(0, 120);

        let actionUrl = `/business/${businessId}`;
        if (communityPostId) {
            actionUrl = `/post/${communityPostId}`;
        } else if (featuredPostId) {
            actionUrl = `/post/featured/${featuredPostId}`;
        } else if (motionPostId) {
            actionUrl = `/post/motion_${motionPostId}`;
        }

        const senderAvatar =
            biz.avatar ||
            biz.photo_url ||
            biz.photoURL ||
            bi.logoUrl ||
            bi.logo ||
            null;

        const metadata = {
            partnerId: businessId,
            businessName,
            featuredPostId: featuredPostId || null,
            motionPostId: motionPostId || null,
            communityPostId: communityPostId || null,
        };

        let sent = 0;
        const ids = [...recipientIds];
        const chunkSize = 400;

        for (let i = 0; i < ids.length; i += chunkSize) {
            const chunk = ids.slice(i, i + chunkSize);
            const batch = db.batch();
            for (const userId of chunk) {
                const ref = db.collection('notifications').doc();
                batch.set(ref, {
                    userId,
                    type: 'business_post',
                    title: notifTitle,
                    message,
                    actionUrl,
                    invitationId: null,
                    style: null,
                    status: null,
                    metadata,
                    read: false,
                    senderId: businessId,
                    senderName: businessName,
                    senderAvatar,
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                });
                sent += 1;
            }
            await batch.commit();
        }

        await logRef.set({
            businessId,
            postKey,
            sent,
            includeMembers,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        return { success: true, sent, includeMembers, followers: followersSnap.size };
    });
}

module.exports = { registerBusinessPostNotify };
