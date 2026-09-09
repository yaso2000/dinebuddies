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
        // One redemption per member (default on); optional expiry.
        const oncePerMember = data?.oncePerMember !== false;
        let expiresAt = null;
        if (data?.expiresAt != null) {
            const ms = typeof data.expiresAt === 'number' ? data.expiresAt : Date.parse(String(data.expiresAt));
            if (Number.isFinite(ms) && ms > Date.now()) {
                expiresAt = admin.firestore.Timestamp.fromMillis(ms);
            }
        }

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

        // Persist the offer so redemptions can reference it (model B). The QR scan
        // then redeems against this offer id, with one-per-member enforcement.
        const offerRef = db.collection('community_offers').doc();
        await offerRef.set({
            partnerId: businessId,
            businessName,
            title,
            description: description || null,
            oncePerMember,
            active: true,
            expiresAt,
            redemptionCount: 0,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        const offerId = offerRef.id;

        const message = `${businessName}: ${title}`.slice(0, 500);
        const metadata = {
            partnerId: businessId,
            businessName,
            offerId,
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

        return { success: true, sent, offerId };
    });

    // Owner lists their community offers (active first) with redemption counts.
    exports.listCommunityOffers = functions.https.onCall(async (data, context) => {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'Authentication required.');
        }
        const businessId = context.auth.uid;
        const activeOnly = data?.activeOnly === true;
        const nowMs = Date.now();

        let snap;
        try {
            snap = await db
                .collection('community_offers')
                .where('partnerId', '==', businessId)
                .orderBy('createdAt', 'desc')
                .limit(100)
                .get();
        } catch (err) {
            // Missing composite index — fall back to an unordered scan.
            snap = await db.collection('community_offers').where('partnerId', '==', businessId).limit(100).get();
        }

        const offers = snap.docs
            .map((d) => {
                const o = d.data() || {};
                const expiresMs = o.expiresAt?.toMillis ? o.expiresAt.toMillis() : null;
                const isExpired = expiresMs != null && expiresMs <= nowMs;
                return {
                    id: d.id,
                    title: o.title || '',
                    description: o.description || null,
                    oncePerMember: o.oncePerMember !== false,
                    active: o.active !== false && !isExpired,
                    isExpired,
                    expiresAt: expiresMs,
                    redemptionCount: Number(o.redemptionCount || 0),
                    createdAt: o.createdAt?.toMillis ? o.createdAt.toMillis() : null,
                };
            })
            .filter((o) => (activeOnly ? o.active : true))
            .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

        return { offers };
    });

    // Redeem an offer for the scanned member (model B): verify owner + member +
    // offer, enforce one-per-member, record the redemption, bump the count.
    exports.redeemCommunityOffer = functions.https.onCall(async (data, context) => {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'Authentication required.');
        }
        const businessId = context.auth.uid;
        const qrToken = String(data?.qrToken || '').trim();
        const offerId = String(data?.offerId || '').trim();
        if (!qrToken || !offerId) {
            throw new functions.https.HttpsError('invalid-argument', 'qrToken and offerId are required.');
        }
        if (!/^[a-f0-9]{20,64}$/.test(qrToken)) {
            throw new functions.https.HttpsError('invalid-argument', 'Malformed membership token.');
        }

        await enforceCallableRateLimit(businessId, 'redeem_community_offer', {
            perMinute: 60,
            perHour: 600,
            perDay: 3000,
            cooldownMs: 0,
        });

        const offerRef = db.collection('community_offers').doc(offerId);
        const offerSnap = await offerRef.get();
        if (!offerSnap.exists) {
            return { ok: false, reason: 'offer_not_found' };
        }
        const offer = offerSnap.data() || {};
        if (offer.partnerId !== businessId) {
            throw new functions.https.HttpsError('permission-denied', 'This offer belongs to another community.');
        }
        const expiresMs = offer.expiresAt?.toMillis ? offer.expiresAt.toMillis() : null;
        if (offer.active === false || (expiresMs != null && expiresMs <= Date.now())) {
            return { ok: false, reason: 'offer_inactive' };
        }

        // Resolve the member from the QR token.
        const memSnap = await db
            .collection('community_memberships')
            .where('qrToken', '==', qrToken)
            .limit(1)
            .get();
        if (memSnap.empty) {
            return { ok: false, reason: 'not_member' };
        }
        const m = memSnap.docs[0].data() || {};
        if (m.partnerId !== businessId || m.status !== 'active') {
            return { ok: false, reason: 'not_member' };
        }
        const memberId = m.userId;

        let memberName = null;
        try {
            const userSnap = await db.collection('users').doc(memberId).get();
            const u = userSnap.exists ? userSnap.data() : {};
            memberName = u.display_name || u.displayName || u.name || null;
        } catch (e) {
            /* non-fatal */
        }

        const redemptionRef = offerRef.collection('redemptions').doc(memberId);
        const oncePerMember = offer.oncePerMember !== false;

        const result = await db.runTransaction(async (tx) => {
            const existing = await tx.get(redemptionRef);
            if (oncePerMember && existing.exists) {
                const prev = existing.data() || {};
                return {
                    ok: false,
                    reason: 'already_redeemed',
                    redeemedAt: prev.redeemedAt?.toMillis ? prev.redeemedAt.toMillis() : null,
                    memberNumber: m.memberNumber || null,
                    memberName,
                };
            }
            tx.set(
                redemptionRef,
                {
                    memberId,
                    memberNumber: m.memberNumber || null,
                    redeemedBy: businessId,
                    redeemedAt: admin.firestore.FieldValue.serverTimestamp(),
                    count: admin.firestore.FieldValue.increment(1),
                },
                { merge: true }
            );
            tx.update(offerRef, { redemptionCount: admin.firestore.FieldValue.increment(1) });
            return { ok: true };
        });

        if (!result.ok) return result;
        return {
            ok: true,
            memberNumber: m.memberNumber || null,
            memberId,
            memberName,
            offerTitle: offer.title || '',
        };
    });
}

module.exports = { registerCommunityOffers };
