/**
 * Invitation magic covers: deliver bytes to the browser and let the client SDK
 * upload to invitations/{uid}/ — same path as camera / file picker (proven on production).
 */

export function shouldDeliverInvitationImageToClient(postType, generationPackage) {
    return String(postType || '') === 'invitation' && generationPackage === 'image';
}

/**
 * @param {{ bytesBase64: string, mimeType: string, moderation?: unknown, imagePrompt?: string }} pendingImage
 */
export function buildClientDeliveredInvitationImage(pendingImage) {
    return {
        clientUpload: true,
        bytesBase64: pendingImage.bytesBase64,
        mimeType: pendingImage.mimeType,
        moderation: pendingImage.moderation,
        imagePrompt: pendingImage.imagePrompt,
    };
}
