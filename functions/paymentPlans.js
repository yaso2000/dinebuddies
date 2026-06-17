/**
 * Server-owned Stripe checkout catalog.
 *
 * Client payloads may request a plan/pack id, but must never be trusted for
 * Stripe price, checkout mode, tier, quota, or fulfillment behavior.
 */

const PLANS = {
    p2: {
        id: 'p2',
        kind: 'subscription',
        mode: 'subscription',
        priceId: 'price_1T4DptKpQn3RDJUCrhwtOx0u',
        tier: 'pro',
        weeklyPrivateQuota: 4,
        name: 'Pro Plan',
    },
    p3: {
        id: 'p3',
        kind: 'subscription',
        mode: 'subscription',
        priceId: 'price_1T4DrkKpQn3RDJUC7cPercNu',
        tier: 'vip',
        weeklyPrivateQuota: 10,
        name: 'Premium Plan',
    },
    p4: {
        id: 'p4',
        kind: 'subscription',
        mode: 'subscription',
        priceId: 'price_1T4DfJKpQn3RDJUC4ANefmpl',
        tier: 'professional',
        weeklyPrivateQuota: 0,
        name: 'Professional Business Plan',
    },
    p5: {
        id: 'p5',
        kind: 'subscription',
        mode: 'subscription',
        priceId: 'price_1T4DlqKpQn3RDJUC6vrueW0n',
        tier: 'elite',
        weeklyPrivateQuota: 0,
        name: 'Elite Partner Plan',
    },
    c1: {
        id: 'c1',
        kind: 'private_pack',
        mode: 'payment',
        priceId: 'price_1T4DyrKpQn3RDJUCN6ipD592',
        privateCredits: 1,
        name: 'Single Private Invitation',
    },
    c2: {
        id: 'c2',
        kind: 'private_pack',
        mode: 'payment',
        priceId: 'price_1T4E1aKpQn3RDJUCMLLV7g4D',
        privateCredits: 3,
        name: '3 Private Invitations',
    },
    c3: {
        id: 'c3',
        kind: 'private_pack',
        mode: 'payment',
        priceId: 'price_1T4E1xKpQn3RDJUC6wYEr9I1',
        privateCredits: 5,
        name: '5 Private Invitations',
    },
    c4: {
        id: 'c4',
        kind: 'private_pack',
        mode: 'payment',
        priceId: 'price_1T4E3EKpQn3RDJUC97Rro1xj',
        privateCredits: 10,
        name: '10 Private Invitations',
    },
    c5: {
        id: 'c5',
        kind: 'private_pack',
        mode: 'payment',
        priceId: 'price_1T4E8AKpQn3RDJUCc3tJwnAI',
        privateCredits: 20,
        name: '20 Private Invitations',
    },
    d1: {
        id: 'd1',
        kind: 'private_pack',
        mode: 'payment',
        priceId: 'price_1TDaNMKpQn3RDJUCWAJdI5YZ',
        privateCredits: 5,
        name: '5 Dating Invitations',
    },
    d2: {
        id: 'd2',
        kind: 'private_pack',
        mode: 'payment',
        priceId: 'price_1TDaO5KpQn3RDJUC0vD1Afzj',
        privateCredits: 10,
        name: '10 Dating Invitations',
    },
    o1: {
        id: 'o1',
        kind: 'offer_pack',
        mode: 'payment',
        priceId: 'price_1T5mIGKpQn3RDJUCMzhlyN6a',
        offerCredits: 1,
        name: '50 Hour Offer Slot',
    },
};

const PLAN_ALIASES = {
    pro: 'p2',
    premium: 'p3',
    vip: 'p3',
    professional: 'p4',
    elite: 'p5',
};

const PRICE_TO_PLAN_ID = Object.fromEntries(
    Object.values(PLANS).map((plan) => [plan.priceId, plan.id])
);

function normalizePlanId(planId) {
    const raw = String(planId || '').trim().toLowerCase();
    return PLAN_ALIASES[raw] || raw;
}

function getPaymentPlan(planId) {
    return PLANS[normalizePlanId(planId)] || null;
}

function getPaymentPlanByPriceId(priceId) {
    const id = PRICE_TO_PLAN_ID[String(priceId || '').trim()];
    return id ? PLANS[id] : null;
}

function isSubscriptionPlan(plan) {
    return plan?.kind === 'subscription';
}

module.exports = {
    PLANS,
    normalizePlanId,
    getPaymentPlan,
    getPaymentPlanByPriceId,
    isSubscriptionPlan,
};
