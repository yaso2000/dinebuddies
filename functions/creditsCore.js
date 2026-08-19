/**
 * Dine Credits — server-side ledger and spend helpers.
 * Two wallets:
 * - `paidCredits` — purchase wallet (buys, gifts-out, and primary spend)
 * - `savedCredits` — gift receipts at 50% of sent value; spendable on internal
 *   services (invites, AI) after purchase balance, unless allowSavedCredits=false
 * Never expose raw balance updates to clients; use transactions + credit_transactions.
 */
const admin = require('firebase-admin');
if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;
const { planCreditSpend } = require('./creditsSpendMath');

/** @typedef {'user'|'business'} AccountRole */

/** Recipient receives this fraction of the gift amount sent from purchase wallet. */
const GIFT_RECIPIENT_VALUE_RATE = 0.3;

const CREDIT_COSTS = {
    /** Public invitations use the `invitations` collection and are not charged via this constant. */
    /** Social hosted invite publish (`social_invitations`, multi-guest). */
    SOCIAL_INVITATION: 90,
    /** Personal/private 1-on-1 hosted invite publish. */
    PRIVATE_INVITATION: 185,
    /** @deprecated Use SOCIAL_INVITATION — kept for older call sites during deploy rollout. */
    PRIVATE_INVITATION_LEGACY_SOCIAL: 90,
    /** @deprecated Use PRIVATE_INVITATION — former dating cost key. */
    DATING_INVITATION: 185,
    INVITATION_BOOST: 50,
    AI_TEXT_REGULAR: 10,
    AI_REWRITE: 5,
    AI_IMAGE: 50,
    AI_REVIEW_REPLY: 5,
};

const CREDIT_PACKAGES = {
    credits_200: { credits: 200, envKey: 'STRIPE_PRICE_CREDITS_200' },
    credits_500: { credits: 500, envKey: 'STRIPE_PRICE_CREDITS_500' },
    credits_1000: { credits: 1000, envKey: 'STRIPE_PRICE_CREDITS_1000' },
    credits_3000: { credits: 3000, envKey: 'STRIPE_PRICE_CREDITS_3000' },
};

function priceIdToCreditPackage() {
    /** @type {Record<string, { packageId: string, credits: number }>} */
    const m = {};
    for (const [packageId, def] of Object.entries(CREDIT_PACKAGES)) {
        const pid = process.env[def.envKey];
        if (pid && String(pid).trim()) {
            m[String(pid).trim()] = { packageId, credits: def.credits };
        }
    }
    return m;
}

function getBusinessMonthlyPriceId() {
    return String(process.env.STRIPE_PRICE_BUSINESS_MONTHLY || '').trim();
}

/**
 * Normalize legacy business tiers → paid for permissions until Firestore is migrated.
 * @param {string|null|undefined} raw
 */
function normalizeBusinessSubscriptionTier(raw) {
    const t = String(raw || 'free').trim().toLowerCase();
    // Keep in sync with src/config/businessPlanFeatures.js normalizeBusinessPlanTier.
    if (t === 'paid' || t === 'elite' || t === 'professional' || t === 'pro' || t === 'business') {
        return 'paid';
    }
    return 'free';
}

/** @param {number} giftSentAmount */
function computeGiftSavedAmount(giftSentAmount) {
    const sent = Math.floor(Number(giftSentAmount));
    if (!Number.isFinite(sent) || sent <= 0) return 0;
    return Math.max(0, Math.floor(sent * GIFT_RECIPIENT_VALUE_RATE));
}

/**
 * Spend credits: purchase wallet first, then savings (when allowSavedCredits).
 * Internal spends (invites, AI, gifts) use default allowSavedCredits=true.
 * @param {FirebaseFirestore.Transaction} tx
 * @param {FirebaseFirestore.DocumentReference} userRef
 * @param {Record<string, unknown>} userData
 * @param {{
 *   uid: string,
 *   accountRole: AccountRole,
 *   amount: number,
 *   type: string,
 *   reason: string,
 *   relatedId?: string|null,
 *   allowSavedCredits?: boolean,
 * }} args
 * @returns {{ paidUsed: number, savedUsed: number, freeUsed: number, balanceType: string }}
 */
function spendCreditsInTransaction(tx, userRef, userData, args) {
    const { uid, accountRole, amount, type, reason, relatedId } = args;
    const planned = planCreditSpend({
        paidCredits: userData.paidCredits,
        savedCredits: userData.savedCredits,
        amount,
        allowSavedCredits: args.allowSavedCredits,
    });

    if (!planned.ok) {
        if (planned.code === 'INVALID_AMOUNT') {
            return { paidUsed: 0, savedUsed: 0, freeUsed: 0, balanceType: 'none' };
        }
        const err = new Error('INSUFFICIENT_CREDITS');
        err.code = 'INSUFFICIENT_CREDITS';
        throw err;
    }

    const { amount: n, paidUsed, savedUsed, paidAfter, savedAfter, balanceType, wallet } = planned;

    /** @type {Record<string, unknown>} */
    const patch = {
        paidCredits: paidAfter,
        // STRICT: increment by full deduction; never touch totalSavedCreditsEarned (Shield).
        totalCreditsSpent: FieldValue.increment(n),
        updatedAt: FieldValue.serverTimestamp(),
    };
    if (savedUsed > 0) {
        patch.savedCredits = savedAfter;
    }
    tx.update(userRef, patch);

    // Keep in-tx reads consistent if the same user doc is reused later.
    userData.paidCredits = paidAfter;
    if (savedUsed > 0) {
        userData.savedCredits = savedAfter;
    }

    const ledgerRef = db.collection('credit_transactions').doc();
    tx.set(ledgerRef, {
        userId: uid,
        accountRole,
        type,
        amount: -n,
        balanceType,
        wallet,
        reason: String(reason || '').slice(0, 200),
        relatedId: relatedId ? String(relatedId).slice(0, 200) : null,
        createdAt: FieldValue.serverTimestamp(),
        paidUsed,
        savedUsed,
        freeUsed: 0,
    });

    return { paidUsed, savedUsed, freeUsed: 0, balanceType };
}

/**
 * @param {FirebaseFirestore.Transaction} tx
 * @param {FirebaseFirestore.DocumentReference} userRef
 * @param {Record<string, unknown>} userData
 * @param {{
 *   uid: string,
 *   accountRole: AccountRole,
 *   credits: number,
 *   type: string,
 *   reason: string,
 *   relatedId?: string|null,
 * }} args
 */
function grantPaidCreditsInTransaction(tx, userRef, userData, args) {
    const n = Math.floor(Number(args.credits));
    if (!Number.isFinite(n) || n <= 0) return;

    tx.update(userRef, {
        paidCredits: Math.max(0, Math.floor(Number(userData.paidCredits) || 0)) + n,
        totalCreditsPurchased: FieldValue.increment(n),
        updatedAt: FieldValue.serverTimestamp(),
    });

    const ledgerRef = db.collection('credit_transactions').doc();
    tx.set(ledgerRef, {
        userId: args.uid,
        accountRole: args.accountRole,
        type: args.type,
        amount: n,
        balanceType: 'paid',
        wallet: 'purchase',
        reason: String(args.reason || '').slice(0, 200),
        relatedId: args.relatedId ? String(args.relatedId).slice(0, 200) : null,
        createdAt: FieldValue.serverTimestamp(),
    });
}

/**
 * Credit savings wallet from a received gift (50% of sent amount).
 * @param {FirebaseFirestore.Transaction} tx
 * @param {FirebaseFirestore.DocumentReference} userRef
 * @param {Record<string, unknown>} userData
 * @param {{
 *   uid: string,
 *   accountRole: AccountRole,
 *   credits: number,
 *   type: string,
 *   reason: string,
 *   relatedId?: string|null,
 *   giftSentAmount?: number|null,
 * }} args
 */
function grantSavedCreditsInTransaction(tx, userRef, userData, args) {
    const n = Math.floor(Number(args.credits));
    if (!Number.isFinite(n) || n <= 0) return;

    tx.update(userRef, {
        savedCredits: Math.max(0, Math.floor(Number(userData.savedCredits) || 0)) + n,
        totalSavedCreditsEarned: FieldValue.increment(n),
        updatedAt: FieldValue.serverTimestamp(),
    });

    const ledgerRef = db.collection('credit_transactions').doc();
    tx.set(ledgerRef, {
        userId: args.uid,
        accountRole: args.accountRole,
        type: args.type,
        amount: n,
        balanceType: 'saved',
        wallet: 'savings',
        reason: String(args.reason || '').slice(0, 200),
        relatedId: args.relatedId ? String(args.relatedId).slice(0, 200) : null,
        giftSentAmount: args.giftSentAmount != null ? Math.floor(Number(args.giftSentAmount)) : null,
        createdAt: FieldValue.serverTimestamp(),
    });
}

/**
 * Admin grant to purchase wallet (replaces legacy free-credit grants).
 * @param {FirebaseFirestore.Transaction} tx
 * @param {FirebaseFirestore.DocumentReference} userRef
 * @param {Record<string, unknown>} userData
 * @param {string} uid
 * @param {number} amount
 * @param {{ reason?: string, adminUid?: string }} meta
 */
function grantAdminPaidCreditsInTransaction(tx, userRef, userData, uid, amount, meta = {}) {
    const n = Math.floor(Number(amount));
    if (!Number.isFinite(n) || n <= 0) {
        throw new Error('INVALID_AMOUNT');
    }
    const accountRole = isBusinessUserDoc(userData) ? 'business' : 'user';
    const paidBefore = Math.max(0, Math.floor(Number(userData.paidCredits) || 0));

    grantPaidCreditsInTransaction(tx, userRef, userData, {
        uid,
        accountRole,
        credits: n,
        type: 'admin_grant_paid',
        reason: meta.reason ? String(meta.reason).slice(0, 200) : 'admin_grant',
        relatedId: meta.adminUid ? String(meta.adminUid).slice(0, 128) : null,
    });

    return { paidCreditsAfter: paidBefore + n, paidCreditsBefore: paidBefore };
}

function isRegularUserDoc(d) {
    const role = String(d?.role || '').toLowerCase();
    if (d?.isBusiness === true) return false;
    if (role === 'business' || role === 'partner') return false;
    return true;
}

function isBusinessUserDoc(d) {
    return (
        d?.isBusiness === true ||
        String(d?.role || '').toLowerCase() === 'business' ||
        String(d?.role || '').toLowerCase() === 'partner'
    );
}

/** Zero-value patch for all credit wallet + lifetime counters on users/{uid}. */
function creditBalanceResetPatch() {
    return {
        paidCredits: 0,
        savedCredits: 0,
        freeCredits: 0,
        totalCreditsPurchased: 0,
        totalCreditsSpent: 0,
        totalSavedCreditsEarned: 0,
    };
}

/** @param {Record<string, unknown>|null|undefined} userData */
function userHasAnyCreditBalance(userData) {
    const d = userData || {};
    const fields = [
        d.paidCredits,
        d.savedCredits,
        d.freeCredits,
        d.totalCreditsPurchased,
        d.totalCreditsSpent,
        d.totalSavedCreditsEarned,
    ];
    return fields.some((v) => Math.max(0, Math.floor(Number(v) || 0)) > 0);
}

module.exports = {
    db,
    FieldValue,
    GIFT_RECIPIENT_VALUE_RATE,
    CREDIT_COSTS,
    CREDIT_PACKAGES,
    priceIdToCreditPackage,
    getBusinessMonthlyPriceId,
    normalizeBusinessSubscriptionTier,
    computeGiftSavedAmount,
    spendCreditsInTransaction,
    grantPaidCreditsInTransaction,
    grantSavedCreditsInTransaction,
    grantAdminPaidCreditsInTransaction,
    isRegularUserDoc,
    isBusinessUserDoc,
    creditBalanceResetPatch,
    userHasAnyCreditBalance,
};
