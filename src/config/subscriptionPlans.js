/**
 * Subscription Plans Configuration
 * Defines the features and limits for each business subscription tier
 */

export const SUBSCRIPTION_PLANS = {
    free: {
        id: 'free',
        name: 'Free',
        displayName: 'Free Plan',
        price: 0,
        currency: 'USD',
        interval: 'month',

        // Limits
        maxMembers: 50,
        maxPostsPerMonth: 0,
        maxServices: 0,

        // Features
        canCreateOffers: false,
        canCreateEvents: false,
        priorityListing: false,
        showInInvitations: false,
        featuredListing: false,

        // Analytics
        analytics: 'none', // none, basic, advanced, full

        // Support
        supportLevel: 'community', // community, email, priority, dedicated

        // Branding
        badge: null, // null, 'basic', 'pro', 'premium'
        removeBranding: false,

        // Marketing
        canRunAds: false,
        socialMediaIntegration: false,

        // API
        apiAccess: false
    },

    basic: {
        id: 'basic',
        name: 'Basic',
        displayName: 'Basic Plan',
        price: 9.99,
        currency: 'USD',
        interval: 'month',

        // Limits
        maxMembers: 200,
        maxPostsPerMonth: 5,
        maxServices: 15,

        // Features
        canCreateOffers: false,
        canCreateEvents: false,
        priorityListing: false,
        showInInvitations: true,
        featuredListing: false,

        // Analytics
        analytics: 'basic',

        // Support
        supportLevel: 'email',

        // Branding
        badge: 'basic',
        removeBranding: false,

        // Marketing
        canRunAds: false,
        socialMediaIntegration: true,

        // API
        apiAccess: false
    },

    pro: {
        id: 'pro',
        name: 'Pro',
        displayName: 'Pro Plan',
        price: 29.99,
        currency: 'USD',
        interval: 'month',

        // Limits
        maxMembers: Infinity,
        maxPostsPerMonth: Infinity,
        maxServices: Infinity,

        // Features
        canCreateOffers: true,
        canCreateEvents: true,
        priorityListing: true,
        showInInvitations: true,
        featuredListing: false,

        // Offer Display Rules
        offerSlots: 1,                  // 1 included offer slot
        offerHoursPerWeek: 50,          // 50 hours of display time per week
        offerPerpetual: false,          // expires after offerHoursPerWeek

        // Analytics
        analytics: 'advanced',

        // Support
        supportLevel: 'priority',

        // Branding
        badge: 'pro',
        removeBranding: true,

        // Marketing
        canRunAds: false,
        socialMediaIntegration: true,

        // API
        apiAccess: false
    },

    premium: {
        id: 'premium',
        name: 'Premium',
        displayName: 'Premium Plan',
        price: 99.99,
        currency: 'USD',
        interval: 'month',

        // Limits
        maxMembers: Infinity,
        maxPostsPerMonth: Infinity,
        maxServices: Infinity,

        // Features
        canCreateOffers: true,
        canCreateEvents: true,
        priorityListing: true,
        showInInvitations: true,
        featuredListing: true,

        // Offer Display Rules
        offerSlots: 1,                  // 1 included offer slot (permanent)
        offerHoursPerWeek: Infinity,    // no time limit — always active
        offerPerpetual: true,           // offer never expires

        // Analytics
        analytics: 'full',

        // Support
        supportLevel: 'dedicated',

        // Branding
        badge: 'premium',
        removeBranding: true,

        // Marketing
        canRunAds: true,
        socialMediaIntegration: true,

        // API
        apiAccess: true
    },

    // Business-only tiers (single source: users.subscriptionTier). No legacy aliases.
    professional: {
        id: 'professional',
        name: 'Professional',
        displayName: 'Professional Business',
        price: 29.99,
        currency: 'USD',
        interval: 'month',
        maxMembers: Infinity,
        maxPostsPerMonth: Infinity,
        maxServices: Infinity,
        canCreateOffers: true,
        canCreateEvents: true,
        priorityListing: true,
        showInInvitations: true,
        featuredListing: false,
        offerSlots: 1,
        offerHoursPerWeek: 50,
        offerPerpetual: false,
        analytics: 'advanced',
        supportLevel: 'priority',
        badge: 'professional',
        removeBranding: true,
        canRunAds: false,
        socialMediaIntegration: true,
        apiAccess: false
    },
    elite: {
        id: 'elite',
        name: 'Elite',
        displayName: 'Elite Business',
        price: 99.99,
        currency: 'USD',
        interval: 'month',
        maxMembers: Infinity,
        maxPostsPerMonth: Infinity,
        maxServices: Infinity,
        canCreateOffers: true,
        canCreateEvents: true,
        priorityListing: true,
        showInInvitations: true,
        featuredListing: true,
        offerSlots: 1,
        offerHoursPerWeek: Infinity,
        offerPerpetual: true,
        analytics: 'full',
        supportLevel: 'dedicated',
        badge: 'elite',
        removeBranding: true,
        canRunAds: true,
        socialMediaIntegration: true,
        apiAccess: true
    }
};

/**
 * Get plan details by ID
 */
export const getPlanById = (planId) => {
    return SUBSCRIPTION_PLANS[planId] || SUBSCRIPTION_PLANS.free;
};

/**
 * Get all available plans
 */
export const getAllPlans = () => {
    return Object.values(SUBSCRIPTION_PLANS);
};

/**
 * Check if a plan has a specific feature
 */
export const hasFeature = (planId, feature) => {
    const plan = getPlanById(planId);
    return plan[feature] || false;
};

/**
 * Get limit value for a plan
 */
export const getLimit = (planId, limitKey) => {
    const plan = getPlanById(planId);
    return plan[limitKey] || 0;
};

/**
 * Compare two plans
 */
export const comparePlans = (planId1, planId2) => {
    const plan1 = getPlanById(planId1);
    const plan2 = getPlanById(planId2);

    return {
        plan1: plan1.name,
        plan2: plan2.name,
        priceDiff: plan2.price - plan1.price,
        isUpgrade: plan2.price > plan1.price
    };
};

/**
 * Get next tier plan (user tiers: free→pro→premium; business tiers: free→professional→elite)
 */
export const getNextTier = (currentPlanId) => {
    const tiers = ['free', 'basic', 'pro', 'premium'];
    const currentIndex = tiers.indexOf(currentPlanId);

    if (currentIndex === -1 || currentIndex === tiers.length - 1) {
        return null;
    }

    return tiers[currentIndex + 1];
};

/** Business tiers only: free → professional → elite */
export const BUSINESS_TIERS = ['free', 'professional', 'elite'];

export const getNextBusinessTier = (currentPlanId) => {
    const idx = BUSINESS_TIERS.indexOf(currentPlanId);
    if (idx === -1 || idx === BUSINESS_TIERS.length - 1) return null;
    return BUSINESS_TIERS[idx + 1];
};

/**
 * Badge configurations
 */
export const PLAN_BADGES = {
    basic: {
        icon: '⭐',
        color: '#3b82f6',
        label: 'Basic Business'
    },
    pro: {
        icon: '🌟',
        color: '#8b5cf6',
        label: 'Pro Business'
    },
    premium: {
        icon: '👑',
        color: '#f59e0b',
        label: 'Premium Business'
    },
    professional: {
        icon: '⚡',
        color: '#8b5cf6',
        label: 'Professional Business'
    },
    elite: {
        icon: '👑',
        color: '#f59e0b',
        label: 'Elite Business'
    }
};

export default SUBSCRIPTION_PLANS;
