const SUBSCRIPTION_PLANS = {
    p2: {
        id: 'p2',
        aliases: ['pro'],
        name: 'Pro Plan',
        priceId: process.env.STRIPE_PRICE_USER_PRO || 'price_1T4DptKpQn3RDJUCrhwtOx0u',
        tier: 'pro',
        currentPlan: 'pro',
        weeklyPrivateQuota: 4,
    },
    p3: {
        id: 'p3',
        aliases: ['premium', 'vip'],
        name: 'Premium Plan',
        priceId: process.env.STRIPE_PRICE_USER_PREMIUM || 'price_1T4DrkKpQn3RDJUC7cPercNu',
        tier: 'vip',
        currentPlan: 'premium',
        weeklyPrivateQuota: 10,
    },
    p4: {
        id: 'p4',
        aliases: ['professional'],
        name: 'Professional Business Plan',
        priceId: process.env.STRIPE_PRICE_BUSINESS_PROFESSIONAL || 'price_1T4DfJKpQn3RDJUC4ANefmpl',
        tier: 'professional',
        currentPlan: 'professional',
        weeklyPrivateQuota: 0,
    },
    p5: {
        id: 'p5',
        aliases: ['elite'],
        name: 'Elite Partner Plan',
        priceId: process.env.STRIPE_PRICE_BUSINESS_ELITE || 'price_1T4DlqKpQn3RDJUC6vrueW0n',
        tier: 'elite',
        currentPlan: 'elite',
        weeklyPrivateQuota: 0,
    },
};

const ONE_TIME_PACKS = {
    c1: {
        id: 'c1',
        name: 'Single Private Invitation',
        priceId: process.env.STRIPE_PRICE_PRIVATE_C1 || 'price_1T4DyrKpQn3RDJUCN6ipD592',
        purchaseType: 'private_invitation_credits',
        creditsField: 'purchasedPrivateCredits',
        credits: 1,
    },
    c2: {
        id: 'c2',
        name: '3 Private Invitations',
        priceId: process.env.STRIPE_PRICE_PRIVATE_C2 || 'price_1T4E1aKpQn3RDJUCMLLV7g4D',
        purchaseType: 'private_invitation_credits',
        creditsField: 'purchasedPrivateCredits',
        credits: 3,
    },
    c3: {
        id: 'c3',
        name: '5 Private Invitations',
        priceId: process.env.STRIPE_PRICE_PRIVATE_C3 || 'price_1T4E1xKpQn3RDJUC6wYEr9I1',
        purchaseType: 'private_invitation_credits',
        creditsField: 'purchasedPrivateCredits',
        credits: 5,
    },
    c4: {
        id: 'c4',
        name: '10 Private Invitations',
        priceId: process.env.STRIPE_PRICE_PRIVATE_C4 || 'price_1T4E3EKpQn3RDJUC97Rro1xj',
        purchaseType: 'private_invitation_credits',
        creditsField: 'purchasedPrivateCredits',
        credits: 10,
    },
    c5: {
        id: 'c5',
        name: '20 Private Invitations',
        priceId: process.env.STRIPE_PRICE_PRIVATE_C5 || 'price_1T4E8AKpQn3RDJUCc3tJwnAI',
        purchaseType: 'private_invitation_credits',
        creditsField: 'purchasedPrivateCredits',
        credits: 20,
    },
    d1: {
        id: 'd1',
        name: '5 Dating Invitations',
        priceId: process.env.STRIPE_PRICE_DATING_D1 || 'price_1TDaNMKpQn3RDJUCWAJdI5YZ',
        purchaseType: 'private_invitation_credits',
        creditsField: 'purchasedPrivateCredits',
        credits: 5,
    },
    d2: {
        id: 'd2',
        name: '10 Dating Invitations',
        priceId: process.env.STRIPE_PRICE_DATING_D2 || 'price_1TDaO5KpQn3RDJUC0vD1Afzj',
        purchaseType: 'private_invitation_credits',
        creditsField: 'purchasedPrivateCredits',
        credits: 10,
    },
    o1: {
        id: 'o1',
        name: '50 Hour Offer Slot',
        priceId: process.env.STRIPE_PRICE_OFFER_O1 || 'price_1T5mIGKpQn3RDJUCMzhlyN6a',
        purchaseType: 'offer_credits',
        creditsField: 'offerCredits',
        credits: 1,
    },
};

function withMode(plan, mode) {
    return { ...plan, mode };
}

const CHECKOUT_PLANS = {
    ...Object.fromEntries(Object.entries(SUBSCRIPTION_PLANS).map(([id, plan]) => [id, withMode(plan, 'subscription')])),
    ...Object.fromEntries(Object.entries(ONE_TIME_PACKS).map(([id, plan]) => [id, withMode(plan, 'payment')])),
};

const PLAN_ALIASES = {};
for (const [id, plan] of Object.entries(CHECKOUT_PLANS)) {
    PLAN_ALIASES[id] = id;
    for (const alias of plan.aliases || []) {
        PLAN_ALIASES[String(alias).toLowerCase()] = id;
    }
}

function normalizeId(id) {
    return String(id || '').trim().toLowerCase();
}

function getCheckoutPlan(id) {
    const key = PLAN_ALIASES[normalizeId(id)];
    return key ? CHECKOUT_PLANS[key] : null;
}

function findCheckoutPlanByPriceId(priceId) {
    const normalized = String(priceId || '').trim();
    if (!normalized) return null;
    return Object.values(CHECKOUT_PLANS).find((plan) => plan.priceId === normalized) || null;
}

function getAllCheckoutPlans() {
    return Object.values(CHECKOUT_PLANS);
}

module.exports = {
    SUBSCRIPTION_PLANS,
    ONE_TIME_PACKS,
    getCheckoutPlan,
    findCheckoutPlanByPriceId,
    getAllCheckoutPlans,
};
