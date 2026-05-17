/**
 * Server-owned Stripe catalog for subscription plans and legacy credit packs.
 * Checkout must never trust client-provided price IDs or entitlement metadata.
 */

const PLAN_DEFINITIONS = {
    p2: {
        kind: 'subscription',
        planId: 'p2',
        planName: 'Pro Plan',
        tier: 'pro',
        weeklyPrivateQuota: 2,
        priceId: 'price_1T4DptKpQn3RDJUCrhwtOx0u',
        envKey: 'STRIPE_PRICE_USER_PRO',
    },
    p3: {
        kind: 'subscription',
        planId: 'p3',
        planName: 'Premium Plan',
        tier: 'vip',
        weeklyPrivateQuota: -1,
        priceId: 'price_1T4DrkKpQn3RDJUC7cPercNu',
        envKey: 'STRIPE_PRICE_USER_PREMIUM',
    },
    p4: {
        kind: 'subscription',
        planId: 'p4',
        planName: 'Professional Business Plan',
        tier: 'professional',
        weeklyPrivateQuota: 0,
        priceId: 'price_1T4DfJKpQn3RDJUC4ANefmpl',
        envKey: 'STRIPE_PRICE_BUSINESS_PROFESSIONAL',
    },
    p5: {
        kind: 'subscription',
        planId: 'p5',
        planName: 'Elite Partner Plan',
        tier: 'elite',
        weeklyPrivateQuota: 0,
        priceId: 'price_1T4DlqKpQn3RDJUC6vrueW0n',
        envKey: 'STRIPE_PRICE_BUSINESS_ELITE',
    },
};

const PACK_DEFINITIONS = {
    c1: {
        kind: 'private_pack',
        planId: 'c1',
        planName: 'Single Private Invitation',
        purchasedPrivateCredits: 1,
        priceId: 'price_1T4DyrKpQn3RDJUCN6ipD592',
        envKey: 'STRIPE_PRICE_PRIVATE_INVITE_1',
    },
    c2: {
        kind: 'private_pack',
        planId: 'c2',
        planName: '3 Private Invitations',
        purchasedPrivateCredits: 3,
        priceId: 'price_1T4E1aKpQn3RDJUCMLLV7g4D',
        envKey: 'STRIPE_PRICE_PRIVATE_INVITE_3',
    },
    c3: {
        kind: 'private_pack',
        planId: 'c3',
        planName: '5 Private Invitations',
        purchasedPrivateCredits: 5,
        priceId: 'price_1T4E1xKpQn3RDJUC6wYEr9I1',
        envKey: 'STRIPE_PRICE_PRIVATE_INVITE_5',
    },
    c4: {
        kind: 'private_pack',
        planId: 'c4',
        planName: '10 Private Invitations',
        purchasedPrivateCredits: 10,
        priceId: 'price_1T4E3EKpQn3RDJUC97Rro1xj',
        envKey: 'STRIPE_PRICE_PRIVATE_INVITE_10',
    },
    c5: {
        kind: 'private_pack',
        planId: 'c5',
        planName: '20 Private Invitations',
        purchasedPrivateCredits: 20,
        priceId: 'price_1T4E8AKpQn3RDJUCc3tJwnAI',
        envKey: 'STRIPE_PRICE_PRIVATE_INVITE_20',
    },
    d1: {
        kind: 'private_pack',
        planId: 'd1',
        planName: '5 Dating Invitations',
        purchasedPrivateCredits: 5,
        priceId: 'price_1TDaNMKpQn3RDJUCWAJdI5YZ',
        envKey: 'STRIPE_PRICE_DATING_INVITE_5',
    },
    d2: {
        kind: 'private_pack',
        planId: 'd2',
        planName: '10 Dating Invitations',
        purchasedPrivateCredits: 10,
        priceId: 'price_1TDaO5KpQn3RDJUC0vD1Afzj',
        envKey: 'STRIPE_PRICE_DATING_INVITE_10',
    },
    o1: {
        kind: 'offer_slot',
        planId: 'o1',
        planName: '50 Hour Offer Slot',
        offerSlotCredits: 1,
        priceId: 'price_1T5mIGKpQn3RDJUCMzhlyN6a',
        envKey: 'STRIPE_PRICE_OFFER_SLOT_50H',
    },
};

const ALIASES = {
    pro: 'p2',
    premium: 'p3',
    vip: 'p3',
    professional: 'p4',
    elite: 'p5',
};

function withResolvedPrice(def) {
    const envPrice = def.envKey ? String(process.env[def.envKey] || '').trim() : '';
    return { ...def, priceId: envPrice || def.priceId };
}

function getPaymentCatalogItem(rawPlanId) {
    const id = String(rawPlanId || '').trim().toLowerCase();
    const canonicalId = ALIASES[id] || id;
    const def = PLAN_DEFINITIONS[canonicalId] || PACK_DEFINITIONS[canonicalId];
    return def ? withResolvedPrice(def) : null;
}

function getPaymentCatalogItemByPrice(priceId) {
    const normalizedPriceId = String(priceId || '').trim();
    if (!normalizedPriceId) return null;

    const allDefs = [
        ...Object.values(PLAN_DEFINITIONS),
        ...Object.values(PACK_DEFINITIONS),
    ];
    const match = allDefs
        .map(withResolvedPrice)
        .find((def) => def.priceId === normalizedPriceId);
    return match || null;
}

function getQuotaForPlan(planId) {
    const def = getPaymentCatalogItem(planId);
    if (def?.kind === 'subscription') return def.weeklyPrivateQuota;
    return 0;
}

function getTierForPlan(planId) {
    const def = getPaymentCatalogItem(planId);
    if (def?.kind === 'subscription') return def.tier;
    return 'free';
}

module.exports = {
    PLAN_DEFINITIONS,
    PACK_DEFINITIONS,
    getPaymentCatalogItem,
    getPaymentCatalogItemByPrice,
    getQuotaForPlan,
    getTierForPlan,
};
