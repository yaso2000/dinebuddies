const CHECKOUT_PRODUCTS = Object.freeze({
    pro: {
        canonicalPlanId: 'pro',
        tier: 'pro',
        name: 'Pro Plan',
        priceId: 'price_1T4DptKpQn3RDJUCrhwtOx0u',
        mode: 'subscription',
        weeklyPrivateQuota: 2,
    },
    p2: {
        canonicalPlanId: 'pro',
        tier: 'pro',
        name: 'Pro Plan',
        priceId: 'price_1T4DptKpQn3RDJUCrhwtOx0u',
        mode: 'subscription',
        weeklyPrivateQuota: 2,
    },
    vip: {
        canonicalPlanId: 'vip',
        tier: 'vip',
        name: 'Premium Plan',
        priceId: 'price_1T4DrkKpQn3RDJUC7cPercNu',
        mode: 'subscription',
        weeklyPrivateQuota: -1,
    },
    premium: {
        canonicalPlanId: 'vip',
        tier: 'vip',
        name: 'Premium Plan',
        priceId: 'price_1T4DrkKpQn3RDJUC7cPercNu',
        mode: 'subscription',
        weeklyPrivateQuota: -1,
    },
    p3: {
        canonicalPlanId: 'vip',
        tier: 'vip',
        name: 'Premium Plan',
        priceId: 'price_1T4DrkKpQn3RDJUC7cPercNu',
        mode: 'subscription',
        weeklyPrivateQuota: -1,
    },
    professional: {
        canonicalPlanId: 'professional',
        tier: 'professional',
        name: 'Professional Business Plan',
        priceId: 'price_1T4DfJKpQn3RDJUC4ANefmpl',
        mode: 'subscription',
        weeklyPrivateQuota: 0,
    },
    p4: {
        canonicalPlanId: 'professional',
        tier: 'professional',
        name: 'Professional Business Plan',
        priceId: 'price_1T4DfJKpQn3RDJUC4ANefmpl',
        mode: 'subscription',
        weeklyPrivateQuota: 0,
    },
    elite: {
        canonicalPlanId: 'elite',
        tier: 'elite',
        name: 'Elite Partner Plan',
        priceId: 'price_1T4DlqKpQn3RDJUC6vrueW0n',
        mode: 'subscription',
        weeklyPrivateQuota: 0,
    },
    p5: {
        canonicalPlanId: 'elite',
        tier: 'elite',
        name: 'Elite Partner Plan',
        priceId: 'price_1T4DlqKpQn3RDJUC6vrueW0n',
        mode: 'subscription',
        weeklyPrivateQuota: 0,
    },
    o1: {
        canonicalPlanId: 'o1',
        tier: null,
        name: '50 Hour Offer Slot',
        priceId: 'price_1T5mIGKpQn3RDJUCMzhlyN6a',
        mode: 'payment',
        purchaseType: 'offer_slot',
        offerCredits: 1,
    },
});

function normalizePlanId(planId) {
    return String(planId || '').trim().toLowerCase();
}

function normalizePriceId(priceId) {
    return String(priceId || '').trim();
}

function cloneProduct(product) {
    return product ? { ...product } : null;
}

function getCheckoutProduct(planId) {
    return cloneProduct(CHECKOUT_PRODUCTS[normalizePlanId(planId)]);
}

function resolveCheckoutProduct({ planId, priceId }) {
    const product = getCheckoutProduct(planId);
    if (!product) return null;

    const requestedPriceId = normalizePriceId(priceId);
    if (requestedPriceId && requestedPriceId !== product.priceId) {
        return null;
    }

    return product;
}

function getTierForPlan(planId) {
    const product = getCheckoutProduct(planId);
    if (product?.tier) return product.tier;

    const id = normalizePlanId(planId);
    if (id.includes('elite')) return 'elite';
    if (id.includes('professional')) return 'professional';
    if (id.includes('premium') || id.includes('vip')) return 'vip';
    if (id.includes('pro')) return 'pro';
    return 'free';
}

function getQuotaForPlan(planId) {
    const product = getCheckoutProduct(planId);
    if (Number.isFinite(product?.weeklyPrivateQuota)) return product.weeklyPrivateQuota;

    const tier = getTierForPlan(planId);
    if (tier === 'vip') return -1;
    if (tier === 'pro') return 2;
    return 0;
}

module.exports = {
    CHECKOUT_PRODUCTS,
    getCheckoutProduct,
    getQuotaForPlan,
    getTierForPlan,
    normalizePlanId,
    resolveCheckoutProduct,
};
