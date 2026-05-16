/**
 * Business subscription limits keyed by `users.subscriptionTier`.
 * Model: `free` | `paid`. Legacy Stripe/webhook values map to these via normalizeBusinessPlanId().
 */

const PAID_PLAN = {
    id: 'paid',
    name: 'Paid',
    displayName: 'Paid Business',
    price: 20,
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
    supportLevel: 'priority',
    badge: 'paid',
    removeBranding: true,
    canRunAds: false,
    socialMediaIntegration: true,
    apiAccess: false
};

const FREE_PLAN = {
    id: 'free',
    name: 'Free',
    displayName: 'Free Business',
    price: 0,
    currency: 'USD',
    interval: 'month',
    maxMembers: 50,
    maxPostsPerMonth: 0,
    maxServices: 0,
    canCreateOffers: false,
    canCreateEvents: false,
    priorityListing: false,
    showInInvitations: false,
    featuredListing: false,
    analytics: 'none',
    supportLevel: 'community',
    badge: null,
    removeBranding: false,
    canRunAds: false,
    socialMediaIntegration: false,
    apiAccess: false
};

export const SUBSCRIPTION_PLANS = {
    free: FREE_PLAN,
    paid: PAID_PLAN
};

/**
 * Map Firestore / legacy tier strings → `free` | `paid` for plan lookups.
 */
export function normalizeBusinessPlanId(planId) {
    const t = String(planId || 'free').trim().toLowerCase();
    if (t === 'paid') return 'paid';
    if (t === 'elite' || t === 'professional' || t === 'pro' || t === 'premium' || t === 'basic') return 'paid';
    return 'free';
}

export const getPlanById = (planId) => {
    const key = normalizeBusinessPlanId(planId);
    return SUBSCRIPTION_PLANS[key] || SUBSCRIPTION_PLANS.free;
};

export const getAllPlans = () => Object.values(SUBSCRIPTION_PLANS);

export const hasFeature = (planId, feature) => {
    const plan = getPlanById(planId);
    return plan[feature] || false;
};

export const getLimit = (planId, limitKey) => {
    const plan = getPlanById(planId);
    return plan[limitKey] || 0;
};

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

/** @deprecated consumer tiers removed */
export const getNextTier = (currentPlanId) => {
    const tiers = ['free', 'paid'];
    const currentIndex = tiers.indexOf(normalizeBusinessPlanId(currentPlanId));
    if (currentIndex === -1 || currentIndex === tiers.length - 1) return null;
    return tiers[currentIndex + 1];
};

export const BUSINESS_TIERS = ['free', 'paid'];

export const getNextBusinessTier = (currentPlanId) => {
    const id = normalizeBusinessPlanId(currentPlanId);
    const idx = BUSINESS_TIERS.indexOf(id);
    if (idx === -1 || idx === BUSINESS_TIERS.length - 1) return null;
    return BUSINESS_TIERS[idx + 1];
};

export const PLAN_BADGES = {
    free: {
        icon: '🎁',
        color: '#64748b',
        label: 'Free Business'
    },
    paid: {
        icon: '👑',
        color: '#f59e0b',
        label: 'Paid Business'
    }
};

export default SUBSCRIPTION_PLANS;
