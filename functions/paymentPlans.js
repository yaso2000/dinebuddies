const SUBSCRIPTION_PLANS = {
    p2: {
        kind: 'subscription',
        mode: 'subscription',
        planId: 'p2',
        planName: 'Pro Plan',
        tier: 'pro',
        weeklyQuota: 4,
        priceId: 'price_1T4DptKpQn3RDJUCrhwtOx0u',
    },
    p3: {
        kind: 'subscription',
        mode: 'subscription',
        planId: 'p3',
        planName: 'Premium Plan',
        tier: 'vip',
        weeklyQuota: 10,
        priceId: 'price_1T4DrkKpQn3RDJUC7cPercNu',
    },
    p4: {
        kind: 'subscription',
        mode: 'subscription',
        planId: 'p4',
        planName: 'Professional Business Plan',
        tier: 'professional',
        weeklyQuota: 0,
        priceId: 'price_1T4DfJKpQn3RDJUC4ANefmpl',
    },
    p5: {
        kind: 'subscription',
        mode: 'subscription',
        planId: 'p5',
        planName: 'Elite Partner Plan',
        tier: 'elite',
        weeklyQuota: 0,
        priceId: 'price_1T4DlqKpQn3RDJUC6vrueW0n',
    },
};

const ONE_TIME_PACKS = {
    c1: {
        kind: 'private_pack',
        mode: 'payment',
        planId: 'c1',
        planName: 'Single Private Invitation',
        amount: 1,
        priceId: 'price_1T4DyrKpQn3RDJUCN6ipD592',
    },
    c2: {
        kind: 'private_pack',
        mode: 'payment',
        planId: 'c2',
        planName: '3 Private Invitations',
        amount: 3,
        priceId: 'price_1T4E1aKpQn3RDJUCMLLV7g4D',
    },
    c3: {
        kind: 'private_pack',
        mode: 'payment',
        planId: 'c3',
        planName: '5 Private Invitations',
        amount: 5,
        priceId: 'price_1T4E1xKpQn3RDJUC6wYEr9I1',
    },
    c4: {
        kind: 'private_pack',
        mode: 'payment',
        planId: 'c4',
        planName: '10 Private Invitations',
        amount: 10,
        priceId: 'price_1T4E3EKpQn3RDJUC97Rro1xj',
    },
    c5: {
        kind: 'private_pack',
        mode: 'payment',
        planId: 'c5',
        planName: '20 Private Invitations',
        amount: 20,
        priceId: 'price_1T4E8AKpQn3RDJUCc3tJwnAI',
    },
    d1: {
        kind: 'private_pack',
        mode: 'payment',
        planId: 'd1',
        planName: '5 Dating Invitations',
        amount: 5,
        priceId: 'price_1TDaNMKpQn3RDJUCWAJdI5YZ',
    },
    d2: {
        kind: 'private_pack',
        mode: 'payment',
        planId: 'd2',
        planName: '10 Dating Invitations',
        amount: 10,
        priceId: 'price_1TDaO5KpQn3RDJUC0vD1Afzj',
    },
    o1: {
        kind: 'offer_pack',
        mode: 'payment',
        planId: 'o1',
        planName: '50 Hour Offer Slot',
        amount: 1,
        priceId: 'price_1T5mIGKpQn3RDJUCMzhlyN6a',
    },
};

const PLAN_ALIASES = {
    pro: 'p2',
    premium: 'p3',
    vip: 'p3',
    professional: 'p4',
    elite: 'p5',
};

const CHECKOUT_CATALOG = {
    ...SUBSCRIPTION_PLANS,
    ...ONE_TIME_PACKS,
};

function normalizePlanId(planId) {
    const id = String(planId || '').trim().toLowerCase();
    return PLAN_ALIASES[id] || id;
}

function getCheckoutCatalogEntry(planId) {
    const normalized = normalizePlanId(planId);
    return CHECKOUT_CATALOG[normalized] || null;
}

function getCatalogEntryByPriceId(priceId) {
    const id = String(priceId || '').trim();
    if (!id) return null;
    return Object.values(CHECKOUT_CATALOG).find((entry) => entry.priceId === id) || null;
}

module.exports = {
    CHECKOUT_CATALOG,
    SUBSCRIPTION_PLANS,
    ONE_TIME_PACKS,
    normalizePlanId,
    getCheckoutCatalogEntry,
    getCatalogEntryByPriceId,
};
