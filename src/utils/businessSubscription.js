/**
 * Business subscription — users/{uid}.subscriptionTier
 * Strict model: 'free' | 'paid' ($29/mo via Stripe).
 * Dine Credits are separate — not a subscription tier.
 *
 * Feature matrix: src/config/businessPlanFeatures.js
 */

export {
    BUSINESS_PLAN_TIERS,
    BUSINESS_PLAN_LIMITS,
    BUSINESS_FREE_PLAN_FEATURE_KEYS,
    BUSINESS_PAID_PLAN_FEATURE_KEYS,
    normalizeBusinessPlanTier as normalizeBusinessTier,
    getBusinessPlanLimits,
    getBusinessPlanAccess as getBusinessSubscriptionAccess,
} from '../config/businessPlanFeatures';
