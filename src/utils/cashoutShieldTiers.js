/**
 * Fixed shield cash-out packages (not arbitrary credit amounts).
 * Eligibility uses CURRENT `savedCredits`. Visual shield progress uses
 * `totalSavedCreditsEarned` and is never reduced by cash-out.
 *
 * Keep in sync with functions/cashoutShieldTiers.js and Terms §9.
 */

/** @typedef {'silver' | 'gold' | 'platinum' | 'diamond'} CashoutShieldType */

/** @type {ReadonlyArray<{
 *   id: CashoutShieldType,
 *   labelKey: string,
 *   defaultLabel: string,
 *   amountCredits: number,
 *   amountFiatUsd: number,
 * }>} */
export const CASHOUT_SHIELD_TIERS = [
    {
        id: 'silver',
        labelKey: 'gift_shield_silver',
        defaultLabel: 'Silver',
        amountCredits: 4000,
        amountFiatUsd: 40,
    },
    {
        id: 'gold',
        labelKey: 'gift_shield_gold',
        defaultLabel: 'Gold',
        amountCredits: 6000,
        amountFiatUsd: 60,
    },
    {
        id: 'platinum',
        labelKey: 'gift_shield_platinum',
        defaultLabel: 'Platinum',
        amountCredits: 8000,
        amountFiatUsd: 80,
    },
    {
        id: 'diamond',
        labelKey: 'gift_shield_diamond',
        defaultLabel: 'Diamond',
        amountCredits: 10000,
        amountFiatUsd: 100,
    },
];

/** Lowest redeemable package (minimum cash-out). */
export const CASHOUT_MINIMUM_CREDITS = CASHOUT_SHIELD_TIERS[0].amountCredits;

/**
 * @param {unknown} shieldType
 * @returns {(typeof CASHOUT_SHIELD_TIERS)[number] | null}
 */
export function getCashoutShieldTier(shieldType) {
    const id = String(shieldType || '')
        .trim()
        .toLowerCase();
    return CASHOUT_SHIELD_TIERS.find((t) => t.id === id) || null;
}

/**
 * @param {unknown} savedCredits
 * @param {CashoutShieldType | string} shieldType
 */
export function canCashoutShield(savedCredits, shieldType) {
    const tier = getCashoutShieldTier(shieldType);
    if (!tier) return false;
    const balance = Math.max(0, Math.floor(Number(savedCredits) || 0));
    return balance >= tier.amountCredits;
}
