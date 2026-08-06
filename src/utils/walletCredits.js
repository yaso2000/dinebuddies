/** Fraction of gift face value credited to recipient savings wallet (server-enforced). */
export const GIFT_RECIPIENT_VALUE_RATE = 0.5;

/** Purchased balance (`users.paidCredits`) — spent first for invites, AI, and gifts. */
export function getPurchaseCredits(userProfile) {
    return Math.max(0, Math.floor(Number(userProfile?.paidCredits) || 0));
}

/** Savings balance from received gifts (`users.savedCredits`). */
export function getSavedCredits(userProfile) {
    return Math.max(0, Math.floor(Number(userProfile?.savedCredits) || 0));
}

/**
 * Spendable for invites, AI, and gifts: purchase + savings.
 * Server spends purchase first, then savings.
 */
export function getSpendableCredits(userProfile) {
    return getPurchaseCredits(userProfile) + getSavedCredits(userProfile);
}

/** Alias used by invitation create gates — includes savings. */
export function getTotalDineCredits(userProfile) {
    return getSpendableCredits(userProfile);
}

/** @param {number} giftSentAmount Amount deducted from sender purchase wallet */
export function computeGiftSavedAmount(giftSentAmount) {
    const sent = Math.floor(Number(giftSentAmount));
    if (!Number.isFinite(sent) || sent <= 0) return 0;
    return Math.max(0, Math.floor(sent * GIFT_RECIPIENT_VALUE_RATE));
}
