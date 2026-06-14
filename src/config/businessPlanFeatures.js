/**
 * Business plan — single source of truth for Free vs Paid ($29/mo).
 * Dine Credits (AI) are separate from subscription tier.
 *
 * Google Business data (admin import) is free to display on the profile.
 * On Free, imported website / map / social are visible but not clickable.
 */

export const BUSINESS_PLAN_TIERS = Object.freeze({
    FREE: 'free',
    PAID: 'paid',
});

/** Numeric limits per tier (`null` = unlimited, `0` = none). */
export const BUSINESS_PLAN_LIMITS = Object.freeze({
    free: {
        galleryMaxImages: 6,
        manualMotionPostsPerMonth: 0,
    },
    paid: {
        galleryMaxImages: 20,
        manualMotionPostsPerMonth: null,
    },
});

/** i18n keys shown on /settings/subscription — Free column. */
export const BUSINESS_FREE_PLAN_FEATURE_KEYS = [
    ['biz_plan_free_feat_profile', 'Business profile, cover & logo'],
    ['biz_plan_free_feat_contact_basic', 'Phone, email, address, city & hours'],
    ['biz_plan_free_feat_google_import', 'Google Business data from admin import (display)'],
    ['biz_plan_free_feat_links_view_only', 'Website, map & social visible — open links requires Paid'],
    ['biz_plan_free_feat_gallery_6', 'Photo gallery — up to 6 images'],
    ['biz_plan_free_feat_community', 'Community page & follower chat'],
    ['biz_plan_free_feat_directory', 'Public listing when profile is published'],
    ['biz_plan_free_feat_brand_kit', 'Brand Kit (colors & theme)'],
    ['biz_plan_free_feat_ai_credits', 'AI features use Dine Credits (not included)'],
];

/** i18n keys — Paid column. */
export const BUSINESS_PAID_PLAN_FEATURE_KEYS = [
    ['biz_plan_paid_feat_dashboard', 'Business dashboard'],
    ['biz_plan_paid_feat_motion_featured', 'Motion posts & featured posts'],
    ['biz_plan_paid_feat_clickable_links', 'Clickable website, map & social links'],
    ['biz_plan_paid_feat_menu_services', 'Menu & services on public profile'],
    ['biz_plan_paid_feat_delivery', 'Delivery & ordering links'],
    ['biz_plan_paid_feat_gallery_20', 'Photo gallery — up to 20 images'],
    ['biz_plan_paid_feat_offers', 'Special offers & premium offers'],
    ['biz_plan_paid_feat_member_notifs', 'Member notifications & broadcasts'],
    ['biz_plan_paid_feat_analytics', 'Advanced analytics & ranking breakdown'],
    ['biz_plan_paid_feat_priority', 'Priority in business rankings & directory'],
    ['biz_plan_paid_feat_badge', 'Paid Business badge on profile'],
    ['biz_plan_paid_feat_ai_credits_note', 'AI still uses Dine Credits — not unlimited'],
];

/**
 * @param {string|null|undefined} rawTier
 * @returns {'free'|'paid'}
 */
export function normalizeBusinessPlanTier(rawTier) {
    return String(rawTier || BUSINESS_PLAN_TIERS.FREE).trim().toLowerCase() === BUSINESS_PLAN_TIERS.PAID
        ? BUSINESS_PLAN_TIERS.PAID
        : BUSINESS_PLAN_TIERS.FREE;
}

/**
 * @param {string|null|undefined} subscriptionTier
 */
export function getBusinessPlanLimits(subscriptionTier) {
    const tier = normalizeBusinessPlanTier(subscriptionTier);
    return BUSINESS_PLAN_LIMITS[tier];
}

/**
 * @param {string|null|undefined} subscriptionTier
 */
export function getBusinessPlanAccess(subscriptionTier) {
    const tier = normalizeBusinessPlanTier(subscriptionTier);
    const isPaid = tier === BUSINESS_PLAN_TIERS.PAID;
    const limits = BUSINESS_PLAN_LIMITS[tier];

    return {
        tier,
        isFree: !isPaid,
        isPaid,
        limits,
        galleryMaxImages: limits.galleryMaxImages,
        manualMotionPostsPerMonth: limits.manualMotionPostsPerMonth,
        /** Admin Google import fields may show on Free; taps open only when Paid. */
        canClickProfileExternalLinks: isPaid,
        canAccessDashboard: isPaid,
        canCreateMotionPost: isPaid,
        canPublishMenuPublicly: isPaid,
        canPublishServicesPublicly: isPaid,
        canShowProContactOnProfile: isPaid,
        canManageMenu: isPaid,
        canManageServices: isPaid,
        canManageDeliveryProfiles: isPaid,
        canCreateFeaturedPost: isPaid,
        canCreateSpecialOfferPost: isPaid,
        canCreateEventPost: isPaid,
        canUseAdvancedAnalytics: isPaid,
        canUseMemberNotifications: isPaid,
        canUnlimitedManualMotionPosts: isPaid,
        canAppearInPaidRankings: isPaid,
        showPaidProfileBadge: isPaid,
    };
}
