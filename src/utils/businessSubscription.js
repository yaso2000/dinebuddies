/**
 * Business subscription — users/{uid}.subscriptionTier
 * Model: 'free' | 'paid' ($29/mo). Legacy elite/professional map to paid for backward compatibility.
 * Regular (consumer) accounts do not use subscription tiers for gating — use Dine Credits instead.
 */

const ALLOWED = new Set(['free', 'paid']);

export function normalizeBusinessTier(raw) {
    const t = String(raw || 'free').trim().toLowerCase();
    if (t === 'paid') return 'paid';
    /** @deprecated legacy Stripe/webhook values */
    if (t === 'elite' || t === 'professional' || t === 'premium' || t === 'pro') return 'paid';
    return 'free';
}

/**
 * @param {string|null|undefined} subscriptionTier - from users/{uid}.subscriptionTier (business accounts)
 */
export function getBusinessSubscriptionAccess(subscriptionTier) {
    const tier = normalizeBusinessTier(subscriptionTier);
    const isFree = tier === 'free';
    const isPaid = tier === 'paid';

    return {
        tier,
        isFree,
        isPaid,
        /** @deprecated use isPaid */
        isProfessional: isPaid,
        /** @deprecated use isPaid */
        isElite: isPaid,
        /** @deprecated use isPaid */
        isPaidTier: isPaid,

        /** Paid: full tools; free: baseline */
        canManageMenu: isPaid,
        canManageServices: isPaid,
        canCreateFeaturedPost: isPaid,
        canManageDeliveryProfiles: isPaid,
        canCreateSpecialOfferPost: isPaid,
        canCreateEventPost: isPaid,
        /** Community / analytics / notifications — paid only */
        canUseAdvancedAnalytics: isPaid,
        canUseMemberNotifications: isPaid,
        canUnlimitedManualMotionPosts: isPaid,
    };
}
