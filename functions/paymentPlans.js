const SUBSCRIPTION_PLANS = {
    p2: {
        planId: 'p2',
        planName: 'Pro Plan',
        priceId: 'price_1T4DptKpQn3RDJUCrhwtOx0u',
        tier: 'pro',
        weeklyPrivateQuota: 2,
        mode: 'subscription',
    },
    p3: {
        planId: 'p3',
        planName: 'Premium Plan',
        priceId: 'price_1T4DrkKpQn3RDJUC7cPercNu',
        tier: 'vip',
        weeklyPrivateQuota: -1,
        mode: 'subscription',
    },
    p4: {
        planId: 'p4',
        planName: 'Professional Business Plan',
        priceId: 'price_1T4DfJKpQn3RDJUC4ANefmpl',
        tier: 'professional',
        weeklyPrivateQuota: 0,
        mode: 'subscription',
    },
    p5: {
        planId: 'p5',
        planName: 'Elite Partner Plan',
        priceId: 'price_1T4DlqKpQn3RDJUC6vrueW0n',
        tier: 'elite',
        weeklyPrivateQuota: 0,
        mode: 'subscription',
    },
};

const PRIVATE_PACKS = {
    c1: { planId: 'c1', planName: 'Single Private Invitation', priceId: 'price_1T4DyrKpQn3RDJUCN6ipD592', credits: 1, packType: 'private' },
    c2: { planId: 'c2', planName: '3 Private Invitations', priceId: 'price_1T4E1aKpQn3RDJUCMLLV7g4D', credits: 3, packType: 'private' },
    c3: { planId: 'c3', planName: '5 Private Invitations', priceId: 'price_1T4E1xKpQn3RDJUC6wYEr9I1', credits: 5, packType: 'private' },
    c4: { planId: 'c4', planName: '10 Private Invitations', priceId: 'price_1T4E3EKpQn3RDJUC97Rro1xj', credits: 10, packType: 'private' },
    c5: { planId: 'c5', planName: '20 Private Invitations', priceId: 'price_1T4E8AKpQn3RDJUCc3tJwnAI', credits: 20, packType: 'private' },
    d1: { planId: 'd1', planName: '5 Dating Invitations', priceId: 'price_1TDaNMKpQn3RDJUCWAJdI5YZ', credits: 5, packType: 'private' },
    d2: { planId: 'd2', planName: '10 Dating Invitations', priceId: 'price_1TDaO5KpQn3RDJUC0vD1Afzj', credits: 10, packType: 'private' },
};

const OFFER_PACKS = {
    o1: {
        planId: 'o1',
        planName: '50 Hour Offer Slot',
        priceId: 'price_1T5mIGKpQn3RDJUCMzhlyN6a',
        credits: 1,
        packType: 'offer',
    },
};

const PAYMENT_PLANS = {
    ...SUBSCRIPTION_PLANS,
    ...Object.fromEntries(
        Object.entries(PRIVATE_PACKS).map(([key, value]) => [key, { ...value, mode: 'payment' }])
    ),
    ...Object.fromEntries(
        Object.entries(OFFER_PACKS).map(([key, value]) => [key, { ...value, mode: 'payment' }])
    ),
};

const PAYMENT_PLANS_BY_PRICE = Object.fromEntries(
    Object.values(PAYMENT_PLANS).map((plan) => [plan.priceId, plan])
);

function getPaymentPlan(planId) {
    return PAYMENT_PLANS[String(planId || '').trim()] || null;
}

function getPaymentPlanByPrice(priceId) {
    return PAYMENT_PLANS_BY_PRICE[String(priceId || '').trim()] || null;
}

module.exports = {
    PAYMENT_PLANS,
    SUBSCRIPTION_PLANS,
    getPaymentPlan,
    getPaymentPlanByPrice,
};
