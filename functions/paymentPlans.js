const CHECKOUT_ITEMS = {
    p2: {
        id: 'p2',
        aliases: ['pro'],
        type: 'subscription',
        mode: 'subscription',
        priceId: 'price_1T4DptKpQn3RDJUCrhwtOx0u',
        tier: 'pro',
        weeklyPrivateQuota: 2,
        name: 'Pro Plan',
    },
    p3: {
        id: 'p3',
        aliases: ['premium', 'vip'],
        type: 'subscription',
        mode: 'subscription',
        priceId: 'price_1T4DrkKpQn3RDJUC7cPercNu',
        tier: 'vip',
        weeklyPrivateQuota: -1,
        name: 'Premium Plan',
    },
    p4: {
        id: 'p4',
        aliases: ['professional'],
        type: 'subscription',
        mode: 'subscription',
        priceId: 'price_1T4DfJKpQn3RDJUC4ANefmpl',
        tier: 'professional',
        weeklyPrivateQuota: 0,
        name: 'Professional Business Plan',
    },
    p5: {
        id: 'p5',
        aliases: ['elite'],
        type: 'subscription',
        mode: 'subscription',
        priceId: 'price_1T4DlqKpQn3RDJUC6vrueW0n',
        tier: 'elite',
        weeklyPrivateQuota: 0,
        name: 'Elite Partner Plan',
    },
    c1: {
        id: 'c1',
        type: 'private_pack',
        mode: 'payment',
        priceId: 'price_1T4DyrKpQn3RDJUCN6ipD592',
        privateCredits: 1,
        name: 'Single Private Invitation',
    },
    c2: {
        id: 'c2',
        type: 'private_pack',
        mode: 'payment',
        priceId: 'price_1T4E1aKpQn3RDJUCMLLV7g4D',
        privateCredits: 3,
        name: '3 Private Invitations',
    },
    c3: {
        id: 'c3',
        type: 'private_pack',
        mode: 'payment',
        priceId: 'price_1T4E1xKpQn3RDJUC6wYEr9I1',
        privateCredits: 5,
        name: '5 Private Invitations',
    },
    c4: {
        id: 'c4',
        type: 'private_pack',
        mode: 'payment',
        priceId: 'price_1T4E3EKpQn3RDJUC97Rro1xj',
        privateCredits: 10,
        name: '10 Private Invitations',
    },
    c5: {
        id: 'c5',
        type: 'private_pack',
        mode: 'payment',
        priceId: 'price_1T4E8AKpQn3RDJUCc3tJwnAI',
        privateCredits: 20,
        name: '20 Private Invitations',
    },
    d1: {
        id: 'd1',
        type: 'private_pack',
        mode: 'payment',
        priceId: 'price_1TDaNMKpQn3RDJUCWAJdI5YZ',
        privateCredits: 5,
        name: '5 Dating Invitations',
    },
    d2: {
        id: 'd2',
        type: 'private_pack',
        mode: 'payment',
        priceId: 'price_1TDaO5KpQn3RDJUC0vD1Afzj',
        privateCredits: 10,
        name: '10 Dating Invitations',
    },
    o1: {
        id: 'o1',
        type: 'offer_pack',
        mode: 'payment',
        priceId: 'price_1T5mIGKpQn3RDJUCMzhlyN6a',
        offerCredits: 1,
        name: '50 Hour Offer Slot',
    },
};

const CHECKOUT_ITEMS_BY_PRICE = Object.values(CHECKOUT_ITEMS).reduce((acc, item) => {
    acc[item.priceId] = item;
    return acc;
}, {});

function normalizeId(value) {
    return String(value || '').trim().toLowerCase();
}

function getCheckoutItemByPrice(priceId) {
    return CHECKOUT_ITEMS_BY_PRICE[String(priceId || '').trim()] || null;
}

function getCheckoutItemById(id) {
    const normalized = normalizeId(id);
    if (CHECKOUT_ITEMS[normalized]) return CHECKOUT_ITEMS[normalized];
    return Object.values(CHECKOUT_ITEMS).find((item) =>
        (item.aliases || []).some((alias) => normalizeId(alias) === normalized)
    ) || null;
}

function resolveCheckoutItem({ priceId, planId } = {}) {
    const byPrice = getCheckoutItemByPrice(priceId);
    if (!byPrice) return null;

    const requested = normalizeId(planId);
    if (!requested) return byPrice;

    const allowedIds = [byPrice.id, ...(byPrice.aliases || [])].map(normalizeId);
    return allowedIds.includes(requested) ? byPrice : byPrice;
}

module.exports = {
    CHECKOUT_ITEMS,
    getCheckoutItemByPrice,
    getCheckoutItemById,
    resolveCheckoutItem,
};
