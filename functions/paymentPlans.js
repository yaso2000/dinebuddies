const CHECKOUT_PLANS = {
    p2: {
        id: 'p2',
        aliases: ['pro'],
        kind: 'subscription',
        mode: 'subscription',
        priceId: 'price_1T4DptKpQn3RDJUCrhwtOx0u',
        planName: 'Pro Plan',
        tier: 'pro',
        weeklyPrivateQuota: 2,
    },
    p3: {
        id: 'p3',
        aliases: ['premium', 'vip'],
        kind: 'subscription',
        mode: 'subscription',
        priceId: 'price_1T4DrkKpQn3RDJUC7cPercNu',
        planName: 'Premium Plan',
        tier: 'vip',
        weeklyPrivateQuota: 10,
    },
    p4: {
        id: 'p4',
        aliases: ['professional'],
        kind: 'subscription',
        mode: 'subscription',
        priceId: 'price_1T4DfJKpQn3RDJUC4ANefmpl',
        planName: 'Professional Business Plan',
        tier: 'professional',
        weeklyPrivateQuota: 0,
    },
    p5: {
        id: 'p5',
        aliases: ['elite'],
        kind: 'subscription',
        mode: 'subscription',
        priceId: 'price_1T4DlqKpQn3RDJUC6vrueW0n',
        planName: 'Elite Partner Plan',
        tier: 'elite',
        weeklyPrivateQuota: 0,
    },
    c1: {
        id: 'c1',
        kind: 'private_pack',
        mode: 'payment',
        priceId: 'price_1T4DyrKpQn3RDJUCN6ipD592',
        planName: '1 Private Invitation',
        privateCredits: 1,
    },
    c2: {
        id: 'c2',
        kind: 'private_pack',
        mode: 'payment',
        priceId: 'price_1T4E1aKpQn3RDJUCMLLV7g4D',
        planName: '3 Private Invitations',
        privateCredits: 3,
    },
    c3: {
        id: 'c3',
        kind: 'private_pack',
        mode: 'payment',
        priceId: 'price_1T4E1xKpQn3RDJUC6wYEr9I1',
        planName: '5 Private Invitations',
        privateCredits: 5,
    },
    c4: {
        id: 'c4',
        kind: 'private_pack',
        mode: 'payment',
        priceId: 'price_1T4E3EKpQn3RDJUC97Rro1xj',
        planName: '10 Private Invitations',
        privateCredits: 10,
    },
    c5: {
        id: 'c5',
        kind: 'private_pack',
        mode: 'payment',
        priceId: 'price_1T4E8AKpQn3RDJUCc3tJwnAI',
        planName: '20 Private Invitations',
        privateCredits: 20,
    },
    d1: {
        id: 'd1',
        kind: 'private_pack',
        mode: 'payment',
        priceId: 'price_1TDaNMKpQn3RDJUCWAJdI5YZ',
        planName: '5 Dating Invitations',
        privateCredits: 5,
    },
    d2: {
        id: 'd2',
        kind: 'private_pack',
        mode: 'payment',
        priceId: 'price_1TDaO5KpQn3RDJUC0vD1Afzj',
        planName: '10 Dating Invitations',
        privateCredits: 10,
    },
    o1: {
        id: 'o1',
        kind: 'offer_pack',
        mode: 'payment',
        priceId: 'price_1T5mIGKpQn3RDJUCMzhlyN6a',
        planName: '50 Hour Offer Slot',
        offerCredits: 1,
    },
};

const PLANS_BY_ALIAS = {};
const PLANS_BY_PRICE = {};

for (const plan of Object.values(CHECKOUT_PLANS)) {
    PLANS_BY_ALIAS[plan.id] = plan;
    for (const alias of plan.aliases || []) {
        PLANS_BY_ALIAS[alias] = plan;
    }
    PLANS_BY_PRICE[plan.priceId] = plan;
}

function normalizePlanKey(value) {
    return String(value || '').trim().toLowerCase();
}

function resolveCheckoutPlan(planId, priceId) {
    const byPlan = PLANS_BY_ALIAS[normalizePlanKey(planId)];
    if (byPlan) return byPlan;
    return PLANS_BY_PRICE[String(priceId || '').trim()] || null;
}

function resolvePlanByPriceId(priceId) {
    return PLANS_BY_PRICE[String(priceId || '').trim()] || null;
}

module.exports = {
    CHECKOUT_PLANS,
    resolveCheckoutPlan,
    resolvePlanByPriceId,
};
