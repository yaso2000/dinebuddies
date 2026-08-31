/**
 * Maps stored social-invite type label (English, from CreateSocialInvitation) → stable
 * category id for icons/card art. Social invites now have three types only.
 * Legacy occasion labels fall back to 'social'.
 */
export const OCCASION_TYPE_TO_CATEGORY_ID = {
    Friendship: 'friendship',
    Social: 'social',
    Family: 'family',
    Work: 'work',
    'Serious relationship': 'serious',
    'Getting acquainted': 'acquaintance',
};

export function resolveOccasionCategoryId(occasionType) {
    if (!occasionType || typeof occasionType !== 'string') return 'social';
    return OCCASION_TYPE_TO_CATEGORY_ID[occasionType.trim()] || 'social';
}
