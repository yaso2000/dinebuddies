const SUBSCRIPTION_PLANS = {
    p2: {
        id: 'p2',
        kind: 'subscription',
        mode: 'subscription',
        priceId: 'price_1T4DptKpQn3RDJUCrhwtOx0u',
        tier: 'pro',
        currentPlan: 'p2',
        weeklyPrivateQuota: 2,
        planName: 'Pro Plan',
    },
    p3: {
        id: 'p3',
        kind: 'subscription',
        mode: 'subscription',
        priceId: 'price_1T4DrkKpQn3RDJUC7cPercNu',
        tier: 'vip',
        currentPlan: 'p3',
        weeklyPrivateQuota: -1,
        planName: 'Premium Plan',
    },
    p4: {
        id: 'p4',
        kind: 'subscription',
        mode: 'subscription',
        priceId: 'price_1T4DfJKpQn3RDJUC4ANefmpl',
        tier: 'professional',
        currentPlan: 'p4',
        weeklyPrivateQuota: 0,
        planName: 'Professional Business Plan',
    },
    p5: {
        id: 'p5',
        kind: 'subscription',
        mode: 'subscription',
        priceId: 'price_1T4DlqKpQn3RDJUC6vrueW0n',
        tier: 'elite',
        currentPlan: 'p5',
        weeklyPrivateQuota: 0,
        planName: 'Elite Partner Plan',
    },
};

const ONE_TIME_PACKS = {
    c1: {
        id: 'c1',
        kind: 'private_pack',
        mode: 'payment',
        priceId: 'price_1T4DyrKpQn3RDJUCN6ipD592',
        credits: 1,
        grantField: 'purchasedPrivateCredits',
        planName: 'Single Private Invitation',
    },
    c2: {
        id: 'c2',
        kind: 'private_pack',
        mode: 'payment',
        priceId: 'price_1T4E1aKpQn3RDJUCMLLV7g4D',
        credits: 3,
        grantField: 'purchasedPrivateCredits',
        planName: '3 Private Invitations',
    },
    c3: {
        id: 'c3',
        kind: 'private_pack',
        mode: 'payment',
        priceId: 'price_1T4E1xKpQn3RDJUC6wYEr9I1',
        credits: 5,
        grantField: 'purchasedPrivateCredits',
        planName: '5 Private Invitations',
    },
    c4: {
        id: 'c4',
        kind: 'private_pack',
        mode: 'payment',
        priceId: 'price_1T4E3EKpQn3RDJUC97Rro1xj',
        credits: 10,
        grantField: 'purchasedPrivateCredits',
        planName: '10 Private Invitations',
    },
    c5: {
        id: 'c5',
        kind: 'private_pack',
        mode: 'payment',
        priceId: 'price_1T4E8AKpQn3RDJUCc3tJwnAI',
        credits: 20,
        grantField: 'purchasedPrivateCredits',
        planName: '20 Private Invitations',
    },
    d1: {
        id: 'd1',
        kind: 'private_pack',
        mode: 'payment',
        priceId: 'price_1TDaNMKpQn3RDJUCWAJdI5YZ',
        credits: 5,
        grantField: 'purchasedPrivateCredits',
        planName: '5 Dating Invitations',
    },
    d2: {
        id: 'd2',
        kind: 'private_pack',
        mode: 'payment',
        priceId: 'price_1TDaO5KpQn3RDJUC0vD1Afzj',
        credits: 10,
        grantField: 'purchasedPrivateCredits',
        planName: '10 Dating Invitations',
    },
    o1: {
        id: 'o1',
        kind: 'offer_pack',
        mode: 'payment',
        priceId: 'price_1T5mIGKpQn3RDJUCMzhlyN6a',
        credits: 1,
        grantField: 'offerCredits',
        planName: '50 Hour Offer Slot',
    },
};

const PLAN_ALIASES = {
    pro: 'p2',
    premium: 'p3',
    vip: 'p3',
    professional: 'p4',
    elite: 'p5',
    paid: 'p5',
    business_paid: 'p5',
};

const CHECKOUT_PLANS = {
    ...SUBSCRIPTION_PLANS,
    ...ONE_TIME_PACKS,
};

function normalizePlanId(planId) {
    const id = String(planId || '').trim().toLowerCase();
    return PLAN_ALIASES[id] || id;
}

function getCheckoutPlan(planId) {
    const id = normalizePlanId(planId);
    return CHECKOUT_PLANS[id] || null;
}

function getCheckoutPlanByPriceId(priceId) {
    const normalized = String(priceId || '').trim();
    if (!normalized) return null;
    return Object.values(CHECKOUT_PLANS).find((plan) => plan.priceId === normalized) || null;
}

module.exports = {
    CHECKOUT_PLANS,
    SUBSCRIPTION_PLANS,
    ONE_TIME_PACKS,
    getCheckoutPlan,
    getCheckoutPlanByPriceId,
    normalizePlanId,
};
