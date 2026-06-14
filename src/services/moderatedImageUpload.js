import { ref, uploadBytes, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { getFunctions, httpsCallable } from 'firebase/functions';
import app, { storage } from '../firebase/config';
import { ImageUploadZone } from './imageUploadZones';
import {
    startCheckingPulse,
    stopCheckingPulse,
    updateImageUploadSession,
} from './imageUploadProgressStore';

const FUNCTIONS_REGION = 'us-central1';

/** Purposes accepted by moderateImage Cloud Function */
export const MODERATION_PURPOSES = new Set([
    ImageUploadZone.PUBLIC_CHAT,
    ImageUploadZone.INVITATION,
    ImageUploadZone.THUMBNAIL,
    ImageUploadZone.POST,
    ImageUploadZone.STORY,
    ImageUploadZone.AVATAR,
    ImageUploadZone.COVER,
    ImageUploadZone.LOGO,
    ImageUploadZone.GALLERY,
    ImageUploadZone.MENU,
    ImageUploadZone.OFFER,
    ImageUploadZone.PREMIUM_OFFER,
    ImageUploadZone.BUSINESS,
    ImageUploadZone.PLACE,
    ImageUploadZone.FEATURED,
    // legacy aliases (older clients / deploys)
    'chat',
    'invitation',
]);

export const IMAGE_MODERATION_REJECTED = 'image-rejected';
export const IMAGE_MODERATION_UNAVAILABLE = 'moderation-unavailable';

/**
 * @param {unknown} error
 * @returns {boolean}
 */
export function isImageModerationRejected(error) {
    if (!error) return false;
    const code = String(error.code || '');
    const details = error.details;
    if (details?.reason === IMAGE_MODERATION_REJECTED) return true;
    if (code === IMAGE_MODERATION_REJECTED) return true;
    const msg = String(error.message || '').toLowerCase();
    if (
        msg.includes('content policy') ||
        msg.includes(IMAGE_MODERATION_REJECTED) ||
        msg.includes('not allowed') ||
        msg.includes('cannot be posted')
    ) {
        return true;
    }
    if (code === 'functions/failed-precondition' && (msg.includes('policy') || msg.includes('violat'))) {
        return true;
    }
    return false;
}

/**
 * @param {unknown} error
 * @returns {boolean}
 */
export function isImageModerationUnavailable(error) {
    const details = error?.details;
    if (details?.reason === IMAGE_MODERATION_UNAVAILABLE) return true;
    return String(error?.code || '').includes('unavailable');
}

/**
 * Upload image to quarantine, run Vision Safe Search via Cloud Function, return public URL.
 * @param {File|Blob} file
 * @param {string} userId
 * @param {string} purpose — ImageUploadZone (not PRIVATE_DM)
 * @param {{ onProgress?: (pct: number) => void }} [opts]
 * @returns {Promise<string>}
 */
export async function uploadImageWithModeration(file, userId, purpose, opts = {}) {
    const { onProgress } = opts;
    if (!userId) throw new Error('User ID required');
    const normalized =
        purpose === 'chat' ? ImageUploadZone.PUBLIC_CHAT : purpose === 'invitation' ? ImageUploadZone.INVITATION : purpose;
    if (!MODERATION_PURPOSES.has(normalized)) {
        throw new Error(`Invalid moderation purpose: ${purpose}`);
    }

    const report = (pct, phase) => {
        updateImageUploadSession(pct, phase);
        if (onProgress) onProgress(pct);
    };

    const timestamp = Date.now();
    const quarantinePath = `quarantine/${userId}/${timestamp}_${normalized}.jpg`;
    const storageRef = ref(storage, quarantinePath);

    const contentType = file.type && file.type.startsWith('image/') ? file.type : 'image/jpeg';
    report(12, 'uploading');
    await uploadBytes(storageRef, file, { contentType });
    report(38, 'uploading');

    const functions = getFunctions(app, FUNCTIONS_REGION);
    const moderateImage = httpsCallable(functions, 'moderateImage');

    const stopPulse = startCheckingPulse((pct) => report(pct, 'checking'));

    try {
        const { data } = await moderateImage({ quarantinePath, purpose: normalized });
        stopPulse();
        report(100, 'done');
        const url = data?.url;
        if (!url || typeof url !== 'string') {
            throw new Error('Moderation did not return an image URL');
        }
        return url;
    } catch (error) {
        stopCheckingPulse();
        if (isImageModerationRejected(error)) {
            const err = new Error('image-rejected');
            err.code = IMAGE_MODERATION_REJECTED;
            err.name = 'ImageModerationRejectedError';
            throw err;
        }
        if (isImageModerationUnavailable(error)) {
            const err = new Error(IMAGE_MODERATION_UNAVAILABLE);
            err.code = IMAGE_MODERATION_UNAVAILABLE;
            throw err;
        }
        throw error;
    }
}
