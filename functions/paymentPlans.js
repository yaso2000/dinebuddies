const CHECKOUT_PRODUCTS = Object.freeze({
    p2: {
        id: 'p2',
        name: 'Pro Plan',
        mode: 'subscription',
        defaultPriceId: 'price_1T4DptKpQn3RDJUCrhwtOx0u',
        envKey: 'STRIPE_PRICE_USER_PRO',
        subscriptionTier: 'pro',
        weeklyPrivateQuota: 2,
    },
    p3: {
        id: 'p3',
        name: 'Premium Plan',
        mode: 'subscription',
        defaultPriceId: 'price_1T4DrkKpQn3RDJUC7cPercNu',
        envKey: 'STRIPE_PRICE_USER_PREMIUM',
        subscriptionTier: 'vip',
        weeklyPrivateQuota: -1,
    },
    p4: {
        id: 'p4',
        name: 'Professional Business Plan',
        mode: 'subscription',
        defaultPriceId: 'price_1T4DfJKpQn3RDJUC4ANefmpl',
        envKey: 'STRIPE_PRICE_BUSINESS_PROFESSIONAL',
        subscriptionTier: 'professional',
        weeklyPrivateQuota: 0,
    },
    p5: {
        id: 'p5',
        name: 'Elite Partner Plan',
        mode: 'subscription',
        defaultPriceId: 'price_1T4DlqKpQn3RDJUC6vrueW0n',
        envKey: 'STRIPE_PRICE_BUSINESS_ELITE',
        subscriptionTier: 'elite',
        weeklyPrivateQuota: 0,
    },
    c1: {
        id: 'c1',
        name: 'Single Private Invitation',
        mode: 'payment',
        defaultPriceId: 'price_1T4DyrKpQn3RDJUCN6ipD592',
        envKey: 'STRIPE_PRICE_PRIVATE_INVITE_1',
        purchaseType: 'private_invitation_credits',
        credits: 1,
    },
    c2: {
        id: 'c2',
        name: '3 Private Invitations',
        mode: 'payment',
        defaultPriceId: 'price_1T4E1aKpQn3RDJUCMLLV7g4D',
        envKey: 'STRIPE_PRICE_PRIVATE_INVITE_3',
        purchaseType: 'private_invitation_credits',
        credits: 3,
    },
    c3: {
        id: 'c3',
        name: '5 Private Invitations',
        mode: 'payment',
        defaultPriceId: 'price_1T4E1xKpQn3RDJUC6wYEr9I1',
        envKey: 'STRIPE_PRICE_PRIVATE_INVITE_5',
        purchaseType: 'private_invitation_credits',
        credits: 5,
    },
    c4: {
        id: 'c4',
        name: '10 Private Invitations',
        mode: 'payment',
        defaultPriceId: 'price_1T4E3EKpQn3RDJUC97Rro1xj',
        envKey: 'STRIPE_PRICE_PRIVATE_INVITE_10',
        purchaseType: 'private_invitation_credits',
        credits: 10,
    },
    c5: {
        id: 'c5',
        name: '20 Private Invitations',
        mode: 'payment',
        defaultPriceId: 'price_1T4E8AKpQn3RDJUCc3tJwnAI',
        envKey: 'STRIPE_PRICE_PRIVATE_INVITE_20',
        purchaseType: 'private_invitation_credits',
        credits: 20,
    },
    d1: {
        id: 'd1',
        name: '5 Dating Invitations',
        mode: 'payment',
        defaultPriceId: 'price_1TDaNMKpQn3RDJUCWAJdI5YZ',
        envKey: 'STRIPE_PRICE_DATING_INVITE_5',
        purchaseType: 'private_invitation_credits',
        credits: 5,
    },
    d2: {
        id: 'd2',
        name: '10 Dating Invitations',
        mode: 'payment',
        defaultPriceId: 'price_1TDaO5KpQn3RDJUC0vD1Afzj',
        envKey: 'STRIPE_PRICE_DATING_INVITE_10',
        purchaseType: 'private_invitation_credits',
        credits: 10,
    },
    o1: {
        id: 'o1',
        name: '50 Hour Offer Slot',
        mode: 'payment',
        defaultPriceId: 'price_1T5mIGKpQn3RDJUCMzhlyN6a',
        envKey: 'STRIPE_PRICE_OFFER_SLOT_1',
        purchaseType: 'offer_credits',
        credits: 1,
    },
});

const PRODUCT_ALIASES = Object.freeze({
    pro: 'p2',
    premium: 'p3',
    vip: 'p3',
    professional: 'p4',
    elite: 'p5',
});

function normalizeProductId(productId) {
    const raw = String(productId || '').trim().toLowerCase();
    return PRODUCT_ALIASES[raw] || raw;
}

function materializeProduct(product) {
    if (!product) return null;
    const priceId = String(process.env[product.envKey] || product.defaultPriceId || '').trim();
    if (!priceId) return null;
    return Object.freeze({ ...product, priceId });
}

function getCheckoutProduct(productId) {
    return materializeProduct(CHECKOUT_PRODUCTS[normalizeProductId(productId)]);
}

function getCheckoutProductByPriceId(priceId) {
    const target = String(priceId || '').trim();
    if (!target) return null;
    for (const product of Object.values(CHECKOUT_PRODUCTS)) {
        const materialized = materializeProduct(product);
        if (materialized && materialized.priceId === target) return materialized;
    }
    return null;
}

module.exports = {
    getCheckoutProduct,
    getCheckoutProductByPriceId,
    normalizeProductId,
};
