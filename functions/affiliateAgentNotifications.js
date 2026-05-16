/**
 * In-app notifications for affiliate agents (written with Admin SDK; not client-createable).
 */
const AFFILIATE_NOTIF_TYPES = {
    REFERRAL_BUSINESS: 'affiliate_referral_business',
    REFERRAL_PLAN: 'affiliate_referral_plan',
};

function isBusinessProfile(data) {
    if (!data || typeof data !== 'object') return false;
    const r = String(data.role || '').toLowerCase();
    if (r === 'business' || r === 'partner') return true;
    if (String(data.accountType || '').toLowerCase() === 'business') return true;
    const bi = data.businessInfo;
    return !!(bi && typeof bi === 'object' && Object.keys(bi).length > 0);
}

function formatMoneyCents(cents, currency) {
    const c = Math.floor(Number(cents) || 0);
    const cur = String(currency || 'usd').toUpperCase();
    try {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: cur }).format(c / 100);
    } catch {
        return `${(c / 100).toFixed(2)} ${cur}`;
    }
}

/**
 * @param {FirebaseFirestore.Firestore} db
 * @param {typeof import('firebase-admin')} admin
 * @param {{ agentUid: string, referredUserId: string }} args
 */
async function notifyAffiliateReferralBecameBusiness(db, admin, { agentUid, referredUserId }) {
    if (!agentUid || !referredUserId || agentUid === referredUserId) return;

    const agentRef = db.collection('users').doc(agentUid);
    const agentSnap = await agentRef.get();
    if (!agentSnap.exists) return;
    const a = agentSnap.data() || {};
    if (String(a.role || '').toLowerCase() !== 'affiliate_agent') return;
    if (a.affiliate_notify_referral_business === false) return;

    const dedupeId = `affiliate_referral_business_${referredUserId}`;
    const notifRef = db.collection('notifications').doc(dedupeId);

    await db.runTransaction(async (t) => {
        const ex = await t.get(notifRef);
        if (ex.exists) return;
        t.set(notifRef, {
            userId: agentUid,
            type: AFFILIATE_NOTIF_TYPES.REFERRAL_BUSINESS,
            title: 'Referred user joined as a business',
            message: 'Someone you referred completed a business profile on DineBuddies.',
            actionUrl: '/affiliate/dashboard',
            invitationId: null,
            style: 'info',
            status: null,
            metadata: { affiliateProgram: true, referredUserId },
            fromUserId: 'system',
            fromUserName: 'DineBuddies',
            fromUserAvatar: null,
            senderId: null,
            senderName: 'DineBuddies',
            senderAvatar: null,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            read: false,
        });
    });
}

/**
 * @param {FirebaseFirestore.Firestore} db
 * @param {typeof import('firebase-admin')} admin
 * @param {{
 *   agentUid: string,
 *   subscriberUserId: string,
 *   sessionId: string,
 *   commissionCents: number,
 *   grossCents: number,
 *   currency: string,
 *   planId: string | null,
 * }} payload
 */
async function notifyAffiliateReferralPlanPurchased(db, admin, payload) {
    const {
        agentUid,
        subscriberUserId,
        sessionId,
        commissionCents,
        grossCents,
        currency,
        planId,
    } = payload;
    if (!agentUid || !sessionId) return;

    const agentRef = db.collection('users').doc(agentUid);
    const agentSnap = await agentRef.get();
    if (!agentSnap.exists) return;
    const a = agentSnap.data() || {};
    if (String(a.role || '').toLowerCase() !== 'affiliate_agent') return;
    if (a.affiliate_notify_referral_plan === false) return;

    const dedupeId = `affiliate_referral_plan_${sessionId}`;
    const notifRef = db.collection('notifications').doc(dedupeId);
    const grossStr = formatMoneyCents(grossCents, currency);
    const commStr = formatMoneyCents(commissionCents, currency);

    await db.runTransaction(async (t) => {
        const ex = await t.get(notifRef);
        if (ex.exists) return;
        t.set(notifRef, {
            userId: agentUid,
            type: AFFILIATE_NOTIF_TYPES.REFERRAL_PLAN,
            title: 'Referred user purchased a plan',
            message: `A referred user paid ${grossStr} for a business subscription. Your commission: ${commStr}.`,
            actionUrl: '/affiliate/dashboard',
            invitationId: null,
            style: 'info',
            status: null,
            metadata: {
                affiliateProgram: true,
                referredUserId: subscriberUserId || null,
                stripeSessionId: sessionId,
                planId: planId || null,
                grossAmountCents: Math.floor(Number(grossCents) || 0),
                commissionCents: Math.floor(Number(commissionCents) || 0),
                currency: String(currency || 'usd').toLowerCase(),
            },
            fromUserId: 'system',
            fromUserName: 'DineBuddies',
            fromUserAvatar: null,
            senderId: null,
            senderName: 'DineBuddies',
            senderAvatar: null,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            read: false,
        });
    });
}

module.exports = {
    AFFILIATE_NOTIF_TYPES,
    isBusinessProfile,
    notifyAffiliateReferralBecameBusiness,
    notifyAffiliateReferralPlanPurchased,
};
