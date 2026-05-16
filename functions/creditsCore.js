/**
 * Dine Credits — server-side ledger and spend helpers.
 * Never expose raw balance updates to clients; use transactions + credit_transactions.
 */
const admin = require('firebase-admin');
if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

/** @typedef {'user'|'business'} AccountRole */

const FREE_CREDITS_MONTHLY_GRANT = 10;
const FREE_CREDITS_CAP = 20;

const CREDIT_COSTS = {
    /** Public invitations use the `invitations` collection and are not charged via this constant. */
    PRIVATE_INVITATION: 90,
    DATING_INVITATION: 185,
    INVITATION_BOOST: 50,
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
    if (t === 'paid') return 'paid';
    if (t === 'elite' || t === 'professional' || t === 'premium' || t === 'pro') return 'paid';
    return 'free';
}

/**
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
 * @returns {{ freeUsed: number, paidUsed: number, balanceType: string }}
 */
function spendCreditsInTransaction(tx, userRef, userData, args) {
    const { uid, accountRole, amount, type, reason, relatedId } = args;
    const id = `${String(type || '')}|${String(reason || '')}`.toLowerCase();
    if (
        id.includes('ai_image') ||
        id.includes('ai_text') ||
        id.includes('ai_rewrite') ||
        id.includes('ai_review') ||
        id.includes('openai') ||
        id.includes('gemini')
    ) {
        const err = new Error('AI_SPEND_DISABLED');
        err.code = 'AI_SPEND_DISABLED';
        throw err;
    }

    const n = Math.floor(Number(amount));
    if (!Number.isFinite(n) || n <= 0) {
        return { freeUsed: 0, paidUsed: 0, balanceType: 'none' };
    }

    let free = Math.max(0, Math.floor(Number(userData.freeCredits) || 0));
    let paid = Math.max(0, Math.floor(Number(userData.paidCredits) || 0));
    const total = free + paid;
    if (total < n) {
        const err = new Error('INSUFFICIENT_CREDITS');
        err.code = 'INSUFFICIENT_CREDITS';
        throw err;
    }

    const fromFree = Math.min(free, n);
    const fromPaid = n - fromFree;
    free -= fromFree;
    paid -= fromPaid;

    const balanceType = fromFree > 0 && fromPaid > 0 ? 'mixed' : fromFree > 0 ? 'free' : 'paid';

    tx.update(userRef, {
        freeCredits: free,
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
        balanceType,
        reason: String(reason || '').slice(0, 200),
        relatedId: relatedId ? String(relatedId).slice(0, 200) : null,
        createdAt: FieldValue.serverTimestamp(),
        freeUsed: fromFree,
        paidUsed: fromPaid,
    });

    return { freeUsed: fromFree, paidUsed: fromPaid, balanceType };
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
        reason: String(args.reason || '').slice(0, 200),
        relatedId: args.relatedId ? String(args.relatedId).slice(0, 200) : null,
        createdAt: FieldValue.serverTimestamp(),
    });
}

/**
 * Monthly free grant for regular users only (not business/partner).
 * @param {FirebaseFirestore.Transaction} tx
 * @param {FirebaseFirestore.DocumentReference} userRef
 * @param {Record<string, unknown>} userData
 * @param {string} uid
 */
function grantMonthlyFreeBonusInTransaction(tx, userRef, userData, uid) {
    const current = Math.max(0, Math.floor(Number(userData.freeCredits) || 0));
    const next = Math.min(FREE_CREDITS_CAP, current + FREE_CREDITS_MONTHLY_GRANT);
    if (next === current) return;

    tx.update(userRef, {
        freeCredits: next,
        updatedAt: FieldValue.serverTimestamp(),
    });
    const ledgerRef = db.collection('credit_transactions').doc();
    tx.set(ledgerRef, {
        userId: uid,
        accountRole: 'user',
        type: 'monthly_bonus',
        amount: next - current,
        balanceType: 'free',
        reason: 'monthly_free_allowance',
        relatedId: null,
        createdAt: FieldValue.serverTimestamp(),
    });
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
    FREE_CREDITS_MONTHLY_GRANT,
    FREE_CREDITS_CAP,
    CREDIT_COSTS,
    CREDIT_PACKAGES,
    priceIdToCreditPackage,
    getBusinessMonthlyPriceId,
    normalizeBusinessSubscriptionTier,
    spendCreditsInTransaction,
    grantPaidCreditsInTransaction,
    grantMonthlyFreeBonusInTransaction,
    isRegularUserDoc,
    isBusinessUserDoc,
};
