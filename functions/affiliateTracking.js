/**
 * Affiliate referral tracking: click increments, pending signups, business-subscription commissions.
 */
const crypto = require('crypto');
const admin = require('firebase-admin');
const functions = require('firebase-functions');
const db = admin.firestore();

const PREFIX = 'AGENT-';
const MAX_CLICKS_PER_IP_CODE_HOUR = 24;
const COMMISSION_RATE = 0.2;

function normalizeReferralCode(raw) {
    const s = String(raw || '').trim().toUpperCase();
    if (!s.startsWith(PREFIX)) return null;
    if (!/^AGENT-[A-Z0-9]{5,12}$/.test(s)) return null;
    return s;
}

function extractClientIp(context) {
    const raw = context.rawRequest;
    if (!raw) return 'unknown';
    const h = raw.headers || {};
    const xf = h['x-forwarded-for'] || h['X-Forwarded-For'];
    if (xf) return String(xf).split(',')[0].trim() || 'unknown';
    if (raw.ip) return String(raw.ip);
    return 'unknown';
}

function rateLimitDocId(ip, code) {
    const hour = Math.floor(Date.now() / 3600000);
    return crypto.createHash('sha256').update(`${ip}|${code}|${hour}`).digest('hex').slice(0, 40);
}

/**
 * Callable: increment agent total_clicks for a valid referral code (anonymous OK).
 * Rate-limited per IP + code per hour to reduce spam.
 */
const incrementReferralClicks = functions.https.onCall(async (data, context) => {
    const code = normalizeReferralCode(data?.referralCode ?? data?.ref);
    if (!code) {
        throw new functions.https.HttpsError('invalid-argument', 'Valid referralCode is required.');
    }

    const ip = extractClientIp(context);
    const limitRef = db.collection('referral_rate_limits').doc(rateLimitDocId(ip, code));
    const regRef = db.collection('affiliate_referral_codes').doc(code);

    try {
        let incremented = false;
        await db.runTransaction(async (t) => {
            const limSnap = await t.get(limitRef);
            const count = limSnap.exists ? Number(limSnap.data().count) || 0 : 0;
            if (count >= MAX_CLICKS_PER_IP_CODE_HOUR) {
                return;
            }
            const regSnap = await t.get(regRef);
            if (!regSnap.exists) {
                return;
            }
            const agentUid = regSnap.data()?.uid;
            if (!agentUid || typeof agentUid !== 'string') {
                return;
            }
            const agentRef = db.collection('users').doc(agentUid);
            const agentSnap = await t.get(agentRef);
            if (!agentSnap.exists) return;
            const role = String(agentSnap.data()?.role || '').toLowerCase();
            if (role !== 'affiliate_agent') return;

            t.set(
                limitRef,
                {
                    count: count + 1,
                    referralCode: code,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                },
                { merge: true }
            );
            t.update(agentRef, {
                total_clicks: admin.firestore.FieldValue.increment(1),
            });
            incremented = true;
        });
        return { ok: true, incremented };
    } catch (e) {
        functions.logger.warn('[incrementReferralClicks]', e?.message || e);
        throw new functions.https.HttpsError('internal', 'Could not record click.');
    }
});

/**
 * When a user document gains a valid referred_by, bump the agent's pending_referrals_count once.
 */
const syncAffiliatePendingReferralOnUserWrite = functions.firestore
    .document('users/{uid}')
    .onWrite(async (change, context) => {
        if (!change.after.exists) return null;
        const after = change.after.data() || {};
        const before = change.before.exists ? change.before.data() || {} : {};
        const codeAfter = normalizeReferralCode(after.referred_by);
        const codeBefore = normalizeReferralCode(before.referred_by);
        if (!codeAfter || codeAfter === codeBefore) return null;

        const role = String(after.role || '').toLowerCase();
        if (role === 'affiliate_agent' || role === 'guest') return null;

        const reg = await db.collection('affiliate_referral_codes').doc(codeAfter).get();
        if (!reg.exists) return null;
        const agentUid = reg.data()?.uid;
        if (!agentUid || agentUid === context.params.uid) return null;

        try {
            await db.collection('users').doc(agentUid).update({
                pending_referrals_count: admin.firestore.FieldValue.increment(1),
                total_referred_users: admin.firestore.FieldValue.increment(1),
            });
            functions.logger.info('[syncAffiliatePendingReferral]', {
                referredUser: context.params.uid,
                agentUid,
                code: codeAfter,
            });
        } catch (e) {
            functions.logger.error('[syncAffiliatePendingReferral]', e?.message || e);
        }
        return null;
    });

/**
 * After Stripe business subscription checkout — credit affiliate commission once per session.
 * @param {{ db: FirebaseFirestore.Firestore, admin: typeof import('firebase-admin'), session: object, userId: string }} args
 */
async function processAffiliateBusinessCommission({ db, admin, session, userId }) {
    if (!session || session.mode !== 'subscription') return;
    if (String(session.metadata?.subscriptionKind || '').toLowerCase() !== 'business') return;

    const amountTotal = Number(session.amount_total);
    if (!Number.isFinite(amountTotal) || amountTotal <= 0) {
        functions.logger.info('[affiliateCommission] skip: no amount_total', session.id);
        return;
    }

    const currency = String(session.currency || 'usd').toLowerCase();
    const commissionCents = Math.floor(amountTotal * COMMISSION_RATE);
    if (commissionCents <= 0) return;

    const userRef = db.collection('users').doc(userId);

    await db.runTransaction(async (t) => {
        const uSnap = await t.get(userRef);
        if (!uSnap.exists) return;
        const u = uSnap.data() || {};
        if (u.affiliateLastCommissionSessionId === session.id) return;

        const code = normalizeReferralCode(u.referred_by);
        if (!code) return;

        const regSnap = await t.get(db.collection('affiliate_referral_codes').doc(code));
        if (!regSnap.exists) return;
        const agentUid = regSnap.data()?.uid;
        if (!agentUid || agentUid === userId) return;

        const agentRef = db.collection('users').doc(agentUid);
        const agentSnap = await t.get(agentRef);
        if (!agentSnap.exists) return;
        if (String(agentSnap.data()?.role || '').toLowerCase() !== 'affiliate_agent') return;

        const pending = Math.max(0, Number(agentSnap.data()?.pending_referrals_count) || 0);
        const nextPending = Math.max(0, pending - 1);

        const ledgerRef = agentRef.collection('commissions_history').doc();

        t.update(userRef, {
            affiliateLastCommissionSessionId: session.id,
        });
        t.update(agentRef, {
            current_balance: admin.firestore.FieldValue.increment(commissionCents),
            pending_commissions: admin.firestore.FieldValue.increment(commissionCents),
            total_earned: admin.firestore.FieldValue.increment(commissionCents),
            pending_referrals_count: nextPending,
            successful_referrals_count: admin.firestore.FieldValue.increment(1),
        });
        t.set(ledgerRef, {
            type: 'business_subscription',
            amountCents: commissionCents,
            currency,
            referredUserId: userId,
            stripeSessionId: session.id,
            subscriptionId: session.subscription || null,
            planId: session.metadata?.planId || null,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    });

    functions.logger.info('[affiliateCommission] credited', { userId, sessionId: session.id, commissionCents });
}

module.exports = {
    incrementReferralClicks,
    syncAffiliatePendingReferralOnUserWrite,
    processAffiliateBusinessCommission,
};
