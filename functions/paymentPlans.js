const SUBSCRIPTION_PLANS = {
    p2: {
        id: 'p2',
        aliases: ['pro'],
        type: 'subscription',
        mode: 'subscription',
        priceId: 'price_1T4DptKpQn3RDJUCrhwtOx0u',
        planName: 'Pro Plan',
        tier: 'pro',
        weeklyPrivateQuota: 2,
    },
    p3: {
        id: 'p3',
        aliases: ['premium', 'vip'],
        type: 'subscription',
        mode: 'subscription',
        priceId: 'price_1T4DrkKpQn3RDJUC7cPercNu',
        planName: 'Premium Plan',
        tier: 'vip',
        weeklyPrivateQuota: -1,
    },
    p4: {
        id: 'p4',
        aliases: ['professional'],
        type: 'subscription',
        mode: 'subscription',
        priceId: 'price_1T4DfJKpQn3RDJUC4ANefmpl',
        planName: 'Professional Business Plan',
        tier: 'professional',
        weeklyPrivateQuota: 0,
    },
    p5: {
        id: 'p5',
        aliases: ['elite'],
        type: 'subscription',
        mode: 'subscription',
        priceId: 'price_1T4DlqKpQn3RDJUC6vrueW0n',
        planName: 'Elite Partner Plan',
        tier: 'elite',
        weeklyPrivateQuota: 0,
    },
};

const ONE_TIME_PACKS = {
    c1: {
        id: 'c1',
        aliases: [],
        type: 'private_pack',
        mode: 'payment',
        priceId: 'price_1T4DyrKpQn3RDJUCN6ipD592',
        planName: 'Single Private Invitation',
        credits: 1,
    },
    c2: {
        id: 'c2',
        aliases: [],
        type: 'private_pack',
        mode: 'payment',
        priceId: 'price_1T4E1aKpQn3RDJUCMLLV7g4D',
        planName: '3 Private Invitations',
        credits: 3,
    },
    c3: {
        id: 'c3',
        aliases: [],
        type: 'private_pack',
        mode: 'payment',
        priceId: 'price_1T4E1xKpQn3RDJUC6wYEr9I1',
        planName: '5 Private Invitations',
        credits: 5,
    },
    c4: {
        id: 'c4',
        aliases: [],
        type: 'private_pack',
        mode: 'payment',
        priceId: 'price_1T4E3EKpQn3RDJUC97Rro1xj',
        planName: '10 Private Invitations',
        credits: 10,
    },
    c5: {
        id: 'c5',
        aliases: [],
        type: 'private_pack',
        mode: 'payment',
        priceId: 'price_1T4E8AKpQn3RDJUCc3tJwnAI',
        planName: '20 Private Invitations',
        credits: 20,
    },
    d1: {
        id: 'd1',
        aliases: [],
        type: 'private_pack',
        mode: 'payment',
        priceId: 'price_1TDaNMKpQn3RDJUCWAJdI5YZ',
        planName: '5 Dating Invitations',
        credits: 5,
    },
    d2: {
        id: 'd2',
        aliases: [],
        type: 'private_pack',
        mode: 'payment',
        priceId: 'price_1TDaO5KpQn3RDJUC0vD1Afzj',
        planName: '10 Dating Invitations',
        credits: 10,
    },
    o1: {
        id: 'o1',
        aliases: ['offer_slot'],
        type: 'offer_pack',
        mode: 'payment',
        priceId: 'price_1T5mIGKpQn3RDJUCMzhlyN6a',
        planName: '50 Hour Offer Slot',
        credits: 1,
    },
};

const CHECKOUT_CATALOG = Object.freeze({
    ...SUBSCRIPTION_PLANS,
    ...ONE_TIME_PACKS,
});

const ALIAS_TO_ID = Object.freeze(
    Object.fromEntries(
        Object.values(CHECKOUT_CATALOG).flatMap((plan) => [
            [plan.id, plan.id],
            ...(plan.aliases || []).map((alias) => [alias, plan.id]),
        ])
    )
);

function normalizePlanKey(value) {
    return String(value || '').trim().toLowerCase();
}

function getCheckoutPlan(planId) {
    const key = normalizePlanKey(planId);
    const canonicalId = ALIAS_TO_ID[key] || key;
    return CHECKOUT_CATALOG[canonicalId] || null;
}

function getCheckoutPlanByPriceId(priceId) {
    const normalized = String(priceId || '').trim();
    return Object.values(CHECKOUT_CATALOG).find((plan) => plan.priceId === normalized) || null;
}

function assertCheckoutPriceMatches(plan, priceIds) {
    const paidPrices = Array.isArray(priceIds) ? priceIds : [];
    return !!plan && paidPrices.includes(plan.priceId);
}

module.exports = {
    CHECKOUT_CATALOG,
    SUBSCRIPTION_PLANS,
    ONE_TIME_PACKS,
    getCheckoutPlan,
    getCheckoutPlanByPriceId,
    assertCheckoutPriceMatches,
};
