const CHECKOUT_PLANS = {
    p2: {
        id: 'p2',
        kind: 'subscription',
        mode: 'subscription',
        name: 'Pro Plan',
        priceId: 'price_1T4DptKpQn3RDJUCrhwtOx0u',
        tier: 'pro',
        weeklyPrivateQuota: 2,
        monthlyPrivateQuota: 4,
    },
    p3: {
        id: 'p3',
        kind: 'subscription',
        mode: 'subscription',
        name: 'Premium Plan',
        priceId: 'price_1T4DrkKpQn3RDJUC7cPercNu',
        tier: 'vip',
        weeklyPrivateQuota: -1,
        monthlyPrivateQuota: 10,
    },
    p4: {
        id: 'p4',
        kind: 'subscription',
        mode: 'subscription',
        name: 'Professional Business Plan',
        priceId: 'price_1T4DfJKpQn3RDJUC4ANefmpl',
        tier: 'professional',
        weeklyPrivateQuota: 0,
        monthlyPrivateQuota: 0,
        offerCredits: 1,
    },
    p5: {
        id: 'p5',
        kind: 'subscription',
        mode: 'subscription',
        name: 'Elite Partner Plan',
        priceId: 'price_1T4DlqKpQn3RDJUC6vrueW0n',
        tier: 'elite',
        weeklyPrivateQuota: 0,
        monthlyPrivateQuota: 0,
        offerCredits: 1,
    },
    // Legacy/business settings caller sends "elite" for the paid business plan.
    elite: {
        id: 'elite',
        kind: 'subscription',
        mode: 'subscription',
        name: 'Paid Business',
        priceId: 'price_1T4DlqKpQn3RDJUC6vrueW0n',
        tier: 'elite',
        weeklyPrivateQuota: 0,
        monthlyPrivateQuota: 0,
        offerCredits: 1,
    },
    c1: {
        id: 'c1',
        kind: 'private_pack',
        mode: 'payment',
        name: 'Single Private Invitation',
        priceId: 'price_1T4DyrKpQn3RDJUCN6ipD592',
        purchasedPrivateCredits: 1,
    },
    c2: {
        id: 'c2',
        kind: 'private_pack',
        mode: 'payment',
        name: '3 Private Invitations',
        priceId: 'price_1T4E1aKpQn3RDJUCMLLV7g4D',
        purchasedPrivateCredits: 3,
    },
    c3: {
        id: 'c3',
        kind: 'private_pack',
        mode: 'payment',
        name: '5 Private Invitations',
        priceId: 'price_1T4E1xKpQn3RDJUC6wYEr9I1',
        purchasedPrivateCredits: 5,
    },
    c4: {
        id: 'c4',
        kind: 'private_pack',
        mode: 'payment',
        name: '10 Private Invitations',
        priceId: 'price_1T4E3EKpQn3RDJUC97Rro1xj',
        purchasedPrivateCredits: 10,
    },
    c5: {
        id: 'c5',
        kind: 'private_pack',
        mode: 'payment',
        name: '20 Private Invitations',
        priceId: 'price_1T4E8AKpQn3RDJUCc3tJwnAI',
        purchasedPrivateCredits: 20,
    },
    d1: {
        id: 'd1',
        kind: 'private_pack',
        mode: 'payment',
        name: '5 Dating Invitations',
        priceId: 'price_1TDaNMKpQn3RDJUCWAJdI5YZ',
        purchasedPrivateCredits: 5,
    },
    d2: {
        id: 'd2',
        kind: 'private_pack',
        mode: 'payment',
        name: '10 Dating Invitations',
        priceId: 'price_1TDaO5KpQn3RDJUC0vD1Afzj',
        purchasedPrivateCredits: 10,
    },
    o1: {
        id: 'o1',
        kind: 'offer_pack',
        mode: 'payment',
        name: '50 Hour Offer Slot',
        priceId: 'price_1T5mIGKpQn3RDJUCMzhlyN6a',
        offerCredits: 1,
    },
};

const PRICE_TO_PLAN_ID = Object.fromEntries(
    Object.values(CHECKOUT_PLANS).map((plan) => [plan.priceId, plan.id])
);

function normalizePlanId(planId) {
    return String(planId || '').trim().toLowerCase();
}

function getCheckoutPlan(planId) {
    return CHECKOUT_PLANS[normalizePlanId(planId)] || null;
}

function getCheckoutPlanByPrice(priceId) {
    const planId = PRICE_TO_PLAN_ID[String(priceId || '').trim()];
    return planId ? CHECKOUT_PLANS[planId] : null;
}

function listCheckoutPlans() {
    return Object.values(CHECKOUT_PLANS).map((plan) => ({ ...plan }));
}

module.exports = {
    CHECKOUT_PLANS,
    getCheckoutPlan,
    getCheckoutPlanByPrice,
    listCheckoutPlans,
};
