/** @typedef {'direct' | 'navigate'} AiDesignUseKind */

/**
 * @typedef {{
 *   id: string,
 *   kind: AiDesignUseKind,
 *   labelKey: string,
 *   defaultLabel: string,
 *   defaultLabelAr: string,
 *   icon: string,
 *   folder: string,
 *   route?: string,
 *   scrollToComposer?: boolean,
 *   updateKey?: 'profile_avatar' | 'profile_cover' | 'business_cover' | 'business_logo',
 *   forConsumer?: boolean,
 *   forBusiness?: boolean,
 * }} AiDesignUseDestination
 */

/** @type {AiDesignUseDestination[]} */
export const AI_DESIGN_USE_DESTINATIONS = [
    {
        id: 'profile_avatar',
        kind: 'direct',
        labelKey: 'ai_design_use_profile_avatar',
        defaultLabel: 'Profile picture',
        defaultLabelAr: 'صورة البروفايل',
        icon: '👤',
        folder: 'avatars',
        updateKey: 'profile_avatar',
        forConsumer: true,
        forBusiness: true,
    },
    {
        id: 'profile_cover',
        kind: 'direct',
        labelKey: 'ai_design_use_profile_cover',
        defaultLabel: 'Profile cover',
        defaultLabelAr: 'غلاف البروفايل',
        icon: '🌅',
        folder: 'covers',
        updateKey: 'profile_cover',
        forConsumer: true,
        forBusiness: false,
    },
    {
        id: 'business_cover',
        kind: 'direct',
        labelKey: 'ai_design_use_business_cover',
        defaultLabel: 'Business cover',
        defaultLabelAr: 'غلاف البزنس',
        icon: '🏪',
        folder: 'covers',
        updateKey: 'business_cover',
        forConsumer: false,
        forBusiness: true,
    },
    {
        id: 'business_logo',
        kind: 'direct',
        labelKey: 'ai_design_use_business_logo',
        defaultLabel: 'Business logo',
        defaultLabelAr: 'لوغو البزنس',
        icon: '✨',
        folder: 'logos',
        updateKey: 'business_logo',
        forConsumer: false,
        forBusiness: true,
    },
    {
        id: 'community_post',
        kind: 'navigate',
        labelKey: 'ai_design_use_community_post',
        defaultLabel: 'Feed post',
        defaultLabelAr: 'بوست الفيد',
        icon: '📝',
        folder: 'community-posts',
        route: '/posts-feed',
        scrollToComposer: true,
        forConsumer: true,
        forBusiness: false,
    },
    {
        id: 'motion_post',
        kind: 'navigate',
        labelKey: 'ai_design_use_motion_post',
        defaultLabel: 'Motion post',
        defaultLabelAr: 'بوست حركي',
        icon: '🎬',
        folder: 'business-motion',
        route: '/create-post',
        forConsumer: false,
        forBusiness: true,
    },
    {
        id: 'featured_post',
        kind: 'navigate',
        labelKey: 'ai_design_use_featured_post',
        defaultLabel: 'Featured post',
        defaultLabelAr: 'بوست مميز',
        icon: '⭐',
        folder: 'featured_posts',
        route: '/create-featured-post',
        forConsumer: false,
        forBusiness: true,
    },
    {
        id: 'invitation_public',
        kind: 'navigate',
        labelKey: 'ai_design_use_invitation_public',
        defaultLabel: 'Public invitation cover',
        defaultLabelAr: 'غلاف دعوة عامة',
        icon: '🌐',
        folder: 'invitations',
        route: '/create',
        forConsumer: true,
        forBusiness: false,
    },
    {
        id: 'invitation_private',
        kind: 'navigate',
        labelKey: 'ai_design_use_invitation_private',
        defaultLabel: 'Private invitation cover',
        defaultLabelAr: 'غلاف دعوة خاصة',
        icon: '🔒',
        folder: 'invitations',
        route: '/create-social',
        forConsumer: true,
        forBusiness: false,
    },
    {
        id: 'invitation_dating',
        kind: 'navigate',
        labelKey: 'ai_design_use_invitation_private',
        defaultLabel: 'Private Invite cover',
        defaultLabelAr: 'غلاف دعوة خاصة',
        icon: '💑',
        folder: 'invitations',
        route: '/create-private',
        forConsumer: true,
        forBusiness: false,
    },
];

/**
 * @param {boolean} isBusinessAccount
 * @returns {AiDesignUseDestination[]}
 */
export function listAiDesignUseDestinations(isBusinessAccount) {
    return AI_DESIGN_USE_DESTINATIONS.filter((d) =>
        isBusinessAccount ? d.forBusiness !== false : d.forConsumer !== false
    );
}

/** @param {string} id */
export function getAiDesignUseDestination(id) {
    return AI_DESIGN_USE_DESTINATIONS.find((d) => d.id === id) || null;
}
