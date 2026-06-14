/**
 * Maps stored occasion label (English, from CreatePrivateInvitation grid) → stable category id for icons.
 * Fallback: social
 */
export const OCCASION_TYPE_TO_CATEGORY_ID = {
    Dating: 'dating',
    Birthday: 'birthday',
    Social: 'social',
    Work: 'work',
    Nightlife: 'nightlife',
    Dining: 'dining',
    Café: 'cafe',
    Gaming: 'gaming',
    Family: 'family',
    Celebration: 'celebration',
    Cinema: 'cinema',
    Sports: 'sports',
    'Singing Party': 'concert',
    Concert: 'concert',
    BBQ: 'concert'
};

export function resolveOccasionCategoryId(occasionType) {
    if (!occasionType || typeof occasionType !== 'string') return 'social';
    return OCCASION_TYPE_TO_CATEGORY_ID[occasionType.trim()] || 'social';
}
