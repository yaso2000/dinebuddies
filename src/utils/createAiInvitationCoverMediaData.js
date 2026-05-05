/**
 * Turn /api/generate-image response (mimeType + dataBase64) into MediaSelector-compatible custom_image payload.
 */
export async function createAiInvitationCoverMediaData({ mimeType, dataBase64 }) {
    const dataUrl = `data:${mimeType};base64,${dataBase64}`;
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    const ext = String(mimeType).includes('png') ? 'png' : 'jpg';
    const file = new File([blob], `ai-invitation-cover.${ext}`, { type: mimeType });
    return {
        source: 'custom_image',
        type: 'image',
        file,
        preview: dataUrl,
        fromAi: true,
    };
}
