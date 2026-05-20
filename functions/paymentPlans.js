function envPriceIds(...keys) {
    return keys
        .map((key) => String(process.env[key] || '').trim())
        .filter(Boolean);
}

function item(def) {
    return {
        ...def,
        priceIds: Array.from(new Set([...(def.priceIds || []), ...(def.fallbackPriceIds || [])].filter(Boolean)))
    };
}

const CHECKOUT_CATALOG = {
    p2: item({
        id: 'p2',
        kind: 'subscription',
        mode: 'subscription',
        tier: 'pro',
        weeklyPrivateQuota: 4,
        priceIds: envPriceIds('STRIPE_PRICE_P2', 'STRIPE_PRICE_USER_PRO', 'STRIPE_PRICE_PRO'),
        fallbackPriceIds: ['price_1T4DptKpQn3RDJUCrhwtOx0u']
    }),
    p3: item({
        id: 'p3',
        kind: 'subscription',
        mode: 'subscription',
        tier: 'vip',
        weeklyPrivateQuota: 10,
        priceIds: envPriceIds('STRIPE_PRICE_P3', 'STRIPE_PRICE_USER_VIP', 'STRIPE_PRICE_USER_PREMIUM', 'STRIPE_PRICE_PREMIUM'),
        fallbackPriceIds: ['price_1T4DrkKpQn3RDJUC7cPercNu']
    }),
    p4: item({
        id: 'p4',
        kind: 'subscription',
        mode: 'subscription',
        tier: 'professional',
        weeklyPrivateQuota: 0,
        priceIds: envPriceIds('STRIPE_PRICE_P4', 'STRIPE_PRICE_BUSINESS_PROFESSIONAL'),
        fallbackPriceIds: ['price_1T4DfJKpQn3RDJUC4ANefmpl']
    }),
    p5: item({
        id: 'p5',
        kind: 'subscription',
        mode: 'subscription',
        tier: 'elite',
        weeklyPrivateQuota: 0,
        priceIds: envPriceIds('STRIPE_PRICE_P5', 'STRIPE_PRICE_BUSINESS_ELITE', 'STRIPE_PRICE_BUSINESS_MONTHLY'),
        fallbackPriceIds: ['price_1T4DlqKpQn3RDJUC6vrueW0n']
    }),
    c1: item({
        id: 'c1',
        kind: 'private_pack',
        mode: 'payment',
        purchasedPrivateCredits: 1,
        priceIds: envPriceIds('STRIPE_PRICE_C1', 'STRIPE_PRICE_PRIVATE_INVITE_1'),
        fallbackPriceIds: ['price_1T4DyrKpQn3RDJUCN6ipD592']
    }),
    c2: item({
        id: 'c2',
        kind: 'private_pack',
        mode: 'payment',
        purchasedPrivateCredits: 3,
        priceIds: envPriceIds('STRIPE_PRICE_C2', 'STRIPE_PRICE_PRIVATE_INVITE_3'),
        fallbackPriceIds: ['price_1T4E1aKpQn3RDJUCMLLV7g4D']
    }),
    c3: item({
        id: 'c3',
        kind: 'private_pack',
        mode: 'payment',
        purchasedPrivateCredits: 5,
        priceIds: envPriceIds('STRIPE_PRICE_C3', 'STRIPE_PRICE_PRIVATE_INVITE_5'),
        fallbackPriceIds: ['price_1T4E1xKpQn3RDJUC6wYEr9I1']
    }),
    c4: item({
        id: 'c4',
        kind: 'private_pack',
        mode: 'payment',
        purchasedPrivateCredits: 10,
        priceIds: envPriceIds('STRIPE_PRICE_C4', 'STRIPE_PRICE_PRIVATE_INVITE_10'),
        fallbackPriceIds: ['price_1T4E3EKpQn3RDJUC97Rro1xj']
    }),
    c5: item({
        id: 'c5',
        kind: 'private_pack',
        mode: 'payment',
        purchasedPrivateCredits: 20,
        priceIds: envPriceIds('STRIPE_PRICE_C5', 'STRIPE_PRICE_PRIVATE_INVITE_20'),
        fallbackPriceIds: ['price_1T4E8AKpQn3RDJUCc3tJwnAI']
    }),
    d1: item({
        id: 'd1',
        kind: 'private_pack',
        mode: 'payment',
        purchasedPrivateCredits: 5,
        priceIds: envPriceIds('STRIPE_PRICE_D1', 'STRIPE_PRICE_DATING_INVITE_5'),
        fallbackPriceIds: ['price_1TDaNMKpQn3RDJUCWAJdI5YZ']
    }),
    d2: item({
        id: 'd2',
        kind: 'private_pack',
        mode: 'payment',
        purchasedPrivateCredits: 10,
        priceIds: envPriceIds('STRIPE_PRICE_D2', 'STRIPE_PRICE_DATING_INVITE_10'),
        fallbackPriceIds: ['price_1TDaO5KpQn3RDJUC0vD1Afzj']
    }),
    o1: item({
        id: 'o1',
        kind: 'offer_pack',
        mode: 'payment',
        offerCredits: 1,
        priceIds: envPriceIds('STRIPE_PRICE_O1', 'STRIPE_PRICE_OFFER_SLOT_50H'),
        fallbackPriceIds: ['price_1T5mIGKpQn3RDJUCMzhlyN6a']
    })
};

const PRICE_TO_ITEM = Object.values(CHECKOUT_CATALOG).reduce((acc, plan) => {
    for (const priceId of plan.priceIds) {
        acc[priceId] = plan;
    }
    return acc;
}, {});

function getCatalogItemByPriceId(priceId) {
    return PRICE_TO_ITEM[String(priceId || '').trim()] || null;
}

function getCatalogItemById(id) {
    return CHECKOUT_CATALOG[String(id || '').trim()] || null;
}

module.exports = {
    CHECKOUT_CATALOG,
    getCatalogItemById,
    getCatalogItemByPriceId
};
