/**
 * Default Subscription Plans and Credit Packs
 * These serve as the "hardcoded" fallback and the source for Admin Seeding.
 */

export const BASE_SUBSCRIPTION_PLANS = [
    {
        id: 'p1',
        name: 'Free Plan',
        title: 'Start for Free',
        description: 'For participating in public events',
        type: 'user',
        price: 0,
        duration: { type: 'month', value: 1 },
        invitationCredits: 0,
        publicCredits: 3,
        stripePriceId: null,
        tier: 'free',
        features: [
            'Create 3 Public Invitations per month',
            'Browse all nearby Public Invitations',
            'Join Food Communities',
            'App-based technical support'
        ],
        active: true,
        recommended: false
    },
    {
        id: 'p2',
        name: 'Pro Plan',
        title: 'Most Popular',
        description: 'For active users seeking privacy',
        type: 'user',
        price: 5.23, // $8 AUD
        currency: 'USD',
        priceEur: 4.49,
        duration: { type: 'month', value: 1 },
        weeklyPrivateQuota: 2,
        stripePriceId: 'price_1T4DptKpQn3RDJUCrhwtOx0u',
        features: [
            '2 Private Invitations per week',
            'Unlimited Public Invitations',
            'Lock editing after sending',
            'Distinctive Pro Badge',
            'Priority in search results',
            'Fast technical support'
        ],
        tier: 'pro',
        active: true,
        recommended: true
    },
    {
        id: 'p3',
        name: 'Premium Plan',
        title: 'Golden Experience',
        description: 'For lovers of luxury and absolute privacy',
        type: 'user',
        price: 9.80, // $15 AUD
        currency: 'USD',
        priceEur: 8.99,
        duration: { type: 'month', value: 1 },
        weeklyPrivateQuota: -1,
        stripePriceId: 'price_1T4DrkKpQn3RDJUC7cPercNu',
        tier: 'vip',
        features: [
            'Unlimited Private Invitations',
            'Unlimited Public Invitations',
            'Unlimited invitation editing',
            'Exclusive Golden Badge',
            'Top priority + Partner discounts',
            'Undo cancellation option'
        ],
        active: true,
        recommended: false
    },
    {
        id: 'p4',
        name: 'Professional Partner Plan',
        title: 'For Small Venues',
        description: 'Perfect solution for emerging businesses and venues',
        type: 'partner',
        price: 12.42, // $19 AUD
        currency: 'USD',
        originalPrice: 18.95, // $29 AUD
        priceEur: 37.99,
        originalPriceEur: 47.99,
        discount: 20,
        duration: { type: 'month', value: 1 },
        invitationCredits: null,
        invitationOffers: null,
        stripePriceId: 'price_1T4DfJKpQn3RDJUC4ANefmpl',
        tier: 'professional',
        features: [
            '1 Month FREE Trial ✨',
            'Full dashboard access',
            'Listing in partner directory',
            'Accept reservations',
            'Basic statistics',
            'Email support'
        ],
        active: true,
        recommended: false
    },
    {
        id: 'p5',
        name: 'Elite Partner Plan',
        title: 'For Businesses & Large Venues',
        description: 'Professional tools to manage and grow your business',
        type: 'partner',
        price: 18.95, // $29 AUD
        currency: 'USD',
        originalPrice: 25.49, // $39 AUD
        priceEur: 75.99,
        originalPriceEur: 93.99,
        discount: 20,
        duration: { type: 'month', value: 1 },
        invitationCredits: null,
        invitationOffers: null,
        stripePriceId: 'price_1T4DlqKpQn3RDJUC6vrueW0n',
        features: [
            '1 Month FREE Trial ✨',
            'All Basic features',
            'Featured in search results',
            'Advanced analytics',
            'Menu & Offer management',
            'Loyalty program integration',
            'Direct phone support',
            'Monthly marketing campaigns'
        ],
        active: true,
        recommended: true
    },
    {
        id: 'p6',
        name: 'Free Partner Plan',
        title: 'For Basic Presence',
        description: 'Start listing your restaurant in the directory for free',
        type: 'partner',
        price: 0,
        duration: { type: 'month', value: 1 },
        invitationCredits: 0,
        invitationOffers: 0,
        tier: 'free',
        features: [
            'Basic listing in partner directory',
            'Receive ratings and reviews',
            'View counts statistics only',
            'App-based technical support'
        ],
        active: true,
        recommended: false
    }
];

export const BASE_CREDIT_PACKS = [
    {
        id: 'c1',
        name: 'Single Private Invitation',
        amount: 1,
        price: 1.31, // $2 AUD
        currency: 'USD',
        stripePriceId: 'price_1T4DyrKpQn3RDJUCN6ipD592'
    },
    {
        id: 'c2',
        name: '3 Private Invitations',
        amount: 3,
        price: 2.61, // $4 AUD
        currency: 'USD',
        stripePriceId: 'price_1T4E1aKpQn3RDJUCMLLV7g4D'
    },
    {
        id: 'c3',
        name: '5 Private Invitations',
        amount: 5,
        price: 3.92, // $6 AUD
        currency: 'USD',
        stripePriceId: 'price_1T4E1xKpQn3RDJUC6wYEr9I1'
    },
    {
        id: 'c4',
        name: '10 Private Invitations',
        amount: 10,
        price: 5.88, // $9 AUD
        currency: 'USD',
        stripePriceId: 'price_1T4E3EKpQn3RDJUC97Rro1xj'
    },
    {
        id: 'c5',
        name: '20 Private Invitations',
        amount: 20,
        price: 9.80, // $15 AUD
        currency: 'USD',
        stripePriceId: 'price_1T4E8AKpQn3RDJUCc3tJwnAI'
    }
];
