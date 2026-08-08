/** Backend AI credit pricing (100 credits = $1 USD). */
export const TEXT_GENERATION_COST_CREDITS = 10;
export const IMAGE_GENERATION_COST_CREDITS = 25;
export const INVITATION_BUNDLE_COST_CREDITS = 30;

/** @typedef {'text' | 'image' | 'invitation_bundle'} GenerationPackage */

/**
 * @param {GenerationPackage | string | undefined} generationPackage
 * @param {string | undefined} postType
 */
export function resolveCreditCost(generationPackage, postType) {
    const pkg = String(generationPackage || '').trim();

    if (pkg === 'invitation_bundle') {
        return INVITATION_BUNDLE_COST_CREDITS;
    }
    if (pkg === 'image' || postType === 'magic_cover') {
        return IMAGE_GENERATION_COST_CREDITS;
    }
    return TEXT_GENERATION_COST_CREDITS;
}

/**
 * @param {GenerationPackage | string | undefined} generationPackage
 * @param {string | undefined} postType
 */
export function resolveLedgerAiType(generationPackage, postType) {
    const pkg = String(generationPackage || '').trim();
    if (pkg === 'invitation_bundle') {
        return 'ai_invitation_bundle';
    }
    if (pkg === 'image' || postType === 'magic_cover') {
        return 'ai_image_generate';
    }
    return 'ai_text_generate';
}
