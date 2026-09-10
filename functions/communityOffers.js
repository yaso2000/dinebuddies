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
        // Distribution channels (any combination). Default: notify members only,
        // matching the previous behaviour.
        const notifyMembers = data?.notifyMembers !== false;
        const onFeed = data?.onFeed === true;
        const onSwipe = data?.onSwipe === true;
        // Banner look: optional image + background style.
        const imageUrl =
            typeof data?.imageUrl === 'string' && /^https:\/\//i.test(data.imageUrl.trim())
                ? data.imageUrl.trim().slice(0, 600)
                : null;
        const bgColor =
            typeof data?.bgColor === 'string' && data.bgColor.trim()
                ? data.bgColor.trim().slice(0, 200)
                : null;
        const clampPct = (v) => {
            const n = Number(v);
            return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 50;
        };
        const imagePosX = data?.imagePosX != null ? clampPct(data.imagePosX) : 50;
        const imagePosY = data?.imagePosY != null ? clampPct(data.imagePosY) : 50;
        const imageZoom = (() => {
            const n = Number(data?.imageZoom);
            return Number.isFinite(n) ? Math.max(1, Math.min(3, n)) : 1;
        })();
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

        // Business geo (for nearest-first ordering on the offers feed/page). Prefer
        // the users doc, else the restaurants listing.
        const pickNum = (...vals) => {
            for (const v of vals) {
                const n = Number(v);
                if (Number.isFinite(n) && n !== 0) return n;
            }
            return null;
        };
        let offerLat = pickNum(biz.lat, biz.latitude, biz.location?.lat, bi.lat, biz.coordinates?.lat);
        let offerLng = pickNum(biz.lng, biz.longitude, biz.location?.lng, bi.lng, biz.coordinates?.lng);
        let offerCity = String(biz.city || bi.city || '').trim() || null;
        if (offerLat == null || offerLng == null) {
            try {
                const restSnap = await db.collection('restaurants').doc(businessId).get();
                if (restSnap.exists) {
                    const r = restSnap.data() || {};
                    const rbi = r.businessInfo && typeof r.businessInfo === 'object' ? r.businessInfo : {};
                    offerLat = offerLat ?? pickNum(r.lat, r.latitude, r.location?.lat, rbi.lat, r.coordinates?.lat);
                    offerLng = offerLng ?? pickNum(r.lng, r.longitude, r.location?.lng, rbi.lng, r.coordinates?.lng);
                    offerCity = offerCity || String(r.city || rbi.city || '').trim() || null;
                }
            } catch (e) {
                /* geo is best-effort */
            }
        }

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
            businessAvatar: senderAvatar || null,
            title,
            description: description || null,
            imageUrl,
            imagePosX,
            imagePosY,
            imageZoom,
            bgColor,
            oncePerMember,
            active: true,
            expiresAt,
            // Distribution channels chosen at creation.
            notifyMembers,
            onFeed,
            onSwipe,
            // Business geo for nearest-first ordering (best-effort).
            lat: offerLat,
            lng: offerLng,
            city: offerCity,
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
        // Only push a notification to members when that channel was chosen.
        if (notifyMembers) {
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

    // Public offers list for the consumer "Special Offers" page: active offers the
    // business chose to publish to the feed. Any signed-in user can read it.
    exports.listActiveCommunityOffers = functions.https.onCall(async (data, context) => {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'Authentication required.');
        }
        const nowMs = Date.now();
        let snap;
        try {
            snap = await db
                .collection('community_offers')
                .where('onFeed', '==', true)
                .orderBy('createdAt', 'desc')
                .limit(100)
                .get();
        } catch (err) {
            snap = await db.collection('community_offers').where('onFeed', '==', true).limit(100).get();
        }
        const offers = snap.docs
            .map((d) => {
                const o = d.data() || {};
                const expiresMs = o.expiresAt?.toMillis ? o.expiresAt.toMillis() : null;
                const isExpired = expiresMs != null && expiresMs <= nowMs;
                return {
                    id: d.id,
                    partnerId: o.partnerId || null,
                    businessName: o.businessName || '',
                    businessAvatar: o.businessAvatar || null,
                    title: o.title || '',
                    description: o.description || null,
                    imageUrl: o.imageUrl || null,
                    imagePosX: typeof o.imagePosX === 'number' ? o.imagePosX : 50,
                    imagePosY: typeof o.imagePosY === 'number' ? o.imagePosY : 50,
                    imageZoom: typeof o.imageZoom === 'number' ? o.imageZoom : 1,
                    bgColor: o.bgColor || null,
                    expiresAt: expiresMs,
                    active: o.active !== false && !isExpired,
                    lat: typeof o.lat === 'number' ? o.lat : null,
                    lng: typeof o.lng === 'number' ? o.lng : null,
                    city: o.city || null,
                    createdAt: o.createdAt?.toMillis ? o.createdAt.toMillis() : null,
                };
            })
            .filter((o) => o.active)
            .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        return { offers };
    });

    // Consumer self-claim ("Take it"): a community member records that they took an
    // offer (one-per-member enforced). Non-members are told to join first.
    exports.takeCommunityOffer = functions.https.onCall(async (data, context) => {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'Authentication required.');
        }
        const uid = context.auth.uid;
        const offerId = String(data?.offerId || '').trim();
        if (!offerId) {
            throw new functions.https.HttpsError('invalid-argument', 'offerId is required.');
        }

        await enforceCallableRateLimit(uid, 'take_community_offer', {
            perMinute: 30,
            perHour: 300,
            perDay: 1000,
            cooldownMs: 0,
        });

        // Business accounts cannot take offers — not their own, not anyone's.
        // They only participate in the shared feed and stories.
        try {
            const takerSnap = await db.collection('users').doc(uid).get();
            const taker = takerSnap.exists ? takerSnap.data() || {} : {};
            const takerRole = String(taker.role || taker.accountType || '').toLowerCase();
            const takerIsBusiness =
                takerRole === 'business' || takerRole === 'partner' || taker.isBusiness === true;
            if (takerIsBusiness) {
                return { ok: false, reason: 'business_forbidden' };
            }
        } catch (e) {
            /* if the lookup fails, fall through — the membership check still gates it */
        }

        const offerRef = db.collection('community_offers').doc(offerId);
        const offerSnap = await offerRef.get();
        if (!offerSnap.exists) return { ok: false, reason: 'offer_not_found' };
        const offer = offerSnap.data() || {};
        const expiresMs = offer.expiresAt?.toMillis ? offer.expiresAt.toMillis() : null;
        if (offer.active === false || (expiresMs != null && expiresMs <= Date.now())) {
            return { ok: false, reason: 'offer_inactive' };
        }

        const partnerId = offer.partnerId;
        // Must be an active member of the offer's community to take it.
        const memSnap = await db.collection('community_memberships').doc(`${partnerId}__${uid}`).get();
        const m = memSnap.exists ? memSnap.data() || {} : null;
        if (!m || m.status !== 'active') {
            return { ok: false, reason: 'not_member', partnerId };
        }

        const oncePerMember = offer.oncePerMember !== false;
        const redemptionRef = offerRef.collection('redemptions').doc(uid);
        const result = await db.runTransaction(async (tx) => {
            const existing = await tx.get(redemptionRef);
            if (oncePerMember && existing.exists) {
                const prev = existing.data() || {};
                return {
                    ok: false,
                    reason: 'already_taken',
                    takenAt: prev.redeemedAt?.toMillis ? prev.redeemedAt.toMillis() : null,
                };
            }
            tx.set(
                redemptionRef,
                {
                    memberId: uid,
                    memberNumber: m.memberNumber || null,
                    source: 'self_claim',
                    redeemedAt: admin.firestore.FieldValue.serverTimestamp(),
                    count: admin.firestore.FieldValue.increment(1),
                },
                { merge: true }
            );
            tx.update(offerRef, { redemptionCount: admin.firestore.FieldValue.increment(1) });
            return { ok: true };
        });

        return result;
    });
}

module.exports = { registerCommunityOffers };
