/**
 * Subscription plans (business) + credit packs (consumer invite top-ups).
 * Base currency: USD. Local display via currencyConverter.js.
 *
 * Business: exactly two tiers — `free` and `paid`. Paid tier `stripePriceId` must match
 * the recurring Price in Stripe (Dashboard → Product → Pricing → copy price_…).
 *
 * Consumer: no subscription. Public invitations are free. Dine Credits (wallet) pay for
 * private + dating invitation publishing only. AI credit purchases / AI spend are paused in product copy.
 */

export const BASE_SUBSCRIPTION_PLANS = [
    {
        id: 'business-free',
        name: 'Free Business',
        title: 'Free',
        description: 'List your venue in the directory and join the community',
        type: 'business',
        price: 0,
        currency: 'USD',
        duration: { type: 'month', value: 1 },
        stripePriceId: null,
        tier: 'free',
        features: [
            'Business profile in the directory',
            'Ratings and reviews',
            'Basic presence and community access',
            'App support'
        ],
        active: true,
        recommended: false
    },
    {
        id: 'business-paid',
        name: 'Paid Business',
        title: 'Paid',
        description: 'Full partner tools, visibility, and analytics',
        type: 'business',
        price: 20,
        currency: 'USD',
        duration: { type: 'month', value: 1 },
        stripePriceId: 'price_1TWGO9KpQn3RDJUCly8Y0jFc',
        tier: 'paid',
        features: [
            'Everything in Free',
            'Priority visibility in search',
            'Advanced analytics',
            'Community management tools',
            'Member notifications',
            'Featured placement options',
            'Email & priority support'
        ],
        active: true,
        recommended: true
    }
];

/** Private / dating invitation packs (one-time checkouts — separate from subscription). */
export const BASE_CREDIT_PACKS = [
    {
        id: 'c1',
        name: 'Single Private Invitation',
        type: 'invitation',
        amount: 1,
        price: 2,
        currency: 'USD',
        stripePriceId: 'price_1T4DyrKpQn3RDJUCN6ipD592'
    },
    {
        id: 'c2',
        name: '3 Private Invitations',
        type: 'invitation',
        amount: 3,
        price: 4,
        currency: 'USD',
        stripePriceId: 'price_1T4E1aKpQn3RDJUCMLLV7g4D'
    },
    {
        id: 'c3',
        name: '5 Private Invitations',
        type: 'invitation',
        amount: 5,
        price: 6,
        currency: 'USD',
        stripePriceId: 'price_1T4E1xKpQn3RDJUC6wYEr9I1'
    },
    {
        id: 'c4',
        name: '10 Private Invitations',
        type: 'invitation',
        amount: 10,
        price: 9,
        currency: 'USD',
        stripePriceId: 'price_1T4E3EKpQn3RDJUC97Rro1xj'
    },
    {
        id: 'c5',
        name: '20 Private Invitations',
        type: 'invitation',
        amount: 20,
        price: 15,
        currency: 'USD',
        stripePriceId: 'price_1T4E8AKpQn3RDJUCc3tJwnAI'
    },
    {
        id: 'd1',
        name: '5 Dating Invitations',
        type: 'dating',
        amount: 5,
        price: 7,
        currency: 'USD',
        stripePriceId: 'price_1TDaNMKpQn3RDJUCWAJdI5YZ'
    },
    {
        id: 'd2',
        name: '10 Dating Invitations',
        type: 'dating',
        amount: 10,
        price: 10,
        currency: 'USD',
        stripePriceId: 'price_1TDaO5KpQn3RDJUC0vD1Afzj'
    }
];
