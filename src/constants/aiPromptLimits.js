/** User-facing AI prompt field — optional, capped for cost and clarity. */
export const AI_USER_PROMPT_MAX_CHARS = 300;

/** English fallbacks when the client sends an empty prompt (API safety net). */
export function getAiUserPromptDefaultEn(postType, subType) {
    if (postType === 'invitation') {
        if (subType === 'private') {
            return 'Write a private invite title and a short romantic message suited to the occasion.';
        }
        if (subType === 'social') {
            return 'Write a private invitation title and welcoming message suited to the occasion and venue.';
        }
        return 'Write an invitation title and welcoming message suited to the context above.';
    }
    if (postType === 'featured_post') {
        return 'Featured post for the business';
    }
    if (postType === 'animated_post') {
        return 'Promotional animated community post';
    }
    if (postType === 'design_studio') {
        return 'Modern social media graphic';
    }
    return 'Short friendly community post';
}
