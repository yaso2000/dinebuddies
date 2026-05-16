/**
 * Affiliate referral tracking: click increments, pending signups, business-subscription commissions.
 *
 * Commission tiers (by successful sale index for this agent, 1-based):
 *   1–20  → 20% (2000 bps)
 *   21–30 → 25% (2500 bps)
 *   31+   → 30% (3000 bps)
 *
 * Tier uses `referral_count` when present, else falls back to `successful_referrals_count` for migration.
 * Each successful commission increments `referral_count` atomically with the same transaction as the payout.
 *
 * Refund trap: commissions accrue on checkout.session.completed (payment_status paid). If the customer is
 * refunded later, `charge.refunded` attempts a reversal (balance + counters) when a matching
 * `business_subscriptions` row exists. For stronger protection, add a settlement delay (not implemented here)
 * or dispute webhooks — see code comments in reverseAffiliateCommissionOnChargeRefunded.
 *
 * All commission amounts use integer cents × integer basis points ÷ 10000 (no floating gross × decimal rate).
 */
const crypto = require('crypto');
const admin = require('firebase-admin');
const functions = require('firebase-functions');
const {
    isBusinessProfile,
    notifyAffiliateReferralBecameBusiness,
    notifyAffiliateReferralPlanPurchased,
} = require('./affiliateAgentNotifications');
const db = admin.firestore();

const PREFIX = 'AGENT-';
const MAX_CLICKS_PER_IP_CODE_HOUR = 24;

/** Hard cap on tier rate (sanity); default 3000 = 30%. Override with AFFILIATE_MAX_COMMISSION_BPS (1–3000). */
function getMaxCommissionBps() {
    const raw = process.env.AFFILIATE_MAX_COMMISSION_BPS;
    const n = Number(String(raw || '').trim());
    if (!Number.isFinite(n) || n < 1) return 3000;
    return Math.min(3000, Math.floor(n));
}

/**
 * 1-based index of this successful sale for tiering: first paid conversion = 1, etc.
 * Uses referral_count when set; otherwise successful_referrals_count (legacy).
 */
function getSuccessfulSaleCountForTiering(agentData) {
    const rc = agentData?.referral_count;
    if (typeof rc === 'number' && Number.isFinite(rc) && rc >= 0) return Math.floor(rc);
    const sc = agentData?.successful_referrals_count;
    if (typeof sc === 'number' && Number.isFinite(sc) && sc >= 0) return Math.floor(sc);
    return 0;
}

/** Basis points for the n-th successful sale (n >= 1). Capped by getMaxCommissionBps(). */
function commissionRateBpsForSaleNumber(n) {
    const num = Math.max(1, Math.floor(Number(n) || 1));
    let bps;
    if (num <= 20) bps = 2000;
    else if (num <= 30) bps = 2500;
    else bps = 3000;
    return Math.min(bps, getMaxCommissionBps());
}

/** Integer cents: floor(grossCents * rateBps / 10000). */
function commissionCentsFromGrossBps(grossCents, rateBps) {
    const g = Math.floor(Number(grossCents) || 0);
    const r = Math.floor(Number(rateBps) || 0);
    if (g <= 0 || r <= 0) return 0;
    return Math.floor((g * r) / 10000);
}

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

    const regRef = db.collection('affiliate_referral_codes').doc(code);
    const regPreview = await regRef.get();
    if (!regPreview.exists) {
        return { ok: true, incremented: false };
    }
    const agentUidPreview = regPreview.data()?.uid;
    if (context.auth?.uid && agentUidPreview && context.auth.uid === agentUidPreview) {
        return { ok: true, incremented: false, reason: 'self' };
    }

    const ip = extractClientIp(context);
    const limitRef = db.collection('referral_rate_limits').doc(rateLimitDocId(ip, code));

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
            if (context.auth?.uid && context.auth.uid === agentUid) {
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

        const role = String(after.role || '').toLowerCase();
        if (role === 'affiliate_agent' || role === 'guest') return null;

        if (!codeAfter) return null;

        if (codeAfter !== codeBefore) {
            const reg = await db.collection('affiliate_referral_codes').doc(codeAfter).get();
            if (reg.exists) {
                const agentUid = reg.data()?.uid;
                if (agentUid && agentUid !== context.params.uid) {
                    try {
                        await db.collection('users').doc(agentUid).update({
                            pending_referrals_count: admin.firestore.FieldValue.increment(1),
                        });
                        functions.logger.info('[syncAffiliatePendingReferral]', {
                            referredUser: context.params.uid,
                            agentUid,
                            code: codeAfter,
                        });
                    } catch (e) {
                        functions.logger.error('[syncAffiliatePendingReferral]', e?.message || e);
                    }
                }
            }
        }

        const wasBiz = change.before.exists && isBusinessProfile(before);
        const isBiz = isBusinessProfile(after);
        if (isBiz && !wasBiz) {
            try {
                const regB = await db.collection('affiliate_referral_codes').doc(codeAfter).get();
                if (regB.exists) {
                    const agentUidB = regB.data()?.uid;
                    const referredUid = context.params.uid;
                    if (agentUidB && agentUidB !== referredUid) {
                        await notifyAffiliateReferralBecameBusiness(db, admin, {
                            agentUid: agentUidB,
                            referredUserId: referredUid,
                        });
                    }
                }
            } catch (e) {
                functions.logger.error('[syncAffiliatePendingReferral] business notify', e?.message || e);
            }
        }

        return null;
    });

/**
 * Stripe checkout → queue one `business_subscriptions/{sessionId}` row; commission runs in onCreate.
 * Only when payment_status is `paid` (successful checkout payment).
 * @param {{ db: FirebaseFirestore.Firestore, admin: typeof import('firebase-admin'), session: object, userId: string }} args
 */
async function processAffiliateBusinessCommission({ db, admin, session, userId }) {
    if (!session || session.mode !== 'subscription') return;
    if (String(session.metadata?.subscriptionKind || '').toLowerCase() !== 'business') return;

    const payStatus = String(session.payment_status || '').toLowerCase();
    if (payStatus !== 'paid') {
        functions.logger.info('[affiliateCommission] skip queue: payment_status not paid', {
            sessionId: session.id,
            payment_status: session.payment_status,
        });
        return;
    }

    const amountTotal = Number(session.amount_total);
    if (!Number.isFinite(amountTotal) || amountTotal <= 0) {
        functions.logger.info('[affiliateCommission] skip queue: no amount_total', session.id);
        return;
    }

    const userRef = db.collection('users').doc(userId);
    const subRef = db.collection('business_subscriptions').doc(session.id);
    const paymentIntentId =
        typeof session.payment_intent === 'string'
            ? session.payment_intent
            : session.payment_intent && typeof session.payment_intent === 'object'
              ? session.payment_intent.id
              : null;

    await db.runTransaction(async (t) => {
        const subSnap = await t.get(subRef);
        if (subSnap.exists) return;

        const uSnap = await t.get(userRef);
        if (!uSnap.exists) return;
        const u = uSnap.data() || {};
        if (!normalizeReferralCode(u.referred_by)) {
            return;
        }
        if (u.affiliateLastCommissionSessionId === session.id) {
            return;
        }

        t.set(subRef, {
            subscriberUserId: userId,
            stripeSessionId: session.id,
            stripePaymentIntentId: paymentIntentId,
            subscriptionId: session.subscription || null,
            planId: session.metadata?.planId || null,
            grossAmountCents: amountTotal,
            currency: String(session.currency || 'usd').toLowerCase(),
            subscriptionKind: 'business',
            source: 'stripe_checkout',
            paymentStatus: payStatus,
            queuedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    });

    const queued = (await subRef.get()).exists;
    if (queued) {
        functions.logger.info('[affiliateCommission] queued business_subscriptions', { userId, sessionId: session.id });
    } else {
        functions.logger.info('[affiliateCommission] skip queue', { userId, sessionId: session.id });
    }
}

/**
 * Apply affiliate payout for a new `business_subscriptions` document (idempotent via subscriber + session).
 * Records immutable commission fields on the subscription doc + standalone audit row.
 */
async function applyCommissionFromBusinessSubscriptionCreate(db, admin, snap) {
    const data = snap.data() || {};
    const docId = snap.id;
    const sessionId = typeof data.stripeSessionId === 'string' ? data.stripeSessionId : docId;
    const userId = data.subscriberUserId;
    if (!userId || typeof userId !== 'string') {
        functions.logger.warn('[onBusinessSubscriptionCreated] missing subscriberUserId', { docId });
        return;
    }

    const amountTotal = Number(data.grossAmountCents);
    if (!Number.isFinite(amountTotal) || amountTotal <= 0) {
        await snap.ref.set(
            {
                commissionApplied: false,
                commissionSkipReason: 'bad_amount',
                processedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
        );
        return;
    }

    const payOk = String(data.paymentStatus || 'paid').toLowerCase() === 'paid';
    if (!payOk) {
        await snap.ref.set(
            {
                commissionApplied: false,
                commissionSkipReason: 'payment_not_paid',
                processedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
        );
        return;
    }

    const currency = String(data.currency || 'usd').toLowerCase();
    const userRef = db.collection('users').doc(userId);
    const subRef = snap.ref;
    const auditRef = db.collection('affiliate_commission_audits').doc();

    try {
        await db.runTransaction(async (t) => {
            const subSnap = await t.get(subRef);
            if (!subSnap.exists) return;
            const subD = subSnap.data() || {};
            if (subD.commissionApplied === true) return;

            const uSnap = await t.get(userRef);
            if (!uSnap.exists) return;
            const u = uSnap.data() || {};
            if (u.affiliateLastCommissionSessionId === sessionId) {
                t.set(
                    subRef,
                    {
                        commissionApplied: true,
                        commissionDedupe: 'user_session_marker',
                        processedAt: admin.firestore.FieldValue.serverTimestamp(),
                    },
                    { merge: true }
                );
                return;
            }

            let agentUid = null;
            const code = normalizeReferralCode(u.referred_by);
            if (code) {
                const regSnap = await t.get(db.collection('affiliate_referral_codes').doc(code));
                if (regSnap.exists) {
                    agentUid = regSnap.data()?.uid || null;
                }
            }

            if (!agentUid && data.affiliateId && typeof data.affiliateId === 'string') {
                const aid = data.affiliateId.trim();
                const agSnap = await t.get(db.collection('users').doc(aid));
                if (agSnap.exists && String(agSnap.data()?.role || '').toLowerCase() === 'affiliate_agent') {
                    agentUid = aid;
                }
            }

            if (!agentUid || agentUid === userId) {
                t.set(
                    subRef,
                    {
                        commissionApplied: false,
                        commissionSkipReason: !agentUid ? 'no_agent' : 'self_referral',
                        processedAt: admin.firestore.FieldValue.serverTimestamp(),
                    },
                    { merge: true }
                );
                return;
            }

            const agentRef = db.collection('users').doc(agentUid);
            const agentSnap = await t.get(agentRef);
            if (!agentSnap.exists || String(agentSnap.data()?.role || '').toLowerCase() !== 'affiliate_agent') {
                t.set(
                    subRef,
                    {
                        commissionApplied: false,
                        commissionSkipReason: 'invalid_agent',
                        processedAt: admin.firestore.FieldValue.serverTimestamp(),
                    },
                    { merge: true }
                );
                return;
            }

            const agentData = agentSnap.data() || {};
            const countBefore = getSuccessfulSaleCountForTiering(agentData);
            const tierReferralIndex = countBefore + 1;
            const rateBps = commissionRateBpsForSaleNumber(tierReferralIndex);
            const commissionCents = commissionCentsFromGrossBps(amountTotal, rateBps);

            if (commissionCents <= 0) {
                t.set(
                    subRef,
                    {
                        commissionApplied: false,
                        commissionSkipReason: 'zero_commission',
                        commissionRateBps: rateBps,
                        tierReferralIndex,
                        processedAt: admin.firestore.FieldValue.serverTimestamp(),
                    },
                    { merge: true }
                );
                return;
            }

            const pending = Math.max(0, Number(agentData.pending_referrals_count) || 0);
            const nextPending = Math.max(0, pending - 1);
            const ledgerRef = agentRef.collection('commissions_history').doc();
            const agentCountryCode =
                typeof agentData.countryCode === 'string' && agentData.countryCode.trim()
                    ? String(agentData.countryCode).trim().slice(0, 8)
                    : null;

            t.update(userRef, {
                affiliateLastCommissionSessionId: sessionId,
            });
            t.update(agentRef, {
                current_balance: admin.firestore.FieldValue.increment(commissionCents),
                total_earned: admin.firestore.FieldValue.increment(commissionCents),
                pending_referrals_count: nextPending,
                referral_count: admin.firestore.FieldValue.increment(1),
                successful_referrals_count: admin.firestore.FieldValue.increment(1),
            });
            t.set(ledgerRef, {
                type: 'business_subscription',
                amountCents: commissionCents,
                commissionRateBps: rateBps,
                tierReferralIndex,
                currency,
                referredUserId: userId,
                stripeSessionId: sessionId,
                stripePaymentIntentId: data.stripePaymentIntentId || null,
                subscriptionId: data.subscriptionId || null,
                planId: data.planId || null,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            t.set(
                subRef,
                {
                    commissionApplied: true,
                    commissionCents,
                    commissionRateBps: rateBps,
                    commissionRate: rateBps / 10000,
                    tierReferralIndex,
                    referralCountBefore: countBefore,
                    agentUid,
                    processedAt: admin.firestore.FieldValue.serverTimestamp(),
                },
                { merge: true }
            );
            t.set(auditRef, {
                kind: 'business_subscription_commission',
                agentUid,
                agentCountryCode,
                subscriberUserId: userId,
                stripeSessionId: sessionId,
                stripePaymentIntentId: data.stripePaymentIntentId || null,
                grossAmountCents: amountTotal,
                commissionCents,
                commissionRateBps: rateBps,
                tierReferralIndex,
                referralCountBefore: countBefore,
                currency,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        });

        functions.logger.info('[onBusinessSubscriptionCreated] done', { userId, sessionId });

        const refreshed = await subRef.get();
        const rd = refreshed.data() || {};
        if (rd.commissionApplied === true && rd.agentUid && typeof rd.agentUid === 'string') {
            const comm = Math.floor(Number(rd.commissionCents) || 0);
            const gross = Math.floor(Number(rd.grossAmountCents) || amountTotal);
            await notifyAffiliateReferralPlanPurchased(db, admin, {
                agentUid: rd.agentUid,
                subscriberUserId: userId,
                sessionId: docId,
                commissionCents: comm,
                grossCents: gross,
                currency,
                planId: rd.planId || data.planId || null,
            });
        }
    } catch (e) {
        functions.logger.error('[onBusinessSubscriptionCreated]', e?.message || e);
        throw e;
    }
}

/**
 * Reverse a previously applied commission when Stripe refunds the charge (full refund only).
 * Idempotent via business_subscriptions.commissionReversed.
 */
async function reverseAffiliateCommissionOnChargeRefunded(charge) {
    const pi =
        typeof charge.payment_intent === 'string'
            ? charge.payment_intent
            : charge.payment_intent && typeof charge.payment_intent === 'object'
              ? charge.payment_intent.id
              : null;
    if (!pi) {
        functions.logger.info('[affiliateRefund] skip: no payment_intent on charge', charge.id);
        return;
    }
    const amount = Number(charge.amount) || 0;
    const refunded = Number(charge.amount_refunded) || 0;
    if (amount <= 0 || refunded < amount) {
        functions.logger.info('[affiliateRefund] skip: partial or zero refund', { chargeId: charge.id, amount, refunded });
        return;
    }

    const q = await db.collection('business_subscriptions').where('stripePaymentIntentId', '==', pi).limit(5).get();
    if (q.empty) {
        functions.logger.info('[affiliateRefund] no business_subscriptions for PI', pi);
        return;
    }

    for (const doc of q.docs) {
        const subRef = doc.ref;
        try {
            await db.runTransaction(async (t) => {
                const subSnap = await t.get(subRef);
                if (!subSnap.exists) return;
                const sub = subSnap.data() || {};
                if (sub.commissionApplied !== true || sub.commissionReversed === true) return;
                const commissionCents = Math.floor(Number(sub.commissionCents) || 0);
                if (commissionCents <= 0) return;
                const agentUid = typeof sub.agentUid === 'string' ? sub.agentUid : null;
                if (!agentUid) return;

                const agentRef = db.collection('users').doc(agentUid);
                const agentSnap = await t.get(agentRef);
                if (!agentSnap.exists) return;

                const agentData = agentSnap.data() || {};
                const bal = Math.max(0, Math.floor(Number(agentData.current_balance) || 0));
                const totEarned = Math.max(0, Math.floor(Number(agentData.total_earned) || 0));
                const rc = Math.max(0, Math.floor(Number(agentData.referral_count) || 0));
                const sr = Math.max(0, Math.floor(Number(agentData.successful_referrals_count) || 0));
                const claw = Math.min(commissionCents, bal, totEarned);

                const reversalAudit = db.collection('affiliate_commission_audits').doc();
                t.update(agentRef, {
                    current_balance: bal - claw,
                    total_earned: totEarned - claw,
                    referral_count: Math.max(0, rc - 1),
                    successful_referrals_count: Math.max(0, sr - 1),
                });
                t.set(
                    subRef,
                    {
                        commissionReversed: true,
                        commissionReversedAt: admin.firestore.FieldValue.serverTimestamp(),
                        commissionReversalCents: claw,
                        stripeRefundChargeId: charge.id,
                    },
                    { merge: true }
                );
                t.set(reversalAudit, {
                    kind: 'business_subscription_commission_reversal',
                    agentUid,
                    subscriberUserId: sub.subscriberUserId || null,
                    stripeSessionId: sub.stripeSessionId || subRef.id,
                    stripePaymentIntentId: pi,
                    commissionCents: -claw,
                    stripeRefundChargeId: charge.id,
                    currency: String(sub.currency || 'usd').toLowerCase(),
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                });
            });
            functions.logger.info('[affiliateRefund] reversed commission', { subId: subRef.id, pi });
        } catch (e) {
            functions.logger.error('[affiliateRefund] transaction failed', subRef.id, e?.message || e);
        }
    }
}

const onBusinessSubscriptionCreated = functions.firestore
    .document('business_subscriptions/{docId}')
    .onCreate(async (snap) => {
        await applyCommissionFromBusinessSubscriptionCreate(db, admin, snap);
        return null;
    });

module.exports = {
    incrementReferralClicks,
    syncAffiliatePendingReferralOnUserWrite,
    processAffiliateBusinessCommission,
    onBusinessSubscriptionCreated,
    reverseAffiliateCommissionOnChargeRefunded,
};
