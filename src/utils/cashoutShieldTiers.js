/**
 * Fixed Jar cash-out packages (not arbitrary credit amounts).
 * Eligibility uses CURRENT `savedCredits`. Visual shield progress uses
 * `totalSavedCreditsEarned` and is never reduced by cash-out.
 *
 * `id` reuses the existing gift-shield visual theme keys (bronze/silver/gold/
 * platinum/diamond), and the user-facing `labelKey`s deliberately reuse the
 * same `gift_shield_*` translations as the separate lifetime "Gift Shields"
 * badge feature (src/utils/giftShieldTiers.js) — both features show the same
 * jar art, so they now show the same names too instead of two vocabularies
 * (size words here vs. metal names there) for what looks like one system.
 *
 * Keep in sync with functions/cashoutShieldTiers.js and Terms §9.
 */

/** @typedef {'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond'} CashoutJarType */

/** @type {ReadonlyArray<{
 *   id: CashoutJarType,
 *   labelKey: string,
 *   defaultLabel: string,
 *   amountCredits: number,
 *   amountFiatUsd: number,
 * }>} */
export const CASHOUT_SHIELD_TIERS = [
    {
        id: 'bronze',
        labelKey: 'gift_shield_bronze',
        defaultLabel: 'Bronze',
        amountCredits: 625,
        amountFiatUsd: 6.25,
    },
    {
        id: 'silver',
        labelKey: 'gift_shield_silver',
        defaultLabel: 'Silver',
        amountCredits: 1250,
        amountFiatUsd: 12.5,
    },
    {
        id: 'gold',
        labelKey: 'gift_shield_gold',
        defaultLabel: 'Gold',
        amountCredits: 2500,
        amountFiatUsd: 25,
    },
    {
        id: 'platinum',
        labelKey: 'gift_shield_platinum',
        defaultLabel: 'Platinum',
        amountCredits: 5000,
        amountFiatUsd: 50,
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
 * @param {CashoutJarType | string} shieldType
 */
export function canCashoutShield(savedCredits, shieldType) {
    const tier = getCashoutShieldTier(shieldType);
    if (!tier) return false;
    const balance = Math.max(0, Math.floor(Number(savedCredits) || 0));
    return balance >= tier.amountCredits;
}

/**
 * Greedy denomination breakdown of a Cherry balance into Jars — largest first.
 * Since each tier is exactly double the one before it, this always yields the
 * fewest possible jars (equivalent to a binary-style breakdown), so it doubles
 * as the natural "2 small = 1 medium" merge behavior with no separate stored
 * merge state: a balance of 1250 always reads as one Medium jar, never two
 * Small jars.
 * @param {unknown} savedCredits
 * @returns {{ items: Array<{ id: CashoutJarType, count: number, tier: (typeof CASHOUT_SHIELD_TIERS)[number] }>, looseCredits: number }}
 */
export function computeJarBreakdown(savedCredits) {
    let remaining = Math.max(0, Math.floor(Number(savedCredits) || 0));
    const items = [];
    for (let i = CASHOUT_SHIELD_TIERS.length - 1; i >= 0; i -= 1) {
        const tier = CASHOUT_SHIELD_TIERS[i];
        const count = Math.floor(remaining / tier.amountCredits);
        if (count > 0) {
            items.push({ id: tier.id, count, tier });
            remaining -= count * tier.amountCredits;
        }
    }
    return { items, looseCredits: remaining };
}
