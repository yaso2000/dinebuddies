const SUBSCRIPTION_PLANS = {
    p2: {
        key: 'p2',
        kind: 'subscription',
        priceId: 'price_1T4DptKpQn3RDJUCrhwtOx0u',
        tier: 'pro',
        weeklyPrivateQuota: 2,
        name: 'Pro Plan'
    },
    p3: {
        key: 'p3',
        kind: 'subscription',
        priceId: 'price_1T4DrkKpQn3RDJUC7cPercNu',
        tier: 'vip',
        weeklyPrivateQuota: -1,
        name: 'Premium Plan'
    },
    p4: {
        key: 'p4',
        kind: 'subscription',
        priceId: 'price_1T4DfJKpQn3RDJUC4ANefmpl',
        tier: 'professional',
        weeklyPrivateQuota: 0,
        name: 'Professional Business Plan'
    },
    p5: {
        key: 'p5',
        kind: 'subscription',
        priceId: 'price_1T4DlqKpQn3RDJUC6vrueW0n',
        tier: 'elite',
        weeklyPrivateQuota: 0,
        name: 'Elite Partner Plan'
    }
};

const CREDIT_PACKS = {
    c1: {
        key: 'c1',
        kind: 'private_pack',
        priceId: 'price_1T4DyrKpQn3RDJUCN6ipD592',
        credits: 1,
        name: 'Single Private Invitation'
    },
    c2: {
        key: 'c2',
        kind: 'private_pack',
        priceId: 'price_1T4E1aKpQn3RDJUCMLLV7g4D',
        credits: 3,
        name: '3 Private Invitations'
    },
    c3: {
        key: 'c3',
        kind: 'private_pack',
        priceId: 'price_1T4E1xKpQn3RDJUC6wYEr9I1',
        credits: 5,
        name: '5 Private Invitations'
    },
    c4: {
        key: 'c4',
        kind: 'private_pack',
        priceId: 'price_1T4E3EKpQn3RDJUC97Rro1xj',
        credits: 10,
        name: '10 Private Invitations'
    },
    c5: {
        key: 'c5',
        kind: 'private_pack',
        priceId: 'price_1T4E8AKpQn3RDJUCc3tJwnAI',
        credits: 20,
        name: '20 Private Invitations'
    },
    d1: {
        key: 'd1',
        kind: 'private_pack',
        priceId: 'price_1TDaNMKpQn3RDJUCWAJdI5YZ',
        credits: 5,
        name: '5 Dating Invitations'
    },
    d2: {
        key: 'd2',
        kind: 'private_pack',
        priceId: 'price_1TDaO5KpQn3RDJUC0vD1Afzj',
        credits: 10,
        name: '10 Dating Invitations'
    },
    o1: {
        key: 'o1',
        kind: 'offer_pack',
        priceId: 'price_1T5mIGKpQn3RDJUCMzhlyN6a',
        credits: 1,
        name: '50 Hour Offer Slot'
    }
};

const PLAN_ALIASES = {
    pro: 'p2',
    premium: 'p3',
    vip: 'p3',
    professional: 'p4',
    elite: 'p5'
};

const CHECKOUT_ITEMS = {
    ...SUBSCRIPTION_PLANS,
    ...CREDIT_PACKS
};

function normalizePlanKey(planKey) {
    const raw = String(planKey || '').trim().toLowerCase();
    return PLAN_ALIASES[raw] || raw;
}

function getCheckoutItem(planKey) {
    return CHECKOUT_ITEMS[normalizePlanKey(planKey)] || null;
}

function getSubscriptionPlanByPriceId(priceId) {
    return Object.values(SUBSCRIPTION_PLANS).find((plan) => plan.priceId === priceId) || null;
}

module.exports = {
    CHECKOUT_ITEMS,
    CREDIT_PACKS,
    SUBSCRIPTION_PLANS,
    getCheckoutItem,
    getSubscriptionPlanByPriceId,
    normalizePlanKey
};
