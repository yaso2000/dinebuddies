const SUBSCRIPTION_PLANS = {
    p2: {
        name: 'Pro Plan',
        mode: 'subscription',
        type: 'subscription',
        tier: 'pro',
        weeklyPrivateQuota: 4,
        priceId: 'price_1T4DptKpQn3RDJUCrhwtOx0u',
        envKey: 'STRIPE_PRICE_USER_PRO',
    },
    p3: {
        name: 'Premium Plan',
        mode: 'subscription',
        type: 'subscription',
        tier: 'vip',
        weeklyPrivateQuota: 10,
        priceId: 'price_1T4DrkKpQn3RDJUC7cPercNu',
        envKey: 'STRIPE_PRICE_USER_PREMIUM',
    },
    p4: {
        name: 'Professional Business Plan',
        mode: 'subscription',
        type: 'subscription',
        tier: 'professional',
        weeklyPrivateQuota: 0,
        priceId: 'price_1T4DfJKpQn3RDJUC4ANefmpl',
        envKey: 'STRIPE_PRICE_BUSINESS_PROFESSIONAL',
    },
    p5: {
        name: 'Elite Partner Plan',
        mode: 'subscription',
        type: 'subscription',
        tier: 'elite',
        weeklyPrivateQuota: 0,
        priceId: 'price_1T4DlqKpQn3RDJUC6vrueW0n',
        envKey: 'STRIPE_PRICE_BUSINESS_ELITE',
    },
};

const ONE_TIME_PLANS = {
    c1: {
        name: 'Single Private Invitation',
        mode: 'payment',
        type: 'private_credits',
        purchasedPrivateCredits: 1,
        priceId: 'price_1T4DyrKpQn3RDJUCN6ipD592',
        envKey: 'STRIPE_PRICE_PRIVATE_INVITE_1',
    },
    c2: {
        name: '3 Private Invitations',
        mode: 'payment',
        type: 'private_credits',
        purchasedPrivateCredits: 3,
        priceId: 'price_1T4E1aKpQn3RDJUCMLLV7g4D',
        envKey: 'STRIPE_PRICE_PRIVATE_INVITE_3',
    },
    c3: {
        name: '5 Private Invitations',
        mode: 'payment',
        type: 'private_credits',
        purchasedPrivateCredits: 5,
        priceId: 'price_1T4E1xKpQn3RDJUC6wYEr9I1',
        envKey: 'STRIPE_PRICE_PRIVATE_INVITE_5',
    },
    c4: {
        name: '10 Private Invitations',
        mode: 'payment',
        type: 'private_credits',
        purchasedPrivateCredits: 10,
        priceId: 'price_1T4E3EKpQn3RDJUC97Rro1xj',
        envKey: 'STRIPE_PRICE_PRIVATE_INVITE_10',
    },
    c5: {
        name: '20 Private Invitations',
        mode: 'payment',
        type: 'private_credits',
        purchasedPrivateCredits: 20,
        priceId: 'price_1T4E8AKpQn3RDJUCc3tJwnAI',
        envKey: 'STRIPE_PRICE_PRIVATE_INVITE_20',
    },
    d1: {
        name: '5 Dating Invitations',
        mode: 'payment',
        type: 'private_credits',
        purchasedPrivateCredits: 5,
        priceId: 'price_1TDaNMKpQn3RDJUCWAJdI5YZ',
        envKey: 'STRIPE_PRICE_DATING_INVITE_5',
    },
    d2: {
        name: '10 Dating Invitations',
        mode: 'payment',
        type: 'private_credits',
        purchasedPrivateCredits: 10,
        priceId: 'price_1TDaO5KpQn3RDJUC0vD1Afzj',
        envKey: 'STRIPE_PRICE_DATING_INVITE_10',
    },
    o1: {
        name: '50 Hour Offer Slot',
        mode: 'payment',
        type: 'offer_credits',
        offerCredits: 1,
        priceId: 'price_1T5mIGKpQn3RDJUCMzhlyN6a',
        envKey: 'STRIPE_PRICE_OFFER_SLOT_50H',
    },
};

const PLAN_ALIASES = {
    pro: 'p2',
    premium: 'p3',
    vip: 'p3',
    professional: 'p4',
    elite: 'p5',
};

const PAYMENT_PLANS = {
    ...SUBSCRIPTION_PLANS,
    ...ONE_TIME_PLANS,
};

function normalizePaymentPlanId(planId) {
    const id = String(planId || '').trim().toLowerCase();
    return PLAN_ALIASES[id] || id;
}

function withResolvedPrice(id, def) {
    const priceId = String(process.env[def.envKey] || def.priceId || '').trim();
    return { id, ...def, priceId };
}

function getPaymentPlan(planId) {
    const id = normalizePaymentPlanId(planId);
    const def = PAYMENT_PLANS[id];
    if (!def) return null;
    return withResolvedPrice(id, def);
}

function getPaymentPlanByPriceId(priceId) {
    const wanted = String(priceId || '').trim();
    if (!wanted) return null;
    for (const [id, def] of Object.entries(PAYMENT_PLANS)) {
        const plan = withResolvedPrice(id, def);
        if (plan.priceId === wanted) return plan;
    }
    return null;
}

function listPaymentPlans() {
    return Object.entries(PAYMENT_PLANS).map(([id, def]) => withResolvedPrice(id, def));
}

module.exports = {
    getPaymentPlan,
    getPaymentPlanByPriceId,
    listPaymentPlans,
    normalizePaymentPlanId,
};
