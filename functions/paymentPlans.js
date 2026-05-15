/**
 * Server-owned Stripe checkout catalog.
 *
 * Client supplied plan and price identifiers are only selectors into this
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
        key: 'private_invitation_1',
        aliases: ['c1'],
        type: 'private_invitation_credits',
        mode: 'payment',
        planId: 'c1',
        planName: 'Single Private Invitation',
        privateCredits: 1,
        priceEnvKey: 'STRIPE_PRICE_PRIVATE_INVITE_1',
        fallbackPriceId: 'price_1T4DyrKpQn3RDJUCN6ipD592',
    },
    {
        key: 'private_invitation_3',
        aliases: ['c2'],
        type: 'private_invitation_credits',
        mode: 'payment',
        planId: 'c2',
        planName: '3 Private Invitations',
        privateCredits: 3,
        priceEnvKey: 'STRIPE_PRICE_PRIVATE_INVITE_3',
        fallbackPriceId: 'price_1T4E1aKpQn3RDJUCMLLV7g4D',
    },
    {
        key: 'private_invitation_5',
        aliases: ['c3'],
        type: 'private_invitation_credits',
        mode: 'payment',
        planId: 'c3',
        planName: '5 Private Invitations',
        privateCredits: 5,
        priceEnvKey: 'STRIPE_PRICE_PRIVATE_INVITE_5',
        fallbackPriceId: 'price_1T4E1xKpQn3RDJUC6wYEr9I1',
    },
    {
        key: 'private_invitation_10',
        aliases: ['c4'],
        type: 'private_invitation_credits',
        mode: 'payment',
        planId: 'c4',
        planName: '10 Private Invitations',
        privateCredits: 10,
        priceEnvKey: 'STRIPE_PRICE_PRIVATE_INVITE_10',
        fallbackPriceId: 'price_1T4E3EKpQn3RDJUC97Rro1xj',
    },
    {
        key: 'private_invitation_20',
        aliases: ['c5'],
        type: 'private_invitation_credits',
        mode: 'payment',
        planId: 'c5',
        planName: '20 Private Invitations',
        privateCredits: 20,
        priceEnvKey: 'STRIPE_PRICE_PRIVATE_INVITE_20',
        fallbackPriceId: 'price_1T4E8AKpQn3RDJUCc3tJwnAI',
    },
    {
        key: 'dating_invitation_5',
        aliases: ['d1'],
        type: 'private_invitation_credits',
        mode: 'payment',
        planId: 'd1',
        planName: '5 Dating Invitations',
        privateCredits: 5,
        priceEnvKey: 'STRIPE_PRICE_DATING_INVITE_5',
        fallbackPriceId: 'price_1TDaNMKpQn3RDJUCWAJdI5YZ',
    },
    {
        key: 'dating_invitation_10',
        aliases: ['d2'],
        type: 'private_invitation_credits',
        mode: 'payment',
        planId: 'd2',
        planName: '10 Dating Invitations',
        privateCredits: 10,
        priceEnvKey: 'STRIPE_PRICE_DATING_INVITE_10',
        fallbackPriceId: 'price_1TDaO5KpQn3RDJUC0vD1Afzj',
    },
    {
        key: 'offer_slot_50h',
        aliases: ['o1', 'offer_slot_50h'],
        type: 'offer_slot',
        mode: 'payment',
        planId: 'o1',
        planName: '50 Hour Offer Slot',
        privateCredits: 0,
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
