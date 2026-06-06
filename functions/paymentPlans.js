const SUBSCRIPTION_PLANS = {
    p2: {
        planId: 'p2',
        name: 'Pro Plan',
        envKey: 'STRIPE_PRICE_USER_PRO',
        defaultPriceId: 'price_1T4DptKpQn3RDJUCrhwtOx0u',
        mode: 'subscription',
        tier: 'pro',
        weeklyPrivateQuota: 4,
    },
    p3: {
        planId: 'p3',
        name: 'Premium Plan',
        envKey: 'STRIPE_PRICE_USER_PREMIUM',
        defaultPriceId: 'price_1T4DrkKpQn3RDJUC7cPercNu',
        mode: 'subscription',
        tier: 'vip',
        weeklyPrivateQuota: 10,
    },
    p4: {
        planId: 'p4',
        name: 'Professional Business Plan',
        envKey: 'STRIPE_PRICE_BUSINESS_PROFESSIONAL',
        defaultPriceId: 'price_1T4DfJKpQn3RDJUC4ANefmpl',
        mode: 'subscription',
        tier: 'professional',
        weeklyPrivateQuota: 0,
    },
    p5: {
        planId: 'p5',
        name: 'Elite Partner Plan',
        envKey: 'STRIPE_PRICE_BUSINESS_ELITE',
        defaultPriceId: 'price_1T4DlqKpQn3RDJUC6vrueW0n',
        mode: 'subscription',
        tier: 'elite',
        weeklyPrivateQuota: 0,
    },
};

const ONE_TIME_PACKS = {
    c1: {
        planId: 'c1',
        name: 'Single Private Invitation',
        envKey: 'STRIPE_PRICE_PRIVATE_INVITE_1',
        defaultPriceId: 'price_1T4DyrKpQn3RDJUCN6ipD592',
        mode: 'payment',
        fulfillment: 'private_invites',
        credits: 1,
    },
    c2: {
        planId: 'c2',
        name: '3 Private Invitations',
        envKey: 'STRIPE_PRICE_PRIVATE_INVITE_3',
        defaultPriceId: 'price_1T4E1aKpQn3RDJUCMLLV7g4D',
        mode: 'payment',
        fulfillment: 'private_invites',
        credits: 3,
    },
    c3: {
        planId: 'c3',
        name: '5 Private Invitations',
        envKey: 'STRIPE_PRICE_PRIVATE_INVITE_5',
        defaultPriceId: 'price_1T4E1xKpQn3RDJUC6wYEr9I1',
        mode: 'payment',
        fulfillment: 'private_invites',
        credits: 5,
    },
    c4: {
        planId: 'c4',
        name: '10 Private Invitations',
        envKey: 'STRIPE_PRICE_PRIVATE_INVITE_10',
        defaultPriceId: 'price_1T4E3EKpQn3RDJUC97Rro1xj',
        mode: 'payment',
        fulfillment: 'private_invites',
        credits: 10,
    },
    c5: {
        planId: 'c5',
        name: '20 Private Invitations',
        envKey: 'STRIPE_PRICE_PRIVATE_INVITE_20',
        defaultPriceId: 'price_1T4E8AKpQn3RDJUCc3tJwnAI',
        mode: 'payment',
        fulfillment: 'private_invites',
        credits: 20,
    },
    d1: {
        planId: 'd1',
        name: '5 Dating Invitations',
        envKey: 'STRIPE_PRICE_DATING_INVITE_5',
        defaultPriceId: 'price_1TDaNMKpQn3RDJUCWAJdI5YZ',
        mode: 'payment',
        fulfillment: 'private_invites',
        credits: 5,
    },
    d2: {
        planId: 'd2',
        name: '10 Dating Invitations',
        envKey: 'STRIPE_PRICE_DATING_INVITE_10',
        defaultPriceId: 'price_1TDaO5KpQn3RDJUC0vD1Afzj',
        mode: 'payment',
        fulfillment: 'private_invites',
        credits: 10,
    },
    o1: {
        planId: 'o1',
        name: '50 Hour Offer Slot',
        envKey: 'STRIPE_PRICE_OFFER_SLOT_50H',
        defaultPriceId: 'price_1T5mIGKpQn3RDJUCMzhlyN6a',
        mode: 'payment',
        fulfillment: 'offer_credits',
        credits: 1,
    },
};

const PAYMENT_PLANS = {
    ...SUBSCRIPTION_PLANS,
    ...ONE_TIME_PACKS,
};

function resolvePriceId(plan) {
    const configured = String(process.env[plan.envKey] || '').trim();
    return configured || plan.defaultPriceId;
}

function getPaymentPlan(planId) {
    const id = String(planId || '').trim();
    const plan = PAYMENT_PLANS[id];
    if (!plan) return null;
    return { ...plan, priceId: resolvePriceId(plan) };
}

function findPaymentPlanByPriceId(priceId) {
    const normalized = String(priceId || '').trim();
    if (!normalized) return null;
    return Object.values(PAYMENT_PLANS)
        .map((plan) => ({ ...plan, priceId: resolvePriceId(plan) }))
        .find((plan) => plan.priceId === normalized) || null;
}

function activeSubscriptionStatus(status) {
    return status === 'active' || status === 'trialing';
}

module.exports = {
    PAYMENT_PLANS,
    SUBSCRIPTION_PLANS,
    ONE_TIME_PACKS,
    getPaymentPlan,
    findPaymentPlanByPriceId,
    activeSubscriptionStatus,
};
