const CHECKOUT_ITEMS = {
    p2: {
        id: 'p2',
        name: 'Pro Plan',
        mode: 'subscription',
        priceId: process.env.STRIPE_PRICE_USER_PRO || 'price_1T4DptKpQn3RDJUCrhwtOx0u',
        tier: 'pro',
        weeklyPrivateQuota: 2,
    },
    p3: {
        id: 'p3',
        name: 'Premium Plan',
        mode: 'subscription',
        priceId: process.env.STRIPE_PRICE_USER_VIP || 'price_1T4DrkKpQn3RDJUC7cPercNu',
        tier: 'vip',
        weeklyPrivateQuota: -1,
    },
    p4: {
        id: 'p4',
        name: 'Professional Business Plan',
        mode: 'subscription',
        priceId: process.env.STRIPE_PRICE_BUSINESS_PROFESSIONAL || 'price_1T4DfJKpQn3RDJUC4ANefmpl',
        tier: 'professional',
        weeklyPrivateQuota: 0,
    },
    p5: {
        id: 'p5',
        name: 'Elite Partner Plan',
        mode: 'subscription',
        priceId: process.env.STRIPE_PRICE_BUSINESS_MONTHLY || 'price_1T4DlqKpQn3RDJUC6vrueW0n',
        tier: 'elite',
        weeklyPrivateQuota: 0,
    },
    o1: {
        id: 'o1',
        name: '50 Hour Offer Slot',
        mode: 'payment',
        purchaseType: 'offer_slot',
        priceId: process.env.STRIPE_PRICE_OFFER_SLOT || 'price_1T5mIGKpQn3RDJUCMzhlyN6a',
        offerCredits: 1,
    },
};

const PLAN_ALIASES = {
    pro: 'p2',
    premium: 'p3',
    vip: 'p3',
    professional: 'p4',
    elite: 'p5',
    paid: 'p5',
};

function normalizeCheckoutItemId(rawId) {
    const id = String(rawId || '').trim().toLowerCase();
    return PLAN_ALIASES[id] || id;
}

function getCheckoutItem(rawId) {
    return CHECKOUT_ITEMS[normalizeCheckoutItemId(rawId)] || null;
}

function getCheckoutItemByPriceId(rawPriceId) {
    const priceId = String(rawPriceId || '').trim();
    if (!priceId) return null;
    return Object.values(CHECKOUT_ITEMS).find((item) => item.priceId === priceId) || null;
}

function getCheckoutMetadata(item, userId, planName) {
    const metadata = {
        userId,
        planId: item.id,
        planName: planName || item.name,
    };
    if (item.purchaseType) metadata.purchaseType = item.purchaseType;
    return metadata;
}

module.exports = {
    CHECKOUT_ITEMS,
    normalizeCheckoutItemId,
    getCheckoutItem,
    getCheckoutItemByPriceId,
    getCheckoutMetadata,
};
