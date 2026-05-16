/**
 * Server-owned Stripe subscription catalog.
 *
 * Clients may display their own plan metadata, but checkout/webhook entitlement
 * writes must be derived from this file so a caller cannot pair a cheap price
 * with a more privileged planId.
 */

const SUBSCRIPTION_PLANS = [
    {
        id: 'p2',
        aliases: ['pro'],
        name: 'Pro Plan',
        priceId: 'price_1T4DptKpQn3RDJUCrhwtOx0u',
        envKey: 'STRIPE_PRICE_USER_PRO',
        tier: 'pro',
        weeklyPrivateQuota: 2,
    },
    {
        id: 'p3',
        aliases: ['premium', 'vip'],
        name: 'Premium Plan',
        priceId: 'price_1T4DrkKpQn3RDJUC7cPercNu',
        envKey: 'STRIPE_PRICE_USER_PREMIUM',
        tier: 'vip',
        weeklyPrivateQuota: -1,
    },
    {
        id: 'p4',
        aliases: ['professional'],
        name: 'Professional Business Plan',
        priceId: 'price_1T4DfJKpQn3RDJUC4ANefmpl',
        envKey: 'STRIPE_PRICE_BUSINESS_PROFESSIONAL',
        tier: 'professional',
        weeklyPrivateQuota: 0,
    },
    {
        id: 'p5',
        aliases: ['elite', 'paid'],
        name: 'Paid Business',
        priceId: 'price_1T4DlqKpQn3RDJUC6vrueW0n',
        envKey: 'STRIPE_PRICE_BUSINESS_MONTHLY',
        tier: 'elite',
        weeklyPrivateQuota: 0,
    },
];

function configuredPriceId(plan) {
    return String(process.env[plan.envKey] || plan.priceId || '').trim();
}

function normalizePlan(plan) {
    if (!plan) return null;
    const priceId = configuredPriceId(plan);
    if (!priceId) return null;
    return { ...plan, priceId };
}

function normalizeKey(value) {
    return String(value || '').trim().toLowerCase();
}

function resolveSubscriptionPlan(planId) {
    const key = normalizeKey(planId);
    if (!key) return null;
    const found = SUBSCRIPTION_PLANS.find((plan) => (
        normalizeKey(plan.id) === key ||
        normalizeKey(plan.tier) === key ||
        (plan.aliases || []).some((alias) => normalizeKey(alias) === key)
    ));
    return normalizePlan(found);
}

function resolveSubscriptionPlanByPriceId(priceId) {
    const pid = String(priceId || '').trim();
    if (!pid) return null;
    const found = SUBSCRIPTION_PLANS.find((plan) => configuredPriceId(plan) === pid);
    return normalizePlan(found);
}

module.exports = {
    SUBSCRIPTION_PLANS,
    resolveSubscriptionPlan,
    resolveSubscriptionPlanByPriceId,
};
