/**
 * Server-owned Stripe checkout catalog.
 *
 * Client code may send a plan/pack id for UX convenience, but it must never be
 * allowed to choose the Stripe price or the entitlement that a webhook grants.
 */
const SUBSCRIPTION_PLANS = {
    p2: {
        id: 'p2',
        aliases: ['pro'],
        name: 'Pro Plan',
        priceId: 'price_1T4DptKpQn3RDJUCrhwtOx0u',
        mode: 'subscription',
        tier: 'pro',
        weeklyPrivateQuota: 2,
    },
    p3: {
        id: 'p3',
        aliases: ['premium', 'vip'],
        name: 'Premium Plan',
        priceId: 'price_1T4DrkKpQn3RDJUC7cPercNu',
        mode: 'subscription',
        tier: 'vip',
        weeklyPrivateQuota: -1,
    },
    p4: {
        id: 'p4',
        aliases: ['professional'],
        name: 'Professional Business Plan',
        priceId: 'price_1T4DfJKpQn3RDJUC4ANefmpl',
        mode: 'subscription',
        tier: 'professional',
        weeklyPrivateQuota: 0,
    },
    p5: {
        id: 'p5',
        aliases: ['elite', 'paid'],
        name: 'Elite Partner Plan',
        priceId: 'price_1T4DlqKpQn3RDJUC6vrueW0n',
        mode: 'subscription',
        tier: 'elite',
        weeklyPrivateQuota: 0,
    },
};

const ONE_TIME_PACKS = {
    c1: {
        id: 'c1',
        name: 'Single Private Invitation',
        priceId: 'price_1T4DyrKpQn3RDJUCN6ipD592',
        mode: 'payment',
        grant: { purchasedPrivateCredits: 1 },
    },
    c2: {
        id: 'c2',
        name: '3 Private Invitations',
        priceId: 'price_1T4E1aKpQn3RDJUCMLLV7g4D',
        mode: 'payment',
        grant: { purchasedPrivateCredits: 3 },
    },
    c3: {
        id: 'c3',
        name: '5 Private Invitations',
        priceId: 'price_1T4E1xKpQn3RDJUC6wYEr9I1',
        mode: 'payment',
        grant: { purchasedPrivateCredits: 5 },
    },
    c4: {
        id: 'c4',
        name: '10 Private Invitations',
        priceId: 'price_1T4E3EKpQn3RDJUC97Rro1xj',
        mode: 'payment',
        grant: { purchasedPrivateCredits: 10 },
    },
    c5: {
        id: 'c5',
        name: '20 Private Invitations',
        priceId: 'price_1T4E8AKpQn3RDJUCc3tJwnAI',
        mode: 'payment',
        grant: { purchasedPrivateCredits: 20 },
    },
    d1: {
        id: 'd1',
        name: '5 Dating Invitations',
        priceId: 'price_1TDaNMKpQn3RDJUCWAJdI5YZ',
        mode: 'payment',
        grant: { purchasedPrivateCredits: 5 },
    },
    d2: {
        id: 'd2',
        name: '10 Dating Invitations',
        priceId: 'price_1TDaO5KpQn3RDJUC0vD1Afzj',
        mode: 'payment',
        grant: { purchasedPrivateCredits: 10 },
    },
    o1: {
        id: 'o1',
        name: '50 Hour Offer Slot',
        priceId: 'price_1T5mIGKpQn3RDJUCMzhlyN6a',
        mode: 'payment',
        grant: { offerCredits: 1 },
    },
};

const CHECKOUT_ITEMS = {
    ...SUBSCRIPTION_PLANS,
    ...ONE_TIME_PACKS,
};

function normalizeId(value) {
    return String(value || '').trim().toLowerCase();
}

function withEnvOverride(item) {
    const envKey = `STRIPE_PRICE_${item.id.toUpperCase()}`;
    const override = String(process.env[envKey] || '').trim();
    return override ? { ...item, priceId: override } : item;
}

function getCheckoutItem(planId) {
    const id = normalizeId(planId);
    if (!id) return null;
    if (CHECKOUT_ITEMS[id]) return withEnvOverride(CHECKOUT_ITEMS[id]);

    const match = Object.values(CHECKOUT_ITEMS).find((item) =>
        (item.aliases || []).map(normalizeId).includes(id)
    );
    return match ? withEnvOverride(match) : null;
}

function getCheckoutItemByPriceId(priceId) {
    const pid = String(priceId || '').trim();
    if (!pid) return null;
    return Object.values(CHECKOUT_ITEMS)
        .map(withEnvOverride)
        .find((item) => item.priceId === pid) || null;
}

function getSubscriptionPlanByPriceId(priceId) {
    const item = getCheckoutItemByPriceId(priceId);
    return item && item.mode === 'subscription' ? item : null;
}

module.exports = {
    SUBSCRIPTION_PLANS,
    ONE_TIME_PACKS,
    getCheckoutItem,
    getCheckoutItemByPriceId,
    getSubscriptionPlanByPriceId,
};
