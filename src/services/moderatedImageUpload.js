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

/** Purposes accepted by moderateImage Cloud Function — every image zone. */
export const MODERATION_PURPOSES = new Set([
    ImageUploadZone.PRIVATE_DM,
    ImageUploadZone.PUBLIC_CHAT,
    ImageUploadZone.INVITATION,
    ImageUploadZone.THUMBNAIL,
    ImageUploadZone.POST,
    ImageUploadZone.STORY,
    ImageUploadZone.AVATAR,
    ImageUploadZone.DATING_PHOTO,
    ImageUploadZone.COVER,
    ImageUploadZone.LOGO,
    ImageUploadZone.GALLERY,
    ImageUploadZone.MENU,
    ImageUploadZone.OFFER,
    ImageUploadZone.PREMIUM_OFFER,
    ImageUploadZone.BUSINESS,
    ImageUploadZone.PLACE,
    ImageUploadZone.FEATURED,
    ImageUploadZone.REAL_OR_AI_PHOTO,
    ImageUploadZone.AI_EDIT_INPUT,
    // legacy aliases (older clients / deploys)
    'chat',
    'invitation',
    'social_dm',
]);

export const IMAGE_MODERATION_REJECTED = 'image-rejected';
export const IMAGE_MODERATION_UNAVAILABLE = 'moderation-unavailable';
export const IMAGE_MODERATION_NO_FACE = 'no-face';
// "Camera or AI?" game anti-abuse codes.
export const CAM_AI_NO_SELFIE = 'no-selfie';
export const CAM_AI_GAME_BLOCKED = 'game-blocked';

/**
 * Map a moderateImage error for a game selfie into a normalized error carrying the
 * escalation level (1 notice, 2 warning, 3 blocked) so the UI can message it.
 * Returns null if it isn't a selfie/abuse rejection.
 * @param {unknown} error
 */
export function gameSelfieRejection(error) {
    const details = error?.details || {};
    const reason = String(details.reason || '');
    const msg = String(error?.message || '').toLowerCase();
    if (reason === CAM_AI_GAME_BLOCKED || msg.includes('blocked from this game')) {
        const e = new Error('game-blocked');
        e.code = CAM_AI_GAME_BLOCKED;
        e.level = 3;
        e.blockedUntil = Number(details.blockedUntil) || 0;
        return e;
    }
    if (reason === IMAGE_MODERATION_NO_FACE || msg.includes('selfie') || msg.includes('human face')) {
        const e = new Error('no-selfie');
        e.code = CAM_AI_NO_SELFIE;
        e.level = Number(details.level) || 1;
        return e;
    }
    return null;
}

/**
 * True when a profile photo was rejected for not containing a clear human face.
 * @param {unknown} error
 * @returns {boolean}
 */
export function isImageModerationNoFace(error) {
    if (!error) return false;
    if (String(error.code || '') === IMAGE_MODERATION_NO_FACE) return true;
    if (error?.details?.reason === IMAGE_MODERATION_NO_FACE) return true;
    return String(error.message || '').toLowerCase().includes('human face');
}

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
 * @param {string} purpose — ImageUploadZone value
 * @param {{ onProgress?: (pct: number) => void }} [opts]
 * @returns {Promise<string>}
 */
export async function uploadImageWithModeration(file, userId, purpose, opts = {}) {
    const { onProgress } = opts;
    if (!userId) throw new Error('User ID required');
    // Map 1:1 DM + legacy "chat" onto chat_public so Vision always runs
    // (same Storage dest: chat_images/). Works with current and older CF deploys.
    const normalized =
        purpose === 'chat' ||
        purpose === ImageUploadZone.PRIVATE_DM ||
        purpose === 'social_dm'
            ? ImageUploadZone.PUBLIC_CHAT
            : purpose === 'invitation'
              ? ImageUploadZone.INVITATION
              : purpose;
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
        if (isImageModerationNoFace(error)) {
            const err = new Error('no-face');
            err.code = IMAGE_MODERATION_NO_FACE;
            err.name = 'ImageModerationNoFaceError';
            throw err;
        }
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

/**
 * "Real or AI?" game camera photo — upload + NSFW moderation, returns BOTH the
 * public url AND the storage path (the path lets the server derive the true source).
 * @returns {Promise<{ url: string, path: string }>}
 */
export async function uploadRealOrAiPhoto(file, userId, onProgress) {
    if (!userId) throw new Error('User ID required');
    const timestamp = Date.now();
    const quarantinePath = `quarantine/${userId}/${timestamp}_realornai_photo.jpg`;
    const storageRef = ref(storage, quarantinePath);
    const contentType = file.type && file.type.startsWith('image/') ? file.type : 'image/jpeg';
    if (onProgress) onProgress(15);
    await uploadBytes(storageRef, file, { contentType });
    if (onProgress) onProgress(45);
    const functions = getFunctions(app, FUNCTIONS_REGION);
    const moderateImage = httpsCallable(functions, 'moderateImage');
    try {
        const { data } = await moderateImage({ quarantinePath, purpose: 'realornai_photo' });
        if (onProgress) onProgress(100);
        const url = data?.url;
        const path = data?.path;
        if (!url || !path) throw new Error('Moderation did not return image url/path');
        return { url, path };
    } catch (error) {
        const selfieErr = gameSelfieRejection(error);
        if (selfieErr) throw selfieErr;
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

/**
 * Upload + NSFW-moderate an image the user wants to EDIT with AI. Returns the
 * public url AND the storage path (the server downloads the path to feed the edit model).
 * @returns {Promise<{ url: string, path: string }>}
 */
export async function uploadAiEditInput(file, userId, onProgress) {
    if (!userId) throw new Error('User ID required');
    const timestamp = Date.now();
    const quarantinePath = `quarantine/${userId}/${timestamp}_ai_edit_input.jpg`;
    const storageRef = ref(storage, quarantinePath);
    const contentType = file.type && file.type.startsWith('image/') ? file.type : 'image/jpeg';
    if (onProgress) onProgress(15);
    await uploadBytes(storageRef, file, { contentType });
    if (onProgress) onProgress(45);
    const functions = getFunctions(app, FUNCTIONS_REGION);
    const moderateImage = httpsCallable(functions, 'moderateImage');
    try {
        const { data } = await moderateImage({ quarantinePath, purpose: 'ai_edit_input' });
        if (onProgress) onProgress(100);
        const url = data?.url;
        const path = data?.path;
        if (!url || !path) throw new Error('Moderation did not return image url/path');
        return { url, path };
    } catch (error) {
        const selfieErr = gameSelfieRejection(error);
        if (selfieErr) throw selfieErr;
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
