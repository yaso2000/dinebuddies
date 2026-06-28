/**
 * Dine Credits — server-side ledger and spend helpers.
 * Two wallets (never mixed on the client):
 * - `paidCredits` — purchase / consumption wallet
 * - `savedCredits` — gift receipts at 50% of sent value
 * Never expose raw balance updates to clients; use transactions + credit_transactions.
 */
const admin = require('firebase-admin');
if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

/** @typedef {'user'|'business'} AccountRole */

/** Recipient receives this fraction of the gift amount sent from purchase wallet. */
const GIFT_RECIPIENT_VALUE_RATE = 0.5;

const CREDIT_COSTS = {
    /** Public invitations use the `invitations` collection and are not charged via this constant. */
    PRIVATE_INVITATION: 90,
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
    return String(raw || 'free').trim().toLowerCase() === 'paid' ? 'paid' : 'free';
}

/** @param {number} giftSentAmount */
function computeGiftSavedAmount(giftSentAmount) {
    const sent = Math.floor(Number(giftSentAmount));
    if (!Number.isFinite(sent) || sent <= 0) return 0;
    return Math.max(0, Math.floor(sent * GIFT_RECIPIENT_VALUE_RATE));
}

/**
 * Spend from purchase wallet (`paidCredits`) only.
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
 * }} args
 * @returns {{ paidUsed: number, balanceType: string }}
 */
function spendCreditsInTransaction(tx, userRef, userData, args) {
    const { uid, accountRole, amount, type, reason, relatedId } = args;
    const n = Math.floor(Number(amount));
    if (!Number.isFinite(n) || n <= 0) {
        return { paidUsed: 0, balanceType: 'none' };
    }

    let paid = Math.max(0, Math.floor(Number(userData.paidCredits) || 0));
    if (paid < n) {
        const err = new Error('INSUFFICIENT_CREDITS');
        err.code = 'INSUFFICIENT_CREDITS';
        throw err;
    }

    paid -= n;

    tx.update(userRef, {
        paidCredits: paid,
        totalCreditsSpent: FieldValue.increment(n),
        updatedAt: FieldValue.serverTimestamp(),
    });

    const ledgerRef = db.collection('credit_transactions').doc();
    tx.set(ledgerRef, {
        userId: uid,
        accountRole,
        type,
        amount: -n,
        balanceType: 'paid',
        wallet: 'purchase',
        reason: String(reason || '').slice(0, 200),
        relatedId: relatedId ? String(relatedId).slice(0, 200) : null,
        createdAt: FieldValue.serverTimestamp(),
        paidUsed: n,
        freeUsed: 0,
    });

    return { paidUsed: n, balanceType: 'paid', freeUsed: 0 };
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
};
