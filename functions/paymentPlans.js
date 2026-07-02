const CHECKOUT_PLANS = {
    p2: {
        id: 'p2',
        aliases: ['pro'],
        name: 'Pro Plan',
        envKey: 'STRIPE_PRICE_USER_PRO',
        defaultPriceId: 'price_1T4DptKpQn3RDJUCrhwtOx0u',
        mode: 'subscription',
        fulfillment: 'subscription',
        tier: 'pro',
        weeklyPrivateQuota: 4,
    },
    p3: {
        id: 'p3',
        aliases: ['premium', 'vip'],
        name: 'Premium Plan',
        envKey: 'STRIPE_PRICE_USER_VIP',
        defaultPriceId: 'price_1T4DrkKpQn3RDJUC7cPercNu',
        mode: 'subscription',
        fulfillment: 'subscription',
        tier: 'vip',
        weeklyPrivateQuota: 10,
    },
    p4: {
        id: 'p4',
        aliases: ['professional'],
        name: 'Professional Business Plan',
        envKey: 'STRIPE_PRICE_BUSINESS_PROFESSIONAL',
        defaultPriceId: 'price_1T4DfJKpQn3RDJUC4ANefmpl',
        mode: 'subscription',
        fulfillment: 'subscription',
        tier: 'professional',
        weeklyPrivateQuota: 0,
    },
    p5: {
        id: 'p5',
        aliases: ['elite'],
        name: 'Elite Partner Plan',
        envKey: 'STRIPE_PRICE_BUSINESS_ELITE',
        defaultPriceId: 'price_1T4DlqKpQn3RDJUC6vrueW0n',
        mode: 'subscription',
        fulfillment: 'subscription',
        tier: 'elite',
        weeklyPrivateQuota: 0,
    },
    c1: {
        id: 'c1',
        name: 'Single Private Invitation',
        envKey: 'STRIPE_PRICE_PRIVATE_INVITE_1',
        defaultPriceId: 'price_1T4DyrKpQn3RDJUCN6ipD592',
        mode: 'payment',
        fulfillment: 'private_pack',
        privateCredits: 1,
    },
    c2: {
        id: 'c2',
        name: '3 Private Invitations',
        envKey: 'STRIPE_PRICE_PRIVATE_INVITE_3',
        defaultPriceId: 'price_1T4E1aKpQn3RDJUCMLLV7g4D',
        mode: 'payment',
        fulfillment: 'private_pack',
        privateCredits: 3,
    },
    c3: {
        id: 'c3',
        name: '5 Private Invitations',
        envKey: 'STRIPE_PRICE_PRIVATE_INVITE_5',
        defaultPriceId: 'price_1T4E1xKpQn3RDJUC6wYEr9I1',
        mode: 'payment',
        fulfillment: 'private_pack',
        privateCredits: 5,
    },
    c4: {
        id: 'c4',
        name: '10 Private Invitations',
        envKey: 'STRIPE_PRICE_PRIVATE_INVITE_10',
        defaultPriceId: 'price_1T4E3EKpQn3RDJUC97Rro1xj',
        mode: 'payment',
        fulfillment: 'private_pack',
        privateCredits: 10,
    },
    c5: {
        id: 'c5',
        name: '20 Private Invitations',
        envKey: 'STRIPE_PRICE_PRIVATE_INVITE_20',
        defaultPriceId: 'price_1T4E8AKpQn3RDJUCc3tJwnAI',
        mode: 'payment',
        fulfillment: 'private_pack',
        privateCredits: 20,
    },
    d1: {
        id: 'd1',
        name: '5 Dating Invitations',
        envKey: 'STRIPE_PRICE_DATING_INVITE_5',
        defaultPriceId: 'price_1TDaNMKpQn3RDJUCWAJdI5YZ',
        mode: 'payment',
        fulfillment: 'private_pack',
        privateCredits: 5,
    },
    d2: {
        id: 'd2',
        name: '10 Dating Invitations',
        envKey: 'STRIPE_PRICE_DATING_INVITE_10',
        defaultPriceId: 'price_1TDaO5KpQn3RDJUC0vD1Afzj',
        mode: 'payment',
        fulfillment: 'private_pack',
        privateCredits: 10,
    },
    o1: {
        id: 'o1',
        name: '50 Hour Offer Slot',
        envKey: 'STRIPE_PRICE_OFFER_SLOT_1',
        defaultPriceId: 'price_1T5mIGKpQn3RDJUCMzhlyN6a',
        mode: 'payment',
        fulfillment: 'offer_pack',
        offerCredits: 1,
    },
};

function normalizeId(value) {
    return String(value || '').trim().toLowerCase();
}

function resolvePriceId(def) {
    return String(process.env[def.envKey] || def.defaultPriceId || '').trim();
}

function withResolvedPrice(def) {
    if (!def) return null;
    return Object.freeze({
        ...def,
        priceId: resolvePriceId(def),
    });
}

function getCheckoutPlan(planId) {
    const id = normalizeId(planId);
    if (!id) return null;
    if (CHECKOUT_PLANS[id]) return withResolvedPrice(CHECKOUT_PLANS[id]);
    const plan = Object.values(CHECKOUT_PLANS).find((def) => (def.aliases || []).includes(id));
    return withResolvedPrice(plan);
}

function getCheckoutPlanByPriceId(priceId) {
    const expected = String(priceId || '').trim();
    if (!expected) return null;
    return Object.values(CHECKOUT_PLANS)
        .map(withResolvedPrice)
        .find((def) => def.priceId === expected) || null;
}

function getSubscriptionPlanByPriceId(priceId) {
    const plan = getCheckoutPlanByPriceId(priceId);
    return plan && plan.fulfillment === 'subscription' ? plan : null;
}

module.exports = {
    CHECKOUT_PLANS,
    getCheckoutPlan,
    getCheckoutPlanByPriceId,
    getSubscriptionPlanByPriceId,
};
