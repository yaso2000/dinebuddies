const CHECKOUT_CATALOG = {
    p2: {
        id: 'p2',
        priceId: 'price_1T4DptKpQn3RDJUCrhwtOx0u',
        mode: 'subscription',
        tier: 'pro',
        weeklyPrivateQuota: 2,
        name: 'Pro Plan'
    },
    p3: {
        id: 'p3',
        priceId: 'price_1T4DrkKpQn3RDJUC7cPercNu',
        mode: 'subscription',
        tier: 'vip',
        weeklyPrivateQuota: -1,
        name: 'Premium Plan'
    },
    p4: {
        id: 'p4',
        priceId: 'price_1T4DfJKpQn3RDJUC4ANefmpl',
        mode: 'subscription',
        tier: 'professional',
        weeklyPrivateQuota: 0,
        name: 'Professional Business Plan'
    },
    p5: {
        id: 'p5',
        priceId: 'price_1T4DlqKpQn3RDJUC6vrueW0n',
        mode: 'subscription',
        tier: 'elite',
        weeklyPrivateQuota: 0,
        name: 'Elite Partner Plan'
    },
    c1: {
        id: 'c1',
        priceId: 'price_1T4DyrKpQn3RDJUCN6ipD592',
        mode: 'payment',
        purchaseType: 'private_credits',
        credits: 1,
        name: 'Single Private Invitation'
    },
    c2: {
        id: 'c2',
        priceId: 'price_1T4E1aKpQn3RDJUCMLLV7g4D',
        mode: 'payment',
        purchaseType: 'private_credits',
        credits: 3,
        name: '3 Private Invitations'
    },
    c3: {
        id: 'c3',
        priceId: 'price_1T4E1xKpQn3RDJUC6wYEr9I1',
        mode: 'payment',
        purchaseType: 'private_credits',
        credits: 5,
        name: '5 Private Invitations'
    },
    c4: {
        id: 'c4',
        priceId: 'price_1T4E3EKpQn3RDJUC97Rro1xj',
        mode: 'payment',
        purchaseType: 'private_credits',
        credits: 10,
        name: '10 Private Invitations'
    },
    c5: {
        id: 'c5',
        priceId: 'price_1T4E8AKpQn3RDJUCc3tJwnAI',
        mode: 'payment',
        purchaseType: 'private_credits',
        credits: 20,
        name: '20 Private Invitations'
    },
    d1: {
        id: 'd1',
        priceId: 'price_1TDaNMKpQn3RDJUCWAJdI5YZ',
        mode: 'payment',
        purchaseType: 'private_credits',
        credits: 5,
        name: '5 Dating Invitations'
    },
    d2: {
        id: 'd2',
        priceId: 'price_1TDaO5KpQn3RDJUC0vD1Afzj',
        mode: 'payment',
        purchaseType: 'private_credits',
        credits: 10,
        name: '10 Dating Invitations'
    },
    o1: {
        id: 'o1',
        priceId: 'price_1T5mIGKpQn3RDJUCMzhlyN6a',
        mode: 'payment',
        purchaseType: 'offer_credits',
        credits: 1,
        name: '50 Hour Offer Slot'
    }
};

const PLAN_ALIASES = {
    pro: 'p2',
    premium: 'p3',
    vip: 'p3',
    professional: 'p4',
    elite: 'p5',
    paid: 'p5'
};

function normalizePlanId(planId) {
    return String(planId || '').trim().toLowerCase();
}

function resolveCheckoutItem(planId) {
    const normalized = normalizePlanId(planId);
    const canonicalId = PLAN_ALIASES[normalized] || normalized;
    return CHECKOUT_CATALOG[canonicalId] || null;
}

function getCheckoutItemByPriceId(priceId) {
    const normalized = String(priceId || '').trim();
    return Object.values(CHECKOUT_CATALOG).find((item) => item.priceId === normalized) || null;
}

module.exports = {
    CHECKOUT_CATALOG,
    PLAN_ALIASES,
    resolveCheckoutItem,
    getCheckoutItemByPriceId
};
