/** @typedef {'square' | 'story' | 'landscape' | 'profile_picture' | 'profile_cover' | 'business_logo'} AiDesignStudioCategoryId */

/** @type {Set<string>} */
export const AI_DESIGN_STUDIO_CATEGORY_IDS = new Set([
    'square',
    'story',
    'landscape',
    'profile_picture',
    'profile_cover',
    'business_logo',
]);

/** @type {Record<AiDesignStudioCategoryId, '1:1' | '9:16' | '16:9'>} */
export const AI_DESIGN_CATEGORY_ASPECT = {
    square: '1:1',
    story: '9:16',
    landscape: '16:9',
    profile_picture: '1:1',
    profile_cover: '16:9',
    business_logo: '1:1',
};

/** @type {{ id: AiDesignStudioCategoryId, labelKey: string, defaultLabel: string, defaultLabelAr: string, aspectRatio: '1:1' | '9:16' | '16:9', icon: string, forConsumer?: boolean, forBusiness?: boolean, suggestedDestinationId?: string }[]} */
export const AI_DESIGN_STUDIO_CATEGORIES = [
    {
        id: 'square',
        labelKey: 'ai_design_cat_square',
        defaultLabel: 'Square',
        defaultLabelAr: 'مربع',
        aspectRatio: '1:1',
        icon: '⬜',
        forConsumer: true,
        forBusiness: true,
    },
    {
        id: 'story',
        labelKey: 'ai_design_cat_story',
        defaultLabel: 'Story / Reel',
        defaultLabelAr: 'قصة / 9:16',
        aspectRatio: '9:16',
        icon: '📱',
        forConsumer: true,
        forBusiness: true,
    },
    {
        id: 'landscape',
        labelKey: 'ai_design_cat_landscape',
        defaultLabel: 'Landscape',
        defaultLabelAr: '16:9 أفقي',
        aspectRatio: '16:9',
        icon: '🖼️',
        forConsumer: true,
        forBusiness: true,
    },
    {
        id: 'profile_picture',
        labelKey: 'ai_design_cat_profile_picture',
        defaultLabel: 'Profile picture',
        defaultLabelAr: 'صورة بروفايل',
        aspectRatio: '1:1',
        icon: '👤',
        forConsumer: true,
        forBusiness: true,
        suggestedDestinationId: 'profile_avatar',
    },
    {
        id: 'profile_cover',
        labelKey: 'ai_design_cat_profile_cover',
        defaultLabel: 'Profile cover',
        defaultLabelAr: 'غلاف البروفايل',
        aspectRatio: '16:9',
        icon: '🌅',
        forConsumer: true,
        forBusiness: false,
        suggestedDestinationId: 'profile_cover',
    },
    {
        id: 'business_logo',
        labelKey: 'ai_design_cat_business_logo',
        defaultLabel: 'Business logo',
        defaultLabelAr: 'لوغو البزنس',
        aspectRatio: '1:1',
        icon: '✨',
        forConsumer: false,
        forBusiness: true,
        suggestedDestinationId: 'business_logo',
    },
];

/**
 * @param {unknown} value
 * @returns {value is AiDesignStudioCategoryId}
 */
export function isAiDesignStudioCategoryId(value) {
    return typeof value === 'string' && AI_DESIGN_STUDIO_CATEGORY_IDS.has(value);
}

/**
 * @param {AiDesignStudioCategoryId} categoryId
 * @returns {'1:1' | '9:16' | '16:9'}
 */
export function aspectRatioForDesignCategory(categoryId) {
    return AI_DESIGN_CATEGORY_ASPECT[categoryId] || '1:1';
}

/**
 * @param {boolean} isBusinessAccount
 * @returns {typeof AI_DESIGN_STUDIO_CATEGORIES}
 */
export function listAiDesignStudioCategories(isBusinessAccount) {
    return AI_DESIGN_STUDIO_CATEGORIES.filter((cat) =>
        isBusinessAccount ? cat.forBusiness !== false : cat.forConsumer !== false
    );
}

/**
 * Suggested «use in app» destination for a design category (if any).
 * @param {string} categoryId
 * @param {boolean} isBusinessAccount
 * @returns {string | null}
 */
export function suggestedDestinationIdForCategory(categoryId, isBusinessAccount) {
    const cat = AI_DESIGN_STUDIO_CATEGORIES.find((c) => c.id === categoryId);
    if (!cat?.suggestedDestinationId) return null;
    if (isBusinessAccount && cat.forBusiness === false) return null;
    if (!isBusinessAccount && cat.forConsumer === false) return null;
    return cat.suggestedDestinationId;
}
