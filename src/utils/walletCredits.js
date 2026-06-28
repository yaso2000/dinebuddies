/** Fraction of gift face value credited to recipient savings wallet (server-enforced). */
export const GIFT_RECIPIENT_VALUE_RATE = 0.5;

/** Purchased / spendable balance (`users.paidCredits`). */
export function getPurchaseCredits(userProfile) {
    return Math.max(0, Math.floor(Number(userProfile?.paidCredits) || 0));
}

/** Savings balance from received gifts (`users.savedCredits`). */
export function getSavedCredits(userProfile) {
    return Math.max(0, Math.floor(Number(userProfile?.savedCredits) || 0));
}

/** @deprecated use getPurchaseCredits — spending draws from purchase wallet only */
export function getTotalDineCredits(userProfile) {
    return getPurchaseCredits(userProfile);
}

/** @param {number} giftSentAmount Amount deducted from sender purchase wallet */
export function computeGiftSavedAmount(giftSentAmount) {
    const sent = Math.floor(Number(giftSentAmount));
    if (!Number.isFinite(sent) || sent <= 0) return 0;
    return Math.max(0, Math.floor(sent * GIFT_RECIPIENT_VALUE_RATE));
}
