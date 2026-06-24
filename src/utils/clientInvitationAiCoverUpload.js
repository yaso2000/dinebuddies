import { auth } from '../firebase/config';
import { uploadMedia } from '../services/mediaService';

/**
 * @param {{ bytesBase64?: string, mimeType?: string } | null | undefined} imagePayload
 * @returns {Promise<string>} Firebase download URL in invitations/{uid}/
 */
export async function uploadInvitationMagicCoverFromApiBytes(imagePayload) {
    const base64 = imagePayload?.bytesBase64;
    if (!base64 || typeof base64 !== 'string') {
        throw new Error('no_image_bytes');
    }

    const user = auth.currentUser;
    if (!user?.uid) {
        throw new Error('not_signed_in');
    }

    const mimeType =
        typeof imagePayload.mimeType === 'string' && imagePayload.mimeType.startsWith('image/')
            ? imagePayload.mimeType
            : 'image/jpeg';

    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
    }

    const ext = mimeType.includes('png') ? 'png' : 'jpg';
    const file = new File([bytes], `ai_cover_${Date.now()}.${ext}`, { type: mimeType });
    return uploadMedia(file, user.uid, 'image', 'invitations');
}

/**
 * @param {unknown} image
 */
export function apiImageNeedsClientUpload(image) {
    if (!image || typeof image !== 'object') return false;
    const record = /** @type {Record<string, unknown>} */ (image);
    return record.clientUpload === true && typeof record.bytesBase64 === 'string' && record.bytesBase64.length > 500;
}
