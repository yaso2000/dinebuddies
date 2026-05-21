/**
 * Server-owned Stripe catalog.
 *
 * Client code may request a plan/package id, but price ids and fulfillment
 * metadata must come from this trusted table.
 */

const SUBSCRIPTION_PLANS = {
    p2: {
        id: 'p2',
        aliases: ['pro'],
        name: 'Pro Plan',
        priceId: 'price_1T4DptKpQn3RDJUCrhwtOx0u',
        tier: 'pro',
        weeklyPrivateQuota: 2,
    },
    p3: {
        id: 'p3',
        aliases: ['vip', 'premium'],
        name: 'Premium Plan',
        priceId: 'price_1T4DrkKpQn3RDJUC7cPercNu',
        tier: 'vip',
        weeklyPrivateQuota: -1,
    },
    p4: {
        id: 'p4',
        aliases: ['professional'],
        name: 'Professional Business Plan',
        priceId: 'price_1T4DfJKpQn3RDJUC4ANefmpl',
        tier: 'professional',
        weeklyPrivateQuota: 0,
    },
    p5: {
        id: 'p5',
        aliases: ['elite'],
        name: 'Elite Partner Plan',
        priceId: 'price_1T4DlqKpQn3RDJUC6vrueW0n',
        tier: 'elite',
        weeklyPrivateQuota: 0,
    },
};

const ONE_TIME_PACKS = {
    c1: {
        id: 'c1',
        name: 'Single Private Invitation',
        priceId: 'price_1T4DyrKpQn3RDJUCN6ipD592',
        fulfillmentType: 'private_invitation_pack',
        amount: 1,
    },
    c2: {
        id: 'c2',
        name: '3 Private Invitations',
        priceId: 'price_1T4E1aKpQn3RDJUCMLLV7g4D',
        fulfillmentType: 'private_invitation_pack',
        amount: 3,
    },
    c3: {
        id: 'c3',
        name: '5 Private Invitations',
        priceId: 'price_1T4E1xKpQn3RDJUC6wYEr9I1',
        fulfillmentType: 'private_invitation_pack',
        amount: 5,
    },
    c4: {
        id: 'c4',
        name: '10 Private Invitations',
        priceId: 'price_1T4E3EKpQn3RDJUC97Rro1xj',
        fulfillmentType: 'private_invitation_pack',
        amount: 10,
    },
    c5: {
        id: 'c5',
        name: '20 Private Invitations',
        priceId: 'price_1T4E8AKpQn3RDJUCc3tJwnAI',
        fulfillmentType: 'private_invitation_pack',
        amount: 20,
    },
    d1: {
        id: 'd1',
        name: '5 Dating Invitations',
        priceId: 'price_1TDaNMKpQn3RDJUCWAJdI5YZ',
        fulfillmentType: 'private_invitation_pack',
        amount: 5,
    },
    d2: {
        id: 'd2',
        name: '10 Dating Invitations',
        priceId: 'price_1TDaO5KpQn3RDJUC0vD1Afzj',
        fulfillmentType: 'private_invitation_pack',
        amount: 10,
    },
    o1: {
        id: 'o1',
        name: '50 Hour Offer Slot',
        priceId: 'price_1T5mIGKpQn3RDJUCMzhlyN6a',
        fulfillmentType: 'offer_slot_pack',
        amount: 1,
    },
};

function normalizeId(id) {
    return String(id || '').trim().toLowerCase();
}

function withRuntimePrice(item) {
    if (!item) return null;
    const envKey = `STRIPE_PRICE_${item.id.toUpperCase()}`;
    const priceId = String(process.env[envKey] || item.priceId || '').trim();
    return {
        ...item,
        priceId,
        envKey,
    };
}

function getSubscriptionPlan(planId) {
    const id = normalizeId(planId);
    const direct = SUBSCRIPTION_PLANS[id];
    if (direct) return withRuntimePrice({ ...direct, checkoutType: 'subscription' });

    const aliased = Object.values(SUBSCRIPTION_PLANS).find((plan) =>
        (plan.aliases || []).map(normalizeId).includes(id)
    );
    return withRuntimePrice(aliased ? { ...aliased, checkoutType: 'subscription' } : null);
}

function getOneTimePack(planId) {
    const id = normalizeId(planId);
    return withRuntimePrice(ONE_TIME_PACKS[id] ? { ...ONE_TIME_PACKS[id], checkoutType: 'one_time' } : null);
}

function getCheckoutCatalogItem(planId) {
    return getSubscriptionPlan(planId) || getOneTimePack(planId);
}

function getOneTimePackByPriceId(priceId) {
    const pid = String(priceId || '').trim();
    if (!pid) return null;
    return Object.values(ONE_TIME_PACKS)
        .map((pack) => withRuntimePrice({ ...pack, checkoutType: 'one_time' }))
        .find((pack) => pack.priceId === pid) || null;
}

module.exports = {
    SUBSCRIPTION_PLANS,
    ONE_TIME_PACKS,
    getSubscriptionPlan,
    getOneTimePack,
    getCheckoutCatalogItem,
    getOneTimePackByPriceId,
};
