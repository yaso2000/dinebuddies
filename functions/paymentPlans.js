const CHECKOUT_ITEMS = {
    p2: {
        id: 'p2',
        aliases: ['pro'],
        priceId: 'price_1T4DptKpQn3RDJUCrhwtOx0u',
        mode: 'subscription',
        purchaseType: 'subscription',
        tier: 'pro',
        currentPlan: 'p2',
        weeklyPrivateQuota: 2,
        name: 'Pro Plan',
    },
    p3: {
        id: 'p3',
        aliases: ['premium', 'vip'],
        priceId: 'price_1T4DrkKpQn3RDJUC7cPercNu',
        mode: 'subscription',
        purchaseType: 'subscription',
        tier: 'vip',
        currentPlan: 'p3',
        weeklyPrivateQuota: -1,
        name: 'Premium Plan',
    },
    p4: {
        id: 'p4',
        aliases: ['professional'],
        priceId: 'price_1T4DfJKpQn3RDJUC4ANefmpl',
        mode: 'subscription',
        purchaseType: 'subscription',
        tier: 'professional',
        currentPlan: 'p4',
        weeklyPrivateQuota: 0,
        name: 'Professional Business Plan',
    },
    p5: {
        id: 'p5',
        aliases: ['elite'],
        priceId: 'price_1T4DlqKpQn3RDJUC6vrueW0n',
        mode: 'subscription',
        purchaseType: 'subscription',
        tier: 'elite',
        currentPlan: 'p5',
        weeklyPrivateQuota: 0,
        name: 'Elite Partner Plan',
    },
    c1: {
        id: 'c1',
        aliases: [],
        priceId: 'price_1T4DyrKpQn3RDJUCN6ipD592',
        mode: 'payment',
        purchaseType: 'private_pack',
        amount: 1,
        name: 'Single Private Invitation',
    },
    c2: {
        id: 'c2',
        aliases: [],
        priceId: 'price_1T4E1aKpQn3RDJUCMLLV7g4D',
        mode: 'payment',
        purchaseType: 'private_pack',
        amount: 3,
        name: '3 Private Invitations',
    },
    c3: {
        id: 'c3',
        aliases: [],
        priceId: 'price_1T4E1xKpQn3RDJUC6wYEr9I1',
        mode: 'payment',
        purchaseType: 'private_pack',
        amount: 5,
        name: '5 Private Invitations',
    },
    c4: {
        id: 'c4',
        aliases: [],
        priceId: 'price_1T4E3EKpQn3RDJUC97Rro1xj',
        mode: 'payment',
        purchaseType: 'private_pack',
        amount: 10,
        name: '10 Private Invitations',
    },
    c5: {
        id: 'c5',
        aliases: [],
        priceId: 'price_1T4E8AKpQn3RDJUCc3tJwnAI',
        mode: 'payment',
        purchaseType: 'private_pack',
        amount: 20,
        name: '20 Private Invitations',
    },
    d1: {
        id: 'd1',
        aliases: [],
        priceId: 'price_1TDaNMKpQn3RDJUCWAJdI5YZ',
        mode: 'payment',
        purchaseType: 'private_pack',
        amount: 5,
        name: '5 Dating Invitations',
    },
    d2: {
        id: 'd2',
        aliases: [],
        priceId: 'price_1TDaO5KpQn3RDJUC0vD1Afzj',
        mode: 'payment',
        purchaseType: 'private_pack',
        amount: 10,
        name: '10 Dating Invitations',
    },
    o1: {
        id: 'o1',
        aliases: [],
        priceId: 'price_1T5mIGKpQn3RDJUCMzhlyN6a',
        mode: 'payment',
        purchaseType: 'offer_pack',
        amount: 1,
        name: '50 Hour Offer Slot',
    },
};

const ITEM_ALIASES = Object.values(CHECKOUT_ITEMS).reduce((acc, item) => {
    acc[item.id] = item;
    for (const alias of item.aliases || []) acc[alias] = item;
    return acc;
}, {});

const ITEMS_BY_PRICE_ID = Object.values(CHECKOUT_ITEMS).reduce((acc, item) => {
    acc[item.priceId] = item;
    return acc;
}, {});

function normalizeKey(value) {
    return String(value || '').trim().toLowerCase();
}

function getCheckoutItemById(value) {
    return ITEM_ALIASES[normalizeKey(value)] || null;
}

function getCheckoutItemByPriceId(value) {
    return ITEMS_BY_PRICE_ID[String(value || '').trim()] || null;
}

function resolveCheckoutItem({ planId, priceId } = {}) {
    return getCheckoutItemById(planId) || getCheckoutItemByPriceId(priceId);
}

module.exports = {
    CHECKOUT_ITEMS,
    getCheckoutItemById,
    getCheckoutItemByPriceId,
    resolveCheckoutItem,
};
