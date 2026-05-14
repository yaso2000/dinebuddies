/**
 * Server-owned Stripe checkout catalog.
 *
 * Client-supplied plan and price identifiers are only selectors into this
 * catalog. The charged price and granted entitlement must both resolve from
 * this server-side data.
 */

const CHECKOUT_PRODUCTS = [
    {
        key: 'pro',
        aliases: ['pro', 'p2'],
        type: 'subscription',
        mode: 'subscription',
        planId: 'pro',
        planName: 'Pro Plan',
        tier: 'pro',
        weeklyQuota: 2,
        priceEnvKey: 'STRIPE_PRICE_USER_PRO',
        fallbackPriceId: 'price_1T4DptKpQn3RDJUCrhwtOx0u',
    },
    {
        key: 'premium',
        aliases: ['premium', 'vip', 'p3'],
        type: 'subscription',
        mode: 'subscription',
        planId: 'premium',
        planName: 'Premium Plan',
        tier: 'premium',
        weeklyQuota: -1,
        priceEnvKey: 'STRIPE_PRICE_USER_PREMIUM',
        fallbackPriceId: 'price_1T4DrkKpQn3RDJUC7cPercNu',
    },
    {
        key: 'professional',
        aliases: ['professional', 'p4'],
        type: 'subscription',
        mode: 'subscription',
        planId: 'professional',
        planName: 'Professional Business Plan',
        tier: 'professional',
        weeklyQuota: 0,
        priceEnvKey: 'STRIPE_PRICE_BUSINESS_PROFESSIONAL',
        fallbackPriceId: 'price_1T4DfJKpQn3RDJUC4ANefmpl',
    },
    {
        key: 'elite',
        aliases: ['elite', 'paid', 'business_paid', 'p5'],
        type: 'subscription',
        mode: 'subscription',
        planId: 'elite',
        planName: 'Elite Partner Plan',
        tier: 'elite',
        weeklyQuota: 0,
        priceEnvKey: 'STRIPE_PRICE_BUSINESS_ELITE',
        fallbackPriceId: 'price_1T4DlqKpQn3RDJUC6vrueW0n',
    },
    {
        key: 'offer_slot_50h',
        aliases: ['o1', 'offer_slot_50h'],
        type: 'offer_slot',
        mode: 'payment',
        planId: 'o1',
        planName: '50 Hour Offer Slot',
        tier: null,
        weeklyQuota: 0,
        priceEnvKey: 'STRIPE_PRICE_OFFER_SLOT_50H',
        fallbackPriceId: 'price_1T5mIGKpQn3RDJUCMzhlyN6a',
    },
];

function normalize(value) {
    return String(value || '').trim().toLowerCase();
}

function withConfiguredPrice(product) {
    const configuredPriceId = String(process.env[product.priceEnvKey] || '').trim();
    return {
        ...product,
        priceId: configuredPriceId || product.fallbackPriceId,
    };
}

function getCheckoutProducts() {
    return CHECKOUT_PRODUCTS.map(withConfiguredPrice);
}

function findByPlanId(planId) {
    const normalizedPlanId = normalize(planId);
    if (!normalizedPlanId) return null;
    return getCheckoutProducts().find((product) => (
        product.key === normalizedPlanId ||
        product.planId === normalizedPlanId ||
        product.aliases.includes(normalizedPlanId)
    )) || null;
}

function findByPriceId(priceId) {
    const requestedPriceId = String(priceId || '').trim();
    if (!requestedPriceId) return null;
    return getCheckoutProducts().find((product) => product.priceId === requestedPriceId) || null;
}

function resolveCheckoutProduct({ planId, priceId } = {}) {
    return findByPlanId(planId) || findByPriceId(priceId);
}

function isExpectedPriceForProduct(product, priceIds) {
    if (!product || !product.priceId) return false;
    const paidPriceIds = Array.isArray(priceIds) ? priceIds : [];
    return paidPriceIds.includes(product.priceId);
}

module.exports = {
    getCheckoutProducts,
    resolveCheckoutProduct,
    findByPlanId,
    findByPriceId,
    isExpectedPriceForProduct,
};
