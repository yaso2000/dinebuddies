/**
 * Default Subscription Plans and Credit Packs
 * Base currency: USD. Display in local currency via currencyConverter.js.
 *
 * Consumer (`type: 'user'`) rows are legacy reference only — the app uses **Dine Credits**
 * (`freeCredits` + `paidCredits`) for private/date invites and AI, not separate invitation packs.
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
        publicCredits: 4,
        monthlyPrivateQuota: 2,
        stripePriceId: null,
        tier: 'free',
        features: [
            'Create 4 Public Invitations per month',
            '2 Private Invitations per month',
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
        price: 8,
        currency: 'USD',
        duration: { type: 'month', value: 1 },
        monthlyPrivateQuota: 4,
        stripePriceId: 'price_1T4DptKpQn3RDJUCrhwtOx0u',
        tier: 'pro',
        features: [
            '4 Private Invitations per month',
            'Unlimited Public Invitations',
            'Distinctive Pro Badge',
            'Priority in search results',
            'Fast technical support'
        ],
        active: true,
        recommended: true
    },
    {
        id: 'p3',
        name: 'Premium Plan',
        title: 'Golden Experience',
        description: 'For lovers of luxury and absolute privacy',
        type: 'user',
        price: 15,
        currency: 'USD',
        duration: { type: 'month', value: 1 },
        monthlyPrivateQuota: 10,
        stripePriceId: 'price_1T4DrkKpQn3RDJUC7cPercNu',
        tier: 'vip',
        features: [
            '10 Private Invitations per month',
            'Unlimited Public Invitations',
            'Exclusive Golden Badge',
            'Top priority + Partner discounts',
            'Undo cancellation option'
        ],
        active: true,
        recommended: false
    },
    {
        id: 'p4',
        name: 'Professional Business Plan',
        title: 'For Small Venues',
        description: 'Perfect solution for emerging businesses and venues',
        type: 'business',
        price: 19,
        currency: 'USD',
        duration: { type: 'month', value: 1 },
        invitationCredits: null,
        invitationOffers: null,
        stripePriceId: 'price_1T4DfJKpQn3RDJUC4ANefmpl',
        tier: 'professional',
        offerSlots: 1,
        offerHoursPerSlot: 50,
        offerPerpetual: false,
        features: [
            '1 Month FREE Trial ✨',
            'Full dashboard access',
            'Listing in business directory',
            'Services & Menu management',
            '1 offer slot (50 hours/week)',
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
        type: 'business',
        price: 29,
        currency: 'USD',
        duration: { type: 'month', value: 1 },
        invitationCredits: null,
        invitationOffers: null,
        stripePriceId: 'price_1T4DlqKpQn3RDJUC6vrueW0n',
        tier: 'elite',
        offerSlots: 1,
        offerHoursPerSlot: null,
        offerPerpetual: true,
        features: [
            '1 Month FREE Trial ✨',
            'All Basic features',
            '1 permanent offer slot ♾️',
            'Featured in search results',
            'Advanced analytics',
            'Menu & Offer management',
            'Loyalty program integration',
            'Direct phone support'
        ],
        active: true,
        recommended: true
    },
    {
        id: 'p6',
        name: 'Free Business Plan',
        title: 'For Basic Presence',
        description: 'Start listing your restaurant in the directory for free',
        type: 'business',
        price: 0,
        duration: { type: 'month', value: 1 },
        invitationCredits: 0,
        invitationOffers: 0,
        tier: 'free',
        features: [
            'Basic listing in business directory',
            'Receive ratings and reviews',
            'View counts statistics only',
            'App-based technical support'
        ],
        active: true,
        recommended: false
    }
];

export const BASE_CREDIT_PACKS = [
    // ── Private Invitation Packs ──────────────────────────────────────────────
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

    // ── Dating Invitation Packs ───────────────────────────────────────────────
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
    },

    // ── Business Offer Packs ───────────────────────────────────────────────────
    {
        id: 'o1',
        name: '50 Hour Offer Slot',
        type: 'offer_slot',
        offerHours: 50,
        price: 5,
        currency: 'USD',
        stripePriceId: 'price_1T5mIGKpQn3RDJUCMzhlyN6a',
        description: 'Adds one 50-hour premium offer display slot to your banner'
    }
];
