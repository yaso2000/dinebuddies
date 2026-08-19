/**
 * Fixed Jar cash-out packages. Mirrors src/utils/cashoutShieldTiers.js.
 * Cash-out redeems Jar packages only — never an arbitrary credit amount.
 * `id` reuses the gift-shield visual theme keys (bronze/silver/gold/platinum/
 * diamond) purely for icon art; user-facing labels are jar sizes and are
 * unrelated to the separate lifetime "Gift Shields" badge feature.
 */

const CASHOUT_SHIELD_TIERS = [
    { id: 'bronze', defaultLabel: 'Bronze', amountCredits: 625, amountFiatUsd: 6.25 },
    { id: 'silver', defaultLabel: 'Silver', amountCredits: 1250, amountFiatUsd: 12.5 },
    { id: 'gold', defaultLabel: 'Gold', amountCredits: 2500, amountFiatUsd: 25 },
    { id: 'platinum', defaultLabel: 'Platinum', amountCredits: 5000, amountFiatUsd: 50 },
    { id: 'diamond', defaultLabel: 'Diamond', amountCredits: 10000, amountFiatUsd: 100 },
];

const CASHOUT_MINIMUM_CREDITS = CASHOUT_SHIELD_TIERS[0].amountCredits;

/** @param {unknown} shieldType */
function getCashoutShieldTier(shieldType) {
    const id = String(shieldType || '')
        .trim()
        .toLowerCase();
    return CASHOUT_SHIELD_TIERS.find((t) => t.id === id) || null;
}

module.exports = {
    CASHOUT_SHIELD_TIERS,
    CASHOUT_MINIMUM_CREDITS,
    getCashoutShieldTier,
};
