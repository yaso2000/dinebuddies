const CHECKOUT_PLANS = {
    p2: {
        id: 'p2',
        mode: 'subscription',
        priceId: 'price_1T4DptKpQn3RDJUCrhwtOx0u',
        tier: 'pro',
        weeklyPrivateQuota: 2,
        fulfillment: 'subscription',
    },
    p3: {
        id: 'p3',
        mode: 'subscription',
        priceId: 'price_1T4DrkKpQn3RDJUC7cPercNu',
        tier: 'vip',
        weeklyPrivateQuota: -1,
        fulfillment: 'subscription',
    },
    p4: {
        id: 'p4',
        mode: 'subscription',
        priceId: 'price_1T4DfJKpQn3RDJUC4ANefmpl',
        tier: 'professional',
        weeklyPrivateQuota: 0,
        fulfillment: 'subscription',
    },
    p5: {
        id: 'p5',
        mode: 'subscription',
        priceId: 'price_1T4DlqKpQn3RDJUC6vrueW0n',
        tier: 'elite',
        weeklyPrivateQuota: 0,
        fulfillment: 'subscription',
    },
    c1: {
        id: 'c1',
        mode: 'payment',
        priceId: 'price_1T4DyrKpQn3RDJUCN6ipD592',
        fulfillment: 'private_pack',
        credits: 1,
    },
    c2: {
        id: 'c2',
        mode: 'payment',
        priceId: 'price_1T4E1aKpQn3RDJUCMLLV7g4D',
        fulfillment: 'private_pack',
        credits: 3,
    },
    c3: {
        id: 'c3',
        mode: 'payment',
        priceId: 'price_1T4E1xKpQn3RDJUC6wYEr9I1',
        fulfillment: 'private_pack',
        credits: 5,
    },
    c4: {
        id: 'c4',
        mode: 'payment',
        priceId: 'price_1T4E3EKpQn3RDJUC97Rro1xj',
        fulfillment: 'private_pack',
        credits: 10,
    },
    c5: {
        id: 'c5',
        mode: 'payment',
        priceId: 'price_1T4E8AKpQn3RDJUCc3tJwnAI',
        fulfillment: 'private_pack',
        credits: 20,
    },
    d1: {
        id: 'd1',
        mode: 'payment',
        priceId: 'price_1TDaNMKpQn3RDJUCWAJdI5YZ',
        fulfillment: 'private_pack',
        credits: 5,
    },
    d2: {
        id: 'd2',
        mode: 'payment',
        priceId: 'price_1TDaO5KpQn3RDJUC0vD1Afzj',
        fulfillment: 'private_pack',
        credits: 10,
    },
    o1: {
        id: 'o1',
        mode: 'payment',
        priceId: 'price_1T5mIGKpQn3RDJUCMzhlyN6a',
        fulfillment: 'offer_slot',
        credits: 1,
    },
};

const PLAN_ALIASES = {
    pro: 'p2',
    premium: 'p3',
    vip: 'p3',
    professional: 'p4',
    elite: 'p5',
};

function normalizePlanId(planId) {
    const raw = String(planId || '').trim().toLowerCase();
    return PLAN_ALIASES[raw] || raw;
}

function getCheckoutPlan(planId) {
    return CHECKOUT_PLANS[normalizePlanId(planId)] || null;
}

function getCheckoutPlanByPriceId(priceId) {
    const normalized = String(priceId || '').trim();
    return Object.values(CHECKOUT_PLANS).find((plan) => plan.priceId === normalized) || null;
}

module.exports = {
    CHECKOUT_PLANS,
    PLAN_ALIASES,
    normalizePlanId,
    getCheckoutPlan,
    getCheckoutPlanByPriceId,
};
