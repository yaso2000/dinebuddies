const SUBSCRIPTION_PRODUCTS = {
    p2: {
        id: 'p2',
        aliases: ['pro'],
        mode: 'subscription',
        priceId: process.env.STRIPE_PRICE_USER_PRO_MONTHLY || 'price_1T4DptKpQn3RDJUCrhwtOx0u',
        planId: 'pro',
        planName: 'Pro Plan',
        subscriptionTier: 'pro',
        weeklyPrivateQuota: 2,
    },
    p3: {
        id: 'p3',
        aliases: ['premium', 'vip'],
        mode: 'subscription',
        priceId: process.env.STRIPE_PRICE_USER_VIP_MONTHLY || 'price_1T4DrkKpQn3RDJUC7cPercNu',
        planId: 'vip',
        planName: 'Premium Plan',
        subscriptionTier: 'vip',
        weeklyPrivateQuota: -1,
    },
    p4: {
        id: 'p4',
        aliases: ['professional'],
        mode: 'subscription',
        priceId: process.env.STRIPE_PRICE_BUSINESS_PROFESSIONAL_MONTHLY || 'price_1T4DfJKpQn3RDJUC4ANefmpl',
        planId: 'professional',
        planName: 'Professional Business Plan',
        subscriptionTier: 'professional',
        weeklyPrivateQuota: 0,
    },
    p5: {
        id: 'p5',
        aliases: ['elite'],
        mode: 'subscription',
        priceId: process.env.STRIPE_PRICE_BUSINESS_ELITE_MONTHLY || 'price_1T4DlqKpQn3RDJUC6vrueW0n',
        planId: 'elite',
        planName: 'Elite Partner Plan',
        subscriptionTier: 'elite',
        weeklyPrivateQuota: 0,
    },
};

const ONE_TIME_PRODUCTS = {
    c1: {
        id: 'c1',
        mode: 'payment',
        priceId: process.env.STRIPE_PRICE_PRIVATE_INVITATION_1 || 'price_1T4DyrKpQn3RDJUCN6ipD592',
        planId: 'c1',
        planName: 'Single Private Invitation',
        purchaseType: 'private_invitation_pack',
        purchasedPrivateCredits: 1,
    },
    c2: {
        id: 'c2',
        mode: 'payment',
        priceId: process.env.STRIPE_PRICE_PRIVATE_INVITATION_3 || 'price_1T4E1aKpQn3RDJUCMLLV7g4D',
        planId: 'c2',
        planName: '3 Private Invitations',
        purchaseType: 'private_invitation_pack',
        purchasedPrivateCredits: 3,
    },
    c3: {
        id: 'c3',
        mode: 'payment',
        priceId: process.env.STRIPE_PRICE_PRIVATE_INVITATION_5 || 'price_1T4E1xKpQn3RDJUC6wYEr9I1',
        planId: 'c3',
        planName: '5 Private Invitations',
        purchaseType: 'private_invitation_pack',
        purchasedPrivateCredits: 5,
    },
    c4: {
        id: 'c4',
        mode: 'payment',
        priceId: process.env.STRIPE_PRICE_PRIVATE_INVITATION_10 || 'price_1T4E3EKpQn3RDJUC97Rro1xj',
        planId: 'c4',
        planName: '10 Private Invitations',
        purchaseType: 'private_invitation_pack',
        purchasedPrivateCredits: 10,
    },
    c5: {
        id: 'c5',
        mode: 'payment',
        priceId: process.env.STRIPE_PRICE_PRIVATE_INVITATION_20 || 'price_1T4E8AKpQn3RDJUCc3tJwnAI',
        planId: 'c5',
        planName: '20 Private Invitations',
        purchaseType: 'private_invitation_pack',
        purchasedPrivateCredits: 20,
    },
    d1: {
        id: 'd1',
        mode: 'payment',
        priceId: process.env.STRIPE_PRICE_DATING_INVITATION_5 || 'price_1TDaNMKpQn3RDJUCWAJdI5YZ',
        planId: 'd1',
        planName: '5 Dating Invitations',
        purchaseType: 'private_invitation_pack',
        purchasedPrivateCredits: 5,
    },
    d2: {
        id: 'd2',
        mode: 'payment',
        priceId: process.env.STRIPE_PRICE_DATING_INVITATION_10 || 'price_1TDaO5KpQn3RDJUC0vD1Afzj',
        planId: 'd2',
        planName: '10 Dating Invitations',
        purchaseType: 'private_invitation_pack',
        purchasedPrivateCredits: 10,
    },
    o1: {
        id: 'o1',
        mode: 'payment',
        priceId: process.env.STRIPE_PRICE_OFFER_SLOT_50H || 'price_1T5mIGKpQn3RDJUCMzhlyN6a',
        planId: 'o1',
        planName: '50 Hour Offer Slot',
        purchaseType: 'offer_slot_pack',
        offerCredits: 1,
    },
};

const CHECKOUT_PRODUCTS = Object.freeze({
    ...SUBSCRIPTION_PRODUCTS,
    ...ONE_TIME_PRODUCTS,
});

const PRODUCT_BY_PRICE_ID = Object.freeze(
    Object.fromEntries(
        Object.values(CHECKOUT_PRODUCTS)
            .filter((product) => product.priceId)
            .map((product) => [product.priceId, product])
    )
);

const PRODUCT_ALIASES = Object.freeze(
    Object.fromEntries(
        Object.values(CHECKOUT_PRODUCTS).flatMap((product) => [
            [product.id, product.id],
            [product.planId, product.id],
            ...((product.aliases || []).map((alias) => [alias, product.id])),
        ])
    )
);

function normalizeProductKey(value) {
    return String(value || '').trim().toLowerCase();
}

function getCheckoutProduct(value) {
    const key = PRODUCT_ALIASES[normalizeProductKey(value)];
    return key ? CHECKOUT_PRODUCTS[key] : null;
}

function getCheckoutProductByPriceId(priceId) {
    return PRODUCT_BY_PRICE_ID[String(priceId || '').trim()] || null;
}

function getSubscriptionProduct(value) {
    const product = getCheckoutProduct(value);
    return product && product.mode === 'subscription' ? product : null;
}

module.exports = {
    CHECKOUT_PRODUCTS,
    getCheckoutProduct,
    getCheckoutProductByPriceId,
    getSubscriptionProduct,
};
