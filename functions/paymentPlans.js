/**
 * Server-owned Stripe price catalog.
 *
 * Clients may pass display metadata for UX, but entitlement decisions must be
 * derived from the Stripe Price that was actually paid.
 */

const SUBSCRIPTION_PLANS = [
    {
        id: 'p2',
        aliases: ['pro'],
        name: 'Pro Plan',
        envKey: 'STRIPE_PRICE_USER_PRO',
        fallbackPriceId: 'price_1T4DptKpQn3RDJUCrhwtOx0u',
        tier: 'pro',
        weeklyPrivateQuota: 2,
    },
    {
        id: 'p3',
        aliases: ['premium', 'vip'],
        name: 'Premium Plan',
        envKey: 'STRIPE_PRICE_USER_PREMIUM',
        fallbackPriceId: 'price_1T4DrkKpQn3RDJUC7cPercNu',
        tier: 'vip',
        weeklyPrivateQuota: -1,
    },
    {
        id: 'p4',
        aliases: ['professional'],
        name: 'Professional Business Plan',
        envKey: 'STRIPE_PRICE_BUSINESS_PROFESSIONAL',
        fallbackPriceId: 'price_1T4DfJKpQn3RDJUC4ANefmpl',
        tier: 'professional',
        weeklyPrivateQuota: 0,
    },
    {
        id: 'p5',
        aliases: ['elite', 'paid_business'],
        name: 'Elite Partner Plan',
        envKey: 'STRIPE_PRICE_BUSINESS_ELITE',
        fallbackPriceId: 'price_1T4DlqKpQn3RDJUC6vrueW0n',
        tier: 'elite',
        weeklyPrivateQuota: 0,
    },
];

const ONE_TIME_PACKS = [
    { id: 'c1', envKey: 'STRIPE_PRICE_PRIVATE_1', fallbackPriceId: 'price_1T4DyrKpQn3RDJUCN6ipD592', purchaseType: 'private_invitation_pack', privateCredits: 1 },
    { id: 'c2', envKey: 'STRIPE_PRICE_PRIVATE_3', fallbackPriceId: 'price_1T4E1aKpQn3RDJUCMLLV7g4D', purchaseType: 'private_invitation_pack', privateCredits: 3 },
    { id: 'c3', envKey: 'STRIPE_PRICE_PRIVATE_5', fallbackPriceId: 'price_1T4E1xKpQn3RDJUC6wYEr9I1', purchaseType: 'private_invitation_pack', privateCredits: 5 },
    { id: 'c4', envKey: 'STRIPE_PRICE_PRIVATE_10', fallbackPriceId: 'price_1T4E3EKpQn3RDJUC97Rro1xj', purchaseType: 'private_invitation_pack', privateCredits: 10 },
    { id: 'c5', envKey: 'STRIPE_PRICE_PRIVATE_20', fallbackPriceId: 'price_1T4E8AKpQn3RDJUCc3tJwnAI', purchaseType: 'private_invitation_pack', privateCredits: 20 },
    { id: 'd1', envKey: 'STRIPE_PRICE_DATING_5', fallbackPriceId: 'price_1TDaNMKpQn3RDJUCWAJdI5YZ', purchaseType: 'private_invitation_pack', privateCredits: 5 },
    { id: 'd2', envKey: 'STRIPE_PRICE_DATING_10', fallbackPriceId: 'price_1TDaO5KpQn3RDJUC0vD1Afzj', purchaseType: 'private_invitation_pack', privateCredits: 10 },
    { id: 'o1', envKey: 'STRIPE_PRICE_OFFER_SLOT_50H', fallbackPriceId: 'price_1T5mIGKpQn3RDJUCMzhlyN6a', purchaseType: 'offer_slot_pack', offerCredits: 1 },
];

function configuredPriceId(def) {
    const fromEnv = String(process.env[def.envKey] || '').trim();
    return fromEnv || def.fallbackPriceId;
}

function withRuntimeFields(def, mode) {
    return {
        ...def,
        mode,
        priceId: configuredPriceId(def),
    };
}

function getAllPaymentPlans() {
    return [
        ...SUBSCRIPTION_PLANS.map((def) => withRuntimeFields(def, 'subscription')),
        ...ONE_TIME_PACKS.map((def) => withRuntimeFields(def, 'payment')),
    ];
}

function findPaymentPlanByPriceId(priceId) {
    const normalized = String(priceId || '').trim();
    if (!normalized) return null;
    return getAllPaymentPlans().find((plan) => plan.priceId === normalized) || null;
}

function findPaymentPlanById(planId) {
    const normalized = String(planId || '').trim().toLowerCase();
    if (!normalized) return null;
    return getAllPaymentPlans().find((plan) => (
        plan.id.toLowerCase() === normalized ||
        (Array.isArray(plan.aliases) && plan.aliases.includes(normalized))
    )) || null;
}

function resolvePaymentPlan(input = {}) {
    const byPrice = findPaymentPlanByPriceId(input.priceId);
    if (byPrice) return byPrice;
    return findPaymentPlanById(input.planId);
}

module.exports = {
    getAllPaymentPlans,
    findPaymentPlanByPriceId,
    findPaymentPlanById,
    resolvePaymentPlan,
};
