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
        maxServices: 5,

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
 * Get next tier plan
 */
export const getNextTier = (currentPlanId) => {
    const tiers = ['free', 'basic', 'pro', 'premium'];
    const currentIndex = tiers.indexOf(currentPlanId);

    if (currentIndex === -1 || currentIndex === tiers.length - 1) {
        return null;
    }

    return tiers[currentIndex + 1];
};

/**
 * Badge configurations
 */
export const PLAN_BADGES = {
    basic: {
        icon: '⭐',
        color: '#3b82f6',
        label: 'Basic Partner'
    },
    pro: {
        icon: '🌟',
        color: '#8b5cf6',
        label: 'Pro Partner'
    },
    premium: {
        icon: '👑',
        color: '#f59e0b',
        label: 'Premium Partner'
    }
};

export default SUBSCRIPTION_PLANS;
