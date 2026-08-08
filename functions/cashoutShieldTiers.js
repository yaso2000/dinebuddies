/**
 * Fixed shield cash-out packages. Mirrors src/utils/cashoutShieldTiers.js.
 * Cash-out redeems a shield package only — never an arbitrary credit amount.
 */

const CASHOUT_SHIELD_TIERS = [
    { id: 'silver', defaultLabel: 'Silver', amountCredits: 4000, amountFiatUsd: 40 },
    { id: 'gold', defaultLabel: 'Gold', amountCredits: 6000, amountFiatUsd: 60 },
    { id: 'platinum', defaultLabel: 'Platinum', amountCredits: 8000, amountFiatUsd: 80 },
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
