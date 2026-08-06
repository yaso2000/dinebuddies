/**
 * Pure two-wallet spend planning (no Firestore).
 * Mirrors functions/creditsSpendMath.js — keep in sync.
 */

/**
 * @param {{
 *   paidCredits?: unknown,
 *   savedCredits?: unknown,
 *   amount: unknown,
 *   allowSavedCredits?: boolean,
 * }} args
 */
export function planCreditSpend(args) {
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
export function planAiCreditRefund(charged) {
    const paidUsed = Math.max(0, Math.floor(Number(charged?.paidUsed) || 0));
    const savedUsed = Math.max(0, Math.floor(Number(charged?.savedUsed) || 0));
    return {
        paidUsed,
        savedUsed,
        shouldRefund: paidUsed > 0 || savedUsed > 0,
        forbiddenFields: ['totalSavedCreditsEarned'],
    };
}

export const SPEND_ALLOWED_USER_FIELDS = new Set([
    'paidCredits',
    'savedCredits',
    'totalCreditsSpent',
    'updatedAt',
]);
