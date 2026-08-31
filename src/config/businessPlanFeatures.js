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
    ['biz_plan_free_feat_community', 'Community page & group chat — members can join and chat'],
    ['biz_plan_free_feat_directory', 'Public listing when profile is published'],
    ['biz_plan_free_feat_brand_kit', 'Brand Kit (colors & theme)'],
    ['biz_plan_free_feat_ai_credits', 'AI features use Dine Credits (not included)'],
];

/** i18n keys — Paid column. */
export const BUSINESS_PAID_PLAN_FEATURE_KEYS = [
    ['biz_plan_paid_feat_dashboard', 'Business dashboard'],
    ['biz_plan_paid_feat_business_stage', '24-hour Stage (live event room) for your community'],
    ['biz_plan_paid_feat_motion_featured', 'Motion posts & featured posts'],
    ['biz_plan_paid_feat_clickable_links', 'Clickable website, map & social links'],
    ['biz_plan_paid_feat_menu_services', 'Menu & services on public profile'],
    ['biz_plan_paid_feat_delivery', 'Delivery & ordering links'],
    ['biz_plan_paid_feat_gallery_20', 'Photo gallery — up to 20 images'],
    ['biz_plan_paid_feat_offers', 'Special offers & premium offers'],
    ['biz_plan_paid_feat_swipe_offer', 'Special offer banner on business swipe cards'],
    ['biz_plan_paid_feat_jobs', 'Job postings — hire from your community (in-app applications + PDF)'],
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
    const t = String(rawTier || BUSINESS_PLAN_TIERS.FREE).trim().toLowerCase();
    // Legacy Stripe / admin values that mean an active paid business plan.
    if (
        t === BUSINESS_PLAN_TIERS.PAID ||
        t === 'elite' ||
        t === 'professional' ||
        t === 'pro' ||
        t === 'business'
    ) {
        return BUSINESS_PLAN_TIERS.PAID;
    }
    return BUSINESS_PLAN_TIERS.FREE;
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
        /** One special offer banner on /restaurants magnetic swipe cards. */
        canUseSwipeSpecialOffer: isPaid,
        canCreateEventPost: isPaid,
        canUseAdvancedAnalytics: isPaid,
        canUseMemberNotifications: isPaid,
        /** Permanent community group chat — free for every tier; join/membership was always free. */
        canUseCommunityGroupChat: true,
        /** Business-hosted Stage (24h live room) — Paid only. Personal/consumer Stages are unaffected. */
        canCreateBusinessStage: isPaid,
        canUnlimitedManualMotionPosts: isPaid,
        canAppearInPaidRankings: isPaid,
        showPaidProfileBadge: isPaid,
    };
}

/**
 * Credit-based "Pro Lite" pass — pay-on-demand (non-recurring), a cheaper
 * alternative to the $29/mo full plan that unlocks only a small set of practical
 * features. Coexists with Dine-Credit top-ups and the full subscription.
 */
export const BUSINESS_PRO_LITE = Object.freeze({
    creditCost: 2000,
    durationDays: 30,
    /** The ONLY feature flags a Pro-Lite pass unlocks (a subset of full Paid). */
    features: Object.freeze([
        'canManageDeliveryProfiles', // delivery / ordering links
        'canCreateSpecialOfferPost', // special offers
        'canUseSwipeSpecialOffer', // special-offer banner on swipe cards
        'canCreateBusinessStage', // 24h Stage
    ]),
});

/**
 * True while a credit Pro-Lite pass is still active.
 * Accepts a Firestore Timestamp | Date | ms number | ISO string.
 * @param {any} proLiteUntil
 */
export function isBusinessProLiteActive(proLiteUntil) {
    if (!proLiteUntil) return false;
    let ms;
    if (typeof proLiteUntil === 'number') ms = proLiteUntil;
    else if (typeof proLiteUntil.toDate === 'function') ms = proLiteUntil.toDate().getTime();
    else if (typeof proLiteUntil.seconds === 'number') ms = proLiteUntil.seconds * 1000;
    else ms = Date.parse(String(proLiteUntil));
    return Number.isFinite(ms) && ms > Date.now();
}

/**
 * Lite-aware access — identical to getBusinessPlanAccess EXCEPT the Pro-Lite
 * feature subset unlocks on EITHER the full ($29) plan OR an active credit
 * Pro-Lite pass. Use this ONLY at the call sites that gate those few features;
 * every other gate keeps calling getBusinessPlanAccess unchanged (zero risk).
 * @param {{ subscriptionTier?: string, businessProLiteUntil?: any }|null|undefined} profile
 */
export function getBusinessProAccess(profile) {
    const base = getBusinessPlanAccess(profile?.subscriptionTier);
    const isLite = isBusinessProLiteActive(profile?.businessProLiteUntil);
    const unlocked = base.isPaid || isLite;
    const access = { ...base, isLite, isPaidOrLite: unlocked };
    for (const key of BUSINESS_PRO_LITE.features) access[key] = unlocked;
    return access;
}
