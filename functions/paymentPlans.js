const SUBSCRIPTION_PLANS = {
    p2: {
        id: 'p2',
        aliases: ['pro'],
        envKey: 'STRIPE_PRICE_USER_PRO',
        fallbackPriceId: 'price_1T4DptKpQn3RDJUCrhwtOx0u',
        name: 'Pro Plan',
        mode: 'subscription',
        tier: 'pro',
        weeklyPrivateQuota: 2,
        type: 'subscription',
    },
    p3: {
        id: 'p3',
        aliases: ['vip', 'premium'],
        envKey: 'STRIPE_PRICE_USER_VIP',
        fallbackPriceId: 'price_1T4DrkKpQn3RDJUC7cPercNu',
        name: 'Premium Plan',
        mode: 'subscription',
        tier: 'vip',
        weeklyPrivateQuota: -1,
        type: 'subscription',
    },
    p4: {
        id: 'p4',
        aliases: ['professional'],
        envKey: 'STRIPE_PRICE_BUSINESS_PROFESSIONAL',
        fallbackPriceId: 'price_1T4DfJKpQn3RDJUC4ANefmpl',
        name: 'Professional Business Plan',
        mode: 'subscription',
        tier: 'professional',
        weeklyPrivateQuota: 0,
        type: 'subscription',
    },
    p5: {
        id: 'p5',
        aliases: ['elite', 'paid'],
        envKey: 'STRIPE_PRICE_BUSINESS_MONTHLY',
        fallbackPriceId: 'price_1T4DlqKpQn3RDJUC6vrueW0n',
        name: 'Elite Partner Plan',
        mode: 'subscription',
        tier: 'elite',
        weeklyPrivateQuota: 0,
        type: 'subscription',
    },
};

const ONE_TIME_PACKS = {
    c1: {
        id: 'c1',
        envKey: 'STRIPE_PRICE_PRIVATE_INVITE_1',
        fallbackPriceId: 'price_1T4DyrKpQn3RDJUCN6ipD592',
        name: 'Single Private Invitation',
        mode: 'payment',
        type: 'private_invitation_pack',
        credits: 1,
    },
    c2: {
        id: 'c2',
        envKey: 'STRIPE_PRICE_PRIVATE_INVITE_3',
        fallbackPriceId: 'price_1T4E1aKpQn3RDJUCMLLV7g4D',
        name: '3 Private Invitations',
        mode: 'payment',
        type: 'private_invitation_pack',
        credits: 3,
    },
    c3: {
        id: 'c3',
        envKey: 'STRIPE_PRICE_PRIVATE_INVITE_5',
        fallbackPriceId: 'price_1T4E1xKpQn3RDJUC6wYEr9I1',
        name: '5 Private Invitations',
        mode: 'payment',
        type: 'private_invitation_pack',
        credits: 5,
    },
    c4: {
        id: 'c4',
        envKey: 'STRIPE_PRICE_PRIVATE_INVITE_10',
        fallbackPriceId: 'price_1T4E3EKpQn3RDJUC97Rro1xj',
        name: '10 Private Invitations',
        mode: 'payment',
        type: 'private_invitation_pack',
        credits: 10,
    },
    c5: {
        id: 'c5',
        envKey: 'STRIPE_PRICE_PRIVATE_INVITE_20',
        fallbackPriceId: 'price_1T4E8AKpQn3RDJUCc3tJwnAI',
        name: '20 Private Invitations',
        mode: 'payment',
        type: 'private_invitation_pack',
        credits: 20,
    },
    d1: {
        id: 'd1',
        envKey: 'STRIPE_PRICE_DATING_INVITE_5',
        fallbackPriceId: 'price_1TDaNMKpQn3RDJUCWAJdI5YZ',
        name: '5 Dating Invitations',
        mode: 'payment',
        type: 'private_invitation_pack',
        credits: 5,
    },
    d2: {
        id: 'd2',
        envKey: 'STRIPE_PRICE_DATING_INVITE_10',
        fallbackPriceId: 'price_1TDaO5KpQn3RDJUC0vD1Afzj',
        name: '10 Dating Invitations',
        mode: 'payment',
        type: 'private_invitation_pack',
        credits: 10,
    },
    o1: {
        id: 'o1',
        envKey: 'STRIPE_PRICE_OFFER_SLOT_50H',
        fallbackPriceId: 'price_1T5mIGKpQn3RDJUCMzhlyN6a',
        name: '50 Hour Offer Slot',
        mode: 'payment',
        type: 'offer_slot_pack',
        offerCredits: 1,
    },
};

function materialize(def) {
    const priceId = String(process.env[def.envKey] || def.fallbackPriceId || '').trim();
    return { ...def, priceId };
}

function allCheckoutItems() {
    return Object.values({ ...SUBSCRIPTION_PLANS, ...ONE_TIME_PACKS }).map(materialize);
}

function getCheckoutItem(rawId) {
    const id = String(rawId || '').trim().toLowerCase();
    if (!id) return null;

    const direct = SUBSCRIPTION_PLANS[id] || ONE_TIME_PACKS[id];
    if (direct) return materialize(direct);

    const plan = Object.values(SUBSCRIPTION_PLANS).find((def) => (def.aliases || []).includes(id));
    return plan ? materialize(plan) : null;
}

function getCheckoutItemByPriceId(rawPriceId) {
    const priceId = String(rawPriceId || '').trim();
    if (!priceId) return null;
    return allCheckoutItems().find((item) => item.priceId === priceId) || null;
}

module.exports = {
    SUBSCRIPTION_PLANS,
    ONE_TIME_PACKS,
    allCheckoutItems,
    getCheckoutItem,
    getCheckoutItemByPriceId,
};
