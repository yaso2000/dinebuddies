const functions = require('firebase-functions');
const { normalizeBusinessSubscriptionTier } = require('./creditsCore');

/**
 * Paid business feature: broadcast a discount offer to the business's community
 * members. Gated on the paid subscription tier (biz_plan_paid_feat_member_notifs).
 * Members redeem by showing their membership QR, which the owner verifies via
 * verifyCommunityMember.
 */
function registerCommunityOffers(exports, { db, admin, enforceCallableRateLimit }) {
    exports.sendCommunityOffer = functions.https.onCall(async (data, context) => {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'Authentication required.');
        }

        const businessId = context.auth.uid;
        const title = typeof data?.title === 'string' ? data.title.trim().slice(0, 120) : '';
        const description =
            typeof data?.description === 'string' ? data.description.trim().slice(0, 500) : '';

        if (!title) {
            throw new functions.https.HttpsError('invalid-argument', 'An offer title is required.');
        }

        // Offers reach every member — keep the cadence low to avoid spamming them.
        await enforceCallableRateLimit(businessId, 'send_community_offer', {
            perMinute: 2,
            perHour: 6,
            perDay: 20,
            cooldownMs: 15000,
        });

        const bizSnap = await db.collection('users').doc(businessId).get();
        if (!bizSnap.exists) {
            throw new functions.https.HttpsError('not-found', 'Business account not found.');
        }
        const biz = bizSnap.data() || {};
        const role = String(biz.role || biz.accountType || '').toLowerCase();
        const isBusiness = role === 'business' || role === 'partner' || biz.isBusiness === true;
        if (!isBusiness) {
            throw new functions.https.HttpsError('permission-denied', 'Only business accounts can send member offers.');
        }

        // Paid-feature gate (member notifications & broadcasts).
        const tier = normalizeBusinessSubscriptionTier(biz.subscriptionTier);
        const stripeActive =
            String(biz.stripeSubscriptionStatus || biz.subscriptionStatus || '').toLowerCase() === 'active';
        if (tier !== 'paid' && !stripeActive) {
            throw new functions.https.HttpsError(
                'permission-denied',
                'Sending offers to community members is a paid feature.'
            );
        }

        const bi = biz.businessInfo && typeof biz.businessInfo === 'object' ? biz.businessInfo : {};
        const businessName =
            String(bi.businessName || biz.display_name || biz.displayName || biz.name || 'Business').trim() ||
            'Business';
        const senderAvatar =
            biz.avatar || biz.photo_url || biz.photoURL || bi.logoUrl || bi.logo || null;

        // Community members (user-side membership cache).
        const membersSnap = await db
            .collection('users')
            .where('joinedCommunities', 'array-contains', businessId)
            .limit(1000)
            .get();

        const recipientIds = membersSnap.docs
            .map((d) => d.id)
            .filter((id) => id && id !== businessId);

        const message = `${businessName}: ${title}`.slice(0, 500);
        const metadata = {
            partnerId: businessId,
            businessName,
            offerTitle: title,
            offerDescription: description || null,
        };
        const actionUrl = `/business/${businessId}`;

        let sent = 0;
        const chunkSize = 400;
        for (let i = 0; i < recipientIds.length; i += chunkSize) {
            const chunk = recipientIds.slice(i, i + chunkSize);
            const batch = db.batch();
            for (const userId of chunk) {
                const ref = db.collection('notifications').doc();
                batch.set(ref, {
                    userId,
                    type: 'community_offer',
                    title: 'Member offer',
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

        return { success: true, sent };
    });
}

module.exports = { registerCommunityOffers };
