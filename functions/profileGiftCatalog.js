/**
 * Server-authoritative profile gift catalog.
 * Client amounts are ignored when giftId is present — prevents tampering.
 */
const PROFILE_GIFT_CATALOG = {
    like: { credits: 10 },
    coffee: { credits: 25 },
    cake: { credits: 50 },
    rose: { credits: 75 },
    pizza: { credits: 120 }, // legacy id → same tier as donut
    donut: { credits: 120 },
    wine: { credits: 180 },
    gift_box: { credits: 300 },
    crown: { credits: 600 },
    diamond: { credits: 1200 },
};

function normalizeProfileGiftId(giftId) {
    const id = String(giftId || '').trim();
    if (id === 'pizza') return 'donut';
    return id;
}

/**
 * @param {string|null|undefined} giftId
 * @param {number} amountFromClient
 */
function resolveProfileGiftAmount(giftId, amountFromClient) {
    const id = normalizeProfileGiftId(giftId);
    if (id && PROFILE_GIFT_CATALOG[id]) {
        return PROFILE_GIFT_CATALOG[id].credits;
    }
    return Math.floor(Number(amountFromClient));
}

function isKnownProfileGiftId(giftId) {
    const id = normalizeProfileGiftId(giftId);
    return Boolean(id && PROFILE_GIFT_CATALOG[id]);
}

module.exports = {
    PROFILE_GIFT_CATALOG,
    resolveProfileGiftAmount,
    isKnownProfileGiftId,
};
