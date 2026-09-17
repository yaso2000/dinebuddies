/** User-facing AI prompt field — optional, capped for cost and clarity. */
export const AI_USER_PROMPT_MAX_CHARS = 300;

/** English fallbacks when the client sends an empty prompt (API safety net). */
export function getAiUserPromptDefaultEn(postType, subType) {
    if (postType === 'invitation') {
        // subType is 'public' | 'private' | 'date' — 'date' is the legacy name of the
        // one-to-one personal invite (a friendly meal, never romantic).
        if (subType === 'date') {
            return 'Write a warm, friendly invitation title and a short message suited to the occasion.';
        }
        if (subType === 'private') {
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
    if (postType === 'text_assistant') {
        return 'How do I stay safe and respectful when meeting someone new?';
    }
    return 'Short friendly community post';
}
