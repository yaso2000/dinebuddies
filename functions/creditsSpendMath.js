/**
 * Pure two-wallet spend planning (no Firestore).
 * Shared rules for creditsCore spend + unit tests.
 */

/**
 * @param {{
 *   paidCredits?: unknown,
 *   savedCredits?: unknown,
 *   amount: unknown,
 *   allowSavedCredits?: boolean,
 * }} args
 * @returns {{
 *   ok: true,
 *   amount: number,
 *   paidUsed: number,
 *   savedUsed: number,
 *   paidAfter: number,
 *   savedAfter: number,
 *   balanceType: string,
 *   wallet: string,
 * } | { ok: false, code: 'INSUFFICIENT_CREDITS' | 'INVALID_AMOUNT', amount: number }}
 */
function planCreditSpend(args) {
    const allowSavedCredits = args.allowSavedCredits !== false;
    const amount = Math.floor(Number(args.amount));
    if (!Number.isFinite(amount) || amount <= 0) {
        return { ok: false, code: 'INVALID_AMOUNT', amount: 0 };
    }

    const paid = Math.max(0, Math.floor(Number(args.paidCredits) || 0));
    const saved = Math.max(0, Math.floor(Number(args.savedCredits) || 0));
    const available = allowSavedCredits ? paid + saved : paid;
    if (available < amount) {
        return { ok: false, code: 'INSUFFICIENT_CREDITS', amount };
    }

    const paidUsed = Math.min(paid, amount);
    const savedUsed = amount - paidUsed;
    const paidAfter = paid - paidUsed;
    const savedAfter = saved - savedUsed;

    let balanceType = 'paid';
    let wallet = 'purchase';
    if (paidUsed > 0 && savedUsed > 0) {
        balanceType = 'mixed';
        wallet = 'purchase_and_savings';
    } else if (savedUsed > 0) {
        balanceType = 'saved';
        wallet = 'savings';
    }

    return {
        ok: true,
        amount,
        paidUsed,
        savedUsed,
        paidAfter,
        savedAfter,
        balanceType,
        wallet,
    };
}

/**
 * Exact wallet refunds for a prior AI charge. Never touches shield/XP fields.
 * @param {{ paidUsed?: unknown, savedUsed?: unknown, freeUsed?: unknown } | null | undefined} charged
 */
function planAiCreditRefund(charged) {
    const paidUsed = Math.max(0, Math.floor(Number(charged?.paidUsed) || 0));
    const savedUsed = Math.max(0, Math.floor(Number(charged?.savedUsed) || 0));
    return {
        paidUsed,
        savedUsed,
        shouldRefund: paidUsed > 0 || savedUsed > 0,
        /** Fields that must never appear on refund patches */
        forbiddenFields: ['totalSavedCreditsEarned'],
    };
}

/**
 * User-doc keys that a spend patch is allowed to touch.
 * Explicitly excludes shield progress.
 */
const SPEND_ALLOWED_USER_FIELDS = new Set([
    'paidCredits',
    'savedCredits',
    'totalCreditsSpent',
    'updatedAt',
]);

module.exports = {
    planCreditSpend,
    planAiCreditRefund,
    SPEND_ALLOWED_USER_FIELDS,
};
