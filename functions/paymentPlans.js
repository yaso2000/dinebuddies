function envOrDefault(name, fallback) {
    const value = String(process.env[name] || '').trim();
    return value || fallback;
}

const SUBSCRIPTION_PLANS = {
    p2: {
        planId: 'p2',
        name: 'Pro Plan',
        priceId: envOrDefault('STRIPE_PRICE_PLAN_P2', 'price_1T4DptKpQn3RDJUCrhwtOx0u'),
        tier: 'pro',
        weeklyPrivateQuota: 2,
    },
    p3: {
        planId: 'p3',
        name: 'Premium Plan',
        priceId: envOrDefault('STRIPE_PRICE_PLAN_P3', 'price_1T4DrkKpQn3RDJUC7cPercNu'),
        tier: 'vip',
        weeklyPrivateQuota: 10,
    },
    p4: {
        planId: 'p4',
        name: 'Professional Business Plan',
        priceId: envOrDefault('STRIPE_PRICE_PLAN_P4', 'price_1T4DfJKpQn3RDJUC4ANefmpl'),
        tier: 'professional',
        weeklyPrivateQuota: 0,
    },
    p5: {
        planId: 'p5',
        name: 'Elite Partner Plan',
        priceId: envOrDefault('STRIPE_PRICE_PLAN_P5', 'price_1T4DlqKpQn3RDJUC6vrueW0n'),
        tier: 'elite',
        weeklyPrivateQuota: 0,
    },
};

const ONE_TIME_PACKS = {
    c1: {
        planId: 'c1',
        name: 'Single Private Invitation',
        priceId: envOrDefault('STRIPE_PRICE_PRIVATE_INVITE_1', 'price_1T4DyrKpQn3RDJUCN6ipD592'),
        grantField: 'purchasedPrivateCredits',
        grantAmount: 1,
        grantType: 'private_invitation',
    },
    c2: {
        planId: 'c2',
        name: '3 Private Invitations',
        priceId: envOrDefault('STRIPE_PRICE_PRIVATE_INVITE_3', 'price_1T4E1aKpQn3RDJUCMLLV7g4D'),
        grantField: 'purchasedPrivateCredits',
        grantAmount: 3,
        grantType: 'private_invitation',
    },
    c3: {
        planId: 'c3',
        name: '5 Private Invitations',
        priceId: envOrDefault('STRIPE_PRICE_PRIVATE_INVITE_5', 'price_1T4E1xKpQn3RDJUC6wYEr9I1'),
        grantField: 'purchasedPrivateCredits',
        grantAmount: 5,
        grantType: 'private_invitation',
    },
    c4: {
        planId: 'c4',
        name: '10 Private Invitations',
        priceId: envOrDefault('STRIPE_PRICE_PRIVATE_INVITE_10', 'price_1T4E3EKpQn3RDJUC97Rro1xj'),
        grantField: 'purchasedPrivateCredits',
        grantAmount: 10,
        grantType: 'private_invitation',
    },
    c5: {
        planId: 'c5',
        name: '20 Private Invitations',
        priceId: envOrDefault('STRIPE_PRICE_PRIVATE_INVITE_20', 'price_1T4E8AKpQn3RDJUCc3tJwnAI'),
        grantField: 'purchasedPrivateCredits',
        grantAmount: 20,
        grantType: 'private_invitation',
    },
    d1: {
        planId: 'd1',
        name: '5 Dating Invitations',
        priceId: envOrDefault('STRIPE_PRICE_DATING_INVITE_5', 'price_1TDaNMKpQn3RDJUCWAJdI5YZ'),
        grantField: 'purchasedPrivateCredits',
        grantAmount: 5,
        grantType: 'dating_invitation',
    },
    d2: {
        planId: 'd2',
        name: '10 Dating Invitations',
        priceId: envOrDefault('STRIPE_PRICE_DATING_INVITE_10', 'price_1TDaO5KpQn3RDJUC0vD1Afzj'),
        grantField: 'purchasedPrivateCredits',
        grantAmount: 10,
        grantType: 'dating_invitation',
    },
    o1: {
        planId: 'o1',
        name: '50 Hour Offer Slot',
        priceId: envOrDefault('STRIPE_PRICE_OFFER_SLOT_50H', 'price_1T5mIGKpQn3RDJUCMzhlyN6a'),
        grantField: 'offerCredits',
        grantAmount: 1,
        grantType: 'offer_slot',
    },
};

const PLAN_ALIASES = {
    pro: 'p2',
    premium: 'p3',
    vip: 'p3',
    professional: 'p4',
    elite: 'p5',
};

function normalizePlanId(raw) {
    const id = String(raw || '').trim().toLowerCase();
    return PLAN_ALIASES[id] || id;
}

function getCheckoutItem(planId) {
    const normalized = normalizePlanId(planId);
    const subscription = SUBSCRIPTION_PLANS[normalized];
    if (subscription) {
        return { ...subscription, kind: 'subscription', mode: 'subscription' };
    }

    const pack = ONE_TIME_PACKS[normalized];
    if (pack) {
        return { ...pack, kind: 'one_time_pack', mode: 'payment' };
    }

    return null;
}

function priceIdToCheckoutItem() {
    const entries = [];
    for (const plan of Object.values(SUBSCRIPTION_PLANS)) {
        entries.push([plan.priceId, { ...plan, kind: 'subscription', mode: 'subscription' }]);
    }
    for (const pack of Object.values(ONE_TIME_PACKS)) {
        entries.push([pack.priceId, { ...pack, kind: 'one_time_pack', mode: 'payment' }]);
    }
    return Object.fromEntries(entries.filter(([priceId]) => priceId));
}

module.exports = {
    SUBSCRIPTION_PLANS,
    ONE_TIME_PACKS,
    getCheckoutItem,
    priceIdToCheckoutItem,
};
