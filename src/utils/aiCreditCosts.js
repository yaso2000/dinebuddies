/** Backend-aligned AI credit pricing (100 credits = $1 USD). */
export const AI_TEXT_GENERATION_CREDITS = 10;
export const AI_IMAGE_GENERATION_CREDITS = 25;
export const AI_INVITATION_BUNDLE_CREDITS = 30;

export const CREDITS_WALLET_PATH = '/settings/credits';

/** @typedef {'text' | 'image' | 'invitation_bundle'} AIGenerationPackage */

/**
 * @param {'text' | 'image' | 'invitation_bundle'} [generationPackage]
 * @param {'regular_post' | 'featured_post' | 'animated_post' | 'invitation' | 'magic_cover'} postType
 */
export function aiCreditCostForPostType(postType, generationPackage) {
    if (generationPackage === 'invitation_bundle') {
        return AI_INVITATION_BUNDLE_CREDITS;
    }
    if (generationPackage === 'image' || postType === 'magic_cover') {
        return AI_IMAGE_GENERATION_CREDITS;
    }
    return AI_TEXT_GENERATION_CREDITS;
}

/**
 * @param {'regular_post' | 'featured_post' | 'animated_post' | 'invitation' | 'magic_cover'} postType
 * @param {AIGenerationPackage} [generationPackage]
 */
export function aiCreditCostLabelAr(postType, generationPackage) {
    const cost = aiCreditCostForPostType(postType, generationPackage);
    return `✨ يستهلك ${cost} كريدت`;
}
