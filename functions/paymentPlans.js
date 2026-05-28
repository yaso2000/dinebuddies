const PLAN_DEFINITIONS = [
    {
        id: 'p2',
        aliases: ['pro'],
        priceId: 'price_1T4DptKpQn3RDJUCrhwtOx0u',
        mode: 'subscription',
        purchaseType: 'subscription',
        planName: 'Pro Plan',
        subscriptionTier: 'pro',
        weeklyPrivateQuota: 2,
    },
    {
        id: 'p3',
        aliases: ['premium', 'vip'],
        priceId: 'price_1T4DrkKpQn3RDJUC7cPercNu',
        mode: 'subscription',
        purchaseType: 'subscription',
        planName: 'Premium Plan',
        subscriptionTier: 'vip',
        weeklyPrivateQuota: 10,
    },
    {
        id: 'p4',
        aliases: ['professional'],
        priceId: 'price_1T4DfJKpQn3RDJUC4ANefmpl',
        mode: 'subscription',
        purchaseType: 'subscription',
        planName: 'Professional Business Plan',
        subscriptionTier: 'professional',
        weeklyPrivateQuota: 0,
    },
    {
        id: 'p5',
        aliases: ['elite'],
        priceId: 'price_1T4DlqKpQn3RDJUC6vrueW0n',
        mode: 'subscription',
        purchaseType: 'subscription',
        planName: 'Elite Partner Plan',
        subscriptionTier: 'elite',
        weeklyPrivateQuota: 0,
    },
    {
        id: 'c1',
        priceId: 'price_1T4DyrKpQn3RDJUCN6ipD592',
        mode: 'payment',
        purchaseType: 'private_invitation_pack',
        planName: 'Single Private Invitation',
        privateCredits: 1,
    },
    {
        id: 'c2',
        priceId: 'price_1T4E1aKpQn3RDJUCMLLV7g4D',
        mode: 'payment',
        purchaseType: 'private_invitation_pack',
        planName: '3 Private Invitations',
        privateCredits: 3,
    },
    {
        id: 'c3',
        priceId: 'price_1T4E1xKpQn3RDJUC6wYEr9I1',
        mode: 'payment',
        purchaseType: 'private_invitation_pack',
        planName: '5 Private Invitations',
        privateCredits: 5,
    },
    {
        id: 'c4',
        priceId: 'price_1T4E3EKpQn3RDJUC97Rro1xj',
        mode: 'payment',
        purchaseType: 'private_invitation_pack',
        planName: '10 Private Invitations',
        privateCredits: 10,
    },
    {
        id: 'c5',
        priceId: 'price_1T4E8AKpQn3RDJUCc3tJwnAI',
        mode: 'payment',
        purchaseType: 'private_invitation_pack',
        planName: '20 Private Invitations',
        privateCredits: 20,
    },
    {
        id: 'd1',
        priceId: 'price_1TDaNMKpQn3RDJUCWAJdI5YZ',
        mode: 'payment',
        purchaseType: 'private_invitation_pack',
        planName: '5 Dating Invitations',
        privateCredits: 5,
    },
    {
        id: 'd2',
        priceId: 'price_1TDaO5KpQn3RDJUC0vD1Afzj',
        mode: 'payment',
        purchaseType: 'private_invitation_pack',
        planName: '10 Dating Invitations',
        privateCredits: 10,
    },
    {
        id: 'o1',
        priceId: 'price_1T5mIGKpQn3RDJUCMzhlyN6a',
        mode: 'payment',
        purchaseType: 'offer_slot_pack',
        planName: '50 Hour Offer Slot',
        offerCredits: 1,
    },
];

function normalizeKey(value) {
    return String(value || '').trim().toLowerCase();
}

function clonePlan(plan) {
    return plan ? { ...plan, aliases: [...(plan.aliases || [])] } : null;
}

const plansById = new Map();
const plansByPriceId = new Map();

for (const plan of PLAN_DEFINITIONS) {
    plansById.set(normalizeKey(plan.id), plan);
    for (const alias of plan.aliases || []) {
        plansById.set(normalizeKey(alias), plan);
    }
    plansByPriceId.set(String(plan.priceId).trim(), plan);
}

function getCheckoutPlan(planId) {
    return clonePlan(plansById.get(normalizeKey(planId)));
}

function getCheckoutPlanByPriceId(priceId) {
    return clonePlan(plansByPriceId.get(String(priceId || '').trim()));
}

function listCheckoutPlans() {
    return PLAN_DEFINITIONS.map(clonePlan);
}

module.exports = {
    getCheckoutPlan,
    getCheckoutPlanByPriceId,
    listCheckoutPlans,
};
